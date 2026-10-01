import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'border border-border bg-transparent text-foreground shadow-none hover:bg-muted focus:bg-muted active:bg-muted/80',
        primary:
          'border border-primary bg-primary text-primary-foreground shadow-none hover:bg-primary-hover focus:bg-primary-hover active:bg-primary-active',
        destructive:
          'border border-destructive bg-destructive text-destructive-foreground shadow-none hover:bg-destructive-hover focus:bg-destructive-hover active:bg-destructive-active',
        outline:
          'border border-border bg-transparent text-foreground shadow-none hover:border-primary hover:bg-muted hover:text-primary focus:bg-muted focus:border-primary active:bg-muted/80',
        secondary:
          'border border-teal bg-teal text-secondary-foreground shadow-none hover:bg-secondary-hover focus:bg-secondary-hover active:bg-secondary-active',
        ghost: 'text-foreground hover:bg-muted hover:text-primary focus:bg-muted active:bg-muted/80',
        link: 'text-primary underline-offset-4 hover:underline focus:underline',
        success:
          'border border-success bg-success text-success-foreground shadow-none hover:bg-success-hover focus:bg-success-hover active:bg-success-active',
        warning:
          'border border-warning bg-warning text-warning-foreground shadow-none hover:bg-warning-hover focus:bg-warning-hover active:bg-warning-active',
        // POS design system: Diam'o brand variants (water blue / deep blue / soft red)
        'pos-primary':
          'min-h-12 bg-[#006EBD] text-white hover:bg-[#005FA3] focus:bg-[#005FA3]',
        'pos-destructive':
          'min-h-12 bg-[#C62828] text-white hover:bg-[#A31F1F] focus:bg-[#A31F1F]',
        'pos-secondary':
          'min-h-12 border-2 border-[#DCE1E5] bg-white text-[#12364D] hover:border-[#12364D]',
      },
      size: {
        default: 'h-11 px-4 py-2',
        sm: 'h-9 min-h-9 rounded-md px-3 text-xs sm:h-8 sm:min-h-8',
        lg: 'h-12 rounded-md px-8',
        xl: 'h-12 rounded-lg px-10 text-base',
        icon: 'h-11 w-11',
        'icon-sm': 'h-10 min-h-10 w-10 min-w-10 sm:h-8 sm:min-h-8 sm:w-8 sm:min-w-8',
        'icon-lg': 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  /** Shown next to the spinner while loading — name the action ("Suppression…"). */
  loadingText?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingText = 'Chargement…', disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>{loadingText}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
