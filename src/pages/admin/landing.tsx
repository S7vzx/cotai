import { ExternalLink, ImageUp, Plus, Trash2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/controls'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Group, Row } from '@/components/ui/group'
import { Field, Input, Textarea } from '@/components/ui/input'
import { SortableList } from '@/components/shared/sortable'
import { useCatalog, useCatalogMutations } from '@/features/catalog/api'
import { publicUrl, supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/utils'
import type { FaqItem, LandingContent } from '@/types/domain'
import { SaveBar, SectionShell, useSettingsDraft } from './shared'

const KEYS = ['landing_content', 'seo_title', 'seo_description', 'og_image_path'] as const

// chaves estáveis para reordenar itens sem id
const withKeys = <T,>(arr: T[]) => arr.map((v, i) => ({ ...v, _k: `${i}-${Math.random().toString(36).slice(2, 7)}` }))

export default function AdminLanding() {
  const { draft, set, dirty, save, reset, saving, isLoading, error, refetch } = useSettingsDraft(KEYS)
  const lc = draft?.landing_content
  const [steps, setSteps] = React.useState<(LandingContent['steps'][number] & { _k: string })[]>([])
  const [benefits, setBenefits] = React.useState<(LandingContent['benefits'][number] & { _k: string })[]>([])

  React.useEffect(() => {
    if (lc) {
      setSteps(withKeys(lc.steps ?? []))
      setBenefits(withKeys(lc.benefits ?? []))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(lc?.steps), JSON.stringify(lc?.benefits)])

  const setLc = (patch: Partial<LandingContent>) => lc && set('landing_content', { ...lc, ...patch })
  const strip = <T extends { _k: string }>(arr: T[]) => arr.map(({ _k, ...rest }) => rest)

  return (
    <SectionShell
      title="Landing page"
      description="Por enquanto, os textos e as perguntas da página inicial estão fixos no código, para o site abrir sem esperar o banco. As mudanças nesta tela só valem para o título e a descrição de SEO e a imagem de compartilhamento."
      loading={isLoading || !draft}
      error={error}
      onRetry={() => refetch()}
    >
      {draft && lc && (
        <>
          <div className="-mt-4">
            <Button asChild variant="secondary" size="sm">
              <a href="/" target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Ver site
              </a>
            </Button>
          </div>

          <Group title="Topo (hero)">
            <Row label="Título" stacked>
              <Input value={lc.hero.title} onChange={(e) => setLc({ hero: { ...lc.hero, title: e.target.value } })} />
            </Row>
            <Row label="Subtítulo" stacked>
              <Textarea rows={2} value={lc.hero.subtitle} onChange={(e) => setLc({ hero: { ...lc.hero, subtitle: e.target.value } })} />
            </Row>
            <Row label="Botão principal" stacked>
              <Input value={lc.hero.cta_primary} onChange={(e) => setLc({ hero: { ...lc.hero, cta_primary: e.target.value } })} />
            </Row>
            <Row label="Link secundário" stacked>
              <Input value={lc.hero.cta_secondary} onChange={(e) => setLc({ hero: { ...lc.hero, cta_secondary: e.target.value } })} />
            </Row>
          </Group>

          <Group title="Como funciona" footer="Arraste para reordenar. Passos marcados como “pagamento” só aparecem com a cobrança ativa.">
            <div className="p-2">
              <SortableList
                items={steps}
                getId={(s) => s._k}
                onReorder={(next) => {
                  setSteps(next)
                  setLc({ steps: strip(next) })
                }}
                className="space-y-2"
                render={(s, i) => (
                  <div className="space-y-2 rounded-xl border border-line p-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-[15px] font-semibold text-fg-3 tabular">{i + 1}</span>
                      <Input
                        value={s.title}
                        onChange={(e) => {
                          const next = steps.map((x) => (x._k === s._k ? { ...x, title: e.target.value } : x))
                          setSteps(next)
                          setLc({ steps: strip(next) })
                        }}
                      />
                      <Switch
                        checked={s.active}
                        aria-label="Ativo"
                        onCheckedChange={(v) => {
                          const next = steps.map((x) => (x._k === s._k ? { ...x, active: v } : x))
                          setSteps(next)
                          setLc({ steps: strip(next) })
                        }}
                      />
                    </div>
                    <Textarea
                      rows={2}
                      value={s.text}
                      onChange={(e) => {
                        const next = steps.map((x) => (x._k === s._k ? { ...x, text: e.target.value } : x))
                        setSteps(next)
                        setLc({ steps: strip(next) })
                      }}
                    />
                    {s.payment && <p className="text-[13px] text-fg-3">Passo de pagamento</p>}
                  </div>
                )}
              />
            </div>
          </Group>

          <Group
            title="Vantagens"
            action={
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  const next = [...benefits, ...withKeys([{ title: 'Nova vantagem', text: '' }])]
                  setBenefits(next)
                  setLc({ benefits: strip(next) })
                }}
              >
                <Plus className="size-4" /> Adicionar
              </Button>
            }
          >
            <div className="p-2">
              <SortableList
                items={benefits}
                getId={(b) => b._k}
                onReorder={(next) => {
                  setBenefits(next)
                  setLc({ benefits: strip(next) })
                }}
                className="space-y-2"
                render={(b) => (
                  <div className="space-y-2 rounded-xl border border-line p-3">
                    <div className="flex gap-2">
                      <Input
                        value={b.title}
                        onChange={(e) => {
                          const next = benefits.map((x) => (x._k === b._k ? { ...x, title: e.target.value } : x))
                          setBenefits(next)
                          setLc({ benefits: strip(next) })
                        }}
                      />
                      <button
                        className="flex size-11 shrink-0 items-center justify-center rounded-xl text-fg-3 hover:text-[var(--status-red)]"
                        aria-label="Remover vantagem"
                        onClick={() => {
                          const next = benefits.filter((x) => x._k !== b._k)
                          setBenefits(next)
                          setLc({ benefits: strip(next) })
                        }}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <Textarea
                      rows={2}
                      value={b.text}
                      onChange={(e) => {
                        const next = benefits.map((x) => (x._k === b._k ? { ...x, text: e.target.value } : x))
                        setBenefits(next)
                        setLc({ benefits: strip(next) })
                      }}
                    />
                  </div>
                )}
              />
            </div>
          </Group>

          <Group title="Chamada final">
            <Row label="Título" stacked>
              <Input value={lc.cta_final.title} onChange={(e) => setLc({ cta_final: { ...lc.cta_final, title: e.target.value } })} />
            </Row>
            <Row label="Texto" stacked>
              <Input value={lc.cta_final.text} onChange={(e) => setLc({ cta_final: { ...lc.cta_final, text: e.target.value } })} />
            </Row>
            <Row label="Botão" stacked>
              <Input value={lc.cta_final.button} onChange={(e) => setLc({ cta_final: { ...lc.cta_final, button: e.target.value } })} />
            </Row>
          </Group>

          <Group title="SEO e compartilhamento" footer="A imagem aparece quando alguém compartilha o link no WhatsApp (1200 × 630 px).">
            <Row label="Título da página" stacked>
              <Input value={draft.seo_title ?? ''} onChange={(e) => set('seo_title', e.target.value || null)} />
            </Row>
            <Row label="Descrição" stacked>
              <Textarea rows={2} value={draft.seo_description ?? ''} onChange={(e) => set('seo_description', e.target.value || null)} />
            </Row>
            <Row label="Imagem de compartilhamento">
              <div className="flex items-center gap-2">
                {draft.og_image_path && (
                  <img src={publicUrl('branding', draft.og_image_path)!} alt="" className="h-10 rounded-md object-cover" />
                )}
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[14px] font-medium">
                  <ImageUp className="size-4" /> Enviar
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (!f) return
                      const p = `og/og-${Date.now()}.${f.name.split('.').pop()}`
                      const { error: err } = await supabase.storage.from('branding').upload(p, f, { contentType: f.type })
                      if (err) return toast.error(errorMessage(err))
                      set('og_image_path', p)
                    }}
                  />
                </label>
              </div>
            </Row>
          </Group>

          <FaqEditor />

          <SaveBar
            dirty={dirty}
            saving={saving}
            onReset={reset}
            onSave={() => save((d) => (!d.landing_content.hero.title.trim() ? 'O título do topo não pode ficar vazio' : null))}
          />
        </>
      )}
    </SectionShell>
  )
}

