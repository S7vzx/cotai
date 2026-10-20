-- =====================================================================
-- Cotaí — schema principal
-- Tabelas, enums, sequências e triggers utilitários.
-- =====================================================================

-- ---------- Enums ----------------------------------------------------
create type public.app_role as enum ('admin', 'cotador', 'comprador');

create type public.quote_status as enum (
  'aguardando_pagamento', 'novo', 'em_cotacao', 'cotado', 'enviado',
  'aprovado', 'recusado', 'nao_encontrado', 'cancelado'
);

create type public.purchase_status as enum (
  'a_comprar', 'comprado', 'em_transito', 'entregue', 'cancelado'
);

create type public.priority_level as enum ('baixa', 'normal', 'alta', 'urgente');

create type public.payment_status as enum ('pendente', 'pago', 'isento', 'estornado');

create type public.fee_model as enum ('fixo_pedido', 'por_produto', 'faixas');

-- ---------- Utilitários ----------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.random_token()
returns text language sql volatile as $$
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
$$;

-- ---------- Perfis da equipe -----------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  avatar_url text,
  role public.app_role not null default 'cotador',
  active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Clientes -------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text not null default '',
  cnpj text,
  whatsapp text,          -- E.164: +5579999999999
  email text,
  notes text,
  fee_exempt boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index customers_email_key on public.customers (lower(email)) where email is not null;
create unique index customers_whatsapp_key on public.customers (whatsapp) where whatsapp is not null;

-- ---------- Catálogos -------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  whatsapp text,
  email text,
  website text,
  category_ids uuid[] not null default '{}',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index suppliers_name_key on public.suppliers (lower(name));

