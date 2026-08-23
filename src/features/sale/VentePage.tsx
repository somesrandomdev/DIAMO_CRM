import { useCallback, useEffect, useMemo, useState } from 'react'
import AddClientUltra from '@/pages/AddClientUltra'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'
import { useVenteStore } from '@/stores/venteStore'
import { SaleCart } from './SaleCart'
import { SaleCheckout } from './SaleCheckout'
import { SaleClientPicker } from './SaleClientPicker'
import { SaleRecentList } from './SaleRecentList'
import { SaleStatusBanners } from './SaleStatusBanners'
import { SaleSummary } from './SaleSummary'
import { useOfflineQueue } from './useOfflineQueue'
import { useSaleSummary } from './useSaleSummary'
import { useSubmitSale } from './useSubmitSale'
import { useTicketUpload } from './useTicketUpload'
import { useVenteForm } from './useVenteForm'

/**
 * Thin orchestrator for the sale flow: pick a client, build the cart,
 * checkout, then handle the ticket. All state and side effects live in the
 * feature's hooks; all markup lives in its presentational components.
 */
export default function VentePage({ onBack }: { onBack: () => void }) {
  const { profile } = useAuthStore()
  const { clients, offres, clientsLoading, offresLoading, loadClients, loadOffres } =
    useVenteStore()

  const form = useVenteForm()
  const { dailyStats, recentSales, loadVenteSummary } = useSaleSummary()
  const { uploadTicket } = useTicketUpload()

  const [showAddClient, setShowAddClient] = useState(false)

  const kiosqueId = profile?.kiosque_id
  const reloadSummary = useCallback(() => {
    if (kiosqueId) loadVenteSummary(kiosqueId)
  }, [kiosqueId, loadVenteSummary])

  const queue = useOfflineQueue({ onFlushed: reloadSummary })
  const { submit, loading, saleSaved, resetKey } = useSubmitSale({
    enqueueOfflineSale: queue.enqueueSale,
    uploadTicket,
    resetForm: form.resetForm,
    reloadSummary,
  })

  const safeClients = useMemo(() => clients.filter((client) => client?.nom), [clients])
  const safeOffers = useMemo(
    () => offres.filter((offer) => offer?.offre?.nom && offer.est_actif),
    [offres]
  )
  const selectedClient = useMemo(
    () => safeClients.find((client) => client.id === form.selectedClientId) ?? null,
    [form.selectedClientId, safeClients]
  )

  useEffect(() => {
    if (!kiosqueId) {
      onBack()
      return
    }
    loadClients(kiosqueId)
    loadOffres(kiosqueId)
    loadVenteSummary(kiosqueId)
  }, [kiosqueId, loadClients, loadOffres, loadVenteSummary, onBack])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!kiosqueId) return
    void submit({
      kiosqueId,
      kiosqueNom: profile?.kiosques?.nom || String(kiosqueId),
      clientId: form.selectedClientId,
      cartItems: form.cartItems,
      total: form.total,
      ticketClient: selectedClient ?? { nom: 'Client' },
      isOnline: queue.isOnline,
    })
  }

  if (showAddClient) {
    return (
      <AddClientUltra
        onDone={(newId: string) => {
          form.setSelectedClientId(newId)
          setShowAddClient(false)
          if (kiosqueId) {
            loadClients(kiosqueId)
          }
        }}
      />
    )
  }

  const canSubmit = Boolean(
    form.selectedClientId && form.cartItems.length > 0 && !loading && !saleSaved
  )

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#12364D]">Nouvelle vente</h1>
          <p className="text-sm text-[#1C5376]">Enregistrer une vente et generer le ticket.</p>
        </div>
        <Button type="button" variant="pos-secondary" onClick={onBack}>Retour</Button>
      </div>

      <SaleStatusBanners
        isOnline={queue.isOnline}
        pendingCount={queue.pendingCount}
        isSyncingQueue={queue.isSyncingQueue}
        onSync={queue.flushQueue}
      />

      <SaleSummary todaySalesCount={dailyStats.ventes} todayRevenue={dailyStats.ca} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <SaleClientPicker
          clients={safeClients}
          isLoading={clientsLoading}
          selectedClient={selectedClient}
          onSelect={(client) => form.setSelectedClientId(client.id)}
          onClear={() => form.setSelectedClientId('')}
          onAddNew={() => setShowAddClient(true)}
          resetKey={resetKey}
        />

        <SaleCart
          offres={safeOffers}
          isLoading={offresLoading}
          cartItems={form.cartItems}
          onAddItem={(offer) => form.addItem(offer, 1)}
          onRemoveItem={form.removeItem}
          onQuantityChange={form.updateQuantity}
          total={form.total}
        />

        <SaleCheckout
          total={form.total}
          isSubmitting={loading}
          isSuccess={saleSaved}
          canSubmit={canSubmit}
          clientSelected={form.selectedClientId !== ''}
          itemCount={form.cartItems.length}
        />
      </form>

      <SaleRecentList sales={recentSales} />
    </div>
  )
}
