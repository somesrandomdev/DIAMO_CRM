import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

/**
 * Admin alerts panel: only active kiosks are watched, each alert opens the
 * kiosk page, filters by existing rule, explicit empty state.
 */

type Rpc = { data: unknown; error: unknown }
let mockRpc: Record<string, Rpc> = {}
let mockTables: Record<string, unknown[]> = {}

jest.mock('@/lib/supabase', () => {
  const query = (table: string) => {
    const result = () => Promise.resolve({ data: mockTables[table] ?? [], error: null })
    const chain: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'is', 'gte']) chain[method] = () => chain
    chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => result().then(resolve, reject)
    return chain
  }
  return {
    supabase: {
      rpc: async (name: string) => mockRpc[name] ?? { data: null, error: { message: 'not found' } },
      from: (table: string) => query(table),
    },
  }
})

import { AlertsPanel } from '../AlertsPanel'

const danger = (id: string, nom: string) => ({ type: 'inactif_48h', kiosque_id: id, kiosque_nom: nom, message: 'Aucune vente depuis 48 heures', severity: 'danger' })
const today = (id: string, nom: string) => ({ type: 'inactif_today', kiosque_id: id, kiosque_nom: nom, message: "Aucune vente enregistrée aujourd'hui", severity: 'warning' })

function CurrentPath() {
  return <p data-testid="path">{useLocation().pathname}</p>
}

async function renderPanel() {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Routes>
          <Route path="/admin/dashboard" element={<AlertsPanel />} />
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>
    )
  })
}

beforeEach(() => {
  mockRpc = {}
  mockTables = {}
})

describe('AlertsPanel', () => {
  it('affiche le nombre de kiosques actifs surveillés', async () => {
    mockRpc = {
      get_admin_alerts: { data: [danger('k1', 'Kiosque Pikine')], error: null },
      get_admin_alerts_scope: { data: [{ active_kiosques: 11, total_kiosques: 70 }], error: null },
    }
    await renderPanel()
    expect(screen.getByText('11 kiosques actifs surveillés')).toBeInTheDocument()
  })

  it('une alerte mène à la fiche kiosque', async () => {
    mockRpc = {
      get_admin_alerts: { data: [danger('k1', 'Kiosque Pikine')], error: null },
      get_admin_alerts_scope: { data: [{ active_kiosques: 1, total_kiosques: 3 }], error: null },
    }
    await renderPanel()
    expect(screen.getByText('1 kiosque actif surveillé')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /Kiosque Pikine/ }))
    expect(screen.getByTestId('path')).toHaveTextContent('/admin/kiosques/k1')
  })

  it('une alerte offre (sans kiosque) mène aux offres', async () => {
    mockRpc = {
      get_admin_alerts: {
        data: [{ type: 'offre_sous_perf', kiosque_id: null, kiosque_nom: 'Sachet 1L', message: 'Moins de 5%', severity: 'info' }],
        error: null,
      },
      get_admin_alerts_scope: { data: [{ active_kiosques: 2, total_kiosques: 3 }], error: null },
    }
    await renderPanel()
    fireEvent.click(screen.getByRole('link', { name: /Sachet 1L/ }))
    expect(screen.getByTestId('path')).toHaveTextContent('/admin/offres')
  })

  it('filtre par règle existante', async () => {
    mockRpc = {
      get_admin_alerts: { data: [danger('k1', 'Pikine'), danger('k2', 'Médina'), today('k3', 'Plateau')], error: null },
      get_admin_alerts_scope: { data: [{ active_kiosques: 3, total_kiosques: 3 }], error: null },
    }
    await renderPanel()
    const list = () => within(screen.getByRole('list', { name: 'Alertes' })).getAllByRole('listitem')
    expect(list()).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: "Sans vente aujourd'hui (1)" }))
    expect(list()).toHaveLength(1)
    expect(list()[0]).toHaveTextContent('Plateau')
    expect(screen.getByRole('button', { name: "Sans vente aujourd'hui (1)" })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Sans vente 48 h (2)' }))
    expect(list()).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Toutes (3)' }))
    expect(list()).toHaveLength(3)
  })

  it('une seule règle : pas de filtres inutiles', async () => {
    mockRpc = {
      get_admin_alerts: { data: [danger('k1', 'Pikine')], error: null },
      get_admin_alerts_scope: { data: [{ active_kiosques: 1, total_kiosques: 1 }], error: null },
    }
    await renderPanel()
    expect(screen.queryByRole('group', { name: 'Filtrer les alertes' })).not.toBeInTheDocument()
  })

  it('aucune alerte : état vide explicite', async () => {
    mockRpc = {
      get_admin_alerts: { data: [], error: null },
      get_admin_alerts_scope: { data: [{ active_kiosques: 11, total_kiosques: 70 }], error: null },
    }
    await renderPanel()
    expect(screen.getByText('Aucune alerte — tous les kiosques actifs ont vendu récemment')).toBeInTheDocument()
  })

  it('migration pas encore exécutée : le périmètre actif est appliqué côté client', async () => {
    // Ancienne RPC : alerte sur TOUS les kiosques ; RPC de périmètre absente.
    mockRpc = {
      get_admin_alerts: { data: [danger('k-staffed', 'Avec fontainier'), danger('k-dormant', 'Jamais ouvert')], error: null },
    }
    mockTables = {
      kiosques: [{ id: 'k-staffed', nom: 'Avec fontainier' }, { id: 'k-dormant', nom: 'Jamais ouvert' }],
      profiles: [{ kiosque_id: 'k-staffed', role: 'fontainier', deleted_at: null }],
      ventes: [],
    }
    await renderPanel()
    expect(screen.getByText('1 kiosque actif surveillé')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Avec fontainier/ })).toBeInTheDocument()
    expect(screen.queryByText('Jamais ouvert')).not.toBeInTheDocument()
  })

  it('erreur de chargement : pas d’état vide trompeur', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    mockRpc = {
      get_admin_alerts: { data: [danger('k1', 'Pikine')], error: null },
    }
    // Périmètre client en échec (table kiosques en erreur).
    const { supabase } = jest.requireMock('@/lib/supabase') as { supabase: { from: (t: string) => unknown } }
    const original = supabase.from
    supabase.from = () => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'is', 'gte']) chain[m] = () => chain
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: new Error('réseau') }).then(resolve)
      return chain
    }
    await renderPanel()
    supabase.from = original
    expect(screen.queryByText(/Aucune alerte/)).not.toBeInTheDocument()
    expect(screen.getByText('réseau')).toBeInTheDocument()
  })
})
