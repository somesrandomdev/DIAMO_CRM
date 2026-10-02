import { useEffect, useMemo, useState } from 'react'
import { Download, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { KPICard } from '@/components/ui/kpi-card'
import { Skeleton } from '@/components/ui/skeleton'
import { SearchBar } from '@/components/SearchBar'
import { useToast } from '@/components/Toast'
import { DeleteVenteDialog, type VenteDeleteTarget } from '@/components/DeleteVenteDialog'
import { canDeleteVente } from '@/lib/venteDeleteRules'
import { useAuthStore } from '@/stores/authStore'
import { openTicketDownload } from '@/lib/ticketDownload'
import { resolveKioskScope } from '@/lib/kioskScope'
import { supabase } from '@/lib/supabase'
import { exportRowsCSV } from '@/utils/exportCSV'
import { toCFA } from '@/utils/price'
import { Input } from '@/components/ui/input'

interface Sale {
  id: string
  created_at: string
  montant_total: number
  lien_ticket?: string | null
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
  const { showToast } = useToast()
  const [sales, setSales] = useState<Sale[]>([])
  const [deleteTarget, setDeleteTarget] = useState<VenteDeleteTarget | null>(null)

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
        .select('id, created_at, montant_total, lien_ticket, client:clients(nom), offre:offres(nom)')
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

  // Date presets: 'all' | 'today' | 'week' | 'month', or 'custom' + dateFilter.
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all')

  const filteredSales = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const now = new Date()
    const todayKey = now.toISOString().slice(0, 10)
    const weekAgo = new Date(now)
    weekAgo.setDate(now.getDate() - 6)
    const monthStart = `${todayKey.slice(0, 7)}-01`

    return sales.filter((sale) => {
      const matchesSearch =
        !query ||
        sale.client?.nom?.toLowerCase().includes(query) ||
        sale.offre?.nom?.toLowerCase().includes(query) ||
        sale.id.toLowerCase().includes(query)

      const saleDate = sale.created_at.slice(0, 10)
      let matchesDate = true
      if (datePreset === 'today') matchesDate = saleDate === todayKey
      else if (datePreset === 'week') matchesDate = sale.created_at >= weekAgo.toISOString()
      else if (datePreset === 'month') matchesDate = saleDate >= monthStart
      else if (datePreset === 'custom') matchesDate = !dateFilter || saleDate === dateFilter

      return matchesSearch && matchesDate
    })
  }, [dateFilter, datePreset, sales, searchTerm])

  useEffect(() => {
    setCurrentPage(1)
  }, [dateFilter, datePreset, searchTerm])

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

  const reloadAfterDelete = () => {
    if (profile) void loadSalesHistory()
  }

  const downloadTicket = async (lien: string) => {
    const ok = await openTicketDownload(lien)
    if (!ok) {
      showToast({
        type: 'error',
        title: 'Ticket indisponible',
        message: 'Erreur lors du téléchargement du ticket.',
      })
    }
  }

  const paginatedSales = filteredSales.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage)
  const totalCA = filteredSales.reduce((sum, sale) => sum + sale.montant_total, 0)

  // Suppression réservée commerciaux + admin (règle métier, miroir de la RPC
  // delete_vente) : la colonne n'existe pas du tout pour le fontainier — sur
  // mobile un tooltip ne s'affiche pas, masquer est plus propre que griser.
  const canSeeDeleteAction = (profile?.role ?? 'fontainier') !== 'fontainier'

  const columns: DataTableColumn<Sale>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (sale) => (
        <div>
          <p className="font-medium">{formatSaleDate(sale.created_at)}</p>
          <p className="text-xs text-text-secondary">{formatSaleTime(sale.created_at)}</p>
        </div>
      ),
      sortValue: (sale) => new Date(sale.created_at),
    },
    { key: 'client', header: 'Client', render: (sale) => <span className="font-medium">{sale.client?.nom || 'Client anonyme'}</span>, sortValue: (sale) => sale.client?.nom ?? '' },
    { key: 'offre', header: 'Offre', render: (sale) => sale.offre?.nom || 'Offre inconnue', sortValue: (sale) => sale.offre?.nom ?? '' },
    { key: 'montant', header: 'Montant', align: 'right', render: (sale) => <span className="font-mono">{toCFA(sale.montant_total)}</span>, sortValue: (sale) => sale.montant_total },
    { key: 'id', header: 'ID vente', render: (sale) => <span className="font-mono text-xs text-text-secondary">{sale.id.slice(0, 8)}</span>, sortValue: (sale) => sale.id },
    {
      key: 'ticket',
      header: 'Ticket',
      align: 'right',
      render: (sale) =>
        sale.lien_ticket ? (
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="h-12 w-12 min-h-12"
            aria-label="Télécharger le ticket"
            onClick={(event) => {
              event.stopPropagation()
              downloadTicket(sale.lien_ticket as string)
            }}
          >
            <Download className="h-4 w-4" />
          </Button>
        ) : null,
      sortValue: (sale) => (sale.lien_ticket ? 1 : 0),
    },
    ...(canSeeDeleteAction
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (sale: Sale) => {
              // La requête est déjà scopée (commercial = kiosques supervisés
              // uniquement) : le contrôle kiosque de la RPC est satisfait ici,
              // seul le rôle et la fenêtre 24 h varient.
              const deletable = canDeleteVente(sale.created_at, profile?.role ?? 'fontainier', true)
              return deletable ? (
                <Button
                  type="button"
                  variant="default"
                  size="icon"
                  className="h-12 w-12 min-h-12"
                  aria-label="Supprimer la vente"
                  title="Supprimer la vente"
                  onClick={(event) => {
                    event.stopPropagation()
                    setDeleteTarget({
                      id: sale.id,
                      date: sale.created_at,
                      clientNom: sale.client?.nom || 'Client anonyme',
                      offresResume: sale.offre?.nom || 'Offre inconnue',
                      montant: sale.montant_total,
                      lienTicket: sale.lien_ticket,
                    })
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : (
                <span
                  className="inline-flex h-12 w-12 items-center justify-center text-text-tertiary"
                  title="Suppression admin au-delà de 24 h"
                >
                  <Trash2 className="h-4 w-4 opacity-30" />
                </span>
              )
            },
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-text">Historique des ventes</h1>
          <p className="text-xs text-text-secondary">Recherche, filtres et export CSV.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Fontainier : « Retour » mènerait à l'onglet Vendre, déjà dans la barre d'onglets. */}
          {profile?.role !== 'fontainier' && (
            <Button type="button" variant="default" size="sm" onClick={onBack}>Retour</Button>
          )}
          <Button type="button" variant="primary" size="sm" onClick={exportToCSV} disabled={filteredSales.length === 0}>
            <Download className="h-4 w-4" />
            Exporter CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Client, offre ou ID..."
            />
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setSearchTerm('')
                setDateFilter('')
                setDatePreset('all')
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Réinitialiser
            </Button>
          </div>

          {/* Period presets — one tap instead of picking dates on a phone */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['all', 'Toutes'],
                ['today', "Aujourd'hui"],
                ['week', '7 derniers jours'],
                ['month', 'Ce mois'],
                ['custom', 'Date précise'],
              ] as const
            ).map(([preset, labelText]) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDatePreset(preset)}
                aria-pressed={datePreset === preset}
                className={
                  datePreset === preset
                    ? 'min-h-11 rounded-md bg-primary px-3 text-xs font-semibold text-white'
                    : 'min-h-11 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary'
                }
              >
                {labelText}
              </button>
            ))}
            {datePreset === 'custom' && (
              <Input
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="sm:w-48"
              />
            )}
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
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue">Date de vente</p>
                      <p className="mt-1 text-sm font-semibold text-text">{formatSaleDate(sale.created_at)}</p>
                      <p className="text-xs text-text-secondary">{formatSaleTime(sale.created_at)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <span className="text-text-secondary">Client</span>
                      <span className="text-right font-medium text-text">{sale.client?.nom || 'Client anonyme'}</span>
                      <span className="text-text-secondary">Offre</span>
                      <span className="text-right text-text">{sale.offre?.nom || 'Offre inconnue'}</span>
                      <span className="text-text-secondary">Montant</span>
                      <span className="text-right font-mono font-semibold text-blue">{toCFA(sale.montant_total)}</span>
                    </div>
                    {sale.lien_ticket && (
                      <Button
                        type="button"
                        variant="outline" size="touch"
                        className="mt-3 w-full"
                        onClick={() => downloadTicket(sale.lien_ticket as string)}
                      >
                        <Download className="h-4 w-4" />
                        Télécharger le ticket
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <DataTable className="hidden sm:block" columns={columns} data={paginatedSales} getRowKey={(sale) => sale.id} />
              {totalPages > 1 && (
                <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-text-secondary">
                    Page {currentPage} sur {totalPages} · {filteredSales.length} résultats
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => setCurrentPage((current) => Math.max(current - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      Précédent
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
      <DeleteVenteDialog
        target={deleteTarget}
        role={profile?.role ?? 'fontainier'}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onDeleted={reloadAfterDelete}
      />
    </div>
  )
}
