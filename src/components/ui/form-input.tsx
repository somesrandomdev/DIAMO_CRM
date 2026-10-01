import * as React from 'react'
import { cn } from '@/lib/utils'

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-sm border border-border bg-surface px-3 py-2 text-base text-text shadow-none transition-colors placeholder:text-text-tertiary focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/15 disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:text-sm',
        error && 'border-red focus:border-red focus:ring-red/15',
        className
      )}
      {...props}
    />
  )
)
FormInput.displayName = 'FormInput'

export interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const FormSelect = React.forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ className, error, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-11 w-full rounded-sm border border-border bg-surface px-3 py-2 text-base text-text shadow-none transition-colors focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/15 disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:text-sm',
        error && 'border-red focus:border-red focus:ring-red/15',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
)
FormSelect.displayName = 'FormSelect'
