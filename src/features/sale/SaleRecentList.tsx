import { EmptyState } from '@/components/ui/empty-state'
import { PosCard, PosLabel } from '@/components/pos'
import { toCFA } from '@/utils/price'

export interface RecentSale {
  id: string
  created_at: string
  montant_total: number
  client_nom: string
  offre_nom: string
}

/** The five most recent sales of the kiosk. */
export function SaleRecentList({ sales }: { sales: RecentSale[] }) {
  return (
    <PosCard className="space-y-3">
      <PosLabel>Dernieres ventes</PosLabel>
      {sales.length > 0 ? (
        <div className="space-y-2">
          {sales.map((sale) => (
            <div
              key={sale.id}
              className="flex items-center justify-between gap-3 rounded-md border border-[#DCE1E5] bg-[#F6F9FB] p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#12364D]">{sale.client_nom}</p>
                <p className="truncate text-xs text-[#1C5376]">
                  {sale.offre_nom} - {new Date(sale.created_at).toLocaleDateString('fr-FR')}{' '}
                  {new Date(sale.created_at).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <p className="shrink-0 font-mono text-sm font-bold text-[#12364D] [font-variant-numeric:tabular-nums]">
                {toCFA(sale.montant_total)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Aucune vente recente" className="border-0 bg-[#F6F9FB] p-4" />
      )}
    </PosCard>
  )
}
