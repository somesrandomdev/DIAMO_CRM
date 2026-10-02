import { useState, type ReactNode } from 'react'
import { Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadMoreButton } from '@/components/LoadMoreButton'
import { SearchBar } from '@/components/SearchBar'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { usePagedRpc } from '@/lib/usePagedRpc'
import { toCFA } from '@/utils/price'
import { formatDay, type KioskClientRow, type KioskClientSort } from './types'

const SORT_OPTIONS: { value: KioskClientSort; label: string }[] = [
  { value: 'nom', label: 'Nom (A → Z)' },
  { value: 'depense', label: 'Plus gros acheteurs' },
  { value: 'dernier_achat', label: 'Achat le plus récent' },
  { value: 'recent', label: 'Derniers inscrits' },
]

interface KioskClientsPanelProps {
  kiosqueId: string
  kiosqueNom: string
  onEdit: (client: KioskClientRow) => void
  /** Omitted = no delete button (commercials can't delete clients). */
  onDelete?: (client: KioskClientRow) => void
  /** Extra buttons next to the search (e.g. "Importer"). */
  actions?: ReactNode
  /** Bump after an edit/delete/import to refetch the current list. */
  refreshKey?: number
}

/**
 * Clients of ONE kiosk, searched, sorted and paged by Postgres
 * (kiosk_clients): the page only ever holds what is on screen, whatever the
 * kiosk's size.
 */
export function KioskClientsPanel({
  kiosqueId,
  kiosqueNom,
  onEdit,
  onDelete,
  actions,
  refreshKey = 0,
}: KioskClientsPanelProps) {
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim(), 300)
  const [sort, setSort] = useState<KioskClientSort>('nom')

  const list = usePagedRpc<KioskClientRow>(
    'kiosk_clients',
    { p_kiosque_id: kiosqueId, p_search: search || null, p_sort: sort },
    { refreshKey }
  )

  const columns: DataTableColumn<KioskClientRow>[] = [
    { key: 'nom', header: 'Client', render: (client) => <span className="font-medium">{client.nom}</span> },
    {
      key: 'telephone',
      header: 'Téléphone',
      render: (client) =>
        client.telephone ? (
          <a href={`tel:${client.telephone}`} className="text-blue underline" onClick={(event) => event.stopPropagation()}>
            {client.telephone}
          </a>
        ) : (
          '—'
        ),
    },
    { key: 'type', header: 'Type', render: (client) => client.type_client || '—' },
    { key: 'dernier', header: 'Dernier achat', render: (client) => formatDay(client.dernier_achat) },
    {
      key: 'depense',
      header: 'Total dépensé',
      align: 'right',
      render: (client) => (
        <span className="font-semibold [font-variant-numeric:tabular-nums]">{toCFA(client.total_depense)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (client) => <RowActions client={client} onEdit={onEdit} onDelete={onDelete} />,
    },
  ]

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <Label variant="caps">
          Clients de {kiosqueNom} {list.isLoading ? '' : `(${list.total})`}
        </Label>
        {actions}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_16rem]">
        <SearchBar value={searchInput} onChange={setSearchInput} placeholder="Nom ou téléphone du client" />
        <Select
          fieldSize="lg"
          aria-label="Trier les clients"
          value={sort}
          onChange={(event) => setSort(event.target.value as KioskClientSort)}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {list.error && <p className="text-sm text-red">{list.error}</p>}

      {list.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-14 rounded-lg" />)}
        </div>
      ) : list.rows.length === 0 ? (
        <EmptyState
          title={search ? 'Aucun résultat' : 'Aucun client pour ce kiosque'}
          description={search ? 'Essayez un autre nom ou numéro de téléphone.' : undefined}
          className="border-0"
        />
      ) : (
        <>
          <div className="hidden sm:block">
            <DataTable columns={columns} data={list.rows} getRowKey={(client) => client.id} />
          </div>

          {/* Mobile: one card per client, phone is tap-to-call */}
          <ul className="space-y-2 sm:hidden" aria-label={`Clients de ${kiosqueNom}`}>
            {list.rows.map((client) => (
              <li key={client.id} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-text">{client.nom}</p>
                    {client.telephone ? (
                      <a
                        href={`tel:${client.telephone}`}
                        className="inline-flex min-h-11 items-center text-sm font-semibold text-blue underline"
                      >
                        {client.telephone}
                      </a>
                    ) : (
                      <p className="text-xs text-text-secondary">Téléphone non renseigné</p>
                    )}
                    <p className="text-xs text-text-secondary">Dernier achat : {formatDay(client.dernier_achat)}</p>
                  </div>
                  <p className="shrink-0 text-right text-base font-bold text-text [font-variant-numeric:tabular-nums]">
                    {toCFA(client.total_depense)}
                  </p>
                </div>
                <div className="mt-2 flex justify-end">
                  <RowActions client={client} onEdit={onEdit} onDelete={onDelete} />
                </div>
              </li>
            ))}
          </ul>

          <LoadMoreButton
            shown={list.rows.length}
            total={list.total}
            isLoading={list.isLoadingMore}
            onClick={list.loadMore}
            noun="clients"
          />
        </>
      )}
    </Card>
  )
}

function RowActions({
  client,
  onEdit,
  onDelete,
}: {
  client: KioskClientRow
  onEdit: (client: KioskClientRow) => void
  onDelete?: (client: KioskClientRow) => void
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        aria-label={`Modifier ${client.nom}`}
        onClick={(event) => {
          event.stopPropagation()
          onEdit(client)
        }}
      >
        <Edit className="h-4 w-4" />
      </Button>
      {onDelete && (
        <Button
          type="button"
          variant="destructive"
          size="icon-lg"
          aria-label={`Supprimer ${client.nom}`}
          onClick={(event) => {
            event.stopPropagation()
            onDelete(client)
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
