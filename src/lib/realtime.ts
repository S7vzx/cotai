import * as React from 'react'
import { supabase } from './supabase'

let seq = 0

/**
 * Assina mudanças de uma tabela no Supabase Realtime.
 * Cada chamada cria um canal com nome único: o Supabase reaproveita canais
 * pelo nome, e dois componentes com o mesmo nome quebrariam a assinatura.
 */
export function useRealtime(
  table: string,
  onChange: () => void,
  opts: { event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'; filter?: string; enabled?: boolean } = {},
) {
  const cb = React.useRef(onChange)
  cb.current = onChange
  const { event = '*', filter, enabled = true } = opts

  React.useEffect(() => {
    if (!enabled) return
    const channel = supabase.channel(`rt-${table}-${++seq}`)
    channel
      .on('postgres_changes' as never, { event, schema: 'public', table, ...(filter ? { filter } : {}) }, () => cb.current())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [table, event, filter, enabled])
}
