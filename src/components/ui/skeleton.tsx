import { cn } from '@/lib/utils'

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // shimmer (translateX) au lieu du simple pulse — plus « vivant », zéro layout thrash
      className={cn('skeleton-shimmer rounded-md bg-muted', className)}
      {...props}
    />
  )
}

export { Skeleton }
