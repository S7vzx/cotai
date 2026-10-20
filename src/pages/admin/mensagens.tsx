import { RotateCcw } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/controls'
import { Group, Row } from '@/components/ui/group'
import { Field, Input, Textarea } from '@/components/ui/input'
import { DEFAULT_EMAIL_TEMPLATES, DEFAULT_WHATSAPP_TEMPLATES } from '@/features/settings/defaults'
import { cn } from '@/lib/utils'
import type { NotificationEvent } from '@/types/domain'
import { renderTemplate, TEMPLATE_VARIABLES } from '../../../supabase/functions/_shared/templates'
import { SaveBar, SectionShell, useSettingsDraft } from './shared'

const KEYS = ['email_templates', 'whatsapp_templates', 'notification_toggles', 'reminders_config'] as const

export const EVENTS: { key: NotificationEvent; label: string; internal?: boolean }[] = [
  { key: 'pedido_recebido', label: 'Pedido recebido' },
  { key: 'pagamento_confirmado', label: 'Pagamento confirmado' },
  { key: 'cotacao_pronta', label: 'Cotação pronta' },
  { key: 'nao_encontrado', label: 'Não encontrado' },
  { key: 'aprovacao_recebida', label: 'Aprovação recebida' },
  { key: 'lembrete_pagamento', label: 'Lembrete de pagamento' },
  { key: 'lembrete_resposta', label: 'Lembrete de resposta' },
  { key: 'compra_atualizada', label: 'Status da compra' },
  { key: 'interno_novo_pedido', label: 'Equipe: novo pedido', internal: true },
  { key: 'interno_aprovada', label: 'Equipe: cotação aprovada', internal: true },
  { key: 'interno_recusada', label: 'Equipe: cotação recusada', internal: true },
]

const SAMPLE = {
  nome: 'Ana',
  empresa: 'Loja da Ana',
  codigo: 'COT-000123',
  link: 'https://cotai.com.br/cotacao/abc123',
  total: 'R$ 3.040,00',
  taxa: 'R$ 30,00',
  validade: '27/10/2026',
  prazo: 'em até 48 horas úteis',
  mensagem: 'Encontramos duas opções com entrega em 5 dias.',
}

const VAR_HELP: Record<string, string> = {
  nome: 'Nome do cliente',
  empresa: 'Empresa',
  codigo: 'Código do pedido',
  link: 'Link do pedido ou da cotação',
  total: 'Total da cotação',
  taxa: 'Taxa de cotação',
  validade: 'Validade da cotação',
  prazo: 'Prazo de resposta',
  mensagem: 'Mensagem da equipe',
}

function useInsertAtCursor() {
  const ref = React.useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)
  const insert = (value: string, current: string, set: (v: string) => void) => {
    const el = ref.current
    const token = `{{${value}}}`
    if (!el) return set(current + token)
    const start = el.selectionStart ?? current.length
    const end = el.selectionEnd ?? current.length
    set(current.slice(0, start) + token + current.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }
  return { ref, insert }
}

