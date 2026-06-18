import { useCallback, useEffect, useState } from 'react'
import AddClientUltra from './AddClientUltra'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { FormInput, FormSelect } from '@/components/ui/form-input'
import { KPICard } from '@/components/ui/kpi-card'
import { useToast } from '@/components/Toast'
import { generateTicket } from '@/lib/ticketGenerator'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { type OfferRow, useVenteStore } from '@/stores/venteStore'
import {
  flushOfflineSales,
  getQueuedSalesCount,
  queueOfflineSale,
} from '@/utils/offlineSalesQueue'
import { toCFA } from '@/utils/price'

interface RecentSale {
  id: string
  created_at: string
  montant_total: number
  client_nom: string
  offre_nom: string
}

interface CartItem {
  offreId: string
  qty: number
  offre: OfferRow['offre']
  prix: number
}

function joinedName(value: { nom?: string } | { nom?: string }[] | null | undefined): string {
  if (Array.isArray(value)) return value[0]?.nom ?? 'Inconnu'
  return value?.nom ?? 'Inconnu'
}

export default function VenteUltraSimple({ onBack }: { onBack: () => void }) {
  const { profile } = useAuthStore()
  const { clients, offres, loadClients, loadOffres } = useVenteStore()
  const { showToast } = useToast()

  const [showAddClient, setShowAddClient] = useState(false)
  const [clientId, setClientId] = useState('')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saleSaved, setSaleSaved] = useState(false)
  const [dailyStats, setDailyStats] = useState({ ventes: 0, ca: 0 })
  const [recentSales, setRecentSales] = useState<RecentSale[]>([])
  const [clientSearchQuery, setClientSearchQuery] = useState('')
  const [clientSearchResults, setClientSearchResults] = useState<typeof clients>([])
  const [showClientSuggestions, setShowClientSuggestions] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedOfferId, setSelectedOfferId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [queuedCount, setQueuedCount] = useState(0)
  const [isSyncingQueue, setIsSyncingQueue] = useState(false)

  const safeClients = clients.filter((client) => client?.nom)
  const safeOffers = offres.filter((offer) => offer?.offre?.nom && offer.est_actif)
  const selectedClient = safeClients.find((client) => client.id === selectedClientId)

  const getTotalAmount = useCallback(() => {
    return cartItems.reduce((total, item) => total + item.prix * item.qty, 0)
  }, [cartItems])

  const resetForm = useCallback(() => {
    setClientId('')
    setSelectedClientId('')
    setClientSearchQuery('')
    setClientSearchResults([])
    setShowClientSuggestions(false)
    setCartItems([])
    setSelectedOfferId('')
    setQuantity('')
  }, [])

  const loadVenteSummary = useCallback(async (kiosqueId: string) => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [todayResult, recentResult] = await Promise.all([
      supabase
        .from('ventes')
        .select('id, montant_total')
        .eq('kiosque_id', kiosqueId)
        .gte('created_at', todayStart.toISOString()),
      supabase
        .from('ventes')
        .select('id, created_at, montant_total, clients(nom), offres(nom)')
        .eq('kiosque_id', kiosqueId)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    if (todayResult.error) {
      console.error('Error loading daily sale stats:', todayResult.error)
    } else {
      const rows = todayResult.data ?? []
      setDailyStats({
        ventes: rows.length,
        ca: rows.reduce((sum, sale) => sum + (sale.montant_total ?? 0), 0),
      })
    }

    if (recentResult.error) {
      console.error('Error loading recent sales:', recentResult.error)
    } else {
      setRecentSales(
        (recentResult.data ?? []).map((sale) => ({
          id: sale.id,
          created_at: sale.created_at,
          montant_total: sale.montant_total ?? 0,
          client_nom: joinedName(sale.clients),
          offre_nom: joinedName(sale.offres),
        }))
      )
    }
  }, [])

  const refreshQueuedCount = useCallback(async () => {
    setQueuedCount(await getQueuedSalesCount())
  }, [])

  const syncOfflineQueue = useCallback(async () => {
    if (!profile?.kiosque_id || typeof navigator !== 'undefined' && !navigator.onLine) return

    setIsSyncingQueue(true)
    try {
      const result = await flushOfflineSales()
      await refreshQueuedCount()

      if (result.flushed > 0) {
        showToast({
          type: 'success',
          title: 'Ventes synchronisees',
          message: `${result.flushed} vente(s) hors ligne synchronisee(s).`,
        })
        await loadVenteSummary(profile.kiosque_id)
      }

      if (result.failed > 0) {
        showToast({
          type: 'warning',
          title: 'Synchronisation partielle',
          message: `${result.failed} vente(s) restent en attente.`,
        })
      }
    } finally {
      setIsSyncingQueue(false)
    }
  }, [loadVenteSummary, profile?.kiosque_id, refreshQueuedCount, showToast])

  useEffect(() => {
    if (!profile?.kiosque_id) {
      onBack()
      return
    }

    loadClients(profile.kiosque_id)
    loadOffres(profile.kiosque_id)
    loadVenteSummary(profile.kiosque_id)
  }, [loadClients, loadOffres, loadVenteSummary, onBack, profile?.kiosque_id])

  useEffect(() => {
    refreshQueuedCount()

    const handleOnline = () => {
      setIsOnline(true)
      syncOfflineQueue()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncOfflineQueue()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [refreshQueuedCount, syncOfflineQueue])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.client-search-container')) {
        setShowClientSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addToCart = (offreId: string, qty: number) => {
    const offreRow = safeOffers.find((offer) => offer.offre_id === offreId)
    if (!offreRow) return

    setCartItems((current) => {
      const existing = current.find((item) => item.offreId === offreId)
      if (existing) {
        return current.map((item) =>
          item.offreId === offreId ? { ...item, qty: item.qty + qty } : item
        )
      }
      return [...current, { offreId, qty, offre: offreRow.offre, prix: offreRow.prix }]
    })
  }

  const removeFromCart = (offreId: string) => {
    setCartItems((current) => current.filter((item) => item.offreId !== offreId))
  }

  const updateCartQuantity = (offreId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(offreId)
      return
    }

    setCartItems((current) =>
      current.map((item) => (item.offreId === offreId ? { ...item, qty } : item))
    )
  }

  const handleClientSearch = (query: string) => {
    setClientSearchQuery(query)

    if (query.trim().length === 0) {
      setClientSearchResults([])
      setShowClientSuggestions(false)
      return
    }

    const filtered = safeClients
      .filter((client) =>
        client.nom.toLowerCase().includes(query.toLowerCase()) ||
        (client.telephone && client.telephone.includes(query))
      )
      .slice(0, 10)

    setClientSearchResults(filtered)
    setShowClientSuggestions(filtered.length > 0)
  }

  const selectClient = (client: typeof clients[0]) => {
    setSelectedClientId(client.id)
    setClientId(client.id)
    setClientSearchQuery(client.nom)
    setShowClientSuggestions(false)
  }

  const clearClientSelection = () => {
    setSelectedClientId('')
    setClientId('')
    setClientSearchQuery('')
    setClientSearchResults([])
    setShowClientSuggestions(false)
  }

  const getQuantityValue = () => {
    const parsed = Number(quantity)
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!profile?.kiosque_id || !clientId || cartItems.length === 0) return

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await queueOfflineSale({
        kiosque_id: profile.kiosque_id,
        client_id: clientId,
        created_at: new Date().toISOString(),
        items: cartItems.map((item) => ({
          offre_id: item.offreId,
          quantite: item.qty,
          montant_total: item.prix * item.qty,
        })),
      })

      await refreshQueuedCount()
      setSaleSaved(true)
      showToast({
        type: 'success',
        title: 'Vente mise en file',
        message: 'Mode hors ligne: la vente sera synchronisee a la reconnexion.',
      })

      window.setTimeout(() => {
        resetForm()
        setSaleSaved(false)
      }, 1200)
      return
    }

    setLoading(true)

    try {
      const sales = []
      for (const item of cartItems) {
        const total = item.prix * item.qty

        const { data: sale, error: saleError } = await supabase
          .from('ventes')
          .insert({
            kiosque_id: profile.kiosque_id,
            client_id: clientId,
            offre_id: item.offreId,
            quantite: item.qty,
            montant_total: total,
          })
          .select('id')
          .single()

        if (saleError) throw saleError
        sales.push({ ...sale, ...item, montant_total: total })
      }

      const ticket = await generateTicket({
        client: safeClients.find((client) => client.id === clientId) || { nom: 'Client' },
        offres: cartItems.map((item) => ({
          ...item.offre,
          prix: item.prix,
          quantite: item.qty,
          sous_total: item.prix * item.qty,
        })),
        montant_total: getTotalAmount(),
        kiosque: { nom: profile.kiosques?.nom || String(profile.kiosque_id) },
      })

      const pdfBlob = await (await fetch(ticket)).blob()
      const fileName = `ticket-multi-${sales[0].id}.pdf`

      const { error: uploadError } = await supabase.storage
        .from('private_tickets')
        .upload(fileName, pdfBlob, { upsert: false })

      if (uploadError) {
        showToast({
          type: 'error',
          title: 'Upload ticket echoue',
          message: uploadError.message,
        })
        setLoading(false)
        return
      }

      const privatePath = `private_tickets/${fileName}`
      await supabase.from('ventes').update({ lien_ticket: privatePath }).eq('id', sales[0].id)

      const { data: signedData } = await supabase.storage
        .from('private_tickets')
        .createSignedUrl(fileName, 60, { download: true })

      if (!signedData?.signedUrl) {
        showToast({
          type: 'error',
          title: 'Lien ticket indisponible',
          message: 'La vente est enregistree, mais le lien de telechargement a echoue.',
        })
        setLoading(false)
        return
      }

      const link = document.createElement('a')
      link.href = signedData.signedUrl
      link.download = fileName
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setLoading(false)
      setSaleSaved(true)
      showToast({
        type: 'success',
        title: 'Vente enregistree',
        message: `${cartItems.length} offre(s) - ticket telecharge.`,
      })

      window.setTimeout(async () => {
        resetForm()
        setSaleSaved(false)
        if (profile.kiosque_id) {
          await loadClients(profile.kiosque_id)
          await loadOffres(profile.kiosque_id)
          await loadVenteSummary(profile.kiosque_id)
        }
      }, 2000)
    } catch (error: unknown) {
      showToast({
        type: 'error',
        title: 'Erreur lors de la vente',
        message: error instanceof Error ? error.message : 'Erreur inconnue',
      })
      setLoading(false)
      setSaleSaved(false)
    }
  }

  if (showAddClient) {
    return (
      <AddClientUltra
        onDone={(newId: string) => {
          setClientId(newId)
          setSelectedClientId(newId)
          setShowAddClient(false)
          if (profile?.kiosque_id) {
            loadClients(profile.kiosque_id)
          }
        }}
      />
    )
  }

  const isValid = Boolean(clientId && cartItems.length > 0 && !loading && !saleSaved)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[15px] font-semibold text-text">Nouvelle vente</h1>
          <p className="text-[12px] text-text-secondary">Enregistrer une vente et generer le ticket.</p>
        </div>
        <Button type="button" variant="default" size="sm" onClick={onBack}>Retour</Button>
      </div>

      {!isOnline && (
        <div className="rounded-md border border-amber bg-amber-light p-3 text-[12px] text-text">
          <p className="font-semibold text-amber">Mode hors ligne</p>
          <p className="mt-1 text-text-secondary">
            La prochaine vente valide sera conservee sur cet appareil puis synchronisee a la reconnexion.
          </p>
        </div>
      )}

      {queuedCount > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-blue bg-blue-light p-3 text-[12px] text-text sm:flex-row sm:items-center sm:justify-between">
          <span>
            {queuedCount} vente(s) en attente de synchronisation
            {isSyncingQueue ? ' - synchronisation en cours' : ''}
          </span>
          {isOnline && (
            <Button type="button" variant="default" size="sm" onClick={syncOfflineQueue} disabled={isSyncingQueue}>
              Synchroniser
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <KPICard label="Ventes du jour" value={dailyStats.ventes} />
        <KPICard label="CA du jour" value={toCFA(dailyStats.ca)} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="client-search-container relative">
              <FormInput
                type="text"
                value={clientSearchQuery}
                onChange={(event) => {
                  if (selectedClientId) clearClientSelection()
                  handleClientSearch(event.target.value)
                }}
                onFocus={() => clientSearchQuery && setShowClientSuggestions(true)}
                placeholder="Nom ou telephone du client"
                readOnly={selectedClientId !== ''}
                className={selectedClientId ? 'bg-muted' : ''}
              />

              {showClientSuggestions && clientSearchResults.length > 0 && (
                <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
                  {clientSearchResults.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => selectClient(client)}
                      className="block min-h-11 w-full border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-muted"
                    >
                      <p className="text-[13px] font-medium text-text">{client.nom}</p>
                      {client.telephone && <p className="text-[12px] text-text-secondary">{client.telephone}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {clientSearchQuery.trim() && !selectedClientId && clientSearchResults.length === 0 && (
              <Button type="button" variant="default" className="w-full justify-start" onClick={() => setShowAddClient(true)}>
                Creer ce client
              </Button>
            )}

            {selectedClient && (
              <div className="rounded-md border border-teal bg-teal-light p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-teal">Client selectionne</p>
                    <p className="mt-1 text-[14px] font-semibold text-text">{selectedClient.nom}</p>
                    <p className="text-[12px] text-text-secondary">{selectedClient.telephone || 'Telephone non renseigne'}</p>
                  </div>
                  <Button type="button" variant="default" size="sm" onClick={clearClientSelection}>
                    Changer
                  </Button>
                </div>
              </div>
            )}

            <Button type="button" variant="primary" className="w-full" onClick={() => setShowAddClient(true)}>
              Creer un nouveau client
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Panier de vente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[1fr_100px_auto]">
              <FormSelect value={selectedOfferId} onChange={(event) => setSelectedOfferId(event.target.value)}>
                <option value="">Choisir une offre</option>
                {safeOffers.map((offer) => (
                  <option key={offer.offre_id} value={offer.offre_id}>
                    {offer.offre.nom} - {toCFA(offer.prix)}
                  </option>
                ))}
              </FormSelect>

              <FormInput
                type="number"
                min={1}
                inputMode="numeric"
                pattern="[0-9]*"
                value={quantity}
                onChange={(event) => {
                  const nextValue = event.target.value
                  if (/^\d*$/.test(nextValue)) setQuantity(nextValue)
                }}
                onFocus={(event) => event.currentTarget.select()}
                placeholder="1"
              />

              <Button
                type="button"
                variant="default"
                onClick={() => {
                  if (!selectedOfferId) return
                  addToCart(selectedOfferId, getQuantityValue())
                  setSelectedOfferId('')
                  setQuantity('')
                }}
                disabled={!selectedOfferId}
              >
                Ajouter
              </Button>
            </div>

            {cartItems.length > 0 ? (
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div key={item.offreId} className="rounded-md bg-muted p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[13px] font-medium text-text">{item.offre.nom}</p>
                        <p className="text-[12px] text-text-secondary">
                          {toCFA(item.prix)} x {item.qty} = {toCFA(item.prix * item.qty)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <FormInput
                          type="number"
                          min={1}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={item.qty}
                          onChange={(event) => updateCartQuantity(item.offreId, Math.max(1, Number(event.target.value)))}
                          onFocus={(event) => event.currentTarget.select()}
                          className="w-20"
                        />
                        <Button type="button" variant="destructive" size="icon-sm" onClick={() => removeFromCart(item.offreId)} aria-label="Supprimer">
                          x
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-[13px] font-semibold text-text">Total</span>
                  <span className="font-mono text-[18px] font-bold text-blue">{toCFA(getTotalAmount())}</span>
                </div>
              </div>
            ) : (
              <EmptyState title="Panier vide" description="Ajoutez au moins une offre pour enregistrer la vente." className="border-0 bg-muted p-4" />
            )}
          </CardContent>
        </Card>

        <div className="sticky bottom-3 z-10 rounded-md border border-border bg-surface p-3">
          <p className="mb-2 text-[12px] text-text-secondary">
            {clientId ? 'Client selectionne' : 'Client requis'} - {cartItems.length > 0 ? `${cartItems.length} article(s)` : 'Panier vide'}
          </p>
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={loading}
            disabled={!isValid}
          >
            {saleSaved ? 'Vente enregistree' : `Enregistrer - ${toCFA(getTotalAmount())}`}
          </Button>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Dernieres ventes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentSales.length > 0 ? (
            <div className="space-y-2">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between gap-3 rounded-md bg-muted p-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-text">{sale.client_nom}</p>
                    <p className="truncate text-[12px] text-text-secondary">
                      {sale.offre_nom} - {new Date(sale.created_at).toLocaleDateString('fr-FR')} {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-[13px] font-semibold text-blue">{toCFA(sale.montant_total)}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Aucune vente recente" className="border-0 bg-muted p-4" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
