import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      window.setInterval(() => registration.update(), 60 * 60 * 1000)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-md border border-border bg-surface p-4 shadow-lg sm:left-auto sm:w-80">
      <p className="text-[13px] font-semibold text-text">Nouvelle version disponible</p>
      <p className="mt-1 text-[12px] text-text-secondary">
        Mettez a jour pour acceder aux dernieres fonctionnalites.
      </p>
      <Button
        type="button"
        variant="primary"
        className="mt-3 w-full"
        onClick={() => updateServiceWorker(true)}
      >
        Mettre a jour
      </Button>
    </div>
  )
}
