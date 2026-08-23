import { useEffect, useMemo, useState } from 'react'
import { Download, RotateCcw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { FormInput } from '@/components/ui/form-input'
import { KPICard } from '@/components/ui/kpi-card'
import { Skeleton } from '@/components/ui/skeleton'
import { resolveKioskScope } from '@/lib/kioskScope'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { exportRowsCSV } from '@/utils/exportCSV'
import { toCFA } from '@/utils/price'

interface Sale {
  id: string
  created_at: string
  montant_total: number
  client: { nom: string } | null
  offre: { nom: string } | null
}

function formatSaleDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatSaleTime(value: string) {
  return new Date(value).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function HistoriquePage({ onBack }: { onBack: () => void }) {
  const { profile } = useAuthStore()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    if (profile) {
      loadSalesHistory()
    }
    // Reload when the user's kiosk reach changes: fontainier kiosk edit,
    // commercial junction assignment, or role switch.
  }, [profile?.id, profile?.role, profile?.kiosque_id])

  const loadSalesHistory = async () => {
    if (!profile) return

    setLoading(true)
    try {
      // Role-aware scoping: fontainier sees their kiosk, commercial their
      // supervised kiosques (junction table), admin everything.
      const scope = await resolveKioskScope(profile)
      if (scope !== null && scope.length === 0) {
        setSales([])
        return
      }

      let query = supabase
        .from('ventes')
        .select('id, created_at, montant_total, client:clients(nom), offre:offres(nom)')
        .order('created_at', { ascending: false })
      if (scope) {
        query = query.in('kiosque_id', scope)
      }

      const { data, error } = await query
      if (error) throw error

      const transformedSales = (data || []).map((sale) => ({
        ...sale,
        client: Array.isArray(sale.client) ? sale.client[0] || null : sale.client,
        offre: Array.isArray(sale.offre) ? sale.offre[0] || null : sale.offre,
      }))

      setSales(transformedSales as Sale[])
    } catch (error) {
      console.error('Error loading sales history:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredSales = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()

    return sales.filter((sale) => {
      const matchesSearch =
        !query ||
        sale.client?.nom?.toLowerCase().includes(query) ||
        sale.offre?.nom?.toLowerCase().includes(query) ||
        sale.id.toLowerCase().includes(query)

      const matchesDate = !dateFilter || sale.created_at.startsWith(dateFilter)
      return matchesSearch && matchesDate
    })
  }, [dateFilter, sales, searchTerm])

  useEffect(() => {
    setCurrentPage(1)
  }, [dateFilter, searchTerm])

  const exportToCSV = () => {
    exportRowsCSV(
      filteredSales.map((sale) => ({
        Date: new Date(sale.created_at).toLocaleString('fr-FR'),
        Client: sale.client?.nom || 'N/A',
        Offre: sale.offre?.nom || 'N/A',
        Montant: sale.montant_total,
        'ID Vente': sale.id,
      })),
      `historique-ventes-${new Date().toISOString().split('T')[0]}.csv`
    )
  }

  const paginatedSales = filteredSales.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage)
  const totalCA = filteredSales.reduce((sum, sale) => sum + sale.montant_total, 0)

  const columns: DataTableColumn<Sale>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (sale) => (
        <div>
          <p className="font-medium">{formatSaleDate(sale.created_at)}</p>
          <p className="text-[11px] text-text-secondary">{formatSaleTime(sale.created_at)}</p>
        </div>
      ),
      sortValue: (sale) => new Date(sale.created_at),
    },
    { key: 'client', header: 'Client', render: (sale) => <span className="font-medium">{sale.client?.nom || 'Client anonyme'}</span>, sortValue: (sale) => sale.client?.nom ?? '' },
    { key: 'offre', header: 'Offre', render: (sale) => sale.offre?.nom || 'Offre inconnue', sortValue: (sale) => sale.offre?.nom ?? '' },
    { key: 'montant', header: 'Montant', align: 'right', render: (sale) => <span className="font-mono">{toCFA(sale.montant_total)}</span>, sortValue: (sale) => sale.montant_total },
    { key: 'id', header: 'ID vente', render: (sale) => <span className="font-mono text-[11px] text-text-secondary">{sale.id.slice(0, 8)}</span>, sortValue: (sale) => sale.id },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-text">Historique des ventes</h1>
          <p className="text-[12px] text-text-secondary">Recherche, filtres et export CSV.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="default" size="sm" onClick={onBack}>Retour</Button>
          <Button type="button" variant="primary" size="sm" onClick={exportToCSV} disabled={filteredSales.length === 0}>
            <Download className="h-4 w-4" />
            Exporter CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-text-tertiary sm:top-2.5" />
              <FormInput
                type="text"
                placeholder="Client, offre ou ID..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
            <FormInput
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
            />
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setSearchTerm('')
                setDateFilter('')
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Reinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <KPICard label="Ventes" value={filteredSales.length} />
        <KPICard label="CA total" value={toCFA(totalCA)} />
        <KPICard label="Panier moyen" value={filteredSales.length > 0 ? toCFA(totalCA / filteredSales.length) : toCFA(0)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-12" />)}
            </div>
          ) : paginatedSales.length === 0 ? (
            <EmptyState title="Aucune vente" description="Aucune vente ne correspond aux filtres actuels." />
          ) : (
            <>
              <div className="space-y-2 sm:hidden">
                {paginatedSales.map((sale) => (
                  <div key={sale.id} className="rounded-md border border-border bg-surface p-3">
                    <div className="mb-3 rounded-md bg-blue-light px-3 py-2">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-blue">Date de vente</p>
                      <p className="mt-1 text-[14px] font-semibold text-text">{formatSaleDate(sale.created_at)}</p>
                      <p className="text-[12px] text-text-secondary">{formatSaleTime(sale.created_at)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[12px]">
                      <span className="text-text-secondary">Client</span>
                      <span className="text-right font-medium text-text">{sale.client?.nom || 'Client anonyme'}</span>
                      <span className="text-text-secondary">Offre</span>
                      <span className="text-right text-text">{sale.offre?.nom || 'Offre inconnue'}</span>
                      <span className="text-text-secondary">Montant</span>
                      <span className="text-right font-mono font-semibold text-blue">{toCFA(sale.montant_total)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <DataTable className="hidden sm:block" columns={columns} data={paginatedSales} getRowKey={(sale) => sale.id} />
              {totalPages > 1 && (
                <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[12px] text-text-secondary">
                    Page {currentPage} sur {totalPages} · {filteredSales.length} resultats
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => setCurrentPage((current) => Math.max(current - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      Precedent
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => setCurrentPage((current) => Math.min(current + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
