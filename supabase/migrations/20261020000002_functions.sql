-- =====================================================================
-- Cotaí — funções de negócio, permissões e triggers
-- =====================================================================

-- ---------- Papel e permissões do usuário atual ------------------------
create or replace function public.auth_role()
returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.auth_role() is not null
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() = 'admin', false)
$$;

create or replace function public.can(p_permission text)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.auth_role() is null then false
    when public.auth_role() = 'admin' then true
    else coalesce((
      select allowed from public.role_permissions
      where role = public.auth_role() and permission = p_permission
    ), false)
  end
$$;

-- ---------- Novo usuário → perfil -------------------------------------
-- O primeiro usuário vira admin. Os demais recebem o papel do convite.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role;
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    v_role := 'admin';
  else
    v_role := coalesce(nullif(new.raw_user_meta_data ->> 'role', '')::public.app_role, 'cotador');
  end if;

  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    v_role
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Proteções de perfil ----------------------------------------
create or replace function public.guard_profiles()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Ninguém altera o próprio papel/status, a não ser um admin
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.is_admin()
     and (new.role is distinct from old.role or new.active is distinct from old.active) then
    raise exception 'Somente administradores podem alterar papéis e status de usuários'
      using errcode = '42501';
  end if;

  -- Nunca ficar sem um admin ativo
  if old.role = 'admin' and old.active
     and (tg_op = 'DELETE' or new.role <> 'admin' or not new.active)
     and (select count(*) from public.profiles where role = 'admin' and active) <= 1 then
    raise exception 'O sistema precisa de pelo menos um administrador ativo'
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger profiles_guard
  before update or delete on public.profiles
  for each row execute function public.guard_profiles();

-- ---------- Transições de status do pedido -----------------------------
-- Espelhada em src/lib/status.ts (mantenha as duas iguais).
create or replace function public.quote_transition_allowed(
  p_from public.quote_status, p_to public.quote_status)
returns boolean
language sql immutable as $$
  select p_from = p_to or (p_from, p_to) in (
    ('aguardando_pagamento', 'novo'), ('aguardando_pagamento', 'cancelado'),
    ('novo', 'em_cotacao'), ('novo', 'cancelado'),
    ('em_cotacao', 'novo'), ('em_cotacao', 'cotado'), ('em_cotacao', 'nao_encontrado'), ('em_cotacao', 'cancelado'),
    ('cotado', 'em_cotacao'), ('cotado', 'enviado'), ('cotado', 'nao_encontrado'), ('cotado', 'cancelado'),
    ('enviado', 'em_cotacao'), ('enviado', 'aprovado'), ('enviado', 'recusado'), ('enviado', 'cancelado'),
    ('aprovado', 'cancelado'),
    ('recusado', 'em_cotacao'),
    ('nao_encontrado', 'em_cotacao'),
    ('cancelado', 'novo')
  )
$$;

create or replace function public.quote_status_guard()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not public.quote_transition_allowed(old.status, new.status) then
      raise exception 'Transição de status não permitida: % → %', old.status, new.status
        using errcode = 'P0001';
    end if;
    -- pedidos aguardando pagamento só saem para "novo" depois de pagos
    if old.status = 'aguardando_pagamento' and new.status = 'novo'
       and new.payment_status not in ('pago', 'isento') then
      raise exception 'Confirme o pagamento antes de liberar o pedido'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger quote_requests_status_guard
  before update of status on public.quote_requests
  for each row execute function public.quote_status_guard();

