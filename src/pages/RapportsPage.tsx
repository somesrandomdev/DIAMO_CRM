import { useCallback, useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { PosCard, PosLabel, PosProgress } from '@/components/pos'
import { chartTheme } from '@/lib/chartTheme'
import { monthKey, startOfMonth } from '@/lib/commercialStats'
import { supabase } from '@/lib/supabase'
import { formatCFACompact, toCFA } from '@/utils/price'

interface KiosqueRow {
  id: string
  nom: string
  adresse?: string | null
}

interface VenteRow {
  id: string
  kiosque_id: string
  client_id: string | null
  offre_id: string | null
  montant_total: number | null
  quantite: number | null
  created_at: string
  offres?: { nom?: string } | { nom?: string }[] | null
  clients?: { nom?: string } | { nom?: string }[] | null
}

interface ReportRow {
  kiosque: KiosqueRow
  ca: number
  ventes: number
  target: number
  progress: number
  topClient: string
  bestOffer: string
}

type Period = 'current' | 'previous' | 'quarter'

const periodOptions: { value: Period; label: string }[] = [
  { value: 'current', label: 'Ce mois' },
  { value: 'previous', label: 'Mois dernier' },
  { value: 'quarter', label: '3 derniers mois' },
]

function joinedName(value: { nom?: string } | { nom?: string }[] | null | undefined): string {
  if (Array.isArray(value)) return value[0]?.nom ?? 'Inconnu'
  return value?.nom ?? 'Inconnu'
}

function monthKeyOffset(monthsAgo: number): string {
  const now = new Date()
  return monthKey(new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1))
}

