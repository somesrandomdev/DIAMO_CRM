import { type ReactNode, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, Droplets, FileText, Home, LogOut, ShoppingCart, Store, Target, Users } from 'lucide-react'
import { useAuthStore, type UserRole } from '@/stores/authStore'

interface LayoutProps {
  children: ReactNode
}

interface NavItem {
  id: string
  label: string
  icon: ReactNode
  path: string
  roles: UserRole[]
}

const navigationItems: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <Home className="h-4 w-4" />, path: '/admin/dashboard', roles: ['administrateur'] },
  { id: 'kiosques', label: 'Kiosques', icon: <Store className="h-4 w-4" />, path: '/admin/kiosques', roles: ['administrateur'] },
  { id: 'offres', label: 'Offres & Prix', icon: <Droplets className="h-4 w-4" />, path: '/admin/offres', roles: ['administrateur'] },
  { id: 'utilisateurs', label: 'Utilisateurs', icon: <Users className="h-4 w-4" />, path: '/admin/utilisateurs', roles: ['administrateur'] },
  { id: 'analyses-admin', label: 'Analyses', icon: <BarChart3 className="h-4 w-4" />, path: '/analyses', roles: ['administrateur'] },
  { id: 'exports', label: 'Exports', icon: <FileText className="h-4 w-4" />, path: '/admin/rapports', roles: ['administrateur'] },
  { id: 'parametres', label: 'Paramètres', icon: <Target className="h-4 w-4" />, path: '/profil', roles: ['administrateur'] },
  { id: 'analyses', label: 'Analyses', icon: <BarChart3 className="h-4 w-4" />, path: '/analyses', roles: ['commercial'] },
  { id: 'mes-clients-comm', label: 'Mes Clients', icon: <Users className="h-4 w-4" />, path: '/clients', roles: ['commercial'] },
  { id: 'historique', label: 'Historique ventes', icon: <ShoppingCart className="h-4 w-4" />, path: '/ventes/historique', roles: ['commercial'] },
  { id: 'export-csv', label: 'Exporter CSV', icon: <FileText className="h-4 w-4" />, path: '/admin/rapports', roles: ['commercial'] },
  { id: 'nouvelle', label: 'Nouvelle vente', icon: <ShoppingCart className="h-4 w-4" />, path: '/ventes/nouvelle', roles: ['fontainier'] },
  { id: 'mes-ventes', label: 'Mes ventes', icon: <BarChart3 className="h-4 w-4" />, path: '/ventes/historique', roles: ['fontainier'] },
  { id: 'mes-clients', label: 'Mes clients', icon: <Users className="h-4 w-4" />, path: '/clients', roles: ['fontainier'] },
]

function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export default function Layout({ children }: LayoutProps) {
  const { profile, signOut } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const handleNavigation = useCallback(
    (path: string) => {
      navigate(path)
    },
    [navigate]
  )

  const handleLogout = useCallback(async () => {
    await signOut()
    navigate('/login')
  }, [navigate, signOut])

  const role = profile?.role

  const isActivePath = useCallback(
    (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`),
    [location.pathname]
  )

  const filteredNavItems = useMemo(
    () => navigationItems.filter((item) => profile?.role && item.roles.includes(profile.role)),
    [profile?.role]
  )

  return (
    <div className="diamo-shell">
      <aside className="diamo-sidebar hidden lg:flex">
          <div className="logo">
            <div className="icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.5 5.5a4.5 4.5 0 01-6.36 6.36L12 21.5l-6.5-6.5a4.5 4.5 0 016.36-6.36L12 2.69z" /></svg>
            </div>
            <span className="text">Diam'o</span>
          </div>
          <div className="nav">
            {role === 'administrateur' && (
              <>
                <div className="nav-section">
                  <div className="nav-section-header">Principal</div>
                  {filteredNavItems.filter(i => ['dashboard','kiosques','offres','utilisateurs'].includes(i.id)).map(item => (
                    <div key={item.id} className={`nav-item ${isActivePath(item.path) ? 'active' : ''}`} onClick={() => handleNavigation(item.path)}>
                      <span className="icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="nav-section">
                  <div className="nav-section-header">Rapports</div>
                  {filteredNavItems.filter(i => ['analyses-admin','exports'].includes(i.id)).map(item => (
                    <div key={item.id} className={`nav-item ${isActivePath(item.path) ? 'active' : ''}`} onClick={() => handleNavigation(item.path)}>
                      <span className="icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="nav-section">
                  <div className="nav-section-header">Système</div>
                  {filteredNavItems.filter(i => ['parametres'].includes(i.id)).map(item => (
                    <div key={item.id} className={`nav-item ${isActivePath(item.path) ? 'active' : ''}`} onClick={() => handleNavigation(item.path)}>
                      <span className="icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {role === 'commercial' && (
              <>
                <div className="nav-section">
                  <div className="nav-section-header">Principal</div>
                  {filteredNavItems.filter(i => ['analyses','mes-clients-comm'].includes(i.id)).map(item => (
                    <div key={item.id} className={`nav-item ${isActivePath(item.path) ? 'active' : ''}`} onClick={() => handleNavigation(item.path)}>
                      <span className="icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="nav-section">
                  <div className="nav-section-header">Ventes</div>
                  {filteredNavItems.filter(i => ['historique','export-csv'].includes(i.id)).map(item => (
                    <div key={item.id} className={`nav-item ${isActivePath(item.path) ? 'active' : ''}`} onClick={() => handleNavigation(item.path)}>
                      <span className="icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {role === 'fontainier' && (
              <>
                <div className="nav-section">
                  <div className="nav-section-header">Ventes</div>
                  {filteredNavItems.filter(i => ['nouvelle','mes-ventes'].includes(i.id)).map(item => (
                    <div key={item.id} className={`nav-item ${isActivePath(item.path) ? 'active' : ''}`} onClick={() => handleNavigation(item.path)}>
                      <span className="icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="nav-section">
                  <div className="nav-section-header">Clients</div>
                  {filteredNavItems.filter(i => ['mes-clients'].includes(i.id)).map(item => (
                    <div key={item.id} className={`nav-item ${isActivePath(item.path) ? 'active' : ''}`} onClick={() => handleNavigation(item.path)}>
                      <span className="icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          {profile && (
            <div className="nav-footer" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className={`avatar ${role === 'administrateur' ? 'admin' : role === 'commercial' ? 'commercial' : 'fontainier'}`}>{profile.username?.slice(0,2).toUpperCase() || 'U'}</div>
                <div className="info">
                  <div className="name">{profile.username}</div>
                  <div className="role">{capitalizeFirst(role || '')}</div>
                </div>
              </div>
              <button type="button" onClick={handleLogout} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-tertiary)' }} aria-label="Déconnexion">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="diamo-topbar">
            <span className="title">
              {role === 'administrateur' ? 'Tableau de bord' : role === 'commercial' ? 'Analyses — Kiosque Liberté' : 'Nouvelle vente — Kiosque Liberté'}
            </span>
            <span className={`role-badge ${role === 'administrateur' ? 'admin' : role === 'commercial' ? 'commercial' : 'fontainier'}`}>{capitalizeFirst(role || '')}</span>
          </div>
          <div className="flex-1 overflow-auto p-4" style={{ background: 'var(--bg)' }}>
            <div className="max-w-[1200px] mx-auto">{children}</div>
          </div>
        </div>
      </div>
  )
}
