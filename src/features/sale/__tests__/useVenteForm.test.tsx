import { act, renderHook } from '@testing-library/react'
import type { OfferRow } from '@/stores/venteStore'
import { useVenteForm } from '../useVenteForm'

const offer = (id: string, prix: number): OfferRow => ({
  offre_id: id,
  prix,
  est_actif: true,
  offre: { id, nom: `Offre ${id}` },
})

describe('useVenteForm', () => {
  it('computes the total as the sum of price x quantity', () => {
    const { result } = renderHook(() => useVenteForm())

    act(() => {
      result.current.addItem(offer('a', 500), 2)
      result.current.addItem(offer('b', 1500), 1)
    })

    expect(result.current.total).toBe(2500)
  })

  it('merges quantities when the same offer is added twice', () => {
    const { result } = renderHook(() => useVenteForm())

    act(() => {
      result.current.addItem(offer('a', 300), 1)
      result.current.addItem(offer('a', 300), 2)
    })

    expect(result.current.cartItems).toHaveLength(1)
    expect(result.current.cartItems[0].qty).toBe(3)
    expect(result.current.total).toBe(900)
  })

  it('updateQuantity removes the item when quantity reaches zero', () => {
    const { result } = renderHook(() => useVenteForm())

    act(() => result.current.addItem(offer('a', 300), 1))
    act(() => result.current.updateQuantity('a', 0))

    expect(result.current.cartItems).toHaveLength(0)
    expect(result.current.total).toBe(0)
  })

  it('resetForm clears the selected client and the cart', () => {
    const { result } = renderHook(() => useVenteForm())

    act(() => {
      result.current.setSelectedClientId('client-1')
      result.current.addItem(offer('a', 500), 2)
    })
    act(() => result.current.resetForm())

    expect(result.current.selectedClientId).toBe('')
    expect(result.current.cartItems).toHaveLength(0)
    expect(result.current.total).toBe(0)
  })
})
