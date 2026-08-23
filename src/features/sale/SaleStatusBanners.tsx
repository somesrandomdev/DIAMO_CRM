import { Button } from '@/components/ui/button'

interface SaleStatusBannersProps {
  isOnline: boolean
  pendingCount: number
  isSyncingQueue: boolean
  onSync: () => void
}

/** Offline-mode warning + pending-queue status with manual sync trigger. */
export function SaleStatusBanners({
  isOnline,
  pendingCount,
  isSyncingQueue,
  onSync,
}: SaleStatusBannersProps) {
  return (
    <>
      {!isOnline && (
        <div className="rounded-md border-2 border-amber-500 bg-amber-50 p-3 text-xs">
          <p className="font-semibold uppercase tracking-wider text-amber-700">Mode hors ligne</p>
          <p className="mt-1 text-zinc-600">
            La prochaine vente valide sera conservee sur cet appareil puis synchronisee a la
            reconnexion.
          </p>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="flex flex-col gap-2 rounded-md border-2 border-blue-500 bg-blue-50 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="text-zinc-700">
            {pendingCount} vente(s) en attente de synchronisation
            {isSyncingQueue ? ' - synchronisation en cours' : ''}
          </span>
          {isOnline && (
            <Button
              type="button"
              variant="pos-secondary"
              size="sm"
              onClick={onSync}
              disabled={isSyncingQueue}
            >
              Synchroniser
            </Button>
          )}
        </div>
      )}
    </>
  )
}
