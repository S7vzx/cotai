// Tipos de domínio do Cotaí.
// Espelham o schema em supabase/migrations. Quando o Supabase local estiver
// rodando, `npm run db:types` gera src/types/database.ts com os tipos exatos.

import type { OptionOrigin, ProductCondition } from '../../supabase/functions/_shared/validation'

export type { OptionOrigin, ProductCondition }

export type AppRole = 'admin' | 'cotador' | 'comprador'

export type QuoteStatus =
  'aguardando_pagamento' | 'novo' | 'em_cotacao' | 'cotado' | 'enviado' | 'aprovado' | 'recusado' | 'nao_encontrado' | 'cancelado'

export type PurchaseStatus = 'a_comprar' | 'comprado' | 'em_transito' | 'entregue' | 'cancelado'
export type Priority = 'baixa' | 'normal' | 'alta' | 'urgente'
export type PaymentStatus = 'pendente' | 'pago' | 'isento' | 'estornado'
export type FeeModel = 'fixo_pedido' | 'por_produto' | 'faixas'
export type FieldMode = 'oculto' | 'opcional' | 'obrigatorio'

export type Permission =
  'view_revenue' | 'view_costs' | 'confirm_payment' | 'send_quote' | 'delete_request' | 'manage_purchases' | 'manage_customers'

export interface Profile {
  id: string
  full_name: string
  email: string | null
  avatar_url: string | null
  role: AppRole
  active: boolean
  last_seen_at: string | null
  created_at: string
}

export interface Customer {
  id: string
  name: string
  company: string
  cnpj: string | null
  whatsapp: string | null
  email: string | null
  notes: string | null
  fee_exempt: boolean
  created_at: string
}

export interface CustomerOverview extends Customer {
  request_count: number
  approved_count: number
  approved_total: number
  last_request_at: string | null
}

export interface QuoteRequest {
  id: string
  code: string
  public_token: string
  customer_id: string
  status: QuoteStatus
  priority: Priority
  assigned_to: string | null
  fee_amount: number
  fee_discount: number
  coupon_id: string | null
  payment_status: PaymentStatus
  payment_method: string | null
  payment_id: string | null
  paid_at: string | null
  paid_confirmed_by: string | null
  payment_due_at: string | null
  customer_message: string | null
  valid_until: string | null
  sent_at: string | null
  responded_at: string | null
  decline_reason: string | null
  fee_deducted: boolean
  rebuy_of: string | null
  created_at: string
  updated_at: string
}

export interface QuoteItem {
  id: string
  request_id: string
  name: string
  description: string | null
  reference_url: string | null
  category_id: string | null
  quantity: number
  unit: string
  target_price: number
  notes: string | null
  accepted_conditions: ProductCondition[]
  /** Preço por unidade aprovado na compra anterior (só em recompras). */
  previous_price: number | null
  not_found: boolean
  position: number
}

export interface QuoteItemPhoto {
  id: string
  item_id: string
  storage_path: string
  position: number
}

export interface QuoteOption {
  id: string
  item_id: string
  label: string
  supplier_id: string | null
  supplier_name: string
  supplier_contact?: string | null
  cost_price?: number | null
  sale_price: number
  lead_time_days: number | null
  payment_terms: string | null
  freight_included: boolean
  freight_value: number
  customer_notes: string | null
  internal_notes: string | null
  condition: ProductCondition | null
  origin: OptionOrigin | null
  selected_by_customer: boolean
  position: number
}

