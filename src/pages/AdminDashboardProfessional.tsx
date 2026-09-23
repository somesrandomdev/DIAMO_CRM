import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Download,
  Plus,
  RefreshCw,
  ShoppingCart,
  Star,
  Store,
} from 'lucide-react'
import { AlertsPanel } from '@/components/dashboard/AlertsPanel'
import { BigKPICard } from '@/components/dashboard/BigKPICard'
import { ChurnAlertCard } from '@/components/dashboard/ChurnAlertCard'
import { KiosqueTable } from '@/components/dashboard/KiosqueTable'
import { TopClientsCard } from '@/components/TopClientsCard'
import { useAdminDashboard, type AdminTimePeriod } from '@/components/dashboard/useAdminDashboard'
import { DailyTrendChart } from '@/components/charts/DailyTrendChart'
import { KioskComparisonChart } from '@/components/charts/KioskComparisonChart'
import { OffreDonut } from '@/components/charts/OffreDonut'
import { SlideOverDrawer } from '@/components/layout/SlideOverDrawer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCount, toCFA } from '@/utils/price'

type QuickAction = 'kiosque' | 'offre' | 'utilisateur' | 'export' | null

const PERIOD_OPTIONS: { value: AdminTimePeriod; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: '7 derniers jours' },
  { value: 'month', label: 'Ce mois' },
  { value: 'custom', label: 'Date précise' },
]


