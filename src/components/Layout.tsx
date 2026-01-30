import { type ReactNode, useState, useMemo } from 'react'
import { useAuthStore } from '../stores/authStore'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  FaHome,
  FaShoppingCart,
  FaUsers,
  FaSignOutAlt,
  FaChartBar,
  FaStore,
  FaBars,
  FaTint,
  FaMoneyBillWave
} from 'react-icons/fa'

interface LayoutProps {
  children: ReactNode
}

interface NavItem {
  id: string
  label: string
  icon: ReactNode
  path: string
  roles: string[]
}

const navigationItems: NavItem[] = [
  // Fontainier Navigation - EXACT MATCH with specification
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    icon: <FaHome className="w-5 h-5" />,
    path: '/dashboard',
    roles: ['fontainier']
  },
  {
    id: 'nouvelle-vente',
    label: 'Nouvelle Vente',
    icon: <FaShoppingCart className="w-5 h-5" />,
    path: '/nouvelle-vente',
    roles: ['fontainier']
  },
  {
    id: 'mes-clients',
    label: 'Mes Clients',
    icon: <FaUsers className="w-5 h-5" />,
    path: '/mes-clients',
    roles: ['fontainier']
  },
  {
    id: 'mes-ventes',
    label: 'Mes Ventes',
    icon: <FaChartBar className="w-5 h-5" />,
    path: '/mes-ventes',
    roles: ['fontainier']
  },
  {
    id: 'profil-agent',
    label: 'Mon Profil',
    icon: <FaUsers className="w-5 h-5" />,
    path: '/profil',
    roles: ['agent_commercial']
  },

  // Commercial Navigation - EXACT MATCH with specification
  {
    id: 'commercial-dashboard',
    label: 'Tableau de bord',
    icon: <FaHome className="w-5 h-5" />,
    path: '/dashboard',
    roles: ['commercial']
  },
  {
    id: 'ventes-commercial',
    label: 'Ventes',
    icon: <FaShoppingCart className="w-5 h-5" />,
    path: '/ventes',
    roles: ['commercial']
  },
  {
    id: 'clients-commercial',
    label: 'Clients',
    icon: <FaUsers className="w-5 h-5" />,
    path: '/clients',
    roles: ['commercial']
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <FaChartBar className="w-5 h-5" />,
    path: '/analytics',
    roles: ['commercial']
  },
  {
    id: 'historique',
    label: 'Historique',
    icon: <FaChartBar className="w-5 h-5" />,
    path: '/historique',
    roles: ['commercial']
  },
  {
    id: 'profil-commercial',
    label: 'Mon Profil',
    icon: <FaUsers className="w-5 h-5" />,
    path: '/profil',
    roles: ['commercial']
  },

  // Administrator Navigation - EXACT MATCH with specification
  {
    id: 'vue-globale',
    label: 'Vue Globale',
    icon: <FaHome className="w-5 h-5" />,
    path: '/vue-globale',
    roles: ['administrateur']
  },
  {
    id: 'kiosques-admin',
    label: 'Kiosques',
    icon: <FaStore className="w-5 h-5" />,
    path: '/kiosques',
    roles: ['administrateur']
  },
  {
    id: 'offres-admin',
    label: 'Offres',
    icon: <FaTint className="w-5 h-5" />,
    path: '/offres',
    roles: ['administrateur']
  },
  {
    id: 'tarifs',
    label: 'Tarifs',
    icon: <FaMoneyBillWave className="w-5 h-5" />,
    path: '/tarifs',
    roles: ['administrateur']
  },
  {
    id: 'utilisateurs',
    label: 'Utilisateurs',
    icon: <FaUsers className="w-5 h-5" />,
    path: '/utilisateurs',
    roles: ['administrateur']
  },
  {
    id: 'donnees-globales',
    label: 'Données Globales',
    icon: <FaChartBar className="w-5 h-5" />,
    path: '/donnees-globales',
    roles: ['administrateur']
  },
  {
    id: 'profil-admin',
    label: 'Mon Profil',
    icon: <FaUsers className="w-5 h-5" />,
    path: '/profil',
    roles: ['administrateur']
  },
]

export default function Layout({ children }: LayoutProps) {
  const { profile, signOut } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const handleNavigation = (path: string) => {
    navigate(path)
  }

  const filteredNavItems = navigationItems.filter(item =>
    profile?.role && item.roles.includes(profile.role)
  )

  // Memoize filtered nav items to prevent unnecessary recalculations
  const memoizedNavItems = useMemo(() => filteredNavItems, [profile?.role])

  const currentDate = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const capitalizeFirst = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setMobileMenuOpen(false)} style={{ backgroundColor: 'rgba(28, 126, 214, 0.5)' }} />
      )}

      {/* Sidebar */}
      <div className={`w-64 bg-surface shadow-xl border-r border-border fixed h-full z-40 transform transition-all duration-300 ease-in-out lg:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-border bg-gradient-to-r from-primary/5 to-secondary/5">
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>Diam'o</h1>
            {/* Close button for mobile */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="btn btn-icon lg:hidden"
              style={{ padding: '0.5rem' }}
            >
              <FaBars className="w-5 h-5 transform rotate-45" style={{ color: 'var(--color-primary)' }} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {memoizedNavItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    handleNavigation(item.path)
                    setMobileMenuOpen(false)
                  }}
                  className={`btn w-full flex items-center px-4 py-3 text-left justify-start ${
                    isActive ? 'btn-primary' : 'btn-primary'
                  }`}
                  style={{
                    backgroundColor: isActive ? 'var(--color-primary-hover)' : 'var(--color-primary)',
                    borderColor: isActive ? 'var(--color-primary-hover)' : 'var(--color-primary)',
                    borderLeftWidth: isActive ? '4px' : '1px',
                    borderLeftColor: isActive ? 'var(--color-primary-hover)' : 'var(--color-primary)',
                    justifyContent: 'flex-start'
                  }}
                >
                  <span className="mr-3" style={{ color: 'white' }}>{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-blue-200">
            <button
              onClick={handleLogout}
              className="btn btn-primary w-full flex items-center justify-start"
            >
              <FaSignOutAlt className="w-5 h-5 mr-3" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64">
        {/* Header */}
        <header className="bg-surface shadow-lg border-b border-border px-4 lg:px-6 py-4 sticky top-0 z-50 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="btn btn-secondary btn-icon lg:hidden"
              >
                <FaBars className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-gradient-primary icon-enhanced">
                  <FaStore className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <span className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                    {profile?.role === 'administrateur'
                      ? 'Administration'
                      : capitalizeFirst(profile?.kiosques?.nom || 'Kiosque')
                    }
                  </span>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {profile?.role === 'administrateur' ? 'Vue globale' : 'Gestion de kiosque'}
                  </p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm hidden sm:block font-medium" style={{ color: 'var(--color-text-secondary)' }}>{currentDate}</p>
              <p className="text-xs capitalize font-semibold" style={{ color: 'var(--color-primary)' }}>{profile?.role}</p>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-4 lg:p-6 min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}