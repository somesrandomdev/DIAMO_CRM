import { useRegisterSW } from 'virtual:pwa-register/react'
import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { logError, logInfo } from '@/lib/telemetry'

/**
 * Dialog BLOQUANT de mise à jour : plus de mise à jour silencieuse ni de
 * precache coincé. Dès qu'une nouvelle version est détectée (au chargement
 * ou au check 30 min), l'utilisateur DOIT recharger — le bouton applique
 * skipWaiting (message SKIP_WAITING au SW) puis reload au controllerchange.
 */
export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      window.setInterval(() => registration.update(), 30 * 60 * 1000)
    },
    onRegisterError(error) {
      console.error('SW registration error:', error)
      logError('sw', "échec d'enregistrement du service worker", {
        message: error instanceof Error ? error.message : String(error),
      })
    },
  })

  useEffect(() => {
    if (needRefresh) {
      logInfo('sw', 'nouvelle version détectée — dialog bloquant affiché')
    }
  }, [needRefresh])

  return (
    <Dialog open={needRefresh} onOpenChange={() => undefined}>
      <DialogContent
        hideClose
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-[#009EFB]" aria-hidden="true" />
            Mise à jour disponible
          </DialogTitle>
        </DialogHeader>
        <p className="text-[13px] text-[#1C5376]">
          Une nouvelle version de l'application est prête. Rechargez maintenant pour en profiter —
          cela ne prend que quelques secondes.
        </p>
        <Button
          variant="pos-primary"
          className="h-14 w-full text-base"
          onClick={() => {
            logInfo('sw', 'rechargement utilisateur déclenché')
            void updateServiceWorker(true)
          }}
        >
          Recharger maintenant
        </Button>
      </DialogContent>
    </Dialog>
  )
}
