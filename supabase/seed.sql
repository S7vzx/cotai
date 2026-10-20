-- =====================================================================
-- Cotaí — dados de DESENVOLVIMENTO LOCAL (roda só em `supabase db reset`).
-- Nunca rode em produção. Em produção, crie o primeiro usuário no painel
-- do Supabase (Authentication → Add user): ele vira administrador.
--
-- Login local: admin@cotai.local / cotai12345
-- =====================================================================

do $$
declare
  v_id uuid := '00000000-0000-4000-8000-00000000a001';
begin
  if exists (select 1 from auth.users where id = v_id) then return; end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    'admin@cotai.local', extensions.crypt('cotai12345', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Admin Local"}', now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', 'admin@cotai.local', 'email_verified', true),
          'email', now(), now(), now());
end $$;

insert into public.categories (name, position) values
  ('Escritório', 0), ('Limpeza e higiene', 1), ('Cozinha industrial', 2), ('Informática', 3)
on conflict do nothing;
