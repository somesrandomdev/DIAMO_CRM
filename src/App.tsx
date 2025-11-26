import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import Login from './pages/Login'
import Layout from './components/Layout'
import FontainierDashboard from './pages/FontainierDashboard'
import CommercialDashboard from './pages/CommercialDashboard'
import AdminDashboardEnhanced from './pages/AdminDashboardEnhanced'
import VenteUltraSimple from './pages/VenteUltraSimple'
import ClientListUltra from './pages/ClientListUltra'
import CommercialStatsUltra from './pages/CommercialStatsUltra'
import HistoriquePage from './pages/HistoriquePage'
import ProfilePage from './pages/ProfilePage'

/* Diam'o Franchise Management System - Modern UI */
export default function App() {
  const { profile, loadProfile } = useAuthStore()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)

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
        }
      }
    }

    initializeAuth()

    return () => {
      isMounted = false
    }
  }, []) // Remove loadProfile dependency to prevent infinite loops

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return <Login />
  }

  const handleBackNavigation = () => {
    navigate('/dashboard', { replace: true })
  }

  return (
    <Layout>
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
        <Route path="/profil" element={<ProfilePage onBack={handleBackNavigation} />} />

        {/* Legacy Routes for Compatibility */}
        <Route path="/stats" element={<Navigate to="/mes-ventes" replace />} />
        <Route path="/admin" element={<Navigate to="/vue-globale" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  )
}