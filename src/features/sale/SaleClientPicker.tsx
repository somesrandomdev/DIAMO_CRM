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
            <p className="text-xs text-[#1C5376]">Chargement de la liste des clients...</p>
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
            placeholder="Nom ou téléphone du client"
            readOnly={selectedClient !== null}
            className={selectedClient ? 'bg-[#F6F9FB]' : ''}
            aria-label="Rechercher un client"
          />
        )}

        {search.showSuggestions && search.results.length > 0 && (
          <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border-2 border-[#DCE1E5] bg-white shadow-lg">
            {search.results.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => select(client)}
                className="block min-h-12 w-full border-b border-[#DCE1E5] px-3 py-2 text-left last:border-b-0 hover:bg-[#F6F9FB]"
              >
                <p className="text-sm font-semibold text-[#12364D]">{client.nom}</p>
                {client.telephone && <p className="text-xs text-[#1C5376]">{client.telephone}</p>}
              </button>
            ))}
          </div>
        )}
      </div>

      {search.query.trim() && !selectedClient && search.results.length === 0 && (
        <Button type="button" variant="pos-secondary" className="w-full justify-start" onClick={onAddNew}>
          Créer ce client
        </Button>
      )}

      {selectedClient && (
        <div className="rounded-md border-2 border-[#006EBD] bg-[#E3F3FE] p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <PosLabel className="text-[#006EBD]">Client sélectionné</PosLabel>
              <p className="mt-1 text-sm font-bold text-[#12364D]">{selectedClient.nom}</p>
              <p className="text-xs text-[#1C5376]">
                {selectedClient.telephone || 'Téléphone non renseigné'}
              </p>
            </div>
            <Button type="button" variant="pos-secondary" size="sm" onClick={clear}>
              Changer
            </Button>
          </div>
        </div>
      )}

      <Button type="button" variant="pos-secondary" className="w-full" onClick={onAddNew}>
        Créer un nouveau client
      </Button>
    </PosCard>
  )
}
