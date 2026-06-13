import { useCallback, useEffect, useState } from 'react'
import { Edit, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { FormInput } from '@/components/ui/form-input'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'

interface KiosqueRow {
  id: string
  nom: string
  adresse: string | null
}

export default function AdminKiosquesPage() {
  const [rows, setRows] = useState<KiosqueRow[]>([])
  const [form, setForm] = useState({ id: '', nom: '', adresse: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    const { data, error } = await supabase.from('kiosques').select('id, nom, adresse').order('nom')
    if (error) console.error('Error loading kiosques:', error)
    setRows((data ?? []) as KiosqueRow[])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const resetForm = () => setForm({ id: '', nom: '', adresse: '' })

  const save = async () => {
    if (!form.nom.trim()) return
    setIsSaving(true)

    const payload = {
      nom: form.nom.trim(),
      adresse: form.adresse.trim() || null,
    }

    const result = form.id
      ? await supabase.from('kiosques').update(payload).eq('id', form.id)
      : await supabase.from('kiosques').insert(payload)

    if (result.error) console.error('Error saving kiosque:', result.error)
    await load()
    resetForm()
    setIsSaving(false)
  }

  const remove = async (id: string) => {
    setIsSaving(true)
    const { error } = await supabase.from('kiosques').delete().eq('id', id)
    if (error) console.error('Error deleting kiosque:', error)
    await load()
    setIsSaving(false)
  }

  const columns: DataTableColumn<KiosqueRow>[] = [
    { key: 'nom', header: 'Kiosque', render: (row) => <span className="font-medium">{row.nom}</span>, sortValue: (row) => row.nom },
    { key: 'adresse', header: 'Adresse', render: (row) => row.adresse || 'Non renseignee', sortValue: (row) => row.adresse ?? '' },
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
              setForm({ id: row.id, nom: row.nom, adresse: row.adresse ?? '' })
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
        <h1 className="text-[15px] font-semibold text-text">Kiosques</h1>
        <p className="text-[12px] text-text-secondary">Gestion des points de vente du reseau.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{form.id ? 'Modifier un kiosque' : 'Nouveau kiosque'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <FormInput
              value={form.nom}
              onChange={(event) => setForm((current) => ({ ...current, nom: event.target.value }))}
              placeholder="Nom du kiosque"
            />
            <FormInput
              value={form.adresse}
              onChange={(event) => setForm((current) => ({ ...current, adresse: event.target.value }))}
              placeholder="Adresse"
            />
            <Button type="button" variant="primary" onClick={save} loading={isSaving} disabled={!form.nom.trim()}>
              <Save className="h-4 w-4" />
              {form.id ? 'Mettre a jour' : 'Creer'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liste des kiosques</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-12" />)}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState title="Aucun kiosque" description="Creez le premier kiosque du reseau." />
          ) : (
            <DataTable columns={columns} data={rows} getRowKey={(row) => row.id} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
