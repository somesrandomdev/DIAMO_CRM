import { act, renderHook, waitFor } from '@testing-library/react'

/**
 * usePagedRpc: server-paged lists of the scalable pages (kiosk_overview,
 * kiosk_clients, fontainier_performance).
 */

const mockRpc = jest.fn()
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
  handleSupabaseError: (error: { message?: string }) => error.message ?? 'erreur',
}))

import { fetchAllRpcRows, usePagedRpc } from '../usePagedRpc'

type Row = { id: number }
const page = (from: number, count: number, total: number, extra: Record<string, unknown> = {}) => ({
  data: { total, rows: Array.from({ length: count }, (_, index) => ({ id: from + index })), ...extra },
  error: null,
})

beforeEach(() => mockRpc.mockReset())

describe('usePagedRpc', () => {
  it('page 1 : envoie params + p_limit/p_offset, expose total, rows et extra', async () => {
    mockRpc.mockResolvedValueOnce(page(0, 2, 5, { totals: { ca: 42 } }))
    const { result } = renderHook(() => usePagedRpc<Row>('kiosk_overview', { p_sort: 'ca' }, { pageSize: 2 }))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(mockRpc).toHaveBeenCalledWith('kiosk_overview', { p_sort: 'ca', p_limit: 2, p_offset: 0 })
    expect(result.current.rows.map((row) => row.id)).toEqual([0, 1])
    expect(result.current.total).toBe(5)
    expect(result.current.extra).toEqual({ totals: { ca: 42 } })
    expect(result.current.hasMore).toBe(true)
  })

  it('loadMore ajoute la page suivante (offset = lignes déjà chargées)', async () => {
    mockRpc.mockResolvedValueOnce(page(0, 2, 3)).mockResolvedValueOnce(page(2, 1, 3))
    const { result } = renderHook(() => usePagedRpc<Row>('fn', {}, { pageSize: 2 }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.loadMore())
    await waitFor(() => expect(result.current.rows).toHaveLength(3))
    expect(mockRpc).toHaveBeenLastCalledWith('fn', { p_limit: 2, p_offset: 2 })
    expect(result.current.hasMore).toBe(false)
  })

  it('changement de paramètres : repart de la page 1 (pas d’ajout)', async () => {
    mockRpc.mockResolvedValueOnce(page(0, 2, 2)).mockResolvedValueOnce(page(10, 1, 1))
    const { result, rerender } = renderHook(({ search }) => usePagedRpc<Row>('fn', { p_search: search }), {
      initialProps: { search: 'a' },
    })
    await waitFor(() => expect(result.current.rows).toHaveLength(2))

    rerender({ search: 'ab' })
    await waitFor(() => expect(result.current.rows.map((row) => row.id)).toEqual([10]))
    expect(mockRpc).toHaveBeenLastCalledWith('fn', { p_search: 'ab', p_limit: 25, p_offset: 0 })
  })

  it('réponse périmée ignorée : la recherche la plus récente gagne même si elle répond en premier', async () => {
    let resolveSlow: (value: unknown) => void = () => undefined
    mockRpc
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSlow = resolve)))
      .mockResolvedValueOnce(page(100, 1, 1))
    const { result, rerender } = renderHook(({ search }) => usePagedRpc<Row>('fn', { p_search: search }), {
      initialProps: { search: 'lent' },
    })
    rerender({ search: 'rapide' })
    await waitFor(() => expect(result.current.rows.map((row) => row.id)).toEqual([100]))

    await act(async () => resolveSlow(page(0, 3, 3)))
    expect(result.current.rows.map((row) => row.id)).toEqual([100])
  })

  it('mêmes paramètres dans un nouvel objet à chaque rendu : pas de requête en boucle', async () => {
    mockRpc.mockResolvedValue(page(0, 1, 1))
    const { result, rerender } = renderHook(() => usePagedRpc<Row>('fn', { p_sort: 'nom' }))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    rerender()
    rerender()
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it('refreshKey : recharge la page 1 sans envoyer de paramètre inconnu à la fonction SQL', async () => {
    mockRpc.mockResolvedValue(page(0, 1, 1))
    const { result, rerender } = renderHook(({ key }) => usePagedRpc<Row>('fn', { p_sort: 'nom' }, { refreshKey: key }), {
      initialProps: { key: 0 },
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    rerender({ key: 1 })
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2))
    for (const call of mockRpc.mock.calls) {
      expect(Object.keys(call[1]).sort()).toEqual(['p_limit', 'p_offset', 'p_sort'])
    }
  })

  it('erreur : message exposé, liste vide, pas de crash', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'interdit' } })
    const { result } = renderHook(() => usePagedRpc<Row>('fn', {}))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('interdit')
    expect(result.current.rows).toEqual([])
    expect(result.current.hasMore).toBe(false)
  })

  it('fn null : aucune requête', async () => {
    const { result } = renderHook(() => usePagedRpc<Row>(null, {}))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(mockRpc).not.toHaveBeenCalled()
  })
})

describe('fetchAllRpcRows (exports CSV)', () => {
  it('enchaîne les pages de 200 jusqu’au total', async () => {
    mockRpc.mockResolvedValueOnce(page(0, 200, 250)).mockResolvedValueOnce(page(200, 50, 250))
    const rows = await fetchAllRpcRows<Row>('kiosk_overview', { p_sort: 'ca' })
    expect(rows).toHaveLength(250)
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'kiosk_overview', { p_sort: 'ca', p_limit: 200, p_offset: 200 })
  })

  it('s’arrête sur une page vide (total incohérent) et propage les erreurs', async () => {
    mockRpc.mockResolvedValueOnce(page(0, 0, 10))
    await expect(fetchAllRpcRows<Row>('fn', {})).resolves.toEqual([])
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('réseau') })
    await expect(fetchAllRpcRows<Row>('fn', {})).rejects.toThrow('réseau')
  })
})
