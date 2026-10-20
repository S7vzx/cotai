import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Mensagem de erro legível para o usuário (Supabase, Edge Function ou Error). */
export function errorMessage(err: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  if (!err) return fallback
  if (typeof err === 'string') return err
  if (typeof err === 'object' && err !== null) {
    const e = err as { message?: string; error?: string; details?: string }
    const msg = e.message || e.error || e.details
    if (msg) {
      if (/permission denied|row-level security/i.test(msg)) return 'Você não tem permissão para isso.'
      if (/Failed to fetch|NetworkError/i.test(msg)) return 'Sem conexão com o servidor. Verifique sua internet.'
      return msg
    }
  }
  return fallback
}

export function csvDownload(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(';'), ...rows.map((r) => headers.map((h) => esc(r[h])).join(';'))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
