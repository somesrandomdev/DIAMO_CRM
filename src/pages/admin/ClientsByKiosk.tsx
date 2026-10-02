import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Upload, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { KPICard } from '@/components/ui/kpi-card'
import { LoadMoreButton } from '@/components/LoadMoreButton'
import { SearchBar } from '@/components/SearchBar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ClientImportDialog } from '@/components/ClientImportDialog'
import { EditClientDialog, type EditableClient } from '@/components/EditDialogs'
import { useToast } from '@/components/Toast'
import { KioskClientsPanel } from '@/features/kiosk/KioskClientsPanel'
import {
  formatDay,
  type KioskClientRow,
  type KioskOverviewExtra,
  type KioskOverviewRow,
  type KioskOverviewSort,
} from '@/features/kiosk/types'
import { handleSupabaseError, supabase } from '@/lib/supabase'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { usePagedRpc } from '@/lib/usePagedRpc'
import { toCFA } from '@/utils/price'

const SORT_OPTIONS: { value: KioskOverviewSort; label: string }[] = [
  { value: 'clients', label: 'Plus de clients' },
  { value: 'activite', label: 'Activité la plus récente' },
  { value: 'ca', label: 'CA 30 jours' },
  { value: 'nom', label: 'Nom (A → Z)' },
]

/**
 * Admin: kiosks with their client base (searched, sorted, paged in Postgres),
 * then one kiosk's clients. The open kiosk lives in the URL (?kiosque=…) so
 * the browser's back button returns to the list.
 */
