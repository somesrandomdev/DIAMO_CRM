/**
 * Pure date/series helpers shared by the dashboards. Kept free of
 * React/Supabase so they are unit-testable. (Per-kiosk KPIs are computed in
 * Postgres: kiosk_overview, migration 20261011_scalable_pages.sql.)
 */

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
 * [from, to) ISO bounds of a calendar-month period: monthsAgo = 0 is the
 * current month; months > 1 extends back (3 = this month and the 2 before).
 */
export function monthPeriod(monthsAgo = 0, months = 1, now: Date = new Date()): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth() - monthsAgo - (months - 1), 1)
  const to = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 1)
  return { from: from.toISOString(), to: to.toISOString() }
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
