/**
 * Phone helpers — one canonical format everywhere (login, client creation,
 * import, admin edit, profile, duplicate checks).
 *
 * Stored format: digits only ("771234567") so the UNIQUE constraints and
 * resolve_login_identifier always match regardless of input spacing.
 */

/** "77 123 45 67" / "+221 77 123 45 67" -> "221771234567"-style digits. */
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return ''
  return input.replace(/\D/g, '')
}

/** "771234567" -> "77 123 45 67" (Senegal mobile grouping, display only). */
export function formatPhone(digits: string | null | undefined): string {
  if (!digits) return ''
  const m = digits.match(/^(\d{2})(\d{3})(\d{2})(\d{2})$/)
  if (m) return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`
  // Fallback: right-aligned pairs for other digit counts.
  return digits.replace(/\B(?=(\d{2})+(?!\d))/g, ' ').trim()
}

/** True when the text is phone-shaped: digits, spaces, plus — no '@', no letters. */
export function looksLikePhone(input: string): boolean {
  return /^[\d\s+.-]+$/.test(input.trim()) && /\d/.test(input)
}
