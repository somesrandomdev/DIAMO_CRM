import { cn } from '@/lib/utils'

interface ProgressProps {
  /** Percentage 0-100; values outside are clamped. */
  value: number
  className?: string
  barClassName?: string
}

/** Progress bar: light-blue track, blue fill, clamped width. */
export function Progress({ value, className, barClassName }: ProgressProps) {
  const width = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('h-2.5 w-full overflow-hidden rounded-md bg-blue-light', className)}>
      <div className={cn('h-full rounded-md bg-blue transition-all', barClassName)} style={{ width: `${width}%` }} />
    </div>
  )
}
