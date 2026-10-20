import * as React from 'react'
import { useBlocker } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/controls'
import { ConfirmDialog } from '@/components/ui/dialog'
import { ErrorState } from '@/components/shared/states'
import { useSettings, useUpdateSettings } from '@/features/settings/api'
import { errorMessage } from '@/lib/utils'
import type { Settings } from '@/types/domain'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Rascunho local de um subconjunto das configurações, com detecção de
 * alterações, salvar e aviso ao sair sem salvar.
 */
export function useSettingsDraft<K extends keyof Settings>(keys: readonly K[]) {
  const { data, isLoading, error, refetch } = useSettings()
  const update = useUpdateSettings()
  const [draft, setDraft] = React.useState<Pick<Settings, K> | null>(null)

  const pick = React.useCallback(
    (s: Settings) => Object.fromEntries(keys.map((k) => [k, structuredClone(s[k])])) as Pick<Settings, K>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keys.join(',')],
  )

  const original = data ? pick(data) : null
  const dirty = !!draft && !!original && !same(draft, original)
  const dirtyRef = React.useRef(dirty)
  dirtyRef.current = dirty

  // Atualiza o rascunho quando os dados chegam (ou mudam em outra aba),
  // mas nunca por cima de uma edição em andamento.
  React.useEffect(() => {
    if (data && !dirtyRef.current) setDraft(pick(data))
  }, [data, pick])

  const set = <F extends K>(field: F, value: Settings[F]) => setDraft((d) => (d ? { ...d, [field]: value } : d))

  async function save(validate?: (d: Pick<Settings, K>) => string | null) {
    if (!draft) return
    const problem = validate?.(draft)
    if (problem) return void toast.error(problem)
    const patch = Object.fromEntries(keys.filter((k) => !same(draft[k], original?.[k])).map((k) => [k, draft[k]])) as Partial<Settings>
    try {
      const saved = await update.mutateAsync(patch)
      setDraft(pick(saved))
      toast.success('Alterações salvas')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const reset = () => original && setDraft(original)

  return { draft, set, setDraft, dirty, save, reset, saving: update.isPending, isLoading, error, refetch, settings: data }
}

/** Barra fixa "Salvar" + bloqueio de navegação com alterações pendentes. */
export function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)

  React.useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  return (
    <>
      <div className="h-20" />
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-chrome pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:left-[232px]">
        <div className="mx-auto flex max-w-[1100px] items-center justify-end gap-2 px-4 py-3 sm:px-6">
          {dirty && <span className="mr-auto text-[13px] text-fg-2">Alterações não salvas</span>}
          {dirty && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              Descartar
            </Button>
          )}
          <Button size="sm" className="h-9 px-5 text-[15px]" onClick={onSave} disabled={!dirty} loading={saving}>
            Salvar
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => !o && blocker.reset?.()}
        title="Descartar alterações?"
        description="Você tem alterações que ainda não foram salvas."
        confirmLabel="Descartar"
        destructive
        onConfirm={() => {
          onReset()
          blocker.proceed?.()
        }}
      />
    </>
  )
}

export function SectionShell({
  title,
  description,
  children,
  loading,
  error,
  onRetry,
  wide,
}: {
  wide?: boolean
  title: string
  description?: string
  children: React.ReactNode
  loading?: boolean
  error?: unknown
  onRetry?: () => void
}) {
  return (
    <div className={wide ? 'mx-auto max-w-[1100px]' : 'mx-auto max-w-[720px]'}>
      <h1 className="text-[28px] font-semibold leading-tight">{title}</h1>
      {description && <p className="mt-1 text-[15px] text-fg-2">{description}</p>}
      <div className="mt-6 space-y-8">
        {error ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : loading ? (
          <>
            <Skeleton className="h-40 rounded-[14px]" />
            <Skeleton className="h-56 rounded-[14px]" />
          </>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
