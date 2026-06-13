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
import { Download, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { FormInput } from '@/components/ui/form-input'
import { KPICard } from '@/components/ui/kpi-card'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Skeleton } from '@/components/ui/skeleton'
import { SegmentCard } from '@/components/ui/segment-card'
import { chartTheme } from '@/lib/chartTheme'
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
      { name: 'VIP', value: 0, color: chartTheme.green },
      { name: 'Regulier', value: 0, color: chartTheme.blue },
      { name: 'Occasionnel', value: 0, color: chartTheme.amber },
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
    return clients
      .filter((client) => client.nom.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => b.montantTotal - a.montantTotal)
  }, [clients, search])

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

  const clientColumns: DataTableColumn<ClientInsight>[] = [
    {
      key: 'nom',
      header: 'Client',
      render: (client) => <span className="font-medium">{client.nom}</span>,
      sortValue: (client) => client.nom,
    },
    {
      key: 'derniereVisite',
      header: 'Derniere visite',
      render: (client) => new Date(client.derniereVisite).toLocaleDateString('fr-FR'),
      sortValue: (client) => new Date(client.derniereVisite),
    },
    {
      key: 'achatsMois',
      header: 'Achats mois',
      render: (client) => client.achatsMois,
      sortValue: (client) => client.achatsMois,
      align: 'right',
    },
    {
      key: 'montantTotal',
      header: 'Montant total',
      render: (client) => <span className="font-mono">{toCFA(client.montantTotal)}</span>,
      sortValue: (client) => client.montantTotal,
      align: 'right',
    },
    {
      key: 'segment',
      header: 'Segment',
      render: (client) => <Badge variant={segmentBadgeVariant(client.segment)}>{client.segment}</Badge>,
      sortValue: (client) => client.segment,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-text">Analyses commerciales</h1>
          <p className="text-[12px] text-text-secondary">
            Performance mensuelle de {profile?.kiosques?.nom || 'mon kiosque'}.
          </p>
        </div>
        <Button type="button" variant="default" size="sm" onClick={exportClientTable} disabled={visibleClients.length === 0}>
          <Download className="h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          [1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-32 rounded-lg" />)
        ) : (
          <>
            <div className="space-y-2">
              <KPICard label="CA ce mois" value={toCFA(stats.ca)} />
              {target > 0 && (
                <Card padding="sm">
                  <ProgressBar value={stats.progress} />
                  <p className="mt-1 text-[10.5px] text-text-secondary">
                    {stats.progress.toFixed(1)}% de {toCFA(target)}
                  </p>
                </Card>
              )}
            </div>
            <KPICard label="Nb ventes" value={stats.ventes} />
            <KPICard label="Clients actifs" value={stats.activeClients} />
            <KPICard label="Panier moyen" value={toCFA(stats.panierMoyen)} />
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>CA quotidien 30 jours</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[320px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={dailyData}>
                  <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" minTickGap={16} tick={{ fill: chartTheme.axis, fontSize: 11 }} />
                  <YAxis tickFormatter={(value) => toCFA(Number(value))} width={82} tick={{ fill: chartTheme.axis, fontSize: 11 }} />
                  <Tooltip contentStyle={chartTheme.tooltip} formatter={(value) => [toCFA(Number(value)), 'CA']} />
                  <Bar dataKey="ca" fill={chartTheme.blue} radius={[6, 6, 0, 0]} />
                  {target > 0 && (
                    <Line dataKey="target" stroke={chartTheme.red} strokeDasharray="6 4" dot={false} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
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
                  <Tooltip contentStyle={chartTheme.tooltip} formatter={(value) => [value, 'Clients']} />
                </PieChart>
              </ResponsiveContainer>
            )}
            {!isLoading && segmentData.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {segmentData.map((point) => (
                  <SegmentCard
                    key={point.name}
                    value={point.value}
                    label={point.name}
                    variant={point.name === 'VIP' ? 'success' : point.name === 'Regulier' ? 'info' : 'warning'}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 clients</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topClients} layout="vertical" margin={{ left: 18 }}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => toCFA(Number(value))} tick={{ fill: chartTheme.axis, fontSize: 11 }} />
                <YAxis dataKey="nom" type="category" width={110} tick={{ fill: chartTheme.axis, fontSize: 11 }} />
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(value) => [toCFA(Number(value)), 'Montant']} />
                <Bar dataKey="montantTotal" fill={chartTheme.green} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Client intelligence</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <FormInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9 sm:w-64"
                  placeholder="Rechercher un client"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {visibleClients.length === 0 ? (
              <EmptyState title="Aucun client a afficher" className="border-0 bg-muted" />
            ) : (
              <DataTable
                columns={clientColumns}
                data={visibleClients}
                getRowKey={(client) => client.id}
                onRowClick={(client) => navigate(`/clients?client=${client.id}`)}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
