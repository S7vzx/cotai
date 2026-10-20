import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'
import { supabase, unwrap } from '@/lib/supabase'
import type { Permission, Profile } from '@/types/domain'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  /** Permissão efetiva do usuário atual (admin sempre pode). */
  can: (p: Permission) => boolean
  isAdmin: boolean
  signOut: () => Promise<void>
}

const AuthContext = React.createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()
  const [session, setSession] = React.useState<Session | null>(null)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) qc.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [qc])

  const userId = session?.user.id
  const profileQuery = useQuery({
    queryKey: ['me', userId],
    enabled: !!userId,
    queryFn: async () => {
      const profile = unwrap(await supabase.from('profiles').select('*').eq('id', userId!).maybeSingle()) as Profile | null
      if (!profile) return { profile: null, permissions: [] as { permission: string; allowed: boolean }[] }
      const perms =
        profile.role === 'admin'
          ? []
          : (unwrap(await supabase.from('role_permissions').select('permission, allowed').eq('role', profile.role)) as {
              permission: string
              allowed: boolean
            }[])
      // registra o último acesso (silencioso)
      void supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', profile.id)
      return { profile, permissions: perms }
    },
    staleTime: 5 * 60 * 1000,
  })

  const profile = profileQuery.data?.profile ?? null
  const value = React.useMemo<AuthState>(() => {
    const allowed = new Set((profileQuery.data?.permissions ?? []).filter((p) => p.allowed).map((p) => p.permission))
    const active = !!profile?.active
    return {
      session,
      profile: active ? profile : null,
      loading: !ready || (!!userId && profileQuery.isLoading),
      isAdmin: active && profile?.role === 'admin',
      can: (p) => active && (profile?.role === 'admin' || allowed.has(p)),
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }
  }, [session, profile, ready, userId, profileQuery.isLoading, profileQuery.data])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
