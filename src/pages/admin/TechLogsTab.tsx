import { useCallback, useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PosSelect } from '@/components/pos'
import { SearchBar } from '@/components/SearchBar'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'

interface TechLogRow {
  id: string
  level: string
  source: string
  message: string
  context: Record<string, unknown> | null
  build: string | null
  route: string | null
  user_id: string | null
  created_at: string
}

type Period = '24h' | '7d' | '30d'

const LEVEL_STYLES: Record<string, string> = {
  error: 'bg-[#FDF1F2] text-[#FF4949] border-[#FF4949]/40',
  warn: 'bg-warning-light text-warning border-warning/40',
  info: 'bg-[#E3F3FE] text-[#007EC8] border-[#009EFB]/40',
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '24h', label: '24 dernières heures' },
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
]

/** Onglet "Techniques": tech_logs filtrables, lignes extensibles, purge >30j. */
export function TechLogsTab() {
  const { showToast } = useToast()
  const [rows, setRows] = useState<TechLogRow[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [period, setPeriod] = useState<Period>('24h')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPurging, setIsPurging] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    const now = Date.now()
    const since = period === '24h' ? now - 86400000 : period === '7d' ? now - 7 * 86400000 : now - 30 * 86400000

    let query = supabase
      .from('tech_logs')
      .select('*')
      .gte('created_at', new Date(since).toISOString())
      .order('created_at', { ascending: false })
      .limit(500)
    if (levelFilter !== 'all') query = query.eq('level', levelFilter)
    if (sourceFilter !== 'all') query = query.eq('source', sourceFilter)

    const { data, error } = await query
    if (error) {
      console.error('Error loading tech logs:', error.code, error.message)
      setRows([])
      setSources([])
    } else {
      const loaded = (data ?? []) as TechLogRow[]
      setRows(loaded)
      setSources(Array.from(new Set(loaded.map((row) => row.source))).sort())
    }
    setIsLoading(false)
  }, [levelFilter, period, sourceFilter])

  useEffect(() => {
    load()
  }, [load])

  const needle = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!needle) return rows
    return rows.filter(
      (row) =>
        row.message.toLowerCase().includes(needle) ||
        row.source.toLowerCase().includes(needle) ||
        (row.route ?? '').toLowerCase().includes(needle) ||
        JSON.stringify(row.context ?? {}).toLowerCase().includes(needle)
    )
  }, [needle, rows])

  const purge = async () => {
    setIsPurging(true)
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
    const { error, count } = await supabase
      .from('tech_logs')
      .delete()
      .lt('created_at', cutoff)

    setIsPurging(false)
    if (error) {
      console.error('Purge failed:', error.code, error.message)
      showToast({
        type: 'error',
        title: 'Purge impossible',
        message:
          error.code === '42501'
            ? 'La politique RLS autorise seulement la lecture. Une politique DELETE admin est nécessaire.'
            : 'La purge a échoué. Veuillez réessayer.',
      })
      return
    }
    showToast({
      type: 'success',
      title: 'Purge effectuée',
      message: `${count ?? 0} log(s) de plus de 30 jours supprimé(s).`,
    })
    load()
  }

  const copyContext = async (row: TechLogRow) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(row, null, 2))
      showToast({ type: 'success', title: 'Copié', message: 'Log copié dans le presse-papiers.' })
    } catch {
      showToast({ type: 'error', title: 'Copie impossible', message: 'Sélectionnez le texte manuellement.' })
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_auto]">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Message, source, route, contexte..."
        />
        <PosSelect
          value={levelFilter}
          onChange={(event) => setLevelFilter(event.target.value)}
          aria-label="Filtrer par niveau"
        >
          <option value="all">Tous les niveaux</option>
          <option value="error">Erreur</option>
          <option value="warn">Avertissement</option>
          <option value="info">Info</option>
        </PosSelect>
        <PosSelect
          value={sourceFilter}
          onChange={(event) => setSourceFilter(event.target.value)}
          aria-label="Filtrer par source"
        >
          <option value="all">Toutes les sources</option>
          {sources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </PosSelect>
        <PosSelect
          value={period}
          onChange={(event) => setPeriod(event.target.value as Period)}
          aria-label="Filtrer par période"
        >
          {PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </PosSelect>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="pos-secondary" size="sm" loading={isPurging} onClick={purge}>
          <Trash2 className="h-4 w-4" />
          Purger &gt; 30 jours
        </Button>
      </div>

      {isLoading ? (
        <p className="p-3 text-sm text-[#1C5376]">Chargement des logs techniques…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-[#DCE1E5] p-6 text-center text-sm text-[#1C5376]">
          Aucun log technique sur cette période / ces filtres.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-[#DCE1E5]">
          {filtered.map((row) => (
            <div key={row.id} className="border-b border-[#F6F9FB] last:border-b-0">
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#F6F9FB]"
                aria-expanded={expandedId === row.id}
              >
                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                    LEVEL_STYLES[row.level] ?? 'border-[#DCE1E5] bg-[#F6F9FB] text-[#1C5376]'
                  }`}
                >
                  {row.level}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-[#12364D]">
                    {row.message}
                  </span>
                  <span className="block truncate text-[11px] text-[#7D94A6]">
                    {new Date(row.created_at).toLocaleString('fr-FR')} · {row.source}
                    {row.route ? ` · ${row.route}` : ''} · build {row.build ?? '?'}
                  </span>
                </span>
              </button>
              {expandedId === row.id && (
                <div className="border-t border-[#F6F9FB] bg-[#F6F9FB] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7D94A6]">
                      Contexte
                    </p>
                    <Button type="button" variant="default" size="sm" onClick={() => copyContext(row)}>
                      Copier
                    </Button>
                  </div>
                  <pre className="mt-1 max-h-60 overflow-auto rounded-md border border-[#DCE1E5] bg-white p-2 text-[11px] text-[#12364D]">
                    {JSON.stringify(
                      {
                        context: row.context,
                        build: row.build,
                        route: row.route,
                        user_id: row.user_id,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
