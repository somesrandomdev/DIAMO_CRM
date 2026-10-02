import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Edit, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/input'
import { KPICard } from '@/components/ui/kpi-card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadMoreButton } from '@/components/LoadMoreButton'
import { SearchBar } from '@/components/SearchBar'
import {
  EditClientDialog,
  EditVenteDialog,
  type EditableClient,
  type EditableVente,
  type VenteOption,
} from '@/components/EditDialogs'
import { DailyTrendChart } from '@/components/charts/DailyTrendChart'
import { KioskClientsPanel } from '@/features/kiosk/KioskClientsPanel'
import {
  formatDay,
  type KioskClientRow,
  type KioskOverviewExtra,
  type KioskOverviewRow,
  type KioskOverviewSort,
} from '@/features/kiosk/types'
import { buildDailySeries, monthPeriod } from '@/lib/commercialStats'
import { supabase } from '@/lib/supabase'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { usePagedRpc } from '@/lib/usePagedRpc'
import { toCFA } from '@/utils/price'

const SORT_OPTIONS: { value: KioskOverviewSort; label: string }[] = [
  { value: 'pct_asc', label: 'Les plus en retard' },
  { value: 'ca', label: 'CA le plus élevé' },
  { value: 'activite', label: 'Activité la plus récente' },
  { value: 'nom', label: 'Nom (A → Z)' },
]

const SALES_PAGE = 20

interface SaleRow {
  id: string
  kiosque_id: string
  client_id: string | null
  offre_id: string | null
  quantite: number
  montant_total: number | null
  created_at: string
  clients?: { nom?: string } | { nom?: string }[] | null
  offres?: { nom?: string } | { nom?: string }[] | null
}

function firstJoined<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/**
 * Commercial: the supervised kiosks of the month, aggregated and paged in
 * Postgres (kiosk_overview, scoped server-side to this commercial). One list,
 * furthest behind its objective first; a kiosk opens its detail (?kiosque=…).
 */
