import { Lock, UserPlus } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Segmented, Switch } from '@/components/ui/controls'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Group, Row } from '@/components/ui/group'
import { Field, Input, NativeSelect } from '@/components/ui/input'
import { Badge } from '@/components/shared/badges'
import { Avatar } from '@/components/shared/media'
import { useAuth } from '@/features/auth/auth'
import { useInvite, usePermissions, useSetPermission, useTeam, useUpdateProfile } from '@/features/team/api'
import { ago } from '@/lib/format'
import { errorMessage } from '@/lib/utils'
import type { AppRole, Profile } from '@/types/domain'
import { SectionShell } from './shared'

const ROLES: { value: AppRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Administrador', description: 'Acesso total, inclusive a estes Ajustes' },
  { value: 'cotador', label: 'Cotador', description: 'Cotações, compras e clientes' },
  { value: 'comprador', label: 'Comprador', description: 'Somente compras' },
]

const PERMISSIONS: { key: string; label: string }[] = [
  { key: 'view_revenue', label: 'Ver receita' },
  { key: 'view_costs', label: 'Ver custo e margem' },
  { key: 'confirm_payment', label: 'Confirmar pagamento' },
  { key: 'send_quote', label: 'Enviar cotação' },
  { key: 'delete_request', label: 'Excluir pedido' },
  { key: 'manage_purchases', label: 'Gerenciar compras' },
  { key: 'manage_customers', label: 'Editar clientes' },
]

