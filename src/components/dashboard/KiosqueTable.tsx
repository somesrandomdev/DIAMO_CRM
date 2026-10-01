import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/status-badge'
import type { KiosquePerformance } from '@/components/dashboard/useAdminDashboard'
import { toCFA } from '@/utils/price'

interface KiosqueTableProps {
  rows: KiosquePerformance[]
}

function statusLabel(status: KiosquePerformance['statut']) {
  if (status === 'up') return 'En hausse'
  if (status === 'down') return 'En baisse'
  return 'Stable'
}

export function KiosqueTable({ rows }: KiosqueTableProps) {
  const navigate = useNavigate()

  const columns: DataTableColumn<KiosquePerformance>[] = [
    {
      key: 'nom',
      header: 'Kiosque',
      render: (row) => <span className="font-medium">{row.nom}</span>,
      sortValue: (row) => row.nom,
    },
    {
      key: 'caMois',
      header: 'CA mois',
      render: (row) => <span className="font-mono">{toCFA(row.caMois)}</span>,
      sortValue: (row) => row.caMois,
      align: 'right',
    },
    {
      key: 'nbVentes',
      header: 'Ventes',
      render: (row) => row.nbVentes,
      sortValue: (row) => row.nbVentes,
      align: 'right',
    },
    {
      key: 'panierMoyen',
      header: 'Panier',
      render: (row) => <span className="font-mono">{toCFA(row.panierMoyen)}</span>,
      sortValue: (row) => row.panierMoyen,
      align: 'right',
    },
    {
      key: 'delta',
      header: 'Delta',
      render: (row) => (
        <span className="font-mono">
          {row.deltaVsPrevious > 0 ? '+' : ''}
          {row.deltaVsPrevious.toFixed(1)}%
        </span>
      ),
      sortValue: (row) => row.deltaVsPrevious,
      align: 'right',
    },
    {
      key: 'statut',
      header: 'Statut',
      render: (row) => <StatusBadge status={row.statut}>{statusLabel(row.statut)}</StatusBadge>,
      sortValue: (row) => row.statut,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Classement kiosques</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 sm:hidden">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className="w-full rounded-md border border-border bg-surface p-3 text-left"
              onClick={() => navigate(`/admin/kiosques/${row.id}`)}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-text">{row.nom}</span>
                <StatusBadge status={row.statut}>{statusLabel(row.statut)}</StatusBadge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-text-secondary">
                <span>CA mois</span>
                <span className="text-right font-mono text-text">{toCFA(row.caMois)}</span>
                <span>Ventes</span>
                <span className="text-right">{row.nbVentes}</span>
                <span>Panier</span>
                <span className="text-right font-mono text-text">{toCFA(row.panierMoyen)}</span>
              </div>
            </button>
          ))}
          {rows.length === 0 && (
            <p className="py-8 text-center text-xs text-text-tertiary">Aucun kiosque à afficher.</p>
          )}
        </div>
        <DataTable
          className="hidden sm:block"
          columns={columns}
          data={rows}
          getRowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/admin/kiosques/${row.id}`)}
          emptyMessage="Aucun kiosque à afficher."
        />
      </CardContent>
    </Card>
  )
}
