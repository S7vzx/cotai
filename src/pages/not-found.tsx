import { Link } from 'react-router-dom'
import { Simbolo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'

export function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Simbolo className="size-14" />
      <h1 className="mt-6 text-[34px] font-semibold">Página não encontrada</h1>
      <p className="mt-2 text-fg-2">O link pode estar incompleto ou ter expirado.</p>
      <Button asChild className="mt-8">
        <Link to="/">Voltar ao início</Link>
      </Button>
    </main>
  )
}
