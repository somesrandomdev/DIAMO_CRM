import { useState } from 'react'
import { UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useChurnAlerts } from '@/components/dashboard/useChurnAlerts'

/** Admin dashboard card: "X clients inactifs depuis 30 jours" + drill-in list. */
export function ChurnAlertCard() {
  const { churnedClients, isLoading } = useChurnAlerts()
  const [isOpen, setIsOpen] = useState(false)

  if (isLoading) {
    return <Skeleton className="h-16 w-full rounded-lg" />
  }

  if (churnedClients.length === 0) {
    return null
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full min-h-12 items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning-light p-3 text-left transition-colors hover:border-warning"
        aria-label="Voir les clients inactifs"
      >
        <span className="flex items-center gap-2 text-[13px] font-medium text-text">
          <UserX className="h-5 w-5 shrink-0 text-warning" />
          {churnedClients.length} client{churnedClients.length > 1 ? 's' : ''} inactif
          {churnedClients.length > 1 ? 's' : ''} depuis 30 jours
        </span>
        <span className="text-[12px] font-semibold text-warning">Voir</span>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clients inactifs (30 jours)</DialogTitle>
            <DialogDescription>
              Aucun achat enregistré depuis plus de 30 jours — les plus inactifs en premier.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {churnedClients.map((client) => (
              <div
                key={client.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-text">{client.nom}</p>
                  <p className="truncate text-[12px] text-text-secondary">{client.kiosque}</p>
                </div>
                <p className="shrink-0 text-[12px] font-semibold text-warning [font-variant-numeric:tabular-nums]">
                  {client.daysInactive !== null
                    ? `Inactif depuis ${client.daysInactive} jour${client.daysInactive > 1 ? 's' : ''}`
                    : 'Jamais acheté'}
                </p>
              </div>
            ))}
          </div>
          <Button type="button" variant="default" onClick={() => setIsOpen(false)} className="w-full">
            Fermer
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
