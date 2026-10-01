/**
 * Coordinateur de mise à jour forcée — machine à états partagée entre
 * AppUpdateManager (rendu) et les gardes de sécurité (panier de vente).
 *
 * Phases:
 *  - 'idle'    : aucun update en attente
 *  - 'pending' : update détecté MAIS moment non sûr (panier non vide) → bannière
 *  - 'active'  : moment sûr → UpdateGate bloquant plein écran
 *
 * La file hors-ligne vit en IndexedDB: un reload ne la perd jamais, le flush
 * reprend au montage de l'écran de vente après rechargement.
 */
import { APP_BUILD } from '@/lib/build'

export type UpdatePhase = 'idle' | 'pending' | 'active'

export interface UpdateBuilds {
  oldBuild: string
  newBuild: string
}

let phase: UpdatePhase = 'idle'
let builds: UpdateBuilds = { oldBuild: APP_BUILD, newBuild: '' }
let unsafeGuard: (() => boolean) | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

/** Un build servi différent du build courant = mise à jour requise. */
export function needsUpdate(currentBuild: string, servedBuild: string): boolean {
  return servedBuild.trim().length > 0 && servedBuild !== currentBuild
}

/** Update détecté (controllerchange, FORCE_UPDATE ou version.json diff). */
export function markUpdateAvailable(newBuild: string): void {
  if (phase !== 'idle') return
  builds = { oldBuild: APP_BUILD, newBuild: newBuild || 'inconnu' }
  phase = 'pending'
  evaluateSafety()
}

/**
 * Garde de "moment non sûr" (ex: panier de vente non vide). Register par
 * l'écran concerné ; unregister (null) au démontage = re-évaluation.
 */
export function setUpdateUnsafeGuard(guard: (() => boolean) | null): void {
  unsafeGuard = guard
  evaluateSafety()
}

/** Bascule pending → active dès que le moment est sûr. */
export function evaluateSafety(): void {
  if (phase === 'pending' && !(unsafeGuard?.() ?? false)) {
    phase = 'active'
    emit()
  }
}

export function getUpdatePhase(): UpdatePhase {
  return phase
}

export function getUpdateBuilds(): UpdateBuilds {
  return builds
}

export function subscribeUpdate(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Test-only: réinitialise la machine à états. */
export function _resetUpdateCoordinatorForTests(): void {
  phase = 'idle'
  builds = { oldBuild: APP_BUILD, newBuild: '' }
  unsafeGuard = null
  listeners.clear()
}
