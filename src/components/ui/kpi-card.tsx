import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type DeltaDirection = 'up' | 'down' | 'neutral'

interface KPICardProps {
  label: string
  value: string | number
  unit?: string
  delta?: {
    value: number
    direction: DeltaDirection
  }
  className?: string
}

const deltaClasses: Record<DeltaDirection, string> = {
  up: 'text-teal',
  down: 'text-red',
  neutral: 'text-text-tertiary',
}

function DeltaIcon({ direction }: { direction: DeltaDirection }) {
  if (direction === 'up') return <ArrowUpRight className="h-3.5 w-3.5" />
  if (direction === 'down') return <ArrowDownRight className="h-3.5 w-3.5" />
  return <ArrowRight className="h-3.5 w-3.5" />
}

export function KPICard({ label, value, unit, delta, className }: KPICardProps) {
  return (
    <Card padding="md" className={cn('min-h-[104px]', className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-1">
        <p className="font-mono text-xl font-bold leading-none text-text">{value}</p>
        {unit && <span className="text-xs text-text-tertiary">{unit}</span>}
      </div>
      {delta && (
        <p className={cn('mt-2 flex items-center gap-1 text-xs font-medium', deltaClasses[delta.direction])}>
          <DeltaIcon direction={delta.direction} />
          {delta.value > 0 ? '+' : ''}
          {delta.value.toFixed(1)}%
        </p>
      )}
    </Card>
  )
}
