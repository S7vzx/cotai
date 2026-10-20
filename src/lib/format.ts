import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })

export function money(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value
  return currency.format(Number.isFinite(n) ? (n as number) : 0)
}

export function num(value: number | null | undefined): string {
  return number.format(value ?? 0)
}

/** Recebe uma fração (0.125) e devolve "12,5%". */
export function pct(fraction: number | null | undefined): string {
  return percent.format(fraction ?? 0)
}

function toDate(value: string | Date): Date {
  return typeof value === 'string' ? parseISO(value) : value
}

/** 20/10/2026 14:30 */
export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return format(toDate(value), 'dd/MM/yyyy HH:mm', { locale: ptBR })
}

/** 20/10/2026 */
export function date(value: string | Date | null | undefined): string {
  if (!value) return '—'
  // datas puras (yyyy-MM-dd) não devem sofrer conversão de fuso
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  }
  return format(toDate(value), 'dd/MM/yyyy', { locale: ptBR })
}

/** "há 3 horas" */
export function ago(value: string | Date | null | undefined): string {
  if (!value) return '—'
  return `há ${formatDistanceToNowStrict(toDate(value), { locale: ptBR })}`
}

export function hoursSince(value: string | Date): number {
  return (Date.now() - toDate(value).getTime()) / 36e5
}

/** +5579999998888 → (79) 99999-8888 */
export function phone(e164: string | null | undefined): string {
  if (!e164) return '—'
  const digits = e164.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return e164
}

/** (79) 99999-8888 → +5579999998888 (ou null se inválido) */
export function toE164(input: string | null | undefined): string | null {
  if (!input) return null
  let digits = input.replace(/\D/g, '')
  if (digits.length === 12 || digits.length === 13) {
    if (!digits.startsWith('55')) return null
    digits = digits.slice(2)
  }
  if (digits.length !== 10 && digits.length !== 11) return null
  return `+55${digits}`
}

export function waLink(e164: string | null | undefined, text?: string): string | null {
  if (!e164) return null
  const n = e164.replace(/\D/g, '')
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}
