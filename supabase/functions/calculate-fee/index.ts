// Calcula a taxa de cotação (fonte única: public.calculate_fee no banco).
import { handler, json } from '../_shared/http.ts'
import { admin } from '../_shared/supabase.ts'

Deno.serve(
  handler(async (_req, body) => {
    const count = Math.max(1, Math.min(100, Number(body.item_count) || 1))
    const coupon = typeof body.coupon === 'string' ? body.coupon.slice(0, 40) : null
    const { data, error } = await admin.rpc('calculate_fee', { p_item_count: count, p_coupon: coupon, p_customer_id: null })
    if (error) throw error
    return json(data)
  }),
)
