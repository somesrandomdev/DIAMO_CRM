import { useEffect, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { ClientImportDialog } from '@/components/ClientImportDialog'
import { SearchBar } from '@/components/SearchBar'
import { useToast } from '@/components/Toast'
import { openTicketDownload } from '@/lib/ticketDownload'
import { resolveKioskScope } from '@/lib/kioskScope'
import { supabase } from '@/lib/supabase'
import { logError } from '@/lib/telemetry'
import { useAuthStore } from '@/stores/authStore'
import { toCFA } from '@/utils/price'

type Client = {
  id: string
  nom: string
  telephone?: string
  adresse?: string
  email?: string
  localite?: string
  type_client?: string
  nombre_personnes?: number
  contenant_prefere?: string
  preference_contact?: string
  accepte_offres?: boolean
  situation_familiale?: string
  notes?: string
}

type Vente = {
  id: string
  created_at: string
  montant_total: number
  quantite?: number
  lien_ticket?: string
  offre: { nom: string; volume_ml?: number } | null
}

export default function ClientListUltra({ onBack }: { onBack: () => void }) {
  const { profile } = useAuthStore()
  const { showToast } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [selected, setSelected] = useState<Client | null>(null)
  const [ventes, setVentes] = useState<Vente[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 50

  // Debounce: la recherche tape dans la requête serveur, pas à chaque frappe.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchDebounced(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(0)
  }, [searchDebounced])

  const visibleClients = clients

  // Server-side pagination (range + count exact) scoped by role, with
  // server-side search — no more full-table loads on hundreds of clients.
  useEffect(() => {
    if (!profile) return

    let cancelled = false
    setIsLoading(true)

    resolveKioskScope(profile).then(async (scope) => {
      if (cancelled) return
      if (scope !== null && scope.length === 0) {
        setClients([])
        setTotalCount(0)
        setIsLoading(false)
        return
      }

      let query = supabase
        .from('clients')
        .select('id, nom, telephone, adresse, email, localite, type_client, nombre_personnes, contenant_prefere, preference_contact, accepte_offres, situation_familiale, notes, kiosque_id', { count: 'exact' })
      if (scope) {
        query = query.in('kiosque_id', scope)
      }
      if (searchDebounced.trim()) {
        const term = `%${searchDebounced.trim()}%`
        query = query.or(`nom.ilike.${term},telephone.ilike.${term}`)
      }
      query = query
        .order('nom')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      const { data, count, error } = await query
      if (cancelled) return
      if (error) {
        logError('clients', 'chargement paginé des clients échoué', { code: error.code, message: error.message })
        console.error('Error loading clients page:', error.code, error.message)
        setClients([])
        setTotalCount(0)
      } else {
        setClients((data || []) as Client[])
        setTotalCount(count ?? 0)
      }
      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [page, profile, searchDebounced])

  const reloadClients = () => {
    if (!profile) return
    void (async () => {
      setIsLoading(true)
      const scope = await resolveKioskScope(profile)
      if (scope !== null && scope.length === 0) {
        setClients([])
        setTotalCount(0)
        setIsLoading(false)
        return
      }

      let query = supabase
        .from('clients')
        .select('id, nom, telephone, adresse, email, localite, type_client, nombre_personnes, contenant_prefere, preference_contact, accepte_offres, situation_familiale, notes, kiosque_id', { count: 'exact' })
      if (scope) {
        query = query.in('kiosque_id', scope)
      }
      if (searchDebounced.trim()) {
        const term = `%${searchDebounced.trim()}%`
        query = query.or(`nom.ilike.${term},telephone.ilike.${term}`)
      }
      query = query
        .order('nom')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      const { data, count } = await query
      setClients((data || []) as Client[])
      setTotalCount(count ?? 0)
      setIsLoading(false)
    })()
  }

  async function loadVentes(clientId: string) {
    const { data } = await supabase
      .from('ventes')
      .select('id, created_at, montant_total, quantite, lien_ticket, offre:offres!inner(nom, volume_ml)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    const transformedVentes = (data || []).map((vente) => ({
      ...vente,
      offre: Array.isArray(vente.offre) ? vente.offre[0] || null : vente.offre,
    })) as Vente[]

    setVentes(transformedVentes)
  }

  function handleSelect(client: Client) {
    setSelected(client)
    loadVentes(client.id)
  }

  const downloadTicket = async (lien: string) => {
    const ok = await openTicketDownload(lien)
    if (!ok) {
      showToast({
        type: 'error',
        title: 'Ticket indisponible',
        message: 'Erreur lors du téléchargement du ticket.',
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-text">Mes clients</h1>
          <p className="text-xs text-text-secondary">Fiches clients et historique des achats.</p>
        </div>
        <div className="flex gap-2">
          {profile?.kiosque_id && (
            <Button
              type="button"
              variant="outline" size="touch"
              onClick={() => setIsImportOpen(true)}
            >
              <Upload className="h-4 w-4" />
              Importer
            </Button>
          )}
          {/* Fontainier : « Retour » mènerait à l'onglet Vendre, déjà dans la barre d'onglets. */}
          {profile?.role !== 'fontainier' && (
            <Button type="button" variant="default" size="sm" onClick={onBack}>Retour</Button>
          )}
        </div>
      </div>

      <ClientImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        kiosqueId={profile?.kiosque_id ?? ''}
        onImported={reloadClients}
      />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-24" />)}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          title="Aucun client"
          description="Importez vos clients via CSV ou ajoutez-les manuellement pendant les ventes."
          action={
            profile?.kiosque_id ? (
              <Button type="button" variant="primary" onClick={() => setIsImportOpen(true)}>
                Importer via CSV
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="sm:w-80">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Nom ou téléphone du client"
              resultCount={totalCount}
            />
          </div>

          {clients.length === 0 && searchDebounced.trim() ? (
            <EmptyState
              title="Aucun résultat"
              description="Essayez un autre nom ou numéro de téléphone."
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleClients.map((client) => (
                  <Card key={client.id} padding="md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text">{client.nom}</p>
                        <p className="mt-1 truncate text-xs text-text-secondary">
                          {client.telephone || 'Téléphone non renseigné'}
                        </p>
                        <p className="mt-1 truncate text-xs text-text-tertiary">
                          {client.localite || client.adresse || 'Localité non renseignée'}
                        </p>
                      </div>
                      <StatusBadge variant={client.accepte_offres ? 'success' : 'neutral'}>
                        {client.accepte_offres ? 'Opt-in' : 'Standard'}
                      </StatusBadge>
                    </div>
                    <Button type="button" variant="primary" size="sm" className="mt-4 w-full" onClick={() => handleSelect(client)}>
                      Détails
                    </Button>
                  </Card>
                ))}

                {/* Server-side pagination: Prev / Page X / Next with exact count */}
                <div className="flex items-center justify-between gap-2 sm:col-span-2 xl:col-span-3">
                  <Button
                    type="button"
                    variant="outline" size="touch"
                    className="h-12"
                    disabled={page === 0}
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                  >
                    Précédent
                  </Button>
                  <span className="text-sm text-text-secondary [font-variant-numeric:tabular-nums]">
                    Page {page + 1} / {Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
                  </span>
                  <Button
                    type="button"
                    variant="outline" size="touch"
                    className="h-12"
                    disabled={(page + 1) * PAGE_SIZE >= totalCount}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3">
          <Card className="max-h-[86vh] w-full max-w-2xl overflow-y-auto">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{selected.nom}</CardTitle>
                  <p className="mt-1 text-xs text-text-secondary">
                    {selected.type_client || 'Particulier'} - {selected.localite || 'Localité non renseignée'}
                  </p>
                </div>
                <StatusBadge variant={selected.accepte_offres ? 'success' : 'neutral'}>
                  {selected.accepte_offres ? 'Accepte offres' : 'Sans opt-in'}
                </StatusBadge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ['Téléphone', selected.telephone || 'Non renseigné'],
                  ['Email', selected.email || 'Non renseigné'],
                  ['Adresse', selected.adresse || 'Non renseignée'],
                  ['Situation', selected.situation_familiale || 'Non renseignée'],
                  ['Personnes', String(selected.nombre_personnes || 1)],
                  ['Contenant', selected.contenant_prefere || 'Bouteille 10L'],
                  ['Contact', selected.preference_contact || 'Telephone'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md bg-muted p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{label}</p>
                    <p className="mt-1 text-xs text-text">{value}</p>
                  </div>
                ))}
              </div>

              {selected.notes && (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Notes</p>
                  <p className="mt-1 text-xs text-text">{selected.notes}</p>
                </div>
              )}

              <div>
                <h2 className="mb-2 text-xs font-semibold text-text">Historique des achats</h2>
                {ventes.length > 0 ? (
                  <div className="space-y-2">
                    {ventes.slice(0, 5).map((vente) => (
                      <div key={vente.id} className="rounded-md border border-border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-text-secondary">{vente.created_at.slice(0, 10)}</p>
                          <p className="font-mono text-sm font-semibold text-blue">{toCFA(vente.montant_total)}</p>
                        </div>
                        <p className="mt-1 text-xs font-medium text-text">{vente.offre?.nom || 'Offre inconnue'}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          Qte {vente.quantite || 1}
                          {vente.offre?.volume_ml ? ` - ${vente.offre.volume_ml / 1000}L` : ''}
                        </p>
                        {vente.lien_ticket && (
                          <Button
                            type="button"
                            variant="outline" size="touch"
                            className="mt-2 w-full"
                            aria-label="Télécharger le ticket"
                            onClick={() => downloadTicket(vente.lien_ticket as string)}
                          >
                            <Download className="h-4 w-4" />
                            Télécharger le ticket
                          </Button>
                        )}
                      </div>
                    ))}
                    {ventes.length > 5 && (
                      <p className="text-center text-xs text-text-secondary">
                        {ventes.length - 5} autres achats
                      </p>
                    )}
                  </div>
                ) : (
                  <EmptyState title="Aucun achat enregistre" className="border-0 bg-muted p-4" />
                )}
              </div>

              <Button
                type="button"
                variant="primary"
                className="w-full"
                onClick={() => {
                  setSelected(null)
                  setVentes([])
                }}
              >
                Fermer
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
