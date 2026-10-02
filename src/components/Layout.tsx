import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Tags,
  Building2,
  Droplets,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  ScrollText,
  ShoppingCart,
  Trash2,
  Store,
  Target,
  TrendingUp,
  User,
  Users,
  WifiOff,
  X,
} from 'lucide-react'
import { CommandPalette } from '@/components/CommandPalette'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { useAuthStore, type UserRole } from '@/stores/authStore'
import { useSyncStore } from '@/stores/syncStore'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children: ReactNode
}

interface NavItem {
  id: string
  label: string
  icon: ReactNode
  path: string
  roles: UserRole[]
  section: string
}

const navigationItems: NavItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <Home className="h-4 w-4" />, path: '/admin/dashboard', roles: ['administrateur'], section: 'Principal' },
  { id: 'kiosques', label: 'Kiosques', icon: <Store className="h-4 w-4" />, path: '/admin/kiosques', roles: ['administrateur'], section: 'Principal' },
  { id: 'offres', label: 'Offres', icon: <Droplets className="h-4 w-4" />, path: '/admin/offres', roles: ['administrateur'], section: 'Principal' },
  { id: 'tarifs', label: 'Tarifs', icon: <Tags className="h-4 w-4" />, path: '/admin/tarifs', roles: ['administrateur'], section: 'Principal' },
  { id: 'utilisateurs', label: 'Utilisateurs', icon: <Users className="h-4 w-4" />, path: '/admin/utilisateurs', roles: ['administrateur'], section: 'Principal' },
  { id: 'clients-par-kiosque', label: 'Clients par kiosque', icon: <Building2 className="h-4 w-4" />, path: '/admin/clients-par-kiosque', roles: ['administrateur'], section: 'Principal' },
  { id: 'objectifs', label: 'Objectifs', icon: <Target className="h-4 w-4" />, path: '/admin/objectifs', roles: ['administrateur'], section: 'Rapports' },
  { id: 'performance', label: 'Performance', icon: <TrendingUp className="h-4 w-4" />, path: '/admin/performance', roles: ['administrateur'], section: 'Rapports' },
  { id: 'rapports', label: 'Rapports', icon: <FileText className="h-4 w-4" />, path: '/admin/rapports', roles: ['administrateur'], section: 'Rapports' },
  { id: 'corbeille', label: 'Corbeille', icon: <Trash2 className="h-4 w-4" />, path: '/admin/corbeille', roles: ['administrateur'], section: 'Système' },
  { id: 'logs', label: "Logs d'audit", icon: <ScrollText className="h-4 w-4" />, path: '/admin/logs', roles: ['administrateur'], section: 'Système' },
  { id: 'profil-admin', label: 'Profil', icon: <User className="h-4 w-4" />, path: '/profil', roles: ['administrateur'], section: 'Système' },

  { id: 'supervision', label: 'Supervision', icon: <LayoutDashboard className="h-4 w-4" />, path: '/commercial', roles: ['commercial'], section: 'Principal' },
  { id: 'clients-commercial', label: 'Clients', icon: <Users className="h-4 w-4" />, path: '/clients', roles: ['commercial'], section: 'Principal' },
  { id: 'ventes-commercial', label: 'Ventes', icon: <ShoppingCart className="h-4 w-4" />, path: '/ventes/historique', roles: ['commercial'], section: 'Ventes' },
  { id: 'profil-commercial', label: 'Profil', icon: <User className="h-4 w-4" />, path: '/profil', roles: ['commercial'], section: 'Système' },

  { id: 'nouvelle', label: 'Nouvelle vente', icon: <ShoppingCart className="h-4 w-4" />, path: '/ventes/nouvelle', roles: ['fontainier'], section: 'Ventes' },
  { id: 'ventes-fontainier', label: 'Mes ventes', icon: <BarChart3 className="h-4 w-4" />, path: '/ventes/historique', roles: ['fontainier'], section: 'Ventes' },
  { id: 'clients-fontainier', label: 'Mes clients', icon: <Users className="h-4 w-4" />, path: '/clients', roles: ['fontainier'], section: 'Clients' },
  { id: 'profil-fontainier', label: 'Profil', icon: <User className="h-4 w-4" />, path: '/profil', roles: ['fontainier'], section: 'Système' },
]

