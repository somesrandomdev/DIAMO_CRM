import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import {
  BarChart3,
  ShoppingCart,
  Store,
  Star,
} from 'lucide-react'
import { BigKPICard } from '@/components/dashboard/BigKPICard'
import { KiosqueTable } from '@/components/dashboard/KiosqueTable'
import { DailyTrendChart } from '@/components/charts/DailyTrendChart'
import { KioskComparisonChart } from '@/components/charts/KioskComparisonChart'
import { OffreDonut } from '@/components/charts/OffreDonut'
import { useAdminDashboard, type AdminTimePeriod } from '@/components/dashboard/useAdminDashboard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCount, toCFA } from '@/utils/price'

const PERIOD_OPTIONS: { value: AdminTimePeriod; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: '7 derniers jours' },
  { value: 'month', label: 'Ce mois' },
  { value: 'custom', label: 'Date précise' },
]

/**
 * Deep-dive analytics per kiosque. Filters (period + kiosques) live IN this
 * component: useAdminDashboard is instantiated exactly once here, so filter
 * state and the rendered data can never drift apart (the bug that killed the
 * dashboard filters was a second hook instance fetching for nobody).
 */
export default function KiosqueExplorer() {
  const navigate = useNavigate()
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

  const activeKiosqueLabel = useMemo(() => {
    if (selectedKiosqueIds.length === 0) return 'Tous les kiosques'
    if (selectedKiosqueIds.length === 1)
      return allKiosques.find((kiosque) => kiosque.id === selectedKiosqueIds[0])?.nom ?? '1 kiosque'
    return `${selectedKiosqueIds.length} kiosques`
  }, [allKiosques, selectedKiosqueIds])

  const panierMoyen = kpis.transactions > 0 ? Math.round(kpis.revenue / kpis.transactions) : 0

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[16px] font-semibold text-text">Analyse par kiosque</h1>
          <p className="text-[12px] text-text-secondary">
            Données détaillées par kiosque et par période — actuellement : {activeKiosqueLabel}.
          </p>
        </div>
        <Button type="button" variant="default" size="sm" onClick={refresh} loading={isLoading}>
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </Button>
      </div>

      {/* ── Filters (period + kiosques) ── */}
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

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-[13px] text-destructive">
          {error}
        </div>
      )}

      {/* ── KPI row ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[130px] rounded-lg" />)
        ) : (
          <>
            <BigKPICard
              label="Chiffre d'affaires"
              value={toCFA(kpis.revenue)}
              hint={activeKiosqueLabel.toLowerCase()}
              deltaPercent={kpis.revenueDelta ?? undefined}
              icon={<BarChart3 className="h-5 w-5" />}
              tone="blue"
            />
            <BigKPICard
              label="Ventes"
              value={formatCount(kpis.transactions)}
              hint="sur la période sélectionnée"
              icon={<ShoppingCart className="h-5 w-5" />}
              tone="teal"
            />
            <BigKPICard
              label="Panier moyen"
              value={toCFA(panierMoyen)}
              hint="sur la période sélectionnée"
              icon={<Star className="h-5 w-5" />}
              tone="amber"
            />
            <BigKPICard
              label="Kiosques actifs"
              value={String(kiosques.filter((kiosque) => kiosque.caMois > 0).length)}
              hint={`${allKiosques.length} kiosques au total`}
              icon={<Store className="h-5 w-5" />}
              tone="purple"
            />
          </>
        )}
      </div>

      {/* ── Charts + classement ── */}
      <div className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-[380px] rounded-lg" />
            <Skeleton className="h-[380px] rounded-lg" />
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
    </div>
  )
}
