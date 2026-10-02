import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/input'
import { KPICard } from '@/components/ui/kpi-card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadMoreButton } from '@/components/LoadMoreButton'
import { SearchBar } from '@/components/SearchBar'
import { useToast } from '@/components/Toast'
import type { KioskOverviewExtra, KioskOverviewRow, KioskOverviewSort } from '@/features/kiosk/types'
import { chartTheme } from '@/lib/chartTheme'
import { monthPeriod } from '@/lib/commercialStats'
import { generateReportPdf } from '@/lib/reportPdf'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { fetchAllRpcRows, usePagedRpc } from '@/lib/usePagedRpc'
import { exportRowsCSV } from '@/utils/exportCSV'
import { formatCFACompact, toCFA } from '@/utils/price'

type Period = 'current' | 'previous' | 'quarter'

const PERIODS: { value: Period; label: string; range: () => { from: string; to: string } }[] = [
  { value: 'current', label: 'Ce mois', range: () => monthPeriod(0) },
  { value: 'previous', label: 'Mois dernier', range: () => monthPeriod(1) },
  { value: 'quarter', label: '3 derniers mois', range: () => monthPeriod(0, 3) },
]

const SORT_OPTIONS: { value: KioskOverviewSort; label: string }[] = [
  { value: 'ca', label: 'CA le plus élevé' },
  { value: 'pct_asc', label: 'Les plus en retard' },
  { value: 'pct_desc', label: 'Meilleure réalisation' },
  { value: 'ventes', label: 'Plus de ventes' },
  { value: 'nom', label: 'Nom (A → Z)' },
]

const TOP_N = 10

/**
 * Admin: kiosk comparison per period. Aggregated and paged in Postgres
 * (kiosk_overview): one top-10 chart that stays readable at any network size,
 * a searchable table (active kiosks by default), PDF per kiosk, CSV of all.
 */
