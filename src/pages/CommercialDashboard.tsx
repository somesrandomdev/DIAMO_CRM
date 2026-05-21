import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download, Search, ShoppingCart, Target, Users, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { exportRowsCSV } from '@/utils/exportCSV'
import { toCFA } from '@/utils/price'

interface SaleRow {
  id: string
  created_at: string
  montant_total: number | null
  client_id: string | null
  clients?: { nom?: string } | { nom?: string }[] | null
}

interface ClientInsight {
  id: string
  nom: string
  derniereVisite: string
  achatsMois: number
  montantTotal: number
  segment: SegmentName
}

type SegmentName = 'VIP' | 'Regulier' | 'Occasionnel'
type SortKey = 'nom' | 'derniereVisite' | 'achatsMois' | 'montantTotal' | 'segment'

interface DailyPoint {
  date: string
  label: string
  ca: number
  target: number
}

interface SegmentPoint {
  name: SegmentName
  value: number
  color: string
}

function firstJoined<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function startOfCurrentMonth(): Date {
  const date = new Date()
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date
}

function daysInCurrentMonth(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function segmentForPurchases(count: number): SegmentName {
  if (count >= 5) return 'VIP'
  if (count >= 2) return 'Regulier'
  return 'Occasionnel'
}

function segmentBadgeVariant(segment: SegmentName) {
  if (segment === 'VIP') return 'success'
  if (segment === 'Regulier') return 'secondary'
  return 'outline'
}

export default function CommercialDashboard() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const [isLoading, setIsLoading] = useState(true)
  const [sales, setSales] = useState<SaleRow[]>([])
  const [target, setTarget] = useState(0)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('montantTotal')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const loadDashboardData = useCallback(async () => {
    if (!profile?.kiosque_id) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const monthStart = startOfCurrentMonth()

    try {
      const [salesResult, targetResult] = await Promise.all([
        supabase
          .from('ventes')
          .select('id, created_at, montant_total, client_id, clients(nom)')
          .eq('kiosque_id', profile.kiosque_id)
          .gte('created_at', monthStart.toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('objectifs')
          .select('ca_cible')
          .eq('kiosque_id', profile.kiosque_id)
          .eq('mois', monthKey(monthStart))
          .maybeSingle(),
      ])

      if (salesResult.error) throw salesResult.error
      if (targetResult.error) throw targetResult.error

      setSales((salesResult.data ?? []) as SaleRow[])
      setTarget(targetResult.data?.ca_cible ?? 0)
    } catch (error) {
      console.error('Error loading commercial dashboard:', error)
      setSales([])
      setTarget(0)
    } finally {
      setIsLoading(false)
    }
  }, [profile?.kiosque_id])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const dailyTarget = target > 0 ? target / daysInCurrentMonth() : 0

  const stats = useMemo(() => {
    const ca = sales.reduce((sum, sale) => sum + (sale.montant_total ?? 0), 0)
    const activeClients = new Set(sales.map((sale) => sale.client_id).filter(Boolean)).size
    return {
      ca,
      ventes: sales.length,
      activeClients,
      panierMoyen: sales.length > 0 ? Math.round(ca / sales.length) : 0,
      progress: target > 0 ? (ca / target) * 100 : 0,
    }
  }, [sales, target])

  const dailyData = useMemo<DailyPoint[]>(() => {
    const now = new Date()
    const dayMap = new Map<string, number>()

    for (let index = 29; index >= 0; index -= 1) {
      const date = new Date(now)
      date.setDate(now.getDate() - index)
      dayMap.set(date.toISOString().slice(0, 10), 0)
    }

    sales.forEach((sale) => {
      const key = sale.created_at.slice(0, 10)
      if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + (sale.montant_total ?? 0))
    })

    return Array.from(dayMap.entries()).map(([date, ca]) => ({
      date,
      label: new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
      }),
      ca,
      target: Math.round(dailyTarget),
    }))
  }, [dailyTarget, sales])

  const clients = useMemo<ClientInsight[]>(() => {
    const map = new Map<string, ClientInsight>()

    sales.forEach((sale) => {
      const clientId = sale.client_id ?? 'inconnu'
      const client = firstJoined(sale.clients)
      const existing = map.get(clientId) ?? {
        id: clientId,
        nom: client?.nom ?? 'Client inconnu',
        derniereVisite: sale.created_at,
        achatsMois: 0,
        montantTotal: 0,
        segment: 'Occasionnel' as SegmentName,
      }

      existing.achatsMois += 1
      existing.montantTotal += sale.montant_total ?? 0
      if (new Date(sale.created_at) > new Date(existing.derniereVisite)) {
        existing.derniereVisite = sale.created_at
      }
      existing.segment = segmentForPurchases(existing.achatsMois)
      map.set(clientId, existing)
    })

    return Array.from(map.values())
  }, [sales])

  const segmentData = useMemo<SegmentPoint[]>(() => {
    const points: SegmentPoint[] = [
      { name: 'VIP', value: 0, color: '#40C057' },
      { name: 'Regulier', value: 0, color: '#1C7ED6' },
      { name: 'Occasionnel', value: 0, color: '#FFD43B' },
    ]

    clients.forEach((client) => {
      const point = points.find((item) => item.name === client.segment)
      if (point) point.value += 1
    })

    return points.filter((point) => point.value > 0)
  }, [clients])

  const topClients = useMemo(
    () => [...clients].sort((a, b) => b.montantTotal - a.montantTotal).slice(0, 5),
    [clients]
  )

  const visibleClients = useMemo(() => {
    const filtered = clients.filter((client) =>
      client.nom.toLowerCase().includes(search.trim().toLowerCase())
    )

    return filtered.sort((a, b) => {
      const modifier = sortDirection === 'asc' ? 1 : -1
      const aValue = a[sortKey]
      const bValue = b[sortKey]

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return aValue.localeCompare(bValue) * modifier
      }

      return ((aValue as number) - (bValue as number)) * modifier
    })
  }, [clients, search, sortDirection, sortKey])

  const requestSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection(key === 'nom' ? 'asc' : 'desc')
  }

  const exportClientTable = () => {
    exportRowsCSV(
      visibleClients.map((client) => ({
        Client: client.nom,
        'Derniere visite': new Date(client.derniereVisite).toLocaleDateString('fr-FR'),
        'Achats mois': client.achatsMois,
        'Montant total': client.montantTotal,
        Segment: client.segment,
      })),
      `clients-${profile?.kiosques?.nom ?? 'kiosque'}.csv`
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Analyses commerciales</h1>
          <p className="text-sm text-muted-foreground">
            Performance mensuelle de {profile?.kiosques?.nom || 'mon kiosque'}.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={exportClientTable} disabled={visibleClients.length === 0}>
          <Download className="h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          [1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-32 rounded-lg" />)
        ) : (
          <>
            <Card className="rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">CA ce mois</CardTitle>
                <Wallet className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{toCFA(stats.ca)}</p>
                {target > 0 && (
                  <>
                    <Progress value={Math.min(stats.progress, 100)} className="mt-3" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {stats.progress.toFixed(1)}% de {toCFA(target)}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Nb ventes</CardTitle>
                <ShoppingCart className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent><p className="text-2xl font-semibold">{stats.ventes}</p></CardContent>
            </Card>
            <Card className="rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Clients actifs</CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent><p className="text-2xl font-semibold">{stats.activeClients}</p></CardContent>
            </Card>
            <Card className="rounded-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Panier moyen</CardTitle>
                <Target className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent><p className="text-2xl font-semibold">{toCFA(stats.panierMoyen)}</p></CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>CA quotidien 30 jours</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[320px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" minTickGap={16} />
                  <YAxis tickFormatter={(value) => toCFA(Number(value))} width={82} />
                  <Tooltip formatter={(value) => [toCFA(Number(value)), 'CA']} />
                  <Bar dataKey="ca" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  {target > 0 && (
                    <Line dataKey="target" stroke="var(--color-destructive)" strokeDasharray="6 4" dot={false} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Segmentation</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[320px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={segmentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={105} label>
                    {segmentData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Clients']} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Top 5 clients</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topClients} layout="vertical" margin={{ left: 18 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => toCFA(Number(value))} />
                <YAxis dataKey="nom" type="category" width={110} />
                <Tooltip formatter={(value) => [toCFA(Number(value)), 'Montant']} />
                <Bar dataKey="montantTotal" fill="var(--color-success)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Client intelligence</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm sm:w-64"
                  placeholder="Rechercher un client"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2"><button type="button" onClick={() => requestSort('nom')}>Client</button></th>
                    <th className="px-3 py-2"><button type="button" onClick={() => requestSort('derniereVisite')}>Derniere visite</button></th>
                    <th className="px-3 py-2 text-right"><button type="button" onClick={() => requestSort('achatsMois')}>Achats mois</button></th>
                    <th className="px-3 py-2 text-right"><button type="button" onClick={() => requestSort('montantTotal')}>Montant total</button></th>
                    <th className="px-3 py-2"><button type="button" onClick={() => requestSort('segment')}>Segment</button></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleClients.map((client) => (
                    <tr
                      key={client.id}
                      className="cursor-pointer border-b last:border-0 hover:bg-muted/60"
                      onClick={() => navigate(`/clients?client=${client.id}`)}
                    >
                      <td className="px-3 py-3 font-medium">{client.nom}</td>
                      <td className="px-3 py-3">
                        {new Date(client.derniereVisite).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-3 py-3 text-right">{client.achatsMois}</td>
                      <td className="px-3 py-3 text-right">{toCFA(client.montantTotal)}</td>
                      <td className="px-3 py-3">
                        <Badge variant={segmentBadgeVariant(client.segment)}>{client.segment}</Badge>
                      </td>
                    </tr>
                  ))}
                  {visibleClients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                        Aucun client a afficher.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
