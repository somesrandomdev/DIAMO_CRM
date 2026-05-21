import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { KiosquePerformance } from '@/components/dashboard/useAdminDashboard'
import { toCFA } from '@/utils/price'

type SortKey = 'nom' | 'caMois' | 'nbVentes' | 'clientsActifs' | 'panierMoyen' | 'deltaVsPrevious'

interface KiosqueTableProps {
  rows: KiosquePerformance[]
}

function statusLabel(status: KiosquePerformance['statut']) {
  if (status === 'up') return 'En hausse'
  if (status === 'down') return 'En baisse'
  return 'Stable'
}

function statusVariant(status: KiosquePerformance['statut']) {
  if (status === 'up') return 'success'
  if (status === 'down') return 'destructive'
  return 'warning'
}

export function KiosqueTable({ rows }: KiosqueTableProps) {
  const navigate = useNavigate()
  const [sortKey, setSortKey] = useState<SortKey>('caMois')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aValue = a[sortKey]
      const bValue = b[sortKey]
      const modifier = direction === 'asc' ? 1 : -1

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return aValue.localeCompare(bValue) * modifier
      }

      return ((aValue as number) - (bValue as number)) * modifier
    })
  }, [direction, rows, sortKey])

  const requestSort = (key: SortKey) => {
    if (key === sortKey) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setDirection(key === 'nom' ? 'asc' : 'desc')
  }

  const HeaderButton = ({ label, column }: { label: string; column: SortKey }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 px-2 text-xs font-semibold uppercase text-muted-foreground"
      onClick={() => requestSort(column)}
    >
      {label}
      <ArrowDownUp className="h-3 w-3" />
    </Button>
  )

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Classement kiosques</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left"><HeaderButton label="Kiosque" column="nom" /></th>
                <th className="text-right"><HeaderButton label="CA mois" column="caMois" /></th>
                <th className="text-right"><HeaderButton label="Ventes" column="nbVentes" /></th>
                <th className="text-right"><HeaderButton label="Clients" column="clientsActifs" /></th>
                <th className="text-right"><HeaderButton label="Panier" column="panierMoyen" /></th>
                <th className="text-right"><HeaderButton label="Delta" column="deltaVsPrevious" /></th>
                <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/60"
                  onClick={() => navigate(`/admin/kiosques/${row.id}`)}
                >
                  <td className="px-2 py-3 font-medium">{row.nom}</td>
                  <td className="px-2 py-3 text-right">{toCFA(row.caMois)}</td>
                  <td className="px-2 py-3 text-right">{row.nbVentes}</td>
                  <td className="px-2 py-3 text-right">{row.clientsActifs}</td>
                  <td className="px-2 py-3 text-right">{toCFA(row.panierMoyen)}</td>
                  <td className="px-2 py-3 text-right">
                    {row.deltaVsPrevious > 0 ? '+' : ''}
                    {row.deltaVsPrevious.toFixed(1)}%
                  </td>
                  <td className="px-2 py-3">
                    <Badge variant={statusVariant(row.statut)}>{statusLabel(row.statut)}</Badge>
                  </td>
                </tr>
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-8 text-center text-muted-foreground">
                    Aucun kiosque a afficher.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
