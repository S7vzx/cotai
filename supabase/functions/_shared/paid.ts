// Confirma o pagamento de um pedido (fila de cotação + aviso ao cliente). Usado quando o cartão é
// aprovado na hora e quando a página do pedido descobre, consultando o provedor, que o Pix caiu.
import { notify } from './notify.ts'
import type { PixCharge } from './payments.ts'
import { admin } from './supabase.ts'

export async function confirmPaid(requestId: string, charge: Pick<PixCharge, 'method' | 'payment_id'>) {
  const { data: before } = await admin.from('quote_requests').select('payment_status').eq('id', requestId).single()
  if (before?.payment_status !== 'pendente') return
  const { error } = await admin.rpc('mark_request_paid', {
    p_request_id: requestId,
    p_method: charge.method,
    p_payment_id: charge.payment_id,
  })
  if (error) throw error
  await notify(requestId, 'pagamento_confirmado').catch((e) => console.error(e))
}
