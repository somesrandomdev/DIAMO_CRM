import { memo } from 'react'
import { cn } from '@/lib/utils'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
  className?: string
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-3',
  lg: 'h-12 w-12 border-4',
}

const textSizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}

/**
 * Loading spinner component with optional text
 * Provides consistent loading states across the application
 */
export const Loading = memo(function Loading({
  size = 'md',
  text,
  fullScreen = false,
  className = '',
}: LoadingProps) {
  const content = (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div
        className={cn(
          'rounded-full animate-spin border-muted border-t-primary',
          sizeClasses[size]
        )}
      />
      {text && (
        <p className={cn('text-muted-foreground', textSizeClasses[size])}>
          {text}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-background/90">
        {content}
      </div>
    )
  }

  return content
})
