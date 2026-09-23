import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { SearchBar } from '@/components/SearchBar'
import { PosInput, PosLabel } from '@/components/pos'
import { useToast } from '@/components/Toast'
import { handleSupabaseError, supabase } from '@/lib/supabase'

interface KiosqueRow {
  id: string
  nom: string
  adresse: string | null
}

export default function AdminKiosquesPage() {
  const { showToast } = useToast()
  const [rows, setRows] = useState<KiosqueRow[]>([])
  const [form, setForm] = useState({ id: '', nom: '', adresse: '' })
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deleting, setDeleting] = useState<KiosqueRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [kiosqueSearch, setKiosqueSearch] = useState('')

  const filteredRows = useMemo(() => {
    const needle = kiosqueSearch.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) => row.nom.toLowerCase().includes(needle))
  }, [kiosqueSearch, rows])

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

  const openCreate = () => {
    setForm({ id: '', nom: '', adresse: '' })
    setIsFormOpen(true)
  }

  const openEdit = (row: KiosqueRow) => {
    setForm({ id: row.id, nom: row.nom, adresse: row.adresse ?? '' })
    setIsFormOpen(true)
  }

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

    if (result.error) {
      console.error('Error saving kiosque:', result.error)
      showToast({
        type: 'error',
        title: 'Enregistrement impossible',
        message: handleSupabaseError(result.error),
      })
    } else {
      showToast({
        type: 'success',
        title: form.id ? 'Kiosque mis à jour' : 'Kiosque créé',
        message: `${payload.nom} a été enregistré.`,
      })
    }

    setIsFormOpen(false)
    await load()
    setIsSaving(false)
  }

  const confirmDelete = async () => {
    if (!deleting) return

    setIsDeleting(true)
    const { error } = await supabase.from('kiosques').delete().eq('id', deleting.id)
    setIsDeleting(false)

    if (error) {
      console.error('Error deleting kiosque:', error)
      showToast({
        type: 'error',
        title: 'Suppression impossible',
        message:
          error.code === '23503'
            ? 'Ce kiosque est référencé par des ventes, des clients ou des utilisateurs et ne peut pas être supprimé.'
            : handleSupabaseError(error),
      })
      return
    }

    showToast({ type: 'success', title: 'Kiosque supprimé', message: `${deleting.nom} a été supprimé.` })
    setDeleting(null)
    await load()
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
            aria-label={`Modifier ${row.nom}`}
            onClick={(event) => {
              event.stopPropagation()
              openEdit(row)
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            aria-label={`Supprimer ${row.nom}`}
            onClick={(event) => {
              event.stopPropagation()
              setDeleting(row)
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-text">Kiosques</h1>
          <p className="text-[12px] text-text-secondary">Gestion des points de vente du reseau.</p>
        </div>
        <Button type="button" variant="primary" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouveau kiosque
        </Button>
      </div>

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
            <>
              <div className="mb-3 sm:w-80">
                <SearchBar
                  value={kiosqueSearch}
                  onChange={setKiosqueSearch}
                  placeholder="Rechercher un kiosque"
                  resultCount={filteredRows.length}
                />
              </div>
              {filteredRows.length === 0 ? (
                <EmptyState
                  title="Aucun resultat"
                  description="Essayez un autre nom de kiosque."
                />
              ) : (
                <DataTable columns={columns} data={filteredRows} getRowKey={(row) => row.id} />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Modifier le kiosque' : 'Nouveau kiosque'}</DialogTitle>
            <DialogDescription>
              {form.id ? 'Mettez à jour les informations du kiosque.' : 'Créez un point de vente du réseau.'}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <PosLabel htmlFor="kiosque-nom">Nom *</PosLabel>
              <PosInput
                id="kiosque-nom"
                value={form.nom}
                onChange={(event) => setForm((current) => ({ ...current, nom: event.target.value }))}
                placeholder="Nom du kiosque"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <PosLabel htmlFor="kiosque-adresse">Adresse</PosLabel>
              <PosInput
                id="kiosque-adresse"
                value={form.adresse}
                onChange={(event) => setForm((current) => ({ ...current, adresse: event.target.value }))}
                placeholder="Adresse"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="pos-secondary" onClick={() => setIsFormOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="pos-primary" loading={isSaving} disabled={!form.nom.trim()}>
                <Save className="h-4 w-4" />
                {form.id ? 'Mettre a jour' : 'Creer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Supprimer ce kiosque ?"
        description={`${deleting?.nom ?? ''} — cette action est irréversible. Un kiosque référencé par des ventes ou des clients ne peut pas être supprimé.`}
        isBusy={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
