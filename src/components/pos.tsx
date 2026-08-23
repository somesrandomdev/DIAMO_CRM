import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * POS design system primitives — Diam'o brand edition:
 * water blue (#009EFB) primary, deep blue (#12364D) text, light blue-gray
 * (#F6F9FB) surfaces, crisp #DCE1E5 borders, uppercase tracked labels,
 * tabular numbers in Karla. Large touch targets (h-12) throughout.
 */

export function PosLabel({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-xs font-semibold uppercase tracking-wider text-[#12364D]', className)}
      {...props}
    />
  )
}

const posFieldClasses =
  'h-12 w-full rounded-md border-2 border-[#DCE1E5] bg-white px-3 text-base text-[#12364D] transition-colors placeholder:text-[#8AA3B5] focus:border-[#12364D] focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60'

export const PosInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(posFieldClasses, className)} {...props} />
))
PosInput.displayName = 'PosInput'

export const PosSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(posFieldClasses, className)} {...props}>
    {children}
  </select>
))
PosSelect.displayName = 'PosSelect'

export const PosTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(posFieldClasses, 'h-auto min-h-12 py-2', className)}
    {...props}
  />
))
PosTextarea.displayName = 'PosTextarea'

export function PosCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-[#DCE1E5] bg-white p-4', className)} {...props} />
}

interface PosKpiProps {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  className?: string
}

export function PosKpi({ label, value, sub, className }: PosKpiProps) {
  return (
    <PosCard className={cn('flex flex-col gap-1', className)}>
      <PosLabel>{label}</PosLabel>
      <span className="text-2xl font-bold tracking-tight text-[#12364D] [font-variant-numeric:tabular-nums]">
        {value}
      </span>
      {sub && <span className="text-xs text-[#1C5376]">{sub}</span>}
    </PosCard>
  )
}

interface PosChipProps {
  active: boolean
  children: React.ReactNode
  className?: string
}

/** Toggle chip: checked = brand blue fill, unchecked = white with border. */
export function PosChip({ active, children, className, ...props }: PosChipProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-md border-2 px-4 text-sm font-semibold transition-colors active:scale-[0.98]',
        active
          ? 'border-[#009EFB] bg-[#009EFB] text-white'
          : 'border-[#DCE1E5] bg-white text-[#12364D] hover:border-[#12364D]',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
