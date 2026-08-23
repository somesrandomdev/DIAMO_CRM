import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RecentSale } from './SaleRecentList'

function joinedName(value: { nom?: string } | { nom?: string }[] | null | undefined): string {
  if (Array.isArray(value)) return value[0]?.nom ?? 'Inconnu'
  return value?.nom ?? 'Inconnu'
}

/** Today's stats bar + the five most recent sales of a kiosk. */
export function useSaleSummary() {
  const [dailyStats, setDailyStats] = useState({ ventes: 0, ca: 0 })
  const [recentSales, setRecentSales] = useState<RecentSale[]>([])

  const loadVenteSummary = useCallback(async (kiosqueId: string) => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [todayResult, recentResult] = await Promise.all([
      supabase
        .from('ventes')
        .select('id, montant_total')
        .eq('kiosque_id', kiosqueId)
        .gte('created_at', todayStart.toISOString()),
      supabase
        .from('ventes')
        .select('id, created_at, montant_total, clients(nom), offres(nom)')
        .eq('kiosque_id', kiosqueId)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    if (todayResult.error) {
      console.error('Error loading daily sale stats:', todayResult.error)
    } else {
      const rows = todayResult.data ?? []
      setDailyStats({
        ventes: rows.length,
        ca: rows.reduce((sum, sale) => sum + (sale.montant_total ?? 0), 0),
      })
    }

    if (recentResult.error) {
      console.error('Error loading recent sales:', recentResult.error)
    } else {
      setRecentSales(
        (recentResult.data ?? []).map((sale) => ({
          id: sale.id,
          created_at: sale.created_at,
          montant_total: sale.montant_total ?? 0,
          client_nom: joinedName(sale.clients),
          offre_nom: joinedName(sale.offres),
        }))
      )
    }
  }, [])

  return { dailyStats, recentSales, loadVenteSummary }
}
