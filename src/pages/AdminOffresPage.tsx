import { useCallback, useEffect, useState } from 'react'
import { Edit, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { FormInput } from '@/components/ui/form-input'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'

interface OffreRow {
  id: string
  nom: string
  volume_ml: number | null
  description: string | null
}

function formatVolume(volumeMl: number | null) {
  return volumeMl ? `${volumeMl / 1000} L` : 'Non defini'
}

export default function AdminOffresPage() {
  const [rows, setRows] = useState<OffreRow[]>([])
  const [form, setForm] = useState({ id: '', nom: '', volume_ml: '', description: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase.from('offres').select('id, nom, volume_ml, description').order('nom')
    if (error) console.error('Error loading offres:', error)
    setRows((data ?? []) as OffreRow[])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const resetForm = () => setForm({ id: '', nom: '', volume_ml: '', description: '' })

  const save = async () => {
    if (!form.nom.trim()) return

    const volume = Math.round(Number(form.volume_ml))
    setIsSaving(true)
    const payload = {
      nom: form.nom.trim(),
      volume_ml: Number.isFinite(volume) && volume > 0 ? volume : null,
      description: form.description.trim() || null,
    }

    const result = form.id
      ? await supabase.from('offres').update(payload).eq('id', form.id)
      : await supabase.from('offres').insert(payload)

    if (result.error) console.error('Error saving offre:', result.error)
    await load()
    resetForm()
    setIsSaving(false)
  }

  const remove = async (id: string) => {
    setIsSaving(true)
    const { error } = await supabase.from('offres').delete().eq('id', id)
    if (error) console.error('Error deleting offre:', error)
    await load()
    setIsSaving(false)
  }

  const columns: DataTableColumn<OffreRow>[] = [
    { key: 'nom', header: 'Offre', render: (row) => <span className="font-medium">{row.nom}</span>, sortValue: (row) => row.nom },
    { key: 'volume', header: 'Volume', render: (row) => formatVolume(row.volume_ml), sortValue: (row) => row.volume_ml ?? 0 },
    { key: 'description', header: 'Description', render: (row) => row.description || 'Aucune', sortValue: (row) => row.description ?? '' },
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
                nom: row.nom,
                volume_ml: row.volume_ml?.toString() ?? '',
                description: row.description ?? '',
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
        <h1 className="text-[15px] font-semibold text-text">Offres</h1>
        <p className="text-[12px] text-text-secondary">Catalogue des volumes vendus par les kiosques.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{form.id ? 'Modifier une offre' : 'Nouvelle offre'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:grid-cols-[1fr_160px_1fr_auto]">
            <FormInput value={form.nom} onChange={(event) => setForm((current) => ({ ...current, nom: event.target.value }))} placeholder="Nom" />
            <FormInput value={form.volume_ml} onChange={(event) => setForm((current) => ({ ...current, volume_ml: event.target.value }))} type="number" min={0} placeholder="Volume ml" />
            <FormInput value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" />
            <Button type="button" variant="primary" onClick={save} loading={isSaving} disabled={!form.nom.trim()}>
              <Save className="h-4 w-4" />
              {form.id ? 'Mettre a jour' : 'Creer'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste des offres</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-12" />)}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState title="Aucune offre" description="Ajoutez une offre pour activer les ventes." />
          ) : (
            <DataTable columns={columns} data={rows} getRowKey={(row) => row.id} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
