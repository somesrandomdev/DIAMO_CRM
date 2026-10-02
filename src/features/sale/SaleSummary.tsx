import { toCFA } from '@/utils/price'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

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
    <Card padding="md" className="space-y-3 py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-text">
          Aujourd'hui
        </span>
        <span className="text-sm font-semibold text-text [font-variant-numeric:tabular-nums]">
          {todaySalesCount} vente{todaySalesCount > 1 ? 's' : ''} · {toCFA(todayRevenue)}
        </span>
      </div>

      {dailyGoal !== null && (
        <div>
          <Progress value={goalProgress} className="h-3" />
          <p className="mt-1 text-right text-xs font-semibold text-text-secondary [font-variant-numeric:tabular-nums]">
            Objectif du jour : {toCFA(todayRevenue)} / {toCFA(dailyGoal)} CFA (
            {goalProgress.toFixed(0)} %)
          </p>
        </div>
      )}
    </Card>
  )
}
