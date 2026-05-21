import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { Plus, Users, BarChart3, ShoppingCart, TrendingUp } from 'lucide-react'
import { toCFA } from '@/utils/price'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

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
    recentSales: [],
  })
  const [isLoading, setIsLoading] = useState(true)
  const { profile } = useAuthStore()

  const loadStats = useCallback(async () => {
    if (!profile?.kiosque_id) return

    setIsLoading(true)
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
      const todaySales = allSales?.filter((sale) => sale.created_at.startsWith(today)) || []
      const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.montant_total, 0)
      const todaySalesCount = todaySales.length

      // Get recent sales (last 5)
      const recentSales =
        allSales
          ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          ?.slice(0, 5)
          ?.map((sale) => ({
            id: sale.id || '',
            montant_total: sale.montant_total,
            created_at: sale.created_at,
            client_nom: (sale.clients as { nom?: string })?.nom || 'Client anonyme',
          })) || []

      setStats({
        totalSales,
        totalRevenue,
        todaySales: todaySalesCount,
        todayRevenue,
        recentSales,
      })
    } catch (error) {
      console.error('Error loading fontainier stats:', error)
    } finally {
      setIsLoading(false)
    }
  }, [profile?.kiosque_id])

  useEffect(() => {
    if (profile?.kiosque_id) {
      loadStats()
    }
  }, [profile?.kiosque_id, loadStats])

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground">
          Bienvenue, {profile?.username || 'Fontainier'}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="kpi-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventes Aujourd'hui</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.todaySales}</div>
                <p className="text-xs text-muted-foreground">
                  {toCFA(stats.todayRevenue)}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="kpi-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA Aujourd'hui</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-success">{toCFA(stats.todayRevenue)}</div>
            )}
          </CardContent>
        </Card>

        <Card className="kpi-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ventes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats.totalSales}</div>
                <p className="text-xs text-muted-foreground">Ventes totales</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="kpi-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CA Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-success">{toCFA(stats.totalRevenue)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Button
          size="xl"
          className="h-32 text-lg gap-3"
          onClick={() => navigate('/nouvelle-vente')}
        >
          <Plus className="h-8 w-8" />
          Nouvelle vente
        </Button>

        <Button
          size="xl"
          variant="secondary"
          className="h-32 text-lg gap-3"
          onClick={() => navigate('/mes-clients')}
        >
          <Users className="h-8 w-8" />
          Mes clients
        </Button>

        <Button
          size="xl"
          variant="outline"
          className="h-32 text-lg gap-3"
          onClick={() => navigate('/mes-ventes')}
        >
          <BarChart3 className="h-8 w-8" />
          Mes statistiques
        </Button>
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader>
          <CardTitle>Ventes récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats.recentSales.length > 0 ? (
            <div className="space-y-4">
              {stats.recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{sale.client_nom}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(sale.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-success">{toCFA(sale.montant_total)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Aucune vente récente
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
