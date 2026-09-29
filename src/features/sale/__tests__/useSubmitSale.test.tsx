import { act, renderHook } from '@testing-library/react'
import type { QueuedSale } from '@/utils/offlineSalesQueue'

/**
 * Contract tests for the hardened submit flow: idempotency key reuse,
 * duplicate-23505 treated as success, verify-by-key after retryable failures,
 * and offline queue fallback carrying the SAME key.
 */

const mockShowToast = jest.fn()
const mockInsertSingle: jest.Mock = jest.fn()
const mockVerifyMaybeSingle = jest.fn()
const mockEnqueue: jest.Mock = jest.fn(async () => undefined)
const mockUploadTicket = jest.fn(async () => true)
const mockResetForm = jest.fn()
const mockReloadSummary = jest.fn()

jest.mock('@/components/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

const mockInsertPayloads: Array<Record<string, unknown>> = []

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'ventes') {
        return {
          insert: (payload: Record<string, unknown>) => {
            mockInsertPayloads.push(payload)
            return {
              select: () => ({
                single: () => mockInsertSingle(),
              }),
            }
          },
          select: () => ({
            eq: () => ({
              maybeSingle: () => mockVerifyMaybeSingle(),
            }),
          }),
        }
      }
      throw new Error(`unexpected table in test: ${table}`)
    },
  },
}))

// Ticket generation pulls jsPDF + base64 logo — irrelevant here.
jest.mock('@/lib/ticketGenerator', () => ({
  generateTicket: jest.fn(),
  ticketPath: jest.fn((kiosqueId: string, saleId: string) => `${kiosqueId}/ticket-${saleId}.pdf`),
}))

import { useSubmitSale } from '../useSubmitSale'

const baseContext = {
  kiosqueId: 'kiosque-1',
  kiosqueNom: 'Kiosque test',
  clientId: 'client-1',
  cartItems: [
    { offreId: 'offre-1', qty: 2, offre: { id: 'offre-1', nom: 'Offre Ganale' }, prix: 300 },
  ],
  total: 600,
  ticketClient: { nom: 'Client Test' },
  isOnline: true,
}

const injectTimings = { verifyDelayMs: 5, retry1Ms: 5, retry2Ms: 5, resetDelayMs: 5 }

function setupHook() {
  return renderHook(() =>
    useSubmitSale({
      enqueueOfflineSale: mockEnqueue,
      uploadTicket: mockUploadTicket,
      resetForm: mockResetForm,
      reloadSummary: mockReloadSummary,
      timings: injectTimings,
    })
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockInsertPayloads.length = 0
  mockEnqueue.mockImplementation(async () => undefined)
  mockUploadTicket.mockImplementation(async () => true)
})

describe('useSubmitSale — correctifs production', () => {
  it('double-clic: la garde synchrone ne soumet qu’une seule vente', async () => {
    let release!: (value: { data: { id: string }; error: null }) => void
    mockInsertSingle.mockImplementation(
      () => new Promise((resolve) => { release = resolve })
    )

    const { result } = setupHook()

    await act(async () => {
      const first = result.current.submit({ ...baseContext })
      const second = result.current.submit({ ...baseContext })
      release({ data: { id: 'sale-1' }, error: null })
      await Promise.all([first, second])
      await Promise.resolve()
    })

    expect(mockInsertSingle).toHaveBeenCalledTimes(1) // one sale, never two
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', title: 'Vente enregistrée' })
    )
    // Success-path reset is scheduled at resetDelayMs + 800.
    await act(async () => { await new Promise((r) => setTimeout(r, 900)) })
    expect(mockResetForm).toHaveBeenCalledTimes(1)
  })

  it('23505 sur idx_ventes_idempotency_key = succès (aucune duplication, pas de file)', async () => {
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "idx_ventes_idempotency_key"',
        details: 'Key (idempotency_key)=(abc) already exists.',
      },
    })

    const { result } = setupHook()
    await act(async () => {
      await result.current.submit({ ...baseContext })
    })

    expect(mockInsertSingle).toHaveBeenCalledTimes(1)
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Vente déjà enregistrée',
      })
    )
    expect(mockEnqueue).not.toHaveBeenCalled()
    await act(async () => { await new Promise((r) => setTimeout(r, 120)) })
    expect(mockResetForm).toHaveBeenCalledTimes(1)
  })

  it('échec retryable puis SELECT positif → succès sans doublon (ticket sur le sale_id réel)', async () => {
    mockInsertSingle
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // 1ère tentative perte de réseau
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // retry 1
      .mockResolvedValue({ data: { id: 'sale-2' }, error: null }) // retry 2 OK
    mockVerifyMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null }) // pas encore en base
      .mockResolvedValueOnce({ data: null, error: null }) // pas encore en base

    const { result } = setupHook()
    await act(async () => {
      await result.current.submit({ ...baseContext })
    })

    // 3 tentatives, TOUTES avec la même clé idempotente
    expect(mockInsertSingle).toHaveBeenCalledTimes(3)
    const payloads = mockInsertPayloads as Array<{ idempotency_key: string }>
    expect(new Set(payloads.map((p) => p.idempotency_key)).size).toBe(1)

    // Succès final, pas de file, ticket uploadé sur le sale_id réel
    expect(mockEnqueue).not.toHaveBeenCalled()
    expect(mockUploadTicket).toHaveBeenCalledWith(expect.objectContaining({ saleId: 'sale-2' }))
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', title: 'Vente enregistrée' })
    )
  })

  it('échec retryable épuisé → file hors-ligne avec la MÊME clé, pas de toast d’erreur', async () => {
    mockInsertSingle.mockRejectedValue(new TypeError('Failed to fetch'))
    mockVerifyMaybeSingle.mockResolvedValue({ data: null, error: null }) // jamais en base

    const { result } = setupHook()
    await act(async () => {
      await result.current.submit({ ...baseContext })
    })

    expect(mockInsertSingle).toHaveBeenCalledTimes(3) // tentative + 2 retries, même clé
    const payloads = mockInsertPayloads as Array<{ idempotency_key: string }>
    expect(new Set(payloads.map((p) => p.idempotency_key)).size).toBe(1)

    expect(mockEnqueue).toHaveBeenCalledTimes(1)
    const queued = (mockEnqueue.mock.calls[0]?.[0] ?? {}) as unknown as QueuedSale
    expect(queued.idempotency_key).toBe(payloads[0].idempotency_key)

    // Toast SUCCÈS (jamais l'erreur générique)
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'success',
        title: 'Vente enregistrée',
        message: 'Vente enregistrée — synchronisation automatique au retour du réseau',
      })
    )
    await act(async () => { await new Promise((r) => setTimeout(r, 120)) })
    expect(mockResetForm).toHaveBeenCalledTimes(1)
  })

  it('échec NON retryable (RLS) → toast explicite, pas de retry, pas de file', async () => {
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'new row violates row-level security policy' },
    })

    const { result } = setupHook()
    await act(async () => {
      await result.current.submit({ ...baseContext })
    })

    expect(mockInsertSingle).toHaveBeenCalledTimes(1)
    expect(mockEnqueue).not.toHaveBeenCalled()
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: expect.stringContaining('Permission refusée'),
      })
    )
  })
})
