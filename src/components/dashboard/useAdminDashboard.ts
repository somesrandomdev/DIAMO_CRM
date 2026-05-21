import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type JoinedKiosque = { id?: string; nom?: string } | { id?: string; nom?: string }[] | null
type JoinedOffre = { id?: string; nom?: string; volume_ml?: number | null } | { id?: string; nom?: string; volume_ml?: number | null }[] | null

interface VenteRow {
  id: string
  kiosque_id: string
  client_id: string | null
  offre_id: string | null
  quantite: number | null
  montant_total: number | null
  created_at: string
  kiosques?: JoinedKiosque
  offres?: JoinedOffre
}

interface KiosqueRow {
  id: string
  nom: string
  adresse?: string | null
}

export interface AdminKpis {
  revenue: number
  revenueDelta: number
  transactions: number
  transactionsDelta: number
  activeClients: number
  totalClients: number
  litres: number
  averageDailyLitres: number
  topKiosqueName: string
  topKiosqueRevenue: number
}

export interface KiosquePerformance {
  id: string
  nom: string
  caMois: number
  nbVentes: number
  clientsActifs: number
  panierMoyen: number
  deltaVsPrevious: number
  statut: 'up' | 'down' | 'stable'
}

export interface DailyRevenuePoint {
  date: string
  label: string
  ca: number
  moyenne7j: number
}

export interface OfferBreakdownPoint {
  name: string
  value: number
  ventes: number
}

export interface HourlySalesPoint {
  hour: string
  ventes: number
}

export interface AdminDashboardData {
  kpis: AdminKpis
  kiosques: KiosquePerformance[]
  dailyRevenue: DailyRevenuePoint[]
  offerBreakdown: OfferBreakdownPoint[]
  hourlySales: HourlySalesPoint[]
}

const emptyKpis: AdminKpis = {
  revenue: 0,
  revenueDelta: 0,
  transactions: 0,
  transactionsDelta: 0,
  activeClients: 0,
  totalClients: 0,
  litres: 0,
  averageDailyLitres: 0,
  topKiosqueName: 'Aucun',
  topKiosqueRevenue: 0,
}

const emptyData: AdminDashboardData = {
  kpis: emptyKpis,
  kiosques: [],
  dailyRevenue: [],
  offerBreakdown: [],
  hourlySales: [],
}

function firstJoined<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function previousMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1)
}

function percentDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function shortDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatDayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
  })
}

function saleLitres(sale: VenteRow): number {
  const offre = firstJoined(sale.offres)
  return ((offre?.volume_ml ?? 0) * (sale.quantite ?? 0)) / 1000
}

function normalizeSale(sale: VenteRow): VenteRow {
  return {
    ...sale,
    montant_total: sale.montant_total ?? 0,
    quantite: sale.quantite ?? 0,
  }
}

