import { useCallback, useEffect, useState } from 'react'
import { Clock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getQueuedSales, type QueuedSale } from '@/utils/offlineSalesQueue'
import { getQueuedClients } from '@/utils/offlineClientQueue'
import type { Client } from '@/stores/venteStore'
import { toCFA } from '@/utils/price'

interface PendingSalesBadgeProps {
  pendingCount: number
  isOnline: boolean
  isSyncing: boolean
  onSync: () => void | Promise<void>
  /** Kiosque clients, to show a name instead of an id. */
  clients: Client[]
}

interface PendingRow {
  id: string
  createdAt: string
  montant: number
  clientNom: string
}

/**
 * Orange "X en attente" badge next to the sale screen title (hidden at 0).
 * Opens the list of sales kept on this phone, with a manual sync button.
 */
export function PendingSalesBadge({ pendingCount, isOnline, isSyncing, onSync, clients }: PendingSalesBadgeProps) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<PendingRow[]>([])

  const loadRows = useCallback(async () => {
    const [sales, offlineClients] = await Promise.all([getQueuedSales(), getQueuedClients()])
    const names = new Map<string, string>([
      ...clients.map((client) => [client.id, client.nom] as [string, string]),
      ...offlineClients.map((client) => [client.offline_id, client.nom] as [string, string]),
    ])
    setRows(
      sales.map((sale: QueuedSale) => ({
        id: sale.id,
        createdAt: sale.created_at,
        montant: sale.items.reduce((sum, item) => sum + item.montant_total, 0),
        clientNom: names.get(sale.client_id) ?? 'Client',
      }))
    )
  }, [clients])

  // (Re)load whenever the dialog is open and the queue changes (sync).
  useEffect(() => {
    if (open) void loadRows()
  }, [open, pendingCount, loadRows])

  // Queue emptied while open (sync done): nothing left to show.
  useEffect(() => {
    if (pendingCount === 0) setOpen(false)
  }, [pendingCount])

  if (pendingCount === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-amber-light px-3 text-xs font-semibold text-amber"
      >
        <Clock className="h-4 w-4" aria-hidden="true" />
        {pendingCount} en attente
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ventes en attente</DialogTitle>
            <DialogDescription>
              Gardées sur ce téléphone, elles seront envoyées automatiquement au retour du réseau.
            </DialogDescription>
          </DialogHeader>

          <ul className="max-h-80 space-y-2 overflow-y-auto" aria-label="Liste des ventes en attente">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-md border border-[#DCE1E5] bg-[#F6F9FB] p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#12364D]">{row.clientNom}</p>
                  <p className="text-xs text-[#1C5376]">{new Date(row.createdAt).toLocaleString('fr-FR')}</p>
                </div>
                <span className="shrink-0 font-mono text-sm font-bold text-[#12364D] [font-variant-numeric:tabular-nums]">
                  {toCFA(row.montant)}
                </span>
              </li>
            ))}
          </ul>

          {isOnline ? (
            <Button
              type="button"
              variant="pos-primary"
              className="w-full"
              loading={isSyncing}
              loadingText="Synchronisation…"
              onClick={() => void onSync()}
            >
              <RefreshCw className="h-4 w-4" />
              Synchroniser maintenant
            </Button>
          ) : (
            <p className="text-center text-sm text-[#1C5376]">Hors ligne : la synchronisation reprendra au retour du réseau.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
