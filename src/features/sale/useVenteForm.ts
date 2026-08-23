import { useCallback, useMemo, useState } from 'react'
import type { OfferRow } from '@/stores/venteStore'

export interface CartItem {
  offreId: string
  qty: number
  offre: OfferRow['offre']
  prix: number
}

/**
 * Local state for the sale screen: selected client and cart. Pure state
 * management — no fetching, no side effects.
 */
export function useVenteForm() {
  const [selectedClientId, setSelectedClientId] = useState('')
  const [cartItems, setCartItems] = useState<CartItem[]>([])

  const total = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.prix * item.qty, 0),
    [cartItems]
  )

  const addItem = useCallback((offer: OfferRow, qty: number = 1) => {
    setCartItems((current) => {
      const existing = current.find((item) => item.offreId === offer.offre_id)
      if (existing) {
        return current.map((item) =>
          item.offreId === offer.offre_id ? { ...item, qty: item.qty + qty } : item
        )
      }
      return [...current, { offreId: offer.offre_id, qty, offre: offer.offre, prix: offer.prix }]
    })
  }, [])

  const removeItem = useCallback((offreId: string) => {
    setCartItems((current) => current.filter((item) => item.offreId !== offreId))
  }, [])

  const updateQuantity = useCallback((offreId: string, qty: number) => {
    if (qty <= 0) {
      setCartItems((current) => current.filter((item) => item.offreId !== offreId))
      return
    }
    setCartItems((current) =>
      current.map((item) => (item.offreId === offreId ? { ...item, qty } : item))
    )
  }, [])

  const resetForm = useCallback(() => {
    setSelectedClientId('')
    setCartItems([])
  }, [])

  return {
    selectedClientId,
    setSelectedClientId,
    cartItems,
    addItem,
    removeItem,
    updateQuantity,
    total,
    resetForm,
  }
}
