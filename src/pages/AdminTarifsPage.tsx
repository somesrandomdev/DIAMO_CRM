import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PosInput, PosLabel, PosSelect } from '@/components/pos'
import { KiosqueSearchSelect } from '@/components/KiosqueSearchSelect'
import { useToast } from '@/components/Toast'
import { handleSupabaseError, supabase } from '@/lib/supabase'
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
  const { showToast } = useToast()
  const [kiosques, setKiosques] = useState<KiosqueRow[]>([])
  const [offres, setOffres] = useState<OffreRow[]>([])
  const [tarifs, setTarifs] = useState<TarifRow[]>([])
  const [form, setForm] = useState({ id: '', kiosque_id: '', offre_id: '', prix: '', est_actif: true })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deleting, setDeleting] = useState<TarifRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)

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

  /** Kiosques with zero ACTIVE tarif: they cannot record any sale. */
  const kiosquesSansTarifActif = useMemo(() => {
    return kiosques.filter(
      (kiosque) => !tarifs.some((tarif) => tarif.kiosque_id === kiosque.id && tarif.est_actif)
    )
  }, [kiosques, tarifs])

  const resetForm = () => setForm({ id: '', kiosque_id: '', offre_id: '', prix: '', est_actif: true })

  const openCreate = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const openEdit = (tarif: TarifRow) => {
    setForm({
      id: tarif.id,
      kiosque_id: tarif.kiosque_id,
      offre_id: tarif.offre_id,
      prix: tarif.prix.toString(),
      est_actif: tarif.est_actif,
    })
    setIsFormOpen(true)
  }

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

    if (result.error) {
      console.error('Error saving tarif:', result.error)
      showToast({
        type: 'error',
        title: 'Enregistrement impossible',
        message: handleSupabaseError(result.error),
      })
    } else {
      const label = `${names.kiosques.get(form.kiosque_id) ?? 'Kiosque'} - ${names.offres.get(form.offre_id) ?? 'Offre'}`
      showToast({
        type: 'success',
        title: form.id ? 'Tarif mis à jour' : 'Tarif créé',
        message: `${label} : ${toCFA(prix)}.`,
      })
    }

    setIsFormOpen(false)
    await load()
    resetForm()
    setIsSaving(false)
  }

  const confirmDelete = async () => {
    if (!deleting) return

    setIsDeleting(true)
    const { error } = await supabase.from('offres_kiosque').delete().eq('id', deleting.id)
    setIsDeleting(false)

    if (error) {
      console.error('Error deleting tarif:', error)
      showToast({
        type: 'error',
        title: 'Suppression impossible',
        message: handleSupabaseError(error),
      })
      return
    }

    showToast({ type: 'success', title: 'Tarif supprimé', message: 'Le tarif a été supprimé.' })
    setDeleting(null)
    await load()
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
              openEdit(row)
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
          <h1 className="text-[15px] font-semibold text-text">Tarifs</h1>
          <p className="text-[12px] text-text-secondary">Prix actifs par kiosque et par offre.</p>
        </div>
        <Button type="button" variant="primary" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouveau tarif
        </Button>
      </div>

      {/* Guard-rail: kiosques with no ACTIVE tarif cannot sell — make them
          impossible to miss while the per-kiosque pricing is being configured. */}
      {!isLoading && kiosquesSansTarifActif.length > 0 && (
        <div className="rounded-lg border-2 border-[#EB4D5E] bg-[#FDF1F2] p-3">
          <p className="text-[13px] font-semibold text-[#EB4D5E]">
            ⚠ {kiosquesSansTarifActif.length} kiosque{kiosquesSansTarifActif.length > 1 ? 's' : ''} sans
            tarif actif — vente impossible
          </p>
          <p className="mt-1 text-[12px] text-[#1C5376]">
            {kiosquesSansTarifActif.map((kiosque) => kiosque.nom).join(' · ')} — définissez leurs
            prix ci-dessous pour activer la vente.
          </p>
        </div>
      )}

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
            <>
              <div className="hidden sm:block">
                <DataTable columns={columns} data={tarifs} getRowKey={(row) => row.id} />
              </div>

              {/* Mobile: one card per kiosk with its price list */}
              <div className="space-y-3 sm:hidden">
                {kiosques
                  .filter((kiosque) => tarifs.some((tarif) => tarif.kiosque_id === kiosque.id))
                  .map((kiosque) => (
                    <div key={kiosque.id} className="rounded-md border border-border bg-surface p-3">
                      <p className="text-[14px] font-semibold text-text">{kiosque.nom}</p>
                      <div className="mt-2 space-y-2">
                        {tarifs
                          .filter((tarif) => tarif.kiosque_id === kiosque.id)
                          .map((tarif) => (
                            <div
                              key={tarif.id}
                              className="flex items-center justify-between gap-2 rounded-md bg-muted p-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-medium text-text">
                                  {names.offres.get(tarif.offre_id) ?? 'Inconnue'}
                                </p>
                                <p className="mt-0.5 flex items-center gap-2">
                                  <span className="font-mono text-[13px] font-semibold text-blue [font-variant-numeric:tabular-nums]">
                                    {toCFA(tarif.prix)}
                                  </span>
                                  <StatusBadge variant={tarif.est_actif ? 'success' : 'neutral'}>
                                    {tarif.est_actif ? 'Actif' : 'Inactif'}
                                  </StatusBadge>
                                </p>
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <Button
                                  type="button"
                                  variant="default"
                                  size="icon"
                                  className="h-12 w-12 min-h-12"
                                  aria-label={`Modifier le tarif ${names.offres.get(tarif.offre_id) ?? ''} de ${kiosque.nom}`}
                                  onClick={() => openEdit(tarif)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  className="h-12 w-12 min-h-12"
                                  aria-label={`Supprimer le tarif ${names.offres.get(tarif.offre_id) ?? ''} de ${kiosque.nom}`}
                                  onClick={() => setDeleting(tarif)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Modifier le tarif' : 'Nouveau tarif'}</DialogTitle>
            <DialogDescription>
              Prix d'une offre pour un kiosque donné.
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
              <PosLabel htmlFor="tarif-kiosque">Kiosque *</PosLabel>
              <KiosqueSearchSelect
                id="tarif-kiosque"
                kiosques={kiosques}
                value={form.kiosque_id}
                onChange={(value) => setForm((current) => ({ ...current, kiosque_id: value }))}
                emptyLabel="Choisir un kiosque..."
                required
              />
            </div>
            <div className="space-y-1.5">
              <PosLabel htmlFor="tarif-offre">Offre *</PosLabel>
              <PosSelect
                id="tarif-offre"
                value={form.offre_id}
                onChange={(event) => setForm((current) => ({ ...current, offre_id: event.target.value }))}
              >
                <option value="">Choisir une offre...</option>
                {offres.map((offre) => (
                  <option key={offre.id} value={offre.id}>{offre.nom}</option>
                ))}
              </PosSelect>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <PosLabel htmlFor="tarif-prix">Prix (CFA) *</PosLabel>
                <PosInput
                  id="tarif-prix"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.prix}
                  onChange={(event) => setForm((current) => ({ ...current, prix: event.target.value }))}
                  placeholder="Ex : 500"
                />
              </div>
              <div className="space-y-1.5">
                <PosLabel htmlFor="tarif-actif">Statut</PosLabel>
                <PosSelect
                  id="tarif-actif"
                  value={String(form.est_actif)}
                  onChange={(event) => setForm((current) => ({ ...current, est_actif: event.target.value === 'true' }))}
                >
                  <option value="true">Actif</option>
                  <option value="false">Inactif</option>
                </PosSelect>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="pos-secondary" onClick={() => setIsFormOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                variant="pos-primary"
                loading={isSaving}
                disabled={!form.kiosque_id || !form.offre_id || !form.prix}
              >
                <Save className="h-4 w-4" />
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Supprimer ce tarif ?"
        description={`${names.kiosques.get(deleting?.kiosque_id ?? '') ?? ''} - ${
          names.offres.get(deleting?.offre_id ?? '') ?? ''
        } n'aura plus de prix défini. Cette action est irréversible.`}
        isBusy={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
