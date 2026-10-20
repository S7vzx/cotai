import { useQuery } from '@tanstack/react-query'
import { Download, RotateCw } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Segmented, Skeleton } from '@/components/ui/controls'
import { NativeSelect } from '@/components/ui/input'
import { Badge } from '@/components/shared/badges'
import { useTeamMap } from '@/features/team/api'
import { dateTime } from '@/lib/format'
import { invoke, supabase, unwrap } from '@/lib/supabase'
import { csvDownload, errorMessage } from '@/lib/utils'
import type { AuditLog, NotificationLog } from '@/types/domain'
import { EVENTS } from './mensagens'
import { SectionShell } from './shared'

export const FIELD_LABELS: Record<string, string> = {
  charge_enabled: 'cobrança ativa',
  fee_model: 'modelo de cobrança',
  fee_fixed: 'valor da taxa',
  fee_per_item: 'valor por produto',
  fee_per_item_max: 'teto por pedido',
  fee_tiers: 'faixas de cobrança',
  charge_moment: 'momento da cobrança',
  deduct_fee_on_purchase: 'abater taxa na compra',
  show_fee_on_landing: 'valor na landing',
  payment_methods: 'formas de pagamento',
  pix_key: 'chave Pix',
  display_name: 'nome exibido',
  company_name: 'razão social',
  contact_whatsapp: 'WhatsApp de contato',
  contact_email: 'e-mail de contato',
  landing_content: 'textos da landing',
  email_templates: 'templates de e-mail',
  whatsapp_templates: 'templates de WhatsApp',
  notification_toggles: 'canais das mensagens',
  sla_hours: 'SLA',
  eta_text: 'prazo exibido',
  form_fields_config: 'campos do formulário',
  terms_text: 'termos de uso',
  role: 'papel',
  active: 'status',
  allowed: 'permissão',
  fee_exempt: 'isenção de taxa',
  onboarding_completed: 'assistente inicial',
}

const SECTIONS = ['configuracoes', 'cobranca', 'landing', 'categorias', 'fornecedores', 'equipe']
const short = (v: unknown) => {
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return s && s.length > 60 ? `${s.slice(0, 60)}…` : (s ?? '—')
}

export default function AdminLogs() {
  const [tab, setTab] = React.useState<'auditoria' | 'notificacoes'>('auditoria')
  return (
    <SectionShell title="Logs" description="Tudo o que foi alterado e todas as mensagens enviadas." wide>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'auditoria', label: 'Auditoria' },
          { value: 'notificacoes', label: 'Notificações' },
        ]}
      />
      {tab === 'auditoria' ? <Audit /> : <Notifications />}
    </SectionShell>
  )
}

