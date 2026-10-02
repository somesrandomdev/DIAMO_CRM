import { act, renderHook } from '@testing-library/react'

/**
 * Form reset after a recorded sale must never wipe the NEXT sale the
 * fontainier has already started (closed the confirmation, picked a client,
 * added items). Previously a deferred timer called resetForm() ~1.2 s later.
 */

const mockShowToast = jest.fn()
jest.mock('@/components/Toast', () => ({ useToast: () => ({ showToast: mockShowToast }) }))
jest.mock('@/lib/ticketGenerator', () => ({ generateTicket: jest.fn() }))
jest.mock('@/lib/supabase', () => {
  let n = 0
  return {
    supabase: {
      from: () => ({
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: `sale-${++n}` }, error: null }) }) }),
      }),
    },
  }
})

import { useSubmitSale } from '../useSubmitSale'

const context = {
  kiosqueId: 'k1',
  kiosqueNom: 'Kiosque',
  clientId: 'c1',
  cartItems: [{ offreId: 'o1', qty: 1, prix: 300, offre: { id: 'o1', nom: 'Bidon 10L' } }],
  total: 300,
  ticketClient: { nom: 'Fatou' },
  isOnline: true,
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function setup() {
  const events: string[] = []
  const hook = renderHook(() =>
    useSubmitSale({
      enqueueOfflineSale: jest.fn(async () => undefined),
      uploadTicket: jest.fn(async () => true),
      resetForm: () => events.push('reset'),
      reloadSummary: () => events.push('reload'),
      onRecorded: () => events.push('recorded'),
      timings: { verifyDelayMs: 1, retry1Ms: 1, retry2Ms: 1, resetDelayMs: 40 },
    })
  )
  return { ...hook, events }
}

describe('useSubmitSale — remise à zéro après la vente', () => {
  it('le formulaire est remis à zéro AVANT que le fontainier commence la vente suivante, jamais après', async () => {
    const { result, events } = setup()
    await act(async () => {
      await result.current.submit({ ...context })
    })
    // Le fontainier ferme la confirmation et commence la vente suivante.
    events.push('user-starts-next-sale')
    await act(async () => {
      await wait(900) // au-delà de resetDelayMs + 800 (succès en ligne)
    })
    const userAt = events.indexOf('user-starts-next-sale')
    expect(events.slice(userAt + 1)).not.toContain('reset')
    expect(events.slice(0, userAt)).toContain('reset')
  })

  it('le bouton repasse de « Vente enregistrée » à l’état normal après le délai', async () => {
    const { result } = setup()
    await act(async () => {
      await result.current.submit({ ...context })
    })
    expect(result.current.saleSaved).toBe(true)
    await act(async () => {
      await wait(900)
    })
    expect(result.current.saleSaved).toBe(false)
  })

  it('démontage pendant le délai : aucun effet après coup', async () => {
    const { result, events, unmount } = setup()
    await act(async () => {
      await result.current.submit({ ...context })
    })
    const before = events.length
    unmount()
    await wait(900)
    expect(events).toHaveLength(before)
  })

  it('deux ventes rapprochées : la 2e n’est pas effacée par le minuteur de la 1re', async () => {
    const { result, events } = setup()
    await act(async () => {
      await result.current.submit({ ...context })
    })
    await act(async () => {
      await result.current.submit({ ...context, clientId: 'c2' })
    })
    events.push('user-starts-third-sale')
    await act(async () => {
      await wait(900)
    })
    const userAt = events.indexOf('user-starts-third-sale')
    expect(events.slice(userAt + 1)).not.toContain('reset')
  })
})