create or replace function public.log_status_change()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_entity text := tg_argv[0];
begin
  if tg_op = 'INSERT' then
    insert into public.status_history (entity_type, entity_id, from_status, to_status, changed_by)
    values (v_entity, new.id, null, new.status::text, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.status_history (entity_type, entity_id, from_status, to_status, changed_by,
                                       note)
    values (v_entity, new.id, old.status::text, new.status::text, auth.uid(),
            nullif(current_setting('app.status_note', true), ''));
  end if;
  return new;
end $$;

create trigger quote_requests_status_log
  after insert or update of status on public.quote_requests
  for each row execute function public.log_status_change('quote');

create trigger purchase_tasks_status_log
  after insert or update of status on public.purchase_tasks
  for each row execute function public.log_status_change('purchase');

-- ---------- Distribuição automática (rodízio) ---------------------------
create or replace function public.auto_assign_request()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_mode text;
begin
  select assignment_mode into v_mode from public.settings;
  if v_mode = 'rodizio' and new.assigned_to is null then
    select p.id into new.assigned_to
    from public.profiles p
    where p.active and p.role in ('cotador', 'admin')
    order by p.role = 'admin',  -- cotadores primeiro
             (select count(*) from public.quote_requests q
               where q.assigned_to = p.id and q.status in ('novo', 'em_cotacao', 'cotado')),
             p.created_at
    limit 1;
  end if;
  return new;
end $$;

create trigger quote_requests_auto_assign
  before insert on public.quote_requests
  for each row execute function public.auto_assign_request();

-- ---------- Auditoria -------------------------------------------------
create or replace function public.audit_changes()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_section text := tg_argv[0];
  v_old jsonb;
  v_new jsonb;
  v_key text;
  v_id text;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    insert into public.audit_log (user_id, section, entity, entity_id, action, old_value)
    values (auth.uid(), v_section, tg_table_name, v_old ->> 'id', 'delete', v_old);
    return old;
  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    insert into public.audit_log (user_id, section, entity, entity_id, action, new_value)
    values (auth.uid(), v_section, tg_table_name, v_new ->> 'id', 'insert', v_new);
    return new;
  end if;

  v_old := to_jsonb(old) - 'updated_at';
  v_new := to_jsonb(new) - 'updated_at';
  v_id := coalesce(v_new ->> 'id', v_new ->> 'role');
  for v_key in select jsonb_object_keys(v_new) loop
    if v_new -> v_key is distinct from v_old -> v_key then
      insert into public.audit_log (user_id, section, entity, entity_id, action, field, old_value, new_value)
      values (auth.uid(), v_section, tg_table_name, v_id, 'update', v_key, v_old -> v_key, v_new -> v_key);
    end if;
  end loop;
  return new;
end $$;

create trigger settings_audit after update on public.settings
  for each row execute function public.audit_changes('configuracoes');
create trigger coupons_audit after insert or update or delete on public.coupons
  for each row execute function public.audit_changes('cobranca');
create trigger faq_items_audit after insert or update or delete on public.faq_items
  for each row execute function public.audit_changes('landing');
create trigger categories_audit after insert or update or delete on public.categories
  for each row execute function public.audit_changes('categorias');
create trigger units_audit after insert or update or delete on public.units
  for each row execute function public.audit_changes('categorias');
create trigger suppliers_audit after insert or update or delete on public.suppliers
  for each row execute function public.audit_changes('fornecedores');
create trigger role_permissions_audit after insert or update or delete on public.role_permissions
  for each row execute function public.audit_changes('equipe');
create trigger profiles_audit after update on public.profiles
  for each row when (old.role is distinct from new.role or old.active is distinct from new.active)
  execute function public.audit_changes('equipe');
create trigger customers_exempt_audit after update on public.customers
  for each row when (old.fee_exempt is distinct from new.fee_exempt)
  execute function public.audit_changes('cobranca');

-- ---------- Cálculo da taxa de cotação ---------------------------------
-- Fonte única da verdade. Espelhada em src/lib/fee.ts apenas para o
-- preview do painel; o valor cobrado sempre vem daqui.
create or replace function public.calculate_fee(
  p_item_count int,
  p_coupon text default null,
  p_customer_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.settings;
  v_base numeric(12, 2) := 0;
  v_discount numeric(12, 2) := 0;
  v_coupon public.coupons;
  v_coupon_error text;
  v_tier jsonb;
  v_exempt boolean := false;
begin
  select * into s from public.settings;
  p_item_count := greatest(coalesce(p_item_count, 1), 1);

  if p_customer_id is not null then
    select fee_exempt into v_exempt from public.customers where id = p_customer_id;
  end if;

  if s.charge_enabled and not coalesce(v_exempt, false) then
    if s.fee_model = 'fixo_pedido' then
      v_base := s.fee_fixed;
    elsif s.fee_model = 'por_produto' then
      v_base := s.fee_per_item * p_item_count;
      if s.fee_per_item_max is not null then
        v_base := least(v_base, s.fee_per_item_max);
      end if;
    else
      select t into v_tier
      from jsonb_array_elements(s.fee_tiers) t
      where (t ->> 'from')::int <= p_item_count
        and (t ->> 'to' is null or (t ->> 'to')::int >= p_item_count)
      order by (t ->> 'from')::int desc
      limit 1;
      v_base := coalesce((v_tier ->> 'amount')::numeric, 0);
    end if;
  end if;

  if nullif(trim(p_coupon), '') is not null then
    select * into v_coupon from public.coupons where upper(code) = upper(trim(p_coupon));
    if v_coupon.id is null or not v_coupon.active then
      v_coupon_error := 'Cupom inválido';
    elsif v_coupon.valid_until is not null and v_coupon.valid_until < current_date then
      v_coupon_error := 'Cupom expirado';
    elsif v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses then
      v_coupon_error := 'Cupom esgotado';
    elsif v_base > 0 then
      if v_coupon.discount_type = 'percent' then
        v_discount := round(v_base * least(v_coupon.value, 100) / 100, 2);
      else
        v_discount := least(v_coupon.value, v_base);
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'charge_enabled', s.charge_enabled,
    'exempt', coalesce(v_exempt, false),
    'base', v_base,
    'discount', v_discount,
    'total', v_base - v_discount,
    'coupon_id', case when v_coupon_error is null then v_coupon.id end,
    'coupon_error', v_coupon_error,
    'charge_moment', s.charge_moment
  );
end $$;

-- ---------- Criação de pedido (chamada pela Edge Function) --------------
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

    insert into public.quote_items (
      request_id, name, description, reference_url, category_id, quantity, unit,
      target_price, notes, position)
    values (
      v_request.id, trim(v_item ->> 'name'), nullif(v_item ->> 'description', ''),
      nullif(v_item ->> 'reference_url', ''), nullif(v_item ->> 'category_id', '')::uuid,
      greatest(coalesce((v_item ->> 'quantity')::int, 1), 1),
      coalesce(nullif(v_item ->> 'unit', ''), 'un'),
      greatest(coalesce((v_item ->> 'target_price')::numeric, 0), 0),
      nullif(v_item ->> 'notes', ''), v_pos)
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

create or replace function public.get_request_tracking(p_code text, p_token text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', q.code,
    'status', q.status,
    'created_at', q.created_at,
    'customer_name', c.name,
    'eta_text', s.eta_text,
    'quote_token', case when q.status in ('enviado', 'aprovado', 'recusado') then q.public_token end,
    'payment', case when q.payment_status = 'pendente' then jsonb_build_object(
        'amount', q.fee_amount - q.fee_discount,
        'due_at', q.payment_due_at,
        'pix_key', s.pix_key,
        'pix_key_type', s.pix_key_type,
        'pix_receiver_name', s.pix_receiver_name,
        'pix_instructions', s.pix_instructions,
        'charge', q.payment_payload,
        'moment', s.charge_moment
      ) end,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'name', i.name, 'quantity', i.quantity, 'unit', i.unit,
        'target_price', i.target_price,
        'photos', coalesce((select jsonb_agg(p.storage_path order by p.position)
                            from public.quote_item_photos p where p.item_id = i.id), '[]')
      ) order by i.position)
      from public.quote_items i where i.request_id = q.id), '[]'),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('status', h.to_status, 'at', h.created_at) order by h.created_at)
      from public.status_history h where h.entity_type = 'quote' and h.entity_id = q.id), '[]')
  )
  from public.quote_requests q
  join public.customers c on c.id = q.customer_id
  cross join public.settings s
  where q.code = upper(p_code) and q.public_token = p_token
