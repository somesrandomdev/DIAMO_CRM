import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface KPICardProps {
  title: string
  value: string
  subMetric?: string
  trend?: number
  icon: ReactNode
}

function trendClasses(trend: number) {
  if (trend > 5) return 'text-success'
  if (trend < -5) return 'text-destructive'
  return 'text-muted-foreground'
}

function TrendIcon({ trend }: { trend: number }) {
  if (trend > 5) return <ArrowUpRight className="h-4 w-4" />
  if (trend < -5) return <ArrowDownRight className="h-4 w-4" />
  return <ArrowRight className="h-4 w-4" />
}

export function KPICard({ title, value, subMetric, trend, icon }: KPICardProps) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-primary">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        <div className="mt-2 flex min-h-5 items-center gap-2 text-xs text-muted-foreground">
          {typeof trend === 'number' && (
            <span className={cn('inline-flex items-center gap-1 font-medium', trendClasses(trend))}>
              <TrendIcon trend={trend} />
              {trend > 0 ? '+' : ''}
              {trend.toFixed(1)}%
            </span>
          )}
          {subMetric && <span>{subMetric}</span>}
        </div>
      </CardContent>
    </Card>
  )
}
