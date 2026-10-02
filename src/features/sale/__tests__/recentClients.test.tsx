import { fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import type { Client } from '@/stores/venteStore'

/**
 * Recent-client chips: the kiosque's most recent BUYERS (one chip per
 * client, latest sale first), topped up with its newest clients; loaded once
 * on mount, hidden when there are none, one tap selects + pre-fills.
 */

type Response = { data: unknown; error: unknown }
let mockResponses: Record<string, Response> = {}
const mockCalls: Array<{ table: string; select: string; eq: unknown[]; order: unknown[]; limit: number }> = []

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const call = { table, select: '', eq: [] as unknown[], order: [] as unknown[], limit: 0 }
      const chain = {
        select: (columns: string) => ((call.select = columns), chain),
        eq: (...args: unknown[]) => ((call.eq = args), chain),
        order: (...args: unknown[]) => ((call.order = args), chain),
        limit: async (n: number) => {
          call.limit = n
          mockCalls.push(call)
          return mockResponses[table] ?? { data: [], error: null }
        },
      }
      return chain
    },
  },
}))

import { useRecentClients } from '../useRecentClients'
import { SaleClientPicker } from '../SaleClientPicker'

const recent: Client[] = [
  { id: 'c3', nom: 'Awa Diallo', telephone: '773334455', kiosque_id: 'k1' },
  { id: 'c2', nom: 'Moussa Diop', telephone: '772223344', kiosque_id: 'k1' },
]

const client = (id: string, nom: string) => ({ id, nom, telephone: '77', kiosque_id: 'k1' })
const sale = (c: ReturnType<typeof client> | null) => ({ client_id: c?.id ?? null, clients: c })

beforeEach(() => {
  jest.clearAllMocks()
  mockResponses = {}
  mockCalls.length = 0
})

describe('useRecentClients', () => {
  it('derniers ACHETEURS du kiosque, ventes les plus récentes d’abord, un client = une chip', async () => {
    const awa = client('c1', 'Awa'), moussa = client('c2', 'Moussa'), fatou = client('c3', 'Fatou')
    mockResponses.ventes = {
      // Panier multi-offres d'Awa = 2 lignes ; Moussa a acheté avant.
      data: [sale(awa), sale(awa), sale(moussa), sale(awa), sale(fatou)],
      error: null,
    }
    const { result } = renderHook(() => useRecentClients('k1'))

    await waitFor(() => expect(result.current.recentClients.map((c) => c.nom)).toEqual(['Awa', 'Moussa', 'Fatou']))
    const ventes = mockCalls.find((call) => call.table === 'ventes')!
    expect(ventes.eq).toEqual(['kiosque_id', 'k1'])
    expect(ventes.order).toEqual(['created_at', { ascending: false }])
  })

  it('moins de 5 acheteurs : complété par les clients les plus récemment créés, sans doublon', async () => {
    const awa = client('c1', 'Awa')
    mockResponses.ventes = { data: [sale(awa)], error: null }
    mockResponses.clients = { data: [client('c9', 'Nouveau'), awa, client('c8', 'Ibou')], error: null }
    const { result } = renderHook(() => useRecentClients('k1'))

    await waitFor(() => expect(result.current.recentClients.map((c) => c.nom)).toEqual(['Awa', 'Nouveau', 'Ibou']))
    const clients = mockCalls.find((call) => call.table === 'clients')!
    expect(clients.eq).toEqual(['kiosque_id', 'k1'])
    expect(clients.order).toEqual(['created_at', { ascending: false }])
  })

  it('5 acheteurs ou plus : 5 chips max, pas de 2e requête', async () => {
    mockResponses.ventes = {
      data: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => sale(client(id, id.toUpperCase()))),
      error: null,
    }
    const { result } = renderHook(() => useRecentClients('k1'))
    await waitFor(() => expect(result.current.recentClients).toHaveLength(5))
    expect(mockCalls.map((call) => call.table)).toEqual(['ventes'])
  })

  it('vente sans client ou client sans nom : ignorée', async () => {
    mockResponses.ventes = { data: [sale(null), sale(client('c1', '')), sale(client('c2', 'Awa'))], error: null }
    mockResponses.clients = { data: [], error: null }
    const { result } = renderHook(() => useRecentClients('k1'))
    await waitFor(() => expect(result.current.recentClients.map((c) => c.nom)).toEqual(['Awa']))
  })

  it('une seule série de requêtes au montage (pas à chaque rendu)', async () => {
    mockResponses.ventes = { data: [sale(client('c1', 'Awa'))], error: null }
    const { result, rerender } = renderHook(() => useRecentClients('k1'))
    await waitFor(() => expect(result.current.recentClients).toHaveLength(1))
    rerender()
    rerender()
    expect(mockCalls).toHaveLength(2) // ventes + complément clients
  })

  it('erreur (hors ligne, RLS) : aucune chip', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    mockResponses.ventes = { data: null, error: { code: 'PGRST', message: 'fetch failed' } }
    const { result } = renderHook(() => useRecentClients('k1'))
    await waitFor(() => expect(mockCalls).toHaveLength(1))
    expect(result.current.recentClients).toEqual([])
  })

  it('complément en erreur : on garde les acheteurs', async () => {
    mockResponses.ventes = { data: [sale(client('c1', 'Awa'))], error: null }
    mockResponses.clients = { data: null, error: { code: 'PGRST', message: 'fetch failed' } }
    const { result } = renderHook(() => useRecentClients('k1'))
    await waitFor(() => expect(mockCalls).toHaveLength(2))
    expect(result.current.recentClients.map((c) => c.nom)).toEqual(['Awa'])
  })

  it('pas de kiosque : aucune requête, aucune chip', () => {
    const { result } = renderHook(() => useRecentClients(null))
    expect(mockCalls).toHaveLength(0)
    expect(result.current.recentClients).toEqual([])
  })
})

describe('SaleClientPicker — chips clients récents', () => {
  function renderPicker(props: Partial<Parameters<typeof SaleClientPicker>[0]> = {}) {
    const onSelect = jest.fn()
    render(
      <SaleClientPicker
        clients={recent}
        isLoading={false}
        selectedClient={null}
        onSelect={onSelect}
        onClear={jest.fn()}
        onAddNew={jest.fn()}
        resetKey={0}
        recentClients={recent}
        {...props}
      />
    )
    return { onSelect }
  }

  it('affiche une chip par client récent (nom + téléphone)', () => {
    renderPicker()
    const chips = within(screen.getByRole('list', { name: 'Clients récents' })).getAllByRole('button')
    expect(chips).toHaveLength(2)
    expect(chips[0]).toHaveTextContent('Awa Diallo')
    expect(chips[0]).toHaveTextContent('773334455')
  })

  it('aucun client récent : pas de chips ni de titre vide', () => {
    renderPicker({ recentClients: [] })
    expect(screen.queryByText('Clients récents')).not.toBeInTheDocument()
  })

  it('clic sur une chip : sélectionne le client et pré-remplit le champ', () => {
    const { onSelect } = renderPicker()
    fireEvent.click(screen.getByRole('button', { name: /Awa Diallo/ }))
    expect(onSelect).toHaveBeenCalledWith(recent[0])
    expect(screen.getByLabelText('Rechercher un client')).toHaveValue('Awa Diallo')
  })

  it('client déjà sélectionné : chips masquées', () => {
    renderPicker({ selectedClient: recent[1] })
    expect(screen.queryByText('Clients récents')).not.toBeInTheDocument()
  })
})
