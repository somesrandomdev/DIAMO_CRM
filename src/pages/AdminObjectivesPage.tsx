import { useCallback, useEffect, useMemo, useState } from 'react'
import { Save, Target, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { FormInput, FormSelect } from '@/components/ui/form-input'
import { KPICard } from '@/components/ui/kpi-card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { SearchBar } from '@/components/SearchBar'
import { monthKey } from '@/lib/commercialStats'
import { useToast } from '@/components/Toast'
import { handleSupabaseError, supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { toCFA } from '@/utils/price'

interface KiosqueRow {
  id: string
  nom: string
  adresse?: string | null
}

interface ObjectiveRow {
  id: string
  kiosque_id: string
  ca_cible: number
}

// Shared month-key helper (local-time 'YYYY-MM-01', the objectifs.mois format).
const monthValue = () => monthKey()

function daysInMonth(): number {
  const date = new Date()
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

export default function AdminObjectivesPage() {
  const { profile } = useAuthStore()
  const { showToast } = useToast()
  const [kiosques, setKiosques] = useState<KiosqueRow[]>([])
  const [objectives, setObjectives] = useState<Record<string, ObjectiveRow>>({})
  const [form, setForm] = useState({ kiosqueId: '', caCible: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingKiosqueId, setDeletingKiosqueId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [objectiveSearch, setObjectiveSearch] = useState('')

  const filteredKiosques = useMemo(() => {
    const needle = objectiveSearch.trim().toLowerCase()
    if (!needle) return kiosques
    return kiosques.filter((kiosque) => kiosque.nom.toLowerCase().includes(needle))
  }, [kiosques, objectiveSearch])

  const load = useCallback(async () => {
    setIsLoading(true)
    const [kiosquesResult, objectivesResult] = await Promise.all([
      supabase.from('kiosques').select('id, nom, adresse').order('nom'),
      supabase.from('objectifs').select('id, kiosque_id, ca_cible').eq('mois', monthValue()),
    ])

    if (kiosquesResult.error) console.error('Error loading kiosques:', kiosquesResult.error)
    if (objectivesResult.error) console.error('Error loading objectives:', objectivesResult.error)

    setKiosques((kiosquesResult.data ?? []) as KiosqueRow[])
    const nextObjectives: Record<string, ObjectiveRow> = {}
    ;((objectivesResult.data ?? []) as ObjectiveRow[]).forEach((objective) => {
      nextObjectives[objective.kiosque_id] = objective
    })
    setObjectives(nextObjectives)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selectedObjective = form.kiosqueId ? objectives[form.kiosqueId] : undefined

  const monthlyTotal = useMemo(
    () => Object.values(objectives).reduce((sum, objective) => sum + objective.ca_cible, 0),
    [objectives]
  )

  const saveObjective = async () => {
    if (!form.kiosqueId || !form.caCible) return

    const caCible = Math.round(Number(form.caCible))
    if (!Number.isFinite(caCible) || caCible <= 0) return

    setIsSaving(true)
    const { data, error } = await supabase
      .from('objectifs')
      .upsert(
        {
          kiosque_id: form.kiosqueId,
          mois: monthValue(),
          ca_cible: caCible,
          created_by: profile?.id ?? null,
        },
        { onConflict: 'kiosque_id,mois' }
      )
      .select('id, kiosque_id, ca_cible')
      .single()

    if (error) {
      console.error('Error saving objective:', error)
      showToast({
        type: 'error',
        title: 'Enregistrement impossible',
        message: handleSupabaseError(error),
      })
    } else if (data) {
      const kiosqueNom = kiosques.find((kiosque) => kiosque.id === data.kiosque_id)?.nom ?? 'Kiosque'
      showToast({
        type: 'success',
        title: 'Objectif enregistré',
        message: `${kiosqueNom} : ${toCFA(data.ca_cible)} pour ce mois.`,
      })
      setObjectives((current) => ({ ...current, [data.kiosque_id]: data as ObjectiveRow }))
      setForm({ kiosqueId: '', caCible: '' })
    }
    setIsSaving(false)
  }

  const confirmDelete = async () => {
    if (!deletingKiosqueId) return
    const objective = objectives[deletingKiosqueId]
    if (!objective) return

    setIsDeleting(true)
    const { error } = await supabase.from('objectifs').delete().eq('id', objective.id)
    setIsDeleting(false)

    if (error) {
      console.error('Error deleting objective:', error)
      showToast({
        type: 'error',
        title: 'Suppression impossible',
        message: handleSupabaseError(error),
      })
      return
    }

    const kiosqueNom = kiosques.find((kiosque) => kiosque.id === deletingKiosqueId)?.nom ?? 'Kiosque'
    showToast({ type: 'success', title: 'Objectif supprimé', message: `L'objectif de ${kiosqueNom} a été supprimé.` })
    setObjectives((current) => {
      const next = { ...current }
      delete next[deletingKiosqueId]
      return next
    })
    setDeletingKiosqueId(null)
  }

  const objectiveColumns: DataTableColumn<KiosqueRow>[] = [
    {
      key: 'kiosque',
      header: 'Kiosque',
      render: (kiosque) => (
        <div>
          <p className="font-medium">{kiosque.nom}</p>
          {kiosque.adresse && <p className="text-[11px] text-text-secondary">{kiosque.adresse}</p>}
        </div>
      ),
      sortValue: (kiosque) => kiosque.nom,
    },
    {
      key: 'mensuel',
      header: 'Objectif mensuel',
      align: 'right',
      render: (kiosque) => {
        const objective = objectives[kiosque.id]
        return objective ? <span className="font-mono">{toCFA(objective.ca_cible)}</span> : <span className="text-text-tertiary">Non defini</span>
      },
      sortValue: (kiosque) => objectives[kiosque.id]?.ca_cible ?? 0,
    },
    {
      key: 'journalier',
      header: 'Objectif journalier',
      align: 'right',
      render: (kiosque) => {
        const objective = objectives[kiosque.id]
        return objective ? <span className="font-mono">{toCFA(Math.round(objective.ca_cible / daysInMonth()))}</span> : <span className="text-text-tertiary">Non defini</span>
      },
      sortValue: (kiosque) => objectives[kiosque.id]?.ca_cible ?? 0,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (kiosque) => {
        const objective = objectives[kiosque.id]
        if (!objective) return null

        return (
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            aria-label={`Supprimer l'objectif de ${kiosque.nom}`}
            onClick={(event) => {
              event.stopPropagation()
              setDeletingKiosqueId(kiosque.id)
            }}
            disabled={isSaving}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[15px] font-semibold text-text">Objectifs mensuels</h1>
        <p className="text-[12px] text-text-secondary">
          Cibles de chiffre d'affaires par kiosque pour le mois courant.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KPICard label="Objectif reseau" value={toCFA(monthlyTotal)} />
        <KPICard label="Kiosques cibles" value={Object.keys(objectives).length} />
        <KPICard label="Moyenne journaliere" value={toCFA(Math.round(monthlyTotal / daysInMonth()))} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Definir une cible
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <FormSelect
              value={form.kiosqueId}
              onChange={(event) =>
                setForm({
                  kiosqueId: event.target.value,
                  caCible: objectives[event.target.value]?.ca_cible?.toString() ?? '',
                })
              }
            >
              <option value="">Selectionner un kiosque</option>
              {kiosques.map((kiosque) => (
                <option key={kiosque.id} value={kiosque.id}>{kiosque.nom}</option>
              ))}
            </FormSelect>
            <FormInput
              type="number"
              min={0}
              value={form.caCible}
              onChange={(event) => setForm((current) => ({ ...current, caCible: event.target.value }))}
              placeholder="CA cible CFA"
            />
            <Button
              type="button"
              variant="primary"
              onClick={saveObjective}
              loading={isSaving}
              disabled={!form.kiosqueId || !form.caCible}
            >
              <Save className="h-4 w-4" />
              {selectedObjective ? 'Mettre a jour' : 'Sauvegarder'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Objectifs actifs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-14 rounded-lg" />)}
            </div>
          ) : kiosques.length === 0 ? (
            <EmptyState title="Aucun kiosque" />
          ) : (
            <>
              <div className="mb-3 sm:w-80">
                <SearchBar
                  value={objectiveSearch}
                  onChange={setObjectiveSearch}
                  placeholder="Rechercher un kiosque"
                  resultCount={filteredKiosques.length}
                />
              </div>
              {filteredKiosques.length === 0 ? (
                <EmptyState
                  title="Aucun resultat"
                  description="Essayez un autre nom de kiosque."
                />
              ) : (
                <DataTable columns={objectiveColumns} data={filteredKiosques} getRowKey={(row) => row.id} />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deletingKiosqueId !== null}
        onOpenChange={(open) => !open && setDeletingKiosqueId(null)}
        title="Supprimer cet objectif ?"
        description={`${
          kiosques.find((kiosque) => kiosque.id === deletingKiosqueId)?.nom ?? ''
        } n'aura plus de cible pour ce mois. Cette action est irréversible.`}
        isBusy={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
