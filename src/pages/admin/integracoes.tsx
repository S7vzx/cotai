import { CheckCircle2, CircleDashed, Copy } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/controls'
import { Group, Row } from '@/components/ui/group'
import { Input } from '@/components/ui/input'
import { invoke } from '@/lib/supabase'
import { errorMessage } from '@/lib/utils'
import type { Settings } from '@/types/domain'
import { useIntegrationStatus } from './home'
import { SaveBar, SectionShell, useSettingsDraft } from './shared'

const KEYS = ['email_from_name', 'email_from_address', 'whatsapp_provider', 'payment_provider', 'payment_env'] as const

function Secrets({ secrets }: { secrets?: Record<string, boolean> }) {
  if (!secrets) return null
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {Object.entries(secrets).map(([k, ok]) => (
        <li
          key={k}
          className={ok ? 'flex items-center gap-1 text-[13px] text-accent-text' : 'flex items-center gap-1 text-[13px] text-fg-3'}
        >
          {ok ? <CheckCircle2 className="size-3.5" /> : <CircleDashed className="size-3.5" />}
          <code>{k}</code>
        </li>
      ))}
    </ul>
  )
}

function TestRow({ channel, placeholder }: { channel: 'email' | 'whatsapp'; placeholder: string }) {
  const [to, setTo] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  return (
    <Row label="Enviar teste" stacked>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            const r = await invoke<{ status: string; error?: string }>('send-test-notification', { channel, to })
            if (r.status === 'enviado') toast.success('Teste enviado. Confira!')
            else if (r.status === 'nao_configurado') toast.warning('Integração ainda não configurada', { description: r.error })
            else toast.error('O envio falhou', { description: r.error })
          } catch (err) {
            toast.error(errorMessage(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder={placeholder} required />
        <Button type="submit" variant="secondary" loading={busy}>
          Enviar
        </Button>
      </form>
    </Row>
  )
}

const SECRET_HELP: Record<string, string> = {
  zapi: 'ZAPI_INSTANCE, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN',
  evolution: 'EVOLUTION_URL, EVOLUTION_KEY e EVOLUTION_INSTANCE',
  meta: 'META_TOKEN e META_PHONE_ID',
  asaas: 'ASAAS_API_KEY e PAYMENT_WEBHOOK_SECRET',
  mercadopago: 'MERCADOPAGO_ACCESS_TOKEN e PAYMENT_WEBHOOK_SECRET',
  abacatepay: 'ABACATEPAY_API_KEY e PAYMENT_WEBHOOK_SECRET (opcional: ABACATEPAY_METHODS=PIX,CARD,BOLETO)',
}

export default function AdminIntegracoes() {
  const { draft, set, dirty, save, reset, saving, isLoading, error, refetch } = useSettingsDraft(KEYS)
  const { data: status, error: statusError, refetch: refetchStatus } = useIntegrationStatus()

  return (
    <SectionShell
      title="Integrações"
      description="As chaves secretas nunca ficam aqui: elas são cadastradas nos Secrets do Supabase. Esta tela só mostra se cada uma está configurada."
      loading={isLoading || !draft}
      error={error}
      onRetry={() => refetch()}
    >
      {draft && (
        <>
          {statusError && (
            <div className="rounded-2xl bg-surface p-4 text-[15px] text-fg-2">
              Não foi possível consultar o status (as Edge Functions estão publicadas?).{' '}
              <button className="text-accent-text" onClick={() => refetchStatus()}>
                Tentar de novo
              </button>
            </div>
          )}

          <Group title="E-mail (Resend)" footer="Cadastre RESEND_API_KEY e EMAIL_FROM com: supabase secrets set NOME=valor">
            <Row label="Status">
              <Secrets secrets={status?.email.secrets} />
            </Row>
            <Row label="Nome do remetente" description="Ex.: Cotaí" stacked>
              <Input value={draft.email_from_name ?? ''} onChange={(e) => set('email_from_name', e.target.value || null)} />
            </Row>
            <TestRow channel="email" placeholder="seu@email.com" />
          </Group>

          <Group
            title="WhatsApp"
            footer={
              draft.whatsapp_provider === 'none'
                ? 'Sem provedor, o painel mostra um botão para enviar a mensagem pronta pelo seu WhatsApp.'
                : `Secrets necessários: WHATSAPP_PROVIDER=${draft.whatsapp_provider} e ${SECRET_HELP[draft.whatsapp_provider]}.`
            }
          >
            <Row label="Provedor" stacked>
              <Segmented<Settings['whatsapp_provider']>
                size="sm"
                value={draft.whatsapp_provider}
                onChange={(v) => set('whatsapp_provider', v)}
                options={[
                  { value: 'none', label: 'Nenhum (link)' },
                  { value: 'zapi', label: 'Z-API' },
                  { value: 'evolution', label: 'Evolution' },
                  { value: 'meta', label: 'Meta (oficial)' },
                ]}
              />
            </Row>
            {status && status.whatsapp.provider !== draft.whatsapp_provider && draft.whatsapp_provider !== 'none' && (
              <Row
                label={
                  <span className="text-[15px] text-[var(--status-orange)]">
                    O servidor está usando “{status.whatsapp.provider}”. Atualize o secret WHATSAPP_PROVIDER.
                  </span>
                }
              />
            )}
            <Row label="Status">
              <Secrets secrets={status?.whatsapp.secrets} />
            </Row>
            <TestRow channel="whatsapp" placeholder="(79) 99999-9999" />
          </Group>

          <Group
            title="Pagamento automático"
            footer={
              draft.payment_provider === 'none'
                ? 'Sem provedor, o cliente vê a chave Pix e a equipe confirma o pagamento no painel.'
                : `Secrets necessários: PAYMENT_PROVIDER=${draft.payment_provider}, PAYMENT_ENV e ${SECRET_HELP[draft.payment_provider]}.`
            }
          >
            <Row label="Provedor" stacked>
              <Segmented<Settings['payment_provider']>
                size="sm"
                value={draft.payment_provider}
                onChange={(v) => set('payment_provider', v)}
                options={[
                  { value: 'none', label: 'Nenhum (Pix manual)' },
                  { value: 'asaas', label: 'Asaas' },
                  { value: 'mercadopago', label: 'Mercado Pago' },
                  { value: 'abacatepay', label: 'AbacatePay' },
                ]}
              />
            </Row>
            <Row label="Ambiente" stacked>
              <Segmented<Settings['payment_env']>
                size="sm"
                value={draft.payment_env}
                onChange={(v) => set('payment_env', v)}
                options={[
                  { value: 'sandbox', label: 'Testes (sandbox)' },
                  { value: 'producao', label: 'Produção' },
                ]}
              />
            </Row>
            <Row label="Status">
              <Secrets secrets={status?.payment.secrets} />
            </Row>
            {status?.payment.webhook_url && (
              <Row
                label="URL do webhook"
                description={
                  draft.payment_provider === 'abacatepay'
                    ? 'Cadastre na AbacatePay com o evento checkout.completed e, no campo Secret, o mesmo valor de PAYMENT_WEBHOOK_SECRET'
                    : 'Cadastre no painel do provedor'
                }
                stacked
              >
                <div className="flex items-center gap-2 rounded-xl bg-surface-2 p-1.5 pl-4">
                  <code className="min-w-0 flex-1 truncate text-[13px]">{status.payment.webhook_url}</code>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void navigator.clipboard.writeText(status.payment.webhook_url)
                      toast.success('URL copiada')
                    }}
                  >
                    <Copy className="size-4" /> Copiar
                  </Button>
                </div>
              </Row>
            )}
          </Group>

          <SaveBar dirty={dirty} saving={saving} onReset={reset} onSave={() => save()} />
        </>
      )}
    </SectionShell>
  )
}
