import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { FormInput, FormSelect } from '@/components/ui/form-input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { supabase } from '@/lib/supabase'
import { toCFA } from '@/utils/price'

interface KiosqueRow {
  id: string
  nom: string
}

interface OffreRow {
  id: string
  nom: string
}

interface TarifRow {
  id: string
  kiosque_id: string
  offre_id: string
  prix: number
  est_actif: boolean
}

export default function AdminTarifsPage() {
  const [kiosques, setKiosques] = useState<KiosqueRow[]>([])
  const [offres, setOffres] = useState<OffreRow[]>([])
  const [tarifs, setTarifs] = useState<TarifRow[]>([])
  const [form, setForm] = useState({ id: '', kiosque_id: '', offre_id: '', prix: '', est_actif: true })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    const [kiosquesResult, offresResult, tarifsResult] = await Promise.all([
      supabase.from('kiosques').select('id, nom').order('nom'),
      supabase.from('offres').select('id, nom').order('nom'),
      supabase.from('offres_kiosque').select('id, kiosque_id, offre_id, prix, est_actif'),
    ])

    if (kiosquesResult.error) console.error('Error loading kiosques:', kiosquesResult.error)
    if (offresResult.error) console.error('Error loading offres:', offresResult.error)
    if (tarifsResult.error) console.error('Error loading tarifs:', tarifsResult.error)

    setKiosques((kiosquesResult.data ?? []) as KiosqueRow[])
    setOffres((offresResult.data ?? []) as OffreRow[])
    setTarifs((tarifsResult.data ?? []) as TarifRow[])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const names = useMemo(() => ({
    kiosques: new Map(kiosques.map((item) => [item.id, item.nom])),
    offres: new Map(offres.map((item) => [item.id, item.nom])),
  }), [kiosques, offres])

  const resetForm = () => setForm({ id: '', kiosque_id: '', offre_id: '', prix: '', est_actif: true })

  const save = async () => {
    if (!form.kiosque_id || !form.offre_id || !form.prix) return
    const prix = Math.round(Number(form.prix))
    if (!Number.isFinite(prix) || prix < 0) return

    setIsSaving(true)
    const payload = {
      kiosque_id: form.kiosque_id,
      offre_id: form.offre_id,
      prix,
      est_actif: form.est_actif,
    }

    const result = form.id
      ? await supabase.from('offres_kiosque').update(payload).eq('id', form.id)
      : await supabase.from('offres_kiosque').insert(payload)

    if (result.error) console.error('Error saving tarif:', result.error)
    await load()
    resetForm()
    setIsSaving(false)
  }

  const remove = async (id: string) => {
    setIsSaving(true)
    const { error } = await supabase.from('offres_kiosque').delete().eq('id', id)
    if (error) console.error('Error deleting tarif:', error)
    await load()
    setIsSaving(false)
  }

  const columns: DataTableColumn<TarifRow>[] = [
    { key: 'kiosque', header: 'Kiosque', render: (row) => names.kiosques.get(row.kiosque_id) ?? 'Inconnu', sortValue: (row) => names.kiosques.get(row.kiosque_id) ?? '' },
    { key: 'offre', header: 'Offre', render: (row) => names.offres.get(row.offre_id) ?? 'Inconnue', sortValue: (row) => names.offres.get(row.offre_id) ?? '' },
    { key: 'prix', header: 'Prix', render: (row) => <span className="font-mono">{toCFA(row.prix)}</span>, sortValue: (row) => row.prix, align: 'right' },
    { key: 'statut', header: 'Statut', render: (row) => <StatusBadge variant={row.est_actif ? 'success' : 'neutral'}>{row.est_actif ? 'Actif' : 'Inactif'}</StatusBadge>, sortValue: (row) => Number(row.est_actif) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="default"
            size="icon-sm"
            aria-label="Modifier"
            onClick={(event) => {
              event.stopPropagation()
              setForm({
                id: row.id,
                kiosque_id: row.kiosque_id,
                offre_id: row.offre_id,
                prix: row.prix.toString(),
                est_actif: row.est_actif,
              })
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            aria-label="Supprimer"
            onClick={(event) => {
              event.stopPropagation()
              remove(row.id)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[15px] font-semibold text-text">Tarifs</h1>
        <p className="text-[12px] text-text-secondary">Prix actifs par kiosque et par offre.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{form.id ? 'Modifier un tarif' : 'Nouveau tarif'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_160px_140px_auto]">
            <FormSelect value={form.kiosque_id} onChange={(event) => setForm((current) => ({ ...current, kiosque_id: event.target.value }))}>
              <option value="">Kiosque</option>
              {kiosques.map((kiosque) => <option key={kiosque.id} value={kiosque.id}>{kiosque.nom}</option>)}
            </FormSelect>
            <FormSelect value={form.offre_id} onChange={(event) => setForm((current) => ({ ...current, offre_id: event.target.value }))}>
              <option value="">Offre</option>
              {offres.map((offre) => <option key={offre.id} value={offre.id}>{offre.nom}</option>)}
            </FormSelect>
            <FormInput value={form.prix} onChange={(event) => setForm((current) => ({ ...current, prix: event.target.value }))} type="number" min={0} placeholder="Prix CFA" />
            <FormSelect value={String(form.est_actif)} onChange={(event) => setForm((current) => ({ ...current, est_actif: event.target.value === 'true' }))}>
              <option value="true">Actif</option>
              <option value="false">Inactif</option>
            </FormSelect>
            <Button type="button" variant="primary" onClick={save} loading={isSaving} disabled={!form.kiosque_id || !form.offre_id || !form.prix}>
              <Save className="h-4 w-4" />
              Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste des tarifs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-12" />)}
            </div>
          ) : tarifs.length === 0 ? (
            <EmptyState title="Aucun tarif" description="Associez une offre a un kiosque pour lancer les ventes." />
          ) : (
            <DataTable columns={columns} data={tarifs} getRowKey={(row) => row.id} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
