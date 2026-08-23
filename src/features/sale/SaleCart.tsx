import { Minus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { PosCard, PosLabel } from '@/components/pos'
import type { OfferRow } from '@/stores/venteStore'
import { toCFA } from '@/utils/price'
import type { CartItem } from './useVenteForm'

interface SaleCartProps {
  offres: OfferRow[]
  isLoading: boolean
  cartItems: CartItem[]
  onAddItem: (offer: OfferRow) => void
  onRemoveItem: (offreId: string) => void
  onQuantityChange: (offreId: string, qty: number) => void
  total: number
}

/** Offer grid (tap a card to add) + per-item quantity controls + running total. */
export function SaleCart({
  offres,
  isLoading,
  cartItems,
  onAddItem,
  onRemoveItem,
  onQuantityChange,
  total,
}: SaleCartProps) {
  const inCart = (offreId: string) => cartItems.some((item) => item.offreId === offreId)

  return (
    <PosCard className="space-y-3">
      <PosLabel>Panier de vente</PosLabel>

      {isLoading ? (
        <div className="space-y-2" aria-live="polite">
          <Skeleton className="h-12 w-full" />
          <p className="text-xs text-zinc-500">Chargement des offres disponibles...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {offres.map((offer) => (
            <button
              key={offer.offre_id}
              type="button"
              onClick={() => onAddItem(offer)}
              aria-label={`Ajouter ${offer.offre.nom}`}
              className={
                inCart(offer.offre_id)
                  ? 'flex min-h-12 flex-col items-start justify-center rounded-md border-2 border-emerald-600 bg-emerald-50 px-3 py-2 text-left transition-colors active:scale-[0.98]'
                  : 'flex min-h-12 flex-col items-start justify-center rounded-md border-2 border-zinc-300 bg-white px-3 py-2 text-left transition-colors hover:border-zinc-900 active:scale-[0.98]'
              }
            >
              <span className="text-sm font-semibold text-zinc-900">{offer.offre.nom}</span>
              <span className="text-xs font-semibold text-zinc-600 [font-variant-numeric:tabular-nums]">
                {toCFA(offer.prix)}
              </span>
            </button>
          ))}
        </div>
      )}

      {cartItems.length > 0 ? (
        <div className="space-y-2">
          {cartItems.map((item) => (
            <div key={item.offreId} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{item.offre.nom}</p>
                  <p className="text-xs text-zinc-500 [font-variant-numeric:tabular-nums]">
                    {toCFA(item.prix)} x {item.qty} = {toCFA(item.prix * item.qty)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="pos-secondary"
                    size="icon"
                    className="h-12 w-12 min-h-12"
                    aria-label={`Retirer une unite de ${item.offre.nom}`}
                    disabled={item.qty <= 1}
                    onClick={() => onQuantityChange(item.offreId, item.qty - 1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span
                    aria-live="polite"
                    className="w-10 text-center text-base font-bold text-zinc-900 [font-variant-numeric:tabular-nums]"
                  >
                    {item.qty}
                  </span>
                  <Button
                    type="button"
                    variant="pos-secondary"
                    size="icon"
                    className="h-12 w-12 min-h-12"
                    aria-label={`Ajouter une unite de ${item.offre.nom}`}
                    onClick={() => onQuantityChange(item.offreId, item.qty + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="pos-destructive"
                    size="icon"
                    className="h-12 w-12 min-h-12"
                    aria-label={`Supprimer ${item.offre.nom} du panier`}
                    onClick={() => onRemoveItem(item.offreId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between border-t-2 border-zinc-200 pt-3">
            <PosLabel>Total</PosLabel>
            <span className="font-mono text-xl font-bold text-emerald-700 [font-variant-numeric:tabular-nums]">
              {toCFA(total)}
            </span>
          </div>
        </div>
      ) : (
        <EmptyState
          title="Panier vide"
          description="Ajoutez au moins une offre pour enregistrer la vente."
          className="border-0 bg-zinc-50 p-4"
        />
      )}
    </PosCard>
  )
}
