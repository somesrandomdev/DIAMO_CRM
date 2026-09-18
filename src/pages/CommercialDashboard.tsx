import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Edit, Store, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { SearchBar } from '@/components/SearchBar'
import { PosCard, PosChip, PosKpi, PosLabel } from '@/components/pos'
import {
  CreateObjectifDialog,
  EditClientDialog,
  EditObjectifDialog,
  EditVenteDialog,
  type EditableClient,
  type EditableObjectif,
  type EditableVente,
  type VenteOption,
} from '@/components/EditDialogs'
import { useToast } from '@/components/Toast'
import { chartTheme } from '@/lib/chartTheme'
import { supabase } from '@/lib/supabase'
import {
  buildDailySeries,
  clientPurchaseMap,
  computeCommercialKpis,
  monthKey,
  revenuePerKiosk,
  startOfMonth,
  type CommercialClient,
  type CommercialSale,
  type SupervisedKiosque,
} from '@/lib/commercialStats'
import { DailyTrendChart } from '@/components/charts/DailyTrendChart'
import type { DailyRevenuePoint } from '@/components/dashboard/useAdminDashboard'
import { useAuthStore } from '@/stores/authStore'
import { formatCFACompact, toCFA } from '@/utils/price'

interface SaleRow extends CommercialSale {
  offre_id: string | null
  quantite: number
  clients?: { nom?: string } | { nom?: string }[] | null
  offres?: { nom?: string } | { nom?: string }[] | null
}

interface TrendRow {
  kiosque_id: string
  montant_total: number | null
  created_at: string
}

interface ClientRow extends CommercialClient {
  adresse?: string | null
  email?: string | null
  notes?: string | null
}

interface ObjectifRow {
  id: string
  kiosque_id: string
  ca_cible: number
}

