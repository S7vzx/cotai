import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox, Segmented, Switch } from '@/components/ui/controls'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Group, Row } from '@/components/ui/group'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/shared/badges'
import { MoneyInput } from '@/components/shared/inputs'
import { useCatalog, useCatalogMutations } from '@/features/catalog/api'
import { previewFee, validateTiers } from '@/lib/fee'
import { date, money } from '@/lib/format'
import { supabase, unwrap } from '@/lib/supabase'
import { errorMessage } from '@/lib/utils'
import type { Coupon, Customer, FeeModel, FeeTier } from '@/types/domain'
import { SaveBar, SectionShell, useSettingsDraft } from './shared'

const KEYS = [
  'charge_enabled',
  'fee_model',
  'fee_fixed',
  'fee_per_item',
  'fee_per_item_max',
  'fee_tiers',
  'charge_moment',
  'deduct_fee_on_purchase',
  'show_fee_on_landing',
  'payment_methods',
  'pix_key',
  'pix_key_type',
  'pix_receiver_name',
  'pix_instructions',
  'payment_deadline_hours',
] as const

export default function AdminCobranca() {
  const { draft, set, dirty, save, reset, saving, isLoading, error, refetch } = useSettingsDraft(KEYS)
  const [previewN, setPreviewN] = React.useState(3)

  return (
    <SectionShell
      title="Cobrança"
      description="Defina se e quanto o cliente paga para receber uma cotação."
      loading={isLoading || !draft}
      error={error}
      onRetry={() => refetch()}
    >
      {draft && (
        <>
          <Group footer="Desligada, o pedido entra direto na fila, sem etapa de pagamento, e o site não fala em valores.">
            <Row label="Cobrar taxa de cotação">
              <Switch checked={draft.charge_enabled} onCheckedChange={(v) => set('charge_enabled', v)} />
            </Row>
          </Group>

          {draft.charge_enabled && (
            <>
              <Group title="Valor">
                <Row label="Modelo" stacked>
                  <Segmented<FeeModel>
                    className="w-full"
                    value={draft.fee_model}
                    onChange={(v) => set('fee_model', v)}
                    options={[
                      { value: 'fixo_pedido', label: 'Fixo por pedido' },
                      { value: 'por_produto', label: 'Por produto' },
                      { value: 'faixas', label: 'Faixas' },
                    ]}
                  />
                </Row>
                {draft.fee_model === 'fixo_pedido' && (
                  <Row label="Valor da taxa" stacked>
                    <MoneyInput value={draft.fee_fixed} onValueChange={(v) => set('fee_fixed', v)} />
                  </Row>
                )}
                {draft.fee_model === 'por_produto' && (
                  <>
                    <Row label="Valor por produto" stacked>
                      <MoneyInput value={draft.fee_per_item} onValueChange={(v) => set('fee_per_item', v)} />
                    </Row>
                    <Row label="Valor máximo por pedido" description="Opcional. Vazio = sem limite" stacked>
                      <MoneyInput value={draft.fee_per_item_max ?? 0} onValueChange={(v) => set('fee_per_item_max', v > 0 ? v : null)} />
                    </Row>
                  </>
                )}
                {draft.fee_model === 'faixas' && (
                  <Row label="Faixas por quantidade de produtos" stacked>
                    <TiersEditor tiers={draft.fee_tiers} onChange={(t) => set('fee_tiers', t)} />
                  </Row>
                )}
                <Row label="Simular" description="Quanto um pedido custaria" stacked>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={1}
                      value={previewN}
                      onChange={(e) => setPreviewN(Math.max(1, Number(e.target.value) || 1))}
                      className="w-24 tabular"
                    />
                    <span className="text-[15px] text-fg-2">
                      {previewN === 1 ? 'produto' : 'produtos'} →{' '}
                      <b className="text-fg tabular">
                        {money(
                          previewFee(
                            {
                              enabled: true,
                              model: draft.fee_model,
                              fixed: draft.fee_fixed,
                              per_item: draft.fee_per_item,
                              per_item_max: draft.fee_per_item_max,
                              tiers: draft.fee_tiers,
                            },
                            previewN,
                          ),
                        )}
                      </b>
                    </span>
                  </div>
                </Row>
              </Group>

              <Group title="Regras">
                <Row
                  label="Quando cobrar"
                  stacked
                  description={
                    draft.charge_moment === 'antes'
                      ? 'O pedido só entra na fila depois de pago.'
                      : 'O cliente paga para ver a cotação pronta.'
                  }
                >
                  <Segmented
                    className="w-full"
                    value={draft.charge_moment}
                    onChange={(v) => set('charge_moment', v)}
                    options={[
                      { value: 'antes', label: 'Antes de cotar' },
                      { value: 'depois', label: 'Depois de cotar' },
                    ]}
                  />
                </Row>
                <Row label="Abater a taxa na compra" description="Se o cliente aprovar, o valor pago sai do total">
                  <Switch checked={draft.deduct_fee_on_purchase} onCheckedChange={(v) => set('deduct_fee_on_purchase', v)} />
                </Row>
                <Row label="Mostrar o valor na landing">
                  <Switch checked={draft.show_fee_on_landing} onCheckedChange={(v) => set('show_fee_on_landing', v)} />
                </Row>
                <Row label="Prazo para pagamento" description="Depois disso o pedido é cancelado" stacked>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      className="w-28 tabular"
                      value={draft.payment_deadline_hours}
                      onChange={(e) => set('payment_deadline_hours', Math.max(1, Number(e.target.value) || 1))}
                    />
                    <span className="text-fg-2">horas</span>
                  </div>
                </Row>
              </Group>

              <Group
                title="Formas de pagamento"
                footer="O Pix automático usa o provedor configurado em Integrações. Sem provedor, o cliente vê a chave Pix e a equipe confirma o pagamento no painel."
              >
                {[
                  { k: 'pix_auto', label: 'Pix automático (QR Code)' },
                  { k: 'pix_manual', label: 'Pix manual (chave)' },
                  { k: 'cartao', label: 'Cartão (se o provedor suportar)' },
                ].map((m) => (
                  <Row key={m.k} label={m.label}>
                    <Checkbox
                      checked={draft.payment_methods.includes(m.k)}
                      onCheckedChange={(v) =>
                        set(
                          'payment_methods',
                          v === true ? [...draft.payment_methods, m.k] : draft.payment_methods.filter((x) => x !== m.k),
                        )
                      }
                    />
                  </Row>
                ))}
              </Group>

              {draft.payment_methods.includes('pix_manual') && (
                <Group title="Pix manual">
                  <Row label="Chave Pix" stacked>
                    <div className="flex gap-2">
                      <NativeSelect
                        value={draft.pix_key_type ?? ''}
                        onChange={(e) => set('pix_key_type', e.target.value || null)}
                        className="w-36"
                      >
                        <option value="">Tipo</option>
                        <option value="cnpj">CNPJ</option>
                        <option value="email">E-mail</option>
                        <option value="telefone">Telefone</option>
                        <option value="aleatoria">Aleatória</option>
                      </NativeSelect>
                      <Input value={draft.pix_key ?? ''} onChange={(e) => set('pix_key', e.target.value || null)} />
                    </div>
                  </Row>
                  <Row label="Nome do recebedor" stacked>
                    <Input value={draft.pix_receiver_name ?? ''} onChange={(e) => set('pix_receiver_name', e.target.value || null)} />
                  </Row>
                  <Row label="Instrução para o cliente" stacked>
                    <Textarea
                      rows={2}
                      placeholder="Ex.: envie o comprovante no WhatsApp"
                      value={draft.pix_instructions ?? ''}
                      onChange={(e) => set('pix_instructions', e.target.value || null)}
                    />
                  </Row>
                </Group>
              )}

              <Coupons />
              <ExemptCustomers />
            </>
          )}

          <SaveBar
            dirty={dirty}
            saving={saving}
            onReset={reset}
            onSave={() =>
              save((d) => {
                if (!d.charge_enabled) return null
                if (d.fee_model === 'fixo_pedido' && d.fee_fixed <= 0) return 'Informe o valor da taxa'
                if (d.fee_model === 'por_produto' && d.fee_per_item <= 0) return 'Informe o valor por produto'
                if (d.fee_model === 'faixas') return validateTiers(d.fee_tiers)
                if (d.payment_methods.length === 0) return 'Escolha pelo menos uma forma de pagamento'
                if (d.payment_methods.includes('pix_manual') && !d.pix_key) return 'Informe a chave Pix'
                return null
              })
            }
          />
        </>
      )}
    </SectionShell>
  )
}

