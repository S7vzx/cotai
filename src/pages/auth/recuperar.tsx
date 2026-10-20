import * as React from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { SITE_URL, supabase } from '@/lib/supabase'
import { AuthShell } from './auth-shell'

export default function Recuperar() {
  const [email, setEmail] = React.useState('')
  const [sent, setSent] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${SITE_URL}/nova-senha` })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <AuthShell title="Recuperar senha" subtitle={sent ? undefined : 'Enviaremos um link para você criar uma nova senha.'}>
      {sent ? (
        <p className="text-[17px]">Se o e-mail estiver cadastrado, você vai receber o link em instantes. Confira também a caixa de spam.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="E-mail" htmlFor="email">
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          {error && <p className="text-[15px] text-[var(--status-red)]">{error}</p>}
          <Button type="submit" className="w-full" loading={busy}>
            Enviar link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center">
        <Link to="/login" className="text-[15px] text-accent-text">
          Voltar para o login
        </Link>
      </p>
    </AuthShell>
  )
}
