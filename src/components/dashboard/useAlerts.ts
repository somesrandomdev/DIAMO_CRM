import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type AdminAlertSeverity = 'info' | 'warning' | 'danger'

export interface AdminAlert {
  type: string
  kiosque_nom: string
  message: string
  severity: AdminAlertSeverity
}

interface SaleForAlert {
  kiosque_id: string
  created_at: string
  offre_id?: string | null
  offres?: { nom?: string } | { nom?: string }[] | null
}

interface KiosqueForAlert {
  id: string
  nom: string
}

function normalizeSeverity(value: string | null | undefined): AdminAlertSeverity {
  if (value === 'danger' || value === 'warning' || value === 'info') return value
  return 'info'
}

function fallbackMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Alertes indisponibles'
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<AdminAlert[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadFallbackAlerts = useCallback(async (): Promise<AdminAlert[]> => {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const last48 = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [kiosquesResult, todayResult, last48Result, monthSalesResult] = await Promise.all([
      supabase.from('kiosques').select('id, nom'),
      supabase.from('ventes').select('kiosque_id, created_at').gte('created_at', `${today}T00:00:00`),
      supabase.from('ventes').select('kiosque_id, created_at').gte('created_at', last48),
      supabase
        .from('ventes')
        .select('kiosque_id, created_at, offre_id, offres(nom)')
        .gte('created_at', monthStart),
    ])

    if (kiosquesResult.error) throw kiosquesResult.error
    if (todayResult.error) throw todayResult.error
    if (last48Result.error) throw last48Result.error
    if (monthSalesResult.error) throw monthSalesResult.error

    const kiosques = (kiosquesResult.data ?? []) as KiosqueForAlert[]
    const todayKiosques = new Set(((todayResult.data ?? []) as SaleForAlert[]).map((sale) => sale.kiosque_id))
    const active48Kiosques = new Set(((last48Result.data ?? []) as SaleForAlert[]).map((sale) => sale.kiosque_id))
    const monthSales = (monthSalesResult.data ?? []) as SaleForAlert[]
    const computed: AdminAlert[] = []

    kiosques.forEach((kiosque) => {
      if (!todayKiosques.has(kiosque.id)) {
        computed.push({
          type: 'inactif_today',
          kiosque_nom: kiosque.nom,
          message: "Aucune vente enregistrée aujourd'hui",
          severity: 'warning',
        })
      }

      if (!active48Kiosques.has(kiosque.id)) {
        computed.push({
          type: 'inactif_48h',
          kiosque_nom: kiosque.nom,
          message: 'Aucune vente depuis 48 heures',
          severity: 'danger',
        })
      }
    })

    const offerCounts = new Map<string, number>()
    monthSales.forEach((sale) => {
      const joined = Array.isArray(sale.offres) ? sale.offres[0] : sale.offres
      const name = joined?.nom ?? sale.offre_id ?? 'Offre inconnue'
      offerCounts.set(name, (offerCounts.get(name) ?? 0) + 1)
    })

    offerCounts.forEach((count, name) => {
      if (monthSales.length > 0 && count / monthSales.length < 0.05) {
        computed.push({
          type: 'offre_sous_perf',
          kiosque_nom: name,
          message: 'Moins de 5% des ventes ce mois',
          severity: 'info',
        })
      }
    })

    return computed.slice(0, 8)
  }, [])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('get_admin_alerts')

      if (!rpcError && data) {
        setAlerts(
          (data as Array<Record<string, string>>).map((row) => ({
            type: row.type ?? 'alerte',
            kiosque_nom: row.kiosque_nom ?? '',
            message: row.message ?? '',
            severity: normalizeSeverity(row.severity),
          }))
        )
        return
      }

      const fallbackAlerts = await loadFallbackAlerts()
      setAlerts(fallbackAlerts)
      if (rpcError) {
        setError('RPC get_admin_alerts absente ou indisponible; alertes calculées côté client.')
      }
    } catch (caught) {
      console.error('Error loading alerts:', caught)
      setError(fallbackMessage(caught))
      setAlerts([])
    } finally {
      setIsLoading(false)
    }
  }, [loadFallbackAlerts])

  useEffect(() => {
    load()
    const id = window.setInterval(load, 5 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [load])

  return useMemo(
    () => ({
      alerts,
      isLoading,
      error,
      refresh: load,
    }),
    [alerts, error, isLoading, load]
  )
}
