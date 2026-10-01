import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Status = 'up' | 'down' | 'stable'
type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status?: Status
  variant?: Variant
}

const statusToVariant: Record<Status, Variant> = {
  up: 'success',
  down: 'danger',
  stable: 'warning',
}

const variantClasses: Record<Variant, string> = {
  success: 'bg-teal-light text-teal',
  warning: 'bg-amber-light text-amber',
  danger: 'bg-red-light text-red',
  info: 'bg-blue-light text-blue',
  neutral: 'bg-muted text-text-secondary',
}

export function StatusBadge({
  status,
  variant,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const resolvedVariant = variant ?? (status ? statusToVariant[status] : 'neutral')

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold leading-4',
        variantClasses[resolvedVariant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
