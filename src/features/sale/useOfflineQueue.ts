import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/Toast'
import {
  flushOfflineSales,
  getQueuedSalesCount,
  queueOfflineSale,
  type QueuedSale,
} from '@/utils/offlineSalesQueue'
import { flushOfflineClients } from '@/utils/offlineClientQueue'

interface UseOfflineQueueOptions {
  /** Called after a successful flush so the caller can refresh its summary. */
  onFlushed?: () => void
}

/**
 * IndexedDB-backed offline sale queue: enqueue when offline, flush on
 * reconnect (inserts without tickets — ticket conflicts need a richer retry
 * workflow than the queue can offer).
 */
export function useOfflineQueue({ onFlushed }: UseOfflineQueueOptions = {}) {
  const { showToast } = useToast()
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  )
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncingQueue, setIsSyncingQueue] = useState(false)

  const refreshQueuedCount = useCallback(async () => {
    setPendingCount(await getQueuedSalesCount())
  }, [])

  const enqueueSale = useCallback(
    async (sale: Omit<QueuedSale, 'id' | 'queued_at'>) => {
      await queueOfflineSale(sale)
      await refreshQueuedCount()
    },
    [refreshQueuedCount]
  )

  const flushQueue = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    setIsSyncingQueue(true)
    try {
      // Clients first: offline-recorded sales reference them by placeholder
      // id and can only insert once the real uuid exists.
      const clientResult = await flushOfflineClients()
      if (clientResult.flushed > 0) {
        showToast({
          type: 'success',
          title: 'Clients synchronises',
          message: `${clientResult.flushed} client(s) hors ligne synchronise(s).`,
        })
      }

      const result = await flushOfflineSales(clientResult.clientIdMap)
      await refreshQueuedCount()

      if (result.flushed > 0) {
        showToast({
          type: 'success',
          title: 'Ventes synchronisees',
          message: `${result.flushed} vente(s) hors ligne synchronisee(s).`,
        })
        onFlushed?.()
      }

      if (result.failed > 0) {
        showToast({
          type: 'warning',
          title: 'Synchronisation partielle',
          message: `${result.failed} vente(s) restent en attente.`,
        })
      }
    } finally {
      setIsSyncingQueue(false)
    }
  }, [onFlushed, refreshQueuedCount, showToast])

  useEffect(() => {
    refreshQueuedCount()

    const handleOnline = () => {
      setIsOnline(true)
      flushQueue()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      flushQueue()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [flushQueue, refreshQueuedCount])

  return { isOnline, pendingCount, isSyncingQueue, enqueueSale, flushQueue }
}
