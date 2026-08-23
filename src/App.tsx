import { useEffect, useState, Suspense, lazy, useCallback } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt'
import { ToastProvider } from '@/components/Toast'
import { Loading } from '@/components/Loading'
import Layout from '@/components/Layout'
import { RoleGuard } from '@/components/layout/RoleGuard'
import { Button } from '@/components/ui/button'
import { getRoleHome } from '@/utils/roleRoutes'
import { AlertTriangle } from 'lucide-react'

// Lazy load pages for better performance
const Login = lazy(() => import('@/pages/Login'))
const CommercialDashboard = lazy(() => import('@/pages/CommercialDashboard'))
const AdminDashboardProfessional = lazy(() => import('@/pages/AdminDashboardProfessional'))
const AdminKiosquesPage = lazy(() => import('@/pages/AdminKiosquesPage'))
const AdminOffresPage = lazy(() => import('@/pages/AdminOffresPage'))
const AdminObjectivesPage = lazy(() => import('@/pages/AdminObjectivesPage'))
const AdminTarifsPage = lazy(() => import('@/pages/AdminTarifsPage'))
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'))
const ClientsByKiosk = lazy(() => import('@/pages/admin/ClientsByKiosk'))
const KiosqueDetailPage = lazy(() => import('@/pages/KiosqueDetailPage'))
const RapportsPage = lazy(() => import('@/pages/RapportsPage'))
const VenteUltraSimple = lazy(() => import('@/pages/VenteUltraSimple'))
const ClientListUltra = lazy(() => import('@/pages/ClientListUltra'))
const HistoriquePage = lazy(() => import('@/pages/HistoriquePage'))
const ProfilePage = lazy(() => import('@/pages/ProfilePage'))
const UnauthorizedPage = lazy(() => import('@/pages/UnauthorizedPage'))

// Loading component for lazy loaded routes
function PageLoader() {
  return <Loading size="lg" text="Chargement..." fullScreen />
}

// Error fallback component
function ErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Une erreur est survenue</h2>
        <p className="text-muted-foreground mb-4">Veuillez rafraîchir la page</p>
        <Button variant="primary" onClick={() => window.location.reload()}>Rafraîchir</Button>
      </div>
    </div>
  )
}

/* Diam'o Franchise Management System - Modern UI */
export default function App() {
  const { profile, loadProfile } = useAuthStore()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    let isMounted = true

    const initializeAuth = async () => {
      try {
        await loadProfile()
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        if (isMounted) {
          setIsLoading(false)
          setHasMounted(true)
        }
      }
    }

    initializeAuth()

    return () => {
      isMounted = false
    }
  }, [loadProfile])

  const handleBackNavigation = useCallback(() => {
    navigate(getRoleHome(profile?.role), { replace: true })
  }, [navigate, profile?.role])

  // Show loading state during initial load
  if (isLoading || !hasMounted) {
    return <PageLoader />
  }

  // Redirect to login if no profile
  if (!profile) {
    return (
      <ErrorBoundary fallback={<ErrorFallback />}>
        <ToastProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
          <PWAUpdatePrompt />
        </ToastProvider>
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <ToastProvider>
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to={getRoleHome(profile.role)} replace />} />
              <Route path="/dashboard" element={<Navigate to={getRoleHome(profile.role)} replace />} />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              <Route
                element={
                  <RoleGuard allowedRoles={['fontainier', 'commercial', 'administrateur']} />
                }
              >
                <Route path="/ventes/nouvelle" element={<VenteUltraSimple onBack={handleBackNavigation} />} />
                <Route path="/ventes/historique" element={<HistoriquePage onBack={handleBackNavigation} />} />
                <Route path="/clients" element={<ClientListUltra onBack={handleBackNavigation} />} />
              </Route>

              <Route element={<RoleGuard allowedRoles={['commercial']} />}>
                <Route path="/commercial" element={<CommercialDashboard />} />
              </Route>

              <Route element={<RoleGuard allowedRoles={['administrateur']} />}>
                <Route path="/admin/dashboard" element={<AdminDashboardProfessional />} />
                <Route path="/admin/kiosques/:id" element={<KiosqueDetailPage />} />
                <Route path="/admin/kiosques" element={<AdminKiosquesPage />} />
                <Route path="/admin/offres" element={<AdminOffresPage />} />
                <Route path="/admin/tarifs" element={<AdminTarifsPage />} />
                <Route path="/admin/objectifs" element={<AdminObjectivesPage />} />
                <Route path="/admin/utilisateurs" element={<AdminUsersPage />} />
                <Route path="/admin/clients-par-kiosque" element={<ClientsByKiosk />} />
                <Route path="/admin/rapports" element={<RapportsPage />} />
              </Route>

              {/* Shared Routes */}
              <Route path="/profil" element={<ProfilePage />} />

              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="*" element={<Navigate to={getRoleHome(profile.role)} replace />} />
            </Routes>
          </Suspense>
        </Layout>
        <PWAUpdatePrompt />
      </ToastProvider>
    </ErrorBoundary>
  )
}
