import { ImageUp, Trash2, X } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Group, Row } from '@/components/ui/group'
import { Input } from '@/components/ui/input'
import { CnpjInput, PhoneInput } from '@/components/shared/inputs'
import { toE164 } from '@/lib/format'
import { maskPhone } from '@/lib/masks'
import { publicUrl, supabase } from '@/lib/supabase'
import { errorMessage } from '@/lib/utils'
import type { Settings } from '@/types/domain'
import { SaveBar, SectionShell, useSettingsDraft } from './shared'

const KEYS = [
  'display_name',
  'company_name',
  'cnpj',
  'address',
  'logo_light_path',
  'logo_dark_path',
  'favicon_path',
  'contact_whatsapp',
  'contact_email',
  'business_hours',
  'social_links',
  'team_notification_emails',
] as const

function LogoUpload({
  label,
  path,
  onChange,
  dark,
}: {
  label: string
  path: string | null
  onChange: (p: string | null) => void
  dark?: boolean
}) {
  const [busy, setBusy] = React.useState(false)
  const url = publicUrl('branding', path)
  return (
    <Row label={label} description="PNG ou SVG, fundo transparente">
      <div className="flex items-center gap-2">
        {url && (
          <span className={dark ? 'rounded-lg bg-black p-2' : 'rounded-lg bg-surface-2 p-2'}>
            <img src={url} alt="" className="h-6 max-w-[120px] object-contain" />
          </span>
        )}
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[14px] font-medium">
          <ImageUp className="size-4" /> {busy ? 'Enviando…' : url ? 'Trocar' : 'Enviar'}
          <input
            type="file"
            accept="image/png,image/svg+xml,image/webp,image/jpeg"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              if (f.size > 2 * 1024 * 1024) return toast.error('Use um arquivo de até 2 MB')
              setBusy(true)
              const ext = f.name.split('.').pop()?.toLowerCase() ?? 'png'
              const p = `marca/${label.toLowerCase().replace(/\W+/g, '-')}-${Date.now()}.${ext}`
              const { error } = await supabase.storage.from('branding').upload(p, f, { contentType: f.type, upsert: true })
              setBusy(false)
              if (error) return toast.error(errorMessage(error))
              onChange(p)
            }}
          />
        </label>
        {url && (
          <button
            className="flex size-8 items-center justify-center rounded-full text-fg-3 hover:text-[var(--status-red)]"
            aria-label="Remover"
            onClick={() => onChange(null)}
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </Row>
  )
}

export default function AdminEmpresa() {
  const { draft, set, dirty, save, reset, saving, isLoading, error, refetch } = useSettingsDraft(KEYS)
  const [whats, setWhats] = React.useState('')
  const [newEmail, setNewEmail] = React.useState('')

  React.useEffect(() => {
    if (draft) setWhats(draft.contact_whatsapp ? maskPhone(draft.contact_whatsapp.replace(/^\+55/, '')) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.contact_whatsapp])

  const social = (draft?.social_links ?? {}) as Record<string, string>

  return (
    <SectionShell
      title="Empresa e marca"
      description="Como a sua empresa aparece no site, nas cotações e nos e-mails."
      loading={isLoading || !draft}
      error={error}
      onRetry={() => refetch()}
    >
      {draft && (
        <>
          <Group title="Empresa">
            <Row label="Nome exibido" description="Aparece no site e nos e-mails" stacked>
              <Input value={draft.display_name} onChange={(e) => set('display_name', e.target.value)} />
            </Row>
            <Row label="Razão social" stacked>
              <Input value={draft.company_name} onChange={(e) => set('company_name', e.target.value)} />
            </Row>
            <Row label="CNPJ" stacked>
              <CnpjInput value={draft.cnpj ?? ''} onValueChange={(v) => set('cnpj', v || null)} />
            </Row>
            <Row label="Endereço" description="Opcional" stacked>
              <Input value={draft.address ?? ''} onChange={(e) => set('address', e.target.value || null)} />
            </Row>
          </Group>

          <Group title="Marca" footer="Sem logo enviado, o site usa o logo do Cotaí.">
            <LogoUpload label="Logo (fundo claro)" path={draft.logo_light_path} onChange={(p) => set('logo_light_path', p)} />
            <LogoUpload label="Logo (fundo escuro)" path={draft.logo_dark_path} onChange={(p) => set('logo_dark_path', p)} dark />
            <LogoUpload label="Favicon" path={draft.favicon_path} onChange={(p) => set('favicon_path', p)} />
          </Group>

          <Group title="Contato">
            <Row label="WhatsApp" stacked>
              <PhoneInput
                value={whats}
                onValueChange={(v) => {
                  setWhats(v)
                  set('contact_whatsapp', toE164(v))
                }}
              />
            </Row>
            <Row label="E-mail" stacked>
              <Input type="email" value={draft.contact_email ?? ''} onChange={(e) => set('contact_email', e.target.value || null)} />
            </Row>
            <Row label="Horário de atendimento" stacked>
              <Input
                placeholder="Seg. a sex., 8h às 18h"
                value={draft.business_hours ?? ''}
                onChange={(e) => set('business_hours', e.target.value || null)}
              />
            </Row>
          </Group>

          <Group title="Redes sociais" footer="Opcional.">
            {(['instagram', 'linkedin', 'site'] as const).map((k) => (
              <Row key={k} label={k === 'site' ? 'Site' : k[0].toUpperCase() + k.slice(1)} stacked>
                <Input
                  type="url"
                  placeholder="https://"
                  value={social[k] ?? ''}
                  onChange={(e) => set('social_links', { ...social, [k]: e.target.value } as Settings['social_links'])}
                />
              </Row>
            ))}
          </Group>

          <Group
            title="Avisos internos"
            footer="Quem recebe por e-mail os avisos de novo pedido, aprovação e recusa. Vazio = todos os administradores."
          >
            {draft.team_notification_emails.map((em) => (
              <Row key={em} label={em}>
                <button
                  aria-label={`Remover ${em}`}
                  className="flex size-8 items-center justify-center rounded-full text-fg-3 hover:text-[var(--status-red)]"
                  onClick={() =>
                    set(
                      'team_notification_emails',
                      draft.team_notification_emails.filter((x) => x !== em),
                    )
                  }
                >
                  <X className="size-4" />
                </button>
              </Row>
            ))}
            <Row label="Adicionar e-mail" stacked>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const v = newEmail.trim().toLowerCase()
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return toast.error('E-mail inválido')
                  if (!draft.team_notification_emails.includes(v)) set('team_notification_emails', [...draft.team_notification_emails, v])
                  setNewEmail('')
                }}
              >
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="nome@empresa.com" />
                <Button type="submit" variant="secondary">
                  Adicionar
                </Button>
              </form>
            </Row>
          </Group>

          <SaveBar
            dirty={dirty}
            saving={saving}
            onReset={reset}
            onSave={() =>
              save((d) =>
                !d.display_name.trim() ? 'Informe o nome exibido' : d.contact_whatsapp === null && whats ? 'WhatsApp inválido' : null,
              )
            }
          />
        </>
      )}
    </SectionShell>
  )
}
