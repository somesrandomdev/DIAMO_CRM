import { useCallback, useEffect, useRef, useState } from 'react'
import { handleSupabaseError, supabase } from '@/lib/supabase'

/**
 * Server-side paged list backed by a Postgres function returning
 * `{ total, rows, ...extra }` as ONE json value (never capped by PostgREST's
 * row limit). Params changes refetch page 1; loadMore() appends the next page.
 * Stale responses (params changed mid-flight) are dropped.
 */
export interface PagedRpcState<Row, Extra> {
  rows: Row[]
  total: number
  /** Everything the function returns besides total/rows (totals, counts…). */
  extra: Extra | null
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
  reload: () => void
}

type PagedPayload<Row> = { total?: number; rows?: Row[] } & Record<string, unknown>

interface PagedRpcOptions {
  pageSize?: number
  /** Bump to refetch page 1 with unchanged params (after an edit/import). */
  refreshKey?: number
}

export function usePagedRpc<Row, Extra = Record<string, unknown>>(
  fn: string | null,
  params: Record<string, unknown>,
  { pageSize = 25, refreshKey = 0 }: PagedRpcOptions = {}
): PagedRpcState<Row, Extra> {
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [extra, setExtra] = useState<Extra | null>(null)
  const [isLoading, setIsLoading] = useState(fn !== null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const rowCount = useRef(0)
  // Params compared by value: callers pass inline objects.
  const paramsKey = JSON.stringify(params)

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      const id = ++requestId.current
      if (!fn) {
        setRows([])
        setTotal(0)
        setExtra(null)
        setIsLoading(false)
        return
      }
      if (append) setIsLoadingMore(true)
      else setIsLoading(true)

      const { data, error: rpcError } = await supabase.rpc(fn, {
        ...(JSON.parse(paramsKey) as Record<string, unknown>),
        p_limit: pageSize,
        p_offset: offset,
      })
      if (id !== requestId.current) return

      if (rpcError) {
        console.error(`[${fn}]`, rpcError.code, rpcError.message)
        setError(handleSupabaseError(rpcError))
        if (!append) {
          setRows([])
          setTotal(0)
          setExtra(null)
          rowCount.current = 0
        }
      } else {
        const { total: nextTotal, rows: page, ...rest } = (data ?? {}) as PagedPayload<Row>
        const pageRows = page ?? []
        setRows((previous) => (append ? [...previous, ...pageRows] : pageRows))
        rowCount.current = (append ? rowCount.current : 0) + pageRows.length
        setTotal(Number(nextTotal ?? 0))
        setExtra(rest as Extra)
        setError(null)
      }
      setIsLoading(false)
      setIsLoadingMore(false)
    },
    [fn, paramsKey, pageSize]
  )

  useEffect(() => {
    void fetchPage(0, false)
  }, [fetchPage, refreshKey])

  const loadMore = useCallback(() => void fetchPage(rowCount.current, true), [fetchPage])
  const reload = useCallback(() => void fetchPage(0, false), [fetchPage])

  return {
    rows,
    total,
    extra,
    isLoading,
    isLoadingMore,
    error,
    hasMore: rows.length < total,
    loadMore,
    reload,
  }
}

/** Every row of a paged function (exports), fetched in pages of 200. */
export async function fetchAllRpcRows<Row>(fn: string, params: Record<string, unknown>): Promise<Row[]> {
  const all: Row[] = []
  for (;;) {
    const { data, error } = await supabase.rpc(fn, { ...params, p_limit: 200, p_offset: all.length })
    if (error) throw error
    const { total, rows } = (data ?? {}) as PagedPayload<Row>
    all.push(...(rows ?? []))
    if (!rows?.length || all.length >= Number(total ?? 0)) return all
  }
}
