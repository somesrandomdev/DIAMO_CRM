import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { PosCard, PosLabel, PosProgress } from '@/components/pos'
import { useToast } from '@/components/Toast'
import { chartTheme } from '@/lib/chartTheme'
import { monthKey, startOfMonth } from '@/lib/commercialStats'
import { supabase } from '@/lib/supabase'
import { toCFA } from '@/utils/price'

interface FontainierRow {
  id: string
  username: string
  kiosque_id: string | null
  kiosques?: { nom?: string } | { nom?: string }[] | null
}

interface VenteRow {
  kiosque_id: string
  client_id: string | null
  montant_total: number | null
}

interface ObjectifRow {
  kiosque_id: string
  ca_cible: number
}

interface PerformanceRow {
  id: string
  nom: string
  kiosque: string
  ca: number
  target: number | null
  attainment: number | null
  ventes: number
  clients: number
  panier: number
}

function firstJoined<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/** Attainment color buckets: green >100 %, amber 80-100 %, red <80 %. */
function attainmentTone(pct: number | null) {
  if (pct === null) return { fill: 'bg-muted', text: 'text-text-secondary' }
  if (pct > 100) return { fill: 'bg-success', text: 'text-success' }
  if (pct >= 80) return { fill: 'bg-warning', text: 'text-warning' }
  return { fill: 'bg-destructive', text: 'text-destructive' }
}

