import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { FormInput, FormSelect } from '@/components/ui/form-input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
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

    if (profilesResult.error) console.error('Error loading profiles:', profilesResult.error)
    if (kiosquesResult.error) console.error('Error loading kiosques:', kiosquesResult.error)

    setProfiles((profilesResult.data ?? []) as ProfileRow[])
    setKiosques((kiosquesResult.data ?? []) as KiosqueRow[])
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const kioskNameById = useMemo(() => {
    return new Map(kiosques.map((kiosque) => [kiosque.id, kiosque.nom]))
  }, [kiosques])

  const resetForm = () => setForm({ id: '', username: '', role: 'fontainier', kiosque_id: '' })

  const save = async () => {
    if (!form.id) return
    setIsSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        username: form.username.trim(),
        role: form.role,
        kiosque_id: form.role === 'administrateur' ? null : form.kiosque_id || null,
      })
      .eq('id', form.id)

    if (error) console.error('Error updating profile:', error)
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
            aria-label="Modifier l'utilisateur"
            title="Modifier l'utilisateur"
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
