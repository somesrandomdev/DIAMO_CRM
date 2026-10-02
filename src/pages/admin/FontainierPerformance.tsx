import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { LoadMoreButton } from '@/components/LoadMoreButton'
import { SearchBar } from '@/components/SearchBar'
import { monthPeriod } from '@/lib/commercialStats'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { usePagedRpc } from '@/lib/usePagedRpc'
import { cn } from '@/lib/utils'
import { toCFA } from '@/utils/price'

type Statut = 'atteint' | 'en_bonne_voie' | 'en_difficulte' | 'sans_objectif'
type Sort = 'pct_asc' | 'pct_desc' | 'ca' | 'nom'

interface PerformanceRow {
  id: string
  nom: string
  kiosque_id: string | null
  kiosque_nom: string | null
  ca: number
  objectif: number | null
  pct: number | null
  nb_ventes: number
  clients: number
  panier: number
  statut: Statut
}

interface PerformanceExtra {
  counts: Record<Statut | 'tous', number>
}

/** Order = what an admin acts on first. */
const STATUS_FILTERS: { value: Statut | null; label: string }[] = [
  { value: null, label: 'Tous' },
  { value: 'en_difficulte', label: 'En difficulté' },
  { value: 'en_bonne_voie', label: 'En bonne voie' },
  { value: 'atteint', label: 'Atteint' },
  { value: 'sans_objectif', label: 'Sans objectif' },
]

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: 'pct_asc', label: 'Les plus en retard' },
  { value: 'pct_desc', label: 'Meilleure réalisation' },
  { value: 'ca', label: 'CA le plus élevé' },
  { value: 'nom', label: 'Nom (A → Z)' },
]

const PERIODS = [
  { monthsAgo: 0, label: 'Ce mois' },
  { monthsAgo: 1, label: 'Mois dernier' },
]

/** Progress colour per status: green reached, amber on track, red behind. */
const TONE: Record<Statut, { fill: string; text: string }> = {
  atteint: { fill: 'bg-success', text: 'text-success' },
  en_bonne_voie: { fill: 'bg-warning', text: 'text-warning' },
  en_difficulte: { fill: 'bg-destructive', text: 'text-destructive' },
  sans_objectif: { fill: 'bg-muted', text: 'text-text-secondary' },
}

function Attainment({ row }: { row: PerformanceRow }) {
  const tone = TONE[row.statut]
  return (
    <div className="w-full sm:ml-auto sm:w-28">
      <Progress value={Math.min(100, row.pct ?? 0)} className="h-2 rounded-full bg-muted" barClassName={`rounded-full ${tone.fill}`} />
      <p className={cn('mt-1 text-right text-xs font-semibold [font-variant-numeric:tabular-nums]', tone.text)}>
        {row.pct !== null ? `${Math.round(row.pct)} %` : 'Objectif non défini'}
      </p>
    </div>
  )
}

/**
 * Admin: each fontainier against their kiosk's monthly objective. Computed
 * and paged in Postgres (fontainier_performance); the status counters ARE the
 * filters, worst first by default.
 */
