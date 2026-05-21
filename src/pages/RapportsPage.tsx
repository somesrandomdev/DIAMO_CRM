import { useCallback, useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Rapports</h1>
        <p className="text-sm text-muted-foreground">Exports mensuels par kiosque.</p>
      </div>

      <Card className="rounded-lg">
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
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2">Kiosque</th>
                    <th className="px-3 py-2 text-right">CA</th>
                    <th className="px-3 py-2 text-right">Objectif</th>
                    <th className="px-3 py-2 text-right">%</th>
                    <th className="px-3 py-2 text-right">Ventes</th>
                    <th className="px-3 py-2">Top client</th>
                    <th className="px-3 py-2">Meilleure offre</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.kiosque.id} className="border-b last:border-0">
                      <td className="px-3 py-3 font-medium">{row.kiosque.nom}</td>
                      <td className="px-3 py-3 text-right">{toCFA(row.ca)}</td>
                      <td className="px-3 py-3 text-right">{row.target > 0 ? toCFA(row.target) : 'Non defini'}</td>
                      <td className="px-3 py-3 text-right">{row.target > 0 ? `${row.progress.toFixed(1)}%` : 'N/A'}</td>
                      <td className="px-3 py-3 text-right">{row.ventes}</td>
                      <td className="px-3 py-3">{row.topClient}</td>
                      <td className="px-3 py-3">{row.bestOffer}</td>
                      <td className="px-3 py-3 text-right">
                        <Button type="button" variant="outline" size="sm" onClick={() => exportPdf(row)}>
                          <Download className="h-4 w-4" />
                          PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
