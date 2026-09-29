import { useCallback, useEffect, useMemo, useState } from 'react'
import { scopedKiosqueIds, startOfMonth } from '@/lib/commercialStats'
import { supabase } from '@/lib/supabase'

/**
 * Period the dashboard is currently showing.
 * 'current' = month to date, 'previous' = the full month before it.
 */
/**
 * Period selector for the admin dashboard filters.
 * 'custom' uses the date picked via setCustomDate ('YYYY-MM-DD').
 *
 * NOTE: no 'last month' option — the live get_admin_dashboard_stats has NO
 * upper bound on its "current" bucket (everything >= p_month_start), so a
 * last-month window would silently include the current month too.
 */
export type AdminTimePeriod = 'today' | 'week' | 'month' | 'custom'

/* ------------------------------------------------------------------ *
 * RPC contract
 *
 * get_admin_dashboard_stats(p_month_start, p_prev_start, p_last30_start)
 * returns a single JSON object:
 *
 *   {
 *     current:  [{ kiosque_id, offre_id, ca, nb, qty, clients }, ...],
 *     previous: [{ kiosque_id, ca }, ...],
 *     daily:    [{ day, ca }, ...]
 *   }
 *
 * Any of the three keys can be null when the period has no rows, because
 * json_agg() over an empty set returns NULL rather than an empty array.
 * ------------------------------------------------------------------ */

interface RpcCurrentRow {
  kiosque_id: string
  offre_id: string | null
  ca: number | string | null
  nb: number | string | null
  qty: number | string | null
  clients: number | string | null
}

interface RpcPreviousRow {
  kiosque_id: string
  ca: number | string | null
}

interface RpcDailyRow {
  day: string
  ca: number | string | null
}

interface RpcPayload {
  current: RpcCurrentRow[] | null
  previous: RpcPreviousRow[] | null
  daily: RpcDailyRow[] | null
}

/* ------------------------------------------------------------------ *
 * View models
 * ------------------------------------------------------------------ */

export interface AdminKpis {
  revenue: number
  /**
   * Month-over-month revenue change, in percent.
   * `null` when no comparison is possible (e.g. viewing last month), so the UI
   * can hide the arrow instead of drawing a misleading "0 %".
   */
  revenueDelta: number | null
  transactions: number
  topKiosqueName: string
  topKiosqueRevenue: number
  topOffreName: string
  topOffreQty: number
}

export interface KiosquePerformance {
  id: string
  nom: string
  caMois: number
  nbVentes: number
  panierMoyen: number
  deltaVsPrevious: number
  statut: 'up' | 'down' | 'stable'
}

export interface DailyRevenuePoint {
  date: string
  label: string
  ca: number
  moyenne7j: number
}

export interface OfferBreakdownPoint {
  name: string
  value: number
  ventes: number
  quantite: number
}

export interface AdminDashboardData {
  kpis: AdminKpis
  kiosques: KiosquePerformance[]
  dailyRevenue: DailyRevenuePoint[]
  offerBreakdown: OfferBreakdownPoint[]
}

const emptyKpis: AdminKpis = {
  revenue: 0,
  revenueDelta: null,
  transactions: 0,
  topKiosqueName: 'Aucun',
  topKiosqueRevenue: 0,
  topOffreName: 'Aucune',
  topOffreQty: 0,
}

const emptyData: AdminDashboardData = {
  kpis: emptyKpis,
  kiosques: [],
  dailyRevenue: [],
  offerBreakdown: [],
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * Postgres returns bigint and numeric as strings over the wire to avoid
 * precision loss. Every aggregate from the RPC must go through this.
 */
function num(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function previousMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1)
}

/** Local-time YYYY-MM-DD. Avoids toISOString(), which shifts to UTC and can
 *  land a Dakar-evening sale on the previous day. */
function toDateParam(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function percentDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function formatDayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
  })
}

/**
 * Builds a continuous 30-day series so the line chart never shows a gap on
 * days with no sales — a break in the line reads as "app broken" to a
 * non-technical user, whereas a flat run at zero reads as "quiet day".
 */
function buildDailySeries(rows: RpcDailyRow[], from: Date, days: number): DailyRevenuePoint[] {
  const byDay = new Map<string, number>()
  rows.forEach((row) => {
    // `day` may arrive as a bare date or a full timestamp; keep the date part.
    byDay.set(String(row.day).slice(0, 10), num(row.ca))
  })

  const base: Omit<DailyRevenuePoint, 'moyenne7j'>[] = []
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(from)
    date.setDate(from.getDate() + offset)
    const key = toDateParam(date)
    base.push({ date: key, label: formatDayLabel(key), ca: byDay.get(key) ?? 0 })
  }

  return base.map((point, index) => {
    const window = base.slice(Math.max(0, index - 6), index + 1)
    const average = window.reduce((sum, item) => sum + item.ca, 0) / window.length
    return { ...point, moyenne7j: Math.round(average) }
  })
}