function TiersEditor({ tiers, onChange }: { tiers: FeeTier[]; onChange: (t: FeeTier[]) => void }) {
  const problem = validateTiers(tiers)
  const upd = (i: number, patch: Partial<FeeTier>) => onChange(tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)))
  return (
    <div className="space-y-2">
      {tiers.map((t, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 text-[15px]">
          <span className="text-fg-2">de</span>
          <Input type="number" min={1} className="w-20 tabular" value={t.from} onChange={(e) => upd(i, { from: Number(e.target.value) })} />
          <span className="text-fg-2">a</span>
          <Input
            type="number"
            min={1}
            className="w-20 tabular"
            placeholder="∞"
            value={t.to ?? ''}
            onChange={(e) => upd(i, { to: e.target.value === '' ? null : Number(e.target.value) })}
          />
          <span className="text-fg-2">produtos =</span>
          <div className="w-36">
            <MoneyInput value={t.amount} onValueChange={(v) => upd(i, { amount: v })} />
          </div>
          <button
            aria-label="Remover faixa"
            className="flex size-8 items-center justify-center text-fg-3 hover:text-[var(--status-red)]"
            onClick={() => onChange(tiers.filter((_, j) => j !== i))}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const last = tiers[tiers.length - 1]
            const from = last ? (last.to ?? last.from) + 1 : 1
            onChange([
              ...tiers.map((t, i) => (i === tiers.length - 1 && t.to == null ? { ...t, to: from - 1 } : t)),
              { from, to: null, amount: last?.amount ?? 0 },
            ])
          }}
        >
          <Plus className="size-4" /> Adicionar faixa
        </Button>
        {problem && <span className="text-[13px] text-[var(--status-orange)]">{problem}</span>}
      </div>
    </div>
  )
}