function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
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
    timePeriod,
    setTimePeriod,
    customDate,
    setCustomDate,
    selectedKiosqueIds,
    toggleKiosk,
    clearKiosques,
    allKiosques,
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
      ['Kiosque', 'CA mois', 'Nb ventes', 'Panier moyen', 'Delta vs mois précédent', 'Statut'],
      ...kiosques.map((row) => [
        row.nom,
        String(row.caMois),
        String(row.nbVentes),
        String(row.panierMoyen),
        `${row.deltaVsPrevious.toFixed(1)}%`,
        row.statut,
      ]),
    ])
  }

  const activeKiosqueLabel = useMemo(() => {
    if (selectedKiosqueIds.length === 0) return 'Tous les kiosques'
    if (selectedKiosqueIds.length === 1)
      return allKiosques.find((kiosque) => kiosque.id === selectedKiosqueIds[0])?.nom ?? '1 kiosque'
    return `${selectedKiosqueIds.length} kiosques sélectionnés`
  }, [allKiosques, selectedKiosqueIds])

  return (
    <div className="space-y-5">
      {/* ── Filtres (période + kiosques) — JSX inline: le hook n'est instancié
          que dans CE composant, les filtres ne peuvent pas diverger du rendu ── */}
      <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTimePeriod(option.value)}
              aria-pressed={timePeriod === option.value}
              className={
                timePeriod === option.value
                  ? 'min-h-11 rounded-md bg-primary px-3 text-[12px] font-semibold text-white'
                  : 'min-h-11 rounded-md border border-border bg-surface px-3 text-[12px] font-semibold text-text-secondary hover:border-primary hover:text-primary'
              }
            >
              {option.label}
            </button>
          ))}
          {timePeriod === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(event) => setCustomDate(event.target.value)}
              aria-label="Date précise"
              className="h-11 rounded-md border border-border bg-surface px-3 text-[13px] text-text"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={clearKiosques}
            aria-pressed={selectedKiosqueIds.length === 0}
            className={
              selectedKiosqueIds.length === 0
                ? 'min-h-11 rounded-md bg-primary px-3 text-[12px] font-semibold text-white'
                : 'min-h-11 rounded-md border border-border bg-surface px-3 text-[12px] font-semibold text-text-secondary hover:border-primary hover:text-primary'
            }
          >
            Tous les kiosques
          </button>
          {allKiosques.map((kiosque) => (
            <button
              key={kiosque.id}
              type="button"
              onClick={() => toggleKiosk(kiosque.id)}
              aria-pressed={selectedKiosqueIds.includes(kiosque.id)}
              className={
                selectedKiosqueIds.includes(kiosque.id)
                  ? 'min-h-11 rounded-md bg-primary px-3 text-[12px] font-semibold text-white'
                  : 'min-h-11 rounded-md border border-border bg-surface px-3 text-[12px] font-semibold text-text-secondary hover:border-primary hover:text-primary'
              }
            >
              {kiosque.nom}
            </button>
          ))}
        </div>
      </div>

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[16px] font-semibold text-text">Tableau de bord</h1>
          <p className="text-[12px] text-text-secondary">
            Vue d'ensemble du réseau — {activeKiosqueLabel.toLowerCase()}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={refresh}
            loading={isLoading}
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-[13px] text-destructive">
          {error}
        </div>
      )}

      {!isLoading && <ChurnAlertCard />}
      {!isLoading && <TopClientsCard />}

      {/* ── KPI row ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[130px] rounded-lg" />)
        ) : (
          <>
            <BigKPICard
              label="Chiffre d'affaires"
              value={toCFA(kpis.revenue)}
              hint="vs période précédente"
              deltaPercent={kpis.revenueDelta ?? undefined}
              icon={<BarChart3 className="h-5 w-5" />}
              tone="blue"
            />
            <BigKPICard
              label="Tickets émis ce mois"
              value={formatCount(kpis.transactions)}
              hint="nombre de ventes enregistrées"
              icon={<ShoppingCart className="h-5 w-5" />}
              tone="teal"
            />
            <BigKPICard
              label="Meilleur kiosque"
              value={kpis.topKiosqueName}
              hint={kpis.topKiosqueRevenue > 0 ? toCFA(kpis.topKiosqueRevenue) : undefined}
              icon={<Store className="h-5 w-5" />}
              tone="purple"
            />
            <BigKPICard
              label="Offre la plus vendue"
              value={kpis.topOffreName}
              hint={
                kpis.topOffreQty > 0
                  ? `${formatCount(kpis.topOffreQty)} unités vendues`
                  : undefined
              }
              icon={<Star className="h-5 w-5" />}
              tone="amber"
            />
          </>
        )}
      </div>

      {/* ── Quick actions ── */}
      <Card padding="sm" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setActiveAction('kiosque')}
        >
          <Plus className="h-4 w-4" />
          Nouveau kiosque
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => setActiveAction('offre')}
        >
          <Plus className="h-4 w-4" />
          Nouvelle offre
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => setActiveAction('utilisateur')}
        >
          <Plus className="h-4 w-4" />
          Nouvel utilisateur
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => setActiveAction('export')}
        >
          <Download className="h-4 w-4" />
          Exporter CSV
        </Button>
      </Card>

      {/* ── Charts ── */}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {isLoading ? (
            <>
              <Skeleton className="h-[380px] rounded-lg" />
              <Skeleton className="h-[380px] rounded-lg" />
              <Skeleton className="h-[320px] rounded-lg" />
              <Skeleton className="h-96 rounded-lg" />
            </>
          ) : (
            <>
              <DailyTrendChart data={dailyRevenue} />
              <KioskComparisonChart
                data={kiosques}
                showDelta
                onBarClick={(id) => navigate(`/admin/kiosques/${id}`)}
              />
              {offerBreakdown.length > 0 && <OffreDonut data={offerBreakdown} />}
              <KiosqueTable rows={kiosques} />
            </>
          )}
        </div>
        <AlertsPanel />
      </div>

      {/* ── Drawer ── */}
      <SlideOverDrawer
        title={drawerTitle}
        isOpen={activeAction !== null}
        onClose={() => setActiveAction(null)}
      >
        {activeAction === 'export' ? (
          <div className="space-y-4">
            <Button
              type="button"
              variant="primary"
              className="w-full"
              onClick={exportKiosques}
            >
              <Download className="h-4 w-4" />
              Télécharger le classement
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              type="button"
              variant="primary"
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
