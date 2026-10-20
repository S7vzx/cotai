// Sem dependências do Deno: também é testado pelo Vitest (src/lib/lib.test.ts).

export type TemplateVars = Record<string, string | number | null | undefined>

/** Substitui {{variavel}} pelos valores; variáveis desconhecidas somem. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => {
      const v = vars[key]
      return v === null || v === undefined ? '' : String(v)
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
}

export const TEMPLATE_VARIABLES = ['nome', 'empresa', 'codigo', 'link', 'total', 'taxa', 'validade', 'prazo', 'mensagem'] as const

export function brl(value: number | string | null | undefined): string {
  const n = Number(value ?? 0)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(n) ? n : 0)
}

export function brDate(value: string | null | undefined): string {
  if (!value) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value
}

/** Corpo de e-mail HTML simples, responsivo e sem dependências. */
export function emailHtml(opts: {
  body: string
  brandName: string
  logoUrl?: string | null
  buttonUrl?: string
  buttonLabel?: string
  accent?: string
}) {
  const accent = opts.accent ?? '#00A878'
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const urlRe = /(https?:\/\/[^\s<]+)/g
  const paragraphs = esc(opts.body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${p.replace(/\n/g, '<br>').replace(urlRe, `<a href="$1" style="color:#00875F">$1</a>`)}</p>`)
    .join('')
  const header = opts.logoUrl
    ? `<img src="${opts.logoUrl}" alt="${esc(opts.brandName)}" height="28" style="height:28px">`
    : `<span style="font-size:22px;font-weight:600;letter-spacing:-0.02em;color:#1D1D1F">${esc(opts.brandName)}</span>`
  const button = opts.buttonUrl
    ? `<p style="margin:24px 0 8px"><a href="${opts.buttonUrl}" style="display:inline-block;background:${accent};color:#fff;font-weight:700;font-size:17px;text-decoration:none;padding:12px 24px;border-radius:999px">${esc(opts.buttonLabel ?? 'Abrir')}</a></p>`
    : ''
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F5F5F7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Inter,Arial,sans-serif;color:#1D1D1F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:18px;padding:32px">
<tr><td style="padding-bottom:24px">${header}</td></tr>
<tr><td style="font-size:16px;line-height:1.55">${paragraphs}${button}</td></tr>
</table>
<p style="font-size:12px;color:#86868B;margin-top:16px">Você recebeu este e-mail por causa de um pedido de cotação.</p>
</td></tr></table></body></html>`
}
