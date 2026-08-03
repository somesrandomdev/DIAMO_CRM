import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { FormInput, FormSelect } from '@/components/ui/form-input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
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

  const resetForm = () => setForm({ id: '', username: '', role: 'fontainier', kiosque_id: '' })

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

    // A non-admin role without a kiosk leaves the user unable to record sales,
    // so this is caught here rather than surfacing later as a confusing
    // "aucun kiosque" bounce on the sale page.
    if (form.role !== 'administrateur' && !form.kiosque_id) {
      showToast({
        type: 'warning',
        title: 'Kiosque requis',
        message: 'Choisissez un kiosque pour ce rôle, ou passez le rôle en Administrateur.',
      })
      return
    }

    setIsSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        username: trimmedUsername,
        role: form.role,
        kiosque_id: form.role === 'administrateur' ? null : form.kiosque_id || null,
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
      <div>
        <h1 className="text-[15px] font-semibold text-text">Utilisateurs</h1>
        <p className="text-[12px] text-text-secondary">Affectation des roles et kiosques. La creation des comptes Auth reste cote Supabase.</p>
      </div>

      {form.id && (
        <Card>
          <CardHeader>
            <CardTitle>Modifier un utilisateur</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 lg:grid-cols-[1fr_180px_1fr_auto]">
              <FormInput value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} placeholder="Nom utilisateur" />
              <FormSelect value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}>
                <option value="fontainier">Fontainier</option>
                <option value="commercial">Commercial</option>
                <option value="administrateur">Administrateur</option>
              </FormSelect>
              <FormSelect
                value={form.kiosque_id}
                disabled={form.role === 'administrateur'}
                onChange={(event) => setForm((current) => ({ ...current, kiosque_id: event.target.value }))}
              >
                <option value="">Aucun kiosque</option>
                {kiosques.map((kiosque) => (
                  <option key={kiosque.id} value={kiosque.id}>{kiosque.nom}</option>
                ))}
              </FormSelect>
              <Button type="button" variant="primary" onClick={save} loading={isSaving}>
                <Save className="h-4 w-4" />
                Enregistrer
              </Button>
            </div>
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
            <DataTable columns={columns} data={profiles} getRowKey={(row) => row.id} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
