import { toCFA } from '@/utils/price'
import { PosCard } from '@/components/pos'

interface SaleSummaryProps {
  todaySalesCount: number
  todayRevenue: number
}

/** Compact stats bar: today's sales count and revenue. */
export function SaleSummary({ todaySalesCount, todayRevenue }: SaleSummaryProps) {
  return (
    <PosCard className="flex items-center justify-between py-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#1C5376]">
        Aujourd'hui
      </span>
      <span className="text-sm font-semibold text-[#12364D] [font-variant-numeric:tabular-nums]">
        {todaySalesCount} vente{todaySalesCount > 1 ? 's' : ''} · {toCFA(todayRevenue)}
      </span>
    </PosCard>
  )
}
