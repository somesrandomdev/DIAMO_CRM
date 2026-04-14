import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { toCFA } from '../utils/price'
import { FaShoppingCart, FaUsers, FaChartBar, FaWater, FaPlus } from 'react-icons/fa'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { DashboardStats, RecentSale, ChartData } from '../types/dashboard'

interface FontainierStats {
  totalSales: number
  totalRevenue: number
  todaySales: number
  todayRevenue: number
  recentSales: Array<{
    id: string
    montant_total: number
    created_at: string
    client_nom?: string
  }>
}

export default function Dashboard() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalVolume: 0,
    activeClients: 0,
    todaySales: 0
  })
  const [fontainierStats, setFontainierStats] = useState<FontainierStats>({
    totalSales: 0,
    totalRevenue: 0,
    todaySales: 0,
    todayRevenue: 0,
    recentSales: []
  })
  const [recentSales, setRecentSales] = useState<RecentSale[]>([])
  const [chartData, setChartData] = useState<ChartData[]>([])

  useEffect(() => {
    // Redirect admin to admin dashboard
    if (profile?.role === 'administrateur') {
      navigate('/admin')
      return
    }

    // For fontainier and commercial, check kiosk access
    if (!profile?.kiosque_id) {
      console.log('No kiosk_id available for dashboard')
      return
    }

    if (profile?.role === 'fontainier') {
      loadFontainierData()
    } else if (profile?.role === 'commercial') {
      loadDashboardData()
    }
  }, [profile, navigate])

  async function loadDashboardData() {
    const isAdmin = profile?.role === 'administrateur'
    const kId = profile!.kiosque_id

    // Load statistics - for admin, get data from all kiosks
    let salesQuery = supabase.from('ventes').select('montant_total')
    let clientsQuery = supabase.from('clients').select('id')
    let todaySalesQuery = supabase.from('ventes').select('montant_total').gte('created_at', new Date().toISOString().split('T')[0])
    let recentSalesQuery = supabase.from('ventes').select('id, created_at, montant_total, client:clients(nom), offre:offres(nom)').order('created_at', { ascending: false }).limit(5)
    let chartDataQuery = supabase.from('ventes').select('created_at, montant_total').order('created_at', { ascending: false }).limit(30)

    // Apply kiosk filter for non-admin users
    if (!isAdmin) {
      salesQuery = salesQuery.eq('kiosque_id', kId)
      clientsQuery = clientsQuery.eq('kiosque_id', kId)
      todaySalesQuery = todaySalesQuery.eq('kiosque_id', kId)
      recentSalesQuery = recentSalesQuery.eq('kiosque_id', kId)
      chartDataQuery = chartDataQuery.eq('kiosque_id', kId)
    }

    const [
      { data: salesData },
      { data: clientsData },
      { data: todaySalesData },
      { data: recentSalesData },
      { data: chartDataRaw }
    ] = await Promise.all([
      salesQuery,
      clientsQuery,
      todaySalesQuery,
      recentSalesQuery,
      chartDataQuery
    ])

    // Calculate stats
    const totalSales = salesData?.reduce((sum, sale) => sum + sale.montant_total, 0) || 0
    const todaySales = todaySalesData?.reduce((sum, sale) => sum + sale.montant_total, 0) || 0
    const activeClients = clientsData?.length || 0

    setStats({
      totalSales,
      totalVolume: 0, // We'll calculate this based on offers
      activeClients,
      todaySales
    })

    // Transform the data to match our interface
    const transformedSales = (recentSalesData || []).map(sale => ({
      ...sale,
      client: Array.isArray(sale.client) ? sale.client[0] || null : sale.client,
      offre: Array.isArray(sale.offre) ? sale.offre[0] || null : sale.offre
    }))

    setRecentSales(transformedSales)

    // Process chart data (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - i)
      return date.toISOString().split('T')[0]
    }).reverse()

    const chartDataProcessed = last7Days.map(date => {
      const daySales = chartDataRaw?.filter(sale => sale.created_at.startsWith(date)) || []
      const total = daySales.reduce((sum, sale) => sum + sale.montant_total, 0)
      return {
        date: new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', month: 'short', day: 'numeric' }),
        sales: total,
        volume: daySales.length
      }
    })

    setChartData(chartDataProcessed)
  }

  async function loadFontainierData() {
    if (!profile?.id) return

    try {
      const today = new Date().toISOString().split('T')[0]

      // Get total sales and revenue for this fontainier
      const { data: allSales, error: salesError } = await supabase
        .from('ventes')
        .select('id, montant_total, created_at, clients(nom)')
        .eq('fontainier_id', profile.id)

      if (salesError) throw salesError

      // Calculate totals
      const totalRevenue = allSales?.reduce((sum, sale) => sum + sale.montant_total, 0) || 0
      const totalSales = allSales?.length || 0

      // Calculate today's sales
      const todaySales = allSales?.filter(sale => sale.created_at.startsWith(today)) || []
      const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.montant_total, 0)
      const todaySalesCount = todaySales.length

      // Get recent sales (last 5)
      const recentSales = allSales
        ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        ?.slice(0, 5)
        ?.map(sale => ({
          id: sale.id || '',
          montant_total: sale.montant_total,
          created_at: sale.created_at,
          client_nom: (sale.clients as any)?.nom || 'Client anonyme'
        })) || []

      setFontainierStats({
        totalSales,
        totalRevenue,
        todaySales: todaySalesCount,
        todayRevenue,
        recentSales
      })
    } catch (error) {
      console.error('Error loading fontainier stats:', error)
    }
  }

  // Fontainier Dashboard Component
  const FontainierDashboard = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 relative">
      {/* Logout button */}
      <button
        onClick={() => useAuthStore.getState().signOut()}
        className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 font-medium"
      >
        Déconnexion
      </button>

      <h1 className="text-4xl mb-10">Tableau de bord</h1>

      {/* Personal Stats Summary */}
      <div className="w-full max-w-sm mb-8">
        <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{fontainierStats.totalSales}</p>
              <p className="text-sm text-gray-600">Ventes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{toCFA(fontainierStats.totalRevenue)}</p>
              <p className="text-sm text-gray-600">CA Total</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 w-full max-w-sm">
        <button
          onClick={() => navigate('/ventes')}
          className="w-full bg-green-600 hover:bg-green-700 text-white text-xl sm:text-2xl py-6 sm:py-8 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center gap-2 font-semibold"
        >
          <FaPlus className="text-2xl sm:text-3xl" />
          Nouvelle vente
        </button>
        <button
          onClick={() => navigate('/clients')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xl sm:text-2xl py-6 sm:py-8 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center gap-2 font-semibold"
        >
          <FaUsers className="text-2xl sm:text-3xl" />
          Mes clients
        </button>
        <button
          onClick={() => navigate('/stats')}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xl sm:text-2xl py-6 sm:py-8 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center gap-2 font-semibold"
        >
          <FaChartBar className="text-2xl sm:text-3xl" />
          Mes statistiques
        </button>
      </div>
    </div>
  )

  // Commercial Dashboard Component
  const CommercialDashboard = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Tableau de bord</h1>
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>💰 CA Total</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>{toCFA(stats.totalSales)}</p>
            </div>
            <div className="p-3 rounded-full" style={{ backgroundColor: 'var(--color-primary-light)' }}>
              <FaShoppingCart className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
            </div>
          </div>
        </div>

        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>📈 Ventes Aujourd'hui</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-success)' }}>{toCFA(stats.todaySales)}</p>
            </div>
            <div className="p-3 rounded-full" style={{ backgroundColor: 'var(--color-success-light)' }}>
              <FaChartBar className="w-6 h-6" style={{ color: 'var(--color-success)' }} />
            </div>
          </div>
        </div>

        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>👥 Clients Actifs</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>{stats.activeClients}</p>
            </div>
            <div className="p-3 rounded-full" style={{ backgroundColor: 'var(--color-secondary-light)' }}>
              <FaUsers className="w-6 h-6" style={{ color: 'var(--color-secondary)' }} />
            </div>
          </div>
        </div>

        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>💧 Volume Aujourd'hui</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-accent)' }}>{chartData[chartData.length - 1]?.volume || 0}</p>
            </div>
            <div className="p-3 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }}>
              <FaWater className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        {/* Sales Chart */}
        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
          <h3 className="text-lg font-bold mb-4 border-b border-border pb-2" style={{ color: 'var(--color-text)' }}>📊 Chiffre d'Affaires (7 derniers jours)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <XAxis dataKey="date" />
              <YAxis tickFormatter={toCFA} />
              <Tooltip formatter={(value) => [toCFA(value as number), 'CA']} />
              <Bar dataKey="sales" fill="var(--color-primary)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Volume Chart */}
        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
          <h3 className="text-lg font-bold mb-4 border-b border-border pb-2" style={{ color: 'var(--color-text)' }}>📊 Volume des ventes (7 derniers jours)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [value, 'Ventes']} />
              <Bar dataKey="volume" fill="var(--color-secondary)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="bg-surface p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
        <h3 className="text-lg font-bold mb-4 border-b border-border pb-2" style={{ color: 'var(--color-text)' }}>🛒 Dernières ventes</h3>
        {recentSales.length > 0 ? (
          <div className="space-y-3">
            {recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-surface-hover hover:shadow-sm transition-all" style={{ backgroundColor: 'var(--color-surface-hover)' }}>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{sale.client?.nom || 'Client inconnu'}</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{sale.offre?.nom || 'Offre inconnue'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg" style={{ color: 'var(--color-primary)' }}>{toCFA(sale.montant_total)}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(sale.created_at).toLocaleDateString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>Aucune vente récente</p>
        )}
      </div>
    </div>
  )

  // Render based on user role
  if (profile?.role === 'fontainier') {
    return <FontainierDashboard />
  } else if (profile?.role === 'commercial') {
    return <CommercialDashboard />
  }

  // Default fallback
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement du tableau de bord...</p>
      </div>
    </div>
  )
}