import type { ReactNode } from 'react'
import { AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AlertSeverity = 'danger' | 'warning' | 'info'

interface AlertCardProps {
  severity: AlertSeverity
  title: string
  subtitle?: string
  icon?: ReactNode
  className?: string
}

const severityClasses: Record<AlertSeverity, string> = {
  danger: 'border-l-red bg-red-light text-red',
  warning: 'border-l-amber bg-amber-light text-amber',
  info: 'border-l-blue bg-blue-light text-blue',
}

const severityIcons: Record<AlertSeverity, ReactNode> = {
  danger: <AlertCircle className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
}

export function AlertCard({ severity, title, subtitle, icon, className }: AlertCardProps) {
  return (
    <div
      className={cn(
        'rounded-md border-l-[3px] p-3',
        severityClasses[severity],
        className
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">{icon ?? severityIcons[severity]}</div>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-text">{title}</p>
          {subtitle && <p className="mt-0.5 text-[11px] text-text-secondary">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}