function Coupons() {
  const { data } = useCatalog('coupons')
  const { upsert, remove } = useCatalogMutations('coupons')
  const [editing, setEditing] = React.useState<Partial<Coupon> | null>(null)

  return (
    <Group
      title="Cupons de desconto"
      action={
        <Button variant="link" size="sm" onClick={() => setEditing({ discount_type: 'percent', value: 10, active: true })}>
          Novo cupom
        </Button>
      }
    >
      {(data ?? []).length === 0 && <Row label={<span className="text-fg-3">Nenhum cupom</span>} />}
      {(data ?? []).map((c) => (
        <Row
          key={c.id}
          onClick={() => setEditing(c)}
          label={
            <span className="flex items-center gap-2">
              <b className="tabular">{c.code}</b>
              {!c.active && <Badge>Inativo</Badge>}
              {c.valid_until && c.valid_until < new Date().toISOString().slice(0, 10) && <Badge tone="orange">Expirado</Badge>}
            </span>
          }
          description={`${c.discount_type === 'percent' ? `${c.value}%` : money(c.value)} de desconto · ${c.used_count}${c.max_uses ? `/${c.max_uses}` : ''} usos${c.valid_until ? ` · até ${date(c.valid_until)}` : ''}`}
        />
      ))}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <DialogContent
            size="sm"
            title={editing.id ? 'Editar cupom' : 'Novo cupom'}
            footer={
              <>
                {editing.id && (
                  <Button
                    variant="danger-ghost"
                    className="sm:mr-auto"
                    onClick={() =>
                      remove.mutate(editing.id!, {
                        onSuccess: () => {
                          toast.success('Cupom removido')
                          setEditing(null)
                        },
                        onError: (e) => toast.error(errorMessage(e)),
                      })
                    }
                  >
                    <Trash2 className="size-4" /> Excluir
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button
                  loading={upsert.isPending}
                  onClick={() => {
                    const code = (editing.code ?? '').trim().toUpperCase()
                    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return toast.error('Código: 3 a 30 letras, números, - ou _')
                    if (!editing.value || editing.value <= 0) return toast.error('Informe o desconto')
                    if (editing.discount_type === 'percent' && editing.value > 100) return toast.error('Máximo de 100%')
                    upsert.mutate(
                      {
                        id: editing.id,
                        code,
                        discount_type: editing.discount_type,
                        value: editing.value,
                        valid_until: editing.valid_until || null,
                        max_uses: editing.max_uses || null,
                        active: editing.active ?? true,
                      },
                      {
                        onSuccess: () => {
                          toast.success('Cupom salvo')
                          setEditing(null)
                        },
                        onError: (e) =>
                          toast.error(/duplicate|unique/i.test(errorMessage(e)) ? 'Já existe um cupom com esse código' : errorMessage(e)),
                      },
                    )
                  }}
                >
                  Salvar
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <Field label="Código">
                <Input
                  className="uppercase"
                  value={editing.code ?? ''}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                />
              </Field>
              <Field label="Tipo de desconto">
                <Segmented
                  className="w-full"
                  value={editing.discount_type ?? 'percent'}
                  onChange={(v) => setEditing({ ...editing, discount_type: v })}
                  options={[
                    { value: 'percent', label: 'Porcentagem' },
                    { value: 'fixed', label: 'Valor fixo' },
                  ]}
                />
              </Field>
              <Field label={editing.discount_type === 'fixed' ? 'Valor' : 'Porcentagem'}>
                {editing.discount_type === 'fixed' ? (
                  <MoneyInput value={editing.value ?? 0} onValueChange={(v) => setEditing({ ...editing, value: v })} />
                ) : (
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={editing.value ?? ''}
                    onChange={(e) => setEditing({ ...editing, value: Number(e.target.value) })}
                  />
                )}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Válido até" hint="Opcional">
                  <Input
                    type="date"
                    value={editing.valid_until ?? ''}
                    onChange={(e) => setEditing({ ...editing, valid_until: e.target.value || null })}
                  />
                </Field>
                <Field label="Limite de usos" hint="Opcional">
                  <Input
                    type="number"
                    min={1}
                    value={editing.max_uses ?? ''}
                    onChange={(e) => setEditing({ ...editing, max_uses: e.target.value ? Number(e.target.value) : null })}
                  />
                </Field>
              </div>
              <label className="flex items-center justify-between">
                <span>Ativo</span>
                <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              </label>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </Group>
  )
}

function ExemptCustomers() {
  const qc = useQueryClient()
  const [q, setQ] = React.useState('')
  const { data: exempt } = useQuery({
    queryKey: ['customers', 'exempt'],
    queryFn: async () => unwrap(await supabase.from('customers').select('*').eq('fee_exempt', true).order('name')) as Customer[],
  })
  const { data: found } = useQuery({
    queryKey: ['customers', 'search', q],
    enabled: q.trim().length >= 2,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('customers')
          .select('*')
          .eq('fee_exempt', false)
          .or(`name.ilike.%${q.trim()}%,company.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%`)
          .limit(5),
      ) as Customer[],
  })
  const toggle = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) =>
      unwrap(await supabase.from('customers').update({ fee_exempt: value }).eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <Group title="Clientes isentos" footer="Novos pedidos desses clientes não pagam taxa.">
      {(exempt ?? []).map((c) => (
        <Row key={c.id} label={c.name} description={c.company}>
          <Switch checked onCheckedChange={() => toggle.mutate({ id: c.id, value: false })} />
        </Row>
      ))}
      <Row label="Isentar cliente" stacked>
        <Input placeholder="Buscar por nome, empresa ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
        {(found ?? []).length > 0 && (
          <ul className="mt-2 divide-y divide-line rounded-xl bg-surface-2">
            {found!.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-[15px]">{c.name}</span>
                  <span className="block truncate text-[13px] text-fg-2">{c.company}</span>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    toggle.mutate({ id: c.id, value: true })
                    setQ('')
                  }}
                >
                  Isentar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Row>
    </Group>
  )
}
