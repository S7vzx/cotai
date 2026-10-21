-- =====================================================================
-- Cotaí — recompra
-- O cliente logado pede de novo os produtos de uma cotação aprovada.
-- O pedido nasce em "cotado", sem taxa, com a opção e o preço anteriores;
-- a equipe confirma (preço igual ou menor) e ele vira compra, ou ajusta e
-- envia ao cliente como uma cotação normal.
-- =====================================================================

alter table public.quote_requests
  add column rebuy_of uuid references public.quote_requests (id) on delete set null;
create index quote_requests_rebuy_of_idx on public.quote_requests (rebuy_of) where rebuy_of is not null;

-- preço por unidade aprovado na compra anterior (só em itens de recompra)
alter table public.quote_items add column previous_price numeric(12, 2);

-- O cliente (sem perfil na equipe) também muda status ao pedir recompra:
-- o autor no histórico só é gravado quando é alguém da equipe.
create or replace function public.log_status_change()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_entity text := tg_argv[0];
  v_author uuid := (select id from public.profiles where id = auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.status_history (entity_type, entity_id, from_status, to_status, changed_by)
    values (v_entity, new.id, null, new.status::text, v_author);
  elsif new.status is distinct from old.status then
    insert into public.status_history (entity_type, entity_id, from_status, to_status, changed_by,
                                       note)
    values (v_entity, new.id, old.status::text, new.status::text, v_author,
            nullif(current_setting('app.status_note', true), ''));
  end if;
  return new;
end $$;

-- ---------- cliente pede a recompra ------------------------------------
-- p_items: [{ "item_id": "<id do produto aprovado>", "quantity": 10 }, ...]
create or replace function public.create_rebuy(p_code text, p_items jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.settings;
  q public.quote_requests;
  v_new public.quote_requests;
  v_email text;
  v_entry record;
  v_item public.quote_items;
  v_option public.quote_options;
  v_item_id uuid;
  v_pos int := 0;
begin
  select * into s from public.settings;
  select lower(email) into v_email from auth.users
  where id = auth.uid() and email is not null and email_confirmed_at is not null;
  if v_email is null then
    raise exception 'Entre com seu e-mail para comprar de novo' using errcode = '28000';
  end if;

  select q2.* into q from public.quote_requests q2
  join public.customers c on c.id = q2.customer_id
  where q2.code = upper(trim(p_code)) and lower(c.email) = v_email;
  if q.id is null then
    raise exception 'Cotação não encontrada' using errcode = 'P0002';
  end if;
  if q.status <> 'aprovado' then
    raise exception 'Só cotações aprovadas podem ser compradas de novo' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Escolha pelo menos um produto' using errcode = 'P0001';
  end if;

  -- anti-spam: no máximo 5 recompras por cliente por hora
  if (select count(*) from public.rate_limits
      where key = 'rebuy:' || auth.uid() and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Muitos pedidos em pouco tempo. Tente novamente mais tarde.' using errcode = 'P0001';
  end if;
  insert into public.rate_limits (key) values ('rebuy:' || auth.uid());

  insert into public.quote_requests (customer_id, status, priority, assigned_to, payment_status, rebuy_of)
  values (q.customer_id, 'cotado', s.default_priority, q.assigned_to, 'isento', q.id)
  returning * into v_new;

  for v_entry in
    select distinct on (e ->> 'item_id') e ->> 'item_id' as item_id, e ->> 'quantity' as quantity
    from jsonb_array_elements(p_items) e
  loop
    select i.* into v_item from public.quote_items i
    where i.request_id = q.id and i.id::text = v_entry.item_id;
    select o.* into v_option from public.quote_options o
    where o.item_id = v_item.id and o.selected_by_customer;
    if v_item.id is null or v_option.id is null then
      raise exception 'Produto indisponível para recompra' using errcode = 'P0001';
    end if;

    insert into public.quote_items (
      request_id, name, description, reference_url, category_id, quantity, unit,
      target_price, notes, accepted_conditions, previous_price, position)
    values (
      v_new.id, v_item.name, v_item.description, v_item.reference_url, v_item.category_id,
      least(greatest(coalesce(nullif(v_entry.quantity, '')::int, v_item.quantity), 1), 1000000),
      v_item.unit, v_item.target_price, v_item.notes, v_item.accepted_conditions,
      v_option.sale_price, v_pos)
    returning id into v_item_id;

    insert into public.quote_item_photos (item_id, storage_path, position)
    select v_item_id, p.storage_path, p.position from public.quote_item_photos p where p.item_id = v_item.id;

    insert into public.quote_options (
      item_id, label, supplier_id, supplier_name, supplier_contact, cost_price, sale_price,
      lead_time_days, payment_terms, freight_included, freight_value, customer_notes,
      internal_notes, condition, origin, position)
    values (
      v_item_id, 'A', v_option.supplier_id, v_option.supplier_name, v_option.supplier_contact,
      v_option.cost_price, v_option.sale_price, v_option.lead_time_days, v_option.payment_terms,
      v_option.freight_included, v_option.freight_value, v_option.customer_notes,
      v_option.internal_notes, v_option.condition, v_option.origin, 0);
    v_pos := v_pos + 1;
  end loop;

  return jsonb_build_object('id', v_new.id, 'code', v_new.code, 'token', v_new.public_token);
end $$;
revoke execute on function public.create_rebuy(text, jsonb) from public, anon;
grant execute on function public.create_rebuy(text, jsonb) to authenticated, service_role;

-- ---------- equipe confirma a recompra ---------------------------------
-- Vale só com uma opção por produto e preço igual ou menor que o anterior;
-- se mudou, a equipe envia ao cliente como uma cotação normal.
create or replace function public.confirm_rebuy(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q public.quote_requests;
  v_item record;
  v_created int := 0;
begin
  if not public.can('send_quote') then
    raise exception 'Sem permissão para confirmar a recompra' using errcode = '42501';
  end if;
  select * into q from public.quote_requests where id = p_request_id for update;
  if q.id is null or q.rebuy_of is null then
    raise exception 'Este pedido não é uma recompra' using errcode = 'P0002';
  end if;
  if q.status <> 'cotado' then
    raise exception 'A recompra precisa estar em "Cotado" para ser confirmada' using errcode = 'P0001';
  end if;

  for v_item in
    select i.id, i.previous_price,
           (select count(*) from public.quote_options o where o.item_id = i.id) as n_options,
           (select o.id from public.quote_options o where o.item_id = i.id limit 1) as option_id,
           (select o.sale_price from public.quote_options o where o.item_id = i.id limit 1) as sale_price
    from public.quote_items i where i.request_id = q.id and not i.not_found
  loop
    if v_item.n_options <> 1 or v_item.previous_price is null or v_item.sale_price > v_item.previous_price then
      raise exception 'O preço ou as opções mudaram: envie a cotação ao cliente para aprovar' using errcode = 'P0001';
    end if;
    update public.quote_options set selected_by_customer = true where id = v_item.option_id;
    insert into public.purchase_tasks (request_id, item_id, option_id, assigned_to)
    values (q.id, v_item.id, v_item.option_id, null);
    v_created := v_created + 1;
  end loop;

  if v_created = 0 then
    raise exception 'Não há produtos para comprar' using errcode = 'P0001';
  end if;

  update public.quote_requests set status = 'enviado', sent_at = now() where id = q.id;
  update public.quote_requests set status = 'aprovado', responded_at = now() where id = q.id;
  return jsonb_build_object('status', 'aprovado', 'request_id', q.id, 'purchase_tasks', v_created);
end $$;
revoke execute on function public.confirm_rebuy(uuid) from public, anon;
grant execute on function public.confirm_rebuy(uuid) to authenticated, service_role;

-- ---------- portal: mostra o que pode ser recomprado -------------------
create or replace function public.my_quote_requests()
returns jsonb
language sql stable security definer set search_path = public as $$
  with me as (
    select lower(email) as email from auth.users
    where id = auth.uid() and email is not null and email_confirmed_at is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', q.code,
    'token', q.public_token,
    'status', q.status,
    'created_at', q.created_at,
    'sent_at', q.sent_at,
    'valid_until', q.valid_until,
    'quote_token', case when q.status in ('enviado', 'aprovado', 'recusado') then q.public_token end,
    'payment_pending', q.payment_status = 'pendente',
    'rebuy_of_code', (select o.code from public.quote_requests o where o.id = q.rebuy_of),
    -- o que pode ser comprado de novo: produtos aprovados, com a opção escolhida
    'rebuy_items', case when q.status = 'aprovado' then coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', i.id, 'name', i.name, 'quantity', i.quantity, 'unit', i.unit,
        'sale_price', o.sale_price, 'condition', o.condition, 'origin', o.origin
      ) order by i.position)
      from public.quote_items i
      join public.quote_options o on o.item_id = i.id and o.selected_by_customer
      where i.request_id = q.id), '[]') else '[]' end,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('name', i.name, 'quantity', i.quantity, 'unit', i.unit) order by i.position)
      from public.quote_items i where i.request_id = q.id), '[]')
  ) order by q.created_at desc), '[]')
  from public.quote_requests q
  join public.customers c on c.id = q.customer_id
  join me on lower(c.email) = me.email
$$;
