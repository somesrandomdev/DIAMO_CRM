/**
 * Règles de suppression de vente (miroir frontend de la RPC delete_vente).
 * Pur et testable sans Supabase ni composants.
 */

const WINDOW_MS = 24 * 3600_000

/**
 * Fenêtre de suppression : fontainier/commercial limités à 24 h ;
 * l'administrateur n'a pas de limite.
 */
export function canDeleteVente(createdAt: string, role: string): boolean {
  if (role === 'administrateur') return true
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
