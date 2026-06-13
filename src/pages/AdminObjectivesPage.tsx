import { useCallback, useEffect, useMemo, useState } from 'react'
import { Save, Target, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { FormInput, FormSelect } from '@/components/ui/form-input'
import { KPICard } from '@/components/ui/kpi-card'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
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

function monthValue(): string {
  const date = new Date()
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date.toISOString().slice(0, 10)
}

function daysInMonth(): number {
  const date = new Date()
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

export default function AdminObjectivesPage() {
  const { profile } = useAuthStore()
  const [kiosques, setKiosques] = useState<KiosqueRow[]>([])
  const [objectives, setObjectives] = useState<Record<string, ObjectiveRow>>({})
  const [form, setForm] = useState({ kiosqueId: '', caCible: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

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
    } else if (data) {
      setObjectives((current) => ({ ...current, [data.kiosque_id]: data as ObjectiveRow }))
      setForm({ kiosqueId: '', caCible: '' })
    }
    setIsSaving(false)
  }

  const deleteObjective = async (kiosqueId: string) => {
    const objective = objectives[kiosqueId]
    if (!objective) return

    setIsSaving(true)
    const { error } = await supabase.from('objectifs').delete().eq('id', objective.id)
    if (error) {
      console.error('Error deleting objective:', error)
    } else {
      setObjectives((current) => {
        const next = { ...current }
        delete next[kiosqueId]
        return next
      })
    }
    setIsSaving(false)
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
            aria-label="Supprimer"
            onClick={(event) => {
              event.stopPropagation()
              deleteObjective(kiosque.id)
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
            <DataTable columns={objectiveColumns} data={kiosques} getRowKey={(row) => row.id} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