$$;

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
        'photos', coalesce((select jsonb_agg(p.storage_path order by p.position)
                            from public.quote_item_photos p where p.item_id = i.id), '[]'),
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', o.id, 'label', o.label, 'sale_price', o.sale_price,
            'lead_time_days', o.lead_time_days, 'payment_terms', o.payment_terms,
            'freight_included', o.freight_included, 'freight_value', o.freight_value,
            'customer_notes', o.customer_notes, 'selected', o.selected_by_customer
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

-- Aprovar ou recusar a cotação pela página pública.
-- p_selections: { "<item_id>": "<option_id>", ... }
create or replace function public.respond_quote(
  p_token text, p_action text, p_selections jsonb default '{}', p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  q public.quote_requests;
  v_item record;
  v_option uuid;
  v_created int := 0;
  s public.settings;
begin
  select * into s from public.settings;
  select * into q from public.quote_requests where public_token = p_token for update;
  if q.id is null then
    raise exception 'Cotação não encontrada' using errcode = 'P0002';
  end if;
  if q.status <> 'enviado' then
    raise exception 'Esta cotação já foi respondida' using errcode = 'P0001';
  end if;
  if q.valid_until is not null and q.valid_until < current_date then
    raise exception 'Esta cotação expirou. Solicite uma atualização.' using errcode = 'P0001';
  end if;

  if p_action = 'recusar' then
    update public.quote_requests set
      status = 'recusado', responded_at = now(), decline_reason = nullif(trim(p_reason), '')
    where id = q.id;
    return jsonb_build_object('status', 'recusado', 'request_id', q.id);
  elsif p_action <> 'aprovar' then
    raise exception 'Ação inválida' using errcode = '22023';
  end if;

  for v_item in
    select i.id, (select count(*) from public.quote_options o where o.item_id = i.id) as n_options
    from public.quote_items i where i.request_id = q.id and not i.not_found
  loop
    if v_item.n_options = 0 then continue; end if;

    v_option := nullif(p_selections ->> v_item.id::text, '')::uuid;
    if v_option is null and v_item.n_options = 1 then
      select id into v_option from public.quote_options where item_id = v_item.id;
    end if;
    if v_option is null or not exists (
        select 1 from public.quote_options where id = v_option and item_id = v_item.id) then
      raise exception 'Escolha uma opção para cada produto' using errcode = 'P0001';
    end if;

    update public.quote_options set selected_by_customer = (id = v_option) where item_id = v_item.id;
    insert into public.purchase_tasks (request_id, item_id, option_id, assigned_to)
    values (q.id, v_item.id, v_option, null);
    v_created := v_created + 1;
  end loop;

  if v_created = 0 then
    raise exception 'Não há produtos disponíveis para aprovar' using errcode = 'P0001';
  end if;

  update public.quote_requests set
    status = 'aprovado', responded_at = now(),
    fee_deducted = s.deduct_fee_on_purchase and payment_status = 'pago'
  where id = q.id;

  return jsonb_build_object('status', 'aprovado', 'request_id', q.id, 'purchase_tasks', v_created);
end $$;

-- ---------- Painel ------------------------------------------------------
create or replace function public.dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.settings;
  v_tz text := 'America/Sao_Paulo';
  v_today date := (now() at time zone v_tz)::date;
  v_month date := date_trunc('month', now() at time zone v_tz)::date;
  v_result jsonb;
begin
  if not public.is_staff() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  select * into s from public.settings;

  select jsonb_build_object(
    'new_today', (select count(*) from public.quote_requests
                  where (created_at at time zone v_tz)::date = v_today),
    'in_progress', (select count(*) from public.quote_requests where status = 'em_cotacao'),
    'awaiting_payment', (select count(*) from public.quote_requests where status = 'aguardando_pagamento'),
    'awaiting_response', (select count(*) from public.quote_requests where status = 'enviado'),
    'approved_month', (select count(*) from public.quote_requests
                       where status = 'aprovado' and (responded_at at time zone v_tz)::date >= v_month),
    'approval_rate', (select case when count(*) = 0 then null
                        else round(100.0 * count(*) filter (where status = 'aprovado') / count(*), 1) end
                      from public.quote_requests where status in ('aprovado', 'recusado')),
    'fee_revenue_month', case when public.can('view_revenue') then
        (select coalesce(sum(fee_amount - fee_discount), 0) from public.quote_requests
         where payment_status = 'pago' and (paid_at at time zone v_tz)::date >= v_month) end,
    'per_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'count', (
                   select count(*) from public.quote_requests q
                   where (q.created_at at time zone v_tz)::date = d::date)) order by d), '[]')
                from generate_series(v_today - 29, v_today, interval '1 day') d),
    'late', (select coalesce(jsonb_agg(x order by x ->> 'created_at'), '[]') from (
               select jsonb_build_object('id', q.id, 'code', q.code, 'status', q.status,
                 'created_at', q.created_at, 'customer', c.name, 'company', c.company,
                 'assigned_to', q.assigned_to) as x
               from public.quote_requests q join public.customers c on c.id = q.customer_id
               where q.status in ('novo', 'em_cotacao')
                 and q.created_at < now() - make_interval(hours => s.sla_hours)
               limit 20) t),
    'mine', (select coalesce(jsonb_agg(x), '[]') from (
               select jsonb_build_object('id', q.id, 'code', q.code, 'status', q.status,
                 'created_at', q.created_at, 'customer', c.name, 'company', c.company) as x
               from public.quote_requests q join public.customers c on c.id = q.customer_id
               where q.assigned_to = auth.uid() and q.status in ('novo', 'em_cotacao', 'cotado')
               order by q.created_at limit 20) t),
    'sla_hours', s.sla_hours
  ) into v_result;
  return v_result;
