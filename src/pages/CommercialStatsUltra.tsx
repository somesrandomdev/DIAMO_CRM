import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { BackButton, LogoutButton } from '../components/NavControls'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { toCFA } from '../utils/price'

interface ExtendedStats {
  clients: number
  ventes: number
  ca: number
  avgSale: number
  topOffer: string
  newClientsToday: number
  returningClients: number
  salesGrowth: number
  bestDay: string
  peakHour: string
}

export default function CommercialStatsUltra({ onBack }: { onBack: () => void }) {
  const { profile } = useAuthStore()
  const [stats, setStats] = useState<ExtendedStats>({
    clients: 0,
    ventes: 0,
    ca: 0,
    avgSale: 0,
    topOffer: '',
    newClientsToday: 0,
    returningClients: 0,
    salesGrowth: 0,
    bestDay: '',
    peakHour: ''
  })
  const [byMonth, setByMonth] = useState<any[]>([])
  const [byOffer, setByOffer] = useState<any[]>([])
  const [dailyTrend, setDailyTrend] = useState<any[]>([])
  const [customerSegments, setCustomerSegments] = useState<any[]>([])
  const [hourlySales, setHourlySales] = useState<any[]>([])

  // Time period filtering state
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month'>('month')

  useEffect(() => {
    // Allow access for admins and fontainiers even without kiosk_id
    if (!profile?.kiosque_id && profile?.role !== 'administrateur' && profile?.role !== 'fontainier') {
      console.log('No kiosk_id available and not admin or fontainier, redirecting to dashboard')
      onBack()
      return
    }
    if (profile) {
      loadStats()
    }
  }, [profile, onBack, timeFilter])

  async function loadStats() {
    const isAdmin = profile?.role === 'administrateur'
    const kId = profile!.kiosque_id

    // Calculate date range based on time filter
    const now = new Date()
    let startDate: Date

    switch (timeFilter) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - now.getDay())
        startDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate())
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    // Basic counts - for admin, get data from all kiosks
    let clientsQuery = supabase.from('clients').select('*', { count: 'exact', head: true })
    let ventesQuery = supabase.from('ventes').select('*', { count: 'exact', head: true })

    if (!isAdmin) {
      clientsQuery = clientsQuery.eq('kiosque_id', kId)
      ventesQuery = ventesQuery.eq('kiosque_id', kId)
    }

    const [{ count: clients }, { count: ventes }] = await Promise.all([
      clientsQuery,
      ventesQuery,
    ])

    // Revenue data
    let caQuery = supabase.from('ventes').select('montant_total').gte('created_at', startDate.toISOString())
    if (!isAdmin) {
      caQuery = caQuery.eq('kiosque_id', kId)
    }
    const { data: ca } = await caQuery
    const caSum = ca?.reduce((sum, v) => sum + v.montant_total, 0) || 0
    const ventesCount = ventes || 0
    const avgSale = ventesCount > 0 ? caSum / ventesCount : 0

    // Monthly data
    let monthlyQuery = supabase
      .from('ventes')
      .select('created_at, montant_total, client_id')
      .gte('created_at', startDate.toISOString())
    if (!isAdmin) {
      monthlyQuery = monthlyQuery.eq('kiosque_id', kId)
    }
    const { data: monthly } = await monthlyQuery
    const monthMap: Record<string, number> = {}
    monthly?.forEach(v => {
      const m = v.created_at.substring(0, 7) // YYYY-MM
      monthMap[m] = (monthMap[m] || 0) + v.montant_total
    })
    setByMonth(Object.entries(monthMap).map(([name, value]) => ({ name, value })))

    // Offer performance
    let offerQuery = supabase
      .from('ventes')
      .select('offre:offres!inner(nom), montant_total')
      .gte('created_at', startDate.toISOString())
    if (!isAdmin) {
      offerQuery = offerQuery.eq('kiosque_id', kId)
    }
    const { data: offerData } = await offerQuery
    const offerMap: Record<string, number> = {}
    offerData?.forEach(v => {
      const o = (v.offre as any)?.nom || ''
      offerMap[o] = (offerMap[o] || 0) + v.montant_total
    })
    const topOffer = Object.entries(offerMap).sort(([,a], [,b]) => b - a)[0]?.[0] || ''
    setByOffer(Object.entries(offerMap).map(([name, value]) => ({ name, value })))

    // Daily trend (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - i)
      return date.toISOString().split('T')[0]
    }).reverse()

    const dailyData = last7Days.map(date => {
      const daySales = monthly?.filter(sale => sale.created_at.startsWith(date)) || []
      const total = daySales.reduce((sum, sale) => sum + sale.montant_total, 0)
      return {
        date: new Date(date).toLocaleDateString('fr-FR', { weekday: 'short' }),
        sales: total,
        count: daySales.length
      }
    })
    setDailyTrend(dailyData)

    // Customer segments
    let customerQuery = supabase
      .from('ventes')
      .select('client:clients(nom), montant_total')
      .gte('created_at', startDate.toISOString())
    if (!isAdmin) {
      customerQuery = customerQuery.eq('kiosque_id', kId)
    }
    const { data: customerData } = await customerQuery

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

    // Hourly sales pattern
    let hourlyQuery = supabase
      .from('ventes')
      .select('created_at, montant_total')
      .gte('created_at', startDate.toISOString())
    if (!isAdmin) {
      hourlyQuery = hourlyQuery.eq('kiosque_id', kId)
    }
    const { data: hourlyData } = await hourlyQuery

    const hourMap: Record<number, number> = {}
    hourlyData?.forEach(v => {
      const hour = new Date(v.created_at).getHours()
      hourMap[hour] = (hourMap[hour] || 0) + v.montant_total
    })

    const hourlyChart = Object.entries(hourMap).map(([hour, amount]) => ({
      hour: `${hour}h`,
      amount
    })).sort((a, b) => parseInt(a.hour) - parseInt(b.hour))
    setHourlySales(hourlyChart)

    // New clients for the selected period
    let newClientsQuery = supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
    if (!isAdmin) {
      newClientsQuery = newClientsQuery.eq('kiosque_id', kId)
    }
    const { count: newClientsToday } = await newClientsQuery

    // Calculate best performing metrics
    const bestDay = [...dailyData].sort((a, b) => b.sales - a.sales)[0]?.date || ''
    const peakHour = [...hourlyChart].sort((a, b) => b.amount - a.amount)[0]?.hour || ''

    // Sales growth (comparing last 7 days with previous 7 days)
    const lastWeekSales = dailyData.slice(-7).reduce((sum, day) => sum + day.sales, 0)
    const previousWeekSales = dailyData.slice(-14, -7).reduce((sum, day) => sum + day.sales, 0)
    const salesGrowth = previousWeekSales > 0 ? ((lastWeekSales - previousWeekSales) / previousWeekSales) * 100 : 0

    // Active customers (customers who bought at least once this month)
    const currentMonth = new Date().toISOString().substring(0, 7) // YYYY-MM
    let monthlyWithClientsQuery = supabase
      .from('ventes')
      .select('client_id, created_at')
    if (!isAdmin) {
      monthlyWithClientsQuery = monthlyWithClientsQuery.eq('kiosque_id', kId)
    }
    const { data: monthlyWithClients } = await monthlyWithClientsQuery

    const activeClientsThisMonth = new Set(
      monthlyWithClients?.filter(sale => sale.created_at.startsWith(currentMonth))
        .map(sale => sale.client_id)
        .filter(Boolean)
    ).size

    setStats({
      clients: clients || 0,
      ventes: ventes || 0,
      ca: caSum,
      avgSale,
      topOffer,
      newClientsToday: newClientsToday || 0,
      returningClients: activeClientsThisMonth,
      salesGrowth,
      bestDay,
      peakHour
    })
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between mb-4">
        <BackButton onBack={onBack} />
        <LogoutButton />
      </div>

      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>📊 Analyses Détaillées</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>Insights complets sur vos performances commerciales</p>
      </div>

      {/* Time Period Filter */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Période d'analyse</h3>
        <div className="flex gap-4">
          <button
            onClick={() => setTimeFilter('day')}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              timeFilter === 'day'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setTimeFilter('week')}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              timeFilter === 'week'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Cette semaine
          </button>
          <button
            onClick={() => setTimeFilter('month')}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              timeFilter === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Ce mois
          </button>
        </div>
      </div>

      {/* Primary KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <div className="p-6 rounded-lg shadow-sm border text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="text-xs text-gray-500 mb-1">
            {timeFilter === 'day' ? "Aujourd'hui" : timeFilter === 'week' ? "Cette semaine" : "Ce mois"}
          </p>
          <p className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>{stats.clients}</p>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>👥 Total Clients</p>
        </div>
        <div className="p-6 rounded-lg shadow-sm border text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="text-xs text-gray-500 mb-1">
            {timeFilter === 'day' ? "Aujourd'hui" : timeFilter === 'week' ? "Cette semaine" : "Ce mois"}
          </p>
          <p className="text-2xl font-bold mb-1" style={{ color: 'var(--color-success)' }}>{stats.ventes}</p>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>📊 Total Ventes</p>
        </div>
        <div className="p-6 rounded-lg shadow-sm border text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="text-xs text-gray-500 mb-1">
            {timeFilter === 'day' ? "Aujourd'hui" : timeFilter === 'week' ? "Cette semaine" : "Ce mois"}
          </p>
          <p className="text-2xl font-bold mb-1" style={{ color: 'var(--color-primary)' }}>{toCFA(stats.ca)}</p>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>💰 Chiffre d'Affaires</p>
        </div>
        <div className="p-6 rounded-lg shadow-sm border text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="text-xs text-gray-500 mb-1">
            {timeFilter === 'day' ? "Aujourd'hui" : timeFilter === 'week' ? "Cette semaine" : "Ce mois"}
          </p>
          <p className="text-2xl font-bold mb-1" style={{ color: 'var(--color-accent)' }}>{toCFA(stats.avgSale)}</p>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>🎯 Panier Moyen</p>
        </div>
      </div>

      {/* Secondary KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <div className="p-4 rounded-lg shadow-sm border text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="text-lg font-bold mb-1" style={{ color: 'var(--color-primary)' }}>{stats.newClientsToday}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>🆕 Nouveaux clients (aujourd'hui)</p>
        </div>
        <div className="p-4 rounded-lg shadow-sm border text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="text-lg font-bold mb-1" style={{ color: 'var(--color-success)' }}>{stats.returningClients}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>🔄 Clients actifs</p>
        </div>
        <div className="p-4 rounded-lg shadow-sm border text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="text-lg font-bold mb-1" style={{ color: stats.salesGrowth >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
            {stats.salesGrowth >= 0 ? '+' : ''}{stats.salesGrowth.toFixed(1)}%
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>📈 Croissance (7 jours)</p>
        </div>
        <div className="p-4 rounded-lg shadow-sm border text-center" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <p className="text-lg font-bold mb-1" style={{ color: 'var(--color-accent)' }}>{stats.topOffer || 'N/A'}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>🏆 Offre la plus populaire</p>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-8">
        <div className="p-4 rounded-lg shadow-sm border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <h4 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>🎯 Performance Insights</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Meilleur jour:</span>
              <span style={{ color: 'var(--color-text)' }}>{stats.bestDay || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Heure de pointe:</span>
              <span style={{ color: 'var(--color-text)' }}>{stats.peakHour || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--color-text-secondary)' }}>Taux de rétention:</span>
              <span style={{ color: 'var(--color-text)' }}>
                {stats.clients > 0 ? ((stats.returningClients / stats.clients) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg shadow-sm border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <h4 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>📊 Segmentation Clients</h4>
          <div className="space-y-2">
            {customerSegments.map((segment, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: segment.color }}
                  ></div>
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{segment.name}</span>
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{segment.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bar chart : sales by month */}
      <h3 className="text-xl mb-4 font-semibold" style={{ color: 'var(--color-text)' }}>📊 Chiffre d'Affaires par mois</h3>
      <div className="bg-surface p-6 rounded-lg shadow-sm border mb-8" style={{ borderColor: 'var(--color-border)' }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={byMonth}>
            <XAxis dataKey="name" />
            <YAxis tickFormatter={toCFA} />
            <Tooltip formatter={(v) => [toCFA(v as number), 'CA']} />
            <Bar dataKey="value" fill="var(--color-primary)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie chart : sales by offer */}
      <h3 className="text-xl mb-4 font-semibold" style={{ color: 'var(--color-text)' }}>🥧 CA par offre</h3>
      <div className="bg-surface p-6 rounded-lg shadow-sm border mb-8" style={{ borderColor: 'var(--color-border)' }}>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={byOffer}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {byOffer.map((_entry, idx) => (
                <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => [toCFA(v as number), 'CA']} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Daily Sales Trend - Histogram */}
      <h3 className="text-xl mb-4 font-semibold" style={{ color: 'var(--color-text)' }}>📊 Chiffre d'Affaires (7 derniers jours)</h3>
      <div className="bg-surface p-6 rounded-lg shadow-sm border mb-8" style={{ borderColor: 'var(--color-border)' }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dailyTrend}>
            <XAxis dataKey="date" />
            <YAxis tickFormatter={toCFA} />
            <Tooltip formatter={(value) => [toCFA(value as number), 'CA']} />
            <Bar dataKey="sales" fill="var(--color-primary)" name="CA" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Daily Sales Count - Histogram */}
      <h3 className="text-xl mb-4 font-semibold" style={{ color: 'var(--color-text)' }}>📊 Nombre de ventes (7 derniers jours)</h3>
      <div className="bg-surface p-6 rounded-lg shadow-sm border mb-8" style={{ borderColor: 'var(--color-border)' }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dailyTrend}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value) => [value, 'Nombre de ventes']} />
            <Bar dataKey="count" fill="var(--color-secondary)" name="Ventes" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Hourly Sales Pattern */}
      <h3 className="text-xl mb-4 font-semibold" style={{ color: 'var(--color-text)' }}>🕐 Répartition des ventes par heure</h3>
      <div className="bg-surface p-6 rounded-lg shadow-sm border mb-8" style={{ borderColor: 'var(--color-border)' }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={hourlySales}>
            <XAxis dataKey="hour" />
            <YAxis tickFormatter={toCFA} />
            <Tooltip formatter={(v) => [toCFA(v as number), 'CA']} />
            <Bar dataKey="amount" fill="var(--color-accent)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Customer Segments Visualization */}
      <h3 className="text-xl mb-4 font-semibold" style={{ color: 'var(--color-text)' }}>👥 Segmentation de la clientèle</h3>
      <div className="bg-surface p-6 rounded-lg shadow-sm border" style={{ borderColor: 'var(--color-border)' }}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={customerSegments} layout="horizontal">
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={120} />
            <Tooltip formatter={(v) => [v, 'Nombre de clients']} />
            <Bar dataKey="value" fill="var(--color-primary)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}