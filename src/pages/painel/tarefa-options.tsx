import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/controls'
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input'
import { MoneyInput } from '@/components/shared/inputs'
import { Comparison } from '@/pages/public/cotacao'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OptionOrigin, ProductCondition, QuoteItem, QuoteOption, Supplier } from '@/types/domain'
import { OPTION_ORIGINS, PRODUCT_CONDITIONS } from '../../../supabase/functions/_shared/validation'

export interface OptionDraft {
  id?: string
  key: string
  label: string
  supplier_name: string
  supplier_contact: string
  cost_price: number
  sale_price: number
  lead_time_days: number | null
  payment_terms: string
  freight_included: boolean
  freight_value: number
  customer_notes: string
  internal_notes: string
  condition: ProductCondition | ''
  origin: OptionOrigin | ''
}

export const LABELS = 'ABCDEFGHIJ'.split('')

export function toDraft(o: QuoteOption): OptionDraft {
  return {
    id: o.id,
    key: o.id,
    label: o.label,
    supplier_name: o.supplier_name ?? '',
    supplier_contact: o.supplier_contact ?? '',
    cost_price: Number(o.cost_price ?? 0),
    sale_price: Number(o.sale_price ?? 0),
    lead_time_days: o.lead_time_days,
    payment_terms: o.payment_terms ?? '',
    freight_included: o.freight_included,
    freight_value: Number(o.freight_value ?? 0),
    customer_notes: o.customer_notes ?? '',
    internal_notes: o.internal_notes ?? '',
    condition: o.condition ?? '',
    origin: o.origin ?? '',
  }
}

export function emptyDraft(label: string): OptionDraft {
  return {
    key: crypto.randomUUID(),
    label,
    supplier_name: '',
    supplier_contact: '',
    cost_price: 0,
    sale_price: 0,
    lead_time_days: null,
    payment_terms: '',
    freight_included: true,
    freight_value: 0,
    customer_notes: '',
    internal_notes: '',
    condition: '',
    origin: '',
  }
}

interface Props {
  item: QuoteItem
  drafts: OptionDraft[]
  notFound: boolean
  onChange: (drafts: OptionDraft[]) => void
  onNotFound: (v: boolean) => void
  maxOptions: number
  minMargin: number
  showCosts: boolean
  readOnly: boolean
  suppliers: Supplier[]
}

