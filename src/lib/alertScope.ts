/**
 * Admin alerts only watch ACTIVE kiosks, so the ~60 never-opened kiosks of
 * the catalogue don't each raise "no sale for 48 h". Same rule as
 * public.admin_active_kiosque_ids() (migration 20261009_alerts_scope.sql):
 * a kiosk is active if it has an assigned fontainier OR at least one sale
 * in the last 30 days.
 */
export const ACTIVE_SALE_WINDOW_DAYS = 30

export interface ScopeProfile {
  kiosque_id: string | null
  role: string
  deleted_at: string | null
}

export interface ScopeSale {
  kiosque_id: string | null
  created_at: string
}

export function activeKiosqueIds(
  kiosqueIds: string[],
  profiles: ScopeProfile[],
  sales: ScopeSale[],
  now: Date = new Date()
): Set<string> {
  const since = now.getTime() - ACTIVE_SALE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const staffed = new Set(
    profiles
      .filter((p) => p.role === 'fontainier' && p.deleted_at === null && p.kiosque_id)
      .map((p) => p.kiosque_id as string)
  )
  const selling = new Set(
    sales
      .filter((s) => s.kiosque_id && new Date(s.created_at).getTime() >= since)
      .map((s) => s.kiosque_id as string)
  )
  return new Set(kiosqueIds.filter((id) => staffed.has(id) || selling.has(id)))
}

/** Libellés des filtres, par règle d'alerte existante. */
export const ALERT_RULE_LABELS: Record<string, string> = {
  inactif_48h: 'Sans vente 48 h',
  inactif_today: "Sans vente aujourd'hui",
  objectif_en_danger: 'Objectif non atteint',
  offre_sous_perf: 'Offre peu vendue',
}