export default function CommercialDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('kiosque')
  const [month] = useState(() => monthPeriod(0))

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim(), 300)
  const [sort, setSort] = useState<KioskOverviewSort>('pct_asc')
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey((key) => key + 1)

  const kiosks = usePagedRpc<KioskOverviewRow, KioskOverviewExtra>(
    'kiosk_overview',
    { p_from: month.from, p_to: month.to, p_search: search || null, p_sort: sort, p_only_active: false },
    { refreshKey }
  )
  const totals = kiosks.extra?.totals

  const [trendRows, setTrendRows] = useState<Array<{ day: string; ca: number }>>([])
  useEffect(() => {
    let cancelled = false
    supabase.rpc('scoped_daily_revenue', { p_days: 30 }).then(({ data, error }) => {
      if (cancelled) return
      if (error) console.error('[scoped_daily_revenue]', error.code, error.message)
      setTrendRows((data as Array<{ day: string; ca: number }> | null) ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [refreshKey])
  const dailySeries = useMemo(
    () => buildDailySeries(trendRows.map((point) => ({ created_at: point.day, montant_total: point.ca }))),
    [trendRows]
  )

  const openKiosk = (id: string | null) => setSearchParams(id ? { kiosque: id } : {})

  if (selectedId) {
    return (
      <KioskDetail
        kiosqueId={selectedId}
        knownRow={kiosks.rows.find((row) => row.kiosque_id === selectedId) ?? null}
        month={month}
        onBack={() => openKiosk(null)}
        onChanged={refresh}
      />
    )
  }

  const noKiosks = !kiosks.isLoading && totals?.kiosques === 0

  const columns: DataTableColumn<KioskOverviewRow>[] = [
    { key: 'nom', header: 'Kiosque', render: (row) => <span className="font-medium">{row.nom}</span> },
    { key: 'ca', header: 'CA du mois', align: 'right', render: (row) => <span className="font-mono">{toCFA(row.ca)}</span> },
    {
      key: 'objectif',
      header: 'Objectif',
      align: 'right',
      render: (row) => (row.objectif ? <span className="font-mono">{toCFA(row.objectif)}</span> : <span className="text-text-tertiary">—</span>),
    },
    {
      key: 'pct',
      header: 'Réalisation',
      render: (row) =>
        row.pct !== null ? (
          <div className="ml-auto w-28">
            <Progress value={row.pct} />
            <p className="mt-1 text-right text-xs font-semibold text-text-secondary">{Math.round(row.pct)} %</p>
          </div>
        ) : (
          <span className="text-xs text-text-tertiary">Non défini</span>
        ),
    },
    { key: 'ventes', header: 'Ventes', align: 'right', render: (row) => row.nb_ventes },
    { key: 'last', header: 'Dernière vente', render: (row) => formatDay(row.last_sale_at) },
    { key: 'open', header: '', align: 'right', render: () => <ChevronRight className="ml-auto h-4 w-4 text-text-tertiary" /> },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text">Supervision</h1>
        <p className="text-sm text-text-secondary">
          {totals ? `Vos ${totals.kiosques} kiosque${totals.kiosques > 1 ? 's' : ''} — cumul du mois.` : 'Vos kiosques — cumul du mois.'}
        </p>
      </div>

      {noKiosks ? (
        <EmptyState
          icon={<Store className="h-5 w-5" />}
          title="Aucun kiosque supervisé"
          description="Demandez à un administrateur de vous assigner des kiosques pour suivre leurs performances."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {totals ? (
              <>
                <KPICard label="CA du mois" value={toCFA(totals.ca)} sub="Tous vos kiosques" />
                <KPICard label="Ventes" value={totals.nb_ventes} sub="Ce mois" />
                <KPICard label="Clients" value={totals.clients} sub="Tous vos kiosques" />
                <KPICard
                  label="Objectifs atteints"
                  value={`${totals.objectif_atteint} / ${totals.avec_objectif}`}
                  sub="Kiosques avec objectif"
                />
              </>
            ) : (
              [1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-[104px] rounded-lg" />)
            )}
          </div>


          <Card padding="md" className="space-y-3">
            <Label variant="caps">Mes kiosques</Label>
            <div className="grid gap-2 sm:grid-cols-[1fr_16rem]">
              <SearchBar value={searchInput} onChange={setSearchInput} placeholder="Rechercher un kiosque" />
              <Select fieldSize="lg" aria-label="Trier" value={sort} onChange={(event) => setSort(event.target.value as KioskOverviewSort)}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            {kiosks.error && <p className="text-sm text-red">{kiosks.error}</p>}

            {kiosks.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((item) => <Skeleton key={item} className="h-14 rounded-lg" />)}
              </div>
            ) : kiosks.rows.length === 0 ? (
              <EmptyState title="Aucun kiosque trouvé" description="Essayez un autre nom." className="border-0" />
            ) : (
              <>
                <div className="hidden sm:block">
                  <DataTable
                    columns={columns}
                    data={kiosks.rows}
                    getRowKey={(row) => row.kiosque_id}
                    onRowClick={(row) => openKiosk(row.kiosque_id)}
                  />
                </div>

                {/* Mobile: one tappable card per kiosk */}
                <ul className="space-y-2 sm:hidden">
                  {kiosks.rows.map((row) => (
                    <li key={row.kiosque_id}>
                      <button
                        type="button"
                        onClick={() => openKiosk(row.kiosque_id)}
                        className="w-full rounded-lg border border-border bg-surface p-3 text-left active:scale-[0.99]"
                        aria-label={`Voir le détail de ${row.nom}`}
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-text">{row.nom}</span>
                          <span className="shrink-0 text-xs text-text-secondary [font-variant-numeric:tabular-nums]">
                            {toCFA(row.ca)}
                            {row.objectif ? ` / ${toCFA(row.objectif)}` : ''}
                          </span>
                        </span>
                        {row.pct !== null ? (
                          <span className="mt-1.5 block">
                            <Progress value={row.pct} />
                            <span className="mt-0.5 block text-right text-xs font-semibold text-text-secondary">{Math.round(row.pct)} %</span>
                          </span>
                        ) : (
                          <span className="mt-1 block text-xs text-text-tertiary">Objectif non défini · {row.nb_ventes} vente(s)</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>

                <LoadMoreButton
                  shown={kiosks.rows.length}
                  total={kiosks.total}
                  isLoading={kiosks.isLoadingMore}
                  onClick={kiosks.loadMore}
                  noun="kiosques"
                />
              </>
            )}
          </Card>

          <Card padding="md">
            <Label variant="caps" className="mb-3">Tendance 30 jours (tous vos kiosques)</Label>
            <DailyTrendChart data={dailySeries} />
          </Card>
        </>
      )}
    </div>
  )
}

interface KioskDetailProps {
  kiosqueId: string
  knownRow: KioskOverviewRow | null
  month: { from: string; to: string }
  onBack: () => void
  onChanged: () => void
}

/** One supervised kiosk: month objective, its clients, its sales of the month. */
function KioskDetail({ kiosqueId, knownRow, month, onBack, onChanged }: KioskDetailProps) {
  const [row, setRow] = useState<KioskOverviewRow | null>(knownRow)
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => {
    setRefreshKey((key) => key + 1)
    onChanged()
  }

  // Deep link (?kiosque=…): the kiosk isn't in the loaded list — look it up
  // by name in the commercial's own scope, then match the id.
  useEffect(() => {
    if (knownRow) {
      setRow(knownRow)
      return
    }
    let cancelled = false
    void (async () => {
      const { data: kiosque } = await supabase.from('kiosques').select('nom').eq('id', kiosqueId).maybeSingle()
      const nom = (kiosque as { nom?: string } | null)?.nom
      if (!nom) return
      const { data } = await supabase.rpc('kiosk_overview', {
        p_from: month.from,
        p_to: month.to,
        p_search: nom,
        p_sort: 'nom',
        p_only_active: false,
        p_limit: 50,
        p_offset: 0,
      })
      const match = ((data as { rows?: KioskOverviewRow[] } | null)?.rows ?? []).find((item) => item.kiosque_id === kiosqueId)
      if (!cancelled) setRow(match ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [kiosqueId, knownRow, month.from, month.to])

  const [editingClient, setEditingClient] = useState<EditableClient | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button type="button" variant="outline" size="touch" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Tous mes kiosques
          </Button>
        </div>
        <h1 className="text-base font-semibold text-text">{row?.nom ?? 'Kiosque'}</h1>
      </div>

      <Card padding="md">
        <Label variant="caps">Objectif du mois</Label>
        {row?.objectif ? (
          <>
            <p className="mt-1 text-lg font-bold [font-variant-numeric:tabular-nums]">
              {toCFA(row.ca)} <span className="text-sm font-medium text-text-secondary">/ {toCFA(row.objectif)}</span>
            </p>
            <Progress value={row.pct ?? 0} className="mt-3 h-3 bg-bg" />
            <p className="mt-1 text-right text-xs font-semibold text-text-secondary [font-variant-numeric:tabular-nums]">
              {(row.pct ?? 0).toFixed(1)} %
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-text-secondary">
            {row ? `${toCFA(row.ca)} ce mois — aucun objectif défini.` : 'Chargement…'}
          </p>
        )}
        <p className="mt-0.5 text-xs text-text-secondary">Objectif fixé par l'administrateur.</p>
      </Card>

      <KioskClientsPanel
        kiosqueId={kiosqueId}
        kiosqueNom={row?.nom ?? 'ce kiosque'}
        onEdit={(client: KioskClientRow) => setEditingClient(client)}
        refreshKey={refreshKey}
      />

      <KioskSalesPanel kiosqueId={kiosqueId} monthFrom={month.from} refreshKey={refreshKey} onChanged={refresh} />

      <EditClientDialog
        open={editingClient !== null}
        onOpenChange={(open) => !open && setEditingClient(null)}
        client={editingClient}
        onSaved={refresh}
      />
    </div>
  )
}

/** The kiosk's sales of the month, newest first, 20 at a time (range()). */
function KioskSalesPanel({
  kiosqueId,
  monthFrom,
  refreshKey,
  onChanged,
}: {
  kiosqueId: string
  monthFrom: string
  refreshKey: number
  onChanged: () => void
}) {
  const [sales, setSales] = useState<SaleRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [editingVente, setEditingVente] = useState<EditableVente | null>(null)
  const [offres, setOffres] = useState<VenteOption[]>([])
  const [clientOptions, setClientOptions] = useState<VenteOption[]>([])

  const fetchSales = useCallback(
    async (offset: number) => {
      const { data, count, error } = await supabase
        .from('ventes')
        .select('id, kiosque_id, client_id, offre_id, quantite, montant_total, created_at, clients(nom), offres(nom)', { count: 'exact' })
        .eq('kiosque_id', kiosqueId)
        .gte('created_at', monthFrom)
        .order('created_at', { ascending: false })
        .range(offset, offset + SALES_PAGE - 1)
      if (error) console.error('[supervision] ventes', error.code, error.message)
      return { rows: (data ?? []) as SaleRow[], count: count ?? 0 }
    },
    [kiosqueId, monthFrom]
  )

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    void fetchSales(0).then(({ rows, count }) => {
      if (cancelled) return
      setSales(rows)
      setTotal(count)
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [fetchSales, refreshKey])

  const loadMore = async () => {
    setIsLoadingMore(true)
    const { rows, count } = await fetchSales(sales.length)
    setSales((previous) => [...previous, ...rows])
    setTotal(count)
    setIsLoadingMore(false)
  }

  // Active offers of the kiosk, for the vente edit dialog.
  useEffect(() => {
    let cancelled = false
    supabase
      .from('offres_kiosque')
      .select('offre_id, offres(id, nom)')
      .eq('kiosque_id', kiosqueId)
      .eq('est_actif', true)
      .then(({ data, error }) => {
        if (cancelled || error) return
        setOffres(
          (data ?? [])
            .map((row) => firstJoined((row as { offres?: unknown }).offres as VenteOption | VenteOption[] | null))
            .filter((offre): offre is VenteOption => offre !== null)
        )
      })
    return () => {
      cancelled = true
    }
  }, [kiosqueId])

  const openEdit = async (sale: SaleRow) => {
    setEditingVente({
      id: sale.id,
      quantite: sale.quantite,
      montant_total: sale.montant_total ?? 0,
      offre_id: sale.offre_id,
      client_id: sale.client_id,
    })
    // Client choices: the kiosk's first 200 by name + the sale's own client.
    const { data } = await supabase.rpc('kiosk_clients', {
      p_kiosque_id: kiosqueId,
      p_search: null,
      p_sort: 'nom',
      p_limit: 200,
      p_offset: 0,
    })
    const options = ((data as { rows?: KioskClientRow[] } | null)?.rows ?? []).map((client) => ({ id: client.id, nom: client.nom }))
    if (sale.client_id && !options.some((option) => option.id === sale.client_id)) {
      options.unshift({ id: sale.client_id, nom: firstJoined(sale.clients)?.nom ?? 'Client actuel' })
    }
    setClientOptions(options)
  }

  const venteOffres = useMemo(() => {
    // A sale can reference an inactive offer: keep it selectable.
    if (!editingVente?.offre_id || offres.some((offre) => offre.id === editingVente.offre_id)) return offres
    const sale = sales.find((row) => row.id === editingVente.id)
    return [...offres, { id: editingVente.offre_id, nom: firstJoined(sale?.offres)?.nom ?? 'Offre actuelle' }]
  }, [editingVente, offres, sales])

  const columns: DataTableColumn<SaleRow>[] = [
    { key: 'date', header: 'Date', render: (sale) => formatDay(sale.created_at) },
    { key: 'client', header: 'Client', render: (sale) => firstJoined(sale.clients)?.nom ?? '—' },
    { key: 'offre', header: 'Offre', render: (sale) => firstJoined(sale.offres)?.nom ?? '—' },
    {
      key: 'montant',
      header: 'Montant',
      align: 'right',
      render: (sale) => <span className="font-semibold [font-variant-numeric:tabular-nums]">{toCFA(sale.montant_total ?? 0)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (sale) => (
        <Button type="button" variant="outline" size="icon-lg" aria-label="Modifier la vente" onClick={() => void openEdit(sale)}>
          <Edit className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <Card padding="md" className="space-y-3">
      <Label variant="caps">Ventes du mois {isLoading ? '' : `(${total})`}</Label>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-14 rounded-lg" />)}
        </div>
      ) : sales.length === 0 ? (
        <EmptyState title="Aucune vente ce mois" className="border-0" />
      ) : (
        <>
          <div className="hidden sm:block">
            <DataTable columns={columns} data={sales} getRowKey={(sale) => sale.id} />
          </div>
          <ul className="space-y-2 sm:hidden">
            {sales.map((sale) => (
              <li key={sale.id} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-surface p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text">{formatDay(sale.created_at)}</p>
                  <p className="mt-0.5 truncate text-xs text-text-secondary">
                    {firstJoined(sale.clients)?.nom ?? '—'} · {firstJoined(sale.offres)?.nom ?? '—'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <p className="text-base font-bold text-text [font-variant-numeric:tabular-nums]">{toCFA(sale.montant_total ?? 0)}</p>
                  <Button type="button" variant="outline" size="icon-lg" aria-label="Modifier la vente" onClick={() => void openEdit(sale)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <LoadMoreButton shown={sales.length} total={total} isLoading={isLoadingMore} onClick={() => void loadMore()} noun="ventes" />
        </>
      )}

      <EditVenteDialog
        open={editingVente !== null}
        onOpenChange={(open) => !open && setEditingVente(null)}
        vente={editingVente}
        clients={clientOptions}
        offres={venteOffres}
        onSaved={onChanged}
      />
    </Card>
  )
}
