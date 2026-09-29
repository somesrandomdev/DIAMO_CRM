import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { parseInsights, type Insights } from '@/lib/adminInsights'

interface UseAdminInsightsOptions {
  kiosqueIds: string[]
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD (inclus)
}

/**
 * Fetch get_admin_insights pour la fenêtre/filtres actifs du dashboard.
 * La migration doit être exécutée (20261001_admin_insights.sql) sinon
 * l'erreur RPC est remontée pour affichage discret.
 */
export function useAdminInsights({ kiosqueIds, start, end }: UseAdminInsightsOptions) {
  const [insights, setInsights] = useState<Insights | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const kiosqueKey = kiosqueIds.join(',')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('get_admin_insights', {
        p_kiosque_ids: kiosqueIds.length > 0 ? kiosqueIds : null,
        p_start: start,
        p_end: end,
      })
      if (rpcError) throw rpcError
      setInsights(parseInsights(data))
    } catch (caught) {
      setInsights(null)
      setError(
        caught instanceof Error
          ? caught.message
          : 'Impossible de charger les insights. La migration 20261001_admin_insights.sql est-elle exécutée ?'
      )
    } finally {
      setIsLoading(false)
    }
  // kiosqueIds est utilisé directement dans la requête; kiosqueKey (join) est
  // la dépendance stable — eslint ne le voit pas, dépendance voulue.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end, kiosqueKey, start])

  useEffect(() => {
    load()
  }, [load])

  return { insights, isLoading, error, refresh: load }
}
