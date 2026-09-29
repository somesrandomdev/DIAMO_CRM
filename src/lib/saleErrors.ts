/**
 * Human-readable diagnosis for sale-recording failures. The sale screen's
 * catch used to collapse every failure into "Erreur inconnue" (PostgREST
 * errors are plain objects, not Error instances) — this surfaces the real
 * reason instead, and never claims the network is down while online.
 */

const online = () => (typeof navigator !== 'undefined' ? navigator.onLine : true)

export function describeSaleError(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as { code?: string; message?: string }

    if (e.code === '42501')
      return "Permission refusée : votre kiosque ne permet pas cet enregistrement. Contactez l'administrateur."
    if (e.code === '23503')
      return 'Référence invalide : le client ou l\'offre n\'existe plus. Rechargez la page et réessayez.'
    if (e.code === '23505') return 'Cette vente semble être un doublon.'
    if (e.code === '23502')
      return "Champ obligatoire manquant : la vente est incomplète. Rechargez la page et réessayez."
    if (e.code === '22P02')
      return "Le client de cette vente n'est pas encore synchronisé. Il sera enregistré automatiquement à la reconnexion."
    if (isRetryableSaleError(error)) {
      // Honest phrasing: never claim "internet interrompu" while online —
      // retryable failures go through verification + retry + offline queue.
      return online()
        ? "Problème de connexion pendant l'enregistrement. Vérification en cours…"
        : 'Vous êtes hors ligne. Vente enregistrée localement.'
    }
    if (e.message) return e.message
  }
  if (error instanceof Error) return error.message
  return "Erreur inconnue lors de l'enregistrement."
}

/**
 * Retryable = the insert MAY have reached the server (network blip, gateway
 * hiccup) or may not have been sent at all. These go through the
 * verify-by-idempotency-key → retry → offline-queue flow, never a plain error.
 */
export function isRetryableSaleError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (error instanceof TypeError) return true // "Failed to fetch" & friends
  const text = [
    (error as { message?: string } | null)?.message ?? '',
    String(error),
  ]
    .join(' ')
    .toLowerCase()
  return /failed to fetch|networkerror|network error|timeout|timed out|502|503|504|bad gateway|service unavailable|gateway time-?out/.test(
    text
  )
}

/**
 * 23505 raised by idx_ventes_idempotency_key: the sale was ALREADY recorded
 * (retried request or double-click) — this is a success, not an error.
 */
export function isDuplicateIdempotencyError(error: unknown): boolean {
  const e = error as { code?: string; message?: string; details?: string } | null
  if (!e || e.code !== '23505') return false
  return `${e.message ?? ''} ${e.details ?? ''}`.toLowerCase().includes('idempotency')
}

/** Full forensic payload to the console so production reports are debuggable. */
export function logSaleError(context: string, error: unknown): void {
  const e = (error ?? {}) as {
    code?: string
    message?: string
    details?: string
    hint?: string
    name?: string
  }
  console.error(`[vente] ${context}:`, {
    code: e.code,
    name: e.name,
    message: e.message,
    details: e.details,
    hint: e.hint,
    navigatorOnline: typeof navigator !== 'undefined' ? navigator.onLine : null,
    serviceWorkerState:
      (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller?.state) ?? null,
    at: new Date().toISOString(),
  })
}
