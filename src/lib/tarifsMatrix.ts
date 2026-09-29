import { formatFrenchNumber } from './ticketFormat'

/**
 * Pure logic for the tarifs matrix (offres × kiosques): cell keys, batching,
 * suspect-price detection, undo stack cap.
 */

export const cellKey = (kiosqueId: string, offreId: string): string =>
  `${kiosqueId}__${offreId}`

export interface PendingUpsert {
  kiosque_id: string
  offre_id: string
  prix: number
}

/** Max rows per upsert request. */
export const UPSERT_BATCH_SIZE = 20

export function chunkBatch<T>(items: T[], size: number = UPSERT_BATCH_SIZE): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

/** A price is suspect when zero or suspiciously low (< 10 CFA). */
export function isSuspectPrice(prix: number): boolean {
  return prix < 10
}

export function formatCellPrice(prix: number): string {
  return `${formatFrenchNumber(prix)} CFA`
}

/** Undo stack cap. */
export const UNDO_STACK_LIMIT = 10

export function pushUndoLimited(
  stack: Array<{ cell: string; prev: number | null }>,
  entry: { cell: string; prev: number | null }
): Array<{ cell: string; prev: number | null }> {
  const next = [...stack, entry]
  return next.slice(-UNDO_STACK_LIMIT)
}

/** Split a prix into a display-ready CFA string (French spacing). */
export const formatPrixCell = (prix: number): string => formatFrenchNumber(prix)
