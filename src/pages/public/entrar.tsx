import * as React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth'
import { sendLoginCode, verifyLoginCode } from '@/features/portal/api'
import { SITE_URL } from '@/lib/supabase'
import { AuthShell } from '@/pages/auth/auth-shell'

/** Login do cliente: código de acesso enviado por e-mail, sem senha. */
export default function Entrar() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('')
  const [code, setCode] = React.useState('')
  const [step, setStep] = React.useState<'email' | 'code'>('email')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  if (!loading && session) return <Navigate to="/minhas-cotacoes" replace />

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await sendLoginCode(email.trim().toLowerCase(), `${SITE_URL}/minhas-cotacoes`)
      setStep('code')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(/rate|seconds|security purposes/i.test(msg) ? 'Aguarde um minuto antes de pedir outro código' : 'Não foi possível enviar o código. Confira o e-mail.')
    } finally {
      setBusy(false)
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await verifyLoginCode(email.trim().toLowerCase(), code.trim())
      navigate('/minhas-cotacoes', { replace: true })
    } catch {
      setError('Código inválido ou expirado')
    } finally {
      setBusy(false)
    }
  }

  if (step === 'code')
    return (
      <AuthShell title="Digite o código" subtitle={`Enviamos um código de acesso para ${email.trim()}.`}>
        <form onSubmit={verify} className="space-y-4">
          <Field label="Código" htmlFor="code" hint="Você também pode tocar no link do e-mail.">
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="tabular tracking-[0.2em]"
            />
          </Field>
          {error && (
            <p role="alert" className="text-[15px] text-[var(--status-red)]">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" loading={busy} disabled={code.length < 6}>
            Entrar
          </Button>
          <div className="flex justify-between text-[15px]">
            <button type="button" className="min-h-11 text-accent-text" onClick={() => setStep('email')}>
              Trocar e-mail
            </button>
            <button type="button" className="min-h-11 text-accent-text" onClick={() => sendCode()} disabled={busy}>
              Reenviar código
            </button>
          </div>
        </form>
      </AuthShell>
    )

  return (
    <AuthShell title="Minhas cotações" subtitle="Entre com o e-mail que você usou no pedido. Vamos enviar um código de acesso.">
      <form onSubmit={sendCode} className="space-y-4">
        <Field label="E-mail" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {error && (
          <p role="alert" className="text-[15px] text-[var(--status-red)]">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" loading={busy}>
          Enviar código
        </Button>
      </form>
    </AuthShell>
  )
}