export function ItemOptionsEditor({
  item,
  drafts,
  notFound,
  onChange,
  onNotFound,
  maxOptions,
  minMargin,
  showCosts,
  readOnly,
  suppliers,
}: Props) {
  const update = (key: string, patch: Partial<OptionDraft>) => onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  const listId = `suppliers-${item.id}`

  return (
    <div className="rounded-2xl bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[17px] font-semibold">{item.name}</h3>
          <p className="text-[13px] text-fg-2 tabular">
            {item.quantity} {item.unit} · alvo {money(item.target_price)}/un · {money(item.target_price * item.quantity)}
          </p>
          <p className="text-[13px] text-fg-2">Aceita: {item.accepted_conditions.map((c) => PRODUCT_CONDITIONS[c]).join(', ')}</p>
          {item.previous_price != null && (
            <p className="text-[13px] font-medium text-accent-text tabular">Preço na compra anterior: {money(item.previous_price)}/un</p>
          )}
        </div>
        <label className="flex shrink-0 items-center gap-2 text-[13px] text-fg-2">
          Não encontrado
          <Switch checked={notFound} onCheckedChange={onNotFound} disabled={readOnly} />
        </label>
      </div>

      <datalist id={listId}>
        {suppliers.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>

      {!notFound && (
        <div className="mt-4 space-y-3">
          {drafts.map((d) => {
            const margin = d.sale_price - d.cost_price
            const marginPct = d.sale_price > 0 ? (margin / d.sale_price) * 100 : 0
            const lowMargin = showCosts && d.cost_price > 0 && marginPct < minMargin
            return (
              <fieldset key={d.key} disabled={readOnly} className="rounded-xl border border-line p-4">
                <div className="mb-3 flex items-center justify-between">
                  <legend className="text-[13px] font-semibold uppercase tracking-[0.04em] text-fg-2">Opção {d.label}</legend>
                  <div className="flex items-center gap-2">
                    {d.sale_price > 0 && <Comparison target={item.target_price} found={d.sale_price} />}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => onChange(drafts.filter((x) => x.key !== d.key))}
                        className="flex size-8 items-center justify-center rounded-lg text-fg-3 hover:bg-surface-2 hover:text-[var(--status-red)]"
                        aria-label={`Remover opção ${d.label}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Fornecedor">
                    <Input list={listId} value={d.supplier_name} onChange={(e) => update(d.key, { supplier_name: e.target.value })} />
                  </Field>
                  {showCosts && (
                    <Field label="Contato do fornecedor" hint="Interno">
                      <Input value={d.supplier_contact} onChange={(e) => update(d.key, { supplier_contact: e.target.value })} />
                    </Field>
                  )}
                  {showCosts && (
                    <Field label="Preço de custo (un)" hint="Interno">
                      <MoneyInput value={d.cost_price} onValueChange={(v) => update(d.key, { cost_price: v })} />
                    </Field>
                  )}
                  <Field label="Preço ao cliente (un)">
                    <MoneyInput value={d.sale_price} onValueChange={(v) => update(d.key, { sale_price: v })} />
                  </Field>
                  <Field label="Estado do produto">
                    <NativeSelect
                      value={d.condition}
                      onChange={(e) => update(d.key, { condition: e.target.value as ProductCondition | '' })}
                    >
                      <option value="">Não informado</option>
                      {Object.entries(PRODUCT_CONDITIONS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                          {item.accepted_conditions.includes(value as ProductCondition) ? '' : ' (cliente não pediu)'}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Origem">
                    <NativeSelect value={d.origin} onChange={(e) => update(d.key, { origin: e.target.value as OptionOrigin | '' })}>
                      <option value="">Não informada</option>
                      {Object.entries(OPTION_ORIGINS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Prazo de entrega (dias)">
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={d.lead_time_days ?? ''}
                      onChange={(e) =>
                        update(d.key, { lead_time_days: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })
                      }
                    />
                  </Field>
                  <Field label="Condição de pagamento">
                    <Input
                      placeholder="Ex.: Pix à vista, 30 dias"
                      value={d.payment_terms}
                      onChange={(e) => update(d.key, { payment_terms: e.target.value })}
                    />
                  </Field>
                  <div className="flex items-end gap-3 sm:col-span-2">
                    <label className="flex h-11 items-center gap-2 text-[15px]">
                      <Switch checked={d.freight_included} onCheckedChange={(v) => update(d.key, { freight_included: v })} />
                      Frete incluso
                    </label>
                    {!d.freight_included && (
                      <Field label="Valor do frete" className="flex-1">
                        <MoneyInput value={d.freight_value} onValueChange={(v) => update(d.key, { freight_value: v })} />
                      </Field>
                    )}
                  </div>
                  <Field label="Observações para o cliente" className="sm:col-span-2">
                    <Textarea rows={2} value={d.customer_notes} onChange={(e) => update(d.key, { customer_notes: e.target.value })} />
                  </Field>
                  <Field label="Notas internas" className="sm:col-span-2" hint="Nunca aparecem para o cliente">
                    <Textarea rows={2} value={d.internal_notes} onChange={(e) => update(d.key, { internal_notes: e.target.value })} />
                  </Field>
                </div>

                {showCosts && d.cost_price > 0 && d.sale_price > 0 && (
                  <div
                    className={cn(
                      'mt-3 flex items-center justify-between rounded-lg px-3 py-2 text-[13px] tabular',
                      lowMargin ? 'text-[var(--status-orange)]' : 'text-fg-2',
                    )}
                    style={{ background: lowMargin ? 'color-mix(in srgb, var(--status-orange) 10%, transparent)' : 'var(--surface-2)' }}
                  >
                    <span className="flex items-center gap-1.5">
                      {lowMargin && <AlertTriangle className="size-4" />}
                      Margem {lowMargin && `abaixo de ${minMargin}%`}
                    </span>
                    <span className="font-semibold">
                      {money(margin)}/un · {marginPct.toFixed(1).replace('.', ',')}% · total {money(margin * item.quantity)}
                    </span>
                  </div>
                )}
              </fieldset>
            )
          })}
          {!readOnly && drafts.length < maxOptions && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onChange([...drafts, emptyDraft(LABELS.find((l) => !drafts.some((d) => d.label === l)) ?? 'A')])}
            >
              <Plus className="size-4" /> Adicionar opção
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
