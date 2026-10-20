import type { PaymentStatus, Priority, PurchaseStatus, QuoteStatus } from '@/types/domain'

type Tone = 'gray' | 'blue' | 'yellow' | 'purple' | 'indigo' | 'green' | 'red' | 'orange' | 'dark'

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; short: string; tone: Tone }> = {
  aguardando_pagamento: { label: 'Aguardando pagamento', short: 'Pagamento', tone: 'gray' },
  novo: { label: 'Novo', short: 'Novo', tone: 'blue' },
  em_cotacao: { label: 'Em cotação', short: 'Em cotação', tone: 'yellow' },
  cotado: { label: 'Cotado', short: 'Cotado', tone: 'purple' },
  enviado: { label: 'Enviado ao cliente', short: 'Enviado', tone: 'indigo' },
  aprovado: { label: 'Aprovado', short: 'Aprovado', tone: 'green' },
  recusado: { label: 'Recusado', short: 'Recusado', tone: 'red' },
  nao_encontrado: { label: 'Não encontrado', short: 'Não encontrado', tone: 'orange' },
  cancelado: { label: 'Cancelado', short: 'Cancelado', tone: 'dark' },
}

export const PURCHASE_STATUS: Record<PurchaseStatus, { label: string; tone: Tone }> = {
  a_comprar: { label: 'A comprar', tone: 'blue' },
  comprado: { label: 'Comprado', tone: 'purple' },
  em_transito: { label: 'Em trânsito', tone: 'yellow' },
  entregue: { label: 'Entregue', tone: 'green' },
  cancelado: { label: 'Cancelado', tone: 'dark' },
}

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  pendente: { label: 'Pendente', tone: 'orange' },
  pago: { label: 'Pago', tone: 'green' },
  isento: { label: 'Isento', tone: 'gray' },
  estornado: { label: 'Estornado', tone: 'red' },
}

export const PRIORITY: Record<Priority, { label: string; tone: Tone }> = {
  baixa: { label: 'Baixa', tone: 'gray' },
  normal: { label: 'Normal', tone: 'blue' },
  alta: { label: 'Alta', tone: 'orange' },
  urgente: { label: 'Urgente', tone: 'red' },
}

export const TONE_VAR: Record<Tone, string> = {
  gray: 'var(--status-gray)',
  blue: 'var(--status-blue)',
  yellow: 'var(--status-yellow)',
  purple: 'var(--status-purple)',
  indigo: 'var(--status-indigo)',
  green: 'var(--status-green)',
  red: 'var(--status-red)',
  orange: 'var(--status-orange)',
  dark: 'var(--fg-2)',
}

// Espelho de public.quote_transition_allowed (supabase/migrations/..._functions.sql)
const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  aguardando_pagamento: ['novo', 'cancelado'],
  novo: ['em_cotacao', 'cancelado'],
  em_cotacao: ['novo', 'cotado', 'nao_encontrado', 'cancelado'],
  cotado: ['em_cotacao', 'enviado', 'nao_encontrado', 'cancelado'],
  enviado: ['em_cotacao', 'aprovado', 'recusado', 'cancelado'],
  aprovado: ['cancelado'],
  recusado: ['em_cotacao'],
  nao_encontrado: ['em_cotacao'],
  cancelado: ['novo'],
}

export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return from === to || QUOTE_TRANSITIONS[from].includes(to)
}

export function nextStatuses(from: QuoteStatus): QuoteStatus[] {
  return QUOTE_TRANSITIONS[from]
}

/**
 * Algumas transições não podem ser feitas arrastando no kanban porque
 * precisam de uma ação com efeito colateral (enviar mensagem, aprovar).
 */
export const DRAG_BLOCKED: Partial<Record<QuoteStatus, string>> = {
  enviado: 'Use "Enviar ao cliente" no detalhe do pedido',
  aprovado: 'Somente o cliente aprova a cotação',
  recusado: 'Somente o cliente recusa a cotação',
  nao_encontrado: 'Use "Não encontrado" no detalhe do pedido',
}

export const PURCHASE_ORDER: PurchaseStatus[] = ['a_comprar', 'comprado', 'em_transito', 'entregue']

export const KANBAN_COLUMNS: { id: string; title: string; statuses: QuoteStatus[] }[] = [
  { id: 'aguardando_pagamento', title: 'Aguardando pagamento', statuses: ['aguardando_pagamento'] },
  { id: 'novo', title: 'Novo', statuses: ['novo'] },
  { id: 'em_cotacao', title: 'Em cotação', statuses: ['em_cotacao'] },
  { id: 'cotado', title: 'Cotado', statuses: ['cotado'] },
  { id: 'enviado', title: 'Enviado', statuses: ['enviado'] },
  { id: 'aprovado', title: 'Aprovado', statuses: ['aprovado'] },
  { id: 'encerrado', title: 'Recusado / Não encontrado', statuses: ['recusado', 'nao_encontrado'] },
]
