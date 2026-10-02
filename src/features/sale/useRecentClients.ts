import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Client } from '@/stores/venteStore'

export const RECENT_CLIENTS_LIMIT = 5

/**
 * The 5 most recently created clients of the kiosque, for one-tap selection
 * on the sale screen. Loaded on mount (and on reload()), never per keystroke.
 * Any failure (offline, RLS) just yields no chips.
 */
export function useRecentClients(kiosqueId: string | null | undefined) {
  const [recentClients, setRecentClients] = useState<Client[]>([])

  const reload = useCallback(async () => {
    if (!kiosqueId) {
      setRecentClients([])
      return
    }
    const { data, error } = await supabase
      .from('clients')
      .select('id, nom, telephone, kiosque_id, created_at')
      .eq('kiosque_id', kiosqueId)
      .order('created_at', { ascending: false })
      .limit(RECENT_CLIENTS_LIMIT)

    if (error) {
      console.warn('[vente] clients récents indisponibles:', error.code, error.message)
      setRecentClients([])
      return
    }
    setRecentClients(((data ?? []) as Client[]).filter((client) => client?.nom))
  }, [kiosqueId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { recentClients, reload }
}
