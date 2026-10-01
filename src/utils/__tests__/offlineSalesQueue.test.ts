/**
 * Offline-queue flush: the queued idempotency_key MUST travel into the ventes
 * insert (anti-duplicate at sync), and a 23505 on that key counts as already
 * synced (queue entry dropped, sale kept).
 */

const mockGetAll = jest.fn()
const mockDelete = jest.fn(async () => undefined)
const mockInsertVentes = jest.fn()
const mockLookupVentes = jest.fn()

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
          select: () => ({ eq: mockLookupVentes }),
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
  mockLookupVentes.mockResolvedValue({ data: [{ offre_id: 'offre-1' }], error: null })
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
            details: 'Key (idempotency_key, offre_id)=(11111111-2222-3333-4444-555555555555, offre-1) already exists.',
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
  it('panier partiellement présent (23505) : insère SEULEMENT l’offre manquante puis dépile', async () => {
    mockGetAll.mockResolvedValue([
      {
        ...queuedSale,
        items: [
          { offre_id: 'offre-1', quantite: 2, montant_total: 600 },
          { offre_id: 'offre-2', quantite: 1, montant_total: 500 },
        ],
      },
    ])
    const duplicate = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "idx_ventes_idempotency_key_offre"',
    }
    mockInsertVentes
      .mockImplementationOnce(() => ({ select: () => Promise.resolve({ data: null, error: duplicate }) }))
      .mockImplementationOnce(() => Promise.resolve({ data: null, error: null }))
    mockLookupVentes.mockResolvedValue({ data: [{ offre_id: 'offre-1' }], error: null })

    const result = await flushOfflineSales({})

    const missingInsert = mockInsertVentes.mock.calls[1][0] as Array<{ offre_id: string; idempotency_key: string }>
    expect(missingInsert.map((row) => row.offre_id)).toEqual(['offre-2'])
    expect(missingInsert[0].idempotency_key).toBe(queuedSale.idempotency_key)
    expect(result).toEqual({ flushed: 1, failed: 0 })
    expect(mockDelete).toHaveBeenCalledWith('sales', 'queued-1')
  })

  it('offre manquante non insérable : l’entrée RESTE en file (jamais de perte)', async () => {
    mockGetAll.mockResolvedValue([
      {
        ...queuedSale,
        items: [
          { offre_id: 'offre-1', quantite: 2, montant_total: 600 },
          { offre_id: 'offre-2', quantite: 1, montant_total: 500 },
        ],
      },
    ])
    mockInsertVentes
      .mockImplementationOnce(() => ({
        select: () => Promise.resolve({ data: null, error: { code: '23505', message: 'idx_ventes_idempotency_key_offre' } }),
      }))
      .mockImplementationOnce(() => Promise.resolve({ data: null, error: { code: '42501', message: 'rls' } }))

    const result = await flushOfflineSales({})

    expect(result).toEqual({ flushed: 0, failed: 1 })
    expect(mockDelete).not.toHaveBeenCalled()
  })
})