function FaqEditor() {
  const { data } = useCatalog('faq_items')
  const { upsert, remove, reorder } = useCatalogMutations('faq_items')
  const [items, setItems] = React.useState<FaqItem[]>([])
  const [editing, setEditing] = React.useState<Partial<FaqItem> | null>(null)
  React.useEffect(() => setItems(data ?? []), [data])

  return (
    <Group
      title="Perguntas frequentes"
      footer="Salvas na hora. Arraste para reordenar."
      action={
        <Button variant="link" size="sm" onClick={() => setEditing({ question: '', answer: '', active: true })}>
          <Plus className="size-4" /> Adicionar
        </Button>
      }
    >
      <div className="p-2">
        <SortableList
          items={items}
          getId={(f) => f.id}
          onReorder={(next) => {
            setItems(next)
            reorder.mutate(
              next.map((f) => f.id),
              { onError: (e) => toast.error(errorMessage(e)) },
            )
          }}
          className="space-y-1"
          render={(f) => (
            <button className="w-full rounded-xl px-2 py-2.5 text-left hover:bg-surface-2" onClick={() => setEditing(f)}>
              <span className={f.active ? 'text-[15px] font-medium' : 'text-[15px] font-medium text-fg-3 line-through'}>{f.question}</span>
              <span className="mt-0.5 line-clamp-1 block text-[13px] text-fg-2">{f.answer}</span>
            </button>
          )}
        />
        {items.length === 0 && <p className="px-2 py-3 text-[15px] text-fg-3">Nenhuma pergunta.</p>}
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <DialogContent
            title={editing.id ? 'Editar pergunta' : 'Nova pergunta'}
            footer={
              <>
                {editing.id && (
                  <Button
                    variant="danger-ghost"
                    className="sm:mr-auto"
                    onClick={() => remove.mutate(editing.id!, { onSuccess: () => setEditing(null) })}
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
                    if (!editing.question?.trim() || !editing.answer?.trim()) return toast.error('Preencha pergunta e resposta')
                    upsert.mutate(
                      {
                        id: editing.id,
                        question: editing.question.trim(),
                        answer: editing.answer.trim(),
                        active: editing.active ?? true,
                        ...(editing.id ? {} : { position: items.length }),
                      },
                      {
                        onSuccess: () => {
                          toast.success('Pergunta salva')
                          setEditing(null)
                        },
                        onError: (e) => toast.error(errorMessage(e)),
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
              <Field label="Pergunta">
                <Input value={editing.question ?? ''} onChange={(e) => setEditing({ ...editing, question: e.target.value })} />
              </Field>
              <Field label="Resposta">
                <Textarea rows={5} value={editing.answer ?? ''} onChange={(e) => setEditing({ ...editing, answer: e.target.value })} />
              </Field>
              <label className="flex items-center justify-between">
                <span>Visível no site</span>
                <Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} />
              </label>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </Group>
  )
}
