import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoke, supabase, unwrap } from '@/lib/supabase'
import type { AppRole, Profile } from '@/types/domain'

export function useTeam() {
  return useQuery({
    queryKey: ['team'],
    queryFn: async () => unwrap(await supabase.from('profiles').select('*').order('full_name')) as Profile[],
    staleTime: 60_000,
  })
}

/** Mapa id → perfil, para mostrar nomes e avatares. */
export function useTeamMap() {
  const { data } = useTeam()
  return new Map((data ?? []).map((p) => [p.id, p]))
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<Profile, 'role' | 'active' | 'full_name'>> }) =>
      unwrap(await supabase.from('profiles').update(patch).eq('id', id).select('*').single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })
}

export function useInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { email: string; full_name: string; role: AppRole }) => invoke<{ id: string }>('invite-user', vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  })
}

export function usePermissions() {
  return useQuery({
    queryKey: ['role-permissions'],
    queryFn: async () =>
      unwrap(await supabase.from('role_permissions').select('*')) as { role: AppRole; permission: string; allowed: boolean }[],
  })
}

export function useSetPermission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (row: { role: AppRole; permission: string; allowed: boolean }) =>
      unwrap(await supabase.from('role_permissions').upsert(row)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['role-permissions'] })
      qc.invalidateQueries({ queryKey: ['me'] })
    },
  })
}
