import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

/**
 * Version-update prompt (registerType: 'prompt'). The service worker never
 * activates a new version by itself: when one is downloaded, this card
 * slides up and the user chooses — update now (one tap, reloads) or dismiss
 * (won't re-show until the NEXT version). Checks run on load and every
 * 30 minutes, so nobody is stuck on an old build for long.
 */
export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      window.setInterval(() => registration.update(), 30 * 60 * 1000)
    },
    onRegisterError(error) {
      console.error('SW registration error:', error)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="animate-slide-up fixed bottom-4 left-4 right-4 z-[100]">
      <div className="mx-auto max-w-md rounded-xl bg-[#009EFB] p-4 text-white shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold">Nouvelle version disponible</p>
              <p className="text-xs opacity-90">
                Rechargez pour profiter des dernières améliorations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-white/20"
            aria-label="Fermer"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="w-full rounded-lg bg-white py-3 text-sm font-semibold text-[#009EFB] transition-all hover:bg-white/90 active:scale-[0.98]"
        >
          Mettre à jour maintenant
        </button>
      </div>
    </div>
  )
}
