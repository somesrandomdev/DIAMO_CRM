// src/pages/VenteUltraSimple.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useVenteStore } from '../stores/venteStore'
import { generateTicket } from '../lib/ticketGenerator'
import AddClientUltra from './AddClientUltra'
import { BackButton, LogoutButton } from '../components/NavControls'
import { toCFA } from '../utils/price'

export default function VenteUltraSimple({ onBack }: { onBack: () => void }) {
  const { profile } = useAuthStore()
  const { clients, offres, loadClients, loadOffres } = useVenteStore()

  const [showAddClient, setShowAddClient] = useState(false)
  const [clientId, setClientId] = useState('')
  const [cartItems, setCartItems] = useState<Array<{offreId: string, qty: number, offre?: any, prix?: number}>>([])
  const [loading, setLoading] = useState(false)

  // Client search state
  const [clientSearchQuery, setClientSearchQuery] = useState('')
  const [clientSearchResults, setClientSearchResults] = useState<typeof clients>([])
  const [showClientSuggestions, setShowClientSuggestions] = useState(false)
  const [selectedClient, setSelectedClient] = useState<typeof clients[0] | null>(null)

  // Cart management functions
  const addToCart = (offreId: string, qty: number) => {
    const offreRow = safeOffers.find((o) => o.offre_id === offreId)
    if (!offreRow) return

    const existingItemIndex = cartItems.findIndex(item => item.offreId === offreId)
    if (existingItemIndex >= 0) {
      // Update quantity if item already exists
      const updatedCart = [...cartItems]
      updatedCart[existingItemIndex].qty += qty
      setCartItems(updatedCart)
    } else {
      // Add new item to cart
      setCartItems([...cartItems, { offreId, qty, offre: offreRow.offre, prix: offreRow.prix }])
    }
  }

  const removeFromCart = (offreId: string) => {
    setCartItems(cartItems.filter(item => item.offreId !== offreId))
  }

  const updateCartQuantity = (offreId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(offreId)
      return
    }

    const updatedCart = cartItems.map(item =>
      item.offreId === offreId ? { ...item, qty } : item
    )
    setCartItems(updatedCart)
  }

  const getTotalAmount = () => {
    return cartItems.reduce((total, item) => total + (item.prix || 0) * item.qty, 0)
  }

  // Load data once the kiosk id is available
  useEffect(() => {
    if (!profile?.kiosque_id) {
      if (profile?.role === 'administrateur') {
        console.log('Admin user accessing vente - this should not happen due to navigation restrictions')
        onBack()
        return
      } else if (profile?.role === 'fontainier') {
        console.log('Fontainier without kiosk_id, redirecting to dashboard')
        onBack()
        return
      } else {
        console.log('No kiosk_id available, redirecting to dashboard')
        onBack()
        return
      }
    }
    if (profile?.kiosque_id) {
      loadClients(profile.kiosque_id)
      loadOffres(profile.kiosque_id)
    }
  }, [profile?.kiosque_id, onBack])

  const safeClients = clients.filter((c) => c?.nom)
  const safeOffers = offres.filter((o) => o?.offre?.nom)

  // Client search functions
  const handleClientSearch = (query: string) => {
    setClientSearchQuery(query)

    if (query.trim().length === 0) {
      setClientSearchResults([])
      setShowClientSuggestions(false)
      return
    }

    // Filter clients based on search query
    const filtered = safeClients.filter(client =>
      client.nom.toLowerCase().includes(query.toLowerCase()) ||
      (client.telephone && client.telephone.includes(query))
    ).slice(0, 10) // Limit to 10 suggestions

    setClientSearchResults(filtered)
    setShowClientSuggestions(filtered.length > 0)
  }

  const selectClient = (client: typeof clients[0]) => {
    setSelectedClient(client)
    setClientId(client.id)
    setClientSearchQuery(client.nom)
    setShowClientSuggestions(false)
  }

  const clearClientSelection = () => {
    setSelectedClient(null)
    setClientId('')
    setClientSearchQuery('')
    setClientSearchResults([])
    setShowClientSuggestions(false)
  }

  // Handle click outside to close suggestions
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || cartItems.length === 0) return
    setLoading(true)

    try {
      // Create multiple sales for each cart item
      const sales = []
      for (const item of cartItems) {
        const total = (item.prix || 0) * item.qty

        const { data: sale, error: saleError } = await supabase
          .from('ventes')
          .insert({
            kiosque_id: profile!.kiosque_id,
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

      // Generate a combined ticket for all items
      const ticket = await generateTicket({
        client: safeClients.find((c) => c.id === clientId) || { nom: 'Client' },
        offres: cartItems.map(item => ({
          ...item.offre,
          prix: item.prix || 0,
          quantite: item.qty,
          sous_total: (item.prix || 0) * item.qty
        })),
        montant_total: getTotalAmount(),
        kiosque: { nom: (profile?.kiosques as any)?.nom || String(profile?.kiosque_id) },
      })

      const pdfBlob = await (await fetch(ticket)).blob()
      const fileName = `ticket-multi-${sales[0].id}.pdf`

      // Upload to private bucket
      const { error: uploadError } = await supabase.storage
        .from('private_tickets')
        .upload(fileName, pdfBlob, { upsert: false })

      if (uploadError) {
        alert('Upload échoué : ' + uploadError.message)
        setLoading(false)
        return
      }

      // Store private path in the first sale (main ticket)
      const privatePath = `private_tickets/${fileName}`
      await supabase.from('ventes').update({ lien_ticket: privatePath }).eq('id', sales[0].id)

      // Signed download URL (60 s)
      const { data: signedData } = await supabase.storage
        .from('private_tickets')
        .createSignedUrl(fileName, 60, { download: true })

      if (!signedData?.signedUrl) {
        alert('Erreur génération lien téléchargement')
        setLoading(false)
        return
      }

      // Force download
      const link = document.createElement('a')
      link.href = signedData.signedUrl
      link.download = fileName
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Reset form
      alert(`Vente enregistrée ! ${cartItems.length} offre(s) - Ticket téléchargé.`)
      setClientId('')
      setCartItems([])
      setLoading(false)
      await loadClients(profile!.kiosque_id)
      await loadOffres(profile!.kiosque_id)
    } catch (error: any) {
      alert('Erreur lors de la vente : ' + error.message)
      setLoading(false)
    }
  }

  if (showAddClient) {
    return (
      <AddClientUltra
        onDone={(newId: string) => {
          setClientId(newId)
          setShowAddClient(false)
          loadClients(profile!.kiosque_id)
        }}
      />
    )
  }

  return (
    <div className="max-w-2xl mx-auto" style={{ padding: 'var(--spacing-lg)' }}>
      <div className="flex justify-between mb-6">
        <BackButton onBack={onBack} />
        <LogoutButton />
      </div>

      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>💵 Nouvelle vente</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>Enregistrer une vente</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sélection du client */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>👤 Sélection du client</h3>

          {/* Client Search Input */}
          <div className="relative client-search-container">
            <input
              type="text"
              value={clientSearchQuery}
              onChange={(e) => handleClientSearch(e.target.value)}
              onFocus={() => clientSearchQuery && setShowClientSuggestions(true)}
              placeholder="Tapez le nom du client..."
              className="w-full p-4 text-base rounded-lg font-medium transition-all pr-10"
              style={{
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)'
              }}
            />
            {selectedClient && (
              <button
                onClick={clearClientSelection}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            )}
          </div>

          {/* Client Suggestions Dropdown */}
          {showClientSuggestions && clientSearchResults.length > 0 && (
            <div className="relative z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {clientSearchResults.map(client => (
                <div
                  key={client.id}
                  onClick={() => selectClient(client)}
                  className="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                >
                  <div className="font-medium text-gray-900">{client.nom}</div>
                  {client.telephone && (
                    <div className="text-sm text-gray-500">{client.telephone}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Selected Client Display */}
          {selectedClient && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-blue-900">Client sélectionné:</span>
                  <span className="ml-2 text-blue-700 font-medium">{selectedClient.nom}</span>
                  {selectedClient.telephone && (
                    <span className="ml-2 text-blue-600">({selectedClient.telephone})</span>
                  )}
                </div>
                <button
                  onClick={clearClientSelection}
                  className="text-blue-500 hover:text-blue-700 text-sm underline"
                >
                  Changer
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAddClient(true)}
            className="w-full py-3 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md"
            style={{
              backgroundColor: 'var(--color-secondary)',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-secondary)'
            }}
          >
            + Créer un nouveau client
          </button>
        </div>

        {/* Cart Section */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>🛒 Panier de vente</h3>

          {/* Add to Cart Form */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <select
                id="offre-select"
                className="p-3 text-base rounded-lg font-medium transition-all"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)'
                }}
              >
                <option value="">- Choisir offre -</option>
                {safeOffers.map((o) => (
                  <option key={o.offre_id} value={o.offre_id}>
                    {o.offre.nom} – {toCFA(o.prix)}
                  </option>
                ))}
              </select>

              <input
                type="number"
                id="qty-input"
                min="1"
                placeholder="Qté"
                className="p-3 text-base rounded-lg font-medium transition-all"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)'
                }}
              />

              <button
                type="button"
                onClick={() => {
                  const select = document.getElementById('offre-select') as HTMLSelectElement
                  const input = document.getElementById('qty-input') as HTMLInputElement
                  const offreId = select.value
                  const qty = Math.max(1, Number(input.value))

                  if (offreId) {
                    addToCart(offreId, qty)
                    select.value = ''
                    input.value = '1'
                  }
                }}
                className="p-3 rounded-lg font-semibold transition-all"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: 'white'
                }}
              >
                Ajouter
              </button>
            </div>
          </div>

          {/* Cart Items */}
          {cartItems.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                Articles ({cartItems.length})
              </h4>
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div key={item.offreId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                        {item.offre?.nom}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {toCFA(item.prix || 0)} × {item.qty} = {toCFA((item.prix || 0) * item.qty)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => updateCartQuantity(item.offreId, Math.max(1, Number(e.target.value)))}
                        className="w-16 p-1 text-sm border border-gray-300 rounded"
                      />
                      <button
                        onClick={() => removeFromCart(item.offreId)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                    Total:
                  </span>
                  <span className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
                    {toCFA(getTotalAmount())}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Validation */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={loading || !clientId || cartItems.length === 0}
            className="w-full py-4 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md text-lg"
            style={{
              backgroundColor: 'var(--color-success)',
              color: 'white',
              opacity: (loading || !clientId || cartItems.length === 0) ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading && clientId && cartItems.length > 0) e.currentTarget.style.backgroundColor = 'var(--color-success)'
            }}
            onMouseLeave={(e) => {
              if (!loading && clientId && cartItems.length > 0) e.currentTarget.style.backgroundColor = 'var(--color-success)'
            }}
          >
            {loading
              ? 'Traitement...'
              : `Enregistrer la vente - ${toCFA(getTotalAmount())}`}
          </button>
        </div>
      </form>
    </div>
  )
}