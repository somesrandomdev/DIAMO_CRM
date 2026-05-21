import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Download, Droplets, Plus, RefreshCw, ShoppingCart, Store, Users } from 'lucide-react'
import { AlertsPanel } from '@/components/dashboard/AlertsPanel'
import { KPICard } from '@/components/dashboard/KPICard'
import { KiosqueTable } from '@/components/dashboard/KiosqueTable'
import { useAdminDashboard } from '@/components/dashboard/useAdminDashboard'
import { CABarChart } from '@/components/charts/CABarChart'
import { EvolutionLineChart } from '@/components/charts/EvolutionLineChart'
import { HeurePointe } from '@/components/charts/HeurePointe'
import { OffreDonut } from '@/components/charts/OffreDonut'
import { SlideOverDrawer } from '@/components/layout/SlideOverDrawer'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toCFA } from '@/utils/price'

type QuickAction = 'kiosque' | 'offre' | 'utilisateur' | 'export' | null

function formatLitres(value: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(value))} L`
}

function downloadCsv(filename: string, rows: string[][]) {
  const escaped = rows.map((row) =>
    row
      .map((cell) => {
        const value = cell.replaceAll('"', '""')
        return `"${value}"`
      })
      .join(',')
  )
  const blob = new Blob([escaped.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.URL.revokeObjectURL(url)
}

export default function AdminDashboardProfessional() {
  const navigate = useNavigate()
  const [activeAction, setActiveAction] = useState<QuickAction>(null)
  const {
    kpis,
    kiosques,
    dailyRevenue,
    offerBreakdown,
    hourlySales,
    isLoading,
    error,
    refresh,
  } = useAdminDashboard()

  const drawerTitle = useMemo(() => {
    if (activeAction === 'kiosque') return 'Nouveau kiosque'
    if (activeAction === 'offre') return 'Nouvelle offre'
    if (activeAction === 'utilisateur') return 'Nouvel utilisateur'
    if (activeAction === 'export') return 'Exporter le rapport'
    return ''
  }, [activeAction])

  const exportKiosques = () => {
    downloadCsv('rapport-kiosques.csv', [
      ['Kiosque', 'CA mois', 'Nb ventes', 'Clients actifs', 'Panier moyen', 'Delta vs mois precedent', 'Statut'],
      ...kiosques.map((row) => [
        row.nom,
        String(row.caMois),
        String(row.nbVentes),
        String(row.clientsActifs),
        String(row.panierMoyen),
        `${row.deltaVsPrevious.toFixed(1)}%`,
        row.statut,
      ]),
    ])
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard administrateur</h1>
          <p className="text-sm text-muted-foreground">Vue reseau mensuelle et signaux operationnels.</p>
        </div>
        <Button type="button" variant="outline" className="w-fit" onClick={refresh} loading={isLoading}>
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {isLoading ? (
          [1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-32 rounded-lg" />)
        ) : (
          <>
            <KPICard
              title="Chiffre d'affaires"
              value={toCFA(kpis.revenue)}
              trend={kpis.revenueDelta}
              subMetric="vs mois precedent"
              icon={<BarChart3 className="h-5 w-5" />}
            />
            <KPICard
              title="Transactions"
              value={String(kpis.transactions)}
              trend={kpis.transactionsDelta}
              subMetric="ventes ce mois"
              icon={<ShoppingCart className="h-5 w-5" />}
            />
            <KPICard
              title="Clients actifs"
              value={String(kpis.activeClients)}
              subMetric={`${kpis.totalClients} clients total`}
              icon={<Users className="h-5 w-5" />}
            />
            <KPICard
              title="Volume eau"
              value={formatLitres(kpis.litres)}
              subMetric={`${formatLitres(kpis.averageDailyLitres)} / jour`}
              icon={<Droplets className="h-5 w-5" />}
            />
            <KPICard
              title="Kiosque top"
              value={kpis.topKiosqueName}
              subMetric={toCFA(kpis.topKiosqueRevenue)}
              icon={<Store className="h-5 w-5" />}
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-3">
        <Button type="button" onClick={() => setActiveAction('kiosque')}>
          <Plus className="h-4 w-4" />
          Nouveau kiosque
        </Button>
        <Button type="button" variant="secondary" onClick={() => setActiveAction('offre')}>
          <Plus className="h-4 w-4" />
          Nouvelle offre
        </Button>
        <Button type="button" variant="outline" onClick={() => setActiveAction('utilisateur')}>
          <Plus className="h-4 w-4" />
          Nouvel utilisateur
        </Button>
        <Button type="button" variant="outline" onClick={() => setActiveAction('export')}>
          <Download className="h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {isLoading ? (
              [1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-[360px] rounded-lg" />)
            ) : (
              <>
                <CABarChart data={kiosques} onBarClick={(id) => navigate(`/admin/kiosques/${id}`)} />
                <EvolutionLineChart data={dailyRevenue} />
                <OffreDonut data={offerBreakdown} />
                <HeurePointe data={hourlySales} />
              </>
            )}
          </div>
          {isLoading ? <Skeleton className="h-96 rounded-lg" /> : <KiosqueTable rows={kiosques} />}
        </div>
        <AlertsPanel />
      </div>

      <SlideOverDrawer
        title={drawerTitle}
        isOpen={activeAction !== null}
        onClose={() => setActiveAction(null)}
      >
        {activeAction === 'export' ? (
          <div className="space-y-4">
            <Button type="button" className="w-full" onClick={exportKiosques}>
              <Download className="h-4 w-4" />
              Telecharger le classement
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                if (activeAction === 'kiosque') navigate('/admin/kiosques')
                if (activeAction === 'offre') navigate('/admin/offres')
                if (activeAction === 'utilisateur') navigate('/admin/utilisateurs')
                setActiveAction(null)
              }}
            >
              Ouvrir la gestion
            </Button>
          </div>
        )}
      </SlideOverDrawer>
    </div>
  )
}
