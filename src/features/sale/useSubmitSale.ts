import { useCallback, useState } from 'react'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import type { QueuedSale } from '@/utils/offlineSalesQueue'
import type { TicketUploadInput } from './useTicketUpload'
import type { CartItem } from './useVenteForm'

export interface SubmitSaleContext {
  kiosqueId: string
  kiosqueNom: string
  clientId: string
  cartItems: CartItem[]
  total: number
  /** Client label for the ticket (falls back to "Client"). */
  ticketClient: { nom: string; telephone?: string }
  isOnline: boolean
}

interface UseSubmitSaleOptions {
  enqueueOfflineSale: (sale: Omit<QueuedSale, 'id' | 'queued_at'>) => Promise<void>
  uploadTicket: (input: TicketUploadInput) => Promise<boolean>
  resetForm: () => void
  reloadSummary: () => void
}

/**
 * The sale submission flow. Offline: enqueue to IndexedDB and reset after
 * 1.2s. Online: insert one ventes row per cart item, then hand off to the
 * ticket upload; on success reset after 2s and reload only the summary
 * (re-fetching clients/offres would blank the pickers for no benefit).
 */
export function useSubmitSale({
  enqueueOfflineSale,
  uploadTicket,
  resetForm,
  reloadSummary,
}: UseSubmitSaleOptions) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saleSaved, setSaleSaved] = useState(false)
  /** Bumped after each completed sale so the client picker clears its field. */
  const [resetKey, setResetKey] = useState(0)

  const submit = useCallback(
    async (context: SubmitSaleContext) => {
      const { kiosqueId, clientId, cartItems } = context
      if (!kiosqueId || !clientId || cartItems.length === 0) return

      if (!context.isOnline) {
        await enqueueOfflineSale({
          kiosque_id: kiosqueId,
          client_id: clientId,
          created_at: new Date().toISOString(),
          items: cartItems.map((item) => ({
            offre_id: item.offreId,
            quantite: item.qty,
            montant_total: item.prix * item.qty,
          })),
        })

        setSaleSaved(true)
        showToast({
          type: 'success',
          title: 'Vente mise en file',
          message: 'Mode hors ligne: la vente sera synchronisee a la reconnexion.',
        })
        window.setTimeout(() => {
          resetForm()
          setResetKey((key) => key + 1)
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
              kiosque_id: kiosqueId,
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

        const ticketOk = await uploadTicket({
          saleId: sales[0].id,
          kiosqueId,
          kiosqueNom: context.kiosqueNom,
          client: context.ticketClient,
          offres: cartItems.map((item) => ({
            ...item.offre,
            prix: item.prix,
            quantite: item.qty,
            sous_total: item.prix * item.qty,
          })),
          montantTotal: context.total,
        })
        if (!ticketOk) {
          setLoading(false)
          return
        }

        setLoading(false)
        setSaleSaved(true)
        showToast({
          type: 'success',
          title: 'Vente enregistree',
          message: `${cartItems.length} offre(s) - ticket telecharge.`,
        })
        window.setTimeout(() => {
          resetForm()
          setResetKey((key) => key + 1)
          setSaleSaved(false)
          reloadSummary()
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
    },
    [enqueueOfflineSale, reloadSummary, resetForm, showToast, uploadTicket]
  )

  return { submit, loading, saleSaved, resetKey }
}
