import type { ReactNode } from 'react'
import { useCountUp } from '@/lib/useCountUp'
import { toCFA } from '@/utils/price'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export type KpiTone = 'blue' | 'teal' | 'amber' | 'purple'

interface BigKPICardProps {
  /** Short plain-French label, e.g. "Chiffre d'affaires du mois". */
  label: string
  /** Pre-formatted headline value. */
  value: string
  /** Optional context line under the value, e.g. "vs mois dernier". */
  hint?: string
  icon: ReactNode
  tone?: KpiTone
  /**
   * Month-over-month change in percent. Omit entirely when a comparison is
   * not meaningful — an absent arrow is honest, a "0 %" arrow is not.
   */
  deltaPercent?: number
  /** Valeur numérique à animer (count-up 600ms). `value` sert de fallback. */
  countTo?: number
  /** Format du count-up: CFA ou nombre brut. */
  countFormat?: 'cfa' | 'count'
}

/**
 * Large, high-contrast KPI tile.
 *
 * Deliberately bigger than the compact `ui/kpi-card`: this is the first thing a
 * kiosk manager sees, so the number is set at 30–36px with a coloured icon chip
 * for fast visual scanning. The compact card is still used inside dense views.
 */
const toneStyles: Record<KpiTone, { chip: string; accent: string }> = {
  blue: { chip: 'bg-blue-light text-blue', accent: 'bg-blue' },
  teal: { chip: 'bg-teal-light text-teal', accent: 'bg-teal' },
  amber: { chip: 'bg-amber-light text-amber', accent: 'bg-amber' },
  purple: { chip: 'bg-purple-light text-purple', accent: 'bg-purple' },
}

function deltaDirection(delta: number): 'up' | 'down' | 'stable' {
  if (delta > 5) return 'up'
  if (delta < -5) return 'down'
  return 'stable'
}

/**
 * Colour alone must never carry the meaning (WCAG 1.4.1), so each state pairs a
 * colour with a distinct arrow shape and a written word.
 */
const deltaStyles = {
  up: { className: 'text-teal', Icon: ArrowUpRight, word: 'en hausse' },
  down: { className: 'text-red', Icon: ArrowDownRight, word: 'en baisse' },
  stable: { className: 'text-text-secondary', Icon: Minus, word: 'stable' },
} as const

export function BigKPICard({
  label,
  value,
  hint,
  icon,
  tone = 'blue',
  deltaPercent,
  countTo,
  countFormat = 'count',
}: BigKPICardProps) {
  const animated = useCountUp(countTo ?? 0)
  const displayValue =
    countTo !== undefined
      ? countFormat === 'cfa'
        ? toCFA(animated)
        : String(animated)
      : value
  const tones = toneStyles[tone]
  const hasDelta = typeof deltaPercent === 'number' && Number.isFinite(deltaPercent)
  // Narrow to a plain number so the JSX below doesn't need non-null assertions.
  const delta = hasDelta ? deltaStyles[deltaDirection(deltaPercent)] : null
  const deltaValue = hasDelta ? deltaPercent : 0

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-surface p-4 sm:p-5">
      {/* Thin colour bar: gives each card an identity that survives greyscale
          printing and low-quality phone screens. */}
      <span className={cn('absolute inset-x-0 top-0 h-1', tones.accent)} aria-hidden="true" />

      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold leading-snug text-text-secondary">
          {label}
        </p>
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
            tones.chip
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>

      <p className="mt-3 font-mono text-[30px] font-bold leading-none tracking-tight text-text sm:text-[36px] [font-variant-numeric:tabular-nums]">
        {displayValue}
      </p>

      {(delta || hint) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          {delta && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-sm font-semibold',
                delta.className
              )}
            >
              <delta.Icon className="h-4 w-4" aria-hidden="true" />
              {deltaValue > 0 ? '+' : ''}
              {deltaValue.toFixed(1)} %
              {/* Spoken by screen readers, hidden visually: the arrow icon
                  alone would announce as nothing. */}
              <span className="sr-only"> {delta.word}</span>
            </span>
          )}
          {hint && <span className="text-xs text-text-secondary">{hint}</span>}
        </div>
      )}
    </div>
  )
}
