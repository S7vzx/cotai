// Envia a cotação pronta (ou o aviso de "não encontrado") ao cliente.
import { handler, HttpError, json } from '../_shared/http.ts'
import { notify } from '../_shared/notify.ts'
import { admin, requireStaff } from '../_shared/supabase.ts'

Deno.serve(
  handler(async (req, body) => {
    await requireStaff(req, 'send_quote')
    const id = String(body.request_id ?? '')
    const mode = body.mode === 'not_found' ? 'not_found' : 'quote'
    const channels = (body.channels ?? {}) as { email?: boolean; whatsapp?: boolean }
    const message = typeof body.message === 'string' ? body.message.slice(0, 2000) : null

    const { data: q } = await admin.from('quote_requests').select('*').eq('id', id).maybeSingle()
    if (!q) throw new HttpError(404, 'Pedido não encontrado')

    const move = async (to: string) => {
      const { error } = await admin.from('quote_requests').update({ status: to }).eq('id', id)
      if (error) throw error
    }

    if (mode === 'quote') {
      // precisa de pelo menos uma opção em algum produto disponível
      const { data: items } = await admin.from('quote_items').select('id, not_found, quote_options(id)').eq('request_id', id)
      const ready = (items ?? []).some((i) => !i.not_found && (i.quote_options ?? []).length > 0)
      if (!ready) throw new HttpError(400, 'Adicione pelo menos uma opção de preço antes de enviar')

      const validUntil = typeof body.valid_until === 'string' ? body.valid_until : q.valid_until
      if (!validUntil) throw new HttpError(400, 'Defina a validade da cotação')
      await admin
        .from('quote_requests')
        .update({ customer_message: message ?? q.customer_message, valid_until: validUntil })
        .eq('id', id)

      if (q.status === 'em_cotacao') await move('cotado')
      if (q.status === 'em_cotacao' || q.status === 'cotado') await move('enviado')
      else if (q.status !== 'enviado') throw new HttpError(400, 'Este pedido não está pronto para envio')
      await admin.from('quote_requests').update({ sent_at: new Date().toISOString() }).eq('id', id)

      const result = await notify(id, 'cotacao_pronta', { channels, mensagem: message ?? undefined })
      return json(result)
    }

    // não encontrado
    if (!['em_cotacao', 'cotado', 'novo'].includes(q.status)) throw new HttpError(400, 'Status atual não permite esta ação')
    if (q.status === 'novo') await move('em_cotacao')
    await move('nao_encontrado')
    await admin.from('quote_requests').update({ customer_message: message }).eq('id', id)
    const result = await notify(id, 'nao_encontrado', { channels, mensagem: message ?? '' })
    return json(result)
  }),
)
