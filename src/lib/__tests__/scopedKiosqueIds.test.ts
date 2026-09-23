import { scopedKiosqueIds } from '../commercialStats'

describe('scopedKiosqueIds', () => {
  const dataKeys = ['k-with-data-1', 'k-with-data-2']
  const allKiosks = ['k-with-data-1', 'k-with-data-2', 'k-empty-3', 'k-empty-4']

  it('with an active filter, renders ONLY the selected kiosques', () => {
    const ids = scopedKiosqueIds(['k-with-data-2'], dataKeys, allKiosks)
    expect(ids).toEqual(['k-with-data-2'])
  })

  it('a filtered view never pads the list with unselected kiosks at zero', () => {
    const ids = scopedKiosqueIds(['k-empty-3'], dataKeys, allKiosks)
    expect(ids).toEqual(['k-empty-3'])
    expect(ids).not.toContain('k-with-data-1')
  })

  it('with no filter, returns the full roster (data keys + every known kiosque)', () => {
    const ids = scopedKiosqueIds([], dataKeys, allKiosks)
    expect(ids).toHaveLength(4)
    expect(ids).toContain('k-empty-3')
  })

  it('deduplicates', () => {
    const ids = scopedKiosqueIds(['a', 'a', 'b'], ['a'], ['a', 'b'])
    expect(new Set(ids).size).toBe(ids.length)
  })
})
