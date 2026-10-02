import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Client } from '@/stores/venteStore'
import { useClientSearch } from './useClientSearch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

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
  /** Latest clients of the kiosque, shown as one-tap chips (hidden if empty). */
  recentClients?: Client[]
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
  recentClients = [],
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
    <Card padding="md" className="space-y-3">
      <Label variant="caps">Client</Label>

      {!selectedClient && recentClients.length > 0 && (
        <div>
          <p id="recent-clients-label" className="mb-2 text-xs text-text-secondary">
            Clients récents
          </p>
          <ul aria-labelledby="recent-clients-label" className="flex flex-wrap gap-2">
            {recentClients.map((client) => (
              <li key={client.id} className="min-w-0 max-w-full">
                <button
                  type="button"
                  onClick={() => select(client)}
                  className="flex min-h-12 max-w-full flex-col items-start justify-center rounded-full border-2 border-border bg-white px-4 py-1 text-left hover:border-blue active:scale-[0.98]"
                >
                  <span className="max-w-[12rem] truncate text-sm font-semibold text-text">{client.nom}</span>
                  {client.telephone && (
                    <span className="max-w-[12rem] truncate text-xs text-text-secondary [font-variant-numeric:tabular-nums]">
                      {client.telephone}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div ref={search.containerRef} className="relative">
        {isLoading ? (
          // Explicit "loading" affordance rather than an empty input: a
          // non-technical user typing into a field whose data hasn't arrived
          // gets "no results" and concludes the client is missing.
          <div className="space-y-2" aria-live="polite">
            <Skeleton className="h-12 w-full" />
            <p className="text-xs text-text-secondary">Chargement de la liste des clients...</p>
          </div>
        ) : (
          <Input fieldSize="lg"
            type="text"
            value={search.query}
            onChange={(event) => {
              if (selectedClient) clear()
              search.handleSearch(event.target.value)
            }}
            onFocus={search.reopenSuggestions}
            placeholder="Nom ou téléphone du client"
            readOnly={selectedClient !== null}
            className={selectedClient ? 'bg-bg' : ''}
            aria-label="Rechercher un client"
          />
        )}

        {search.showSuggestions && search.results.length > 0 && (
          <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border-2 border-border bg-white shadow-lg">
            {search.results.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => select(client)}
                className="block min-h-12 w-full border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-bg"
              >
                <p className="text-sm font-semibold text-text">{client.nom}</p>
                {client.telephone && <p className="text-xs text-text-secondary">{client.telephone}</p>}
              </button>
            ))}
          </div>
        )}
      </div>

      {search.query.trim() && !selectedClient && search.results.length === 0 && (
        <Button type="button" variant="outline" size="touch" className="w-full justify-start" onClick={onAddNew}>
          Créer ce client
        </Button>
      )}

      {selectedClient && (
        <div className="rounded-md border-2 border-blue bg-blue-light p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label variant="caps" className="text-blue">Client sélectionné</Label>
              <p className="mt-1 text-sm font-bold text-text">{selectedClient.nom}</p>
              <p className="text-xs text-text-secondary">
                {selectedClient.telephone || 'Téléphone non renseigné'}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={clear}>
              Changer
            </Button>
          </div>
        </div>
      )}

      <Button type="button" variant="outline" size="touch" className="w-full" onClick={onAddNew}>
        Créer un nouveau client
      </Button>
    </Card>
  )
}
