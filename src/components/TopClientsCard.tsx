import { useCallback, useEffect, useMemo, useState } from 'react'
import { Trophy } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { toCFA } from '@/utils/price'

interface KiosqueRow {
  id: string
  nom: string
}

interface ClientRow {
  id: string
  nom: string
  telephone: string | null
  kiosque_id: string
}

interface VenteRow {
  kiosque_id: string
  client_id: string | null
  montant_total: number | null
}

interface TopClient {
  nom: string
  telephone: string | null
  achats: number
  total: number
}

/** Per-kiosk top-3 clients by lifetime spend, best first. */
function top3For(
  kiosqueId: string,
  clients: ClientRow[],
  ventes: VenteRow[]
): TopClient[] {
  const clientsOfKiosk = new Map(
    clients.filter((client) => client.kiosque_id === kiosqueId).map((client) => [client.id, client])
  )
  const stats = new Map<string, { achats: number; total: number }>()

  for (const vente of ventes) {
    if (vente.kiosque_id !== kiosqueId || !vente.client_id) continue
    if (!clientsOfKiosk.has(vente.client_id)) continue
    const entry = stats.get(vente.client_id) ?? { achats: 0, total: 0 }
    entry.achats += 1
    entry.total += vente.montant_total ?? 0
    stats.set(vente.client_id, entry)
  }

  return Array.from(stats.entries())
    .map(([clientId, s]) => ({
      nom: clientsOfKiosk.get(clientId)?.nom ?? 'Client inconnu',
      telephone: clientsOfKiosk.get(clientId)?.telephone ?? null,
      achats: s.achats,
      total: s.total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
}

const RANK_STYLES = [
  'bg-[#F5C542] text-[#12364D]', // gold
  'bg-[#C7CDD4] text-[#12364D]', // silver
  'bg-[#D9A066] text-white', // bronze
]

/**
 * Admin dashboard card: top 3 clients per kiosk by total spent, with a
 * detail dialog — same click-to-open pattern as the inactive-clients card.
 */
export function TopClientsCard() {
  const [kiosques, setKiosques] = useState<KiosqueRow[]>([])
  const [clients, setClients] = useState<ClientRow[]>([])
  const [ventes, setVentes] = useState<VenteRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [kiosquesResult, clientsResult, ventesResult] = await Promise.all([
      supabase.from('kiosques').select('id, nom').order('nom'),
      supabase.from('clients').select('id, nom, telephone, kiosque_id'),
      supabase.from('ventes').select('kiosque_id, client_id, montant_total'),
    ])

    const failure = kiosquesResult.error ?? clientsResult.error ?? ventesResult.error
    if (failure) {
      console.error('Error loading top clients:', failure)
    }
    setKiosques((kiosquesResult.data ?? []) as KiosqueRow[])
    setClients((clientsResult.data ?? []) as ClientRow[])
    setVentes((ventesResult.data ?? []) as VenteRow[])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const ranked = useMemo(
    () =>
      kiosques.map((kiosque) => ({
        kiosque,
        top: top3For(kiosque.id, clients, ventes),
      })),
    [clients, kiosques, ventes]
  )
  const kiosquesWithClients = ranked.filter((entry) => entry.top.length > 0)

  if (isLoading) {
    return <Skeleton className="h-16 w-full rounded-lg" />
  }

  if (kiosquesWithClients.length === 0) {
    return null
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full min-h-12 items-center justify-between gap-3 rounded-lg border border-[#006EBD]/30 bg-[#E3F3FE] p-3 text-left transition-colors hover:border-[#006EBD]"
        aria-label="Voir le top clients par kiosque"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-[#12364D]">
          <Trophy className="h-5 w-5 shrink-0 text-[#006EBD]" />
          Top clients — {kiosquesWithClients.length} kiosque
          {kiosquesWithClients.length > 1 ? 's' : ''}
        </span>
        <span className="text-xs font-semibold text-[#006EBD]">Voir</span>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Top 3 clients par kiosque</DialogTitle>
            <DialogDescription>
              Clients ayant dépensé le plus, tous achats confondus.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {kiosquesWithClients.map(({ kiosque, top }) => (
              <div key={kiosque.id}>
                <p className="mb-2 text-sm font-bold text-[#12364D]">{kiosque.nom}</p>
                <div className="space-y-2">
                  {top.map((client, index) => (
                    <div
                      key={`${kiosque.id}-${client.nom}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-[#DCE1E5] bg-white p-3"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${RANK_STYLES[index]}`}
                          aria-label={`Rang ${index + 1}`}
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#12364D]">
                            {client.nom}
                          </p>
                          <p className="truncate text-xs text-[#1C5376]">
                            {client.telephone ?? '—'} - {client.achats} achat
                            {client.achats > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-[#12364D] [font-variant-numeric:tabular-nums]">
                        {toCFA(client.total)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
