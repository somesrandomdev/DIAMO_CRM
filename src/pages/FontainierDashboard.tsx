import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import { FaPlus, FaUsers, FaChartBar } from 'react-icons/fa'
import { toCFA } from '../utils/price'

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

export default function FontainierDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<FontainierStats>({
    totalSales: 0,
    totalRevenue: 0,
    todaySales: 0,
    todayRevenue: 0,
    recentSales: []
  })
  const { signOut, profile } = useAuthStore()

  const handleLogout = async () => {
    await signOut()
  }

  const loadStats = async () => {
    if (!profile?.kiosque_id) return

    try {
      const today = new Date().toISOString().split('T')[0]

      // Get total sales and revenue for this fontainier's kiosk
      const { data: allSales, error: salesError } = await supabase
        .from('ventes')
        .select('id, montant_total, created_at, clients(nom)')
        .eq('kiosque_id', profile.kiosque_id)

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

      setStats({
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

  useEffect(() => {
    if (profile?.kiosque_id) {
      loadStats()
    }
  }, [profile?.kiosque_id])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-pattern p-4 relative">
      {/* Logout button */}
      <button
        onClick={handleLogout}
        className="btn btn-danger absolute top-4 right-4"
        style={{
          padding: '12px 16px',
          borderRadius: '10px',
          fontWeight: '600'
        }}
      >
        Déconnexion
      </button>

      <h1 className="text-4xl mb-10">Tableau de bord</h1>

      {/* Personal Stats Summary */}
      <div className="w-full max-w-sm mb-8">
        <div className="kpi-card bg-gradient-primary mb-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="kpi-value text-blue-800">{stats.totalSales}</p>
              <p className="kpi-label text-blue-700">Ventes</p>
            </div>
            <div>
              <p className="kpi-value text-green-800">{toCFA(stats.totalRevenue)}</p>
              <p className="kpi-label text-green-700">CA Total</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 w-full max-w-sm">
        <button
          onClick={() => navigate('/nouvelle-vente')}
          className="btn btn-primary btn-xl btn-full"
        >
          <FaPlus className="text-2xl sm:text-3xl" />
          Nouvelle vente
        </button>
        <button
          onClick={() => navigate('/mes-clients')}
          className="btn btn-secondary btn-xl btn-full"
        >
          <FaUsers className="text-2xl sm:text-3xl" />
          Mes clients
        </button>
        <button
          onClick={() => navigate('/mes-ventes')}
          className="btn btn-primary btn-xl btn-full"
          style={{
            backgroundColor: 'var(--color-info)',
            borderColor: 'var(--color-info)'
          }}
        >
          <FaChartBar className="text-2xl sm:text-3xl" />
          Mes statistiques
        </button>
      </div>
    </div>
  )
}