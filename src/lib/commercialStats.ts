/**
 * Pure aggregation logic for the commercial supervisor dashboard.
 * Kept free of React/Supabase so the KPI math is unit-testable.
 */

export interface SupervisedKiosque {
  id: string
  nom: string
}

export interface CommercialSale {
  id: string
  kiosque_id: string
  client_id: string | null
  montant_total: number | null
  created_at: string
}

export interface CommercialClient {
  id: string
  kiosque_id: string
  nom: string
  telephone?: string | null
}

export interface CommercialKpis {
  /** Sum of montant_total across all supervised kiosques for the month. */
  revenueMonth: number
  salesCount: number
  /** Total number of client rows across supervised kiosques. */
  clientsCount: number
  kiosquesCount: number
}

export function computeCommercialKpis(
  kiosques: SupervisedKiosque[],
  sales: CommercialSale[],
  clients: CommercialClient[]
): CommercialKpis {
  return {
    revenueMonth: sales.reduce((sum, sale) => sum + (sale.montant_total ?? 0), 0),
    salesCount: sales.length,
    clientsCount: clients.length,
    kiosquesCount: kiosques.length,
  }
}

export interface KioskRevenue {
  kiosqueId: string
  nom: string
  revenue: number
  salesCount: number
}

/** Revenue per kiosk for the bar chart, highest first; zero-revenue kiosques included. */
export function revenuePerKiosk(
  kiosques: SupervisedKiosque[],
  sales: CommercialSale[]
): KioskRevenue[] {
  const byId = new Map<string, KioskRevenue>(
    kiosques.map((kiosque) => [kiosque.id, { kiosqueId: kiosque.id, nom: kiosque.nom, revenue: 0, salesCount: 0 }])
  )

  for (const sale of sales) {
    const entry = byId.get(sale.kiosque_id)
    if (!entry) continue
    entry.revenue += sale.montant_total ?? 0
    entry.salesCount += 1
  }

  return Array.from(byId.values()).sort((a, b) => b.revenue - a.revenue)
}

export interface ClientPurchaseSummary {
  lastPurchase: string | null
  totalSpent: number
  purchaseCount: number
}

/** Per-client rollup of a sales list: last purchase date, total spent, count. */
export function clientPurchaseMap(
  sales: CommercialSale[]
): Map<string, ClientPurchaseSummary> {
  const map = new Map<string, ClientPurchaseSummary>()

  for (const sale of sales) {
    if (!sale.client_id) continue
    const entry = map.get(sale.client_id) ?? {
      lastPurchase: null,
      totalSpent: 0,
      purchaseCount: 0,
    }

    entry.totalSpent += sale.montant_total ?? 0
    entry.purchaseCount += 1
    if (!entry.lastPurchase || sale.created_at > entry.lastPurchase) {
      entry.lastPurchase = sale.created_at
    }
    map.set(sale.client_id, entry)
  }

  return map
}

/** 'YYYY-MM-01' — the format of the objectifs.mois column. */
export function monthKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

export function startOfMonth(date: Date = new Date()): Date {
  const result = new Date(date)
  result.setDate(1)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Which kiosque ids the ranking should render:
 * - a kiosque filter is active -> ONLY the selected kiosques (a filtered view
 *   must never list unfiltered kiosks padded with zeros);
 * - no filter (all kiosques)  -> every kiosque with data PLUS the full roster
 *   so newly-created kiosks still appear at zero.
 */
export function scopedKiosqueIds(
  selectedIds: string[],
  dataKeys: Iterable<string>,
  allKioskIds: Iterable<string>
): string[] {
  if (selectedIds.length > 0) return [...new Set(selectedIds)]
  return [...new Set([...dataKeys, ...allKioskIds])]
}

export interface CommercialDailyPoint {
  date: string
  label: string
  ca: number
  moyenne7j: number
}

/**
 * Continuous N-day aggregate revenue series (zero-filled so the chart never
 * shows gaps) with a 7-day rolling average. Shape-compatible with the
 * dashboard's DailyRevenuePoint.
 */
export function buildDailySeries(
  sales: Array<{ created_at: string; montant_total: number | null }>,
  days: number = 30,
  now: Date = new Date()
): CommercialDailyPoint[] {
  const byDay = new Map<string, number>()
  for (const sale of sales) {
    const key = sale.created_at.slice(0, 10)
    byDay.set(key, (byDay.get(key) ?? 0) + (sale.montant_total ?? 0))
  }

  // Local-time YYYY-MM-DD keys: toISOString() would shift to UTC and can
  // land an evening sale on the previous day.
  const base: Array<{ date: string; label: string; ca: number }> = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now)
    date.setDate(now.getDate() - offset)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    base.push({
      date: key,
      label: new Date(`${key}T00:00:00`).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
      }),
      ca: byDay.get(key) ?? 0,
    })
  }

  return base.map((point, index) => {
    const window = base.slice(Math.max(0, index - 6), index + 1)
    const average = window.reduce((sum, item) => sum + item.ca, 0) / window.length
    return { ...point, moyenne7j: Math.round(average) }
  })
}
