export interface DashboardStats {
  totalSales: number
  totalVolume: number
  activeClients: number
  todaySales: number
}

export interface CommercialDashboardStats extends DashboardStats {
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

export interface RecentSale {
  id: string
  created_at: string
  montant_total: number
  client: { nom: string } | null
  offre: { nom: string } | null
}

export interface ChartData {
  date: string
  sales: number
  volume: number
}
