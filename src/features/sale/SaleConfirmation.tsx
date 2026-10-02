import { useState } from 'react'
import { CheckCircle2, CloudOff, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/Toast'
import { shareOrDownloadTicket } from '@/lib/ticketShare'
import { toCFA } from '@/utils/price'
import type { SaleReceipt } from './useSubmitSale'
import type { GeneratedTicket } from './useTicketUpload'

interface SaleConfirmationProps {
  /** null = closed. */
  receipt: SaleReceipt | null
  /** The PDF of this sale, when it could be generated. */
  ticket: GeneratedTicket | null
  /** Closes the screen and empties the cart. */
  onClose: () => void
}

/**
 * Full-screen confirmation after a sale: what was sold, to whom, for how
 * much — then share the ticket (WhatsApp, SMS…) or close. Replaces the PDF
 * that used to auto-download into the phone's Downloads folder.
 */
export function SaleConfirmation({ receipt, ticket, onClose }: SaleConfirmationProps) {
  const { showToast } = useToast()
  const [isSharing, setIsSharing] = useState(false)

  const share = async () => {
    if (!ticket) return
    setIsSharing(true)
    try {
      const outcome = await shareOrDownloadTicket(ticket)
      if (outcome === 'downloaded') {
        showToast({ type: 'success', title: 'Ticket téléchargé' })
      }
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <Dialog open={receipt !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent hideClose className="flex h-[100dvh] max-w-none flex-col justify-center gap-6 rounded-none sm:h-auto sm:max-w-md sm:rounded-lg">
        {receipt && (
          <>
            <div className="flex flex-col items-center text-center">
              {receipt.queued ? (
                <CloudOff className="h-16 w-16 text-amber" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-16 w-16 text-teal" aria-hidden="true" />
              )}
              <DialogTitle className="mt-3 text-xl font-bold text-text">
                {receipt.alreadyRecorded ? 'Vente déjà enregistrée' : 'Vente enregistrée'}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-text-secondary">
                {receipt.queued
                  ? 'Gardée sur ce téléphone : elle sera envoyée au retour du réseau.'
                  : `Client : ${receipt.clientNom}`}
              </DialogDescription>
            </div>

            <div className="rounded-md border-2 border-border bg-bg p-4">
              {receipt.queued && <p className="mb-2 text-sm font-semibold text-text">Client : {receipt.clientNom}</p>}
              <ul className="space-y-2" aria-label="Offres vendues">
                {receipt.items.map((item) => (
                  <li key={item.nom} className="flex items-baseline justify-between gap-3 text-sm text-text">
                    <span>
                      {item.nom} <span className="text-text-secondary">× {item.qty}</span>
                    </span>
                    <span className="font-semibold [font-variant-numeric:tabular-nums]">{toCFA(item.sousTotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-baseline justify-between border-t-2 border-border pt-3">
                <span className="text-sm font-semibold uppercase tracking-wider text-text">Total</span>
                <span className="font-mono text-xl font-bold text-blue [font-variant-numeric:tabular-nums]">
                  {toCFA(receipt.total)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {ticket ? (
                <Button
                  type="button"
                  variant="primary" size="touch"
                  className="h-14 w-full text-base"
                  loading={isSharing}
                  loadingText="Ouverture du partage…"
                  onClick={share}
                >
                  <Share2 className="h-5 w-5" />
                  Partager le ticket
                </Button>
              ) : (
                <p className="text-center text-sm text-text-secondary">
                  {receipt.queued
                    ? 'Le ticket sera disponible après la synchronisation.'
                    : 'Ticket non disponible pour cette vente.'}
                </p>
              )}
              <Button type="button" variant="outline" size="touch" className="h-14 w-full text-base" onClick={onClose}>
                Fermer
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
