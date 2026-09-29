import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface VirtualizedListProps<T> {
  items: T[]
  getKey: (item: T, index: number) => string
  /** Estimated height (px) of one row; measured dynamically after render. */
  estimateSize: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  overscan?: number
  ariaLabel?: string
}

/**
 * Vertical windowing for long card lists: only visible rows (+ overscan)
 * are rendered. Rows are measured dynamically (variable heights supported).
 */
export function VirtualizedList<T>({
  items,
  getKey,
  estimateSize,
  renderItem,
  className = '',
  overscan = 5,
  ariaLabel,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: (index) => getKey(items[index], index),
  })

  return (
    <div
      ref={parentRef}
      className={`overflow-y-auto ${className}`}
      aria-label={ariaLabel}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
          width: '100%',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index]
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
