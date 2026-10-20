import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/controls'
import { Field, Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth'
import { supabase } from '@/lib/supabase'
import { AuthShell } from './auth-shell'

/** Destino dos links de convite e de recuperação de senha. */
export default function NovaSenha() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [name, setName] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (session?.user.user_metadata?.full_name) setName(session.user.user_metadata.full_name)
  }, [session])

  if (loading)
    return (
      <AuthShell title="Criar senha">
        <Spinner />
      </AuthShell>
    )

  if (!session)
    return (
      <AuthShell title="Link expirado" subtitle="Peça um novo convite ao administrador ou use “Esqueci minha senha”.">
        <Button className="w-full" onClick={() => navigate('/recuperar-senha')}>
          Recuperar senha
        </Button>
      </AuthShell>
    )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('Use pelo menos 8 caracteres')
    if (password !== confirm) return setError('As senhas não conferem')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password, data: { full_name: name } })
    if (!error && name) await supabase.from('profiles').update({ full_name: name }).eq('id', session!.user.id)
    setBusy(false)
    if (error) return setError(error.message)
    toast.success('Senha criada')
    navigate('/painel', { replace: true })
  }

  return (
    <AuthShell title="Criar senha" subtitle={session.user.email}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Seu nome" htmlFor="name">
          <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Nova senha" hint="Pelo menos 8 caracteres" htmlFor="pw">
          <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Repita a senha" htmlFor="pw2">
          <Input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error && <p className="text-[15px] text-[var(--status-red)]">{error}</p>}
        <Button type="submit" className="w-full" loading={busy}>
          Salvar e entrar
        </Button>
      </form>
    </AuthShell>
  )
}
