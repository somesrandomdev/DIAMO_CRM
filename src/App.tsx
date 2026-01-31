import { useEffect, useState, Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import { Loading } from './components/Loading'
import Layout from './components/Layout'

// Lazy load pages for better performance
const Login = lazy(() => import('./pages/Login'))
const FontainierDashboard = lazy(() => import('./pages/FontainierDashboard'))
const CommercialDashboard = lazy(() => import('./pages/CommercialDashboard'))
const AdminDashboardEnhanced = lazy(() => import('./pages/AdminDashboardEnhanced'))
const VenteUltraSimple = lazy(() => import('./pages/VenteUltraSimple'))
const ClientListUltra = lazy(() => import('./pages/ClientListUltra'))
const CommercialStatsUltra = lazy(() => import('./pages/CommercialStatsUltra'))
const HistoriquePage = lazy(() => import('./pages/HistoriquePage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))

// Loading component for lazy loaded routes
function PageLoader() {
  return <Loading size="lg" text="Chargement..." fullScreen />
}

// Error fallback component
function ErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold mb-2">Une erreur est survenue</h2>
        <p className="text-gray-600 mb-4">Veuillez rafraîchir la page</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          Rafraîchir
        </button>
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
        </ToastProvider>
      </ErrorBoundary>
    )
  }

  const handleBackNavigation = () => {
    navigate('/dashboard', { replace: true })
  }

  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <ToastProvider>
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={
                profile?.role === 'fontainier' ? <FontainierDashboard /> :
                profile?.role === 'commercial' ? <CommercialDashboard /> :
                profile?.role === 'administrateur' ? <Navigate to="/vue-globale" replace /> :
                <Navigate to="/login" replace />
              } />
              
              {/* Fontainier Routes */}
              <Route path="/nouvelle-vente" element={
                profile?.role === 'fontainier' ? <VenteUltraSimple onBack={handleBackNavigation} /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="/mes-clients" element={
                profile?.role === 'fontainier' ? <ClientListUltra onBack={handleBackNavigation} /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="/mes-ventes" element={
                profile?.role === 'fontainier' ? <CommercialStatsUltra onBack={handleBackNavigation} /> : <Navigate to="/dashboard" replace />
              } />

              {/* Commercial Routes */}
              <Route path="/ventes" element={
                profile?.role === 'commercial' ? <VenteUltraSimple onBack={handleBackNavigation} /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="/clients" element={
                profile?.role === 'commercial' ? <ClientListUltra onBack={handleBackNavigation} /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="/analytics" element={
                profile?.role === 'commercial' ? <CommercialStatsUltra onBack={handleBackNavigation} /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="/historique" element={
                profile?.role === 'commercial' ? <HistoriquePage onBack={handleBackNavigation} /> : <Navigate to="/dashboard" replace />
              } />

              {/* Administrator Routes */}
              <Route path="/vue-globale" element={
                profile?.role === 'administrateur' ? <AdminDashboardEnhanced /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="/kiosques" element={
                profile?.role === 'administrateur' ? <AdminDashboardEnhanced /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="/offres" element={
                profile?.role === 'administrateur' ? <AdminDashboardEnhanced /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="/tarifs" element={
                profile?.role === 'administrateur' ? <AdminDashboardEnhanced /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="/utilisateurs" element={
                profile?.role === 'administrateur' ? <AdminDashboardEnhanced /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="/objectifs" element={
                profile?.role === 'administrateur' ? <AdminDashboardEnhanced /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="/donnees-globales" element={
                profile?.role === 'administrateur' ? <AdminDashboardEnhanced /> : <Navigate to="/dashboard" replace />
              } />

              {/* Shared Routes */}
              <Route path="/profil" element={<ProfilePage />} />

              {/* Legacy Routes for Compatibility */}
              <Route path="/stats" element={<Navigate to="/mes-ventes" replace />} />
              <Route path="/admin" element={<Navigate to="/vue-globale" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </ToastProvider>
    </ErrorBoundary>
  )
}