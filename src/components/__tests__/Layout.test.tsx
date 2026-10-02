import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { UserRole } from '@/stores/authStore'

/**
 * Navigation by role: fontainiers get a bottom tab bar (Vendre / Mes ventes /
 * Clients) and no ☰ button; admins and commercials keep the ☰ menu.
 */

let mockRole: UserRole = 'fontainier'

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    profile: { id: 'u1', username: 'Awa', role: mockRole, kiosques: { nom: 'Kiosque Médina' } },
    signOut: jest.fn(async () => undefined),
  }),
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ gte: async () => ({ count: 0 }) }) }),
    }),
  },
}))

jest.mock('@/components/CommandPalette', () => ({ CommandPalette: () => null }))

const mockQueuedCount = jest.fn(async () => 0)
jest.mock('@/utils/offlineSalesQueue', () => ({ getQueuedSalesCount: () => mockQueuedCount() }))

import { act } from '@testing-library/react'
import { useSyncStore } from '@/stores/syncStore'
import Layout from '../Layout'

function CurrentPath() {
  return <p data-testid="path">{useLocation().pathname}</p>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Layout>
        <Routes>
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </Layout>
    </MemoryRouter>
  )
}

describe('Layout — navigation par rôle', () => {
  it('fontainier : barre d’onglets à 3 onglets, pas de ☰', () => {
    mockRole = 'fontainier'
    renderAt('/ventes/nouvelle')

    const tabBar = screen.getByRole('navigation', { name: 'Navigation principale' })
    const tabs = within(tabBar).getAllByRole('button')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Vendre', 'Mes ventes', 'Clients'])
    expect(within(tabBar).getByRole('button', { name: 'Vendre' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('Ouvrir le menu')).toHaveClass('hidden')
    // Profil + déconnexion restent accessibles sans le ☰
    expect(screen.getByLabelText('Mon profil')).toBeInTheDocument()
  })

  it('fontainier : un onglet navigue et devient actif', () => {
    mockRole = 'fontainier'
    renderAt('/ventes/nouvelle')

    const tabBar = screen.getByRole('navigation', { name: 'Navigation principale' })
    fireEvent.click(within(tabBar).getByRole('button', { name: 'Clients' }))

    expect(screen.getByTestId('path')).toHaveTextContent('/clients')
    expect(within(tabBar).getByRole('button', { name: 'Clients' })).toHaveAttribute('aria-current', 'page')
    expect(within(tabBar).getByRole('button', { name: 'Vendre' })).not.toHaveAttribute('aria-current')
  })

  it.each<UserRole>(['administrateur', 'commercial'])('%s : ☰ présent, pas de barre d’onglets', (role) => {
    mockRole = role
    renderAt('/profil')

    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Ouvrir le menu')).not.toHaveClass('hidden')
  })
})

describe('Layout — bandeau hors-ligne unique', () => {
  const setOnline = (value: boolean) =>
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value })

  afterEach(() => {
    setOnline(true)
    useSyncStore.getState().setPendingCount(0)
  })

  it('hors ligne : UN seul bandeau, avec le nombre de ventes en attente', async () => {
    mockRole = 'fontainier'
    mockQueuedCount.mockResolvedValue(2)
    setOnline(false)
    await act(async () => {
      renderAt('/ventes/nouvelle')
    })

    const banners = screen.getAllByRole('status')
    expect(banners).toHaveLength(1)
    expect(banners[0]).toHaveTextContent('Vous êtes hors ligne · 2 ventes en attente')
  })

  it('hors ligne sans vente en attente : pas de compteur', async () => {
    mockRole = 'fontainier'
    mockQueuedCount.mockResolvedValue(0)
    setOnline(false)
    await act(async () => {
      renderAt('/ventes/nouvelle')
    })
    expect(screen.getByRole('status')).toHaveTextContent(/^Vous êtes hors ligne$/)
  })

  it('le compteur suit la file (mise à jour par l’écran de vente)', async () => {
    mockRole = 'fontainier'
    mockQueuedCount.mockResolvedValue(1)
    setOnline(false)
    await act(async () => {
      renderAt('/ventes/nouvelle')
    })
    expect(screen.getByRole('status')).toHaveTextContent('1 vente en attente')
    act(() => useSyncStore.getState().setPendingCount(3))
    expect(screen.getByRole('status')).toHaveTextContent('3 ventes en attente')
  })

  it('retour du réseau : le bandeau disparaît', async () => {
    mockRole = 'fontainier'
    setOnline(false)
    await act(async () => {
      renderAt('/ventes/nouvelle')
    })
    expect(screen.getByRole('status')).toBeInTheDocument()
    setOnline(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('en ligne : aucun bandeau', async () => {
    mockRole = 'administrateur'
    await act(async () => {
      renderAt('/profil')
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
