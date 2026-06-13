import type { ReactNode } from 'react'
import { KPICard as BaseKPICard } from '@/components/ui/kpi-card'
import { cn } from '@/lib/utils'

interface KPICardProps {
  title: string
  value: string
  subMetric?: string
  trend?: number
  icon: ReactNode
}

export function KPICard({ title, value, subMetric, trend, icon }: KPICardProps) {
  const delta =
    typeof trend === 'number'
      ? {
          value: trend,
          direction: trend > 5 ? ('up' as const) : trend < -5 ? ('down' as const) : ('neutral' as const),
        }
      : undefined

  return (
    <div className="relative">
      <BaseKPICard label={title} value={value} delta={delta} className={cn(subMetric && 'pb-8')} />
      <div className="absolute right-4 top-4 text-blue">{icon}</div>
      {subMetric && (
        <p className="absolute bottom-3 left-4 right-4 truncate text-[10.5px] text-text-secondary">
          {subMetric}
        </p>
      )}
    </div>
  )
}
