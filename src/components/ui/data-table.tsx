import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDownUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DataTableColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  sortValue?: (row: T) => string | number | Date | null | undefined
  align?: 'left' | 'right' | 'center'
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
  emptyMessage?: string
  className?: string
}

function compareValues(a: unknown, b: unknown) {
  const left = a instanceof Date ? a.getTime() : a
  const right = b instanceof Date ? b.getTime() : b

  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left ?? '').localeCompare(String(right ?? ''))
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  onRowClick,
  emptyMessage = 'Aucune donnee a afficher.',
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')

  const sortedData = useMemo(() => {
    const column = columns.find((item) => item.key === sortKey)
    if (!column?.sortValue) return data

    return [...data].sort((a, b) => {
      const modifier = direction === 'asc' ? 1 : -1
      return compareValues(column.sortValue?.(a), column.sortValue?.(b)) * modifier
    })
  }, [columns, data, direction, sortKey])

  const requestSort = (column: DataTableColumn<T>) => {
    if (!column.sortValue) return
    if (sortKey === column.key) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(column.key)
    setDirection('asc')
  }

  return (
    <div className={cn('overflow-x-auto [-webkit-overflow-scrolling:touch]', className)}>
      <table className="w-full min-w-[680px] border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-border bg-muted">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary',
                  column.align === 'right' && 'text-right',
                  column.align === 'center' && 'text-center',
                  (!column.align || column.align === 'left') && 'text-left'
                )}
              >
                <button
                  type="button"
                  className={cn(
                    'inline-flex min-h-8 items-center gap-1 rounded-sm text-inherit',
                    column.sortValue && 'cursor-pointer hover:text-text'
                  )}
                  onClick={() => requestSort(column)}
                  disabled={!column.sortValue}
                >
                  {column.header}
                  {column.sortValue && <ArrowDownUp className="h-3 w-3" />}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row) => (
            <tr
              key={getRowKey(row)}
              className={cn(
                'border-b border-border last:border-0 hover:bg-muted',
                onRowClick && 'cursor-pointer'
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-3 py-3 align-middle text-text',
                    column.align === 'right' && 'text-right',
                    column.align === 'center' && 'text-center'
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {sortedData.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-text-tertiary">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