export default function RapportsPage() {
  const [kiosques, setKiosques] = useState<KiosqueRow[]>([])
  const [sales, setSales] = useState<VenteRow[]>([])
  const [objectivesByMonth, setObjectivesByMonth] = useState<Record<string, number>>({})
  const [period, setPeriod] = useState<Period>('current')
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)

    const now = new Date()
    const quarterStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 2, 1))

    const [kiosquesResult, salesResult, objectivesResult] = await Promise.all([
      supabase.from('kiosques').select('id, nom, adresse').order('nom'),
      supabase
        .from('ventes')
        .select('id, kiosque_id, client_id, offre_id, montant_total, quantite, created_at, offres(nom), clients(nom)')
        .gte('created_at', quarterStart.toISOString()),
      supabase
        .from('objectifs')
        .select('kiosque_id, mois, ca_cible')
        .in('mois', [monthKeyOffset(0), monthKeyOffset(1), monthKeyOffset(2)]),
    ])

    setKiosques((kiosquesResult.data ?? []) as KiosqueRow[])
    setSales((salesResult.data ?? []) as VenteRow[])

    const nextObjectives: Record<string, number> = {}
    for (const objective of (objectivesResult.data ?? []) as Array<{ kiosque_id: string; mois: string; ca_cible: number }>) {
      nextObjectives[`${objective.kiosque_id}|${objective.mois}`] = objective.ca_cible
    }
    setObjectivesByMonth(nextObjectives)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const scoped = useMemo(() => {
    const now = new Date()
    let from: Date
    let toExclusive: Date | null = null
    if (period === 'current') {
      from = startOfMonth(now)
    } else if (period === 'previous') {
      from = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))
      toExclusive = startOfMonth(now)
    } else {
      from = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 2, 1))
    }

    const fromIso = from.toISOString()
    const toIso = toExclusive?.toISOString() ?? null
    return sales.filter(
      (sale) => sale.created_at >= fromIso && (toIso === null || sale.created_at < toIso)
    )
  }, [period, sales])

  const targetFor = useCallback(
    (kiosqueId: string): number => {
      if (period === 'current') return objectivesByMonth[`${kiosqueId}|${monthKeyOffset(0)}`] ?? 0
      if (period === 'previous') return objectivesByMonth[`${kiosqueId}|${monthKeyOffset(1)}`] ?? 0
      // Quarter: sum of the three months' targets (undefined months count 0)
      return [0, 1, 2].reduce(
        (sum, monthsAgo) => sum + (objectivesByMonth[`${kiosqueId}|${monthKeyOffset(monthsAgo)}`] ?? 0),
        0
      )
    },
    [objectivesByMonth, period]
  )

  const rows = useMemo<ReportRow[]>(() => {
    return kiosques.map((kiosque) => {
      const kioskSales = scoped.filter((sale) => sale.kiosque_id === kiosque.id)
      const ca = kioskSales.reduce((sum, sale) => sum + (sale.montant_total ?? 0), 0)
      const target = targetFor(kiosque.id)
      const clientMap = new Map<string, number>()
      const offerMap = new Map<string, number>()

      kioskSales.forEach((sale) => {
        const client = joinedName(sale.clients)
        const offer = joinedName(sale.offres)
        clientMap.set(client, (clientMap.get(client) ?? 0) + (sale.montant_total ?? 0))
        offerMap.set(offer, (offerMap.get(offer) ?? 0) + (sale.quantite ?? 1))
      })

      return {
        kiosque,
        ca,
        ventes: kioskSales.length,
        target,
        progress: target > 0 ? (ca / target) * 100 : 0,
        topClient: Array.from(clientMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Aucun',
        bestOffer: Array.from(offerMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Aucune',
      }
    })
  }, [kiosques, scoped, targetFor])

  const periodLabel = periodOptions.find((option) => option.value === period)?.label ?? ''

  const exportPdf = (row: ReportRow) => {
    const pdf = new jsPDF()
    const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

    pdf.setFontSize(18)
    pdf.text(`Rapport - ${row.kiosque.nom}`, 16, 20)
    pdf.setFontSize(11)
    pdf.text(`${periodLabel} (${monthLabel})`, 16, 30)
    pdf.text(row.kiosque.adresse || 'Adresse non renseignee', 16, 38)

    pdf.setFontSize(14)
    pdf.text('Synthese', 16, 56)
    pdf.setFontSize(11)
    pdf.text(`Chiffre d'affaires: ${toCFA(row.ca)}`, 16, 68)
    pdf.text(`Nombre de ventes: ${row.ventes}`, 16, 78)
    pdf.text(`Panier moyen: ${toCFA(row.ventes > 0 ? row.ca / row.ventes : 0)}`, 16, 88)
    pdf.text(`Top client: ${row.topClient}`, 16, 98)
    pdf.text(`Meilleure offre: ${row.bestOffer}`, 16, 108)
    pdf.text(`Objectif: ${row.target > 0 ? toCFA(row.target) : 'Non defini'}`, 16, 118)
    pdf.text(`Realisation: ${row.target > 0 ? `${row.progress.toFixed(1)}%` : 'N/A'}`, 16, 128)

    pdf.save(`rapport-${row.kiosque.nom.toLowerCase().replaceAll(' ', '-')}.pdf`)
  }

  const columns: DataTableColumn<ReportRow>[] = [
    { key: 'kiosque', header: 'Kiosque', render: (row) => <span className="font-medium">{row.kiosque.nom}</span>, sortValue: (row) => row.kiosque.nom },
    { key: 'ca', header: 'CA', align: 'right', render: (row) => <span className="font-mono">{toCFA(row.ca)}</span>, sortValue: (row) => row.ca },
    { key: 'target', header: 'Objectif', align: 'right', render: (row) => row.target > 0 ? <span className="font-mono">{toCFA(row.target)}</span> : <span className="text-text-tertiary">Non defini</span>, sortValue: (row) => row.target },
    {
      key: 'progress',
      header: '%',
      align: 'right',
      render: (row) => (
        <div className="ml-auto w-24">
          <PosProgress value={row.progress} className="bg-muted" barClassName="bg-primary" />
          <p className="mt-1 text-right text-[10.5px] text-text-secondary">
            {row.target > 0 ? `${row.progress.toFixed(1)}%` : 'N/A'}
          </p>
        </div>
      ),
      sortValue: (row) => row.progress,
    },
    { key: 'ventes', header: 'Ventes', align: 'right', render: (row) => row.ventes, sortValue: (row) => row.ventes },
    { key: 'topClient', header: 'Top client', render: (row) => row.topClient, sortValue: (row) => row.topClient },
    { key: 'bestOffer', header: 'Meilleure offre', render: (row) => row.bestOffer, sortValue: (row) => row.bestOffer },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <Button type="button" variant="default" size="sm" onClick={() => exportPdf(row)}>
          <Download className="h-4 w-4" />
          PDF
        </Button>
      ),
    },
  ]

  const chartRows = rows
    .map((row) => ({
      nom: row.kiosque.nom,
      ca: row.ca,
      ventes: row.ventes,
      pct: row.target > 0 ? Math.round(row.progress) : 0,
    }))
    .filter((row) => row.ca > 0 || row.ventes > 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-text">Rapports</h1>
          <p className="text-[12px] text-text-secondary">Comparaison des kiosques et exports par periode.</p>
        </div>
        <div className="inline-flex rounded-md border border-border bg-surface text-[12px] font-medium">
          {periodOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              className={
                period === option.value
                  ? 'rounded-md bg-primary px-3 py-2 text-white'
                  : 'min-h-12 px-3 py-2 text-text-secondary hover:text-text sm:min-h-0'
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kiosk-to-kiosk comparisons — horizontal bars for mobile readability */}
      {chartRows.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <PosCard>
            <PosLabel className="mb-3">Chiffre d'affaires par kiosque</PosLabel>
            <ResponsiveContainer width="100%" height={Math.max(160, chartRows.length * 44)}>
              <BarChart data={chartRows} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => formatCFACompact(Number(value))} tick={{ fill: chartTheme.axis, fontSize: 11 }} />
                <YAxis dataKey="nom" type="category" width={110} tick={{ fill: chartTheme.axis, fontSize: 11 }} />
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(value) => [toCFA(Number(value)), 'CA']} />
                <Bar dataKey="ca" fill="#009EFB" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </PosCard>

          <PosCard>
            <PosLabel className="mb-3">Realisation des objectifs (%)</PosLabel>
            <ResponsiveContainer width="100%" height={Math.max(160, chartRows.length * 44)}>
              <BarChart data={chartRows} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => `${value} %`} tick={{ fill: chartTheme.axis, fontSize: 11 }} />
                <YAxis dataKey="nom" type="category" width={110} tick={{ fill: chartTheme.axis, fontSize: 11 }} />
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(value) => [`${value} %`, 'Realisation']} />
                <Bar dataKey="pct" fill="#12364D" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </PosCard>

          <PosCard>
            <PosLabel className="mb-3">Volume de ventes par kiosque</PosLabel>
            <ResponsiveContainer width="100%" height={Math.max(160, chartRows.length * 44)}>
              <BarChart data={chartRows} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: chartTheme.axis, fontSize: 11 }} />
                <YAxis dataKey="nom" type="category" width={110} tick={{ fill: chartTheme.axis, fontSize: 11 }} />
                <Tooltip contentStyle={chartTheme.tooltip} formatter={(value) => [value, 'Ventes']} />
                <Bar dataKey="ventes" fill="#007EC8" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </PosCard>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Rapport par kiosque - {periodLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 rounded-lg" />)}
            </div>
          ) : rows.length === 0 || scoped.length === 0 ? (
            <EmptyState title="Aucun rapport" description="Les rapports apparaitront apres les premieres ventes de la periode." />
          ) : (
            <>
              <div className="hidden sm:block">
                <DataTable columns={columns} data={rows} getRowKey={(row) => row.kiosque.id} />
              </div>

              {/* Mobile: one card per kiosk, CA vs target up front */}
              <div className="space-y-3 sm:hidden">
                {rows.map((row) => (
                  <div key={row.kiosque.id} className="rounded-md border border-border bg-surface p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[14px] font-semibold text-text">{row.kiosque.nom}</p>
                      <Button
                        type="button"
                        variant="default"
                        size="icon"
                        className="h-12 w-12 min-h-12"
                        aria-label={`Exporter le rapport de ${row.kiosque.nom} en PDF`}
                        onClick={() => exportPdf(row)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mt-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-[16px] font-bold text-blue [font-variant-numeric:tabular-nums]">
                          {toCFA(row.ca)}
                        </span>
                        <span className="text-[11px] text-text-secondary [font-variant-numeric:tabular-nums]">
                          / {row.target > 0 ? toCFA(row.target) : 'Non defini'}
                        </span>
                      </div>
                      <PosProgress value={row.progress} className="bg-muted" barClassName="bg-primary" />
                      <p className="mt-1 text-right text-[10.5px] text-text-secondary [font-variant-numeric:tabular-nums]">
                        {row.target > 0 ? `${row.progress.toFixed(1)}%` : 'N/A'} - {row.ventes} vente(s)
                      </p>
                    </div>

                    <dl className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                      <div>
                        <dt className="text-text-secondary">Top client</dt>
                        <dd className="font-medium text-text">{row.topClient}</dd>
                      </div>
                      <div>
                        <dt className="text-text-secondary">Meilleure offre</dt>
                        <dd className="font-medium text-text">{row.bestOffer}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

