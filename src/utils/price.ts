// src/utils/price.ts

/**
 * Formats an amount as readable CFA currency.
 *
 * CFA francs have no subunit, so amounts are rounded to whole francs.
 * Thousands are grouped with a narrow no-break space (U+202F), which is the
 * correct French typographic separator: "1 250 000 CFA" instead of "1250000 CFA".
 *
 * Grouping is done manually rather than via Intl.NumberFormat so the output is
 * byte-stable across Node/ICU versions (Intl switched its fr-FR group separator
 * between ICU releases, which makes snapshot tests brittle).
 */
export const toCFA = (amount: number): string => {
  if (!Number.isFinite(amount)) return '0 CFA'

  const rounded = Math.round(amount)
  const sign = rounded < 0 ? '-' : ''
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

  return `${sign}${grouped} CFA`
}

/**
 * Formats an amount compactly for chart axes and tight spaces.
 * 1_250_000 -> "1,3 M"   12_500 -> "12,5 k"   840 -> "840"
 *
 * Uses a comma as the decimal separator (French convention). The " CFA" suffix
 * is intentionally omitted: axis labels repeat many times and the unit belongs
 * in the axis title or tooltip, not on every tick.
 */
export const formatCFACompact = (amount: number): string => {
  if (!Number.isFinite(amount)) return '0'

  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)

  const trim = (value: number): string => {
    // At most one decimal, and drop a trailing ",0" so "1,0 M" renders as "1 M".
    const fixed = Math.round(value * 10) / 10
    return Number.isInteger(fixed)
      ? String(fixed)
      : String(fixed).replace('.', ',')
  }

  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)} M`
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000)} k`
  return `${sign}${Math.round(abs)}`
}

/**
 * Formats a whole-number count with French thousands grouping.
 * Used for ticket/transaction counts so "12 480" is readable at a glance.
 */
export const formatCount = (value: number): string => {
  if (!Number.isFinite(value)) return '0'
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}
