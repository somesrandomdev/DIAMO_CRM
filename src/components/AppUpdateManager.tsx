import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logInfo } from '@/lib/telemetry'
import {
  getUpdateBuilds,
  getUpdatePhase,
  markUpdateAvailable,
  subscribeUpdate,
  type UpdatePhase,
} from '@/lib/updateCoordinator'

/** Dernier build servi connu (version.json), pour le contexte telemetry. */
let lastServedBuild = ''

/**
 * Mise à jour forcée — auto-guérison:
 *  1. Au lancement: fetch version.json (no-store, contexte seulement) +
 *     registration.update() pour télécharger tout nouveau SW.
 *  2. Le SW est configuré skipWaiting+claim (vite.config): dès téléchargé il
 *     s'active et prend le contrôle → controllerchange sur la page.
 *  3. controllerchange / message FORCE_UPDATE → phase 'pending': bannière
 *     persistante NON fermable.
 *  4. Dès un moment sûr (garde panier désenregistrée ou panier vidé) →
 *     phase 'active': UpdateGate plein écran sans aucune sortie.
 * Le gate n'est JAMAIS déclenché par un diff de version: seul un nouveau SW
 * réellement actif compte (un 'build' mal injecté ne peut plus bloquer).
 * Le reload ne perd jamais la file hors-ligne (IndexedDB, reprise au montage
 * de l'écran de vente après rechargement).
 */
export function AppUpdateManager() {
  const [phase, setPhase] = useState<UpdatePhase>(getUpdatePhase())
  const builds = getUpdateBuilds()

  useEffect(
    () =>
      subscribeUpdate(() => {
        setPhase(getUpdatePhase())
        if (getUpdatePhase() === 'active') {
          logInfo('sw.force_update_shown', 'UpdateGate affiché', {
            oldBuild: getUpdateBuilds().oldBuild,
            newBuild: getUpdateBuilds().newBuild,
          })
        }
      }),
    []
  )

  // ── Détection ───────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    // Un controllerchange sur une page DÉJÀ contrôlée = un nouveau SW vient
    // de prendre le contrôle (skipWaiting+claim). Premier install = silencieux.
    const wasControlled = Boolean(navigator.serviceWorker.controller)
    const onControllerChange = () => {
      const servedBuild = lastServedBuild ?? ''
      markUpdateAvailable(servedBuild)
    }
    if (wasControlled) {
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    }

    // Message FORCE_UPDATE (SW custom, forward-compat)
    const onMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === 'FORCE_UPDATE') {
        markUpdateAvailable(lastServedBuild ?? '')
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)

    return () => {
      if (wasControlled) {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      }
      navigator.serviceWorker.removeEventListener('message', onMessage)
    }
  }, [])

  // ── Checks: lancement + 30 min + retour sur l'onglet ───────────────
  useEffect(() => {
    const check = async () => {
      // 1. Contexte seulement: le build réellement servi (telemetry). Ce diff
      //    ne déclenche JAMAIS le gate — seul un nouveau SW actif compte.
      try {
        const response = await fetch('/version.json', { cache: 'no-store' })
        if (response.ok) {
          const data = (await response.json()) as { build?: string }
          lastServedBuild = data.build ?? ''
        }
      } catch {
        // offline: peu importe, la détection passe par le SW
      }
      // 2. Force le téléchargement d'un éventuel nouveau SW — skipWaiting+claim
      //    l'activera, ce qui déclenchera le controllerchange ci-dessus.
      try {
        const registration = await navigator.serviceWorker?.getRegistration()
        await registration?.update()
      } catch {
        // silencieux
      }
    }

    void check()
    const interval = window.setInterval(() => void check(), 30 * 60 * 1000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // ── Application de la mise à jour ──────────────────────────────────
  const applyUpdate = () => {
    logInfo('sw.force_update_applied', 'rechargement pour mise à jour', {
      oldBuild: builds.oldBuild,
      newBuild: builds.newBuild,
    })
    window.location.reload()
  }

  if (phase === 'idle') return null

  if (phase === 'active') {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-bg p-4 text-center">
        <img src="/logo-principal.png" alt="Diam'o" className="mb-4 h-16 w-auto object-contain" />
        <RefreshCw className="mb-3 h-10 w-10 animate-spin text-[#006EBD]" aria-hidden="true" />
        <h1 className="text-lg font-bold text-text">Nouvelle version disponible</h1>
        <p className="mt-2 max-w-sm text-sm text-[#1C5376]">
          Appuyez sur le bouton pour mettre à jour l'application.
        </p>
        <Button variant="pos-primary" className="mt-6 h-14 w-full max-w-xs text-base" onClick={applyUpdate}>
          Mettre à jour
        </Button>
      </div>
    )
  }

  // phase === 'pending': moment non sûr (vente en saisie) → bannière persistante
  return (
    <div className="fixed inset-x-0 top-0 z-[90] flex items-center justify-between gap-3 bg-[#006EBD] px-3 py-2 text-white">
      <span className="text-xs font-semibold">Mise à jour disponible — Recharger</span>
      <Button
        type="button"
        variant="default"
        size="sm"
        className="bg-white text-[#006EBD] hover:bg-white/90"
        onClick={applyUpdate}
      >
        Recharger
      </Button>
    </div>
  )
}
