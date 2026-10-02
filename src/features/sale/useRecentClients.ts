import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Client } from '@/stores/venteStore'

export const RECENT_CLIENTS_LIMIT = 5
/** Sale lines scanned for recent buyers (a multi-offer cart = several lines). */
export const RECENT_SALES_SCAN = 50

const CLIENT_COLUMNS = 'id, nom, telephone, kiosque_id, created_at'

type SaleWithClient = { client_id: string | null; clients: Client | Client[] | null }

/**
 * Up to 5 clients for one-tap selection on the sale screen: the kiosque's
 * most recent BUYERS first (latest sale first, one chip per client), topped
 * up with its newest clients when fewer have bought (new kiosque, client
 * just created). Loaded on mount (and on reload()), never per keystroke.
 * Any failure (offline, RLS) just yields no chips.
 */
export function useRecentClients(kiosqueId: string | null | undefined) {
  const [recentClients, setRecentClients] = useState<Client[]>([])

  const reload = useCallback(async () => {
    if (!kiosqueId) {
      setRecentClients([])
      return
    }

    const buyersResult = await supabase
      .from('ventes')
      .select(`client_id, created_at, clients(${CLIENT_COLUMNS})`)
      .eq('kiosque_id', kiosqueId)
      .order('created_at', { ascending: false })
      .limit(RECENT_SALES_SCAN)

    if (buyersResult.error) {
      console.warn('[vente] clients récents indisponibles:', buyersResult.error.code, buyersResult.error.message)
      setRecentClients([])
      return
    }

    const picked = new Map<string, Client>()
    for (const sale of (buyersResult.data ?? []) as SaleWithClient[]) {
      const client = Array.isArray(sale.clients) ? sale.clients[0] : sale.clients
      if (!client?.id || !client.nom || picked.has(client.id)) continue
      picked.set(client.id, client)
      if (picked.size === RECENT_CLIENTS_LIMIT) break
    }

    if (picked.size < RECENT_CLIENTS_LIMIT) {
      const newestResult = await supabase
        .from('clients')
        .select(CLIENT_COLUMNS)
        .eq('kiosque_id', kiosqueId)
        .order('created_at', { ascending: false })
        .limit(RECENT_CLIENTS_LIMIT)
      // Top-up only: keep the buyers we already have if this one fails.
      if (!newestResult.error) {
        for (const client of (newestResult.data ?? []) as Client[]) {
          if (picked.size === RECENT_CLIENTS_LIMIT) break
          if (client?.id && client.nom && !picked.has(client.id)) picked.set(client.id, client)
        }
      }
    }

    setRecentClients([...picked.values()])
  }, [kiosqueId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { recentClients, reload }
}
