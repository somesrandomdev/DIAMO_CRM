import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { toCFA } from '../utils/price'
import { FaShoppingCart, FaUsers, FaChartBar, FaTrophy } from 'react-icons/fa'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'

interface DashboardStats {
  totalSales: number
  totalVolume: number
  activeClients: number
  todaySales: number
  avgSale: number
  salesGrowth: number
  topOffer: string
  newClientsToday: number
  monthlyObjective: number
  dailyObjective: number
  monthlyProgress: number
  dailyProgress: number
  recommendations: string[]
}

interface RecentSale {
  id: string
  created_at: string
  montant_total: number
  client: { nom: string } | null
  offre: { nom: string } | null
}

interface ChartData {
  date: string
  sales: number
  volume: number
}

interface CustomerSegment {
  name: string
  value: number
  color: string
}

export default function CommercialDashboard() {
  const { profile } = useAuthStore()
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalVolume: 0,
    activeClients: 0,
    todaySales: 0,
    avgSale: 0,
    salesGrowth: 0,
    topOffer: '',
    newClientsToday: 0,
    monthlyObjective: 500000, // 500,000 CFA monthly objective
    dailyObjective: 25000, // 25,000 CFA daily objective
    monthlyProgress: 0,
    dailyProgress: 0,
    recommendations: []
  })
  const [recentSales, setRecentSales] = useState<RecentSale[]>([])
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [customerSegments, setCustomerSegments] = useState<CustomerSegment[]>([])
  const [monthlyData, setMonthlyData] = useState<any[]>([])

  useEffect(() => {
    if (!profile?.kiosque_id) {
      console.log('No kiosk_id available for commercial dashboard')
      return
    }
    loadDashboardData()
  }, [profile])

  async function loadDashboardData() {
    const kId = profile!.kiosque_id

    // Load all data in parallel
    const [
      { data: salesData },
      { data: clientsData },
      { data: todaySalesData },
      { data: recentSalesData },
      { data: chartDataRaw },
      { data: monthlyRaw },
      { data: offerData },
      { data: customerData }
    ] = await Promise.all([
      supabase.from('ventes').select('montant_total').eq('kiosque_id', kId),
      supabase.from('clients').select('id').eq('kiosque_id', kId),
      supabase.from('ventes').select('montant_total').eq('kiosque_id', kId).gte('created_at', new Date().toISOString().split('T')[0]),
      supabase.from('ventes').select('id, created_at, montant_total, client:clients(nom), offre:offres(nom)').eq('kiosque_id', kId).order('created_at', { ascending: false }).limit(5),
      supabase.from('ventes').select('created_at, montant_total').eq('kiosque_id', kId).order('created_at', { ascending: false }).limit(30),
      supabase.from('ventes').select('created_at, montant_total').eq('kiosque_id', kId),
      supabase.from('ventes').select('offre:offres!inner(nom), montant_total').eq('kiosque_id', kId),
      supabase.from('ventes').select('client:clients(nom), montant_total').eq('kiosque_id', kId)
    ])

    // Calculate basic stats
    const totalSales = salesData?.reduce((sum, sale) => sum + sale.montant_total, 0) || 0
    const todaySales = todaySalesData?.reduce((sum, sale) => sum + sale.montant_total, 0) || 0
    const activeClients = clientsData?.length || 0
    const totalVolume = salesData?.length || 0
    const avgSale = totalVolume > 0 ? totalSales / totalVolume : 0

    // Calculate sales growth (last 7 days vs previous 7 days)
    const last7Days = chartDataRaw?.slice(0, 7) || []
    const previous7Days = chartDataRaw?.slice(7, 14) || []
    const lastWeekSales = last7Days.reduce((sum, sale) => sum + sale.montant_total, 0)
    const previousWeekSales = previous7Days.reduce((sum, sale) => sum + sale.montant_total, 0)
    const salesGrowth = previousWeekSales > 0 ? ((lastWeekSales - previousWeekSales) / previousWeekSales) * 100 : 0

    // Get top offer
    const offerMap: Record<string, number> = {}
    offerData?.forEach(v => {
      const o = (v.offre as any)?.nom || ''
      offerMap[o] = (offerMap[o] || 0) + v.montant_total
    })
    const topOffer = Object.entries(offerMap).sort(([,a], [,b]) => b - a)[0]?.[0] || ''

    // Get new clients today
    const today = new Date().toISOString().split('T')[0]
    const { count: newClientsToday } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('kiosque_id', kId)
      .gte('created_at', today)

    // Calculate objectives and recommendations
    const monthlyProgress = (totalSales / stats.monthlyObjective) * 100
    const dailyProgress = (todaySales / stats.dailyObjective) * 100

    const recommendations = []
    if (dailyProgress < 50) {
      recommendations.push("Augmentez vos ventes aujourd'hui pour atteindre l'objectif journalier")
    } else if (dailyProgress >= 100) {
      recommendations.push("🎉 Objectif journalier atteint ! Continuez sur cette lancée")
    }

    if (monthlyProgress < 75) {
      recommendations.push("Intensifiez vos efforts pour atteindre l'objectif mensuel")
    } else if (monthlyProgress >= 100) {
      recommendations.push("🌟 Objectif mensuel dépassé ! Excellent travail")
    }

    if (salesGrowth < 0) {
      recommendations.push("Les ventes sont en baisse, concentrez-vous sur vos meilleurs clients")
    } else if (salesGrowth > 10) {
      recommendations.push("Excellente croissance ! Maintenez cette dynamique")
    }

    setStats({
      totalSales,
      totalVolume,
      activeClients,
      todaySales,
      avgSale,
      salesGrowth,
      topOffer,
      newClientsToday: newClientsToday || 0,
      monthlyObjective: stats.monthlyObjective,
      dailyObjective: stats.dailyObjective,
      monthlyProgress,
      dailyProgress,
      recommendations
    })

    // Transform recent sales
    const transformedSales = (recentSalesData || []).map(sale => ({
      ...sale,
      client: Array.isArray(sale.client) ? sale.client[0] || null : sale.client,
      offre: Array.isArray(sale.offre) ? sale.offre[0] || null : sale.offre
    }))
    setRecentSales(transformedSales)

    // Process chart data (last 7 days)
    const last7DaysDates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - i)
      return date.toISOString().split('T')[0]
    }).reverse()

    const processedChartData = last7DaysDates.map(date => {
      const daySales = chartDataRaw?.filter(sale => sale.created_at.startsWith(date)) || []
      const total = daySales.reduce((sum, sale) => sum + sale.montant_total, 0)
      return {
        date: new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', month: 'short', day: 'numeric' }),
        sales: total,
        volume: daySales.length
      }
    })
    setChartData(processedChartData)

    // Process monthly data
    const monthMap: Record<string, number> = {}
    monthlyRaw?.forEach(v => {
      const m = v.created_at.substring(0, 7) // YYYY-MM
      monthMap[m] = (monthMap[m] || 0) + v.montant_total
    })
    setMonthlyData(Object.entries(monthMap).map(([name, value]) => ({ name, value })))


    // Process customer segments
    const customerMap: Record<string, number> = {}
    customerData?.forEach(v => {
      const c = (v.client as any)?.nom || ''
      customerMap[c] = (customerMap[c] || 0) + v.montant_total
    })

    const segments = [
      { name: 'VIP (5000+ CFA)', value: Object.values(customerMap).filter(amount => amount >= 5000).length, color: '#FF6B6B' },
      { name: 'Régulier (2000-4999 CFA)', value: Object.values(customerMap).filter(amount => amount >= 2000 && amount < 5000).length, color: '#4ECDC4' },
      { name: 'Occasionnel (<2000 CFA)', value: Object.values(customerMap).filter(amount => amount < 2000).length, color: '#45B7D1' }
    ]
    setCustomerSegments(segments.filter(s => s.value > 0))
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>Tableau de bord Commercial</h1>
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      </div>

      {/* Objectives KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>🎯 Objectif Mensuel</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-primary)' }}>{toCFA(stats.monthlyObjective)}</p>
              <p className="text-xs mt-1" style={{ color: stats.monthlyProgress >= 100 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                {stats.monthlyProgress.toFixed(1)}% atteint
              </p>
            </div>
            <div className="p-3 rounded-full" style={{ backgroundColor: 'var(--color-primary-light)' }}>
              <FaTrophy className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
            </div>
          </div>
        </div>

        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>📅 Objectif Journalier</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-accent)' }}>{toCFA(stats.dailyObjective)}</p>
              <p className="text-xs mt-1" style={{ color: stats.dailyProgress >= 100 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                {stats.dailyProgress.toFixed(1)}% atteint
              </p>
            </div>
            <div className="p-3 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }}>
              <FaChartBar className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>📊 Performance Mensuelle</p>
              <p className="text-2xl font-bold mt-1" style={{ color: stats.monthlyProgress >= 100 ? 'var(--color-success)' : 'var(--color-primary)' }}>
                {stats.monthlyProgress.toFixed(1)}%
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(stats.monthlyProgress, 100)}%`,
                    backgroundColor: stats.monthlyProgress >= 100 ? 'var(--color-success)' : 'var(--color-primary)'
                  }}
                ></div>
              </div>
            </div>
            <div className="p-3 rounded-full" style={{ backgroundColor: stats.monthlyProgress >= 100 ? 'var(--color-success-light)' : 'var(--color-primary-light)' }}>
              {stats.monthlyProgress >= 100 ? <FaTrophy className="w-6 h-6" style={{ color: 'var(--color-success)' }} /> : <FaChartBar className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />}
            </div>
          </div>
        </div>

        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-all duration-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>📈 Performance Aujourd'hui</p>
              <p className="text-2xl font-bold mt-1" style={{ color: stats.dailyProgress >= 100 ? 'var(--color-success)' : 'var(--color-accent)' }}>
                {stats.dailyProgress.toFixed(1)}%
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(stats.dailyProgress, 100)}%`,
                    backgroundColor: stats.dailyProgress >= 100 ? 'var(--color-success)' : 'var(--color-accent)'
                  }}
                ></div>
              </div>
            </div>
            <div className="p-3 rounded-full" style={{ backgroundColor: stats.dailyProgress >= 100 ? 'var(--color-success-light)' : 'var(--color-accent)' }}>
              {stats.dailyProgress >= 100 ? <FaTrophy className="w-6 h-6" style={{ color: 'var(--color-success)' }} /> : <FaChartBar className="w-6 h-6 text-white" />}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations Section */}
      {stats.recommendations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-3 text-blue-800 flex items-center gap-2">
            💡 Recommandations pour atteindre vos objectifs
          </h3>
          <div className="space-y-2">
            {stats.recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <p className="text-blue-700">{recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced KPI Cards */}
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
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>🎯 Panier Moyen</p>
              <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-accent)' }}>{toCFA(stats.avgSale)}</p>
            </div>
            <div className="p-3 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }}>
              <FaTrophy className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-surface p-4 rounded-lg shadow-sm border text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="text-lg font-bold mb-1" style={{ color: 'var(--color-primary)' }}>{stats.newClientsToday}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>🆕 Nouveaux clients (aujourd'hui)</p>
        </div>
        <div className="bg-surface p-4 rounded-lg shadow-sm border text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="text-lg font-bold mb-1" style={{ color: stats.salesGrowth >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
            {stats.salesGrowth >= 0 ? '+' : ''}{stats.salesGrowth.toFixed(1)}%
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>📈 Croissance (7 jours)</p>
        </div>
        <div className="bg-surface p-4 rounded-lg shadow-sm border text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="text-lg font-bold mb-1" style={{ color: 'var(--color-accent)' }}>{stats.topOffer || 'N/A'}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>🏆 Offre la plus populaire</p>
        </div>
        <div className="bg-surface p-4 rounded-lg shadow-sm border text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="text-lg font-bold mb-1" style={{ color: 'var(--color-primary)' }}>{stats.totalVolume}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>💧 Volume Total</p>
        </div>
      </div>

      {/* Advanced Analytics Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        {/* Sales Trend Chart */}
        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
          <h3 className="text-lg font-bold mb-4 border-b border-border pb-2" style={{ color: 'var(--color-text)' }}>📊 Évolution des ventes (7 derniers jours)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" />
              <YAxis tickFormatter={toCFA} />
              <Tooltip formatter={(value) => [toCFA(value as number), 'CA']} />
              <Line type="monotone" dataKey="sales" stroke="var(--color-primary)" strokeWidth={3} />
            </LineChart>
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

      {/* Monthly Performance and Customer Analysis */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        {/* Monthly CA Chart */}
        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
          <h3 className="text-lg font-bold mb-4 border-b border-border pb-2" style={{ color: 'var(--color-text)' }}>📈 CA par mois</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <XAxis dataKey="name" />
              <YAxis tickFormatter={toCFA} />
              <Tooltip formatter={(value) => [toCFA(value as number), 'CA']} />
              <Bar dataKey="value" fill="var(--color-primary)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Segments */}
        <div className="bg-surface p-6 rounded-lg shadow-sm border border-border hover:shadow-md transition-shadow">
          <h3 className="text-lg font-bold mb-4 border-b border-border pb-2" style={{ color: 'var(--color-text)' }}>👥 Segmentation Clients</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={customerSegments}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {customerSegments.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value, 'Clients']} />
            </PieChart>
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
}