export default function AdminEquipe() {
  const { profile: me } = useAuth()
  const { data: team, isLoading, error, refetch } = useTeam()
  const { data: perms } = usePermissions()
  const setPerm = useSetPermission()
  const update = useUpdateProfile()
  const [inviting, setInviting] = React.useState(false)
  const [editing, setEditing] = React.useState<Profile | null>(null)

  const allowed = (role: AppRole, permission: string) =>
    perms?.find((p) => p.role === role && p.permission === permission)?.allowed ?? false
  const activeAdmins = (team ?? []).filter((p) => p.role === 'admin' && p.active).length

  return (
    <SectionShell
      title="Equipe"
      description="Quem acessa o painel e o que cada papel pode fazer."
      loading={isLoading}
      error={error}
      onRetry={() => refetch()}
      wide
    >
      <Group
        title={`Usuários (${team?.length ?? 0})`}
        action={
          <Button variant="link" size="sm" onClick={() => setInviting(true)}>
            <UserPlus className="size-4" /> Convidar
          </Button>
        }
      >
        {(team ?? []).map((p) => (
          <Row
            key={p.id}
            onClick={() => setEditing(p)}
            icon={<Avatar name={p.full_name} url={p.avatar_url} />}
            label={
              <span className="flex flex-wrap items-center gap-2">
                {p.full_name}
                {p.id === me?.id && <span className="text-[13px] text-fg-3">(você)</span>}
                {!p.active && <Badge>Inativo</Badge>}
              </span>
            }
            description={`${p.email ?? ''} · ${ROLES.find((r) => r.value === p.role)?.label} · ${p.last_seen_at ? `visto ${ago(p.last_seen_at)}` : 'ainda não entrou'}`}
          />
        ))}
      </Group>

      <Group
        title="Permissões por papel"
        footer="Administradores podem tudo. As mudanças valem no próximo carregamento de página de cada usuário."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-[15px]">
            <thead>
              <tr className="border-b border-line text-[13px] text-fg-2">
                <th className="h-10 px-4 text-left font-medium">Ação</th>
                {ROLES.map((r) => (
                  <th key={r.value} className="h-10 px-4 text-center font-medium">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {PERMISSIONS.map((perm) => (
                <tr key={perm.key} className="h-12">
                  <td className="px-4">{perm.label}</td>
                  {ROLES.map((r) => (
                    <td key={r.value} className="px-4 text-center">
                      {r.value === 'admin' ? (
                        <Switch checked disabled aria-label={`${perm.label} — ${r.label}`} />
                      ) : (
                        <Switch
                          checked={allowed(r.value, perm.key)}
                          aria-label={`${perm.label} — ${r.label}`}
                          onCheckedChange={(v) =>
                            setPerm.mutate(
                              { role: r.value, permission: perm.key, allowed: v },
                              { onError: (e) => toast.error(errorMessage(e)) },
                            )
                          }
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="h-12">
                <td className="px-4">Acessar Ajustes</td>
                <td className="px-4 text-center">
                  <Switch checked disabled aria-label="Ajustes — Administrador" />
                </td>
                <td className="px-4 text-center">
                  <Lock className="mx-auto size-4 text-fg-3" aria-label="Somente administradores" />
                </td>
                <td className="px-4 text-center">
                  <Lock className="mx-auto size-4 text-fg-3" aria-label="Somente administradores" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Group>

      <InviteDialog open={inviting} onOpenChange={setInviting} />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <DialogContent size="sm" title={editing.full_name} description={editing.email ?? undefined}>
            <div className="space-y-5">
              <Field label="Papel">
                <NativeSelect
                  value={editing.role}
                  disabled={editing.role === 'admin' && activeAdmins <= 1}
                  onChange={(e) =>
                    update.mutate(
                      { id: editing.id, patch: { role: e.target.value as AppRole } },
                      {
                        onSuccess: () => {
                          toast.success('Papel atualizado')
                          setEditing({ ...editing, role: e.target.value as AppRole })
                        },
                        onError: (er) => toast.error(errorMessage(er)),
                      },
                    )
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label} — {r.description}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              {editing.role === 'admin' && activeAdmins <= 1 && (
                <p className="text-[13px] text-fg-3">É o único administrador ativo, então não pode ser rebaixado nem desativado.</p>
              )}
              <label className="flex items-center justify-between">
                <span>
                  <span className="block">Acesso ativo</span>
                  <span className="block text-[13px] text-fg-2">Desativado, o usuário não entra mais no painel</span>
                </span>
                <Switch
                  checked={editing.active}
                  disabled={editing.id === me?.id || (editing.role === 'admin' && activeAdmins <= 1)}
                  onCheckedChange={(v) =>
                    update.mutate(
                      { id: editing.id, patch: { active: v } },
                      {
                        onSuccess: () => {
                          toast.success(v ? 'Acesso reativado' : 'Acesso desativado')
                          setEditing({ ...editing, active: v })
                        },
                        onError: (er) => toast.error(errorMessage(er)),
                      },
                    )
                  }
                />
              </label>
              {!editing.last_seen_at && <ResendInvite email={editing.email} role={editing.role} name={editing.full_name} />}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </SectionShell>
  )
}

function ResendInvite({ email, role, name }: { email: string | null; role: AppRole; name: string }) {
  const invite = useInvite()
  if (!email) return null
  return (
    <Button
      variant="secondary"
      className="w-full"
      loading={invite.isPending}
      onClick={() =>
        invite.mutate(
          { email, role, full_name: name },
          { onSuccess: () => toast.success('Convite reenviado'), onError: (e) => toast.error(errorMessage(e)) },
        )
      }
    >
      Reenviar convite
    </Button>
  )
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const invite = useInvite()
  const [form, setForm] = React.useState({ email: '', full_name: '', role: 'cotador' as AppRole })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        title="Convidar para a equipe"
        description="A pessoa recebe um e-mail para criar a senha."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              loading={invite.isPending}
              onClick={() =>
                invite.mutate(form, {
                  onSuccess: () => {
                    toast.success('Convite enviado')
                    setForm({ email: '', full_name: '', role: 'cotador' })
                    onOpenChange(false)
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              Enviar convite
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nome">
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Papel">
            <Segmented<AppRole>
              className="w-full"
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v })}
              options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
            />
          </Field>
          <p className="text-[13px] text-fg-2">{ROLES.find((r) => r.value === form.role)?.description}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
