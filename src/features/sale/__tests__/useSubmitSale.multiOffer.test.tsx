import { act, renderHook } from '@testing-library/react'

/**
 * Multi-offer carts against a fake ventes table enforcing the production
 * index UNIQUE (idempotency_key, offre_id). The previous index (key alone)
 * rejected the 2nd line of a cart and the client reported "déjà enregistrée"
 * with only the 1st offer saved.
 */

type Row = { id: string; idempotency_key: string; offre_id: string; montant_total: number; lien_ticket: string | null }

const mockTable: Row[] = []
const mockShowToast = jest.fn()
const mockUploadTicket = jest.fn(async () => true)
const mockEnqueue = jest.fn(async () => undefined)
/** Inserts to fail with a network error: 'before' = never reached the DB, 'after' = row written, response lost. */
const mockNetworkFailures: Array<'before' | 'after' | null> = []

jest.mock('@/components/Toast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: (row: Omit<Row, 'id' | 'lien_ticket'>) => ({
        select: () => ({
          single: async () => {
            const failure = mockNetworkFailures.shift()
            if (failure === 'before') throw new TypeError('Failed to fetch')
            if (mockTable.some((r) => r.idempotency_key === row.idempotency_key && r.offre_id === row.offre_id)) {
              return {
                data: null,
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint "idx_ventes_idempotency_key_offre"',
                  details: `Key (idempotency_key, offre_id)=(${row.idempotency_key}, ${row.offre_id}) already exists.`,
                },
              }
            }
            const id = `sale-${mockTable.length + 1}`
            mockTable.push({ ...row, id, lien_ticket: null })
            if (failure === 'after') throw new TypeError('Failed to fetch')
            return { data: { id }, error: null }
          },
        }),
      }),
      select: () => ({
        eq: (_column: string, key: string) => {
          const rows = mockTable
            .filter((r) => r.idempotency_key === key)
            .map(({ id, offre_id, lien_ticket }) => ({ id, offre_id, lien_ticket }))
          const result = Promise.resolve({ data: rows, error: null })
          // PostgREST semantics: maybeSingle() errors on more than one row.
          return Object.assign(result, {
            maybeSingle: async () =>
              rows.length > 1
                ? { data: null, error: { code: 'PGRST116', message: 'multiple rows' } }
                : { data: rows[0] ?? null, error: null },
          })
        },
      }),
    }),
  },
}))

jest.mock('@/lib/ticketGenerator', () => ({ generateTicket: jest.fn() }))

import { useSubmitSale } from '../useSubmitSale'

const cart = [
  { offreId: 'offre-10L', qty: 2, prix: 300, offre: { id: 'offre-10L', nom: 'Bidon 10L' } },
  { offreId: 'offre-20L', qty: 1, prix: 500, offre: { id: 'offre-20L', nom: 'Bidon 20L' } },
]

const context = {
  kiosqueId: 'kiosque-1',
  kiosqueNom: 'Kiosque test',
  clientId: 'client-1',
  cartItems: cart,
  total: 1100,
  ticketClient: { nom: 'Client Test' },
  isOnline: true,
}

function setupHook() {
  return renderHook(() =>
    useSubmitSale({
      enqueueOfflineSale: mockEnqueue,
      uploadTicket: mockUploadTicket,
      resetForm: jest.fn(),
      reloadSummary: jest.fn(),
      timings: { verifyDelayMs: 1, retry1Ms: 1, retry2Ms: 1, resetDelayMs: 1 },
    })
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockTable.length = 0
  mockNetworkFailures.length = 0
})

describe('useSubmitSale — panier multi-offres (index composite)', () => {
  it('enregistre les 2 offres du panier sous la même clé, un seul ticket', async () => {
    const { result } = setupHook()
    await act(async () => {
      await result.current.submit({ ...context })
    })

    expect(mockTable.map((r) => [r.offre_id, r.montant_total])).toEqual([
      ['offre-10L', 600],
      ['offre-20L', 500],
    ])
    expect(new Set(mockTable.map((r) => r.idempotency_key)).size).toBe(1)
    expect(mockUploadTicket).toHaveBeenCalledTimes(1)
    expect(mockUploadTicket).toHaveBeenCalledWith(expect.objectContaining({ saleId: 'sale-1', montantTotal: 1100 }))
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success', title: 'Vente enregistrée' }))
  })

  it('panier partiel (2e ligne perdue en vol) : le retry réutilise la 1re ligne et insère la 2e, sans doublon', async () => {
    // Ligne 1 OK ; ligne 2 : réseau coupé AVANT la base.
    mockNetworkFailures.push(null, 'before')

    const { result } = setupHook()
    await act(async () => {
      await result.current.submit({ ...context })
    })

    expect(mockTable.map((r) => r.offre_id)).toEqual(['offre-10L', 'offre-20L'])
    expect(mockEnqueue).not.toHaveBeenCalled()
    expect(mockUploadTicket).toHaveBeenCalledWith(expect.objectContaining({ saleId: 'sale-1' }))
    expect(mockShowToast).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'success', title: 'Vente enregistrée' })
    )
  })

  it('réponse perdue après écriture : la vérification trouve TOUTES les offres → succès sans retry', async () => {
    // Ligne 1 OK ; ligne 2 écrite mais réponse perdue.
    mockNetworkFailures.push(null, 'after')

    const { result } = setupHook()
    await act(async () => {
      await result.current.submit({ ...context })
    })

    expect(mockTable).toHaveLength(2)
    expect(mockUploadTicket).toHaveBeenCalledWith(expect.objectContaining({ saleId: 'sale-1' }))
  })

  it("retry de la MÊME offre rejeté par l'index : panier entièrement déjà présent → « déjà enregistrée », aucun doublon", async () => {
    mockTable.push(
      { id: 'sale-1', idempotency_key: 'k', offre_id: 'offre-10L', montant_total: 600, lien_ticket: 'kiosque-1/ticket-sale-1.pdf' },
      { id: 'sale-2', idempotency_key: 'k', offre_id: 'offre-20L', montant_total: 500, lien_ticket: null }
    )
    const { result } = setupHook()
    // Force la même clé que les lignes existantes (double soumission).
    const randomUUID = jest.spyOn(crypto, 'randomUUID').mockReturnValue('k' as `${string}-${string}-${string}-${string}-${string}`)
    await act(async () => {
      await result.current.submit({ ...context })
    })
    randomUUID.mockRestore()

    expect(mockTable).toHaveLength(2)
    expect(mockUploadTicket).not.toHaveBeenCalled()
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', title: 'Vente déjà enregistrée' })
    )
  })
})
