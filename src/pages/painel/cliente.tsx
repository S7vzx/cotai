import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, MessageCircle, SearchX } from 'lucide-react'
import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton, Switch } from '@/components/ui/controls'
import { Field, Input, Textarea } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/badges'
import { DocumentInput, PhoneInput } from '@/components/shared/inputs'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { useAuth } from '@/features/auth/auth'
import { dateTime, money, phone, toE164, waLink } from '@/lib/format'
import { maskPhone } from '@/lib/masks'
import { supabase, unwrap } from '@/lib/supabase'
import { errorMessage } from '@/lib/utils'
import type { CustomerOverview, QuoteRequest } from '@/types/domain'

export default function Cliente() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const { can, isAdmin } = useAuth()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const [c, reqs] = await Promise.all([
        supabase.from('customer_overview').select('*').eq('id', id).maybeSingle(),
        supabase.from('quote_requests').select('*, quote_items(id)').eq('customer_id', id).order('created_at', { ascending: false }),
      ])
      return {
        customer: unwrap(c) as CustomerOverview | null,
        requests: unwrap(reqs) as (QuoteRequest & { quote_items: { id: string }[] })[],
      }
    },
  })
  const [form, setForm] = React.useState({ name: '', company: '', cnpj: '', whatsapp: '', email: '', notes: '' })

  React.useEffect(() => {
    const c = data?.customer
    if (c)
      setForm({
        name: c.name,
        company: c.company,
        cnpj: c.cnpj ?? '',
        whatsapp: c.whatsapp ? maskPhone(c.whatsapp.replace(/^\+55/, '')) : '',
        email: c.email ?? '',
        notes: c.notes ?? '',
      })
  }, [data?.customer])

  const save = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => unwrap(await supabase.from('customers').update(patch).eq('id', id)),
    onSuccess: () => {
      toast.success('Cliente atualizado')
      qc.invalidateQueries({ queryKey: ['customer', id] })
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />
  if (!data?.customer) return <EmptyState icon={SearchX} title="Cliente não encontrado" />
  const c = data.customer
  const editable = can('manage_customers')

  return (
    <div>
      <Link to="/painel/clientes" className="mb-3 inline-flex items-center gap-1 text-[15px] text-accent-text">
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold sm:text-[34px]">{c.name}</h1>
          <p className="text-[15px] text-fg-2">{c.company}</p>
        </div>
        {c.whatsapp && (
          <Button asChild variant="secondary" size="sm">
            <a href={waLink(c.whatsapp)!} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4" /> {phone(c.whatsapp)}
            </a>
          </Button>
        )}
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Pedidos', String(c.request_count)],
          ['Aprovados', String(c.approved_count)],
          ['Total aprovado', money(c.approved_total)],
          ['Taxa de aprovação', c.request_count ? `${Math.round((c.approved_count / c.request_count) * 100)}%` : '—'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-surface p-4">
            <p className="text-[13px] text-fg-2">{k}</p>
            <p className="mt-1 text-[24px] font-semibold tabular">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="space-y-4 rounded-2xl bg-surface p-5">
          <h2 className="text-[13px] font-medium uppercase tracking-[0.04em] text-fg-2">Dados</h2>
          <fieldset disabled={!editable} className="space-y-4">
            <Field label="Nome">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Empresa">
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </Field>
            <Field label="CPF ou CNPJ">
              <DocumentInput value={form.cnpj} onValueChange={(v) => setForm({ ...form, cnpj: v })} />
            </Field>
            <Field label="WhatsApp">
              <PhoneInput value={form.whatsapp} onValueChange={(v) => setForm({ ...form, whatsapp: v })} />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Notas internas">
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </fieldset>
          {isAdmin && (
            <label className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3">
              <span>
                <span className="block text-[15px] font-medium">Isento da taxa de cotação</span>
                <span className="block text-[13px] text-fg-2">Novos pedidos deste cliente não pagam taxa</span>
              </span>
              <Switch checked={c.fee_exempt} onCheckedChange={(v) => save.mutate({ fee_exempt: v })} />
            </label>
          )}
          {editable && (
            <Button
              onClick={() => {
                const wa = toE164(form.whatsapp)
                if (form.whatsapp && !wa) return toast.error('WhatsApp inválido')
                save.mutate({
                  name: form.name.trim(),
                  company: form.company.trim(),
                  cnpj: form.cnpj || null,
                  whatsapp: wa,
                  email: form.email.trim().toLowerCase() || null,
                  notes: form.notes || null,
                })
              }}
              loading={save.isPending}
            >
              Salvar
            </Button>
          )}
        </section>

        <section className="rounded-2xl bg-surface">
          <h2 className="px-5 pt-5 text-[13px] font-medium uppercase tracking-[0.04em] text-fg-2">Pedidos</h2>
          {data.requests.length === 0 ? (
            <p className="p-5 text-[15px] text-fg-3">Nenhum pedido.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {data.requests.map((r) => (
                <li key={r.id}>
                  <Link to={`/painel/tarefas/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2/60">
                    <span>
                      <span className="block font-medium tabular">{r.code}</span>
                      <span className="block text-[13px] text-fg-2">
                        {dateTime(r.created_at)} · {r.quote_items.length} {r.quote_items.length === 1 ? 'produto' : 'produtos'}
                      </span>
                    </span>
                    <StatusBadge status={r.status} short />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