function firstJoined<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export default function CommercialDashboard() {
  const { profile } = useAuthStore()
  const { showToast } = useToast()
  const [kiosques, setKiosques] = useState<SupervisedKiosque[]>([])
  const [sales, setSales] = useState<SaleRow[]>([])
  const [clients, setClients] = useState<ClientRow[]>([])
  const [objectifs, setObjectifs] = useState<ObjectifRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedKiosqueId, setSelectedKiosqueId] = useState<string | null>(null)
  const [drillOffres, setDrillOffres] = useState<VenteOption[]>([])
  const [editingClient, setEditingClient] = useState<EditableClient | null>(null)
  const [editingVente, setEditingVente] = useState<EditableVente | null>(null)
  const [editingObjectif, setEditingObjectif] = useState<EditableObjectif | null>(null)
  const [isCreatingObjectif, setIsCreatingObjectif] = useState(false)
  const [dailySeries, setDailySeries] = useState<DailyRevenuePoint[]>([])

  const load = useCallback(async () => {
    if (!profile?.id) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    const { data: assignments, error: assignmentsError } = await supabase
      .from('commercials_kiosques')
      .select('kiosque_id, kiosques(id, nom)')
      .eq('commercial_id', profile.id)

    if (assignmentsError) {
      console.error('Error loading supervised kiosques:', assignmentsError)
      showToast({
        type: 'error',
        title: 'Chargement impossible',
        message: "Vos kiosques supervisés n'ont pas pu être chargés. Veuillez réessayer.",
      })
      setKiosques([])
      setSales([])
      setClients([])
      setObjectifs([])
      setDailySeries([])
      setIsLoading(false)
      return
    }

    const supervised: SupervisedKiosque[] = (assignments ?? [])
      .map((row) => firstJoined(row.kiosques as SupervisedKiosque | SupervisedKiosque[] | null))
      .filter((kiosque): kiosque is SupervisedKiosque => kiosque !== null)
    setKiosques(supervised)

    if (supervised.length === 0) {
      setSales([])
      setClients([])
      setObjectifs([])
      setDailySeries([])
      setIsLoading(false)
      return
    }

    const kiosqueIds = supervised.map((kiosque) => kiosque.id)
    const trendStart = new Date()
    trendStart.setDate(trendStart.getDate() - 29)
    const [salesResult, clientsResult, objectifsResult, trendResult] = await Promise.all([
      supabase
        .from('ventes')
        .select('id, kiosque_id, client_id, offre_id, quantite, montant_total, created_at, clients(nom), offres(nom)')
        .in('kiosque_id', kiosqueIds)
        .gte('created_at', startOfMonth().toISOString())
        .order('created_at', { ascending: false }),
      supabase
        .from('clients')
        .select('id, kiosque_id, nom, telephone, adresse, email, notes')
        .in('kiosque_id', kiosqueIds)
        .order('nom'),
      supabase
        .from('objectifs')
        .select('id, kiosque_id, ca_cible')
        .in('kiosque_id', kiosqueIds)
        .eq('mois', monthKey()),
      supabase
        .from('ventes')
        .select('kiosque_id, montant_total, created_at')
        .in('kiosque_id', kiosqueIds)
        .gte('created_at', trendStart.toISOString()),
    ])

    const failure =
      salesResult.error ?? clientsResult.error ?? objectifsResult.error ?? trendResult.error
    if (failure) {
      console.error('Error loading supervisor dashboard:', failure)
      showToast({
        type: 'error',
        title: 'Chargement incomplet',
        message: 'Certaines données ont échoué au chargement. Veuillez réessayer.',
      })
    }

    setSales((salesResult.data ?? []) as SaleRow[])
    setClients((clientsResult.data ?? []) as ClientRow[])
    setObjectifs((objectifsResult.data ?? []) as ObjectifRow[])
    setDailySeries(buildDailySeries((trendResult.data ?? []) as TrendRow[]))
    setIsLoading(false)
  }, [profile?.id, showToast])

  useEffect(() => {
    load()
  }, [load])

  // Active offers of the drilled-down kiosk, used by the vente edit dialog.
  useEffect(() => {
    if (!selectedKiosqueId) {
      setDrillOffres([])
      return
    }

    let cancelled = false
    supabase
      .from('offres_kiosque')
      .select('offre_id, offres(id, nom)')
      .eq('kiosque_id', selectedKiosqueId)
      .eq('est_actif', true)
      .then(({ data, error }) => {
        if (cancelled || error) return
        const options = (data ?? [])
          .map((row) => firstJoined((row as { offres?: unknown }).offres as VenteOption | VenteOption[] | null))
          .filter((offre): offre is VenteOption => offre !== null)
        setDrillOffres(options)
      })
    return () => {
      cancelled = true
    }
  }, [selectedKiosqueId])

  const kpis = useMemo(() => computeCommercialKpis(kiosques, sales, clients), [kiosques, sales, clients])
  const perKiosk = useMemo(() => revenuePerKiosk(kiosques, sales), [kiosques, sales])
  const purchases = useMemo(() => clientPurchaseMap(sales), [sales])

  /** Month CA vs target per kiosk, worst progress first — the at-a-glance
   *  underperformer list. Kiosques without a target sort last. */
  const objectifRows = useMemo(() => {
    const targetByKiosque = new Map(objectifs.map((objectif) => [objectif.kiosque_id, objectif.ca_cible]))
    return kiosques
      .map((kiosque) => {
        const revenue = perKiosk.find((row) => row.kiosqueId === kiosque.id)?.revenue ?? 0
        const target = targetByKiosque.get(kiosque.id) ?? null
        const pct = target !== null && target > 0 ? (revenue / target) * 100 : null
        return { kiosque, revenue, target, pct }
      })
      .sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1))
  }, [kiosques, objectifs, perKiosk])

  const selectedKiosque = kiosques.find((kiosque) => kiosque.id === selectedKiosqueId) ?? null
  const allKioskSales = useMemo(
    () => sales.filter((sale) => sale.kiosque_id === selectedKiosqueId),
    [sales, selectedKiosqueId]
  )
  const allKioskClients = useMemo(
    () => clients.filter((client) => client.kiosque_id === selectedKiosqueId),
    [clients, selectedKiosqueId]
  )

  // Drill-down search + progressive display: the kiosk can have hundreds of
  // clients; search first, then show 20 at a time behind a "Charger plus".
  const [clientSearch, setClientSearch] = useState('')
  const [visibleClients, setVisibleClients] = useState(20)
  const [visibleSales, setVisibleSales] = useState(10)

  // Reset the paging when switching kiosques or typing.
  useEffect(() => {
    setVisibleClients(20)
  }, [selectedKiosqueId, clientSearch])
  useEffect(() => {
    setVisibleSales(10)
  }, [selectedKiosqueId])

  const kioskClients = useMemo(() => {
    const needle = clientSearch.trim().toLowerCase()
    if (!needle) return allKioskClients
    return allKioskClients.filter(
      (client) =>
        client.nom.toLowerCase().includes(needle) ||
        (client.telephone ?? '').toLowerCase().includes(needle)
    )
  }, [allKioskClients, clientSearch])
  const shownClients = kioskClients.slice(0, visibleClients)
  const kioskSales = allKioskSales.slice(0, visibleSales)

  const kioskObjectif = objectifs.find((objectif) => objectif.kiosque_id === selectedKiosqueId) ?? null
  const kioskRevenue = perKiosk.find((row) => row.kiosqueId === selectedKiosqueId)?.revenue ?? 0
  const objectifProgress = kioskObjectif && kioskObjectif.ca_cible > 0
    ? (kioskRevenue / kioskObjectif.ca_cible) * 100
    : 0

  const venteOffreOptions = useMemo(() => {
    // A vente can reference an inactive (or missing) offre that isn't in the
    // active-offres list; add it as a fallback option so the select can still
    // display it. ventes.offre_id is nullable — skip the fallback then.
    if (!editingVente?.offre_id) return drillOffres
    if (drillOffres.some((offre) => offre.id === editingVente.offre_id)) return drillOffres
    const sale = sales.find((row) => row.id === editingVente.id)
    const nom = firstJoined(sale?.offres)?.nom ?? 'Offre actuelle'
    return [...drillOffres, { id: editingVente.offre_id, nom }]
  }, [drillOffres, editingVente, sales])

  const clientColumns: DataTableColumn<ClientRow>[] = [
    {
      key: 'nom',
      header: 'Client',
      render: (client) => <span className="font-medium">{client.nom}</span>,
      sortValue: (client) => client.nom,
    },
    {
      key: 'telephone',
      header: 'Téléphone',
      render: (client) => client.telephone || '—',
      sortValue: (client) => client.telephone ?? '',
    },
    {
      key: 'lastPurchase',
      header: 'Dernier achat',
      render: (client) => {
        const last = purchases.get(client.id)?.lastPurchase
        return last ? new Date(last).toLocaleDateString('fr-FR') : '—'
      },
      sortValue: (client) => purchases.get(client.id)?.lastPurchase ?? '',
    },
    {
      key: 'totalSpent',
      header: 'Total dépensé',
      render: (client) => (
        <span className="[font-variant-numeric:tabular-nums]">
          {toCFA(purchases.get(client.id)?.totalSpent ?? 0)}
        </span>
      ),
      sortValue: (client) => purchases.get(client.id)?.totalSpent ?? 0,
      align: 'right',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (client) => (
        <Button
          type="button"
          variant="pos-secondary"
          size="icon"
          className="h-12 w-12 min-h-12"
          aria-label={`Modifier ${client.nom}`}
          onClick={(event) => {
            event.stopPropagation()
            setEditingClient(client)
          }}
        >
          <Edit className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  const saleColumns: DataTableColumn<SaleRow>[] = [
    {
      key: 'created_at',
      header: 'Date',
      render: (sale) => new Date(sale.created_at).toLocaleDateString('fr-FR'),
      sortValue: (sale) => sale.created_at,
    },
    {
      key: 'client',
      header: 'Client',
      render: (sale) => firstJoined(sale.clients)?.nom ?? '—',
      sortValue: (sale) => firstJoined(sale.clients)?.nom ?? '',
    },
    {
      key: 'offre',
      header: 'Offre',
      render: (sale) => firstJoined(sale.offres)?.nom ?? '—',
      sortValue: (sale) => firstJoined(sale.offres)?.nom ?? '',
    },
    {
      key: 'montant_total',
      header: 'Montant',
      render: (sale) => (
        <span className="font-semibold [font-variant-numeric:tabular-nums]">
          {toCFA(sale.montant_total ?? 0)}
        </span>
      ),
      sortValue: (sale) => sale.montant_total ?? 0,
      align: 'right',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (sale) => (
        <Button
          type="button"
          variant="pos-secondary"
          size="icon"
          className="h-12 w-12 min-h-12"
          aria-label="Modifier la vente"
          onClick={(event) => {
            event.stopPropagation()
            setEditingVente({
              id: sale.id,
              quantite: sale.quantite,
              montant_total: sale.montant_total ?? 0,
              offre_id: sale.offre_id,
              client_id: sale.client_id,
            })
          }}
        >
          <Edit className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28 rounded-lg" />)}
        </div>
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    )
  }

  if (kiosques.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#12364D]">Supervision</h1>
          <p className="text-sm text-[#1C5376]">Performance des kiosques que vous supervisez.</p>
        </div>
        <EmptyState
          icon={<Store className="h-5 w-5" />}
          title="Aucun kiosque supervisé"
          description="Demandez à un administrateur de vous assigner des kiosques pour suivre leurs performances."
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#12364D]">Supervision</h1>
        <p className="text-sm text-[#1C5376]">
          Performance de vos {kiosques.length} kiosque{kiosques.length > 1 ? 's' : ''} — cumul du mois.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PosKpi label="CA du mois" value={toCFA(kpis.revenueMonth)} sub="Tous kiosques confondus" />
        <PosKpi label="Ventes" value={kpis.salesCount} sub="Ce mois" />
        <PosKpi label="Clients" value={kpis.clientsCount} sub="Tous kiosques confondus" />
        <PosKpi label="Kiosques" value={kpis.kiosquesCount} sub="Sous supervision" />
      </div>

      <PosCard>
        <PosLabel className="mb-3">Tendance 30 jours (tous kiosques)</PosLabel>
        <DailyTrendChart data={dailySeries} />
      </PosCard>

      <PosCard>
        <PosLabel className="mb-3">Objectifs en cours</PosLabel>
        {objectifRows.every((row) => row.target === null) ? (
          <p className="text-sm text-[#1C5376]">
            Aucun objectif défini ce mois. Ouvrez un kiosque ci-dessous pour en définir un.
          </p>
        ) : (
          <div className="space-y-3">
            {objectifRows.map((row) => (
              <button
                key={row.kiosque.id}
                type="button"
                className="block min-h-12 w-full text-left"
                aria-label={`Voir le détail de ${row.kiosque.nom}`}
                onClick={() => setSelectedKiosqueId(row.kiosque.id)}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-[#12364D]">{row.kiosque.nom}</span>
                  <span className="text-xs text-[#1C5376] [font-variant-numeric:tabular-nums]">
                    {toCFA(row.revenue)}
                    {row.target !== null ? ` / ${toCFA(row.target)}` : ' - Non défini'}
                  </span>
                </div>
                {row.pct !== null && (
                  <div className="mt-1.5">
                    <div className="h-2.5 w-full overflow-hidden rounded-md bg-[#E3F3FE]">
                      <div
                        className="h-full rounded-md bg-[#009EFB] transition-all"
                        style={{ width: `${Math.min(100, row.pct)}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-right text-[11px] font-semibold text-[#1C5376] [font-variant-numeric:tabular-nums]">
                      {row.pct.toFixed(0)} %
                    </p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </PosCard>

      <PosCard>
        <PosLabel className="mb-3">Revenus par kiosque (mois en cours)</PosLabel>
        <ResponsiveContainer width="100%" height={Math.max(160, perKiosk.length * 44)}>
          <BarChart data={perKiosk} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(value) => formatCFACompact(Number(value))}
              tick={{ fill: chartTheme.axis, fontSize: 11 }}
            />
            <YAxis
              dataKey="nom"
              type="category"
              width={130}
              tick={{ fill: chartTheme.axis, fontSize: 12 }}
            />
            <Tooltip
              contentStyle={chartTheme.tooltip}
              formatter={(value) => [toCFA(Number(value)), 'CA']}
            />
            <Bar dataKey="revenue" fill="#009EFB" radius={[0, 4, 4, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </PosCard>

      <div>
        <PosLabel className="mb-2">Explorer un kiosque</PosLabel>
        <div className="flex flex-wrap gap-2">
          <PosChip
            active={selectedKiosqueId === null}
            onClick={() => setSelectedKiosqueId(null)}
          >
            Vue d'ensemble
          </PosChip>
          {perKiosk.map((row) => (
            <PosChip
              key={row.kiosqueId}
              active={selectedKiosqueId === row.kiosqueId}
              onClick={() => setSelectedKiosqueId(row.kiosqueId)}
            >
              {row.nom}
            </PosChip>
          ))}
        </div>
      </div>

      {selectedKiosque ? (
        <div className="space-y-4">
          <PosCard>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <PosLabel>Objectif du mois</PosLabel>
                {kioskObjectif ? (
                  <p className="mt-1 text-lg font-bold [font-variant-numeric:tabular-nums]">
                    {toCFA(kioskRevenue)}{' '}
                    <span className="text-sm font-medium text-[#1C5376]">
                      / {toCFA(kioskObjectif.ca_cible)}
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-[#1C5376]">Aucun objectif défini pour ce mois.</p>
                )}
              </div>
              {kioskObjectif ? (
                <Button
                  type="button"
                  variant="pos-secondary"
                  onClick={() =>
                    setEditingObjectif({ id: kioskObjectif.id, ca_cible: kioskObjectif.ca_cible })
                  }
                >
                  <Edit className="h-4 w-4" />
                  Modifier l'objectif
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="pos-secondary"
                  onClick={() => setIsCreatingObjectif(true)}
                >
                  <Target className="h-4 w-4" />
                  Définir un objectif
                </Button>
              )}
            </div>
            {kioskObjectif && (
              <div className="mt-3">
                <div className="h-3 w-full overflow-hidden rounded-md bg-[#F6F9FB]">
                  <div
                    className="h-full rounded-md bg-[#009EFB] transition-all"
                    style={{ width: `${Math.min(100, objectifProgress)}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs font-semibold text-[#1C5376] [font-variant-numeric:tabular-nums]">
                  {objectifProgress.toFixed(1)} %
                </p>
              </div>
            )}
          </PosCard>

          <PosCard>
            <PosLabel className="mb-3">Clients du kiosque</PosLabel>
            <div className="mb-3">
              <SearchBar
                value={clientSearch}
                onChange={setClientSearch}
                placeholder="Nom ou telephone du client"
                resultCount={kioskClients.length}
              />
            </div>
            {allKioskClients.length === 0 ? (
              <EmptyState title="Aucun client pour ce kiosque" className="border-0" />
            ) : kioskClients.length === 0 ? (
              <EmptyState
                title="Aucun resultat"
                description="Essayez un autre nom ou numero de telephone."
                className="border-0"
              />
            ) : (
              <>
                <div className="hidden sm:block">
                  <DataTable
                    columns={clientColumns}
                    data={shownClients}
                    getRowKey={(client) => client.id}
                  />
                </div>

                {/* Mobile: client cards */}
                <div className="space-y-3 sm:hidden">
                  {shownClients.map((client) => {
                    const stats = purchases.get(client.id)
                    return (
                      <div
                        key={client.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-[#DCE1E5] bg-white p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-[15px] font-bold text-[#12364D]">{client.nom}</p>
                          <p className="mt-0.5 text-xs text-[#1C5376]">
                            {client.telephone || 'Téléphone non renseigné'}
                          </p>
                          <p className="mt-0.5 text-xs text-[#1C5376]">
                            Dernier achat :{' '}
                            {stats?.lastPurchase
                              ? new Date(stats.lastPurchase).toLocaleDateString('fr-FR')
                              : '—'}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <p className="text-base font-bold text-[#12364D] [font-variant-numeric:tabular-nums]">
                            {toCFA(stats?.totalSpent ?? 0)}
                          </p>
                          <Button
                            type="button"
                            variant="pos-secondary"
                            size="icon"
                            className="h-12 w-12 min-h-12"
                            aria-label={`Modifier ${client.nom}`}
                            onClick={() => setEditingClient(client)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {visibleClients < kioskClients.length && (
                  <Button
                    type="button"
                    variant="pos-secondary"
                    className="w-full"
                    onClick={() => setVisibleClients((count) => count + 20)}
                  >
                    Charger plus ({kioskClients.length - visibleClients} restants)
                  </Button>
                )}
              </>
            )}
          </PosCard>

          <PosCard>
            <PosLabel className="mb-3">Ventes récentes</PosLabel>
            {kioskSales.length === 0 ? (
              <EmptyState title="Aucune vente ce mois" className="border-0" />
            ) : (
              <>
                <div className="hidden sm:block">
                  <DataTable
                    columns={saleColumns}
                    data={kioskSales}
                    getRowKey={(sale) => sale.id}
                  />
                </div>

                {/* Mobile: sale cards */}
                <div className="space-y-3 sm:hidden">
                  {kioskSales.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-[#DCE1E5] bg-white p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#12364D]">
                          {new Date(sale.created_at).toLocaleDateString('fr-FR')}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[#1C5376]">
                          {firstJoined(sale.clients)?.nom ?? '—'} - {firstJoined(sale.offres)?.nom ?? '—'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <p className="text-base font-bold text-[#12364D] [font-variant-numeric:tabular-nums]">
                          {toCFA(sale.montant_total ?? 0)}
                        </p>
                        <Button
                          type="button"
                          variant="pos-secondary"
                          size="icon"
                          className="h-12 w-12 min-h-12"
                          aria-label="Modifier la vente"
                          onClick={() =>
                            setEditingVente({
                              id: sale.id,
                              quantite: sale.quantite,
                              montant_total: sale.montant_total ?? 0,
                              offre_id: sale.offre_id,
                              client_id: sale.client_id,
                            })
                          }
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {visibleSales < allKioskSales.length && (
                  <Button
                    type="button"
                    variant="pos-secondary"
                    className="w-full"
                    onClick={() => setVisibleSales((count) => count + 20)}
                  >
                    Charger plus ({allKioskSales.length - visibleSales} restantes)
                  </Button>
                )}
              </>
            )}
          </PosCard>
        </div>
      ) : (
        <PosCard>
          <p className="text-sm text-[#1C5376]">
            Sélectionnez un kiosque ci-dessus pour voir ses clients, ses ventes récentes et son objectif.
          </p>
        </PosCard>
      )}

      <EditClientDialog
        open={editingClient !== null}
        onOpenChange={(open) => !open && setEditingClient(null)}
        client={editingClient}
        onSaved={load}
      />
      <EditVenteDialog
        open={editingVente !== null}
        onOpenChange={(open) => !open && setEditingVente(null)}
        vente={editingVente}
        clients={kioskClients.map((client) => ({ id: client.id, nom: client.nom }))}
        offres={venteOffreOptions}
        onSaved={load}
      />
      <EditObjectifDialog
        open={editingObjectif !== null}
        onOpenChange={(open) => !open && setEditingObjectif(null)}
        objectif={editingObjectif}
        kiosqueNom={selectedKiosque?.nom ?? ''}
        onSaved={load}
      />
      {selectedKiosqueId && (
        <CreateObjectifDialog
          open={isCreatingObjectif}
          onOpenChange={setIsCreatingObjectif}
          kiosqueId={selectedKiosqueId}
          kiosqueNom={selectedKiosque?.nom ?? ''}
          onCreated={load}
        />
      )}
    </div>
  )
}
