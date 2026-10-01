import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { SearchBar } from '@/components/SearchBar'
import { PosSelect } from '@/components/pos'
import { TechLogsTab } from './TechLogsTab'
import { supabase } from '@/lib/supabase'

interface AuditRow {
  id: string
  actor_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

const PAGE_SIZE = 25
const KNOWN_ACTIONS = [
  'user.create',
  'user.update',
  'user.soft_delete',
  'user.restore',
  'user.permanent_delete',
  'password.reset',
  'clients.import',
  'kiosques.import',
]

type Period = '7d' | '30d' | 'all'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
  { value: 'all', label: 'Tout' },
]

function formatDateFr(value: string) {
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function detailsSummary(details: Record<string, unknown> | null): string {
  if (!details) return '—'
  return (
    Object.entries(details)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
      .join(' · ') || '—'
  )
}

/** Admin audit trail: filterable, paginated (25/page, date desc). */
export default function AdminLogsPage() {
  const [tab, setTab] = useState<'audit' | 'tech'>('audit')
  const [rows, setRows] = useState<AuditRow[]>([])
  const [actorNames, setActorNames] = useState<Map<string, string>>(new Map())
  const [selected, setSelected] = useState<AuditRow | null>(null)
  const [availableActions, setAvailableActions] = useState<string[]>([])
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [period, setPeriod] = useState<Period>('30d')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const now = Date.now()
    const since = period === '7d' ? now - 7 * 86400000 : period === '30d' ? now - 30 * 86400000 : null

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, 999) // enough for the filters to be meaningful client-side
    if (since) query = query.gte('created_at', new Date(since).toISOString())
    if (actionFilter !== 'all') query = query.eq('action', actionFilter)

    const { data, error: fetchError } = await query
    if (fetchError) {
      console.error('Error loading audit logs:', fetchError.code, fetchError.message)
      setError('Impossible de charger les logs. Veuillez réessayer.')
      setRows([])
      setIsLoading(false)
      return
    }

    const loaded = (data ?? []) as AuditRow[]
    setRows(loaded)

    // Distinct actions present in this window (for the filter dropdown).
    setAvailableActions(Array.from(new Set(loaded.map((row) => row.action))).sort())

    // Resolve actor display names in one small lookup.
    const actorIds = Array.from(new Set(loaded.map((row) => row.actor_id).filter(Boolean))) as string[]
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', actorIds)
      setActorNames(new Map(((profiles ?? []) as Array<{ id: string; username: string }>).map((p) => [p.id, p.username])))
    }
    setIsLoading(false)
  }, [actionFilter, period])

  useEffect(() => {
    setPage(1)
    load()
  }, [load])

  const needle = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!needle) return rows
    return rows.filter((row) => {
      const actor = row.actor_id ? actorNames.get(row.actor_id) ?? '' : ''
      return (
        row.action.toLowerCase().includes(needle) ||
        (row.entity_type ?? '').toLowerCase().includes(needle) ||
        (row.entity_id ?? '').toLowerCase().includes(needle) ||
        actor.toLowerCase().includes(needle) ||
        detailsSummary(row.details).toLowerCase().includes(needle)
      )
    })
  }, [actorNames, needle, rows])

  const visible = filtered.slice(0, page * PAGE_SIZE)

  const columns: DataTableColumn<AuditRow>[] = [
    {
      key: 'created_at',
      header: 'Date',
      render: (row) => <span className="[font-variant-numeric:tabular-nums]">{formatDateFr(row.created_at)}</span>,
      sortValue: (row) => row.created_at,
    },
    {
      key: 'actor',
      header: 'Acteur',
      render: (row) => (row.actor_id ? actorNames.get(row.actor_id) ?? row.actor_id.slice(0, 8) : '—'),
      sortValue: (row) => (row.actor_id ? actorNames.get(row.actor_id) ?? '' : ''),
    },
    { key: 'action', header: 'Action', render: (row) => <span className="font-mono text-xs">{row.action}</span>, sortValue: (row) => row.action },
    { key: 'entity', header: 'Entité', render: (row) => `${row.entity_type ?? '—'}${row.entity_id ? ` · ${row.entity_id.slice(0, 8)}` : ''}` },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-text">Logs d'audit</h1>
          <p className="text-xs text-text-secondary">Traçabilité des actions d'administration.</p>
        </div>
        <Button type="button" variant="default" size="sm" onClick={load} loading={isLoading} loadingText="Actualisation…">
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </Button>
      </div>

      <div className="inline-flex rounded-md border border-border bg-surface text-xs font-semibold">
        {(
          [
            ['audit', 'Audit'],
            ['tech', 'Techniques'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={
              tab === value
                ? 'min-h-11 rounded-md bg-primary px-4 text-white'
                : 'min-h-11 px-4 text-text-secondary hover:text-text'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'tech' && <TechLogsTab />}

      {tab === 'audit' && (
      <Card>
        <CardHeader>
          <CardTitle>Journal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_200px_200px]">
            <SearchBar
              value={search}
              onChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              placeholder="Rechercher (action, entité, détail...)"
            />
            <PosSelect
              value={actionFilter}
              onChange={(event) => {
                setActionFilter(event.target.value)
                setPage(1)
              }}
              aria-label="Filtrer par action"
            >
              <option value="all">Toutes les actions</option>
              {(availableActions.length > 0 ? availableActions : KNOWN_ACTIONS).map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </PosSelect>
            <PosSelect
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value as Period)
                setPage(1)
              }}
              aria-label="Filtrer par période"
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </PosSelect>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-12" />)}
            </div>
          ) : error ? (
            <EmptyState title="Erreur" description={error} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Aucun log"
              description="Aucune action correspondant à ces filtres sur la période."
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                data={visible}
                getRowKey={(row) => row.id}
                onRowClick={(row) => setSelected(row)}
              />
              <p className="mt-2 text-xs text-text-secondary [font-variant-numeric:tabular-nums]">
                {visible.length} sur {filtered.length} entrées — cliquez une ligne pour le détail
              </p>
              {page * PAGE_SIZE < filtered.length && (
                <Button
                  type="button"
                  variant="pos-secondary"
                  className="mt-2 w-full sm:w-auto"
                  onClick={() => setPage((current) => current + 1)}
                >
                  Charger plus
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Détail de l'action</DialogTitle>
            <DialogDescription>
              {selected ? formatDateFr(selected.created_at) : ''}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-semibold">Action :</span>{' '}
                <span className="font-mono">{selected.action}</span>
              </p>
              <p>
                <span className="font-semibold">Acteur :</span>{' '}
                {selected.actor_id ? actorNames.get(selected.actor_id) ?? selected.actor_id : '—'}
              </p>
              <p>
                <span className="font-semibold">Entité :</span>{' '}
                {selected.entity_type ?? '—'} {selected.entity_id ? `· ${selected.entity_id}` : ''}
              </p>
              <div>
                <span className="font-semibold">Détails :</span>
                <pre className="mt-1 max-h-60 overflow-auto rounded-md border border-[#DCE1E5] bg-[#F6F9FB] p-3 text-xs">
                  {JSON.stringify(selected.details ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