export function useAdminDashboard() {
  const [data, setData] = useState<AdminDashboardData>(emptyData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const now = new Date()
      const monthStart = startOfMonth(now)
      const prevStart = previousMonthStart(now)
      const last30Start = new Date(now)
      last30Start.setDate(now.getDate() - 29)

      const [kiosquesResult, clientsResult, currentResult, previousResult, last30Result] =
        await Promise.all([
          supabase.from('kiosques').select('id, nom, adresse').order('nom'),
          supabase.from('clients').select('id', { count: 'exact', head: true }),
          supabase
            .from('ventes')
            .select(
              'id, kiosque_id, client_id, offre_id, quantite, montant_total, created_at, kiosques(id, nom), offres(id, nom, volume_ml)'
            )
            .gte('created_at', monthStart.toISOString()),
          supabase
            .from('ventes')
            .select(
              'id, kiosque_id, client_id, offre_id, quantite, montant_total, created_at, kiosques(id, nom), offres(id, nom, volume_ml)'
            )
            .gte('created_at', prevStart.toISOString())
            .lt('created_at', monthStart.toISOString()),
          supabase
            .from('ventes')
            .select(
              'id, kiosque_id, client_id, offre_id, quantite, montant_total, created_at, kiosques(id, nom), offres(id, nom, volume_ml)'
            )
            .gte('created_at', last30Start.toISOString()),
        ])

      if (kiosquesResult.error) throw kiosquesResult.error
      if (clientsResult.error) throw clientsResult.error
      if (currentResult.error) throw currentResult.error
      if (previousResult.error) throw previousResult.error
      if (last30Result.error) throw last30Result.error

      const kiosques = (kiosquesResult.data ?? []) as KiosqueRow[]
      const currentSales = ((currentResult.data ?? []) as VenteRow[]).map(normalizeSale)
      const previousSales = ((previousResult.data ?? []) as VenteRow[]).map(normalizeSale)
      const last30Sales = ((last30Result.data ?? []) as VenteRow[]).map(normalizeSale)

      const currentRevenue = currentSales.reduce((sum, sale) => sum + (sale.montant_total ?? 0), 0)
      const previousRevenue = previousSales.reduce((sum, sale) => sum + (sale.montant_total ?? 0), 0)
      const activeClientIds = new Set(currentSales.map((sale) => sale.client_id).filter(Boolean))
      const litres = currentSales.reduce((sum, sale) => sum + saleLitres(sale), 0)
      const elapsedDays = Math.max(1, now.getDate())

      const previousByKiosque = new Map<string, number>()
      previousSales.forEach((sale) => {
        previousByKiosque.set(
          sale.kiosque_id,
          (previousByKiosque.get(sale.kiosque_id) ?? 0) + (sale.montant_total ?? 0)
        )
      })

      const byKiosque = new Map<string, KiosquePerformance>()
      kiosques.forEach((kiosque) => {
        byKiosque.set(kiosque.id, {
          id: kiosque.id,
          nom: kiosque.nom,
          caMois: 0,
          nbVentes: 0,
          clientsActifs: 0,
          panierMoyen: 0,
          deltaVsPrevious: 0,
          statut: 'stable',
        })
      })

      const clientSetsByKiosque = new Map<string, Set<string>>()
      currentSales.forEach((sale) => {
        const joinedKiosque = firstJoined(sale.kiosques)
        const existing = byKiosque.get(sale.kiosque_id) ?? {
          id: sale.kiosque_id,
          nom: joinedKiosque?.nom ?? 'Kiosque inconnu',
          caMois: 0,
          nbVentes: 0,
          clientsActifs: 0,
          panierMoyen: 0,
          deltaVsPrevious: 0,
          statut: 'stable' as const,
        }

        existing.caMois += sale.montant_total ?? 0
        existing.nbVentes += 1
        byKiosque.set(sale.kiosque_id, existing)

        if (sale.client_id) {
          const clients = clientSetsByKiosque.get(sale.kiosque_id) ?? new Set<string>()
          clients.add(sale.client_id)
          clientSetsByKiosque.set(sale.kiosque_id, clients)
        }
      })

      const kiosqueRows = Array.from(byKiosque.values())
        .map((row) => {
          const delta = percentDelta(row.caMois, previousByKiosque.get(row.id) ?? 0)
          return {
            ...row,
            clientsActifs: clientSetsByKiosque.get(row.id)?.size ?? 0,
            panierMoyen: row.nbVentes > 0 ? Math.round(row.caMois / row.nbVentes) : 0,
            deltaVsPrevious: delta,
            statut: delta > 5 ? 'up' : delta < -5 ? 'down' : 'stable',
          } satisfies KiosquePerformance
        })
        .sort((a, b) => b.caMois - a.caMois)

      const topKiosque = kiosqueRows[0]

      const dayMap = new Map<string, number>()
      for (let i = 29; i >= 0; i -= 1) {
        const date = new Date(now)
        date.setDate(now.getDate() - i)
        dayMap.set(shortDateKey(date), 0)
      }

      last30Sales.forEach((sale) => {
        const key = sale.created_at.slice(0, 10)
        if (dayMap.has(key)) {
          dayMap.set(key, (dayMap.get(key) ?? 0) + (sale.montant_total ?? 0))
        }
      })

      const dailyBase = Array.from(dayMap.entries()).map(([date, ca]) => ({
        date,
        label: formatDayLabel(date),
        ca,
        moyenne7j: 0,
      }))

      const dailyRevenue = dailyBase.map((point, index) => {
        const window = dailyBase.slice(Math.max(0, index - 6), index + 1)
        const average = window.reduce((sum, item) => sum + item.ca, 0) / window.length
        return { ...point, moyenne7j: Math.round(average) }
      })

      const offerMap = new Map<string, OfferBreakdownPoint>()
      currentSales.forEach((sale) => {
        const offre = firstJoined(sale.offres)
        const name = offre?.nom ?? 'Offre inconnue'
        const existing = offerMap.get(name) ?? { name, value: 0, ventes: 0 }
        existing.value += sale.montant_total ?? 0
        existing.ventes += 1
        offerMap.set(name, existing)
      })

      const hourMap = new Map<number, number>()
      for (let hour = 6; hour <= 20; hour += 1) {
        hourMap.set(hour, 0)
      }
      currentSales.forEach((sale) => {
        const hour = new Date(sale.created_at).getHours()
        if (hourMap.has(hour)) {
          hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1)
        }
      })

      setData({
        kpis: {
          revenue: currentRevenue,
          revenueDelta: percentDelta(currentRevenue, previousRevenue),
          transactions: currentSales.length,
          transactionsDelta: percentDelta(currentSales.length, previousSales.length),
          activeClients: activeClientIds.size,
          totalClients: clientsResult.count ?? 0,
          litres,
          averageDailyLitres: litres / elapsedDays,
          topKiosqueName: topKiosque?.nom ?? 'Aucun',
          topKiosqueRevenue: topKiosque?.caMois ?? 0,
        },
        kiosques: kiosqueRows,
        dailyRevenue,
        offerBreakdown: Array.from(offerMap.values()).sort((a, b) => b.value - a.value),
        hourlySales: Array.from(hourMap.entries()).map(([hour, ventes]) => ({
          hour: `${hour}h`,
          ventes,
        })),
      })
    } catch (caught) {
      console.error('Error loading admin dashboard:', caught)
      setError(caught instanceof Error ? caught.message : 'Erreur de chargement du dashboard')
      setData(emptyData)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return useMemo(
    () => ({
      ...data,
      isLoading,
      error,
      refresh: load,
    }),
    [data, error, isLoading, load]
  )
}
