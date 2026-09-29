/**
 * Human-readable diagnosis for sale-recording failures. The sale screen's
 * catch used to collapse every failure into "Erreur inconnue" (PostgREST
 * errors are plain objects, not Error instances) — this surfaces the real
 * reason instead.
 */
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
    if (e.message?.toLowerCase().includes('fetch') || e.message?.toLowerCase().includes('network'))
      return 'Connexion internet interrompue. La vente peut être enregistrée hors ligne.'
    if (e.message) return e.message
  }
  if (error instanceof Error) return error.message
  return 'Erreur inconnue lors de l\'enregistrement.'
}

/** Full forensic payload to the console so production reports are debuggable. */
export function logSaleError(context: string, error: unknown): void {
  const summary =
    error && typeof error === 'object'
      ? {
          code: (error as { code?: string }).code,
          message: (error as { message?: string }).message,
          details: (error as { details?: string }).details,
          hint: (error as { hint?: string }).hint,
        }
      : String(error)
  console.error(`[vente] ${context}:`, summary)
}
