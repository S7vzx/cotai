-- =====================================================================
-- Cotaí — estado do produto e origem da opção
-- O cliente marca os estados que aceita em cada produto (Novo, 99% novo,
-- Seminovo, Usado); a equipe informa o estado e a origem (Brasil,
-- fabricante na China, agente de compra) de cada opção cotada.
-- =====================================================================

create or replace function public.product_conditions()
returns text[]
language sql immutable as $$
  select array['novo', 'quase_novo', 'seminovo', 'usado']
$$;
grant execute on function public.product_conditions() to anon, authenticated, service_role;

alter table public.quote_items
  add column accepted_conditions text[] not null default array['novo'],
  add constraint quote_items_accepted_conditions_check
    check (cardinality(accepted_conditions) > 0 and accepted_conditions <@ array['novo', 'quase_novo', 'seminovo', 'usado']);

alter table public.quote_options
  add column condition text check (condition in ('novo', 'quase_novo', 'seminovo', 'usado')),
  add column origin text check (origin in ('brasil', 'china_fabricante', 'agente_compra'));

-- ---------- pedido público grava os estados aceitos -------------------
create or replace function public.create_quote_request(p_payload jsonb, p_rate_key text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.settings;
  c jsonb := p_payload -> 'customer';
  v_items jsonb := coalesce(p_payload -> 'items', '[]');
  v_item jsonb;
  v_photo text;
  v_customer_id uuid;
  v_fee jsonb;
  v_total numeric;
  v_status public.quote_status;
  v_payment public.payment_status;
  v_request public.quote_requests;
  v_item_id uuid;
  v_pos int := 0;
  v_ppos int;
  v_conditions text[];
  v_email text := lower(nullif(trim(c ->> 'email'), ''));
  v_whats text := nullif(trim(c ->> 'whatsapp'), '');
begin
  select * into s from public.settings;

  -- anti-spam: no máximo 5 pedidos por chave por hora
  if p_rate_key is not null then
    delete from public.rate_limits where created_at < now() - interval '1 day';
    if (select count(*) from public.rate_limits
        where key = p_rate_key and created_at > now() - interval '1 hour') >= 5 then
      raise exception 'Muitos pedidos em pouco tempo. Tente novamente mais tarde.'
        using errcode = 'P0001';
    end if;
    insert into public.rate_limits (key) values (p_rate_key);
  end if;

  if nullif(trim(c ->> 'name'), '') is null or v_email is null or v_whats is null then
    raise exception 'Nome, e-mail e WhatsApp são obrigatórios' using errcode = 'P0001';
  end if;
  if jsonb_array_length(v_items) = 0 then
    raise exception 'Adicione pelo menos um produto' using errcode = 'P0001';
  end if;
  if jsonb_array_length(v_items) > s.max_items_per_request then
    raise exception 'Máximo de % produtos por pedido', s.max_items_per_request using errcode = 'P0001';
  end if;
  if not coalesce((p_payload ->> 'accepted_terms')::boolean, false) then
    raise exception 'É preciso aceitar os termos' using errcode = 'P0001';
  end if;

  -- cliente: reaproveita por e-mail ou WhatsApp
  select id into v_customer_id from public.customers
  where lower(email) = v_email or whatsapp = v_whats
  order by (lower(email) = v_email) desc
  limit 1;

  if v_customer_id is null then
    insert into public.customers (name, company, cnpj, whatsapp, email)
    values (trim(c ->> 'name'), coalesce(trim(c ->> 'company'), ''), nullif(trim(c ->> 'cnpj'), ''),
            v_whats, v_email)
    returning id into v_customer_id;
  else
    update public.customers set
      name = trim(c ->> 'name'),
      company = coalesce(nullif(trim(c ->> 'company'), ''), company),
      cnpj = coalesce(nullif(trim(c ->> 'cnpj'), ''), cnpj)
    where id = v_customer_id;
  end if;

  v_fee := public.calculate_fee(jsonb_array_length(v_items), p_payload ->> 'coupon', v_customer_id);
  if v_fee ->> 'coupon_error' is not null then
    raise exception '%', v_fee ->> 'coupon_error' using errcode = 'P0001';
  end if;
  v_total := (v_fee ->> 'total')::numeric;

  if v_total > 0 then
    v_payment := 'pendente';
    v_status := case when s.charge_moment = 'antes' then 'aguardando_pagamento' else 'novo' end;
  else
    v_payment := 'isento';
    v_status := 'novo';
  end if;

  insert into public.quote_requests (
    customer_id, status, priority, fee_amount, fee_discount, coupon_id,
    payment_status, payment_due_at)
  values (
    v_customer_id, v_status, s.default_priority, (v_fee ->> 'base')::numeric,
    (v_fee ->> 'discount')::numeric, (v_fee ->> 'coupon_id')::uuid, v_payment,
    case when v_total > 0 then now() + make_interval(hours => s.payment_deadline_hours) end)
  returning * into v_request;

  if (v_fee ->> 'coupon_id') is not null then
    update public.coupons set used_count = used_count + 1 where id = (v_fee ->> 'coupon_id')::uuid;
  end if;

  for v_item in select * from jsonb_array_elements(v_items) loop
    if nullif(trim(v_item ->> 'name'), '') is null then
      raise exception 'Cada produto precisa de um nome' using errcode = 'P0001';
    end if;
    if jsonb_array_length(coalesce(v_item -> 'photos', '[]')) > s.max_photos_per_item then
      raise exception 'Máximo de % fotos por produto', s.max_photos_per_item using errcode = 'P0001';
    end if;

    v_conditions := array(select jsonb_array_elements_text(coalesce(v_item -> 'accepted_conditions', '[]')));
    if cardinality(v_conditions) = 0 or not v_conditions <@ public.product_conditions() then
      raise exception 'Escolha o estado aceito de cada produto' using errcode = 'P0001';
    end if;

    insert into public.quote_items (
      request_id, name, description, reference_url, category_id, quantity, unit,
      target_price, notes, accepted_conditions, position)
    values (
      v_request.id, trim(v_item ->> 'name'), nullif(v_item ->> 'description', ''),
      nullif(v_item ->> 'reference_url', ''), nullif(v_item ->> 'category_id', '')::uuid,
      greatest(coalesce((v_item ->> 'quantity')::int, 1), 1),
      coalesce(nullif(v_item ->> 'unit', ''), 'un'),
      greatest(coalesce((v_item ->> 'target_price')::numeric, 0), 0),
      nullif(v_item ->> 'notes', ''), v_conditions, v_pos)
    returning id into v_item_id;

    v_ppos := 0;
    for v_photo in select jsonb_array_elements_text(coalesce(v_item -> 'photos', '[]')) loop
      insert into public.quote_item_photos (item_id, storage_path, position)
      values (v_item_id, v_photo, v_ppos);
      v_ppos := v_ppos + 1;
    end loop;
    v_pos := v_pos + 1;
  end loop;

  return jsonb_build_object(
    'id', v_request.id,
    'code', v_request.code,
    'public_token', v_request.public_token,
    'status', v_request.status,
    'fee', v_fee
  );
end $$;

-- ---------- Confirmação de pagamento ------------------------------------
create or replace function public.mark_request_paid(
  p_request_id uuid, p_method text default 'pix_manual', p_payment_id text default null)
returns public.quote_requests
language plpgsql security definer set search_path = public as $$
declare
  v public.quote_requests;
begin
  -- staff precisa da permissão; service_role (auth.uid() nulo) é o webhook
  if auth.uid() is not null and not public.can('confirm_payment') then
    raise exception 'Sem permissão para confirmar pagamentos' using errcode = '42501';
  end if;

  update public.quote_requests set
    payment_status = 'pago',
    payment_method = coalesce(p_method, payment_method),
    payment_id = coalesce(p_payment_id, payment_id),
    paid_at = now(),
    paid_confirmed_by = auth.uid()
  where id = p_request_id and payment_status = 'pendente'
  returning * into v;

  if v.id is null then
    select * into v from public.quote_requests where id = p_request_id;
    return v;
  end if;

  if v.status = 'aguardando_pagamento' then
    update public.quote_requests set status = 'novo' where id = v.id returning * into v;
  end if;
  return v;
end $$;

-- ---------- Expiração de pedidos não pagos ------------------------------
create or replace function public.expire_unpaid_requests()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  perform set_config('app.status_note', 'Prazo de pagamento expirado', true);
  update public.quote_requests set status = 'cancelado'
  where status = 'aguardando_pagamento' and payment_status = 'pendente'
    and payment_due_at is not null and payment_due_at < now();
  get diagnostics v_count = row_count;
  perform set_config('app.status_note', '', true);
  return v_count;
end $$;

-- ---------- Dados públicos ---------------------------------------------
create or replace function public.get_public_settings()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'display_name', s.display_name,
    'company_name', s.company_name,
    'logo_light_path', s.logo_light_path,
    'logo_dark_path', s.logo_dark_path,
    'contact_whatsapp', s.contact_whatsapp,
    'contact_email', s.contact_email,
    'business_hours', s.business_hours,
    'social_links', s.social_links,
    'eta_text', s.eta_text,
    'terms_text', s.terms_text,
    'landing', s.landing_content,
    'seo_title', s.seo_title,
    'seo_description', s.seo_description,
    'og_image_path', s.og_image_path,
    'form', jsonb_build_object(
      'fields', s.form_fields_config,
      'max_items', s.max_items_per_request,
      'max_photos', s.max_photos_per_item,
      'max_photo_mb', s.max_photo_mb
    ),
    'charge', jsonb_build_object(
      'enabled', s.charge_enabled,
      'model', s.fee_model,
      'fixed', s.fee_fixed,
      'per_item', s.fee_per_item,
      'per_item_max', s.fee_per_item_max,
      'tiers', s.fee_tiers,
      'moment', s.charge_moment,
      'show_on_landing', s.show_fee_on_landing,
      'deduct_on_purchase', s.deduct_fee_on_purchase,
      'methods', s.payment_methods,
      'has_coupons', exists (select 1 from public.coupons where active)
    ),
    'faq', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'question', question, 'answer', answer) order by position)
                     from public.faq_items where active), '[]'),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by position, name)
                            from public.categories where active), '[]'),
    'units', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'label', label) order by position)
                       from public.units where active), '[]')
  )
  from public.settings s
