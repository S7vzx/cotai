import { Link, useRouteError } from 'react-router-dom'
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

/** Erro inesperado numa tela: mensagem amigável em vez da tela técnica do React Router. */
export function RouteError() {
  const error = useRouteError()
  console.error(error)
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Simbolo className="size-14" />
      <h1 className="mt-6 text-[34px] font-semibold">Algo deu errado</h1>
      <p className="mt-2 text-fg-2">Não foi possível abrir esta página. Tente de novo em instantes.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => window.location.reload()}>Tentar de novo</Button>
        <Button asChild variant="secondary">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </main>
  )
}
