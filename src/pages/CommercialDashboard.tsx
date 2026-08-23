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
  clientPurchaseMap,
  computeCommercialKpis,
  monthKey,
  revenuePerKiosk,
  startOfMonth,
  type CommercialClient,
  type CommercialSale,
  type SupervisedKiosque,
} from '@/lib/commercialStats'
import { useAuthStore } from '@/stores/authStore'
import { formatCFACompact, toCFA } from '@/utils/price'

interface SaleRow extends CommercialSale {
  offre_id: string | null
  quantite: number
  clients?: { nom?: string } | { nom?: string }[] | null
  offres?: { nom?: string } | { nom?: string }[] | null
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
      setIsLoading(false)
      return
    }

    const kiosqueIds = supervised.map((kiosque) => kiosque.id)
    const [salesResult, clientsResult, objectifsResult] = await Promise.all([
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
    ])

    const failure = salesResult.error ?? clientsResult.error ?? objectifsResult.error
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

  const selectedKiosque = kiosques.find((kiosque) => kiosque.id === selectedKiosqueId) ?? null
  const kioskSales = useMemo(
    () => sales.filter((sale) => sale.kiosque_id === selectedKiosqueId).slice(0, 10),
    [sales, selectedKiosqueId]
  )
  const kioskClients = useMemo(
    () => clients.filter((client) => client.kiosque_id === selectedKiosqueId),
    [clients, selectedKiosqueId]
  )
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
            {kioskClients.length === 0 ? (
              <EmptyState title="Aucun client pour ce kiosque" className="border-0" />
            ) : (
              <DataTable
                columns={clientColumns}
                data={kioskClients}
                getRowKey={(client) => client.id}
              />
            )}
          </PosCard>

          <PosCard>
            <PosLabel className="mb-3">Ventes récentes</PosLabel>
            {kioskSales.length === 0 ? (
              <EmptyState title="Aucune vente ce mois" className="border-0" />
            ) : (
              <DataTable
                columns={saleColumns}
                data={kioskSales}
                getRowKey={(sale) => sale.id}
              />
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
