// Convida um membro da equipe por e-mail (Administração → Equipe).
import { handler, HttpError, json } from '../_shared/http.ts'
import { admin, requireAdmin, SITE_URL } from '../_shared/supabase.ts'

const ROLES = ['admin', 'cotador', 'comprador']

Deno.serve(
  handler(async (req, body) => {
    await requireAdmin(req)
    const email = String(body.email ?? '')
      .trim()
      .toLowerCase()
    const role = String(body.role ?? 'cotador')
    const fullName = String(body.full_name ?? '')
      .trim()
      .slice(0, 120)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'E-mail inválido')
    if (!ROLES.includes(role)) throw new HttpError(400, 'Papel inválido')

    const name = fullName || email.split('@')[0]
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name },
      redirectTo: `${SITE_URL}/admin/nova-senha`,
    })
    let id = data?.user?.id
    if (error) {
      if (!/already/i.test(error.message)) throw error
      // O e-mail já tem usuário (ex.: entrou como cliente). Se ainda não é da equipe, vira agora.
      const { data: existing } = await admin.rpc('auth_user_id_by_email', { p_email: email })
      if (!existing) throw error
      const { data: profile } = await admin.from('profiles').select('id').eq('id', existing).maybeSingle()
      if (profile) throw new HttpError(400, 'Este e-mail já tem acesso')
      id = existing as string
      await admin.auth.resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/admin/nova-senha` })
    }
    // O perfil é criado aqui (service_role), nunca a partir do metadata do usuário
    const { error: pErr } = await admin.from('profiles').upsert({ id, email, full_name: name, role })
    if (pErr) throw pErr
    return json({ id })
  }),
)
