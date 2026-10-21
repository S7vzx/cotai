/** Máscaras de entrada (apenas apresentação; o valor salvo é normalizado). */

export function maskPhone(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function maskCnpj(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

/** CPF enquanto tiver até 11 dígitos; depois, CNPJ. */
export function maskDocument(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 14)
  if (d.length > 11) return maskCnpj(d)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export { isValidCnpj, isValidDocument } from '../../supabase/functions/_shared/validation'

/** Centavos digitados → texto "1.234,56" */
export function maskMoney(input: string): string {
  const digits = input
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, 12)
  if (!digits) return ''
  const cents = digits.padStart(3, '0')
  const int = cents.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${int},${cents.slice(-2)}`
}

/** "1.234,56" → 1234.56 */
export function parseMoney(input: string | number | null | undefined): number {
  if (typeof input === 'number') return input
  if (!input) return 0
  const n = Number(
    input
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, ''),
  )
  return Number.isFinite(n) ? n : 0
}

/** 1234.56 → "1.234,56" */
export function moneyToInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return maskMoney(Math.round(value * 100).toString())
}
