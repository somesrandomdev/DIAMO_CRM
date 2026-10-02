import { useCallback, useEffect, useMemo, useState } from 'react'
import AddClientUltra from '@/pages/AddClientUltra'
import { useAuthStore } from '@/stores/authStore'
import { useVenteStore } from '@/stores/venteStore'
import { SaleCart } from './SaleCart'
import { SaleCheckout } from './SaleCheckout'
import { SaleClientPicker } from './SaleClientPicker'
import { PendingSalesBadge } from './PendingSalesBadge'
import { SaleConfirmation } from './SaleConfirmation'
import { SaleRecentList } from './SaleRecentList'
import { SaleSummary } from './SaleSummary'
import { OnboardingTip } from '@/components/OnboardingTip'
import { useOfflineQueue } from './useOfflineQueue'
import { useSaleSummary } from './useSaleSummary'
import { useRecentClients } from './useRecentClients'
import { useSubmitSale, type SaleReceipt } from './useSubmitSale'
import { useTicketUpload } from './useTicketUpload'
import { useVenteForm } from './useVenteForm'
import { setUpdateUnsafeGuard } from '@/lib/updateCoordinator'

/**
 * Thin orchestrator for the sale flow: pick a client, build the cart,
 * checkout, then handle the ticket. All state and side effects live in the
 * feature's hooks; all markup lives in its presentational components.
 */
export default function VentePage({ onBack }: { onBack: () => void }) {
  const { profile } = useAuthStore()
  const {
    clients,
    offres,
    clientsLoading,
    offresLoading,
    error: storeError,
    loadClients,
    loadOffres,
  } = useVenteStore()

  const form = useVenteForm()
  const { dailyStats, recentSales, dailyGoal, loadVenteSummary } = useSaleSummary()

  const { uploadTicket, ticket, clearTicket } = useTicketUpload()
  /** Non-null = the confirmation screen is open for this sale. */
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null)

  // Mise à jour forcée: un panier non vide = moment non sûr. La bannière
  // s'affiche, l'UpdateGate attend que le panier soit vidé (vente validée
  // ou annulée) ou que l'écran soit quitté. Jamais de perte de saisie.
  // L'écran de confirmation ouvert compte aussi : le ticket n'est pas encore
  // partagé (le panier, lui, est déjà vidé derrière).
  useEffect(() => {
    setUpdateUnsafeGuard(() => form.cartItems.length > 0 || receipt !== null)
    return () => setUpdateUnsafeGuard(null)
  }, [form.cartItems, receipt])

  const [showAddClient, setShowAddClient] = useState(false)

  const kiosqueId = profile?.kiosque_id
  const { recentClients, reload: reloadRecentClients } = useRecentClients(kiosqueId)
  // After each sale (and each offline-queue flush): stats + recent buyers.
  const reloadSummary = useCallback(() => {
    if (!kiosqueId) return
    loadVenteSummary(kiosqueId)
    void reloadRecentClients()
  }, [kiosqueId, loadVenteSummary, reloadRecentClients])

  const queue = useOfflineQueue({ onFlushed: reloadSummary })
  const { submit, loading, saleSaved, resetKey } = useSubmitSale({
    enqueueOfflineSale: queue.enqueueSale,
    uploadTicket,
    resetForm: form.resetForm,
    reloadSummary,
    onRecorded: setReceipt,
  })

  const closeConfirmation = useCallback(() => {
    setReceipt(null)
    clearTicket()
    form.resetForm()
  }, [clearTicket, form])

  const safeClients = useMemo(() => clients.filter((client) => client?.nom), [clients])
  const safeOffers = useMemo(
    () => offres.filter((offer) => offer?.offre?.nom && offer.est_actif),
    [offres]
  )
  const selectedClient = useMemo(
    () =>
      safeClients.find((client) => client.id === form.selectedClientId) ??
      // A recent-client chip may name a client outside the loaded list.
      recentClients.find((client) => client.id === form.selectedClientId) ??
      null,
    [form.selectedClientId, safeClients, recentClients]
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
            void reloadRecentClients()
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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-text">Nouvelle vente</h1>
            <PendingSalesBadge
              pendingCount={queue.pendingCount}
              isOnline={queue.isOnline}
              isSyncing={queue.isSyncingQueue}
              onSync={queue.flushQueue}
              clients={safeClients}
            />
          </div>
          <p className="text-sm text-text-secondary">Enregistrer une vente et partager le ticket.</p>
        </div>
        {/* Pas de « Retour » : cet écran EST l'accueil du fontainier (seul rôle
            autorisé) ; la barre d'onglets couvre la navigation. */}
      </div>

      <OnboardingTip role="fontainier" message="Bienvenue ! Sélectionnez un client, touchez les offres à vendre, puis validez — vous pourrez ensuite partager le ticket." />
      <SaleSummary
        todaySalesCount={dailyStats.ventes}
        todayRevenue={dailyStats.ca}
        dailyGoal={dailyGoal}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <SaleClientPicker
          clients={safeClients}
          isLoading={clientsLoading}
          selectedClient={selectedClient}
          onSelect={(client) => form.setSelectedClientId(client.id)}
          onClear={() => form.setSelectedClientId('')}
          onAddNew={() => setShowAddClient(true)}
          resetKey={resetKey}
          recentClients={recentClients}
        />

        <SaleCart
          offres={safeOffers}
          isLoading={offresLoading}
          loadError={offresLoading ? null : storeError}
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

      <SaleConfirmation receipt={receipt} ticket={ticket} onClose={closeConfirmation} />
    </div>
  )
}