$$;

-- ---------- proposta pública mostra estado e origem -------------------
create or replace function public.get_public_quote(p_token text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', q.id,
    'code', q.code,
    'status', q.status,
    'created_at', q.created_at,
    'sent_at', q.sent_at,
    'valid_until', q.valid_until,
    'expired', q.status = 'enviado' and q.valid_until is not null and q.valid_until < current_date,
    'customer_message', q.customer_message,
    'decline_reason', q.decline_reason,
    'customer', jsonb_build_object('name', c.name, 'company', c.company),
    'fee', jsonb_build_object(
      'paid', q.payment_status = 'pago',
      'amount', q.fee_amount - q.fee_discount,
      'deduct', s.deduct_fee_on_purchase and q.payment_status = 'pago'
    ),
    'company', jsonb_build_object(
      'display_name', s.display_name, 'logo_light_path', s.logo_light_path,
      'contact_whatsapp', s.contact_whatsapp, 'contact_email', s.contact_email
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'name', i.name, 'description', i.description, 'quantity', i.quantity,
        'unit', i.unit, 'target_price', i.target_price, 'not_found', i.not_found,
        'accepted_conditions', i.accepted_conditions,
        'photos', coalesce((select jsonb_agg(p.storage_path order by p.position)
                            from public.quote_item_photos p where p.item_id = i.id), '[]'),
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', o.id, 'label', o.label, 'sale_price', o.sale_price,
            'lead_time_days', o.lead_time_days, 'payment_terms', o.payment_terms,
            'freight_included', o.freight_included, 'freight_value', o.freight_value,
            'customer_notes', o.customer_notes, 'selected', o.selected_by_customer,
            'condition', o.condition, 'origin', o.origin
          ) order by o.position, o.label)
          from public.quote_options o where o.item_id = i.id), '[]')
      ) order by i.position)
      from public.quote_items i where i.request_id = q.id), '[]')
  )
  from public.quote_requests q
  join public.customers c on c.id = q.customer_id
  cross join public.settings s
  where q.public_token = p_token
    and q.status in ('enviado', 'aprovado', 'recusado')
