import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  indicatorClassName?: string
}

export function ProgressBar({ value, max = 100, className, indicatorClassName }: ProgressBarProps) {
  const width = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0

  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-blue-light', className)}>
      <div
        className={cn('h-full rounded-full bg-blue transition-all', indicatorClassName)}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
