/**
 * Offline-queue flush: the queued idempotency_key MUST travel into the ventes
 * insert (anti-duplicate at sync), and a 23505 on that key counts as already
 * synced (queue entry dropped, sale kept).
 */

const mockGetAll = jest.fn()
const mockDelete = jest.fn(async () => undefined)
const mockInsertVentes = jest.fn()

jest.mock('idb', () => ({
  openDB: jest.fn(async () => ({
    getAll: mockGetAll,
    delete: mockDelete,
    transaction: () => ({ store: { index: () => ({ getAll: mockGetAll }) } }),
  })),
}))

const emptyLookupChain = () => {
  const promise = Promise.resolve({ data: [], error: null })
  const chain = {
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: null, error: null }),
    then: promise.then.bind(promise),
  }
  return chain
}

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'ventes') {
        return {
          insert: mockInsertVentes,
          select: () => Promise.resolve({ data: [{ id: 'sale-real-1' }], error: null }),
          update: () => ({ eq: async () => ({ data: null, error: null }) }),
        }
      }
      return { select: emptyLookupChain, update: () => ({ eq: async () => ({ data: null, error: null }) }) }
    },
    storage: {
      from: () => ({ upload: async () => ({ data: null, error: null }) }),
    },
  },
}))

jest.mock('@/lib/ticketGenerator', () => ({
  generateTicket: jest.fn(async () => 'data:application/pdf;base64,JVBERi0='),
}))

import { flushOfflineSales } from '../offlineSalesQueue'

const queuedSale = {
  id: 'queued-1',
  kiosque_id: 'kiosque-1',
  client_id: 'client-real-1',
  idempotency_key: '11111111-2222-3333-4444-555555555555',
  items: [{ offre_id: 'offre-1', quantite: 2, montant_total: 600 }],
  created_at: '2026-09-29T15:33:00.000Z',
  queued_at: '2026-09-29T15:33:05.000Z',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetAll.mockResolvedValue([queuedSale])
  mockInsertVentes.mockImplementation(() => ({
    select: () => Promise.resolve({ data: [{ id: 'sale-real-1' }], error: null }),
  }))
  // Node's test env lacks fetch; the sync ticket step is best-effort.
  ;(global as { fetch?: unknown }).fetch = jest.fn(
    async () => new Response(new Blob(['pdf']), { status: 200 })
  )
})

describe('flushOfflineSales — idempotence à la synchronisation', () => {
  it('insère la vente en file avec LA MÊME idempotency_key', async () => {
    const result = await flushOfflineSales({})

    expect(result.flushed).toBe(1)
    const rows = mockInsertVentes.mock.calls[0][0] as Array<{ idempotency_key: string }>
    expect(rows[0].idempotency_key).toBe('11111111-2222-3333-4444-555555555555')
  })

  it('23505 sur la clé idempotente = déjà synchronisé : entrée de file supprimée, vente conservée', async () => {
    mockInsertVentes.mockImplementation(() => ({
      select: () =>
        Promise.resolve({
          data: null,
          error: {
            code: '23505',
            message: 'duplicate key value violates unique constraint "idx_ventes_idempotency_key"',
            details: 'Key (idempotency_key)=(11111111-2222-3333-4444-555555555555) already exists.',
          },
        }),
    }))

    const result = await flushOfflineSales({})

    // Treated as SUCCESS: queue entry dropped, sale kept, nothing lost.
    expect(result.flushed).toBe(1)
    expect(result.failed).toBe(0)
    expect(mockDelete).toHaveBeenCalledWith('sales', 'queued-1')
  })

  it('supprime l’entrée de file après une sync réussie', async () => {
    const result = await flushOfflineSales({})
    expect(result.flushed).toBe(1)
    expect(mockDelete).toHaveBeenCalledWith('sales', 'queued-1')
  })
})
