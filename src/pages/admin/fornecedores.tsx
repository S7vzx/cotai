import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, Truck } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/controls'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Field, Input, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/shared/badges'
import { PhoneInput } from '@/components/shared/inputs'
import { EmptyState } from '@/components/shared/states'
import { useCatalog, useCatalogMutations } from '@/features/catalog/api'
import { phone, toE164 } from '@/lib/format'
import { maskPhone } from '@/lib/masks'
import { supabase, unwrap } from '@/lib/supabase'
import { cn, errorMessage } from '@/lib/utils'
import type { Supplier } from '@/types/domain'
import { SectionShell } from './shared'

export default function AdminFornecedores() {
  const { data, isLoading, error, refetch } = useCatalog('suppliers')
  const { data: categories } = useCatalog('categories')
  const { upsert, remove } = useCatalogMutations('suppliers')
  const [q, setQ] = React.useState('')
  const [editing, setEditing] = React.useState<(Partial<Supplier> & { whatsappMask?: string }) | null>(null)

  // uso de cada fornecedor em cotações e compras
  const { data: usage } = useQuery({
    queryKey: ['supplier-usage'],
    queryFn: async () => {
      const rows = unwrap(await supabase.from('quote_options').select('supplier_id, selected_by_customer')) as {
        supplier_id: string | null
        selected_by_customer: boolean
      }[]
      const map = new Map<string, { quotes: number; purchases: number }>()
      for (const r of rows) {
        if (!r.supplier_id) continue
        const u = map.get(r.supplier_id) ?? { quotes: 0, purchases: 0 }
        u.quotes++
        if (r.selected_by_customer) u.purchases++
        map.set(r.supplier_id, u)
      }
      return map
    },
  })

  const term = q.trim().toLowerCase()
  const rows = (data ?? []).filter((s) => !term || [s.name, s.contact_name, s.email].some((v) => v?.toLowerCase().includes(term)))
  const err = (e: unknown) =>
    toast.error(/duplicate|unique/i.test(errorMessage(e)) ? 'Já existe um fornecedor com esse nome' : errorMessage(e))

  return (
    <SectionShell
      title="Fornecedores"
      description="Aparecem no autocompletar ao montar uma cotação. Nomes novos usados nas cotações entram aqui automaticamente."
      loading={isLoading}
      error={error}
      onRetry={() => refetch()}
      wide
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          className="h-9 w-full rounded-[10px] bg-surface text-[15px] sm:w-72"
          placeholder="Buscar fornecedor"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button size="sm" className="h-9 px-4 text-[15px]" onClick={() => setEditing({ active: true, category_ids: [] })}>
          <Plus className="size-4" /> Novo fornecedor
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Truck} title={term ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor ainda'} />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface">
          <table className="w-full min-w-[640px] text-left text-[15px]">
            <thead className="border-b border-line text-[13px] uppercase tracking-[0.03em] text-fg-2">
              <tr>
                <th className="h-10 px-4 font-medium">Fornecedor</th>
                <th className="h-10 px-4 font-medium">Contato</th>
                <th className="h-10 px-4 text-right font-medium">Cotações</th>
                <th className="h-10 px-4 text-right font-medium">Compras</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => {
                const u = usage?.get(s.id)
                return (
                  <tr
                    key={s.id}
                    className={cn('h-[52px] cursor-pointer hover:bg-surface-2/60', !s.active && 'text-fg-3')}
                    onClick={() => setEditing({ ...s, whatsappMask: s.whatsapp ? maskPhone(s.whatsapp.replace(/^\+55/, '')) : '' })}
                  >
                    <td className="px-4">
                      <span className="flex items-center gap-2 font-medium">
                        {s.name} {!s.active && <Badge>Inativo</Badge>}
                      </span>
                      {s.category_ids.length > 0 && (
                        <span className="block text-[13px] text-fg-2">
                          {s.category_ids
                            .map((id) => categories?.find((c) => c.id === id)?.name)
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 text-fg-2">
                      {[s.contact_name, s.whatsapp ? phone(s.whatsapp) : null, s.email].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 text-right tabular">{u?.quotes ?? 0}</td>
                    <td className="px-4 text-right tabular">{u?.purchases ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <DialogContent
            title={editing.id ? editing.name : 'Novo fornecedor'}
            footer={
              <>
                {editing.id && (
                  <Button
                    variant="danger-ghost"
                    className="sm:mr-auto"
                    onClick={() => remove.mutate(editing.id!, { onSuccess: () => setEditing(null), onError: err })}
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
                    if (!editing.name?.trim()) return toast.error('Informe o nome')
                    const wa = editing.whatsappMask ? toE164(editing.whatsappMask) : null
                    if (editing.whatsappMask && !wa) return toast.error('WhatsApp inválido')
                    upsert.mutate(
                      {
                        id: editing.id,
                        name: editing.name.trim(),
                        contact_name: editing.contact_name || null,
                        whatsapp: wa,
                        email: editing.email || null,
                        website: editing.website || null,
                        category_ids: editing.category_ids ?? [],
                        notes: editing.notes || null,
                        active: editing.active ?? true,
                      },
                      {
                        onSuccess: () => {
                          toast.success('Fornecedor salvo')
                          setEditing(null)
                        },
                        onError: err,
                      },
                    )
                  }}
                >
                  Salvar
                </Button>
              </>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" className="sm:col-span-2">
                <Input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Field>
              <Field label="Contato">
                <Input value={editing.contact_name ?? ''} onChange={(e) => setEditing({ ...editing, contact_name: e.target.value })} />
              </Field>
              <Field label="WhatsApp">
                <PhoneInput value={editing.whatsappMask ?? ''} onValueChange={(v) => setEditing({ ...editing, whatsappMask: v })} />
              </Field>
              <Field label="E-mail">
                <Input type="email" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </Field>
              <Field label="Site">
                <Input
                  type="url"
                  placeholder="https://"
                  value={editing.website ?? ''}
                  onChange={(e) => setEditing({ ...editing, website: e.target.value })}
                />
              </Field>
              {(categories ?? []).length > 0 && (
                <Field label="Categorias atendidas" className="sm:col-span-2">
                  <div className="flex flex-wrap gap-2">
                    {categories!.map((c) => {
                      const on = editing.category_ids?.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setEditing({
                              ...editing,
                              category_ids: on ? editing.category_ids!.filter((x) => x !== c.id) : [...(editing.category_ids ?? []), c.id],
                            })
                          }
                          className={cn('rounded-full px-3 py-1 text-[14px]', on ? 'bg-accent text-on-accent' : 'bg-surface-2')}
                        >
                          {c.name}
                        </button>
                      )
                    })}
                  </div>
                </Field>
              )}
              <Field label="Observações" className="sm:col-span-2">
                <Textarea value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </Field>
              <label className="flex items-center justify-between sm:col-span-2">
                <span>Ativo</span>
                <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              </label>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </SectionShell>
  )
}
