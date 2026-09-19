import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Users } from 'lucide-react'
import { DailyTrendChart } from '@/components/charts/DailyTrendChart'
import type { DailyRevenuePoint } from '@/components/dashboard/useAdminDashboard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { KPICard } from '@/components/ui/kpi-card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { supabase } from '@/lib/supabase'
import { toCFA } from '@/utils/price'

interface KiosqueDetail {
  id: string
  nom: string
  adresse?: string | null
}

interface AssignedUser {
  id: string
  username: string
  role: string
}

interface VenteRow {
  id: string
  created_at: string
  montant_total: number | null
  client_id: string | null
  offre_id: string | null
  offres?: { nom?: string } | { nom?: string }[] | null
}

function roleVariant(role: string) {
  if (role === 'administrateur') return 'info'
  if (role === 'commercial') return 'success'
  return 'warning'
}

function makeDailyData(sales: VenteRow[]): DailyRevenuePoint[] {
  const now = new Date()
  const dayMap = new Map<string, number>()

  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date(now)
    date.setDate(now.getDate() - i)
    dayMap.set(date.toISOString().slice(0, 10), 0)
  }

  sales.forEach((sale) => {
    const key = sale.created_at.slice(0, 10)
    if (dayMap.has(key)) {
      dayMap.set(key, (dayMap.get(key) ?? 0) + (sale.montant_total ?? 0))
    }
  })

  const base = Array.from(dayMap.entries()).map(([date, ca]) => ({
    date,
    label: new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
    }),
    ca,
    moyenne7j: 0,
  }))

  return base.map((point, index) => {
    const window = base.slice(Math.max(0, index - 6), index + 1)
    return {
      ...point,
      moyenne7j: Math.round(window.reduce((sum, item) => sum + item.ca, 0) / window.length),
    }
  })
}

export default function KiosqueDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [kiosque, setKiosque] = useState<KiosqueDetail | null>(null)
  const [users, setUsers] = useState<AssignedUser[]>([])
  const [sales, setSales] = useState<VenteRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return

    setIsLoading(true)
    setError(null)

    try {
      const last30 = new Date()
      last30.setDate(last30.getDate() - 29)

      const [kiosqueResult, usersResult, salesResult] = await Promise.all([
        supabase.from('kiosques').select('id, nom, adresse').eq('id', id).single(),
        supabase.from('profiles').select('id, username, role').eq('kiosque_id', id).order('username'),
        supabase
          .from('ventes')
          .select('id, created_at, montant_total, client_id, offre_id, offres(nom)')
          .eq('kiosque_id', id)
          .gte('created_at', last30.toISOString())
          .order('created_at', { ascending: false }),
      ])

      if (kiosqueResult.error) throw kiosqueResult.error
      if (usersResult.error) throw usersResult.error
      if (salesResult.error) throw salesResult.error

      setKiosque(kiosqueResult.data as KiosqueDetail)
      setUsers((usersResult.data ?? []) as AssignedUser[])
      setSales((salesResult.data ?? []) as VenteRow[])
    } catch (caught) {
      console.error('Error loading kiosk detail:', caught)
      setError(caught instanceof Error ? caught.message : 'Erreur de chargement du kiosque')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const ca = sales.reduce((sum, sale) => sum + (sale.montant_total ?? 0), 0)
    const activeClients = new Set(sales.map((sale) => sale.client_id).filter(Boolean)).size
    const bestOfferMap = new Map<string, number>()

    sales.forEach((sale) => {
      const joined = Array.isArray(sale.offres) ? sale.offres[0] : sale.offres
      const name = joined?.nom ?? 'Offre inconnue'
      bestOfferMap.set(name, (bestOfferMap.get(name) ?? 0) + 1)
    })

    const bestOffer = Array.from(bestOfferMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Aucune'

    return {
      ca,
      ventes: sales.length,
      activeClients,
      panier: sales.length > 0 ? ca / sales.length : 0,
      bestOffer,
      daily: makeDailyData(sales),
    }
  }, [sales])

  if (isLoading) {
    return <Skeleton className="h-[520px] rounded-md" />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="default" size="sm" className="w-fit" onClick={() => navigate('/admin/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red/30 bg-red-light p-4 text-sm text-red">
          {error}
        </div>
      )}

      <div>
        <h1 className="text-[15px] font-semibold text-text">{kiosque?.nom ?? 'Kiosque'}</h1>
        <p className="mt-2 flex items-center gap-2 text-[12px] text-text-secondary">
          <MapPin className="h-4 w-4" />
          {kiosque?.adresse || 'Adresse non renseignee'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="CA 30 jours" value={toCFA(stats.ca)} />
        <KPICard label="Ventes" value={stats.ventes} />
        <KPICard label="Clients actifs" value={stats.activeClients} />
        <KPICard label="Panier moyen" value={toCFA(stats.panier)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <DailyTrendChart data={stats.daily} />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Utilisateurs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-border p-3">
              <p className="text-[12px] text-text-secondary">Offre la plus vendue</p>
              <p className="font-semibold">{stats.bestOffer}</p>
            </div>
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-md bg-muted p-3">
                <span className="font-medium text-text">{user.username}</span>
                <StatusBadge variant={roleVariant(user.role)}>{user.role}</StatusBadge>
              </div>
            ))}
            {users.length === 0 && <EmptyState title="Aucun utilisateur assigne" className="border-0 bg-muted p-4" />}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
