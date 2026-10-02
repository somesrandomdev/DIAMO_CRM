import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

/**
 * Clients par kiosque, Performance, Supervision: data comes from the paged
 * Postgres functions; the pages only send search/sort/filter/page params.
 */

const mockRpc = jest.fn()
jest.mock('@/lib/supabase', () => {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'gte', 'order', 'range']) chain[method] = () => chain
  chain.maybeSingle = async () => ({ data: { nom: 'Kiosque Médina' }, error: null })
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], count: 0, error: null }).then(resolve)
  return {
    supabase: { rpc: (...args: unknown[]) => mockRpc(...args), from: () => chain },
    handleSupabaseError: (error: { message?: string }) => error.message ?? 'erreur',
  }
})
jest.mock('@/components/Toast', () => ({ useToast: () => ({ showToast: jest.fn() }) }))
jest.mock('@/components/charts/DailyTrendChart', () => ({ DailyTrendChart: () => null }))
jest.mock('@/lib/useDebouncedValue', () => ({ useDebouncedValue: <T,>(value: T) => value }))

import ClientsByKiosk from '../admin/ClientsByKiosk'
import FontainierPerformance from '../admin/FontainierPerformance'
import CommercialDashboard from '../CommercialDashboard'

const totals = { kiosques: 2, kiosques_actifs: 1, clients: 131, nouveaux_7j: 7, ca: 205600, nb_ventes: 250, avec_objectif: 0, objectif_atteint: 0 }
const kiosk = (id: string, nom: string, extra: Record<string, unknown> = {}) => ({
  kiosque_id: id, nom, adresse: null, nb_clients: 131, nouveaux_7j: 7, ca: 205600, nb_ventes: 250,
  clients_actifs: 40, last_sale_at: '2026-10-01T11:55:49Z', objectif: null, pct: null, top_client: null, best_offre: null, ...extra,
})

function Path() {
  const location = useLocation()
  return <p data-testid="path">{location.pathname + location.search}</p>
}

async function renderAt(path: string, element: React.ReactElement) {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path.split('?')[0]} element={<>{element}<Path /></>} />
          <Route path="*" element={<Path />} />
        </Routes>
      </MemoryRouter>
    )
  })
}

beforeEach(() => mockRpc.mockReset())

describe('Clients par kiosque', () => {
  beforeEach(() => {
    mockRpc.mockImplementation(async (fn: string) =>
      fn === 'kiosk_overview'
        ? { data: { total: 1, totals, rows: [kiosk('k1', 'Kiosque Médina')] }, error: null }
        : { data: { total: 1, rows: [{ id: 'c1', kiosque_id: 'k1', nom: 'Pere Barro', telephone: '778375516', total_depense: 10500, dernier_achat: null, nb_achats: 3 }] }, error: null }
    )
  })

  it('KPIs du réseau calculés en base, recherche envoyée au serveur', async () => {
    await renderAt('/admin/clients-par-kiosque', <ClientsByKiosk />)
    const totalCard = screen.getByText('Total clients').parentElement!
    expect(totalCard).toHaveTextContent('131')
    expect(screen.getByText('1 / 2')).toBeInTheDocument() // kiosques actifs / total
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Rechercher un kiosque'), { target: { value: 'méd' } })
    })
    await waitFor(() =>
      expect(mockRpc).toHaveBeenLastCalledWith('kiosk_overview', expect.objectContaining({ p_search: 'méd', p_offset: 0 }))
    )
  })

  it('ouvrir un kiosque : ?kiosque= dans l’URL et ses clients chargés côté serveur', async () => {
    await renderAt('/admin/clients-par-kiosque', <ClientsByKiosk />)
    const row = screen.getAllByText('Kiosque Médina')[0].closest('tr')!
    await act(async () => fireEvent.click(row))

    expect(screen.getByTestId('path')).toHaveTextContent('/admin/clients-par-kiosque?kiosque=k1')
    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith('kiosk_clients', expect.objectContaining({ p_kiosque_id: 'k1', p_sort: 'nom' }))
    )
    expect(await screen.findAllByText('Pere Barro')).not.toHaveLength(0)
  })
})

describe('Performance des fontainiers', () => {
  const counts = { tous: 13, atteint: 0, en_bonne_voie: 0, en_difficulte: 1, sans_objectif: 12 }
  const row = { id: 'f1', nom: 'Awa', kiosque_id: 'k1', kiosque_nom: 'Kiosque Médina', ca: 5000, objectif: 50000, pct: 10, nb_ventes: 3, clients: 2, panier: 1667, statut: 'en_difficulte' }

  it('les compteurs de statut sont les filtres ; un clic filtre côté serveur', async () => {
    mockRpc.mockResolvedValue({ data: { total: 1, counts, rows: [row] }, error: null })
    await renderAt('/admin/performance', <FontainierPerformance />)

    const filters = screen.getByRole('group', { name: 'Filtrer par statut' })
    const difficulty = within(filters).getByRole('button', { name: /En difficulté/ })
    expect(difficulty).toHaveTextContent('1')
    await act(async () => fireEvent.click(difficulty))

    expect(difficulty).toHaveAttribute('aria-pressed', 'true')
    expect(mockRpc).toHaveBeenLastCalledWith('fontainier_performance', expect.objectContaining({ p_status: 'en_difficulte', p_sort: 'pct_asc' }))
  })

  it('une ligne ouvre la fiche du kiosque', async () => {
    mockRpc.mockResolvedValue({ data: { total: 1, counts, rows: [row] }, error: null })
    await renderAt('/admin/performance', <FontainierPerformance />)
    await act(async () => fireEvent.click(screen.getAllByText('Awa')[0].closest('tr')!))
    expect(screen.getByTestId('path')).toHaveTextContent('/admin/kiosques/k1')
  })
})

describe('Supervision', () => {
  it('aucun kiosque supervisé : état vide explicite', async () => {
    mockRpc.mockImplementation(async (fn: string) =>
      fn === 'kiosk_overview'
        ? { data: { total: 0, totals: { ...totals, kiosques: 0 }, rows: [] }, error: null }
        : { data: [], error: null }
    )
    await renderAt('/commercial', <CommercialDashboard />)
    expect(screen.getByText('Aucun kiosque supervisé')).toBeInTheDocument()
  })

  it('liste « Mes kiosques » triée par retard sur l’objectif par défaut', async () => {
    mockRpc.mockImplementation(async (fn: string) =>
      fn === 'kiosk_overview'
        ? { data: { total: 1, totals, rows: [kiosk('k1', 'Kiosque Médina', { objectif: 400000, pct: 51.4 })] }, error: null }
        : { data: [], error: null }
    )
    await renderAt('/commercial', <CommercialDashboard />)
    expect(mockRpc).toHaveBeenCalledWith('kiosk_overview', expect.objectContaining({ p_sort: 'pct_asc' }))
    expect(screen.getAllByText('51 %')).not.toHaveLength(0)
  })
})
