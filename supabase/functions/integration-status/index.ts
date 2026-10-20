// Diz quais integrações estão configuradas — nunca devolve os segredos.
import { emailConfigured, whatsappConfigured, whatsappProvider } from '../_shared/channels.ts'
import { handler, json } from '../_shared/http.ts'
import { paymentProvider } from '../_shared/payments.ts'
import { requireAdmin } from '../_shared/supabase.ts'

const has = (k: string) => Boolean(Deno.env.get(k))

Deno.serve(
  handler(async (req) => {
    await requireAdmin(req)
    return json({
      email: { configured: emailConfigured(), secrets: { RESEND_API_KEY: has('RESEND_API_KEY'), EMAIL_FROM: has('EMAIL_FROM') } },
      whatsapp: {
        configured: whatsappConfigured(),
        provider: whatsappProvider(),
        secrets: {
          WHATSAPP_PROVIDER: has('WHATSAPP_PROVIDER'),
          ZAPI_INSTANCE: has('ZAPI_INSTANCE'),
          ZAPI_TOKEN: has('ZAPI_TOKEN'),
          EVOLUTION_URL: has('EVOLUTION_URL'),
          EVOLUTION_KEY: has('EVOLUTION_KEY'),
          META_TOKEN: has('META_TOKEN'),
          META_PHONE_ID: has('META_PHONE_ID'),
        },
      },
      payment: {
        configured: paymentProvider() !== 'none',
        provider: paymentProvider(),
        env: Deno.env.get('PAYMENT_ENV') ?? 'sandbox',
        webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-webhook`,
        secrets: {
          PAYMENT_PROVIDER: has('PAYMENT_PROVIDER'),
          ASAAS_API_KEY: has('ASAAS_API_KEY'),
          MERCADOPAGO_ACCESS_TOKEN: has('MERCADOPAGO_ACCESS_TOKEN'),
          PAYMENT_WEBHOOK_SECRET: has('PAYMENT_WEBHOOK_SECRET'),
        },
      },
    })
  }),
)
