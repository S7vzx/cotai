-- =====================================================================
-- Cotaí — quadro de compras (respeita a permissão de ver custos)
-- =====================================================================

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

revoke execute on function public.purchase_board() from public, anon;
grant execute on function public.purchase_board() to authenticated, service_role;
