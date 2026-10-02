import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LayoutDashboard, Store, Users as UsersIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface PaletteResult {
  kind: 'kiosque' | 'client' | 'utilisateur' | 'page'
  id: string
  label: string
  sub: string
  route: string
}

const PAGES: PaletteResult[] = [
  { kind: 'page', id: 'p-dashboard', label: 'Tableau de bord', sub: 'Admin', route: '/admin/dashboard' },
  { kind: 'page', id: 'p-kiosques', label: 'Kiosques', sub: 'Admin', route: '/admin/kiosques' },
  { kind: 'page', id: 'p-tarifs', label: 'Tarifs (matrice)', sub: 'Admin', route: '/admin/tarifs' },
  { kind: 'page', id: 'p-offres', label: 'Offres', sub: 'Admin', route: '/admin/offres' },
  { kind: 'page', id: 'p-utilisateurs', label: 'Utilisateurs', sub: 'Admin', route: '/admin/utilisateurs' },
  { kind: 'page', id: 'p-clients', label: 'Clients par kiosque', sub: 'Admin', route: '/admin/clients-par-kiosque' },
  { kind: 'page', id: 'p-performance', label: 'Performance', sub: 'Admin', route: '/admin/performance' },
  { kind: 'page', id: 'p-objectifs', label: 'Objectifs', sub: 'Admin', route: '/admin/objectifs' },
  { kind: 'page', id: 'p-logs', label: "Logs d'audit", sub: 'Admin', route: '/admin/logs' },
]

const KIND_ICONS: Record<PaletteResult['kind'], typeof Store> = {
  kiosque: Store,
  client: Users,
  utilisateur: UsersIcon,
  page: LayoutDashboard,
}

/**
 * Command palette (Ctrl/Cmd+K): unified search over pages, kiosques,
 * clients and users. Server-side ilike on the DB entities (limit 8 each).
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [kiosques, setKiosques] = useState<PaletteResult[]>([])
  const [clients, setClients] = useState<PaletteResult[]>([])
  const [utilisateurs, setUtilisateurs] = useState<PaletteResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const fetchEntities = useCallback(async (term: string) => {
    const like = `%${term}%`
    const [kiosquesRes, clientsRes, profilesRes] = await Promise.all([
      supabase.from('kiosques').select('id, nom, adresse').ilike('nom', like).limit(8),
      supabase.from('clients').select('id, nom, telephone').ilike('nom', like).limit(8),
      supabase.from('profiles').select('id, username, role').ilike('username', like).limit(8),
    ])

    setKiosques(
      ((kiosquesRes.data ?? []) as Array<{ id: string; nom: string; adresse: string | null }>).map((row) => ({
        kind: 'kiosque' as const,
        id: row.id,
        label: row.nom,
        sub: row.adresse ?? 'Kiosque',
        route: `/admin/kiosques/${row.id}`,
      }))
    )
    setClients(
      ((clientsRes.data ?? []) as Array<{ id: string; nom: string; telephone: string | null }>).map((row) => ({
        kind: 'client' as const,
        id: row.id,
        label: row.nom,
        sub: row.telephone ?? 'Client',
        route: `/clients?client=${row.id}`,
      }))
    )
    setUtilisateurs(
      ((profilesRes.data ?? []) as Array<{ id: string; username: string; role: string }>).map((row) => ({
        kind: 'utilisateur' as const,
        id: row.id,
        label: row.username,
        sub: row.role,
        route: '/admin/utilisateurs',
      }))
    )
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setKiosques([])
    setClients([])
    setUtilisateurs([])
    void fetchEntities('')
    setIsSearching(false)
  }, [fetchEntities, open])

  useEffect(() => {
    if (!open) return
    setIsSearching(true)
    const timer = window.setTimeout(async () => {
      await fetchEntities(query.trim())
      setIsSearching(false)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [fetchEntities, open, query])

  const pageResults = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return PAGES
    return PAGES.filter((page) => page.label.toLowerCase().includes(needle))
  }, [query])

  const groups: Array<{ title: string; results: PaletteResult[] }> = [
    { title: 'Pages', results: pageResults },
    { title: 'Kiosques', results: kiosques },
    { title: 'Clients', results: clients },
    { title: 'Utilisateurs', results: utilisateurs },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-xl overflow-y-auto" hideClose>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue" aria-hidden="true" />
            Recherche globale
          </DialogTitle>
        </DialogHeader>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Kiosques, clients, utilisateurs, pages..."
          aria-label="Recherche globale"
          autoFocus
          className="h-12 w-full rounded-md border-2 border-border px-3 text-base text-text placeholder:text-text-tertiary focus:border-blue focus:outline-none"
        />
        <div className="space-y-1">
          {groups.map((group) =>
            group.results.length === 0 ? null : (
              <div key={group.title}>
                <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  {group.title}
                </p>
                {group.results.map((result) => {
                  const Icon = KIND_ICONS[result.kind]
                  return (
                    <button
                      key={`${result.kind}-${result.id}`}
                      type="button"
                      onClick={() => {
                        onOpenChange(false)
                        navigate(result.route)
                      }}
                      className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left hover:bg-bg"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-blue" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-text">
                          {result.label}
                        </span>
                        <span className="block truncate text-xs text-text-tertiary">{result.sub}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          )}
          {isSearching && <p className="p-2 text-xs text-text-tertiary">Recherche…</p>}
        </div>
        <p className="border-t border-border pt-2 text-center text-xs text-text-tertiary">
          Échap pour fermer
        </p>
      </DialogContent>
    </Dialog>
  )
}
