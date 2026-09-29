/**
 * Validation for the kiosques CSV import — pure logic so the rules are
 * testable without Supabase or file I/O.
 *
 * Duplicate = same normalized name as another row in the file OR as a
 * kiosque already in the base. "Normalized" = trimmed, lowercased, accents
 * folded, spaces collapsed.
 */

export interface KiosqueImportRow {
  nom: string
  adresse: string
}

export interface KiosqueValidationResult<T> {
  /** Rows with a usable name (duplicates included — skipped separately). */
  valid: T[]
  /** Per-row duplicate flag, same index as the input rows. */
  duplicateFlags: boolean[]
  invalidCount: number
  duplicateCount: number
}

export function normalizeKiosqueName(nom: string): string {
  return nom
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function validateKiosqueRows<T extends KiosqueImportRow>(
  rows: T[],
  baseNames: string[]
): KiosqueValidationResult<T> {
  const baseSet = new Set(baseNames.map(normalizeKiosqueName))
  const seenInFile = new Set<string>()

  const flagged = rows.map((row) => {
    const invalid = row.nom.trim().length === 0
    const normalized = normalizeKiosqueName(row.nom)
    const duplicate =
      !invalid && (baseSet.has(normalized) || seenInFile.has(normalized))
    if (!invalid && !duplicate) seenInFile.add(normalized)
    return { row, invalid, duplicate }
  })

  return {
    valid: flagged.filter((f) => !f.invalid).map((f) => f.row),
    duplicateFlags: flagged.map((f) => f.duplicate),
    invalidCount: flagged.filter((f) => f.invalid).length,
    duplicateCount: flagged.filter((f) => !f.invalid && f.duplicate).length,
  }
}