$$;

-- ---------- quadro de compras mostra estado e origem ------------------
create or replace function public.purchase_board()
returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', t.id,
    'status', t.status,
    'request_id', t.request_id,
    'item_id', t.item_id,
    'assigned_to', t.assigned_to,
    'purchased_at', t.purchased_at,
    'supplier_order_number', t.supplier_order_number,
    'tracking_code', t.tracking_code,
    'expected_delivery', t.expected_delivery,
    'notes', t.notes,
    'created_at', t.created_at,
    'updated_at', t.updated_at,
    'code', q.code,
    'customer_name', c.name,
    'customer_company', c.company,
    'customer_whatsapp', c.whatsapp,
    'item_name', i.name,
    'quantity', i.quantity,
    'unit', i.unit,
    'photo', (select p.storage_path from public.quote_item_photos p where p.item_id = i.id order by p.position limit 1),
    'option', case when o.id is null then null else jsonb_build_object(
      'label', o.label,
      'supplier_name', o.supplier_name,
      'sale_price', o.sale_price,
      'lead_time_days', o.lead_time_days,
      'payment_terms', o.payment_terms,
      'freight_included', o.freight_included,
      'freight_value', o.freight_value,
      'condition', o.condition,
      'origin', o.origin,
      'cost_price', case when public.can('view_costs') then o.cost_price end,
      'supplier_contact', case when public.can('view_costs') then o.supplier_contact end,
      'internal_notes', case when public.can('view_costs') then o.internal_notes end
    ) end,
    'attachments', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'storage_path', a.storage_path, 'file_name', a.file_name, 'created_at', a.created_at) order by a.created_at)
                             from public.purchase_attachments a where a.purchase_task_id = t.id), '[]')
  )
  from public.purchase_tasks t
  join public.quote_requests q on q.id = t.request_id
  join public.customers c on c.id = q.customer_id
  join public.quote_items i on i.id = t.item_id
  left join public.quote_options o on o.id = t.option_id
  where public.is_staff()
  order by t.created_at desc
$$;