function Audit() {
  const team = useTeamMap()
  const [user, setUser] = React.useState('')
  const [section, setSection] = React.useState('')
  const [days, setDays] = React.useState('30')
  const { data, isLoading } = useQuery({
    queryKey: ['audit', user, section, days],
    queryFn: async () => {
      let q = supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(500)
      if (user) q = q.eq('user_id', user)
      if (section) q = q.eq('section', section)
      if (days !== 'todos') q = q.gte('created_at', new Date(Date.now() - Number(days) * 86400_000).toISOString())
      return unwrap(await q) as AuditLog[]
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          className="h-9 rounded-[10px] bg-surface text-[15px]"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          aria-label="Usuário"
        >
          <option value="">Todos os usuários</option>
          {[...team.values()].map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          className="h-9 rounded-[10px] bg-surface text-[15px]"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          aria-label="Seção"
        >
          <option value="">Todas as seções</option>
          {SECTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          className="h-9 rounded-[10px] bg-surface text-[15px]"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          aria-label="Período"
        >
          <option value="7">7 dias</option>
          <option value="30">30 dias</option>
          <option value="90">90 dias</option>
          <option value="todos">Tudo</option>
        </NativeSelect>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          disabled={!data?.length}
          onClick={() =>
            csvDownload(
              'auditoria.csv',
              (data ?? []).map((a) => ({
                data: dateTime(a.created_at),
                usuario: a.user_id ? (team.get(a.user_id)?.full_name ?? a.user_id) : 'sistema',
                secao: a.section,
                tabela: a.entity,
                acao: a.action,
                campo: a.field ?? '',
                antes: a.old_value,
                depois: a.new_value,
              })),
            )
          }
        >
          <Download className="size-4" /> CSV
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface">
          <table className="w-full min-w-[720px] text-left text-[15px]">
            <thead className="border-b border-line text-[13px] uppercase tracking-[0.03em] text-fg-2">
              <tr>
                <th className="h-10 px-4 font-medium">Quando</th>
                <th className="h-10 px-4 font-medium">Quem</th>
                <th className="h-10 px-4 font-medium">O quê</th>
                <th className="h-10 px-4 font-medium">Antes → depois</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(data ?? []).map((a) => (
                <tr key={a.id} className="h-12 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-fg-2 tabular">{dateTime(a.created_at)}</td>
                  <td className="px-4 py-3">{a.user_id ? (team.get(a.user_id)?.full_name ?? 'Usuário') : 'Sistema'}</td>
                  <td className="px-4 py-3">
                    {a.action === 'update'
                      ? `Alterou ${FIELD_LABELS[a.field ?? ''] ?? a.field}`
                      : a.action === 'insert'
                        ? 'Criou'
                        : 'Removeu'}{' '}
                    <span className="text-fg-3">({a.section})</span>
                  </td>
                  <td className="max-w-[360px] px-4 py-3 text-[13px] text-fg-2">
                    {a.action === 'update' ? (
                      <>
                        <span className="line-through opacity-70">{short(a.old_value)}</span> →{' '}
                        <span className="text-fg">{short(a.new_value)}</span>
                      </>
                    ) : (
                      short((a.new_value ?? a.old_value) as unknown)
                    )}
                  </td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-fg-3">
                    Nenhum registro no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Notifications() {
  const [status, setStatus] = React.useState('')
  const [channel, setChannel] = React.useState('')
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications-log', status, channel],
    queryFn: async () => {
      let q = supabase.from('notifications_log').select('*, quote_requests(code)').order('created_at', { ascending: false }).limit(500)
      if (status) q = q.eq('status', status)
      if (channel) q = q.eq('channel', channel)
      return unwrap(await q) as (NotificationLog & { quote_requests: { code: string } | null })[]
    },
  })
  const [retrying, setRetrying] = React.useState<string | null>(null)
  const RETRYABLE = [
    'pagamento_confirmado',
    'compra_atualizada',
    'lembrete_pagamento',
    'lembrete_resposta',
    'cotacao_pronta',
    'pedido_recebido',
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          className="h-9 rounded-[10px] bg-surface text-[15px]"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          aria-label="Canal"
        >
          <option value="">Todos os canais</option>
          <option value="email">E-mail</option>
          <option value="whatsapp">WhatsApp</option>
        </NativeSelect>
        <NativeSelect
          className="h-9 rounded-[10px] bg-surface text-[15px]"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Status"
        >
          <option value="">Todos os status</option>
          <option value="enviado">Enviado</option>
          <option value="falhou">Falhou</option>
          <option value="nao_configurado">Não configurado</option>
        </NativeSelect>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          disabled={!data?.length}
          onClick={() =>
            csvDownload(
              'notificacoes.csv',
              (data ?? []).map((n) => ({
                data: dateTime(n.created_at),
                pedido: n.quote_requests?.code ?? '',
                evento: n.event,
                canal: n.channel,
                destinatario: n.recipient,
                status: n.status,
                erro: n.error ?? '',
              })),
            )
          }
        >
          <Download className="size-4" /> CSV
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface">
          <table className="w-full min-w-[760px] text-left text-[15px]">
            <thead className="border-b border-line text-[13px] uppercase tracking-[0.03em] text-fg-2">
              <tr>
                <th className="h-10 px-4 font-medium">Quando</th>
                <th className="h-10 px-4 font-medium">Pedido</th>
                <th className="h-10 px-4 font-medium">Mensagem</th>
                <th className="h-10 px-4 font-medium">Destinatário</th>
                <th className="h-10 px-4 font-medium">Status</th>
                <th className="h-10 px-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(data ?? []).map((n) => (
                <tr key={n.id} className="h-12">
                  <td className="whitespace-nowrap px-4 text-fg-2 tabular">{dateTime(n.created_at)}</td>
                  <td className="px-4 tabular">{n.quote_requests?.code ?? '—'}</td>
                  <td className="px-4">
                    {n.channel === 'email' ? 'E-mail' : 'WhatsApp'} · {EVENTS.find((e) => e.key === n.event)?.label ?? n.event}
                  </td>
                  <td className="max-w-[200px] truncate px-4 text-fg-2">{n.recipient}</td>
                  <td className="px-4" title={n.error ?? undefined}>
                    <Badge tone={n.status === 'enviado' ? 'green' : n.status === 'falhou' ? 'red' : 'gray'}>
                      {n.status === 'nao_configurado' ? 'Não configurado' : n.status === 'enviado' ? 'Enviado' : 'Falhou'}
                    </Badge>
                  </td>
                  <td className="px-4 text-right">
                    {n.status !== 'enviado' && n.request_id && RETRYABLE.includes(n.event) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={retrying === n.id}
                        onClick={async () => {
                          setRetrying(n.id)
                          try {
                            await invoke('notify-customer', {
                              log_id: n.id,
                              event: n.event,
                              channels: { email: n.channel === 'email', whatsapp: n.channel === 'whatsapp' },
                            })
                            toast.success('Reenviado')
                            void refetch()
                          } catch (e) {
                            toast.error(errorMessage(e))
                          } finally {
                            setRetrying(null)
                          }
                        }}
                      >
                        <RotateCw className="size-4" /> Reenviar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-fg-3">
                    Nenhuma mensagem registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
