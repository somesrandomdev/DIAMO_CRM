import {
  chunkBatch,
  cellKey,
  formatPrixCell,
  isSuspectPrice,
  pushUndoLimited,
  UPSERT_BATCH_SIZE,
} from '../tarifsMatrix'

describe('tarifsMatrix', () => {
  it('cellKey joints kiosque et offre', () => {
    expect(cellKey('k-1', 'o-2')).toBe('k-1__o-2')
  })

  it('chunkBatch regroupe par 20 maximum', () => {
    const items = Array.from({ length: 45 }, (_, i) => i)
    const chunks = chunkBatch(items)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toHaveLength(20)
    expect(chunks[2]).toHaveLength(5)
  })

  it('chunkBatch avec moins d’éléments qu’un lot', () => {
    expect(chunkBatch([1, 2])).toEqual([[1, 2]])
  })

  it('UPSERT_BATCH_SIZE vaut 20', () => {
    expect(UPSERT_BATCH_SIZE).toBe(20)
  })

  it('isSuspectPrice: 0 et < 10 CFA sont suspects', () => {
    expect(isSuspectPrice(0)).toBe(true)
    expect(isSuspectPrice(5)).toBe(true)
    expect(isSuspectPrice(9)).toBe(true)
    expect(isSuspectPrice(10)).toBe(false)
    expect(isSuspectPrice(12500)).toBe(false)
  })

  it('formatPrixCell utilise l’espacement français', () => {
    expect(formatPrixCell(12500)).toBe('12 500')
    expect(formatPrixCell(700)).toBe('700')
  })

  it('pushUndoLimited plafonne la pile à 10 entrées', () => {
    let stack: Array<{ cell: string; prev: number | null }> = []
    for (let i = 0; i < 15; i += 1) {
      stack = pushUndoLimited(stack, { cell: `cell-${i}`, prev: i })
    }
    expect(stack).toHaveLength(10)
    expect(stack[0].cell).toBe('cell-5') // les 5 plus anciennes sont tombées
    expect(stack[9].cell).toBe('cell-14')
  })
})