export default function FontainierPerformance() {
  const { showToast } = useToast()
  const [fontainiers, setFontainiers] = useState<FontainierRow[]>([])
  const [ventes, setVentes] = useState<VenteRow[]>([])
  const [objectifs, setObjectifs] = useState<ObjectifRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [profilesResult, ventesResult, objectifsResult] = await Promise.all([
      supabase.from('profiles').select('id, username, kiosque_id, kiosques(nom)').eq('role', 'fontainier').is('deleted_at', null),
      supabase
        .from('ventes')
        .select('kiosque_id, client_id, montant_total')
        .gte('created_at', startOfMonth().toISOString()),
      supabase.from('objectifs').select('kiosque_id, ca_cible').eq('mois', monthKey()),
    ])

    const failure = profilesResult.error ?? ventesResult.error ?? objectifsResult.error
    if (failure) {
      console.error('Error loading fontainier performance:', failure)
      showToast({
        type: 'error',
        title: 'Chargement impossible',
        message: "Les performances n'ont pas pu être chargées. Veuillez réessayer.",
      })
    }

    setFontainiers((profilesResult.data ?? []) as FontainierRow[])
    setVentes((ventesResult.data ?? []) as VenteRow[])
    setObjectifs((objectifsResult.data ?? []) as ObjectifRow[])
    setIsLoading(false)
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  // Ventes and objectifs are kiosk-scoped, so each fontainier's metrics come
  // from their kiosk's month numbers.
  const rows = useMemo<PerformanceRow[]>(() => {
    const targetByKiosque = new Map(objectifs.map((objectif) => [objectif.kiosque_id, objectif.ca_cible]))

    return fontainiers
      .map((fontainier) => {
        const kiosqueNom = firstJoined(fontainier.kiosques)?.nom ?? 'Sans kiosque'
        const kioskSales = fontainier.kiosque_id
          ? ventes.filter((vente) => vente.kiosque_id === fontainier.kiosque_id)
          : []
        const ca = kioskSales.reduce((sum, vente) => sum + (vente.montant_total ?? 0), 0)
        const target = fontainier.kiosque_id ? targetByKiosque.get(fontainier.kiosque_id) ?? null : null
        const clients = new Set(kioskSales.map((vente) => vente.client_id).filter(Boolean)).size

        return {
          id: fontainier.id,
          nom: fontainier.username,
          kiosque: kiosqueNom,
          ca,
          target,
          attainment: target !== null && target > 0 ? (ca / target) * 100 : null,
          ventes: kioskSales.length,
          clients,
          panier: kioskSales.length > 0 ? Math.round(ca / kioskSales.length) : 0,
        }
      })
      .sort((a, b) => (b.attainment ?? -1) - (a.attainment ?? -1))
  }, [fontainiers, objectifs, ventes])

  const columns: DataTableColumn<PerformanceRow>[] = [
    { key: 'nom', header: 'Fontainier', render: (row) => <span className="font-medium">{row.nom}</span>, sortValue: (row) => row.nom },
    { key: 'kiosque', header: 'Kiosque', render: (row) => row.kiosque, sortValue: (row) => row.kiosque },
    { key: 'ca', header: 'CA du mois', align: 'right', render: (row) => <span className="font-mono">{toCFA(row.ca)}</span>, sortValue: (row) => row.ca },
    {
      key: 'target',
      header: 'Objectif',
      align: 'right',
      render: (row) => (row.target ? <span className="font-mono">{toCFA(row.target)}</span> : <span className="text-text-tertiary">Non défini</span>),
      sortValue: (row) => row.target ?? 0,
    },
    {
      key: 'attainment',
      header: 'Réalisation',
      render: (row) => {
        const tone = attainmentTone(row.attainment)
        return (
          <div className="ml-auto w-28">
            <PosProgress
              value={Math.min(100, row.attainment ?? 0)}
              className="h-2 rounded-full bg-muted"
              barClassName={`rounded-full ${tone.fill}`}
            />
            <p className={`mt-1 text-right text-xs font-semibold [font-variant-numeric:tabular-nums] ${tone.text}`}>
              {row.attainment !== null ? `${row.attainment.toFixed(0)} %` : 'N/A'}
            </p>
          </div>
        )
      },
      sortValue: (row) => row.attainment ?? -1,
    },
    { key: 'ventes', header: 'Ventes', align: 'right', render: (row) => row.ventes, sortValue: (row) => row.ventes },
    { key: 'clients', header: 'Clients', align: 'right', render: (row) => row.clients, sortValue: (row) => row.clients },
    { key: 'panier', header: 'Panier moyen', align: 'right', render: (row) => <span className="font-mono">{toCFA(row.panier)}</span>, sortValue: (row) => row.panier },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-text">Performance des fontainiers</h1>
        <p className="text-xs text-text-secondary">
          Réalisation de l'objectif mensuel par kiosque — mois en cours.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-5 w-5" />}
          title="Aucun fontainier"
          description="Ajoutez des fontainiers avec un kiosque assigné pour suivre leurs performances."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <PosCard className="flex flex-col gap-1">
              <PosLabel>Objectif atteint</PosLabel>
              <span className="text-2xl font-bold text-[#12364D] [font-variant-numeric:tabular-nums]">
                {rows.filter((row) => (row.attainment ?? 0) > 100).length}
              </span>
            </PosCard>
            <PosCard className="flex flex-col gap-1">
              <PosLabel>En bonne voie (80-100 %)</PosLabel>
              <span className="text-2xl font-bold text-[#12364D] [font-variant-numeric:tabular-nums]">
                {rows.filter((row) => row.attainment !== null && row.attainment >= 80 && row.attainment <= 100).length}
              </span>
            </PosCard>
            <PosCard className="flex flex-col gap-1">
              <PosLabel>En difficulté (&lt; 80 %)</PosLabel>
              <span className="text-2xl font-bold text-[#12364D] [font-variant-numeric:tabular-nums]">
                {rows.filter((row) => row.attainment !== null && row.attainment < 80).length}
              </span>
            </PosCard>
          </div>

          <PosCard>
            <PosLabel className="mb-3">Réalisation par fontainier (%)</PosLabel>
            <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 44)}>
              <BarChart data={rows.map((row) => ({ nom: row.nom, pct: Math.round(row.attainment ?? 0) }))} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => `${value} %`} tick={{ fill: chartTheme.axis, fontSize: 11 }} />
                <YAxis dataKey="nom" type="category" width={130} tick={{ fill: chartTheme.axis, fontSize: 12 }} />
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(value) => [`${value} %`, 'Réalisation']} />
                <Bar dataKey="pct" fill="#009EFB" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </PosCard>

          <div className="hidden sm:block">
            <DataTable columns={columns} data={rows} getRowKey={(row) => row.id} />
          </div>

          {/* Mobile: one card per fontainier */}
          <div className="space-y-3 sm:hidden">
            {rows.map((row) => {
              const tone = attainmentTone(row.attainment)
              return (
                <div key={row.id} className="rounded-md border border-border bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text">{row.nom}</p>
                      <p className="text-xs text-text-secondary">{row.kiosque}</p>
                    </div>
                    <p className="shrink-0 text-right text-base font-bold text-text [font-variant-numeric:tabular-nums]">
                      {toCFA(row.ca)}
                    </p>
                  </div>
                  <div className="mt-2">
                    <PosProgress
                      value={Math.min(100, row.attainment ?? 0)}
                      className="rounded-full bg-muted"
                      barClassName={`rounded-full ${tone.fill}`}
                    />
                    <p className={`mt-1 text-right text-xs font-semibold [font-variant-numeric:tabular-nums] ${tone.text}`}>
                      {row.attainment !== null
                        ? `${row.attainment.toFixed(0)} % de ${row.target ? toCFA(row.target) : '—'}`
                        : 'Objectif non défini'}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary [font-variant-numeric:tabular-nums]">
                    {row.ventes} vente(s) - {row.clients} client(s) - panier {toCFA(row.panier)}
                  </p>
                </div>
              )
            })}
          </div>
        </>
      )}

      <Button type="button" variant="default" size="sm" className="w-fit" onClick={load}>
        Actualiser
      </Button>
    </div>
  )
}
