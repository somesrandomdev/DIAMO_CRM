import { useCallback, useEffect, useMemo, useState } from 'react'
import { Save, Target, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Objectifs mensuels</h1>
        <p className="text-sm text-muted-foreground">
          Cibles de chiffre d'affaires par kiosque pour le mois courant.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-lg">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Objectif reseau</p>
            <p className="text-2xl font-semibold">{toCFA(monthlyTotal)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Kiosques cibles</p>
            <p className="text-2xl font-semibold">{Object.keys(objectives).length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Moyenne journaliere reseau</p>
            <p className="text-2xl font-semibold">{toCFA(Math.round(monthlyTotal / daysInMonth()))}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Definir une cible
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
            <select
              value={form.kiosqueId}
              onChange={(event) =>
                setForm({
                  kiosqueId: event.target.value,
                  caCible: objectives[event.target.value]?.ca_cible?.toString() ?? '',
                })
              }
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Selectionner un kiosque</option>
              {kiosques.map((kiosque) => (
                <option key={kiosque.id} value={kiosque.id}>{kiosque.nom}</option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={form.caCible}
              onChange={(event) => setForm((current) => ({ ...current, caCible: event.target.value }))}
              className="h-10 rounded-md border bg-background px-3 text-sm"
              placeholder="CA cible CFA"
            />
            <Button
              type="button"
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

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Objectifs actifs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-14 rounded-lg" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2">Kiosque</th>
                    <th className="px-3 py-2 text-right">Objectif mensuel</th>
                    <th className="px-3 py-2 text-right">Objectif journalier</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {kiosques.map((kiosque) => {
                    const objective = objectives[kiosque.id]
                    return (
                      <tr key={kiosque.id} className="border-b last:border-0">
                        <td className="px-3 py-3">
                          <p className="font-medium">{kiosque.nom}</p>
                          {kiosque.adresse && <p className="text-xs text-muted-foreground">{kiosque.adresse}</p>}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {objective ? toCFA(objective.ca_cible) : <span className="text-muted-foreground">Non defini</span>}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {objective ? toCFA(Math.round(objective.ca_cible / daysInMonth())) : <span className="text-muted-foreground">Non defini</span>}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {objective && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="Supprimer l'objectif"
                              onClick={() => deleteObjective(kiosque.id)}
                              disabled={isSaving}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
