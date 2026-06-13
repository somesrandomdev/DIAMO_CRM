import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type SegmentVariant = 'success' | 'info' | 'warning' | 'danger' | 'neutral'

interface SegmentCardProps {
  value: string | number
  label: string
  icon?: ReactNode
  variant?: SegmentVariant
  className?: string
}

const variantClasses: Record<SegmentVariant, string> = {
  success: 'bg-teal-light text-teal',
  info: 'bg-blue-light text-blue',
  warning: 'bg-amber-light text-amber',
  danger: 'bg-red-light text-red',
  neutral: 'bg-muted text-text-secondary',
}

export function SegmentCard({ value, label, icon, variant = 'neutral', className }: SegmentCardProps) {
  return (
    <div className={cn('rounded-md p-3 text-center', variantClasses[variant], className)}>
      {icon && <div className="mb-1 flex justify-center">{icon}</div>}
      <p className="font-mono text-[20px] font-bold leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide">{label}</p>
    </div>
  )
}
