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

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { role, full_name: fullName || email.split('@')[0] },
      redirectTo: `${SITE_URL}/nova-senha`,
    })
    if (error) {
      if (/already/i.test(error.message)) throw new HttpError(400, 'Este e-mail já tem acesso')
      throw error
    }
    return json({ id: data.user?.id })
  }),
)