/**
 * Fontainier on a phone: the three screens used all day, one tap away at the
 * bottom of the screen, instead of behind the ☰ menu.
 */
const fontainierTabs = [
  { id: 'vendre', label: 'Vendre', Icon: ShoppingCart, path: '/ventes/nouvelle' },
  { id: 'mes-ventes', label: 'Mes ventes', Icon: Receipt, path: '/ventes/historique' },
  { id: 'clients', label: 'Clients', Icon: Users, path: '/clients' },
] as const

const roleLabels: Record<UserRole, string> = {
  administrateur: 'Administrateur',
  commercial: 'Commercial',
  fontainier: 'Fontainier',
}

const roleClasses: Record<UserRole, string> = {
  administrateur: 'bg-purple-light text-purple',
  commercial: 'bg-blue-light text-blue',
  fontainier: 'bg-teal-light text-teal',
}

function Logo() {
  return (
    <div className="flex h-[var(--topbar-height)] items-center gap-2 border-b border-border px-4">
      <img
        src="/logo-principal.png"
        alt="Diam'o"
        className="h-10 max-w-[170px] object-contain"
      />
    </div>
  )
}

export default function Layout({ children }: LayoutProps) {
  const { profile, signOut } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [techErrorCount, setTechErrorCount] = useState(0)
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  )
  const role = profile?.role
  const isFontainier = role === 'fontainier'
  const pendingCount = useSyncStore((state) => state.pendingCount)

  // Cmd/Ctrl+K: command palette. Ctrl/Cmd+/: focus the page's search field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }
      if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        event.preventDefault()
        const input = document.querySelector<HTMLInputElement>(
          '[data-page-search] input, [data-page-search]'
        )
        input?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Badge rouge sur Logs: erreurs techniques dans les dernières 24h (admin seulement)
  useEffect(() => {
    if (role !== 'administrateur') return
    let cancelled = false
    const since = new Date(Date.now() - 86400000).toISOString()
    void supabase
      .from('tech_logs')
      .select('id', { count: 'exact', head: true })
      .eq('level', 'error')
      .gte('created_at', since)
      .then(({ count }) => {
        if (!cancelled) setTechErrorCount(count ?? 0)
      })
    return () => {
      cancelled = true
    }
  }, [role, location.pathname])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // Offline sales live in this phone's IndexedDB: count them from any screen
  // (the sale screen keeps the count fresh afterwards). Dynamic import keeps
  // the queue module — and jsPDF behind it — out of the shell bundle.
  useEffect(() => {
    if (!isFontainier) return
    let cancelled = false
    void import('@/utils/offlineSalesQueue')
      .then(({ getQueuedSalesCount }) => getQueuedSalesCount())
      .then((count) => {
        if (!cancelled) useSyncStore.getState().setPendingCount(count)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [isFontainier])

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

  const isActivePath = useCallback(
    (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`),
    [location.pathname]
  )

  const filteredNavItems = useMemo(
    () => navigationItems.filter((item) => role && item.roles.includes(role)),
    [role]
  )

  const groupedNavItems = useMemo(() => {
    return filteredNavItems.reduce<Record<string, NavItem[]>>((groups, item) => {
      groups[item.section] = groups[item.section] ?? []
      groups[item.section].push(item)
      return groups
    }, {})
  }, [filteredNavItems])

  const pageTitle = useMemo(() => {
    if (location.pathname.startsWith('/admin/kiosques/') && location.pathname !== '/admin/kiosques') {
      return 'Détail kiosque'
    }

    return filteredNavItems.find((item) => isActivePath(item.path))?.label ?? "Diam'o"
  }, [filteredNavItems, isActivePath, location.pathname])

  const kioskName = profile?.kiosques?.nom

  const sidebar = (
    <aside className="flex h-full w-[var(--sidebar-width)] shrink-0 flex-col border-r border-border bg-surface">
      <Logo />
      <nav className="flex-1 overflow-y-auto p-2">
        {Object.entries(groupedNavItems).map(([section, items]) => (
          <div key={section} className="mb-3">
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
              {section}
            </p>
            <div className="space-y-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    'nav-item flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-xs font-medium text-text transition-colors lg:min-h-9',
                    isActivePath(item.path)
                      ? 'nav-item active bg-blue-light text-blue'
                      : 'hover:bg-muted hover:text-blue'
                  )}
                  onClick={() => handleNavigation(item.path)}
                >
                  <span className="relative flex w-5 items-center justify-center">
                    {item.icon}
                    {item.id === 'logs' && techErrorCount > 0 && (
                      <span
                        className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 text-xs font-bold text-white [font-variant-numeric:tabular-nums]"
                        aria-label={`${techErrorCount} erreurs techniques`}
                      >
                        {techErrorCount > 99 ? '99+' : techErrorCount}
                      </span>
                    )}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {profile && role && (
        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold', roleClasses[role])}>
              {profile.username?.slice(0, 2).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-text">{profile.username}</p>
              <p className="truncate text-xs text-text-tertiary">{roleLabels[role]}</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={handleLogout} aria-label="Déconnexion">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      )}
    </aside>
  )

  return (
    // 100dvh = visible height on mobile (100vh includes the URL bar and would
    // push the bottom tab bar below the fold).
    <div className="flex h-[100vh] overflow-hidden bg-bg text-text supports-[height:100dvh]:h-[100dvh]">
      <div className="hidden lg:block">{sidebar}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="Fermer le menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[var(--sidebar-width)] max-w-[86vw] shadow-xl">
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[var(--topbar-height)] shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            // Fontainiers navigate with the bottom tab bar on mobile.
            className={cn('lg:hidden', isFontainier && 'hidden')}
            onClick={() => setMobileOpen((current) => !current)}
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text">{pageTitle}</p>
            {kioskName && <p className="truncate text-xs text-text-tertiary">{kioskName}</p>}
          </div>
          {role && (
            <span className={cn('hidden rounded-full px-2 py-0.5 text-xs font-semibold sm:inline-flex', roleClasses[role])}>
              {roleLabels[role]}
            </span>
          )}
          {/* Profil + déconnexion lived in the ☰ menu, which fontainiers no
              longer have on mobile. */}
          {isFontainier && (
            <div className="flex items-center gap-1 lg:hidden">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => handleNavigation('/profil')}
                aria-label="Mon profil"
                className={cn(isActivePath('/profil') && 'text-blue')}
              >
                <User className="h-5 w-5" />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" onClick={handleLogout} aria-label="Déconnexion">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          )}
        </header>

        {/* The ONE offline banner of the app, under the header. */}
        {!isOnline && (
          <div
            role="status"
            className="flex min-h-10 shrink-0 items-center justify-center gap-2 bg-red px-3 py-2 text-center text-sm font-semibold text-white"
          >
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Vous êtes hors ligne
              {pendingCount > 0 && ` · ${pendingCount} vente${pendingCount > 1 ? 's' : ''} en attente`}
            </span>
          </div>
        )}

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        <main className="min-h-0 flex-1 overflow-auto bg-bg p-3 sm:p-4">
          <div key={location.pathname} className="page-in mx-auto w-full max-w-[1200px]">
            {children}
          </div>
        </main>

        {isFontainier && (
          <nav
            aria-label="Navigation principale"
            className="shrink-0 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
          >
            <ul className="grid h-16 grid-cols-3">
              {fontainierTabs.map(({ id, label, Icon, path }) => {
                const active = isActivePath(path)
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => handleNavigation(path)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors',
                        active ? 'text-blue' : 'text-text-tertiary'
                      )}
                    >
                      <Icon
                        className="h-6 w-6"
                        strokeWidth={active ? 2.5 : 2}
                        fill={active ? 'currentColor' : 'none'}
                        fillOpacity={active ? 0.15 : 0}
                        aria-hidden="true"
                      />
                      {label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        )}
      </div>
    </div>
  )
}
