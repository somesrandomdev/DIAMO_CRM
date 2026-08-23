import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface ChurnedClient {
  id: string
  nom: string
  kiosque: string
  /** Days since the last purchase; null = never purchased. */
  daysInactive: number | null
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Clients who haven't purchased in the last 30 days (including clients who
 * never purchased). Most inactive first.
 */
export function useChurnAlerts() {
  const [churnedClients, setChurnedClients] = useState<ChurnedClient[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)

    const [clientsResult, ventesResult] = await Promise.all([
      supabase.from('clients').select('id, nom, kiosque_id, kiosques(nom)'),
      supabase.from('ventes').select('client_id, created_at'),
    ])

    const failure = clientsResult.error ?? ventesResult.error
    if (failure) {
      console.error('Error loading churn alerts:', failure)
      setChurnedClients([])
      setIsLoading(false)
      return
    }

    const lastPurchaseByClient = new Map<string, string>()
    for (const vente of (ventesResult.data ?? []) as Array<{ client_id: string | null; created_at: string }>) {
      if (!vente.client_id) continue
      const current = lastPurchaseByClient.get(vente.client_id)
      if (!current || vente.created_at > current) {
        lastPurchaseByClient.set(vente.client_id, vente.created_at)
      }
    }

    const now = Date.now()
    const churned: ChurnedClient[] = []
    for (const client of (clientsResult.data ?? []) as Array<{
      id: string
      nom: string
      kiosques?: { nom?: string } | { nom?: string }[] | null
    }>) {
      const last = lastPurchaseByClient.get(client.id)
      if (last && now - new Date(last).getTime() < THIRTY_DAYS_MS) continue

      const kiosque = Array.isArray(client.kiosques) ? client.kiosques[0]?.nom ?? '—' : client.kiosques?.nom ?? '—'
      churned.push({
        id: client.id,
        nom: client.nom,
        kiosque,
        daysInactive: last ? Math.floor((now - new Date(last).getTime()) / (24 * 60 * 60 * 1000)) : null,
      })
    }

    // Most inactive first; "never purchased" tops the list.
    churned.sort((a, b) => (b.daysInactive ?? Infinity) - (a.daysInactive ?? Infinity))
    setChurnedClients(churned)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { churnedClients, isLoading }
}
