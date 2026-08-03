import { formatCFACompact, formatCount, toCFA } from '../price'

// U+202F narrow no-break space — the French thousands separator used by toCFA.
const NBSP = ' '

describe('toCFA', () => {
  it('formats whole amounts with the CFA suffix', () => {
    expect(toCFA(100)).toBe('100 CFA')
    expect(toCFA(0)).toBe('0 CFA')
  })

  it('groups thousands with a narrow no-break space', () => {
    expect(toCFA(2500)).toBe(`2${NBSP}500 CFA`)
    expect(toCFA(1000000)).toBe(`1${NBSP}000${NBSP}000 CFA`)
  })

  it('rounds to whole francs (CFA has no subunit)', () => {
    expect(toCFA(100.5)).toBe('101 CFA')
    expect(toCFA(99.99)).toBe('100 CFA')
    expect(toCFA(999999.99)).toBe(`1${NBSP}000${NBSP}000 CFA`)
  })

  it('keeps the sign on negative amounts', () => {
    expect(toCFA(-100)).toBe('-100 CFA')
    expect(toCFA(-2500)).toBe(`-2${NBSP}500 CFA`)
  })

  it('falls back to 0 for non-finite input', () => {
    expect(toCFA(Number.NaN)).toBe('0 CFA')
    expect(toCFA(Number.POSITIVE_INFINITY)).toBe('0 CFA')
  })
})

describe('formatCFACompact', () => {
  it('abbreviates millions and thousands to one decimal', () => {
    expect(formatCFACompact(1_250_000)).toBe('1,3 M')
    expect(formatCFACompact(1_240_000)).toBe('1,2 M')
    expect(formatCFACompact(12_500)).toBe('12,5 k')
    expect(formatCFACompact(840)).toBe('840')
  })

  it('drops a trailing zero decimal', () => {
    expect(formatCFACompact(1_000_000)).toBe('1 M')
    expect(formatCFACompact(2_000)).toBe('2 k')
  })

  it('handles zero and negatives', () => {
    expect(formatCFACompact(0)).toBe('0')
    expect(formatCFACompact(-12_500)).toBe('-12,5 k')
  })
})

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(12_480)).toBe(`12${NBSP}480`)
    expect(formatCount(7)).toBe('7')
  })

  it('falls back to 0 for non-finite input', () => {
    expect(formatCount(Number.NaN)).toBe('0')
  })
})