export default function FontainierPerformance() {
  const navigate = useNavigate()
  const [monthsAgo, setMonthsAgo] = useState(0)
  const [status, setStatus] = useState<Statut | null>(null)
  const [sort, setSort] = useState<Sort>('pct_asc')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim(), 300)
  const [period] = useState(() => PERIODS.map((item) => monthPeriod(item.monthsAgo)))
  const range = period[monthsAgo]

  const list = usePagedRpc<PerformanceRow, PerformanceExtra>('fontainier_performance', {
    p_from: range.from,
    p_to: range.to,
    p_search: search || null,
    p_status: status,
    p_sort: sort,
  })
  const counts = list.extra?.counts

  const openKiosk = (row: PerformanceRow) => {
    if (row.kiosque_id) navigate(`/admin/kiosques/${row.kiosque_id}`)
  }

  const columns: DataTableColumn<PerformanceRow>[] = [
    { key: 'nom', header: 'Fontainier', render: (row) => <span className="font-medium">{row.nom}</span> },
    { key: 'kiosque', header: 'Kiosque', render: (row) => row.kiosque_nom ?? 'Sans kiosque' },
    { key: 'ca', header: 'CA', align: 'right', render: (row) => <span className="font-mono">{toCFA(row.ca)}</span> },
    {
      key: 'objectif',
      header: 'Objectif',
      align: 'right',
      render: (row) => (row.objectif ? <span className="font-mono">{toCFA(row.objectif)}</span> : <span className="text-text-tertiary">—</span>),
    },
    { key: 'pct', header: 'Réalisation', render: (row) => <Attainment row={row} /> },
    { key: 'ventes', header: 'Ventes', align: 'right', render: (row) => row.nb_ventes },
    { key: 'clients', header: 'Clients', align: 'right', render: (row) => row.clients },
    { key: 'panier', header: 'Panier moyen', align: 'right', render: (row) => <span className="font-mono">{toCFA(row.panier)}</span> },
    {
      key: 'open',
      header: '',
      align: 'right',
      render: (row) => (row.kiosque_id ? <ChevronRight className="ml-auto h-4 w-4 text-text-tertiary" /> : null),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-text">Performance des fontainiers</h1>
          <p className="text-xs text-text-secondary">Réalisation de l'objectif mensuel du kiosque de chaque fontainier.</p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Période">
          {PERIODS.map((item) => (
            <Button
              key={item.monthsAgo}
              type="button"
              size="sm"
              variant={monthsAgo === item.monthsAgo ? 'primary' : 'outline'}
              aria-pressed={monthsAgo === item.monthsAgo}
              onClick={() => setMonthsAgo(item.monthsAgo)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Status counters double as filters */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
        {STATUS_FILTERS.map((filter) => {
          const count = counts ? counts[filter.value ?? 'tous'] : null
          const active = status === filter.value
          return (
            <Button
              key={filter.label}
              type="button"
              variant={active ? 'primary' : 'outline'}
              size="touch"
              aria-pressed={active}
              onClick={() => setStatus(filter.value)}
            >
              {filter.label}
              {count !== null && <span className="font-bold [font-variant-numeric:tabular-nums]">{count}</span>}
            </Button>
          )
        })}
      </div>

      <p className="-mt-2 text-xs text-text-secondary">
        Objectif du mois : en difficulté &lt; 80 % · en bonne voie 80–99 % · atteint ≥ 100 %.
      </p>

      <div className="grid gap-2 sm:grid-cols-[1fr_16rem]">
        <SearchBar value={searchInput} onChange={setSearchInput} placeholder="Fontainier ou kiosque" />
        <Select fieldSize="lg" aria-label="Trier" value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {list.error && <p className="text-sm text-red">{list.error}</p>}

      {list.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16 rounded-lg" />)}
        </div>
      ) : list.rows.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-5 w-5" />}
          title={counts?.tous === 0 ? 'Aucun fontainier' : 'Aucun résultat'}
          description={
            counts?.tous === 0
              ? 'Ajoutez des fontainiers avec un kiosque assigné pour suivre leurs performances.'
              : 'Changez le filtre ou la recherche.'
          }
        />
      ) : (
        <>
          <div className="hidden sm:block">
            <DataTable columns={columns} data={list.rows} getRowKey={(row) => row.id} onRowClick={openKiosk} />
          </div>

          {/* Mobile: one card per fontainier; tap opens the kiosk */}
          <ul className="space-y-2 sm:hidden">
            {list.rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  disabled={!row.kiosque_id}
                  onClick={() => openKiosk(row)}
                  className="w-full rounded-lg border border-border bg-surface p-3 text-left disabled:cursor-default"
                  aria-label={row.kiosque_id ? `Voir le kiosque de ${row.nom}` : undefined}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-text">{row.nom}</span>
                      <span className="block truncate text-xs text-text-secondary">{row.kiosque_nom ?? 'Sans kiosque'}</span>
                    </span>
                    <span className="shrink-0 text-right text-base font-bold text-text [font-variant-numeric:tabular-nums]">
                      {toCFA(row.ca)}
                    </span>
                  </span>
                  <span className="mt-2 block">
                    <Attainment row={row} />
                  </span>
                  <span className="mt-1 block text-xs text-text-secondary [font-variant-numeric:tabular-nums]">
                    {row.nb_ventes} vente(s) · {row.clients} client(s) · panier {toCFA(row.panier)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <LoadMoreButton
            shown={list.rows.length}
            total={list.total}
            isLoading={list.isLoadingMore}
            onClick={list.loadMore}
            noun="fontainiers"
          />
        </>
      )}
    </div>
  )
}
