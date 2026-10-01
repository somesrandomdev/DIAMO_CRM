/**
 * Règles de suppression de vente (miroir frontend de la RPC delete_vente).
 * Pur et testable sans Supabase ni composants.
 */

const WINDOW_MS = 24 * 3600_000

/**
 * Fenêtre de suppression (miroir de la RPC delete_vente):
 *  - administrateur : tout, sans limite de fenêtre
 *  - commercial     : ventes des kiosques supervisés de moins de 24 h
 *  - fontainier     : jamais (suppression réservée commerciaux + admin)
 *
 * `inSupervisedScope` reflète le contrôle kiosque de la RPC ; l'écran
 * d'historique liste déjà uniquement des ventes dans le périmètre du rôle,
 * donc la valeur y est toujours true — le paramètre reste explicite pour
 * que le miroir soit vérifiable et testé.
 */
export function canDeleteVente(
  createdAt: string,
  role: string,
  inSupervisedScope = true
): boolean {
  if (role === 'administrateur') return true
  if (role !== 'commercial') return false
  if (!inSupervisedScope) return false
  return Date.now() - new Date(createdAt).getTime() < WINDOW_MS
}

export type DeleteMotif = 'Erreur de saisie' | 'Doublon' | 'Retour client' | 'Autre'

/**
 * Validation locale du dialog : motif obligatoire, commentaire obligatoire
 * si le motif est « Autre ». Retourne null si valide, sinon le message.
 */
export function validateDeleteVente(motif: string, comment: string): string | null {
  if (!motif) return 'Choisissez un motif de suppression.'
  if (motif === 'Autre' && comment.trim().length === 0) {
    return 'Un commentaire est obligatoire pour le motif « Autre ».'
  }
  return null
}
