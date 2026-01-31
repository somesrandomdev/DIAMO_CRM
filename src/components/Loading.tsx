import React from 'react'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
  className?: string
}

/**
 * Loading spinner component with optional text
 * Provides consistent loading states across the application
 */
export function Loading({ size = 'md', text, fullScreen = false, className = '' }: LoadingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  }

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }

  const content = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full animate-spin`}
        style={{
          borderColor: 'var(--color-border)',
          borderTopColor: 'var(--color-primary)',
        }}
      />
      {text && (
        <p className={textSizeClasses[size]} style={{ color: 'var(--color-text-secondary)' }}>
          {text}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}>
        {content}
      </div>
    )
  }

  return content
}

/**
 * Skeleton loader component for content placeholders
 * Provides visual feedback while content is loading
 */
interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave'
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  }

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
  }

  const style: React.CSSProperties = {
    width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : '100%',
    height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : '1rem',
  }

  return (
    <div
      className={`${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={{
        ...style,
        backgroundColor: 'var(--color-border)',
      }}
      aria-hidden="true"
    />
  )
}

/**
 * Page skeleton loader for dashboard pages
 */
export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton variant="text" width={200} height={32} />
        <Skeleton variant="rectangular" width={120} height={40} />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-6 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
            <Skeleton variant="text" width={100} height={20} className="mb-2" />
            <Skeleton variant="text" width={150} height={32} />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="p-6 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
        <Skeleton variant="text" width={150} height={24} className="mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton variant="circular" width={40} height={40} />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" width="60%" height={16} />
                <Skeleton variant="text" width="40%" height={14} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Table skeleton loader
 */
interface TableSkeletonProps {
  rows?: number
  columns?: number
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="w-full overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
      {/* Header */}
      <div className="flex gap-4 p-4 border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" width={100 + i * 20} height={20} />
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 p-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} variant="text" width={80 + colIndex * 30} height={16} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Card skeleton loader
 */
export function CardSkeleton() {
  return (
    <div className="p-6 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex items-start gap-4 mb-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="70%" height={20} />
          <Skeleton variant="text" width="50%" height={16} />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton variant="text" width="100%" height={14} />
        <Skeleton variant="text" width="90%" height={14} />
        <Skeleton variant="text" width="80%" height={14} />
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton variant="rectangular" width={100} height={36} />
        <Skeleton variant="rectangular" width={100} height={36} />
      </div>
    </div>
  )
}