export interface PurchaseTask {
  id: string
  request_id: string
  item_id: string
  option_id: string | null
  status: PurchaseStatus
  assigned_to: string | null
  purchased_at: string | null
  supplier_order_number: string | null
  tracking_code: string | null
  expected_delivery: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PurchaseAttachment {
  id: string
  purchase_task_id: string
  storage_path: string
  file_name: string
  created_at: string
}

export interface Comment {
  id: string
  request_id: string
  author_id: string | null
  body: string
  mentions: string[]
  created_at: string
}

export interface StatusHistory {
  id: string
  entity_type: 'quote' | 'purchase'
  entity_id: string
  from_status: string | null
  to_status: string
  changed_by: string | null
  note: string | null
  created_at: string
}

export interface NotificationLog {
  id: string
  request_id: string | null
  event: string
  channel: 'email' | 'whatsapp'
  recipient: string
  status: 'enviado' | 'falhou' | 'nao_configurado'
  error: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  section: string
  entity: string
  entity_id: string | null
  action: 'insert' | 'update' | 'delete'
  field: string | null
  old_value: unknown
  new_value: unknown
  created_at: string
}

export interface Category {
  id: string
  name: string
  position: number
  active: boolean
}
export interface Unit {
  id: string
  code: string
  label: string
  position: number
  active: boolean
}
export interface FaqItem {
  id: string
  question: string
  answer: string
  position: number
  active: boolean
}

export interface Supplier {
  id: string
  name: string
  contact_name: string | null
  whatsapp: string | null
  email: string | null
  website: string | null
  category_ids: string[]
  notes: string | null
  active: boolean
}

export interface Coupon {
  id: string
  code: string
  discount_type: 'percent' | 'fixed'
  value: number
  valid_until: string | null
  max_uses: number | null
  used_count: number
  active: boolean
}

export interface FeeTier {
  from: number
  to: number | null
  amount: number
}

export interface LandingContent {
  hero: { title: string; subtitle: string; cta_primary: string; cta_secondary: string }
  steps: { title: string; text: string; active: boolean; payment: boolean }[]
  benefits: { title: string; text: string }[]
  cta_final: { title: string; text: string; button: string }
}

export type NotificationEvent =
  | 'pedido_recebido'
  | 'pagamento_confirmado'
  | 'cotacao_pronta'
  | 'nao_encontrado'
  | 'aprovacao_recebida'
  | 'lembrete_pagamento'
  | 'lembrete_resposta'
  | 'compra_atualizada'
  | 'interno_novo_pedido'
  | 'interno_aprovada'
  | 'interno_recusada'

export interface Settings {
  company_name: string
  display_name: string
  cnpj: string | null
  address: string | null
  logo_light_path: string | null
  logo_dark_path: string | null
  favicon_path: string | null
  contact_whatsapp: string | null
  contact_email: string | null
  business_hours: string | null
  social_links: Record<string, string>
  team_notification_emails: string[]
  onboarding_completed: boolean
  charge_enabled: boolean
  fee_model: FeeModel
  fee_fixed: number
  fee_per_item: number
  fee_per_item_max: number | null
  fee_tiers: FeeTier[]
  charge_moment: 'antes' | 'depois'
  deduct_fee_on_purchase: boolean
  show_fee_on_landing: boolean
  payment_methods: string[]
  pix_key: string | null
  pix_key_type: string | null
  pix_receiver_name: string | null
  pix_instructions: string | null
  payment_deadline_hours: number
  sla_hours: number
  eta_text: string
  default_validity_days: number
  max_items_per_request: number
  max_photos_per_item: number
  max_photo_mb: number
  form_fields_config: Record<string, FieldMode>
  max_options_per_item: number
  min_margin_alert: number
  assignment_mode: 'manual' | 'rodizio'
  default_priority: Priority
  terms_text: string
  landing_content: LandingContent
  seo_title: string | null
  seo_description: string | null
  og_image_path: string | null
  email_templates: Partial<Record<NotificationEvent, { subject: string; body: string }>>
  whatsapp_templates: Partial<Record<NotificationEvent, string>>
  notification_toggles: Partial<Record<NotificationEvent, { email: boolean; whatsapp: boolean }>>
  reminders_config: {
    payment_reminder_enabled: boolean
    payment_reminder_hours: number
    response_reminder_enabled: boolean
    response_reminder_days: number
  }
  email_from_name: string | null
  email_from_address: string | null
  whatsapp_provider: 'none' | 'zapi' | 'evolution' | 'meta'
  payment_provider: 'none' | 'asaas' | 'mercadopago'
  payment_env: 'sandbox' | 'producao'
  updated_at: string
}

/** Configurações públicas (get_public_settings) */
export interface PublicSettings {
  display_name: string
  company_name: string
  logo_light_path: string | null
  logo_dark_path: string | null
  contact_whatsapp: string | null
  contact_email: string | null
  business_hours: string | null
  social_links: Record<string, string>
  eta_text: string
  terms_text: string
  landing: LandingContent
  seo_title: string | null
  seo_description: string | null
  og_image_path: string | null
  form: {
    fields: Record<string, FieldMode>
    max_items: number
    max_photos: number
    max_photo_mb: number
  }
  charge: {
    enabled: boolean
    model: FeeModel
    fixed: number
    per_item: number
    per_item_max: number | null
    tiers: FeeTier[]
    moment: 'antes' | 'depois'
    show_on_landing: boolean
    deduct_on_purchase: boolean
    methods: string[]
    has_coupons: boolean
  }
  faq: { id: string; question: string; answer: string }[]
  categories: { id: string; name: string }[]
  units: { code: string; label: string }[]
}

export interface FeeResult {
  charge_enabled: boolean
  exempt: boolean
  base: number
  discount: number
  total: number
  coupon_id: string | null
  coupon_error: string | null
  charge_moment: 'antes' | 'depois'
}
