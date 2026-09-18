import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit, Save, UserPlus } from 'lucide-react'
import { AddEmployeeDialog } from '@/components/admin/AddEmployeeDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { FormInput, FormSelect } from '@/components/ui/form-input'
import { Skeleton } from '@/components/ui/skeleton'
import { SearchBar } from '@/components/SearchBar'
import { StatusBadge } from '@/components/ui/status-badge'
import { PosChip, PosLabel } from '@/components/pos'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/stores/authStore'

interface KiosqueRow {
  id: string
  nom: string
}

interface ProfileRow {
  id: string
  username: string
  role: UserRole
  kiosque_id: string | null
}

const roleLabels: Record<UserRole, string> = {
  administrateur: 'Administrateur',
  commercial: 'Commercial',
  fontainier: 'Fontainier',
}

function roleVariant(role: UserRole) {
  if (role === 'administrateur') return 'info'
  if (role === 'commercial') return 'success'
  return 'warning'
}

export default function AdminUsersPage() {
  const { showToast } = useToast()
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [kiosques, setKiosques] = useState<KiosqueRow[]>([])
  const [form, setForm] = useState({ id: '', username: '', role: 'fontainier' as UserRole, kiosque_id: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [assignedKiosqueIds, setAssignedKiosqueIds] = useState<string[]>([])
  const [initialAssignedIds, setInitialAssignedIds] = useState<string[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')

  const filteredProfiles = useMemo(() => {
    const needle = userSearch.trim().toLowerCase()
    return profiles.filter((row) => {
      const matchesSearch = !needle || row.username.toLowerCase().includes(needle)
      const matchesRole = roleFilter === 'all' || row.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [profiles, roleFilter, userSearch])

  const load = useCallback(async () => {
    setIsLoading(true)
    const [profilesResult, kiosquesResult] = await Promise.all([
      supabase.from('profiles').select('id, username, role, kiosque_id').order('username'),
      supabase.from('kiosques').select('id, nom').order('nom'),
    ])

    if (profilesResult.error || kiosquesResult.error) {
      // Raw Postgres/RLS text is meaningless to an admin who isn't a developer,
      // so it stays in the console and the user gets a plain-French summary.
      console.error('Error loading users page:', profilesResult.error ?? kiosquesResult.error)
      showToast({
        type: 'error',
        title: 'Chargement impossible',
        message: 'La liste des utilisateurs n\'a pas pu être chargée. Veuillez réessayer.',
      })
    }

    setProfiles((profilesResult.data ?? []) as ProfileRow[])
    setKiosques((kiosquesResult.data ?? []) as KiosqueRow[])
    setIsLoading(false)
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  const kioskNameById = useMemo(() => {
    return new Map(kiosques.map((kiosque) => [kiosque.id, kiosque.nom]))
  }, [kiosques])

  const resetForm = () => {
    setForm({ id: '', username: '', role: 'fontainier', kiosque_id: '' })
    setAssignedKiosqueIds([])
    setInitialAssignedIds([])
  }

  // Whenever the edit form targets a commercial, load their current kiosk
  // assignments so the toggle chips start from the database state.
  useEffect(() => {
    if (!form.id || form.role !== 'commercial') return
    let cancelled = false
    supabase
      .from('commercials_kiosques')
      .select('kiosque_id')
      .eq('commercial_id', form.id)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          // Never swallow this: unreadable assignments mean the save diff
          // would run against an empty baseline and insert duplicates.
          console.error('Failed to load kiosk assignments:', {
            code: error.code,
            message: error.message,
            hint: error.hint,
          })
          showToast({
            type: 'error',
            title: 'Affectations illisibles',
            message:
              "Les kiosques actuels de ce commercial n'ont pas pu être chargés " +
              '(erreur ci-dessus dans la console). Réessayez.',
          })
          return
        }
        const ids = (data ?? []).map((row) => row.kiosque_id as string)
        setAssignedKiosqueIds(ids)
        setInitialAssignedIds(ids)
      })
    return () => {
      cancelled = true
    }
  }, [form.id, form.role, showToast])

  const save = async () => {
    if (!form.id) return

    const trimmedUsername = form.username.trim()
    if (!trimmedUsername) {
      showToast({
        type: 'warning',
        title: 'Nom manquant',
        message: "Veuillez saisir un nom d'utilisateur avant d'enregistrer.",
      })
      return
    }

    // Only fontainiers carry profiles.kiosque_id: a fontainier without a
    // kiosk cannot record sales, so this is caught here rather than
    // surfacing later as a confusing "aucun kiosque" bounce on the sale page.
    if (form.role === 'fontainier' && !form.kiosque_id) {
      showToast({
        type: 'warning',
        title: 'Kiosque requis',
        message: "Choisissez le kiosque de ce fontainier avant d'enregistrer.",
      })
      return
    }

    setIsSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        username: trimmedUsername,
        role: form.role,
        // profiles.kiosque_id is fontainier-only: commercials get their
        // kiosques exclusively from the commercials_kiosques junction table.
        kiosque_id: form.role === 'fontainier' ? form.kiosque_id : null,
      })
      .eq('id', form.id)

    if (error) {
      console.error('Error updating profile:', error)
      showToast({
        type: 'error',
        title: 'Modification impossible',
        message:
          'Impossible de mettre à jour cet utilisateur. Vérifiez que les informations sont correctes.',
      })
      setIsSaving(false)
      return
    }

    showToast({
      type: 'success',
      title: 'Utilisateur mis à jour',
      message: `Les informations de ${trimmedUsername} ont été enregistrées.`,
    })

    // Sync the supervised-kiosk assignments. Junction rows ARE supervisor
    // grants, so they are also stripped when the user stops being a commercial.
    const added =
      form.role === 'commercial'
        ? assignedKiosqueIds.filter((id) => !initialAssignedIds.includes(id))
        : []
    const removed =
      form.role === 'commercial'
        ? initialAssignedIds.filter((id) => !assignedKiosqueIds.includes(id))
        : initialAssignedIds

    if (added.length > 0 || removed.length > 0) {
      // Delete is awaited BEFORE the insert: running them concurrently can
      // race inside PostgREST, and a sequential failure is debuggable (you
      // know exactly which half died).
      let syncError: { code?: string; message: string; details?: unknown; hint?: string } | null =
        null

      if (removed.length > 0) {
        const { error } = await supabase
          .from('commercials_kiosques')
          .delete()
          .eq('commercial_id', form.id)
          .in('kiosque_id', removed)
        if (error) syncError = error
      }

      if (!syncError && added.length > 0) {
        // id and assigned_at are omitted on purpose: both are auto-generated
        // (gen_random_uuid / default) on the table.
        const { error } = await supabase
          .from('commercials_kiosques')
          .insert(
            added.map((kiosqueId) => ({ commercial_id: form.id, kiosque_id: kiosqueId }))
          )
        if (error) syncError = error
      }

      if (syncError) {
        console.error('Kiosk assignment sync failed:', {
          code: syncError.code,
          message: syncError.message,
          details: syncError.details,
          hint: syncError.hint,
          added,
          removed,
        })
        showToast({
          type: 'error',
          title: 'Affectation impossible',
          message:
            syncError.code === '23505'
              ? 'Ce commercial supervise déjà un de ces kiosques (doublon).'
              : syncError.code === '42501'
                ? "Permission refusée : la politique RLS sur commercials_kiosques bloque l'écriture admin."
                : "Les kiosques supervisés n'ont pas pu être enregistrés. Veuillez réessayer.",
        })
        // Keep the edit form and its chip selections open so the admin can
        // retry once the cause is fixed; the diff still recomputes from the
        // pre-save baseline.
        await load()
        setIsSaving(false)
        return
      }

      showToast({ type: 'success', title: 'Kiosques assignés', message: 'Kiosques assignés avec succès' })
      setInitialAssignedIds(form.role === 'commercial' ? assignedKiosqueIds : [])
    }

    await load()
    resetForm()
    setIsSaving(false)
  }

  const columns: DataTableColumn<ProfileRow>[] = [
    { key: 'username', header: 'Utilisateur', render: (row) => <span className="font-medium">{row.username}</span>, sortValue: (row) => row.username },
    { key: 'role', header: 'Role', render: (row) => <StatusBadge variant={roleVariant(row.role)}>{roleLabels[row.role]}</StatusBadge>, sortValue: (row) => row.role },
    { key: 'kiosque', header: 'Kiosque', render: (row) => (row.kiosque_id ? kioskNameById.get(row.kiosque_id) ?? 'Inconnu' : 'Global'), sortValue: (row) => row.kiosque_id ? kioskNameById.get(row.kiosque_id) ?? '' : 'Global' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <Button
          type="button"
          variant="default"
          size="icon-sm"
          aria-label="Modifier"
          onClick={(event) => {
            event.stopPropagation()
            setForm({
              id: row.id,
              username: row.username,
              role: row.role,
              kiosque_id: row.kiosque_id ?? '',
            })
          }}
        >
          <Edit className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-text">Utilisateurs</h1>
          <p className="text-[12px] text-text-secondary">
            Créez les accès des employés et gérez leurs rôles et kiosques.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full sm:w-auto"
          onClick={() => setIsAddOpen(true)}
        >
          <UserPlus className="h-5 w-5" />
          Ajouter un employé
        </Button>
      </div>

      <AddEmployeeDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        kiosques={kiosques}
        onCreated={(message) => {
          showToast({ type: 'success', title: 'Employé ajouté', message })
          load()
        }}
      />

      {form.id && (
        <Card>
          <CardHeader>
            <CardTitle>Modifier un utilisateur</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 lg:grid-cols-[1fr_180px_auto]">
              <FormInput value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} placeholder="Nom utilisateur" />
              <FormSelect value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}>
                <option value="fontainier">Fontainier</option>
                <option value="commercial">Commercial</option>
                <option value="administrateur">Administrateur</option>
              </FormSelect>
              <Button type="button" variant="primary" onClick={save} loading={isSaving}>
                <Save className="h-4 w-4" />
                Enregistrer
              </Button>
            </div>
            {form.role === 'fontainier' && (
              <div className="mt-3 max-w-md space-y-1.5">
                <label
                  htmlFor="edit-kiosque"
                  className="text-xs font-semibold uppercase tracking-wider text-[#1C5376]"
                >
                  Kiosque assigné *
                </label>
                <FormSelect
                  id="edit-kiosque"
                  value={form.kiosque_id}
                  onChange={(event) => setForm((current) => ({ ...current, kiosque_id: event.target.value }))}
                >
                  <option value="">Choisir un kiosque...</option>
                  {kiosques.map((kiosque) => (
                    <option key={kiosque.id} value={kiosque.id}>{kiosque.nom}</option>
                  ))}
                </FormSelect>
              </div>
            )}
            {form.role === 'commercial' && (
              <div className="mt-4 space-y-2">
                <PosLabel>Kiosques supervisés</PosLabel>
                <div className="flex flex-wrap gap-2">
                  {kiosques.map((kiosque) => (
                    <PosChip
                      key={kiosque.id}
                      active={assignedKiosqueIds.includes(kiosque.id)}
                      onClick={() =>
                        setAssignedKiosqueIds((current) =>
                          current.includes(kiosque.id)
                            ? current.filter((id) => id !== kiosque.id)
                            : [...current, kiosque.id]
                        )
                      }
                    >
                      {kiosque.nom}
                    </PosChip>
                  ))}
                </div>
                <p className="text-xs text-[#1C5376]">
                  Un commercial n'a pas de kiosque attitré : il supervise uniquement les kiosques
                  sélectionnés ci-dessus (lecture et correction des ventes, clients et objectifs).
                  Enregistrer pour appliquer.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Liste des utilisateurs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-12" />)}
            </div>
          ) : profiles.length === 0 ? (
            <EmptyState title="Aucun utilisateur" />
          ) : (
            <>
              <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_220px]">
                <SearchBar
                  value={userSearch}
                  onChange={setUserSearch}
                  placeholder="Rechercher un utilisateur"
                  resultCount={filteredProfiles.length}
                />
                <div className="flex flex-wrap gap-2">
                  {(['all', 'fontainier', 'commercial', 'administrateur'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRoleFilter(role)}
                      aria-pressed={roleFilter === role}
                      className={
                        roleFilter === role
                          ? 'min-h-11 rounded-md bg-primary px-3 text-[12px] font-semibold text-white'
                          : 'min-h-11 rounded-md border border-border bg-surface px-3 text-[12px] font-semibold text-text-secondary hover:border-primary hover:text-primary'
                      }
                    >
                      {role === 'all' ? 'Tous' : roleLabels[role]}
                    </button>
                  ))}
                </div>
              </div>

              {filteredProfiles.length === 0 ? (
                <EmptyState
                  title="Aucun resultat"
                  description="Essayez un autre nom ou changez de filtre de role."
                />
              ) : (
              <div className="hidden sm:block">
                <DataTable columns={columns} data={filteredProfiles} getRowKey={(row) => row.id} />
              </div>
              )}

              {/* Mobile: user cards */}
              <div className="space-y-3 sm:hidden">
                {filteredProfiles.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-border bg-surface p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-text">{row.username}</p>
                      <div className="mt-1">
                        <StatusBadge variant={roleVariant(row.role)}>{roleLabels[row.role]}</StatusBadge>
                      </div>
                      <p className="mt-1.5 text-[12px] text-text-secondary">
                        {row.kiosque_id ? kioskNameById.get(row.kiosque_id) ?? 'Inconnu' : 'Global'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="default"
                      size="icon"
                      className="h-12 w-12 min-h-12"
                      aria-label={`Modifier ${row.username}`}
                      onClick={() =>
                        setForm({
                          id: row.id,
                          username: row.username,
                          role: row.role,
                          kiosque_id: row.kiosque_id ?? '',
                        })
                      }
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
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
