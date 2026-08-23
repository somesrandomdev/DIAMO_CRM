import { toCFA } from '@/utils/price'
import { PosCard } from '@/components/pos'

interface SaleSummaryProps {
  todaySalesCount: number
  todayRevenue: number
  /** Daily slice of the monthly objectif; null hides the goal bar. */
  dailyGoal: number | null
}

/** Compact stats bar: today's sales count, revenue, and daily goal progress. */
export function SaleSummary({ todaySalesCount, todayRevenue, dailyGoal }: SaleSummaryProps) {
  const goalProgress = dailyGoal && dailyGoal > 0 ? (todayRevenue / dailyGoal) * 100 : 0

  return (
    <PosCard className="space-y-3 py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#12364D]">
          Aujourd'hui
        </span>
        <span className="text-sm font-semibold text-[#12364D] [font-variant-numeric:tabular-nums]">
          {todaySalesCount} vente{todaySalesCount > 1 ? 's' : ''} · {toCFA(todayRevenue)}
        </span>
      </div>

      {dailyGoal !== null && (
        <div>
          <div className="h-3 w-full overflow-hidden rounded-md bg-[#E3F3FE]">
            <div
              className="h-full rounded-md bg-[#009EFB] transition-all"
              style={{ width: `${Math.min(100, goalProgress)}%` }}
            />
          </div>
          <p className="mt-1 text-right text-xs font-semibold text-[#1C5376] [font-variant-numeric:tabular-nums]">
            Objectif du jour : {toCFA(todayRevenue)} / {toCFA(dailyGoal)} CFA (
            {goalProgress.toFixed(0)} %)
          </p>
        </div>
      )}
    </PosCard>
  )
}
