-- =====================================================================
-- Cotaí — Row Level Security, grants, storage e realtime
-- =====================================================================

-- ---------- RLS em todas as tabelas ------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'customers', 'categories', 'units', 'suppliers', 'faq_items', 'coupons',
    'quote_requests', 'quote_items', 'quote_item_photos', 'quote_options', 'purchase_tasks',
    'purchase_attachments', 'comments', 'status_history', 'notifications_log', 'audit_log',
    'rate_limits', 'role_permissions', 'settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ---------- Perfis -----------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (public.is_staff() or id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Clientes ---------------------------------------------------
create policy customers_select on public.customers for select to authenticated
  using (public.is_staff());
create policy customers_write on public.customers for update to authenticated
  using (public.can('manage_customers')) with check (public.can('manage_customers'));
create policy customers_insert on public.customers for insert to authenticated
  with check (public.can('manage_customers'));

-- ---------- Catálogos (leitura pela equipe, escrita pelo admin) --------
create policy categories_select on public.categories for select to authenticated using (public.is_staff());
create policy categories_admin on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy units_select on public.units for select to authenticated using (public.is_staff());
create policy units_admin on public.units for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy faq_select on public.faq_items for select to authenticated using (public.is_staff());
create policy faq_admin on public.faq_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy coupons_admin on public.coupons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy role_permissions_select on public.role_permissions for select to authenticated
  using (public.is_staff());
create policy role_permissions_admin on public.role_permissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy suppliers_select on public.suppliers for select to authenticated using (public.is_staff());
create policy suppliers_insert on public.suppliers for insert to authenticated
  with check (public.auth_role() in ('admin', 'cotador'));
create policy suppliers_admin on public.suppliers for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy suppliers_delete on public.suppliers for delete to authenticated using (public.is_admin());

-- ---------- Configurações ------------------------------------------------
create policy settings_select on public.settings for select to authenticated using (public.is_staff());
create policy settings_update on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Pedidos ----------------------------------------------------
create policy quote_requests_select on public.quote_requests for select to authenticated
  using (public.is_staff());
create policy quote_requests_update on public.quote_requests for update to authenticated
  using (public.auth_role() in ('admin', 'cotador'))
  with check (public.auth_role() in ('admin', 'cotador'));
create policy quote_requests_delete on public.quote_requests for delete to authenticated
  using (public.can('delete_request'));

create policy quote_items_select on public.quote_items for select to authenticated
  using (public.is_staff());
create policy quote_items_update on public.quote_items for update to authenticated
  using (public.auth_role() in ('admin', 'cotador'))
  with check (public.auth_role() in ('admin', 'cotador'));

create policy quote_item_photos_select on public.quote_item_photos for select to authenticated
  using (public.is_staff());

-- Opções: compradores não leem a tabela direto (custo); usam quote_options_for_staff()
create policy quote_options_select on public.quote_options for select to authenticated
  using (public.auth_role() in ('admin', 'cotador'));
create policy quote_options_write on public.quote_options for all to authenticated
  using (public.auth_role() in ('admin', 'cotador'))
  with check (public.auth_role() in ('admin', 'cotador'));

-- ---------- Compras ----------------------------------------------------
create policy purchase_tasks_select on public.purchase_tasks for select to authenticated
  using (public.is_staff());
create policy purchase_tasks_update on public.purchase_tasks for update to authenticated
  using (public.can('manage_purchases')) with check (public.can('manage_purchases'));
create policy purchase_attachments_select on public.purchase_attachments for select to authenticated
  using (public.is_staff());
create policy purchase_attachments_write on public.purchase_attachments for all to authenticated
  using (public.can('manage_purchases')) with check (public.can('manage_purchases'));

-- ---------- Colaboração e logs ------------------------------------------
create policy comments_select on public.comments for select to authenticated using (public.is_staff());
create policy comments_insert on public.comments for insert to authenticated
  with check (public.is_staff() and author_id = auth.uid());
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

create policy status_history_select on public.status_history for select to authenticated
  using (public.is_staff());
create policy notifications_log_select on public.notifications_log for select to authenticated
  using (public.is_staff());
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.is_admin());
-- rate_limits: sem policies (só service_role)

-- ---------- Funções: quem pode executar ---------------------------------
-- Por padrão o Postgres libera EXECUTE para todos; fechamos e abrimos só o necessário.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.auth_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can(text) to authenticated;
grant execute on function public.quote_transition_allowed(public.quote_status, public.quote_status) to authenticated;
grant execute on function public.calculate_fee(int, text, uuid) to authenticated;
grant execute on function public.mark_request_paid(uuid, text, text) to authenticated;
grant execute on function public.dashboard_stats() to authenticated;
grant execute on function public.quote_options_for_staff(uuid) to authenticated;
grant execute on function public.get_public_settings() to anon, authenticated;

-- Funções de trigger precisam ser executáveis por quem dispara o trigger
grant execute on function public.set_updated_at() to authenticated;
grant execute on function public.random_token() to authenticated;

-- create_quote_request, get_request_tracking, get_public_quote, respond_quote e
-- expire_unpaid_requests ficam restritas ao service_role (Edge Functions).
grant execute on all functions in schema public to service_role;

grant select on public.customer_overview to authenticated;

-- ---------- Storage ------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', false),
       ('purchase-attachments', 'purchase-attachments', false),
       ('branding', 'branding', true)
on conflict (id) do nothing;

create policy "equipe lê fotos" on storage.objects for select to authenticated
  using (bucket_id = 'product-photos' and public.is_staff());

create policy "equipe lê anexos" on storage.objects for select to authenticated
  using (bucket_id = 'purchase-attachments' and public.is_staff());
create policy "compras enviam anexos" on storage.objects for insert to authenticated
  with check (bucket_id = 'purchase-attachments' and public.can('manage_purchases'));
create policy "compras removem anexos" on storage.objects for delete to authenticated
  using (bucket_id = 'purchase-attachments' and public.can('manage_purchases'));

create policy "marca é pública" on storage.objects for select to anon, authenticated
  using (bucket_id = 'branding');
create policy "admin envia marca" on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.is_admin());
create policy "admin atualiza marca" on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.is_admin());
create policy "admin remove marca" on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.is_admin());

-- ---------- Realtime -----------------------------------------------------
alter publication supabase_realtime add table public.quote_requests;
alter publication supabase_realtime add table public.purchase_tasks;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.settings;
