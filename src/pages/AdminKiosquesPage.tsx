import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Edit, Plus, Save, Trash2, Upload } from 'lucide-react'
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
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { SearchBar } from '@/components/SearchBar'
import { KiosqueImportDialog } from '@/components/admin/KiosqueImportDialog'
import { PosInput, PosLabel } from '@/components/pos'
import { useToast } from '@/components/Toast'
import { handleSupabaseError, supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { logError } from '@/lib/telemetry'
import { normalizeTypeCode, typeBadgeClass, type KiosqueType } from '@/lib/kiosqueTypes'

interface KiosqueRow {
  id: string
  nom: string
  adresse: string | null
  type_code: string | null
}

type TypeFilter = 'all' | 'none' | string // 'all' | 'none' | code

export default function AdminKiosquesPage() {
  const { showToast } = useToast()
  const [rows, setRows] = useState<KiosqueRow[]>([])
  const [types, setTypes] = useState<KiosqueType[]>([])
  const [form, setForm] = useState({ id: '', nom: '', adresse: '', type_code: '' })
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deleting, setDeleting] = useState<KiosqueRow | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [kiosqueSearchInput, setKiosqueSearchInput] = useState('')
  const kiosqueSearch = useDebouncedValue(kiosqueSearchInput, 300)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  // Inline type creation (dernière option du select)
  const [showNewType, setShowNewType] = useState(false)
  const [newTypeCode, setNewTypeCode] = useState('')
  const [newTypeLabel, setNewTypeLabel] = useState('')
  const [isCreatingType, setIsCreatingType] = useState(false)

  const filteredRows = useMemo(() => {
    const needle = kiosqueSearch.trim().toLowerCase()
    return rows.filter((row) => {
      if (needle && !row.nom.toLowerCase().includes(needle)) return false
      if (typeFilter === 'none' && row.type_code !== null) return false
      if (typeFilter !== 'all' && typeFilter !== 'none' && row.type_code !== typeFilter) return false
      return true
    })
  }, [kiosqueSearch, rows, typeFilter])

  /** Compteurs par type pour les chips (inclut 'all' et 'none'). */
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      const key = row.type_code ?? 'none'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [rows])

  const load = useCallback(async () => {
    setIsLoading(true)
    const [kiosquesResult, typesResult] = await Promise.all([
      supabase.from('kiosques').select('id, nom, adresse, type_code').order('nom'),
      supabase.from('kiosque_types').select('code, label').order('code'),
    ])
    if (kiosquesResult.error) {
      logError('kiosques', 'chargement des kiosques échoué', {
        code: kiosquesResult.error.code,
        message: kiosquesResult.error.message,
      })
      console.error('Error loading kiosques:', kiosquesResult.error)
    }
    if (typesResult.error) {
      logError('kiosque_types', 'chargement des types échoué', {
        code: typesResult.error.code,
        message: typesResult.error.message,
      })
    }
    setRows((kiosquesResult.data ?? []) as KiosqueRow[])
    setTypes((typesResult.data ?? []) as KiosqueType[])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setForm({ id: '', nom: '', adresse: '', type_code: '' })
    setShowNewType(false)
    setNewTypeCode('')
    setNewTypeLabel('')
    setIsFormOpen(true)
  }

  const openEdit = (row: KiosqueRow) => {
    setForm({ id: row.id, nom: row.nom, adresse: row.adresse ?? '', type_code: row.type_code ?? '' })
    setShowNewType(false)
    setNewTypeCode('')
    setNewTypeLabel('')
    setIsFormOpen(true)
  }

  /** Création inline d'un type depuis le select. Code dupliqué → toast, pas d'insert. */
  const createType = async (): Promise<string | null> => {
    const code = normalizeTypeCode(newTypeCode)
    const label = newTypeLabel.trim()
    if (!code || !label) {
      showToast({
        type: 'error',
        title: 'Type incomplet',
        message: 'Renseignez le code et le libellé du nouveau type.',
      })
      return null
    }

    setIsCreatingType(true)
    const { error } = await supabase.from('kiosque_types').insert({ code, label })
    setIsCreatingType(false)

    if (error) {
      const duplicate = error.code === '23505'
      showToast({
        type: 'error',
        title: 'Type non créé',
        message: duplicate
          ? `Ce code existe déjà : ${code}. Choisissez-le dans la liste.`
          : handleSupabaseError(error),
      })
      return null
    }

    setTypes((current) => [...current, { code, label }].sort((a, b) => a.code.localeCompare(b.code)))
    showToast({
      type: 'success',
      title: 'Type créé',
      message: `${label} (${code}) est disponible dans la liste.`,
    })
    return code
  }

  const save = async () => {
    if (!form.nom.trim()) return
    // Création : type OBLIGATOIRE (édition : optionnel).
    if (!form.id && !form.type_code) {
      showToast({
        type: 'warning',
        title: 'Type requis',
        message: 'Choisissez un type de kiosque (ou créez-en un via « + Ajouter un autre type »).',
      })
      return
    }

    setIsSaving(true)

    const payload = {
      nom: form.nom.trim(),
      adresse: form.adresse.trim() || null,
      type_code: form.type_code || null,
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
      await logAudit(form.id ? 'kiosque.update' : 'kiosque.create', 'kiosques', form.id || null, {
        nom: payload.nom,
        type_code: payload.type_code,
      })
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

  const typeLabel = (code: string | null): string =>
    types.find((type) => type.code === code)?.label ?? code ?? ''

  const columns: DataTableColumn<KiosqueRow>[] = [
    {
      key: 'nom',
      header: 'Kiosque',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.nom}</span>
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${typeBadgeClass(row.type_code)}`}
          >
            {row.type_code ?? 'Sans type'}
          </span>
        </div>
      ),
      sortValue: (row) => row.nom,
    },
    { key: 'adresse', header: 'Adresse', render: (row) => row.adresse || 'Non renseignée', sortValue: (row) => row.adresse ?? '' },
    {
      key: 'type',
      header: 'Type',
      render: (row) => typeLabel(row.type_code) || 'Non défini',
      sortValue: (row) => row.type_code ?? '',
    },
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

  const chips: Array<{ value: TypeFilter; label: string; count: number }> = [
    { value: 'all', label: 'Tous', count: rows.length },
    ...types.map((type) => ({
      value: type.code,
      label: type.code,
      count: typeCounts.get(type.code) ?? 0,
    })),
    { value: 'none', label: 'Sans type', count: typeCounts.get('none') ?? 0 },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold text-text">Kiosques</h1>
          <p className="text-xs text-text-secondary">Gestion des points de vente du réseau.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            to="/admin/tarifs"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border-2 border-[#DCE1E5] bg-white px-4 text-sm font-semibold text-[#12364D] transition-colors hover:border-[#12364D]"
          >
            Tarifs
          </Link>
          <Button
            type="button"
            variant="pos-secondary"
            onClick={() => setIsImportOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Importer
          </Button>
          <Button type="button" variant="primary" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouveau kiosque
          </Button>
        </div>
      </div>

      <KiosqueImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        baseNames={rows.map((row) => row.nom)}
        types={types}
        onImported={load}
      />

      {/* ── Chips de filtre par type avec compteurs ── */}
      {!isLoading && rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setTypeFilter(chip.value)}
              aria-pressed={typeFilter === chip.value}
              className={
                typeFilter === chip.value
                  ? 'min-h-11 rounded-md bg-primary px-3 text-xs font-semibold text-white'
                  : 'min-h-11 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-text-secondary hover:border-primary hover:text-primary'
              }
            >
              {chip.label}
              <span className="ml-1.5 text-xs opacity-70 [font-variant-numeric:tabular-nums]">
                {chip.count}
              </span>
            </button>
          ))}
        </div>
      )}

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
            <EmptyState
              title="Aucun kiosque"
              description="Importez des kiosques via CSV ou ajoutez-les manuellement."
              action={
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" variant="primary" onClick={openCreate}>
                    Ajouter manuellement
                  </Button>
                  <Button type="button" variant="pos-secondary" onClick={() => setIsImportOpen(true)}>
                    Importer via CSV
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              <div className="mb-3 sm:w-80">
                <SearchBar
                  value={kiosqueSearch}
                  onChange={setKiosqueSearchInput}
                  placeholder="Rechercher un kiosque"
                  resultCount={filteredRows.length}
                />
              </div>
              {filteredRows.length === 0 ? (
                <EmptyState
                  title="Aucun résultat"
                  description="Essayez un autre nom ou changez de filtre de type."
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
            <div className="space-y-1.5">
              <PosLabel htmlFor="kiosque-type">
                Type {!form.id && '*'}
              </PosLabel>
              <select
                id="kiosque-type"
                value={showNewType ? '__new__' : form.type_code}
                onChange={async (event) => {
                  const value = event.target.value
                  if (value === '__new__') {
                    setShowNewType(true)
                    return
                  }
                  setShowNewType(false)
                  setForm((current) => ({ ...current, type_code: value }))
                }}
                className="h-12 w-full rounded-md border-2 border-[#DCE1E5] bg-white px-3 text-base text-[#12364D] focus:border-[#12364D] focus:outline-none sm:h-11 sm:text-sm"
              >
                <option value="">— Sélectionner un type —</option>
                {types.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.code} — {type.label}
                  </option>
                ))}
                <option value="__new__">+ Ajouter un autre type…</option>
              </select>
              {/* Édition d'un kiosque sans type : hint */}
              {form.id && !form.type_code && !showNewType && (
                <p className="text-xs text-amber">Pensez à définir le type de ce kiosque</p>
              )}
            </div>
            {showNewType && (
              <div className="space-y-2 rounded-md border border-[#DCE1E5] bg-[#F6F9FB] p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <PosLabel htmlFor="new-type-code">Code *</PosLabel>
                    <PosInput
                      id="new-type-code"
                      value={newTypeCode}
                      onChange={(event) => setNewTypeCode(normalizeTypeCode(event.target.value))}
                      placeholder="Ex : KEM"
                      maxLength={8}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <PosLabel htmlFor="new-type-label">Libellé *</PosLabel>
                    <PosInput
                      id="new-type-label"
                      value={newTypeLabel}
                      onChange={(event) => setNewTypeLabel(event.target.value)}
                      placeholder="Ex : Kiosque éphémère"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="pos-secondary"
                  size="sm"
                  className="w-full"
                  loading={isCreatingType} loadingText="Création du type…"
                  onClick={async () => {
                    const code = await createType()
                    if (code) {
                      setForm((current) => ({ ...current, type_code: code }))
                      setShowNewType(false)
                      setNewTypeCode('')
                      setNewTypeLabel('')
                    }
                  }}
                >
                  Créer le type
                </Button>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="pos-secondary" onClick={() => setIsFormOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                variant="pos-primary"
                loading={isSaving} loadingText="Enregistrement…"
                disabled={!form.nom.trim() || (!form.id && !form.type_code) || isCreatingType}
              >
                <Save className="h-4 w-4" />
                {form.id ? 'Mettre à jour' : 'Créer'}
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
