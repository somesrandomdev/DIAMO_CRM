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
