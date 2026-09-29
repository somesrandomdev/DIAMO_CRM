import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toCFA } from '@/utils/price'

interface SaleCheckoutProps {
  total: number
  isSubmitting: boolean
  isSuccess: boolean
  canSubmit: boolean
  clientSelected: boolean
  itemCount: number
}

/**
 * Sticky bottom checkout bar. The button is type="submit" so pressing Enter
 * in any form field submits the sale, exactly like the original page.
 */
export function SaleCheckout({
  total,
  isSubmitting,
  isSuccess,
  canSubmit,
  clientSelected,
  itemCount,
}: SaleCheckoutProps) {
  return (
    <div className="sticky bottom-3 z-10 rounded-lg border-2 border-[#DCE1E5] bg-white p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#1C5376]">
        {clientSelected ? 'Client selectionne' : 'Client requis'} -{' '}
        {itemCount > 0 ? `${itemCount} article(s)` : 'Panier vide'}
      </p>
      <Button
        type="submit"
        variant="pos-primary"
        className="h-14 w-full text-base"
        // isSubmitting keeps the button disabled from the FIRST click (the
        // hook also guards synchronously against double-submits).
        disabled={isSubmitting || !canSubmit}
      >
        {isSubmitting ? (
          <>
            <span
              className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white"
              aria-hidden="true"
            />
            Enregistrement en cours…
          </>
        ) : isSuccess ? (
          <>
            <Check className="h-5 w-5" />
            Vente enregistree
          </>
        ) : (
          `Enregistrer - ${toCFA(total)}`
        )}
      </Button>
    </div>
  )
}
