// Mensagens avulsas da equipe para o cliente (pagamento confirmado, status da compra, lembretes, reenvio).
import { handler, HttpError, json } from '../_shared/http.ts'
import { notify, type NotificationEvent } from '../_shared/notify.ts'
import { admin, requireStaff } from '../_shared/supabase.ts'

const ALLOWED: NotificationEvent[] = [
  'pagamento_confirmado',
  'compra_atualizada',
  'lembrete_pagamento',
  'lembrete_resposta',
  'cotacao_pronta',
  'pedido_recebido',
  'aprovacao_recebida', // recompra confirmada pela equipe
]

Deno.serve(
  handler(async (req, body) => {
    await requireStaff(req)
    const event = String(body.event) as NotificationEvent
    if (!ALLOWED.includes(event)) throw new HttpError(400, 'Evento inválido')

    // Reenvio a partir do log de notificações
    let requestId = String(body.request_id ?? '')
    if (body.log_id) {
      const { data: log } = await admin.from('notifications_log').select('request_id').eq('id', body.log_id).maybeSingle()
      requestId = log?.request_id ?? requestId
    }
    if (!requestId) throw new HttpError(400, 'Pedido não informado')

    const result = await notify(requestId, event, {
      mensagem: typeof body.message === 'string' ? body.message.slice(0, 2000) : undefined,
      channels: body.channels as { email?: boolean; whatsapp?: boolean } | undefined,
    })
    return json(result)
  }),
)
