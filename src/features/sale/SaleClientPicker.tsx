import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PosCard, PosInput, PosLabel } from '@/components/pos'
import type { Client } from '@/stores/venteStore'
import { useClientSearch } from './useClientSearch'

interface SaleClientPickerProps {
  clients: Client[]
  isLoading: boolean
  selectedClient: Client | null
  onSelect: (client: Client) => void
  onClear: () => void
  /** Opens the inline AddClientUltra flow (both the "create" triggers). */
  onAddNew: () => void
  /** Incremented by the parent after a sale to clear the search field. */
  resetKey: number
}

/**
 * Client search + selection + inline "add new" trigger. Purely presentational:
 * clients arrive via props, selection changes leave via callbacks, and the
 * field logic lives in useClientSearch.
 */
export function SaleClientPicker({
  clients,
  isLoading,
  selectedClient,
  onSelect,
  onClear,
  onAddNew,
  resetKey,
}: SaleClientPickerProps) {
  const search = useClientSearch(clients, resetKey)

  const select = (client: Client) => {
    onSelect(client)
    search.closeSuggestions(client)
  }

  const clear = () => {
    onClear()
    search.clearField()
  }

  return (
    <PosCard className="space-y-3">
      <PosLabel>Client</PosLabel>

      <div ref={search.containerRef} className="relative">
        {isLoading ? (
          // Explicit "loading" affordance rather than an empty input: a
          // non-technical user typing into a field whose data hasn't arrived
          // gets "no results" and concludes the client is missing.
          <div className="space-y-2" aria-live="polite">
            <Skeleton className="h-12 w-full" />
            <p className="text-xs text-zinc-500">Chargement de la liste des clients...</p>
          </div>
        ) : (
          <PosInput
            type="text"
            value={search.query}
            onChange={(event) => {
              if (selectedClient) clear()
              search.handleSearch(event.target.value)
            }}
            onFocus={search.reopenSuggestions}
            placeholder="Nom ou telephone du client"
            readOnly={selectedClient !== null}
            className={selectedClient ? 'bg-zinc-100' : ''}
            aria-label="Rechercher un client"
          />
        )}

        {search.showSuggestions && search.results.length > 0 && (
          <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border-2 border-zinc-300 bg-white shadow-lg">
            {search.results.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => select(client)}
                className="block min-h-12 w-full border-b border-zinc-200 px-3 py-2 text-left last:border-b-0 hover:bg-zinc-100"
              >
                <p className="text-sm font-semibold text-zinc-900">{client.nom}</p>
                {client.telephone && <p className="text-xs text-zinc-500">{client.telephone}</p>}
              </button>
            ))}
          </div>
        )}
      </div>

      {search.query.trim() && !selectedClient && search.results.length === 0 && (
        <Button type="button" variant="pos-secondary" className="w-full justify-start" onClick={onAddNew}>
          Creer ce client
        </Button>
      )}

      {selectedClient && (
        <div className="rounded-md border-2 border-emerald-600 bg-emerald-50 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <PosLabel className="text-emerald-700">Client selectionne</PosLabel>
              <p className="mt-1 text-sm font-bold text-zinc-900">{selectedClient.nom}</p>
              <p className="text-xs text-zinc-500">
                {selectedClient.telephone || 'Telephone non renseigne'}
              </p>
            </div>
            <Button type="button" variant="pos-secondary" size="sm" onClick={clear}>
              Changer
            </Button>
          </div>
        </div>
      )}

      <Button type="button" variant="pos-secondary" className="w-full" onClick={onAddNew}>
        Creer un nouveau client
      </Button>
    </PosCard>
  )
}
