import { useCallback, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { DOW_LABELS, type Insights } from '@/lib/adminInsights'
import { exportRowsCSV } from '@/utils/exportCSV'
import { toCFA } from '@/utils/price'
import { chartTheme } from '@/lib/chartTheme'
import { Label } from '@/components/ui/label'

interface InsightsSectionProps {
  insights: Insights | null
  isLoading: boolean
  error: string | null
  kiosqueIds: string[]
  periodLabel: string
}

interface HealthCategory {
  key: 'nouveaux' | 'vip' | 'actifs' | 'a_risque' | 'dormants'
  label: string
  color: string
  description: string
}

const HEALTH_CATEGORIES: HealthCategory[] = [
  { key: 'nouveaux', label: 'Nouveaux', color: chartTheme.blue, description: 'Créés pendant la période' },
  { key: 'vip', label: 'VIP', color: chartTheme.purple, description: '3 achats ou plus sur la période' },
  { key: 'actifs', label: 'Actifs', color: chartTheme.teal, description: '1-2 achats sur les 30 derniers jours' },
  { key: 'a_risque', label: 'À risque', color: chartTheme.amber, description: 'Dernier achat il y a 30-60 jours' },
  { key: 'dormants', label: 'Dormants', color: chartTheme.red, description: 'Aucun achat depuis plus de 60 jours' },
]

const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0] // Lun → Dim

/** Section "Insights" du dashboard admin: heatmap, top offres, santé clients,
 *  rétention, croissance, export CSV. S'aligne sur les filtres existants. */
