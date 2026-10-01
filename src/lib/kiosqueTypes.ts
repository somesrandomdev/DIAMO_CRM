/**
 * Types de kiosques (KEP/KEF + extensibles) — résolution et styles de badge.
 * Pure logic, testable sans Supabase.
 */

export interface KiosqueType {
  code: string
  label: string
}

/** Styles de badge par code connu (KEP bleu, KEF vert, autres gris). */
export function typeBadgeClass(code: string | null): string {
  if (!code) return 'border-amber/40 bg-amber-light text-amber' // sans type = outline orange
  switch (code) {
    case 'KEP':
      return 'border-blue/30 bg-blue-light text-blue'
    case 'KEF':
      return 'border-teal/30 bg-teal-light text-teal'
    default:
      return 'border-border bg-muted text-text-secondary'
  }
}

/** Code saisi → majuscules, trim. */
export function normalizeTypeCode(code: string): string {
  return code.trim().toUpperCase()
}

export interface TypeResolution {
  /** Code du type résolu, ou null si vide. */
  code: string | null
  /** True si le type est fourni mais introuvable (code ni label). */
  unknown: boolean
}

/**
 * Résolution du type d'un CSV/switch :
 * - vide → NULL (pas d'erreur)
 * - correspondance exacte par code, puis label insensible à la casse
 * - toujours inconnu → unknown: true
 */
export function resolveTypeCode(rawType: string, types: KiosqueType[]): TypeResolution {
  const value = rawType.trim()
  if (!value) return { code: null, unknown: false }

  const exact = types.find((type) => type.code === value)
  if (exact) return { code: exact.code, unknown: false }

  const lower = value.toLowerCase()
  const byLabel = types.find(
    (type) => type.label.toLowerCase() === lower || type.code.toLowerCase() === lower
  )
  if (byLabel) return { code: byLabel.code, unknown: false }

  return { code: null, unknown: true }
}
