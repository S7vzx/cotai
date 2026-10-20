import { Plus, Trash2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/controls'
import { Group } from '@/components/ui/group'
import { Input } from '@/components/ui/input'
import { SortableList } from '@/components/shared/sortable'
import { useCatalog, useCatalogMutations } from '@/features/catalog/api'
import { errorMessage } from '@/lib/utils'
import type { Category, Unit } from '@/types/domain'
import { SectionShell } from './shared'

/** Campo que salva ao sair (blur) — sem botão "Salvar" para listas simples. */
function InlineInput({
  value,
  onCommit,
  className,
  placeholder,
}: {
  value: string
  onCommit: (v: string) => void
  className?: string
  placeholder?: string
}) {
  const [v, setV] = React.useState(value)
  React.useEffect(() => setV(value), [value])
  return (
    <Input
      className={className}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() && v !== value && onCommit(v.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

export default function AdminCategorias() {
  const cats = useCatalog('categories')
  const catM = useCatalogMutations('categories')
  const units = useCatalog('units')
  const unitM = useCatalogMutations('units')
  const [cList, setCList] = React.useState<Category[]>([])
  const [uList, setUList] = React.useState<Unit[]>([])
  const [newCat, setNewCat] = React.useState('')
  const [newUnit, setNewUnit] = React.useState({ code: '', label: '' })
  React.useEffect(() => setCList(cats.data ?? []), [cats.data])
  React.useEffect(() => setUList(units.data ?? []), [units.data])
  const err = (e: unknown) => {
    const msg = errorMessage(e)
    if (/categories_name_key/.test(msg)) return toast.error('Já existe uma categoria com esse nome')
    toast.error(/duplicate|unique/i.test(msg) ? 'Já existe um item com esse código' : msg)
  }

  return (
    <SectionShell
      title="Categorias e unidades"
      description="Usadas no formulário do cliente e nos filtros do painel. Alterações são salvas na hora."
      loading={cats.isLoading || units.isLoading}
      error={cats.error || units.error}
    >
      <Group title="Categorias de produto" footer="Para pedir a categoria no formulário, ative o campo em Regras de cotação.">
        <div className="p-2">
          <SortableList
            items={cList}
            getId={(c) => c.id}
            onReorder={(next) => {
              setCList(next)
              catM.reorder.mutate(
                next.map((c) => c.id),
                { onError: err },
              )
            }}
            className="space-y-1"
            render={(c) => (
              <div className="flex items-center gap-2 py-1">
                <InlineInput value={c.name} onCommit={(name) => catM.upsert.mutate({ id: c.id, name }, { onError: err })} />
                <Switch
                  checked={c.active}
                  aria-label="Ativa"
                  onCheckedChange={(active) => catM.upsert.mutate({ id: c.id, active }, { onError: err })}
                />
                <button
                  aria-label="Excluir"
                  className="flex size-9 items-center justify-center text-fg-3 hover:text-[var(--status-red)]"
                  onClick={() => catM.remove.mutate(c.id, { onError: err })}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            )}
          />
          <form
            className="mt-2 flex gap-2 px-2 pb-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!newCat.trim()) return
              catM.upsert.mutate({ name: newCat.trim(), position: cList.length }, { onSuccess: () => setNewCat(''), onError: err })
            }}
          >
            <Input placeholder="Nova categoria" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <Button type="submit" variant="secondary">
              <Plus className="size-4" /> Adicionar
            </Button>
          </form>
        </div>
      </Group>

      <Group title="Unidades de medida">
        <div className="p-2">
          <SortableList
            items={uList}
            getId={(u) => u.id}
            onReorder={(next) => {
              setUList(next)
              unitM.reorder.mutate(
                next.map((u) => u.id),
                { onError: err },
              )
            }}
            className="space-y-1"
            render={(u) => (
              <div className="flex items-center gap-2 py-1">
                <InlineInput
                  className="w-24"
                  value={u.code}
                  onCommit={(code) => unitM.upsert.mutate({ id: u.id, code: code.toLowerCase() }, { onError: err })}
                />
                <InlineInput value={u.label} onCommit={(label) => unitM.upsert.mutate({ id: u.id, label }, { onError: err })} />
                <Switch
                  checked={u.active}
                  aria-label="Ativa"
                  onCheckedChange={(active) => unitM.upsert.mutate({ id: u.id, active }, { onError: err })}
                />
                <button
                  aria-label="Excluir"
                  className="flex size-9 items-center justify-center text-fg-3 hover:text-[var(--status-red)]"
                  onClick={() => unitM.remove.mutate(u.id, { onError: err })}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            )}
          />
          <form
            className="mt-2 flex gap-2 px-2 pb-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!newUnit.code.trim() || !newUnit.label.trim()) return toast.error('Informe código e nome')
              unitM.upsert.mutate(
                { code: newUnit.code.trim().toLowerCase(), label: newUnit.label.trim(), position: uList.length },
                { onSuccess: () => setNewUnit({ code: '', label: '' }), onError: err },
              )
            }}
          >
            <Input
              className="w-24"
              placeholder="cód."
              value={newUnit.code}
              onChange={(e) => setNewUnit({ ...newUnit, code: e.target.value })}
            />
            <Input
              placeholder="Nome (ex.: Caixa)"
              value={newUnit.label}
              onChange={(e) => setNewUnit({ ...newUnit, label: e.target.value })}
            />
            <Button type="submit" variant="secondary">
              <Plus className="size-4" />
            </Button>
          </form>
        </div>
      </Group>
    </SectionShell>
  )
}
