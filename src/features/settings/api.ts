import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRealtime } from '@/lib/realtime'
import { supabase, unwrap } from '@/lib/supabase'
import type { PublicSettings, Settings } from '@/types/domain'

export function usePublicSettings() {
  return useQuery({
    queryKey: ['public-settings'],
    queryFn: async () => unwrap(await supabase.rpc('get_public_settings')) as PublicSettings,
    staleTime: 60 * 1000,
  })
}

export function useSettings() {
  const qc = useQueryClient()
  // Mudanças feitas por outro admin chegam em tempo real
  useRealtime(
    'settings',
    () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['public-settings'] })
    },
    { event: 'UPDATE' },
  )

  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => unwrap(await supabase.from('settings').select('*').single()) as Settings,
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<Settings>) =>
      unwrap(await supabase.from('settings').update(patch).eq('id', true).select('*').single()) as Settings,
    onSuccess: (data) => {
      qc.setQueryData(['settings'], data)
      qc.invalidateQueries({ queryKey: ['public-settings'] })
    },
  })
}
