/**
 * Offline client flush: a 23505 on UNIQUE (kiosque_id, telephone) means the
 * client already exists — its id is reused instead of leaving the client (and
 * its sales) stuck in the queue; queued sales are re-pointed to the real id
 * before the client entry is dropped.
 */

const mockStores: Record<string, Map<string, Record<string, unknown>>> = {
  offlineClients: new Map(),
  sales: new Map(),
}
const mockClientInsert = jest.fn()
const mockClientLookup = jest.fn()

jest.mock('idb', () => ({
  openDB: jest.fn(async () => ({
    getAll: async (store: string) => [...mockStores[store].values()],
    put: async (store: string, value: Record<string, unknown>) => {
      mockStores[store].set((value.offline_id ?? value.id) as string, value)
    },
    delete: async (store: string, key: string) => {
      mockStores[store].delete(key)
    },
  })),
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: () => ({ select: () => ({ single: mockClientInsert }) }),
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mockClientLookup }) }) }),
    }),
  },
}))

jest.mock('@/lib/ticketGenerator', () => ({ generateTicket: jest.fn() }))

import { flushOfflineClients } from '../offlineClientQueue'

const queuedClient = {
  offline_id: 'offline-abc',
  kiosque_id: 'kiosque-1',
  nom: 'Awa',
  telephone: '771234567',
  email: null,
  localite: 'Dakar',
  type_client: 'menage',
  nombre_personnes: 4,
  contenant_prefere: '20L',
  preference_contact: 'sms',
  accepte_offres: true,
  created_at: '2026-10-01T10:00:00.000Z',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockStores.offlineClients.clear()
  mockStores.sales.clear()
  mockStores.offlineClients.set(queuedClient.offline_id, { ...queuedClient })
  mockStores.sales.set('queued-1', { id: 'queued-1', client_id: 'offline-abc', items: [] })
  mockStores.sales.set('queued-2', { id: 'queued-2', client_id: 'client-other', items: [] })
})

describe('flushOfflineClients', () => {
  it('insert OK : mappe l’id, re-pointe les ventes en file, dépile le client', async () => {
    mockClientInsert.mockResolvedValue({ data: { id: 'client-real' }, error: null })

    const result = await flushOfflineClients()

    expect(result).toEqual({ flushed: 1, failed: 0, clientIdMap: { 'offline-abc': 'client-real' } })
    expect(mockStores.sales.get('queued-1')?.client_id).toBe('client-real')
    expect(mockStores.sales.get('queued-2')?.client_id).toBe('client-other')
    expect(mockStores.offlineClients.size).toBe(0)
  })

  it('23505 (kiosque, téléphone) : réutilise l’id du client existant au lieu de rester bloqué', async () => {
    mockClientInsert.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint "clients_kiosque_telephone_unique"' },
    })
    mockClientLookup.mockResolvedValue({ data: { id: 'client-existing' }, error: null })

    const result = await flushOfflineClients()

    expect(result.clientIdMap).toEqual({ 'offline-abc': 'client-existing' })
    expect(result.flushed).toBe(1)
    expect(mockStores.sales.get('queued-1')?.client_id).toBe('client-existing')
    expect(mockStores.offlineClients.size).toBe(0)
  })

  it('échec réel (réseau/RLS) : le client RESTE en file, ventes intactes', async () => {
    mockClientInsert.mockResolvedValue({ data: null, error: { code: '42501', message: 'rls' } })

    const result = await flushOfflineClients()

    expect(result).toEqual({ flushed: 0, failed: 1, clientIdMap: {} })
    expect(mockStores.offlineClients.size).toBe(1)
    expect(mockStores.sales.get('queued-1')?.client_id).toBe('offline-abc')
  })
})
