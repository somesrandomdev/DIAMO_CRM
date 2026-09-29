/**
 * Contrat de réponse de get_admin_insights — parsing/normalisation purs
 * (Postgres renvoie les numerics en strings, les json_agg vides en NULL).
 */

export interface TopOffrePoint {
  offre_id: string
  nom: string
  ca: number
  qty: number
  nb: number
}

export interface HeatmapCell {
  dow: number // 0 = dimanche (PG extract(dow))
  hour: number // 0-23
  ca: number
  nb: number
}

export interface ClientHealth {
  nouveaux: number
  vip: number
  actifs: number
  a_risque: number
  dormants: number
}

export interface Retention {
  repeat_rate: number
  avg_days_between: number
}

export interface GrowthPoint {
  week_start: string
  cumulative_clients: number
}

export interface Insights {
  top_offres: TopOffrePoint[]
  heatmap: HeatmapCell[]
  client_health: ClientHealth
  retention: Retention
  growth: GrowthPoint[]
}

function num(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function parseInsights(raw: unknown): Insights {
  const payload = (raw ?? {}) as Record<string, unknown>

  const topOffres = (Array.isArray(payload.top_offres) ? payload.top_offres : []).map(
    (item: Record<string, unknown>) => ({
      offre_id: String(item.offre_id ?? ''),
      nom: String(item.nom ?? 'Offre inconnue'),
      ca: num(item.ca),
      qty: num(item.qty),
      nb: num(item.nb),
    })
  )

  const heatmap = (Array.isArray(payload.heatmap) ? payload.heatmap : []).map(
    (item: Record<string, unknown>) => ({
      dow: num(item.dow),
      hour: num(item.hour),
      ca: num(item.ca),
      nb: num(item.nb),
    })
  )

  const health = (payload.client_health ?? {}) as Record<string, unknown>

  return {
    top_offres: topOffres,
    heatmap,
    client_health: {
      nouveaux: num(health.nouveaux),
      vip: num(health.vip),
      actifs: num(health.actifs),
      a_risque: num(health.a_risque),
      dormants: num(health.dormants),
    },
    retention: {
      repeat_rate: num((payload.retention as Record<string, unknown> | undefined)?.repeat_rate),
      avg_days_between: num(
        (payload.retention as Record<string, unknown> | undefined)?.avg_days_between
      ),
    },
    growth: (Array.isArray(payload.growth) ? payload.growth : []).map(
      (item: Record<string, unknown>) => ({
        week_start: String(item.week_start ?? ''),
        cumulative_clients: num(item.cumulative_clients),
      })
    ),
  }
}

export const DOW_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