export default function AdminMensagens() {
  const { draft, set, dirty, save, reset, saving, isLoading, error, refetch } = useSettingsDraft(KEYS)
  const [selected, setSelected] = React.useState<NotificationEvent>('cotacao_pronta')
  const [focus, setFocus] = React.useState<'subject' | 'body' | 'whatsapp'>('body')
  const subject = useInsertAtCursor()
  const body = useInsertAtCursor()
  const wa = useInsertAtCursor()

  if (!draft)
    return (
      <SectionShell title="Mensagens" loading={isLoading} error={error} onRetry={() => refetch()}>
        {null}
      </SectionShell>
    )

  const ev = EVENTS.find((e) => e.key === selected)!
  const email = draft.email_templates[selected] ?? DEFAULT_EMAIL_TEMPLATES[selected]
  const whats = draft.whatsapp_templates[selected] ?? ''
  const toggles = draft.notification_toggles[selected] ?? { email: true, whatsapp: !ev.internal }
  const rc = draft.reminders_config

  const setEmail = (patch: Partial<{ subject: string; body: string }>) =>
    set('email_templates', { ...draft.email_templates, [selected]: { ...email, ...patch } })
  const setWhats = (v: string) => set('whatsapp_templates', { ...draft.whatsapp_templates, [selected]: v })
  const setToggle = (patch: Partial<{ email: boolean; whatsapp: boolean }>) =>
    set('notification_toggles', { ...draft.notification_toggles, [selected]: { ...toggles, ...patch } })

  const insertVar = (v: string) => {
    if (focus === 'subject') subject.insert(v, email.subject, (s) => setEmail({ subject: s }))
    else if (focus === 'whatsapp') wa.insert(v, whats, setWhats)
    else body.insert(v, email.body, (s) => setEmail({ body: s }))
  }

  return (
    <SectionShell wide title="Mensagens" description="O que o cliente e a equipe recebem em cada etapa.">
      <div className="flex flex-col gap-6 xl:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto xl:w-56 xl:flex-col" aria-label="Eventos">
          {EVENTS.map((e) => {
            const t = draft.notification_toggles[e.key]
            const off = t && !t.email && !t.whatsapp
            return (
              <button
                key={e.key}
                onClick={() => setSelected(e.key)}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-2 text-left text-[15px] whitespace-nowrap',
                  selected === e.key ? 'bg-accent font-medium text-on-accent' : 'hover:bg-surface',
                  off && selected !== e.key && 'text-fg-3',
                )}
              >
                {e.label}
              </button>
            )
          })}
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          <Group title="Canais">
            <Row label="E-mail">
              <Switch checked={toggles.email} onCheckedChange={(v) => setToggle({ email: v })} />
            </Row>
            {!ev.internal && (
              <Row label="WhatsApp">
                <Switch checked={toggles.whatsapp} onCheckedChange={(v) => setToggle({ whatsapp: v })} />
              </Row>
            )}
          </Group>

          <div>
            <p className="mb-2 px-1 text-[13px] text-fg-2">Variáveis (clique para inserir no campo selecionado)</p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v}
                  title={VAR_HELP[v]}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertVar(v)}
                  className="rounded-full bg-accent-soft px-2.5 py-1 text-[13px] font-medium text-accent-text hover:brightness-95"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          {toggles.email && (
            <Group
              title="E-mail"
              action={
                <Button variant="link" size="sm" onClick={() => setEmail(DEFAULT_EMAIL_TEMPLATES[selected])}>
                  <RotateCcw className="size-3.5" /> Restaurar padrão
                </Button>
              }
            >
              <div className="space-y-4 p-4">
                <Field label="Assunto">
                  <Input
                    ref={subject.ref as React.Ref<HTMLInputElement>}
                    onFocus={() => setFocus('subject')}
                    value={email.subject}
                    onChange={(e) => setEmail({ subject: e.target.value })}
                  />
                </Field>
                <Field label="Corpo">
                  <Textarea
                    ref={body.ref as React.Ref<HTMLTextAreaElement>}
                    onFocus={() => setFocus('body')}
                    rows={7}
                    value={email.body}
                    onChange={(e) => setEmail({ body: e.target.value })}
                  />
                </Field>
                <div>
                  <p className="mb-2 text-[13px] font-medium text-fg-2">Prévia</p>
                  <div className="rounded-2xl border border-line p-4">
                    <p className="font-semibold">{renderTemplate(email.subject, SAMPLE)}</p>
                    <p className="mt-2 whitespace-pre-line text-[15px] text-fg-2">{renderTemplate(email.body, SAMPLE)}</p>
                  </div>
                </div>
              </div>
            </Group>
          )}

          {!ev.internal && toggles.whatsapp && (
            <Group
              title="WhatsApp"
              action={
                <Button variant="link" size="sm" onClick={() => setWhats(DEFAULT_WHATSAPP_TEMPLATES[selected] ?? '')}>
                  <RotateCcw className="size-3.5" /> Restaurar padrão
                </Button>
              }
              footer="Use *texto* para negrito no WhatsApp."
            >
              <div className="space-y-4 p-4">
                <Textarea
                  ref={wa.ref as React.Ref<HTMLTextAreaElement>}
                  onFocus={() => setFocus('whatsapp')}
                  rows={5}
                  value={whats}
                  onChange={(e) => setWhats(e.target.value)}
                />
                <div className="rounded-2xl bg-[#efeae2] p-4 dark:bg-[#0b141a]">
                  <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[15px] leading-snug text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
                    {renderTemplate(whats, SAMPLE)
                      .split(/(\*[^*]+\*)/)
                      .map((part, i) =>
                        part.startsWith('*') && part.endsWith('*') ? (
                          <b key={i}>{part.slice(1, -1)}</b>
                        ) : (
                          <span key={i} className="whitespace-pre-line">
                            {part}
                          </span>
                        ),
                      )}
                  </div>
                </div>
              </div>
            </Group>
          )}

          <Group title="Lembretes automáticos" footer="Enviados uma vez por pedido, pela tarefa agendada (a cada hora).">
            <Row label="Lembrete de pagamento" description={`Depois de ${rc.payment_reminder_hours} horas sem pagar`}>
              <Switch
                checked={rc.payment_reminder_enabled}
                onCheckedChange={(v) => set('reminders_config', { ...rc, payment_reminder_enabled: v })}
              />
            </Row>
            {rc.payment_reminder_enabled && (
              <Row label="Enviar após (horas)">
                <Input
                  type="number"
                  min={1}
                  className="h-9 w-24 text-right tabular"
                  value={rc.payment_reminder_hours}
                  onChange={(e) => set('reminders_config', { ...rc, payment_reminder_hours: Math.max(1, Number(e.target.value) || 1) })}
                />
              </Row>
            )}
            <Row label="Lembrete de cotação sem resposta" description={`Depois de ${rc.response_reminder_days} dias`}>
              <Switch
                checked={rc.response_reminder_enabled}
                onCheckedChange={(v) => set('reminders_config', { ...rc, response_reminder_enabled: v })}
              />
            </Row>
            {rc.response_reminder_enabled && (
              <Row label="Enviar após (dias)">
                <Input
                  type="number"
                  min={1}
                  className="h-9 w-24 text-right tabular"
                  value={rc.response_reminder_days}
                  onChange={(e) => set('reminders_config', { ...rc, response_reminder_days: Math.max(1, Number(e.target.value) || 1) })}
                />
              </Row>
            )}
          </Group>
        </div>
      </div>
      <SaveBar dirty={dirty} saving={saving} onReset={reset} onSave={() => save()} />
    </SectionShell>
  )
}