create table public.faq_items (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  value numeric(12, 2) not null check (value >= 0),
  valid_until date,
  max_uses int check (max_uses is null or max_uses > 0),
  used_count int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index coupons_code_key on public.coupons (upper(code));

-- ---------- Pedidos de cotação ----------------------------------------
create sequence public.quote_code_seq start 1;

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    default 'COT-' || lpad(nextval('public.quote_code_seq')::text, 6, '0'),
  public_token text not null unique default public.random_token(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  status public.quote_status not null default 'novo',
  priority public.priority_level not null default 'normal',
  assigned_to uuid references public.profiles (id) on delete set null,
  -- cobrança
  fee_amount numeric(12, 2) not null default 0,
  fee_discount numeric(12, 2) not null default 0,
  coupon_id uuid references public.coupons (id) on delete set null,
  payment_status public.payment_status not null default 'isento',
  payment_method text,
  payment_id text,
  payment_payload jsonb,
  paid_at timestamptz,
  paid_confirmed_by uuid references public.profiles (id) on delete set null,
  payment_due_at timestamptz,
  -- cotação
  customer_message text,
  valid_until date,
  sent_at timestamptz,
  responded_at timestamptz,
  decline_reason text,
  fee_deducted boolean not null default false,
  payment_reminder_sent_at timestamptz,
  response_reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quote_requests_status_idx on public.quote_requests (status);
create index quote_requests_customer_idx on public.quote_requests (customer_id);
create index quote_requests_assigned_idx on public.quote_requests (assigned_to);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.quote_requests (id) on delete cascade,
  name text not null,
  description text,
  reference_url text,
  category_id uuid references public.categories (id) on delete set null,
  quantity int not null check (quantity >= 1),
  unit text not null default 'un',
  target_price numeric(12, 2) not null check (target_price >= 0),
  notes text,
  not_found boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quote_items_request_idx on public.quote_items (request_id);

create table public.quote_item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.quote_items (id) on delete cascade,
  storage_path text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index quote_item_photos_item_idx on public.quote_item_photos (item_id);

create table public.quote_options (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.quote_items (id) on delete cascade,
  label text not null default 'A',
  supplier_id uuid references public.suppliers (id) on delete set null,
  supplier_name text not null default '',
  supplier_contact text,              -- INTERNO
  cost_price numeric(12, 2),          -- INTERNO
  sale_price numeric(12, 2) not null default 0 check (sale_price >= 0),
  lead_time_days int,
  payment_terms text,
  freight_included boolean not null default true,
  freight_value numeric(12, 2) not null default 0,
  customer_notes text,
  internal_notes text,                -- INTERNO
  selected_by_customer boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quote_options_item_idx on public.quote_options (item_id);

-- ---------- Compras ---------------------------------------------------
create table public.purchase_tasks (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.quote_requests (id) on delete cascade,
  item_id uuid not null references public.quote_items (id) on delete cascade,
  option_id uuid references public.quote_options (id) on delete set null,
  status public.purchase_status not null default 'a_comprar',
  assigned_to uuid references public.profiles (id) on delete set null,
  purchased_at date,
  supplier_order_number text,
  tracking_code text,
  expected_delivery date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index purchase_tasks_status_idx on public.purchase_tasks (status);

create table public.purchase_attachments (
  id uuid primary key default gen_random_uuid(),
  purchase_task_id uuid not null references public.purchase_tasks (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

-- ---------- Colaboração e histórico -----------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.quote_requests (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(body) between 1 and 5000),
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index comments_request_idx on public.comments (request_id);

create table public.status_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('quote', 'purchase')),
  entity_id uuid not null,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index status_history_entity_idx on public.status_history (entity_type, entity_id);

create table public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.quote_requests (id) on delete cascade,
  event text not null,
  channel text not null check (channel in ('email', 'whatsapp')),
  recipient text not null,
  status text not null check (status in ('enviado', 'falhou', 'nao_configurado')),
  error text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index notifications_log_request_idx on public.notifications_log (request_id);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  section text not null,
  entity text not null,
  entity_id text,
  action text not null check (action in ('insert', 'update', 'delete')),
  field text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- Limite de pedidos públicos por IP/telefone (anti-spam)
create table public.rate_limits (
  key text not null,
  created_at timestamptz not null default now()
);
create index rate_limits_key_idx on public.rate_limits (key, created_at);

-- ---------- Permissões -------------------------------------------------
create table public.role_permissions (
  role public.app_role not null,
  permission text not null,
  allowed boolean not null default false,
  primary key (role, permission)
);

-- ---------- Configurações (linha única) --------------------------------
create table public.settings (
  id boolean primary key default true check (id),
  -- empresa
  company_name text not null default '',
  display_name text not null default 'Cotaí',
  cnpj text,
  address text,
  logo_light_path text,
  logo_dark_path text,
  favicon_path text,
  contact_whatsapp text,
  contact_email text,
  business_hours text,
  social_links jsonb not null default '{}',
  team_notification_emails text[] not null default '{}',
  onboarding_completed boolean not null default false,
  -- cobrança
  charge_enabled boolean not null default false,
  fee_model public.fee_model not null default 'fixo_pedido',
  fee_fixed numeric(12, 2) not null default 0 check (fee_fixed >= 0),
  fee_per_item numeric(12, 2) not null default 0 check (fee_per_item >= 0),
  fee_per_item_max numeric(12, 2) check (fee_per_item_max is null or fee_per_item_max >= 0),
  fee_tiers jsonb not null default '[]',      -- [{ "from": 1, "to": 3, "amount": 0 }]
  charge_moment text not null default 'antes' check (charge_moment in ('antes', 'depois')),
  deduct_fee_on_purchase boolean not null default false,
  show_fee_on_landing boolean not null default false,
  payment_methods text[] not null default '{pix_manual}',
  pix_key text,
  pix_key_type text,
  pix_receiver_name text,
  pix_instructions text,
  payment_deadline_hours int not null default 48 check (payment_deadline_hours > 0),
  -- regras de cotação
  sla_hours int not null default 24 check (sla_hours > 0),
  eta_text text not null default 'em até 48 horas úteis',
  default_validity_days int not null default 7 check (default_validity_days > 0),
  max_items_per_request int not null default 10 check (max_items_per_request > 0),
  max_photos_per_item int not null default 5 check (max_photos_per_item > 0),
  max_photo_mb int not null default 10 check (max_photo_mb > 0),
  form_fields_config jsonb not null default '{}',
  max_options_per_item int not null default 3 check (max_options_per_item between 1 and 10),
  min_margin_alert numeric(5, 2) not null default 10,
  assignment_mode text not null default 'manual' check (assignment_mode in ('manual', 'rodizio')),
  default_priority public.priority_level not null default 'normal',
  terms_text text not null default '',
  -- landing
  landing_content jsonb not null default '{}',
  seo_title text,
  seo_description text,
  og_image_path text,
  -- mensagens
  email_templates jsonb not null default '{}',
  whatsapp_templates jsonb not null default '{}',
  notification_toggles jsonb not null default '{}',
  reminders_config jsonb not null default '{}',
  -- integrações (somente escolhas, nunca segredos)
  email_from_name text,
  email_from_address text,
  whatsapp_provider text not null default 'none' check (whatsapp_provider in ('none', 'zapi', 'evolution', 'meta')),
  payment_provider text not null default 'none' check (payment_provider in ('none', 'asaas', 'mercadopago')),
  payment_env text not null default 'sandbox' check (payment_env in ('sandbox', 'producao')),
  updated_at timestamptz not null default now()
);

-- ---------- Triggers de updated_at ------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'customers', 'categories', 'units', 'suppliers', 'faq_items', 'coupons',
    'quote_requests', 'quote_items', 'quote_options', 'purchase_tasks', 'settings'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t);
  end loop;
end $$;
