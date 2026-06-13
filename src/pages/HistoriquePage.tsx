import { useEffect, useMemo, useState } from 'react'
import { Download, RotateCcw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { FormInput } from '@/components/ui/form-input'
import { KPICard } from '@/components/ui/kpi-card'
import { Skeleton } from '@/components/ui/skeleton'
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

export default function HistoriquePage({ onBack }: { onBack: () => void }) {
  const { profile } = useAuthStore()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    if (profile?.kiosque_id) {
      loadSalesHistory()
    }
  }, [profile?.kiosque_id])

  const loadSalesHistory = async () => {
    if (!profile?.kiosque_id) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('ventes')
        .select('id, created_at, montant_total, client:clients(nom), offre:offres(nom)')
        .eq('kiosque_id', profile.kiosque_id)
        .order('created_at', { ascending: false })

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
      render: (sale) => new Date(sale.created_at).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
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
              <DataTable columns={columns} data={paginatedSales} getRowKey={(sale) => sale.id} />
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
