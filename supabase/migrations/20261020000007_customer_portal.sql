-- =====================================================================
-- Cotaí — portal do cliente (login por código no e-mail)
-- =====================================================================

-- Com o login do cliente, qualquer pessoa pode criar um usuário no Auth.
-- Por isso o perfil da equipe não nasce mais do user_metadata (que o
-- próprio usuário escolhe): só o primeiro usuário vira admin, e os
-- convidados recebem o perfil pela Edge Function invite-user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'kind', '') = 'customer' then
    return new;
  end if;
  if exists (select 1 from public.profiles where role = 'admin') then
    return new;
  end if;

  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    'admin'
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Usado pela invite-user quando o e-mail já tem usuário (ex.: um cliente).
create or replace function public.auth_user_id_by_email(p_email text)
returns uuid
language sql stable security definer set search_path = public as $$
  select id from auth.users where lower(email) = lower(btrim(p_email)) limit 1
$$;
revoke execute on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;

-- Pedidos do cliente logado, pelo e-mail confirmado. Só campos públicos.
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
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('name', i.name, 'quantity', i.quantity, 'unit', i.unit) order by i.position)
      from public.quote_items i where i.request_id = q.id), '[]')
  ) order by q.created_at desc), '[]')
  from public.quote_requests q
  join public.customers c on c.id = q.customer_id
  join me on lower(c.email) = me.email
$$;
revoke execute on function public.my_quote_requests() from public, anon;
grant execute on function public.my_quote_requests() to authenticated;
