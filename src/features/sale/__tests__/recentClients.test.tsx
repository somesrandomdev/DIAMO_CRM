import { fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import type { Client } from '@/stores/venteStore'

/**
 * Recent-client chips: the 5 latest clients of THE kiosque, loaded once on
 * mount, hidden when there are none, one tap selects + pre-fills the field.
 */

const mockQuery = {
  eq: jest.fn(),
  order: jest.fn(),
  limit: jest.fn(),
}
const mockSelect = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))

import { useRecentClients } from '../useRecentClients'
import { SaleClientPicker } from '../SaleClientPicker'

const recent: Client[] = [
  { id: 'c3', nom: 'Awa Diallo', telephone: '773334455', kiosque_id: 'k1' },
  { id: 'c2', nom: 'Moussa Diop', telephone: '772223344', kiosque_id: 'k1' },
]

function mockResponse(response: { data: unknown; error: unknown }) {
  mockFrom.mockReturnValue({ select: mockSelect })
  mockSelect.mockReturnValue(mockQuery)
  mockQuery.eq.mockReturnValue(mockQuery)
  mockQuery.order.mockReturnValue(mockQuery)
  mockQuery.limit.mockResolvedValue(response)
}

beforeEach(() => jest.clearAllMocks())

describe('useRecentClients', () => {
  it('charge les 5 derniers clients DU kiosque, triés par created_at décroissant', async () => {
    mockResponse({ data: recent, error: null })
    const { result } = renderHook(() => useRecentClients('k1'))

    await waitFor(() => expect(result.current.recentClients).toHaveLength(2))
    expect(mockFrom).toHaveBeenCalledWith('clients')
    expect(mockQuery.eq).toHaveBeenCalledWith('kiosque_id', 'k1')
    expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(mockQuery.limit).toHaveBeenCalledWith(5)
  })

  it('une seule requête au montage (pas à chaque rendu)', async () => {
    mockResponse({ data: recent, error: null })
    const { result, rerender } = renderHook(() => useRecentClients('k1'))
    await waitFor(() => expect(result.current.recentClients).toHaveLength(2))
    rerender()
    rerender()
    expect(mockQuery.limit).toHaveBeenCalledTimes(1)
  })

  it('erreur (hors ligne, RLS) : aucune chip', async () => {
    mockResponse({ data: null, error: { code: 'PGRST', message: 'fetch failed' } })
    const { result } = renderHook(() => useRecentClients('k1'))
    await waitFor(() => expect(mockQuery.limit).toHaveBeenCalled())
    expect(result.current.recentClients).toEqual([])
  })

  it('pas de kiosque : aucune requête, aucune chip', () => {
    const { result } = renderHook(() => useRecentClients(null))
    expect(mockFrom).not.toHaveBeenCalled()
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