export default function ClientsByKiosk() {
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('kiosque')

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim(), 300)
  const [sort, setSort] = useState<KioskOverviewSort>('clients')
  // Fixed at mount: a new timestamp per render would refetch forever.
  const [since30Days] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey((key) => key + 1)

  const overview = usePagedRpc<KioskOverviewRow, KioskOverviewExtra>(
    'kiosk_overview',
    { p_from: since30Days, p_to: null, p_search: search || null, p_sort: sort, p_only_active: false },
    { refreshKey }
  )
  const totals = overview.extra?.totals

  const [editingClient, setEditingClient] = useState<EditableClient | null>(null)
  const [deletingClient, setDeletingClient] = useState<KioskClientRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)

  // Name of the open kiosk: from the loaded list, else (deep link) one lookup.
  const [selectedNom, setSelectedNom] = useState<string | null>(null)
  useEffect(() => {
    if (!selectedId) {
      setSelectedNom(null)
      return
    }
    const known = overview.rows.find((row) => row.kiosque_id === selectedId)
    if (known) {
      setSelectedNom(known.nom)
      return
    }
    let cancelled = false
    supabase
      .from('kiosques')
      .select('nom')
      .eq('id', selectedId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setSelectedNom((data as { nom?: string } | null)?.nom ?? 'Kiosque')
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, overview.rows])

  const openKiosk = (id: string | null) => {
    setSearchParams(id ? { kiosque: id } : {})
  }

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
    refresh()
  }

  const columns: DataTableColumn<KioskOverviewRow>[] = [
    { key: 'nom', header: 'Kiosque', render: (row) => <span className="font-medium">{row.nom}</span> },
    { key: 'clients', header: 'Clients', align: 'right', render: (row) => row.nb_clients },
    { key: 'nouveaux', header: 'Nouveaux (7 j)', align: 'right', render: (row) => row.nouveaux_7j || '—' },
    {
      key: 'ca',
      header: 'CA 30 jours',
      align: 'right',
      render: (row) => <span className="[font-variant-numeric:tabular-nums]">{toCFA(row.ca)}</span>,
    },
    { key: 'activite', header: 'Dernière vente', render: (row) => formatDay(row.last_sale_at) },
    { key: 'open', header: '', align: 'right', render: () => <ChevronRight className="ml-auto h-4 w-4 text-text-tertiary" /> },
  ]

  if (selectedId) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button type="button" variant="outline" size="touch" onClick={() => openKiosk(null)}>
              <ArrowLeft className="h-4 w-4" />
              Tous les kiosques
            </Button>
          </div>
          <h1 className="text-base font-semibold text-text">{selectedNom ?? 'Kiosque'}</h1>
        </div>

        <KioskClientsPanel
          kiosqueId={selectedId}
          kiosqueNom={selectedNom ?? 'ce kiosque'}
          onEdit={setEditingClient}
          onDelete={setDeletingClient}
          refreshKey={refreshKey}
          actions={
            <Button type="button" variant="outline" size="touch" onClick={() => setIsImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Importer des clients
            </Button>
          }
        />

        <ClientImportDialog
          open={isImportOpen}
          onOpenChange={setIsImportOpen}
          kiosqueId={selectedId}
          onImported={refresh}
        />
        <EditClientDialog
          open={editingClient !== null}
          onOpenChange={(open) => !open && setEditingClient(null)}
          client={editingClient}
          onSaved={refresh}
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text">Clients par kiosque</h1>
        <p className="text-sm text-text-secondary">Choisissez un kiosque pour voir, chercher et modifier ses clients.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {totals ? (
          <>
            <KPICard label="Total clients" value={totals.clients} sub="Tous kiosques" />
            <KPICard label="Nouveaux clients" value={totals.nouveaux_7j} sub="7 derniers jours" />
            <KPICard
              label="Kiosques actifs"
              value={`${totals.kiosques_actifs} / ${totals.kiosques}`}
              sub="Au moins une vente sur 30 jours"
            />
          </>
        ) : (
          [1, 2, 3].map((item) => <Skeleton key={item} className="h-[104px] rounded-lg" />)
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_16rem]">
        <SearchBar value={searchInput} onChange={setSearchInput} placeholder="Rechercher un kiosque" />
        <Select
          fieldSize="lg"
          aria-label="Trier les kiosques"
          value={sort}
          onChange={(event) => setSort(event.target.value as KioskOverviewSort)}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {overview.error && <p className="text-sm text-red">{overview.error}</p>}

      {overview.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-14 rounded-lg" />)}
        </div>
      ) : overview.rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title={search ? 'Aucun kiosque trouvé' : 'Aucun kiosque'}
          description={search ? 'Essayez un autre nom.' : "Créez d'abord des kiosques pour voir leurs clients."}
        />
      ) : (
        <>
          <p className="text-xs text-text-secondary">
            {overview.total} kiosque{overview.total > 1 ? 's' : ''}
          </p>
          <div className="hidden sm:block">
            <DataTable
              columns={columns}
              data={overview.rows}
              getRowKey={(row) => row.kiosque_id}
              onRowClick={(row) => openKiosk(row.kiosque_id)}
            />
          </div>

          {/* Mobile: one tappable line per kiosk */}
          <ul className="space-y-2 sm:hidden">
            {overview.rows.map((row) => (
              <li key={row.kiosque_id}>
                <button
                  type="button"
                  onClick={() => openKiosk(row.kiosque_id)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-left active:scale-[0.99]"
                  aria-label={`Voir les clients de ${row.nom}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-base font-bold text-text">{row.nom}</span>
                    <span className="block text-xs text-text-secondary">
                      {row.nb_clients} client{row.nb_clients > 1 ? 's' : ''}
                      {row.nouveaux_7j > 0 ? ` · +${row.nouveaux_7j} cette semaine` : ''} · dernière vente{' '}
                      {formatDay(row.last_sale_at)}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-text-tertiary" />
                </button>
              </li>
            ))}
          </ul>

          <LoadMoreButton
            shown={overview.rows.length}
            total={overview.total}
            isLoading={overview.isLoadingMore}
            onClick={overview.loadMore}
            noun="kiosques"
          />
        </>
      )}
    </div>
  )
}