end $$;

-- Opções de cotação para quem pode ou não ver custos
create or replace function public.quote_options_for_staff(p_request_id uuid)
returns setof jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(o)
         - case when public.can('view_costs') then '' else 'cost_price' end
         - case when public.can('view_costs') then '' else 'supplier_contact' end
  from public.quote_options o
  join public.quote_items i on i.id = o.item_id
  where i.request_id = p_request_id and public.is_staff()
  order by i.position, o.position, o.label
$$;

-- Estatísticas por cliente
create or replace view public.customer_overview
with (security_invoker = true) as
select
  c.*,
  (select count(*) from public.quote_requests q where q.customer_id = c.id) as request_count,
  (select count(*) from public.quote_requests q where q.customer_id = c.id and q.status = 'aprovado') as approved_count,
  (select coalesce(sum(o.sale_price * i.quantity), 0)
     from public.quote_requests q
     join public.quote_items i on i.request_id = q.id
     join public.quote_options o on o.item_id = i.id and o.selected_by_customer
    where q.customer_id = c.id and q.status = 'aprovado') as approved_total,
  (select max(q.created_at) from public.quote_requests q where q.customer_id = c.id) as last_request_at
from public.customers c;

-- Fornecedores já usados (autocomplete)
create or replace function public.touch_supplier()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if nullif(trim(new.supplier_name), '') is not null and new.supplier_id is null then
    insert into public.suppliers (name) values (trim(new.supplier_name))
    on conflict ((lower(name))) do nothing;
    select id into new.supplier_id from public.suppliers where lower(name) = lower(trim(new.supplier_name));
  end if;
  return new;
end $$;

create trigger quote_options_touch_supplier
  before insert or update of supplier_name on public.quote_options
  for each row execute function public.touch_supplier();