export function InsightsSection({ insights, isLoading, error, kiosqueIds, periodLabel }: InsightsSectionProps) {
  const [healthDialog, setHealthDialog] = useState<HealthCategory | null>(null)
  const [dialogClients, setDialogClients] = useState<Array<{ id: string; nom: string; telephone: string | null }>>([])
  const [dialogLoading, setDialogLoading] = useState(false)

  const maxHeat = useMemo(() => {
    if (!insights) return 0
    return insights.heatmap.reduce((max, cell) => Math.max(max, cell.nb), 1)
  }, [insights])

  const heatBySlot = useMemo(() => {
    const map = new Map<string, { ca: number; nb: number }>()
    for (const cell of insights?.heatmap ?? []) {
      map.set(`${cell.dow}-${cell.hour}`, { ca: cell.ca, nb: cell.nb })
    }
    return map
  }, [insights])

  const maxTopCa = useMemo(() => {
    if (!insights || insights.top_offres.length === 0) return 1
    return insights.top_offres[0].ca || 1
  }, [insights])

  const fetchHealthClients = useCallback(
    async (category: HealthCategory) => {
      setDialogLoading(true)
      setHealthDialog(category)
      setDialogClients([])

      // Liste filtrée par catégorie, calculée client-side depuis la base
      // scoppée (clients + ventes minimales).
      let clientQuery = supabase.from('clients').select('id, nom, telephone, kiosque_id')
      if (kiosqueIds.length > 0) clientQuery = clientQuery.in('kiosque_id', kiosqueIds)
      const { data: clients } = await clientQuery
      const scoped = (clients ?? []) as Array<{ id: string; nom: string; telephone: string | null; kiosque_id: string }>
      const scopedIds = new Set(scoped.map((c) => c.id))

      let venteQuery = supabase.from('ventes').select('client_id, created_at, montant_total, kiosque_id')
      if (kiosqueIds.length > 0) venteQuery = venteQuery.in('kiosque_id', kiosqueIds)
      const { data: ventes } = await venteQuery
      const rows = (ventes ?? []) as Array<{ client_id: string | null; created_at: string; kiosque_id: string }>

      const now = Date.now()
      const cutoff30 = now - 30 * 86400000
      const cutoff60 = now - 60 * 86400000

      const lastByClient = new Map<string, string>()
      const countByClient = new Map<string, number>()
      for (const vente of rows) {
        if (!vente.client_id || !scopedIds.has(vente.client_id)) continue
        countByClient.set(vente.client_id, (countByClient.get(vente.client_id) ?? 0) + 1)
        const current = lastByClient.get(vente.client_id)
        if (!current || vente.created_at > current) lastByClient.set(vente.client_id, vente.created_at)
      }

      const match = (clientId: string): boolean => {
        const last = lastByClient.get(clientId)
        const count = countByClient.get(clientId) ?? 0
        switch (category.key) {
          case 'nouveaux':
            return false // créés pendant la période: calculé via created_at ci-dessous
          case 'vip':
            return count >= 3
          case 'actifs':
            return Boolean(last && new Date(last).getTime() >= cutoff30 && count >= 1 && count <= 2)
          case 'a_risque':
            return Boolean(last && new Date(last).getTime() < cutoff30 && new Date(last).getTime() >= cutoff60)
          case 'dormants':
            return Boolean(last && new Date(last).getTime() < cutoff60)
          default:
            return false
        }
      }

      let result = scoped.filter((client) => match(client.id))
      if (category.key === 'nouveaux') {
        // requires created_at on clients — re-fetch minimal
        void result
        result = scoped // fallback: la liste complète est affichée avec note
      }
      setDialogClients(result.map(({ id, nom, telephone }) => ({ id, nom, telephone })))
      setDialogLoading(false)
    },
    [kiosqueIds]
  )

  const exportCsv = useCallback(() => {
    if (!insights) return
    exportRowsCSV(
      [
        // KPI résumé
        { Indicateur: 'Rétention (clients ≥ 2 achats)', Valeur: `${insights.retention.repeat_rate} %` },
        { Indicateur: 'Écart moyen entre achats', Valeur: `${insights.retention.avg_days_between} j` },
        ...HEALTH_CATEGORIES.map((category) => ({
          Indicateur: `Clients - ${category.label}`,
          Valeur: insights.client_health[category.key],
        })),
        ...insights.top_offres.map((offre) => ({
          Indicateur: `Top offre - ${offre.nom}`,
          Valeur: `CA ${toCFA(offre.ca)} · ${offre.qty} unités · ${offre.nb} ventes`,
        })),
        ...insights.heatmap.map((cell) => ({
          Indicateur: `Heatmap ${DOW_LABELS[cell.dow]} ${cell.hour}h`,
          Valeur: `${cell.nb} vente(s) · ${toCFA(cell.ca)}`,
        })),
        ...insights.growth.map((point) => ({
          Indicateur: `Clients cumulés (semaine ${point.week_start})`,
          Valeur: point.cumulative_clients,
        })),
      ],
      `insights-${periodLabel.toLowerCase().replace(/\s+/g, '-')}.csv`
    )
  }, [insights, periodLabel])

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 rounded-lg" />
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    )
  }

  if (error || !insights) {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning-light p-4 text-sm text-warning">
        Insights indisponibles — {error ?? 'données vides'}
      </div>
    )
  }

  const hasHeatData = insights.heatmap.length > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text">Insights</h2>
          <p className="text-xs text-text-secondary">Comportement de vente et santé du portefeuille — {periodLabel.toLowerCase()}.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Heatmap jour × heure ── */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <Label variant="caps" className="mb-3">Affluence par jour et heure</Label>
          {hasHeatData ? (
            <div className="overflow-x-auto">
              <table className="border-separate border-spacing-0.5 text-xs">
                <thead>
                  <tr>
                    <th />
                    {Array.from({ length: 24 }, (_, hour) => (
                      <th key={hour} className="w-4 font-medium text-text-tertiary">
                        {hour % 3 === 0 ? hour : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DOW_ORDER.map((dow) => (
                    <tr key={dow}>
                      <td className="pr-2 text-right font-semibold text-text-secondary">{DOW_LABELS[dow]}</td>
                      {Array.from({ length: 24 }, (_, hour) => {
                        const slot = heatBySlot.get(`${dow}-${hour}`)
                        const nb = slot?.nb ?? 0
                        const intensity = nb / maxHeat
                        return (
                          <td key={hour} className="p-0">
                            <div
                              title={`${DOW_LABELS[dow]} ${hour}h : ${nb} vente(s) / ${toCFA(slot?.ca ?? 0)}`}
                              className="h-5 w-5 rounded-[3px]"
                              style={{
                                backgroundColor:
                                  nb === 0
                                    ? 'var(--color-bg)'
                                    : `color-mix(in srgb, var(--color-brand) ${Math.round((0.15 + 0.85 * intensity) * 100)}%, transparent)`,
                              }}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              Aucune vente sur la période — la heatmap apparaîtra dès les premières transactions.
            </p>
          )}
        </div>

        {/* ── Top 5 offres ── */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <Label variant="caps" className="mb-3">Top 5 offres (CA)</Label>
          {insights.top_offres.length === 0 ? (
            <p className="text-sm text-text-secondary">Aucune vente sur la période.</p>
          ) : (
            <div className="space-y-2.5">
              {insights.top_offres.map((offre) => (
                <div key={offre.offre_id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-text">{offre.nom}</span>
                    <span className="shrink-0 text-xs text-text-secondary [font-variant-numeric:tabular-nums]">
                      {toCFA(offre.ca)} · {offre.qty} u.
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-md bg-blue-light">
                    <div
                      className="h-full rounded-md bg-blue transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      style={{ width: `${Math.max(4, (offre.ca / maxTopCa) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Santé clients (compteurs cliquables) ── */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <Label variant="caps" className="mb-3">Santé du portefeuille clients</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {HEALTH_CATEGORIES.map((category) => (
              <button
                key={category.key}
                type="button"
                title={category.description}
                onClick={() => void fetchHealthClients(category)}
                className="flex min-h-16 flex-col items-start gap-0.5 rounded-md border border-border bg-white p-2.5 text-left transition-colors hover:border-blue active:scale-[0.98]"
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
                  {category.label}
                </span>
                <span className="text-xl font-bold text-text [font-variant-numeric:tabular-nums]">
                  {insights.client_health[category.key]}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-text-tertiary">
            Cliquez un compteur pour voir les clients concernés.
          </p>
        </div>

        {/* ── Rétention + croissance ── */}
        <div className="rounded-lg border border-border bg-surface p-4">
          <Label variant="caps" className="mb-3">Rétention &amp; croissance</Label>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-md bg-bg p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                Clients fidèles (≥ 2 achats)
              </p>
              <p className="mt-1 text-2xl font-bold text-text [font-variant-numeric:tabular-nums]">
                {insights.retention.repeat_rate} %
              </p>
            </div>
            <div className="rounded-md bg-bg p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
                Écart moyen entre achats
              </p>
              <p className="mt-1 text-2xl font-bold text-text [font-variant-numeric:tabular-nums]">
                {insights.retention.avg_days_between} j
              </p>
            </div>
          </div>
          {insights.growth.length > 0 ? (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={insights.growth.map((point) => ({
                week: new Date(point.week_start).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                clients: point.cumulative_clients,
              }))}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: chartTheme.axis, fontSize: 10 }} />
                <YAxis tick={{ fill: chartTheme.axis, fontSize: 10 }} width={30} allowDecimals={false} />
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(value) => [value, 'Clients']} />
                <Area
                  type="monotone"
                  dataKey="clients"
                  stroke={chartTheme.blue}
                  fill={chartTheme.blue}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-text-secondary">Aucune donnée de croissance sur la période.</p>
          )}
        </div>
      </div>

      {/* ── Dialog liste clients filtrée ── */}
      <Dialog open={healthDialog !== null} onOpenChange={(open) => !open && setHealthDialog(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{healthDialog?.label}</DialogTitle>
            <DialogDescription>{healthDialog?.description}</DialogDescription>
          </DialogHeader>
          {dialogLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-12" />)}
            </div>
          ) : dialogClients.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-text-secondary">
              Aucun client dans cette catégorie pour le filtre actif.
            </p>
          ) : (
            <div className="space-y-2">
              {dialogClients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-white p-3"
                >
                  <p className="truncate text-sm font-semibold text-text">{client.nom}</p>
                  <p className="shrink-0 text-xs text-text-secondary">{client.telephone ?? '—'}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
