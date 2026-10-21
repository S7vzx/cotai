import * as React from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { usePublicSettings } from '@/features/settings/api'
import { phone, waLink } from '@/lib/format'
import { publicUrl } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export function PublicHeader({ links = true, cta = true }: { links?: boolean; cta?: boolean }) {
  const { data } = usePublicSettings()
  const [scrolled, setScrolled] = React.useState(false)
  React.useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  const logo = publicUrl('branding', data?.logo_light_path)

  return (
    <header
      className={cn(
        'no-print sticky top-0 z-40 bg-chrome backdrop-blur-xl backdrop-saturate-150 transition-[border-color]',
        scrolled ? 'border-b border-line' : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="Página inicial" className="flex items-center">
          <BrandLogo src={logo} className="h-[22px]" alt={data?.display_name} />
        </Link>
        {links && (
          <nav className="hidden items-center gap-7 text-[13px] text-fg-2 md:flex">
            <a href="/#como-funciona" className="hover:text-fg">Como funciona</a>
            <a href="/#vantagens" className="hover:text-fg">Vantagens</a>
            <a href="/#perguntas" className="hover:text-fg">Perguntas frequentes</a>
            <Link to="/minhas-cotacoes" className="hover:text-fg">Minhas cotações</Link>
          </nav>
        )}
        {cta && (
          <Button asChild size="sm" className="h-8 px-4 text-[14px]">
            <Link to="/cotar">Fazer cotação</Link>
          </Button>
        )}
      </div>
    </header>
  )
}

export function PublicFooter() {
  const { data } = usePublicSettings()
  const wa = waLink(data?.contact_whatsapp)
  return (
    <footer className="no-print border-t border-line bg-bg-alt">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-6 px-4 py-10 text-[13px] text-fg-2 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="space-y-1">
          <p className="font-semibold text-fg">{data?.display_name ?? 'Cotaí'}</p>
          {data?.company_name && <p>{data.company_name}</p>}
          {data?.business_hours && <p>{data.business_hours}</p>}
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="hover:text-fg">
              WhatsApp {phone(data?.contact_whatsapp)}
            </a>
          )}
          {data?.contact_email && (
            <a href={`mailto:${data.contact_email}`} className="hover:text-fg">
              {data.contact_email}
            </a>
          )}
          <Link to="/minhas-cotacoes" className="hover:text-fg md:hidden">
            Minhas cotações
          </Link>
          <p className="mt-2 text-fg-3">© {new Date().getFullYear()} {data?.display_name ?? 'Cotaí'}. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}

export function useDocumentTitle(title: string | undefined) {
  React.useEffect(() => {
    if (title) document.title = title
  }, [title])
}
