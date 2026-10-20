import * as React from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth'
import { supabase } from '@/lib/supabase'
import { AuthShell } from './auth-shell'

export default function Login() {
  const { session, profile, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(
    params.get('inativo') ? 'Seu acesso está desativado. Fale com o administrador.' : null,
  )
  const [busy, setBusy] = React.useState(false)
  const from = (location.state as { from?: string } | null)?.from ?? '/painel'

  if (!loading && session && profile) return <Navigate to={from} replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) {
      setError(/invalid/i.test(error.message) ? 'E-mail ou senha incorretos' : error.message)
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <AuthShell title="Área da equipe" subtitle="Entre com o e-mail do seu convite.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="E-mail" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Senha" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && (
          <p role="alert" className="text-[15px] text-[var(--status-red)]">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" loading={busy}>
          Entrar
        </Button>
        <p className="text-center">
          <Link to="/recuperar-senha" className="text-[15px] text-accent-text">
            Esqueci minha senha
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
