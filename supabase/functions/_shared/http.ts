export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** Envolve o handler com CORS, parse de JSON e tratamento de erros. */
export function handler(fn: (req: Request, body: Record<string, unknown>) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
      let body: Record<string, unknown> = {}
      if (req.method === 'POST') {
        const text = await req.text()
        body = text ? JSON.parse(text) : {}
      }
      return await fn(req, body)
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status)
      // Erros de negócio do Postgres (raise exception ... errcode P0001) são mensagens para o usuário
      const e = err as { code?: string; message?: string }
      if (e?.code === 'P0001' || e?.code === 'P0002') return json({ error: e.message }, 400)
      console.error(err)
      return json({ error: 'Erro interno. Tente novamente em instantes.' }, 500)
    }
  }
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('cf-connecting-ip') || 'desconhecido'
}
