// src/pages/VenteUltraSimple.tsx
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useVenteStore } from '../stores/venteStore'
import { generateTicket } from '../lib/ticketGenerator'
import AddClientUltra from './AddClientUltra'
import { BackButton, LogoutButton } from '../components/NavControls'
import { useToast } from '../components/Toast'
import { toCFA } from '../utils/price'

interface RecentSale {
  id: string
  created_at: string
  montant_total: number
  client_nom: string
  offre_nom: string
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
  const [cartItems, setCartItems] = useState<Array<{offreId: string, qty: number, offre?: any, prix?: number}>>([])
  const [loading, setLoading] = useState(false)
  const [saleSaved, setSaleSaved] = useState(false)
  const [dailyStats, setDailyStats] = useState({ ventes: 0, ca: 0 })
  const [recentSales, setRecentSales] = useState<RecentSale[]>([])

  // Client search state
  const [clientSearchQuery, setClientSearchQuery] = useState('')
  const [clientSearchResults, setClientSearchResults] = useState<typeof clients>([])
  const [showClientSuggestions, setShowClientSuggestions] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string>('')

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

  const resetForm = useCallback(() => {
    setClientId('')
    setSelectedClientId('')
    setClientSearchQuery('')
    setClientSearchResults([])
    setShowClientSuggestions(false)
    setCartItems([])
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
      loadVenteSummary(profile.kiosque_id)
    }
  }, [loadClients, loadOffres, loadVenteSummary, onBack, profile?.kiosque_id, profile?.role])

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
        showToast({
          type: 'error',
          title: 'Upload ticket echoue',
          message: uploadError.message,
        })
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
        showToast({
          type: 'error',
          title: 'Lien ticket indisponible',
          message: 'La vente est enregistree, mais le lien de telechargement a echoue.',
        })
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
        if (profile?.kiosque_id) {
          await loadClients(profile.kiosque_id)
          await loadOffres(profile.kiosque_id)
          await loadVenteSummary(profile.kiosque_id)
        }
      }, 2000)
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Erreur lors de la vente',
        message: error.message,
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

      <div className="mb-6 grid grid-cols-2 gap-3 rounded-lg border p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Ventes du jour</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{dailyStats.ventes}</p>
        </div>
        <div className="text-right">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>CA du jour</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{toCFA(dailyStats.ca)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sélection du client */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>👤 Sélection du client</h3>

          {/* Client Search Input and Suggestions */}
          <div className="client-search-container">
            <div className="relative">
              <input
                type="text"
                value={clientSearchQuery}
                onChange={(e) => {
                  if (selectedClientId) {
                    clearClientSelection()
                  }
                  handleClientSearch(e.target.value)
                }}
                onFocus={() => clientSearchQuery && setShowClientSuggestions(true)}
                placeholder="Tapez le nom du client..."
                readOnly={selectedClientId !== ''}
                className={`w-full p-4 text-base rounded-lg font-medium transition-all ${
                  selectedClientId ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: selectedClientId ? '#f3f4f6' : 'var(--color-surface)',
                  color: 'var(--color-text)'
                }}
              />
            </div>

            {/* Client Suggestions Dropdown */}
            {showClientSuggestions && clientSearchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                {clientSearchResults.map(client => (
                  <div
                    key={client.id}
                    onClick={() => selectClient(client)}
                    className="px-4 py-3 hover:bg-surface-hover cursor-pointer border-b border-border last:border-b-0"
                    style={{ 
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)'
                    }}
                  >
                    <div className="font-medium text-text-primary">{client.nom}</div>
                    {client.telephone && (
                      <div className="text-sm text-text-secondary">{client.telephone}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {clientSearchQuery.trim() && !selectedClientId && clientSearchResults.length === 0 && (
              <button
                type="button"
                onClick={() => setShowAddClient(true)}
                className="mt-2 w-full rounded-lg border px-4 py-3 text-left font-semibold transition-all hover:shadow-sm"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-primary)',
                  color: 'var(--color-primary)',
                }}
              >
                Creer ce client -&gt;
              </button>
            )}
          </div>

          {/* Selected Client Display Field - Prominent and always visible when selected */}
          {selectedClientId && (
            <div className="mt-4 p-6 bg-green-50 border-3 border-green-500 rounded-xl shadow-lg animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                    <span className="text-white font-bold text-2xl">✓</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-green-800 mb-2 uppercase tracking-wide">Client sélectionné</div>
                    <div className="text-2xl font-extrabold text-green-900 mb-1">
                      {safeClients.find(c => c.id === selectedClientId)?.nom}
                    </div>
                    <div className="flex items-center gap-4 text-lg text-green-700">
                      <span className="flex items-center gap-2">
                        📞 {safeClients.find(c => c.id === selectedClientId)?.telephone || 'Non renseigné'}
                      </span>
                      <span className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm font-medium">
                        ID: {selectedClientId.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={clearClientSelection}
                    className="px-6 py-3 bg-white border-2 border-green-500 text-green-700 rounded-lg font-semibold hover:bg-green-100 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-1"
                  >
                    Changer de client
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const client = safeClients.find(c => c.id === selectedClientId)
                      if (client) {
                        setClientSearchQuery(client.nom)
                        setShowClientSuggestions(true)
                      }
                    }}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    Voir dans la liste
                  </button>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAddClient(true)}
            className="w-full py-3 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)'
            }}
          >
            + Créer un nouveau client
          </button>
        </div>

          {/* Cart Section */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>🛒 Panier de vente</h3>

          {/* Add to Cart Form */}
          <div className="bg-surface p-4 rounded-lg space-y-3" style={{ backgroundColor: 'var(--color-surface)' }}>
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-primary)'
                }}
              >
                Ajouter
              </button>
            </div>
          </div>

          {/* Cart Items */}
          {cartItems.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <h4 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                Articles ({cartItems.length})
              </h4>
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div key={item.offreId} className="flex items-center justify-between p-3 bg-surface-hover rounded-lg" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
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
                        className="w-16 p-1 text-sm border border-border rounded" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                      />
                      <button
                        onClick={() => removeFromCart(item.offreId)}
                        className="text-error hover:text-error-dark p-1"
                        style={{ color: 'var(--color-error)' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border">
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
          <div className="mb-3 text-sm text-text-secondary">
            Conditions pour valider : 
            {clientId ? ' ✓ Client sélectionné' : ' ❌ Client non sélectionné'} | 
            {cartItems.length > 0 ? ` ✓ ${cartItems.length} article(s)` : ' ❌ Panier vide'} | 
            {loading ? ' ⏳ En cours...' : ' ✅ Prêt'}
          </div>
          <button
            type="submit"
            disabled={loading || saleSaved || !clientId || cartItems.length === 0}
            className="w-full py-4 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md text-lg"
            style={{
              backgroundColor: 'var(--color-success)',
              color: 'white',
              opacity: (loading || saleSaved || !clientId || cartItems.length === 0) ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading && !saleSaved && clientId && cartItems.length > 0) e.currentTarget.style.backgroundColor = 'var(--color-success-dark)'
            }}
            onMouseLeave={(e) => {
              if (!loading && !saleSaved && clientId && cartItems.length > 0) e.currentTarget.style.backgroundColor = 'var(--color-success)'
            }}
          >
            {loading
              ? 'Traitement...'
              : saleSaved
                ? 'Vente enregistree'
                : `Enregistrer la vente - ${toCFA(getTotalAmount())}`}
          </button>
        </div>
      </form>

      <div className="mt-8 rounded-lg border p-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <h3 className="mb-3 text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Dernieres ventes</h3>
        {recentSales.length > 0 ? (
          <div className="space-y-2">
            {recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between rounded-lg p-3" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
                <div>
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>{sale.client_nom}</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {sale.offre_nom} - {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <p className="font-bold" style={{ color: 'var(--color-primary)' }}>{toCFA(sale.montant_total)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Aucune vente recente.</p>
        )}
      </div>
    </div>
  )
}
