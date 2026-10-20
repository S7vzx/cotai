import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Simbolo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Segmented, Switch } from '@/components/ui/controls'
import { Field, Input } from '@/components/ui/input'
import { MoneyInput, PhoneInput } from '@/components/shared/inputs'
import { useSettings, useUpdateSettings } from '@/features/settings/api'
import { toE164 } from '@/lib/format'
import { cn, errorMessage } from '@/lib/utils'
import type { FeeModel } from '@/types/domain'

const STEPS = ['Empresa', 'Cobrança', 'Contato']

/** Assistente de primeiro acesso do administrador. */
export default function BoasVindas() {
  const { data: s } = useSettings()
  const update = useUpdateSettings()
  const navigate = useNavigate()
  const [step, setStep] = React.useState(0)
  const [form, setForm] = React.useState({
    display_name: 'Cotaí',
    company_name: '',
    charge_enabled: false,
    fee_model: 'fixo_pedido' as FeeModel,
    fee_fixed: 0,
    fee_per_item: 0,
    pix_key: '',
    whatsapp: '',
    contact_email: '',
  })

  React.useEffect(() => {
    if (s)
      setForm((f) => ({
        ...f,
        display_name: s.display_name || 'Cotaí',
        company_name: s.company_name,
        charge_enabled: s.charge_enabled,
        fee_model: s.fee_model === 'faixas' ? 'fixo_pedido' : s.fee_model,
        fee_fixed: Number(s.fee_fixed),
        fee_per_item: Number(s.fee_per_item),
        pix_key: s.pix_key ?? '',
        contact_email: s.contact_email ?? '',
      }))
  }, [s])

  async function finish(skip = false) {
    try {
      if (!skip) {
        const wa = form.whatsapp ? toE164(form.whatsapp) : null
        if (form.whatsapp && !wa) return toast.error('WhatsApp inválido')
        await update.mutateAsync({
          display_name: form.display_name.trim() || 'Cotaí',
          company_name: form.company_name.trim(),
          charge_enabled: form.charge_enabled,
          fee_model: form.fee_model,
          fee_fixed: form.fee_fixed,
          fee_per_item: form.fee_per_item,
          pix_key: form.pix_key || null,
          contact_whatsapp: wa,
          contact_email: form.contact_email.trim() || null,
          onboarding_completed: true,
        })
      } else {
        await update.mutateAsync({ onboarding_completed: true })
      }
      toast.success('Tudo pronto!')
      navigate('/painel', { replace: true })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  function next() {
    if (step === 0 && !form.display_name.trim()) return toast.error('Informe o nome')
    if (step === 1 && form.charge_enabled) {
      if (form.fee_model === 'fixo_pedido' && form.fee_fixed <= 0) return toast.error('Informe o valor da taxa')
      if (form.fee_model === 'por_produto' && form.fee_per_item <= 0) return toast.error('Informe o valor por produto')
    }
    if (step < 2) setStep(step + 1)
    else void finish()
  }

  return (
    <div className="mx-auto max-w-[520px] py-6">
      <Simbolo className="size-12" />
      <h1 className="mt-6 text-[34px] font-semibold leading-tight">Vamos configurar</h1>
      <p className="mt-1 text-[17px] text-fg-2">Três passos rápidos. Dá para mudar tudo depois em Ajustes.</p>

      <ol className="mt-8 flex gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col gap-2">
            <span className={cn('h-1 rounded-full', i <= step ? 'bg-accent' : 'bg-[color-mix(in_srgb,var(--fg)_12%,transparent)]')} />
            <span className={cn('text-[13px]', i === step ? 'font-semibold' : 'text-fg-3')}>{label}</span>
          </li>
        ))}
      </ol>

      <div key={step} className="mt-8 space-y-5 rounded-[22px] bg-surface p-6" style={{ animation: 'rise 350ms both' }}>
        {step === 0 && (
          <>
            <Field label="Nome exibido no site" hint="Pode manter “Cotaí” ou usar o nome da sua empresa">
              <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </Field>
            <Field label="Razão social" hint="Opcional">
              <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </Field>
          </>
        )}
        {step === 1 && (
          <>
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-[17px]">Cobrar taxa de cotação</span>
                <span className="block text-[13px] text-fg-2">Desligado, a cotação é gratuita para o cliente</span>
              </span>
              <Switch checked={form.charge_enabled} onCheckedChange={(v) => setForm({ ...form, charge_enabled: v })} />
            </label>
            {form.charge_enabled && (
              <>
                <Segmented
                  className="w-full"
                  value={form.fee_model}
                  onChange={(v) => setForm({ ...form, fee_model: v })}
                  options={[
                    { value: 'fixo_pedido', label: 'Fixo por pedido' },
                    { value: 'por_produto', label: 'Por produto' },
                  ]}
                />
                {form.fee_model === 'fixo_pedido' ? (
                  <Field label="Valor por pedido">
                    <MoneyInput value={form.fee_fixed} onValueChange={(v) => setForm({ ...form, fee_fixed: v })} />
                  </Field>
                ) : (
                  <Field label="Valor por produto">
                    <MoneyInput value={form.fee_per_item} onValueChange={(v) => setForm({ ...form, fee_per_item: v })} />
                  </Field>
                )}
                <Field label="Chave Pix" hint="Para o cliente pagar enquanto o Pix automático não estiver configurado">
                  <Input value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} />
                </Field>
              </>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <Field label="WhatsApp da empresa" hint="Aparece no site e na cotação">
              <PhoneInput value={form.whatsapp} onValueChange={(v) => setForm({ ...form, whatsapp: v })} />
            </Field>
            <Field label="E-mail de contato">
              <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </Field>
          </>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        {step > 0 ? (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            Voltar
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => void finish(true)}>
            Pular
          </Button>
        )}
        <Button className="flex-1" onClick={next} loading={update.isPending}>
          {step < 2 ? 'Continuar' : 'Concluir'}
        </Button>
      </div>
    </div>
  )
}
