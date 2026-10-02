/** Rows returned by the kiosk_overview / kiosk_clients / fontainier_performance
 *  Postgres functions (migration 20261011_scalable_pages.sql). */

export interface KioskOverviewRow {
  kiosque_id: string
  nom: string
  adresse: string | null
  nb_clients: number
  nouveaux_7j: number
  ca: number
  nb_ventes: number
  clients_actifs: number
  last_sale_at: string | null
  objectif: number | null
  pct: number | null
  top_client: string | null
  best_offre: string | null
}

export interface KioskOverviewExtra {
  totals: {
    kiosques: number
    kiosques_actifs: number
    clients: number
    nouveaux_7j: number
    ca: number
    nb_ventes: number
    avec_objectif: number
    objectif_atteint: number
  }
}

export type KioskOverviewSort = 'nom' | 'ca' | 'clients' | 'activite' | 'pct_asc' | 'pct_desc' | 'ventes'

export interface KioskClientRow {
  id: string
  kiosque_id: string
  nom: string
  telephone: string | null
  adresse: string | null
  email: string | null
  notes: string | null
  type_client: string | null
  nombre_personnes: number | null
  created_at: string | null
  total_depense: number
  dernier_achat: string | null
  nb_achats: number
}

export type KioskClientSort = 'nom' | 'depense' | 'dernier_achat' | 'recent'

export function formatDay(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString('fr-FR') : '—'
}
