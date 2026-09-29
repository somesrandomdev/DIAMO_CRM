/**
 * Ticket text-formatting helpers — kept free of jsPDF so tests import them
 * without pulling the PDF engine into the Jest module graph.
 */

/** French spacing: 700 -> "700", 12500 -> "12 500". */
export function formatFrenchNumber(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** "10 000 ml" -> "10L" when divisible by 1000, else "10 000 ml". */
export function formatVolume(volumeMl: number): string {
  if (volumeMl >= 1000 && volumeMl % 1000 === 0) return `${formatFrenchNumber(volumeMl / 1000)}L`
  return `${formatFrenchNumber(volumeMl)} ml`
}

/**
 * Storage path for a sale's ticket PDF. The storage RLS policy checks that
 * the FIRST path segment equals the uploader's kiosque_id — a root-level
 * file would be rejected.
 */
export function ticketPath(kiosqueId: string, saleId: string): string {
  return `${kiosqueId}/ticket-${saleId}.pdf`
}
