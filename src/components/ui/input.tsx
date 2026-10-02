import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Form fields — one style for Input, Select and Textarea.
 * fieldSize="lg": 48px touch target with a 2px border, for field screens
 * (sale, dialogs used on phones). Default: compact on desktop (sm:h-9).
 */
const fieldVariants = cva(
  'w-full bg-surface text-text shadow-none transition-colors placeholder:text-text-tertiary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      fieldSize: {
        default:
          'h-11 rounded-sm border border-border px-3 py-2 text-base focus:border-blue focus:ring-2 focus:ring-blue/15 sm:h-9 sm:text-sm',
        lg: 'h-12 rounded-md border-2 border-border px-3 text-base focus:border-text focus:ring-0',
      },
      error: {
        true: 'border-red focus:border-red focus:ring-red/15',
        false: '',
      },
    },
    defaultVariants: { fieldSize: 'default', error: false },
  }
)

type FieldVariantProps = Omit<VariantProps<typeof fieldVariants>, 'error'> & { error?: boolean }

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, FieldVariantProps {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, fieldSize, error, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        fieldVariants({ fieldSize, error }),
        'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement>, FieldVariantProps {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, fieldSize, error, children, ...props }, ref) => (
    <select ref={ref} className={cn(fieldVariants({ fieldSize, error }), className)} {...props}>
      {children}
    </select>
  )
)
Select.displayName = 'Select'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, FieldVariantProps {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, fieldSize, error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(fieldVariants({ fieldSize, error }), 'h-auto min-h-12 py-2', className)}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'

export { Input, Select, Textarea }