/* ------------------------------------------------------------------ *
 * Hook
 * ------------------------------------------------------------------ */

export function useAdminDashboard() {
  const [raw, setRaw] = useState<RpcPayload | null>(null)
  const [kiosqueNames, setKiosqueNames] = useState<Map<string, string>>(new Map())
  const [offreNames, setOffreNames] = useState<Map<string, string>>(new Map())
  const [allKiosques, setAllKiosques] = useState<{ id: string; nom: string }[]>([])
  const [timePeriod, setTimePeriod] = useState<AdminTimePeriod>('month')
  const [customDate, setCustomDate] = useState(() => toDateParam(new Date()))
  const [selectedKiosqueIds, setSelectedKiosqueIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** Window covered by the KPI cards and ranking; the trend stays a rolling
   *  30 days regardless (it's a trend line, not a period total). */
  const windows = useMemo(() => {
    const now = new Date()
    const dayOffset = (offset: number) => {
      const date = new Date(now)
      date.setDate(now.getDate() + offset)
      return date
    }
    switch (timePeriod) {
      case 'today':
        return { start: dayOffset(0), prev: dayOffset(-1) }
      case 'week':
        return { start: dayOffset(-6), prev: dayOffset(-13) }
      case 'custom': {
        const parts = customDate.split('-').map(Number)
        const start = new Date(parts[0], (parts[1] ?? 1) - 1, parts[2] ?? 1)
        const prev = new Date(start)
        prev.setDate(start.getDate() - 1)
        return { start, prev }
      }
      case 'month':
      default:
        return { start: startOfMonth(now), prev: previousMonthStart(now) }
    }
  }, [customDate, timePeriod])

  const startKey = toDateParam(windows.start)
  const prevKey = toDateParam(windows.prev)
  const kioskKey = selectedKiosqueIds.join(',')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const now = new Date()
      const last30Start = new Date(now)
      last30Start.setDate(now.getDate() - 29)

      // The RPC returns ids only, so we fetch the small lookup tables alongside
      // it to resolve display names. Both are tiny (one row per kiosk/offer)
      // and are covered by the admin read-all policies.
      const [statsResult, kiosquesResult, offresResult] = await Promise.all([
        supabase.rpc('get_admin_dashboard_stats', {
          p_month_start: toDateParam(windows.start),
          p_prev_start: toDateParam(windows.prev),
          p_last30_start: toDateParam(last30Start),
          // Requires the 20260919 migration; NULL = all kiosques.
          p_kiosque_ids: selectedKiosqueIds.length > 0 ? selectedKiosqueIds : null,
        }),
        supabase.from('kiosques').select('id, nom').order('nom'),
        supabase.from('offres').select('id, nom'),
      ])

      if (statsResult.error) throw statsResult.error
      if (kiosquesResult.error) throw kiosquesResult.error
      if (offresResult.error) throw offresResult.error

      const payload = (statsResult.data ?? {}) as Partial<RpcPayload>

      setRaw({
        current: payload.current ?? [],
        previous: payload.previous ?? [],
        daily: payload.daily ?? [],
      })
      const kiosqueRows = (kiosquesResult.data ?? []) as { id: string; nom: string }[]
      setKiosqueNames(new Map(kiosqueRows.map((row) => [row.id, row.nom])))
      setAllKiosques(kiosqueRows)
      setOffreNames(new Map((offresResult.data ?? []).map((row) => [row.id, row.nom])))
    } catch (caught) {
      console.error('Error loading admin dashboard:', caught)
      setError(
        caught instanceof Error
          ? caught.message
          : 'Impossible de charger le tableau de bord.'
      )
      setRaw(null)
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey, prevKey, kioskKey])

  useEffect(() => {
    load()
  }, [load])

  const toggleKiosk = useCallback((kiosqueId: string) => {
    setSelectedKiosqueIds((current) =>
      current.includes(kiosqueId)
        ? current.filter((id) => id !== kiosqueId)
        : [...current, kiosqueId]
    )
  }, [])

  const selectAllKiosques = useCallback(() => {
    setSelectedKiosqueIds(allKiosques.map((kiosque) => kiosque.id))
  }, [allKiosques])

  /** "Tous les kiosques": empty selection => the RPC call sends NULL. */
  const clearKiosques = useCallback(() => setSelectedKiosqueIds([]), [])

  /**
   * All derived data. Recomputed only when the payload, the name lookups, or
   * the selected period change — not on every render of the dashboard.
   */
  const data = useMemo<AdminDashboardData>(() => {
    if (!raw) return emptyData

    const currentRows = raw.current ?? []
    const previousRows = raw.previous ?? []

    // Revenue per kiosk, for both months.
    const currentCaByKiosque = new Map<string, number>()
    const currentNbByKiosque = new Map<string, number>()
    currentRows.forEach((row) => {
      currentCaByKiosque.set(
        row.kiosque_id,
        (currentCaByKiosque.get(row.kiosque_id) ?? 0) + num(row.ca)
      )
      currentNbByKiosque.set(
        row.kiosque_id,
        (currentNbByKiosque.get(row.kiosque_id) ?? 0) + num(row.nb)
      )
    })

    const previousCaByKiosque = new Map<string, number>()
    previousRows.forEach((row) => {
      previousCaByKiosque.set(
        row.kiosque_id,
        (previousCaByKiosque.get(row.kiosque_id) ?? 0) + num(row.ca)
      )
    })

    // The active window (chosen by the period filter) drives the cards and
    // the kiosk bar chart; the previous window only feeds the delta.
    const activeCaByKiosque = currentCaByKiosque
    const activeNbByKiosque = currentNbByKiosque

    const currentRevenue = [...currentCaByKiosque.values()].reduce((a, b) => a + b, 0)
    const previousRevenue = [...previousCaByKiosque.values()].reduce((a, b) => a + b, 0)
    const activeRevenue = currentRevenue
    const activeTransactions = currentRows.reduce((sum, row) => sum + num(row.nb), 0)

    // Kiosk league table / bar chart — scoped to the kiosque filter when one
    // is active, otherwise the full roster (data keys + every known kiosque).
    const kiosqueIds = scopedKiosqueIds(selectedKiosqueIds, activeCaByKiosque.keys(), kiosqueNames.keys())

    const kiosques: KiosquePerformance[] = [...kiosqueIds]
      .map((id) => {
        const caMois = activeCaByKiosque.get(id) ?? 0
        const nbVentes = activeNbByKiosque.get(id) ?? 0
        // Delta = selected window vs the window before it.
        const delta = percentDelta(caMois, previousCaByKiosque.get(id) ?? 0)

        return {
          id,
          nom: kiosqueNames.get(id) ?? 'Kiosque inconnu',
          caMois,
          nbVentes,
          panierMoyen: nbVentes > 0 ? Math.round(caMois / nbVentes) : 0,
          deltaVsPrevious: delta,
          statut: delta > 5 ? 'up' : delta < -5 ? 'down' : 'stable',
        } satisfies KiosquePerformance
      })
      .sort((a, b) => b.caMois - a.caMois)

    // Offer breakdown from the active window's per-offre rows.
    const offerMap = new Map<string, OfferBreakdownPoint>()
    currentRows.forEach((row) => {
      const name = row.offre_id
        ? offreNames.get(row.offre_id) ?? 'Offre inconnue'
        : 'Offre inconnue'
      const existing = offerMap.get(name) ?? { name, value: 0, ventes: 0, quantite: 0 }
      existing.value += num(row.ca)
      existing.ventes += num(row.nb)
      existing.quantite += num(row.qty)
      offerMap.set(name, existing)
    })
    const offerBreakdown = [...offerMap.values()].sort((a, b) => b.value - a.value)

    const now = new Date()
    const last30Start = new Date(now)
    last30Start.setDate(now.getDate() - 29)

    const topKiosque = kiosques[0]
    const topOffre = [...offerMap.values()].sort((a, b) => b.quantite - a.quantite)[0]

    return {
      kpis: {
        revenue: activeRevenue,
        revenueDelta: percentDelta(currentRevenue, previousRevenue),
        transactions: activeTransactions,
        transactionsDelta: 0,
        topKiosqueName: topKiosque?.caMois ? topKiosque.nom : 'Aucun',
        topKiosqueRevenue: topKiosque?.caMois ?? 0,
        topOffreName: topOffre?.name ?? 'Aucune',
        topOffreQty: topOffre?.quantite ?? 0,
      },
      kiosques,
      // The daily series is always the rolling 30 days regardless of the
      // period — it's a trend line, and cutting it to the window would make
      // short periods a stub.
      dailyRevenue: buildDailySeries(raw.daily ?? [], last30Start, 30),
      offerBreakdown,
    }
  }, [raw, kiosqueNames, offreNames, selectedKiosqueIds])

  return useMemo(
    () => ({
      ...data,
      timePeriod,
      setTimePeriod,
      customDate,
      setCustomDate,
      selectedKiosqueIds,
      toggleKiosk,
      clearKiosques,
      selectAllKiosques,
      allKiosques,
      isLoading,
      error,
      refresh: load,
    }),
    [data, toggleKiosk, clearKiosques, selectAllKiosques, timePeriod, customDate, selectedKiosqueIds, allKiosques, isLoading, error, load]
  )
}
