import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Trash2, Edit, Upload, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { PosCard, PosKpi, PosLabel } from '@/components/pos'
import { SearchBar } from '@/components/SearchBar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ClientImportDialog } from '@/components/ClientImportDialog'
import { EditClientDialog, type EditableClient } from '@/components/EditDialogs'
import { useToast } from '@/components/Toast'
import { handleSupabaseError, supabase } from '@/lib/supabase'
import { toCFA } from '@/utils/price'

interface KiosqueRow {
  id: string
  nom: string
}

interface ClientRow {
  id: string
  kiosque_id: string
  nom: string
  telephone?: string | null
  type_client?: string | null
  nombre_personnes?: number | null
  created_at?: string | null
}

interface VenteRow {
  kiosque_id: string
  client_id: string | null
  montant_total: number | null
  created_at: string
}

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString('fr-FR') : '—'
}

export default function ClientsByKiosk() {
  const { showToast } = useToast()
  const [kiosques, setKiosques] = useState<KiosqueRow[]>([])
  const [clients, setClients] = useState<ClientRow[]>([])
  const [ventes, setVentes] = useState<VenteRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedKiosqueId, setSelectedKiosqueId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editingClient, setEditingClient] = useState<EditableClient | null>(null)
  const [deletingClient, setDeletingClient] = useState<ClientRow | null>(null)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [kiosquesResult, clientsResult, ventesResult] = await Promise.all([
      supabase.from('kiosques').select('id, nom').order('nom'),
      supabase
        .from('clients')
        .select('id, kiosque_id, nom, telephone, type_client, nombre_personnes, created_at')
        .order('nom'),
      supabase.from('ventes').select('kiosque_id, client_id, montant_total, created_at'),
    ])

    const failure = kiosquesResult.error ?? clientsResult.error ?? ventesResult.error
    if (failure) {
      console.error('Error loading clients-by-kiosk:', failure)
      showToast({
        type: 'error',
        title: 'Chargement impossible',
        message: "La vue clients par kiosque n'a pas pu être chargée. Veuillez réessayer.",
      })
    }

    setKiosques((kiosquesResult.data ?? []) as KiosqueRow[])
    setClients((clientsResult.data ?? []) as ClientRow[])
    setVentes((ventesResult.data ?? []) as VenteRow[])
    setIsLoading(false)
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const revenueByKiosk = useMemo(() => {
    const map = new Map<string, number>()
    for (const vente of ventes) {
      map.set(vente.kiosque_id, (map.get(vente.kiosque_id) ?? 0) + (vente.montant_total ?? 0))
    }
    return map
  }, [ventes])

  const lastActivityByKiosk = useMemo(() => {
    const map = new Map<string, string>()
    for (const vente of ventes) {
      const current = map.get(vente.kiosque_id)
      if (!current || vente.created_at > current) {
        map.set(vente.kiosque_id, vente.created_at)
      }
    }
    return map
  }, [ventes])

  const spentByClient = useMemo(() => {
    const map = new Map<string, number>()
    for (const vente of ventes) {
      if (!vente.client_id) continue
      map.set(vente.client_id, (map.get(vente.client_id) ?? 0) + (vente.montant_total ?? 0))
    }
    return map
  }, [ventes])

  const selectedKiosque = kiosques.find((kiosque) => kiosque.id === selectedKiosqueId) ?? null

  const kioskClients = useMemo(() => {
    const scoped = clients.filter((client) => client.kiosque_id === selectedKiosqueId)
    const needle = search.trim().toLowerCase()
    if (!needle) return scoped
    return scoped.filter(
      (client) =>
        client.nom.toLowerCase().includes(needle) ||
        (client.telephone ?? '').toLowerCase().includes(needle)
    )
  }, [clients, search, selectedKiosqueId])

  const newClientsThisWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    return clients.filter(
      (client) => client.created_at && new Date(client.created_at).getTime() >= cutoff
    ).length
  }, [clients])

  const mostActiveKiosque = useMemo(() => {
    let best: { nom: string; revenue: number } | null = null
    for (const kiosque of kiosques) {
      const revenue = revenueByKiosk.get(kiosque.id) ?? 0
      if (!best || revenue > best.revenue) best = { nom: kiosque.nom, revenue }
    }
    return best
  }, [kiosques, revenueByKiosk])

  const confirmDelete = async () => {
    if (!deletingClient) return

    setIsDeleting(true)
    const { error } = await supabase.from('clients').delete().eq('id', deletingClient.id)
    setIsDeleting(false)

    if (error) {
      console.error('Client delete failed:', error)
      showToast({
        type: 'error',
        title: 'Suppression impossible',
        message:
          error.code === '23503'
            ? 'Ce client a des ventes enregistrées et ne peut pas être supprimé.'
            : handleSupabaseError(error),
      })
      return
    }

    showToast({ type: 'success', title: 'Client supprimé', message: 'Le client a été supprimé avec succès.' })
    setDeletingClient(null)
    load()
  }

  const detailColumns: DataTableColumn<ClientRow>[] = [
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
      key: 'type_client',
      header: 'Type',
      render: (client) => client.type_client || '—',
      sortValue: (client) => client.type_client ?? '',
    },
    {
      key: 'nombre_personnes',
      header: 'Personnes',
      render: (client) => client.nombre_personnes ?? '—',
      sortValue: (client) => client.nombre_personnes ?? 0,
    },
    {
      key: 'totalSpent',
      header: 'Total dépensé',
      render: (client) => (
        <span className="font-semibold [font-variant-numeric:tabular-nums]">
          {toCFA(spentByClient.get(client.id) ?? 0)}
        </span>
      ),
      sortValue: (client) => spentByClient.get(client.id) ?? 0,
      align: 'right',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (client) => (
        <div className="flex justify-end gap-2">
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
          <Button
            type="button"
            variant="pos-destructive"
            size="icon"
            className="h-12 w-12 min-h-12"
            aria-label={`Supprimer ${client.nom}`}
            onClick={(event) => {
              event.stopPropagation()
              setDeletingClient(client)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-28 rounded-lg" />)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-36 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#12364D]">Clients par kiosque</h1>
        <p className="text-sm text-[#1C5376]">Répartition et activité des clients à travers le réseau.</p>
      </div>

      {selectedKiosque ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="pos-secondary" onClick={() => { setSelectedKiosqueId(null); setSearch('') }}>
              <ArrowLeft className="h-4 w-4" />
              Tous les kiosques
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="pos-secondary"
                onClick={() => setIsImportOpen(true)}
              >
                <Upload className="h-4 w-4" />
                Importer des clients
              </Button>
              <div className="sm:w-80">
                {/* The section header already shows the live count */}
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="Rechercher par nom ou téléphone"
                />
              </div>
            </div>
          </div>

          <ClientImportDialog
            open={isImportOpen}
            onOpenChange={setIsImportOpen}
            kiosqueId={selectedKiosque.id}
            onImported={load}
          />

          <PosCard>
            <PosLabel className="mb-3">
              Clients de {selectedKiosque.nom} ({kioskClients.length})
            </PosLabel>
            {kioskClients.length === 0 ? (
              <EmptyState title="Aucun client trouvé" className="border-0" />
            ) : (
              <>
                <div className="hidden sm:block">
                  <DataTable columns={detailColumns} data={kioskClients} getRowKey={(client) => client.id} />
                </div>

                {/* Mobile: client cards, phone is tap-to-call */}
                <div className="space-y-3 sm:hidden">
                  {kioskClients.map((client) => (
                    <div key={client.id} className="rounded-lg border border-[#DCE1E5] bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[15px] font-bold text-[#12364D]">{client.nom}</p>
                          {client.telephone ? (
                            <a
                              href={`tel:${client.telephone}`}
                              className="mt-0.5 inline-flex min-h-12 items-center text-sm font-semibold text-[#009EFB] underline"
                            >
                              {client.telephone}
                            </a>
                          ) : (
                            <p className="mt-0.5 text-xs text-[#1C5376]">Téléphone non renseigné</p>
                          )}
                        </div>
                        <p className="shrink-0 text-right text-base font-bold text-[#12364D] [font-variant-numeric:tabular-nums]">
                          {toCFA(spentByClient.get(client.id) ?? 0)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-[#1C5376]">
                        {client.type_client || '—'} - {client.nombre_personnes ?? '—'} pers.
                      </p>
                      <div className="mt-3 flex justify-end gap-2">
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
                        <Button
                          type="button"
                          variant="pos-destructive"
                          size="icon"
                          className="h-12 w-12 min-h-12"
                          aria-label={`Supprimer ${client.nom}`}
                          onClick={() => setDeletingClient(client)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </PosCard>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <PosKpi label="Total clients" value={clients.length} sub="Tous kiosques" />
            <PosKpi
              label="Kiosque le plus actif"
              value={mostActiveKiosque?.nom ?? '—'}
              sub={mostActiveKiosque ? toCFA(mostActiveKiosque.revenue) : 'Aucune vente'}
            />
            <PosKpi label="Nouveaux clients" value={newClientsThisWeek} sub="7 derniers jours" />
          </div>

          {kiosques.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="Aucun kiosque"
              description="Créez d'abord des kiosques pour voir leurs clients."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {kiosques.map((kiosque) => {
                const clientCount = clients.filter((client) => client.kiosque_id === kiosque.id).length
                return (
                  <button
                    key={kiosque.id}
                    type="button"
                    onClick={() => setSelectedKiosqueId(kiosque.id)}
                    className="rounded-lg border border-[#DCE1E5] bg-white p-4 text-left transition-colors hover:border-[#12364D] active:scale-[0.98]"
                    aria-label={`Voir les clients de ${kiosque.nom}`}
                  >
                    <p className="text-lg font-bold tracking-tight text-[#12364D]">{kiosque.nom}</p>
                    <dl className="mt-3 space-y-1 text-sm text-[#1C5376]">
                      <div className="flex justify-between gap-2">
                        <dt>Clients</dt>
                        <dd className="font-semibold [font-variant-numeric:tabular-nums]">{clientCount}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Revenus</dt>
                        <dd className="font-semibold [font-variant-numeric:tabular-nums]">
                          {toCFA(revenueByKiosk.get(kiosque.id) ?? 0)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Dernière activité</dt>
                        <dd>{formatDate(lastActivityByKiosk.get(kiosque.id))}</dd>
                      </div>
                    </dl>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      <EditClientDialog
        open={editingClient !== null}
        onOpenChange={(open) => !open && setEditingClient(null)}
        client={editingClient}
        onSaved={load}
      />

      <ConfirmDialog
        open={deletingClient !== null}
        onOpenChange={(open) => !open && setDeletingClient(null)}
        title="Supprimer le client"
        description={`Voulez-vous vraiment supprimer ${deletingClient?.nom} ? Un client ayant des ventes enregistrées ne peut pas être supprimé.`}
        isBusy={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
