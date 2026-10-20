import { Logo } from '@/components/brand/logo'

/** Mostrado quando o .env ainda não foi configurado. */
export function SetupNeeded() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6">
      <Logo className="h-8 self-start" />
      <h1 className="text-[34px] font-semibold leading-tight">Falta conectar o Supabase</h1>
      <p className="text-fg-2">
        Copie o arquivo <code className="rounded bg-surface-2 px-1.5 py-0.5">.env.example</code> para{' '}
        <code className="rounded bg-surface-2 px-1.5 py-0.5">.env.local</code> e preencha{' '}
        <code className="rounded bg-surface-2 px-1.5 py-0.5">VITE_SUPABASE_URL</code> e{' '}
        <code className="rounded bg-surface-2 px-1.5 py-0.5">VITE_SUPABASE_ANON_KEY</code>. Depois reinicie o{' '}
        <code className="rounded bg-surface-2 px-1.5 py-0.5">npm run dev</code>.
      </p>
      <p className="text-[15px] text-fg-3">O passo a passo completo está no README.md.</p>
    </main>
  )
}
