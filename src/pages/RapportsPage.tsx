import { useCallback, useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { toCFA } from '@/utils/price'

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

interface ObjectiveRow {
  kiosque_id: string
  ca_cible: number
}

function joinedName(value: { nom?: string } | { nom?: string }[] | null | undefined): string {
  if (Array.isArray(value)) return value[0]?.nom ?? 'Inconnu'
  return value?.nom ?? 'Inconnu'
}

export default function RapportsPage() {
  const [kiosques, setKiosques] = useState<KiosqueRow[]>([])
  const [sales, setSales] = useState<VenteRow[]>([])
  const [objectives, setObjectives] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const monthValue = monthStart.toISOString().slice(0, 10)

    const [kiosquesResult, salesResult, objectivesResult] = await Promise.all([
      supabase.from('kiosques').select('id, nom, adresse').order('nom'),
      supabase
        .from('ventes')
        .select('id, kiosque_id, client_id, offre_id, montant_total, quantite, offres(nom), clients(nom)')
        .gte('created_at', monthStart.toISOString()),
      supabase
        .from('objectifs')
        .select('kiosque_id, ca_cible')
        .eq('mois', monthValue),
    ])

    setKiosques((kiosquesResult.data ?? []) as KiosqueRow[])
    setSales((salesResult.data ?? []) as VenteRow[])
    const nextObjectives: Record<string, number> = {}
    ;((objectivesResult.data ?? []) as ObjectiveRow[]).forEach((objective) => {
      nextObjectives[objective.kiosque_id] = objective.ca_cible
    })
    setObjectives(nextObjectives)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo<ReportRow[]>(() => {
    return kiosques.map((kiosque) => {
      const kioskSales = sales.filter((sale) => sale.kiosque_id === kiosque.id)
      const ca = kioskSales.reduce((sum, sale) => sum + (sale.montant_total ?? 0), 0)
      const target = objectives[kiosque.id] ?? 0
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
  }, [kiosques, objectives, sales])

  const exportPdf = (row: ReportRow) => {
    const pdf = new jsPDF()
    const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

    pdf.setFontSize(18)
    pdf.text(`Rapport mensuel - ${row.kiosque.nom}`, 16, 20)
    pdf.setFontSize(11)
    pdf.text(monthLabel, 16, 30)
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
          <ProgressBar value={row.progress} />
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[15px] font-semibold text-text">Rapports</h1>
        <p className="text-[12px] text-text-secondary">Exports mensuels par kiosque.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Rapport mensuel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 rounded-lg" />)}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState title="Aucun rapport" description="Les rapports apparaitront apres les premieres ventes du mois." />
          ) : (
            <DataTable columns={columns} data={rows} getRowKey={(row) => row.kiosque.id} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
