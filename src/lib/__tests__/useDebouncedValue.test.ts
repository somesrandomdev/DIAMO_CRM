import { renderHook, act } from '@testing-library/react'
import { useDebouncedValue } from '../useDebouncedValue'

describe('useDebouncedValue', () => {
  it('ne met à jour la valeur débounce qu’après le délai', async () => {
    jest.useFakeTimers()
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    })
    expect(result.current).toBe('a')

    rerender({ value: 'ab' })
    // Avant 300ms: l'ancienne valeur reste (pas de requête prématurée)
    act(() => {
      jest.advanceTimersByTime(299)
    })
    expect(result.current).toBe('a')

    // Après 300ms: la valeur débounce suit
    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current).toBe('ab')

    jest.useRealTimers()
  })

  it('une frappe rapide ne produit qu’une seule valeur finale', async () => {
    jest.useFakeTimers()
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: '' },
    })

    for (const char of 'keur'.split('')) {
      rerender({ value: char })
      act(() => {
        jest.advanceTimersByTime(100)
      })
    }
    act(() => {
      jest.advanceTimersByTime(300)
    })
    expect(result.current).toBe('r')

    jest.useRealTimers()
  })
})