export default function RapportsPage() {
  const { showToast } = useToast()
  const [period, setPeriod] = useState<Period>('current')
  const [ranges] = useState(() => Object.fromEntries(PERIODS.map((item) => [item.value, item.range()])) as Record<Period, { from: string; to: string }>)
  const range = ranges[period]
  const periodLabel = PERIODS.find((item) => item.value === period)?.label ?? ''

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim(), 300)
  const [sort, setSort] = useState<KioskOverviewSort>('ca')
  const [onlyActive, setOnlyActive] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  const baseParams = { p_from: range.from, p_to: range.to }
  const table = usePagedRpc<KioskOverviewRow, KioskOverviewExtra>('kiosk_overview', {
    ...baseParams,
    p_search: search || null,
    p_sort: sort,
    p_only_active: onlyActive,
  })
  const top = usePagedRpc<KioskOverviewRow, KioskOverviewExtra>(
    'kiosk_overview',
    { ...baseParams, p_search: null, p_sort: 'ca', p_only_active: true },
    { pageSize: TOP_N }
  )
  const totals = top.extra?.totals
  const chartRows = top.rows
    .slice(0, TOP_N)
    .filter((row) => row.ca > 0)
    .map((row) => ({ nom: row.nom, ca: row.ca }))

  const exportPdf = async (row: KioskOverviewRow) => {
    const dataUri = await generateReportPdf({
      kiosqueNom: row.nom,
      kiosqueAdresse: row.adresse,
      periodLabel,
      ca: row.ca,
      ventes: row.nb_ventes,
      target: row.objectif ?? 0,
      progress: row.pct ?? 0,
      topClient: row.top_client ?? 'Aucun',
      bestOffer: row.best_offre ?? 'Aucune',
    })
    const link = document.createElement('a')
    link.href = dataUri
    link.download = `rapport-${row.nom.toLowerCase().replaceAll(' ', '-')}.pdf`
    link.click()
  }

  const exportCsv = async () => {
    setIsExporting(true)
    try {
      const rows = await fetchAllRpcRows<KioskOverviewRow>('kiosk_overview', {
        ...baseParams,
        p_search: search || null,
        p_sort: sort,
        p_only_active: onlyActive,
      })
      exportRowsCSV(
        rows.map((row) => ({
          Kiosque: row.nom,
          Adresse: row.adresse ?? '',
          'CA (FCFA)': row.ca,
          Ventes: row.nb_ventes,
          'Clients actifs': row.clients_actifs,
          'Objectif (FCFA)': row.objectif ?? '',
          'Réalisation (%)': row.pct ?? '',
          'Top client': row.top_client ?? '',
          'Meilleure offre': row.best_offre ?? '',
        })),
        `rapport-kiosques-${period}-${range.from.slice(0, 10)}.csv`
      )
    } catch (error) {
      console.error('CSV export failed:', error)
      showToast({ type: 'error', title: 'Export impossible', message: 'Le fichier CSV n’a pas pu être généré. Réessayez.' })
    } finally {
      setIsExporting(false)
    }
  }

  const columns: DataTableColumn<KioskOverviewRow>[] = [
    { key: 'nom', header: 'Kiosque', render: (row) => <span className="font-medium">{row.nom}</span> },
    { key: 'ca', header: 'CA', align: 'right', render: (row) => <span className="font-mono">{toCFA(row.ca)}</span> },
    {
      key: 'objectif',
      header: 'Objectif',
      align: 'right',
      render: (row) => (row.objectif ? <span className="font-mono">{toCFA(row.objectif)}</span> : <span className="text-text-tertiary">—</span>),
    },
    {
      key: 'pct',
      header: 'Réalisation',
      align: 'right',
      render: (row) => (
        <div className="ml-auto w-24">
          <Progress value={row.pct ?? 0} className="bg-muted" barClassName="bg-primary" />
          <p className="mt-1 text-right text-xs text-text-secondary">{row.pct !== null ? `${row.pct.toFixed(1)} %` : '—'}</p>
        </div>
      ),
    },
    { key: 'ventes', header: 'Ventes', align: 'right', render: (row) => row.nb_ventes },
    { key: 'top', header: 'Top client', render: (row) => row.top_client ?? '—' },
    { key: 'offre', header: 'Meilleure offre', render: (row) => row.best_offre ?? '—' },
    {
      key: 'pdf',
      header: '',
      align: 'right',
      render: (row) => (
        <Button type="button" variant="default" size="sm" onClick={() => exportPdf(row)} aria-label={`Rapport PDF de ${row.nom}`}>
          <Download className="h-4 w-4" />
          PDF
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-text">Rapports</h1>
          <p className="text-xs text-text-secondary">Comparaison des kiosques et exports par période.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Période">
          {PERIODS.map((item) => (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={period === item.value ? 'primary' : 'outline'}
              aria-pressed={period === item.value}
              onClick={() => setPeriod(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {totals ? (
          <>
            <KPICard label="Chiffre d'affaires" value={toCFA(totals.ca)} sub={periodLabel} />
            <KPICard label="Ventes" value={totals.nb_ventes} sub={periodLabel} />
            <KPICard label="Kiosques actifs" value={`${totals.kiosques_actifs} / ${totals.kiosques}`} sub="Au moins une vente" />
            <KPICard
              label="Objectifs atteints"
              value={`${totals.objectif_atteint} / ${totals.avec_objectif}`}
              sub="Kiosques avec objectif"
            />
          </>
        ) : (
          [1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-[104px] rounded-lg" />)
        )}
      </div>

      {chartRows.length > 0 && (
        <Card padding="md">
          <Label variant="caps" className="mb-3">
            Top {Math.min(TOP_N, chartRows.length)} kiosques — chiffre d'affaires
          </Label>
          <ResponsiveContainer width="100%" height={Math.max(160, chartRows.length * 36)}>
            <BarChart data={chartRows} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(value) => formatCFACompact(Number(value))} tick={{ fill: chartTheme.axis, fontSize: 11 }} />
              <YAxis dataKey="nom" type="category" width={130} tick={{ fill: chartTheme.axis, fontSize: 12 }} />
              <Tooltip contentStyle={chartTheme.tooltip} formatter={(value) => [toCFA(Number(value)), 'CA']} />
              <Bar dataKey="ca" fill={chartTheme.blue} radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card padding="md" className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Label variant="caps" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Rapport par kiosque — {periodLabel}
          </Label>
          <Button type="button" variant="outline" size="touch" loading={isExporting} loadingText="Export…" onClick={exportCsv}>
            <FileSpreadsheet className="h-4 w-4" />
            Exporter en CSV
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_16rem]">
          <SearchBar value={searchInput} onChange={setSearchInput} placeholder="Rechercher un kiosque" />
          <Select fieldSize="lg" aria-label="Trier" value={sort} onChange={(event) => setSort(event.target.value as KioskOverviewSort)}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <label className="flex min-h-12 cursor-pointer items-center gap-3 text-sm text-text">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--color-primary)]"
            checked={!onlyActive}
            onChange={(event) => setOnlyActive(!event.target.checked)}
          />
          Afficher aussi les kiosques sans vente ni objectif sur la période
        </label>

        {table.error && <p className="text-sm text-red">{table.error}</p>}

        {table.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 rounded-lg" />)}
          </div>
        ) : table.rows.length === 0 ? (
          <EmptyState
            title={search ? 'Aucun kiosque trouvé' : 'Aucune activité sur la période'}
            description={search ? 'Essayez un autre nom.' : 'Les rapports apparaîtront après les premières ventes de la période.'}
            className="border-0"
          />
        ) : (
          <>
            <p className="text-xs text-text-secondary">
              {table.total} kiosque{table.total > 1 ? 's' : ''}
            </p>
            <div className="hidden sm:block">
              <DataTable columns={columns} data={table.rows} getRowKey={(row) => row.kiosque_id} />
            </div>

            {/* Mobile: one card per kiosk, CA vs objective up front */}
            <ul className="space-y-2 sm:hidden">
              {table.rows.map((row) => (
                <li key={row.kiosque_id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-semibold text-text">{row.nom}</p>
                    <Button
                      type="button"
                      variant="default"
                      size="icon-lg"
                      aria-label={`Rapport PDF de ${row.nom}`}
                      onClick={() => exportPdf(row)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="font-mono text-base font-bold text-blue [font-variant-numeric:tabular-nums]">{toCFA(row.ca)}</span>
                    <span className="text-xs text-text-secondary [font-variant-numeric:tabular-nums]">
                      / {row.objectif ? toCFA(row.objectif) : 'sans objectif'}
                    </span>
                  </div>
                  <Progress value={row.pct ?? 0} className="mt-1 bg-muted" barClassName="bg-primary" />
                  <p className="mt-1 text-xs text-text-secondary [font-variant-numeric:tabular-nums]">
                    {row.pct !== null ? `${row.pct.toFixed(1)} % · ` : ''}
                    {row.nb_ventes} vente(s) · top client {row.top_client ?? '—'} · {row.best_offre ?? '—'}
                  </p>
                </li>
              ))}
            </ul>

            <LoadMoreButton
              shown={table.rows.length}
              total={table.total}
              isLoading={table.isLoadingMore}
              onClick={table.loadMore}
              noun="kiosques"
            />
          </>
        )}
      </Card>
    </div>
  )
}
