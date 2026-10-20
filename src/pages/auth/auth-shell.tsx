import { Link } from 'react-router-dom'
import { Logo } from '@/components/brand/logo'

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg-alt px-4 py-12">
      <Link to="/" aria-label="Início">
        <Logo className="h-8" />
      </Link>
      <div className="mt-10 w-full max-w-[400px] rounded-[22px] bg-surface p-6 shadow-soft sm:p-8">
        <h1 className="text-[28px] font-semibold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-fg-2">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  )
}
