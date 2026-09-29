import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Plus, Save, Search, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { PosInput, PosLabel } from '@/components/pos'
import { useToast } from '@/components/Toast'
import { handleSupabaseError, supabase } from '@/lib/supabase'
import {
  cellKey,
  chunkBatch,
  formatPrixCell,
  isSuspectPrice,
} from '@/lib/tarifsMatrix'

interface OffreRow {
  id: string
  nom: string
  volume_ml: number | null
}

interface KiosqueRow {
  id: string
  nom: string
}

interface TarifRow {
  kiosque_id: string
  offre_id: string
  prix: number
  est_actif: boolean
}

interface PendingUpsert {
  kiosque_id: string
  offre_id: string
  prix: number
}

interface UndoEntry {
  cell: string
  kiosque_id: string
  offre_id: string
  prev: number | null
}

export default function AdminTarifsPage() {
  const { showToast } = useToast()

  const [offres, setOffres] = useState<OffreRow[]>([])
  const [kiosques, setKiosques] = useState<KiosqueRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFlushing, setIsFlushing] = useState(false)

  // Valeurs affichées (optimistes) : clé cellule -> prix
  const prixByCellRef = useRef(new Map<string, number>())
  // Modifications en attente de sauvegarde
  const pendingUpsertsRef = useRef(new Map<string, PendingUpsert>())
  const pendingDeletesRef = useRef(new Map<string, { kiosque_id: string; offre_id: string }>())
  // Valeur d'ORIGINE de chaque cellule devenue pending (pour Annuler)
  const preBatchRef = useRef(new Map<string, { kiosque_id: string; offre_id: string; prev: number | null }>())
  const [pendingCount, setPendingCount] = useState(0)
  const undoStackRef = useRef<UndoEntry[]>([])
  const lastBatchRef = useRef<UndoEntry[] | null>(null)
  const flushTimerRef = useRef<number | null>(null)
  // Force re-render quand les refs mutent
  const [, forceRender] = useState(0)

  // Édition inline
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')

  // Sélection multiple + copier/coller
  const [multiSelect, setMultiSelect] = useState(false)
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set())
  const [copyBuffer, setCopyBuffer] = useState<number | null>(null)

  // Filtres
  const [offreSearch, setOffreSearch] = useState('')
  const [kiosqueSearch, setKiosqueSearch] = useState('')
  const [onlyKiosquesSansOffre, setOnlyKiosquesSansOffre] = useState(false)
  const [highlightKiosques, setHighlightKiosques] = useState<Set<string> | null>(null)
  const [highlightOffres, setHighlightOffres] = useState<Set<string> | null>(null)

  // Créations inline
  const [newOffreOpen, setNewOffreOpen] = useState(false)
  const [newOffreForm, setNewOffreForm] = useState({ nom: '', volume_ml: '' })
  const [newKiosqueOpen, setNewKiosqueOpen] = useState(false)
  const [newKiosqueForm, setNewKiosqueForm] = useState({ nom: '', adresse: '' })

  const load = useCallback(async () => {
    setIsLoading(true)
    const [offresResult, kiosquesResult, tarifsResult] = await Promise.all([
      supabase.from('offres').select('id, nom, volume_ml').order('nom'),
      supabase.from('kiosques').select('id, nom').order('nom'),
      supabase.from('offres_kiosque').select('kiosque_id, offre_id, prix, est_actif'),
    ])

    if (offresResult.error || kiosquesResult.error || tarifsResult.error) {
      console.error('Error loading tarifs matrix:', {
        offres: offresResult.error,
        kiosques: kiosquesResult.error,
        tarifs: tarifsResult.error,
      })
      showToast({
        type: 'error',
        title: 'Chargement impossible',
        message: handleSupabaseError(
          offresResult.error ?? kiosquesResult.error ?? tarifsResult.error
        ),
      })
      setIsLoading(false)
      return
    }

    setOffres((offresResult.data ?? []) as OffreRow[])
    setKiosques((kiosquesResult.data ?? []) as KiosqueRow[])

    const map = new Map<string, number>()
    for (const tarif of (tarifsResult.data ?? []) as TarifRow[]) {
      if (!tarif.est_actif) continue
      map.set(cellKey(tarif.kiosque_id, tarif.offre_id), tarif.prix)
    }
    prixByCellRef.current = map
    pendingUpsertsRef.current.clear()
    pendingDeletesRef.current.clear()
    undoStackRef.current = []
    lastBatchRef.current = null
    setPendingCount(0)
    forceRender((n) => n + 1)
    setIsLoading(false)
  }, [showToast])

  useEffect(() => {
    load()
  }, [load])

  /* ── Mutation d'une cellule ────────────────────────────────────────── */

  const applyCellValue = useCallback(
    (kiosqueId: string, offreId: string, prix: number | null, withUndo = true) => {
      const key = cellKey(kiosqueId, offreId)
      const prev = prixByCellRef.current.get(key) ?? null

      const wasPending =
        pendingUpsertsRef.current.has(key) || pendingDeletesRef.current.has(key)
      if (!wasPending) {
        preBatchRef.current.set(key, { kiosque_id: kiosqueId, offre_id: offreId, prev })
      }

      if (prix === null) {
        prixByCellRef.current.delete(key)
        pendingUpsertsRef.current.delete(key)
        pendingDeletesRef.current.set(key, { kiosque_id: kiosqueId, offre_id: offreId })
      } else {
        prixByCellRef.current.set(key, prix)
        pendingUpsertsRef.current.set(key, { kiosque_id: kiosqueId, offre_id: offreId, prix })
        pendingDeletesRef.current.delete(key)
      }

      if (withUndo) {
        const stack = undoStackRef.current
        stack.push({ cell: key, kiosque_id: kiosqueId, offre_id: offreId, prev })
        if (stack.length > 10) stack.splice(0, stack.length - 10)
      }

      setPendingCount(pendingUpsertsRef.current.size + pendingDeletesRef.current.size)
      forceRender((n) => n + 1)
    },
    []
  )



  /* ── Flush par lots de 20 ──────────────────────────────────────────── */

  const flushPending = useCallback(async () => {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }

    setIsFlushing(true)
    const upserts = Array.from(pendingUpsertsRef.current.values())
    const deletes = Array.from(pendingDeletesRef.current.values())
    if (upserts.length === 0 && deletes.length === 0) {
      setIsFlushing(false)
      return
    }

    const upsertBatch = upserts.slice(0, 20)
    const deleteBatch = deletes.slice(0, 20)

    // Snapshot pour l'action "Annuler" du toast.
    lastBatchRef.current = upsertBatch.map((upsert) => {
      const key = cellKey(upsert.kiosque_id, upsert.offre_id)
      return {
        cell: key,
        kiosque_id: upsert.kiosque_id,
        offre_id: upsert.offre_id,
        prev: preBatchRef.current.get(key)?.prev ?? null,
      }
    })

    const chunks = chunkBatch(upsertBatch)
    let savedCount = 0
    let failed = false

    for (const chunk of chunks) {
      const { error } = await supabase
        .from('offres_kiosque')
        .upsert(chunk, { onConflict: 'kiosque_id,offre_id' })
      if (error) {
        console.error('Tarifs batch upsert failed:', error.code, error.message)
        failed = true
        break
      }
      savedCount += chunk.length
      for (const upsert of chunk) {
        pendingUpsertsRef.current.delete(cellKey(upsert.kiosque_id, upsert.offre_id))
      }
    }

    for (const del of deleteBatch) {
      const key = cellKey(del.kiosque_id, del.offre_id)
      const { error } = await supabase
        .from('offres_kiosque')
        .delete()
        .eq('kiosque_id', del.kiosque_id)
        .eq('offre_id', del.offre_id)
      if (error) {
        console.error('Tarifs batch delete failed:', error.code, error.message)
        failed = true
        continue
      }
      pendingDeletesRef.current.delete(key)
      savedCount += 1
    }

    setPendingCount(pendingUpsertsRef.current.size + pendingDeletesRef.current.size)
    setIsFlushing(false)

    if (failed) {
      // Rollback du lot: restauration des valeurs d'avant, gardées en attente.
      for (const entry of lastBatchRef.current ?? []) {
        applyCellValue(entry.kiosque_id, entry.offre_id, entry.prev, false)
      }
      showToast({
        type: 'error',
        title: 'Sauvegarde impossible',
        message: 'Les modifications ont été annulées. Veuillez réessayer.',
      })
      return
    }

    if (savedCount > 0) {
      const batchForUndo = lastBatchRef.current
      showToast({
        type: 'success',
        title: `${savedCount} modification(s) sauvegardée(s)`,
        message: `${savedCount} modification(s) enregistrée(s).`,
        duration: 6000,
        action: batchForUndo
          ? {
              label: 'Annuler',
              onClick: () => {
                for (const entry of batchForUndo) {
                  applyCellValue(entry.kiosque_id, entry.offre_id, entry.prev, false)
                  preBatchRef.current.delete(entry.cell)
                }
                void flushPending()
              },
            }
          : undefined,
      })
    }

    if (pendingUpsertsRef.current.size > 0 || pendingDeletesRef.current.size > 0) {
      void flushPending()
    }
  }, [applyCellValue, showToast])

  // Le flush est appelé via une ref pour éviter les cycles de dépendances.
  // flushPending est lu via flushRef: le timer lit toujours la dernière
  // version, on évite délibérément de recréer le timer à chaque changement.
  const scheduleFlush = useCallback((delay = 600) => {
    if (flushTimerRef.current) window.clearTimeout(flushTimerRef.current)
    flushTimerRef.current = window.setTimeout(() => void void flushPending(), delay)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Ctrl+Z ────────────────────────────────────────────────────────── */



  const undo = useCallback(() => {
    const entry = undoStackRef.current.pop()
    if (!entry) return
    applyCellValue(entry.kiosque_id, entry.offre_id, entry.prev, false)
    scheduleFlush()
  }, [applyCellValue, scheduleFlush])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        const target = event.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        event.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo])

  /* ── Listes dérivées ───────────────────────────────────────────────── */

  const offreNeedle = offreSearch.trim().toLowerCase()
  const kiosqueNeedle = kiosqueSearch.trim().toLowerCase()

  const kiosquesAvecOffre = useMemo(() => {
    const ids = new Set<string>()
    for (const offre of offres) {
      for (const kiosque of kiosques) {
        if (prixByCellRef.current.get(cellKey(kiosque.id, offre.id)) !== undefined) {
          ids.add(kiosque.id)
        }
      }
    }
    return ids
    // pendingCount intentionnel: les refs ne déclenchent pas de re-render,
    // le compteur force le recalcul après chaque édition optimiste.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kiosques, offres, pendingCount])

  const offresAvecKiosque = useMemo(() => {
    const ids = new Set<string>()
    for (const kiosque of kiosques) {
      for (const offre of offres) {
        if (prixByCellRef.current.get(cellKey(kiosque.id, offre.id)) !== undefined) {
          ids.add(offre.id)
        }
      }
    }
    return ids
    // pendingCount intentionnel (refs muettes) — voir ci-dessus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kiosques, offres, pendingCount])

  const visibleKiosques = useMemo(() => {
    let list = kiosques
    if (onlyKiosquesSansOffre) {
      list = list.filter((kiosque) => !kiosquesAvecOffre.has(kiosque.id))
    }
    if (kiosqueNeedle) {
      list = list.filter((kiosque) => kiosque.nom.toLowerCase().includes(kiosqueNeedle))
    }
    if (highlightKiosques) {
      list = list.filter((kiosque) => highlightKiosques.has(kiosque.id))
    }
    return list
  }, [highlightKiosques, kiosqueNeedle, kiosques, kiosquesAvecOffre, onlyKiosquesSansOffre])

  const visibleOffres = useMemo(() => {
    let list = offres
    if (highlightOffres) {
      list = list.filter((offre) => highlightOffres.has(offre.id))
    }
    if (offreNeedle) {
      list = list.filter((offre) => offre.nom.toLowerCase().includes(offreNeedle))
    }
    return list
  }, [highlightOffres, offreNeedle, offres])

  const kiosquesSansOffre = useMemo(
    () => kiosques.filter((kiosque) => !kiosquesAvecOffre.has(kiosque.id)),
    [kiosques, kiosquesAvecOffre]
  )

  const offresSansKiosque = useMemo(
    () => offres.filter((offre) => !offresAvecKiosque.has(offre.id)),
    [offres, offresAvecKiosque]
  )

  /* ── Interactions cellules ─────────────────────────────────────────── */

  const startEdit = (kiosqueId: string, offreId: string) => {
    const key = cellKey(kiosqueId, offreId)
    setEditingCell(key)
    setEditingValue(prixByCellRef.current.has(key) ? String(prixByCellRef.current.get(key)) : '')
  }

  const commitEdit = (kiosqueId: string, offreId: string) => {
    const raw = editingValue.trim().replace(/\s/g, '')
    if (raw === '') {
      applyCellValue(kiosqueId, offreId, null)
      setEditingCell(null)
      scheduleFlush()
      return
    }
    const prix = Number(raw)
    if (!Number.isFinite(prix) || prix < 0) {
      setEditingCell(null)
      return
    }
    applyCellValue(kiosqueId, offreId, prix)
    setEditingCell(null)
    scheduleFlush()
  }

  const deleteCell = (kiosqueId: string, offreId: string) => {
    applyCellValue(kiosqueId, offreId, null)
    scheduleFlush()
  }

  const applyToSelection = (prix: number) => {
    for (const key of selectedCells) {
      const [kiosqueId, offreId] = key.split('__')
      applyCellValue(kiosqueId, offreId, prix)
    }
    scheduleFlush()
    showToast({
      type: 'success',
      title: 'Prix appliqué',
      message: `Prix appliqué à ${selectedCells.size} cellule(s).`,
    })
  }

  const pasteOnSelection = () => {
    if (copyBuffer === null) return
    for (const key of selectedCells) {
      const [kiosqueId, offreId] = key.split('__')
      applyCellValue(kiosqueId, offreId, copyBuffer)
    }
    scheduleFlush()
  }

  const toggleCellSelection = (key: string) => {
    setSelectedCells((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  /* ── Créations inline ──────────────────────────────────────────────── */

  const createOffre = async () => {
    if (!newOffreForm.nom.trim()) return
    const volume = Math.round(Number(newOffreForm.volume_ml))
    const { data, error } = await supabase
      .from('offres')
      .insert({
        nom: newOffreForm.nom.trim(),
        volume_ml: Number.isFinite(volume) && volume > 0 ? volume : null,
      })
      .select('id')
      .single()
    if (error) {
      showToast({ type: 'error', title: 'Création impossible', message: handleSupabaseError(error) })
      return
    }
    const volumeSafe = Number.isFinite(volume) && volume > 0 ? volume : null
    setOffres((current) => [
      ...current,
      { id: data.id, nom: newOffreForm.nom.trim(), volume_ml: volumeSafe },
    ])
    setNewOffreOpen(false)
    setNewOffreForm({ nom: '', volume_ml: '' })
    showToast({
      type: 'success',
      title: 'Offre créée',
      message: `${newOffreForm.nom.trim()} ajoutée comme nouvelle ligne.`,
    })
  }

  const createKiosque = async () => {
    if (!newKiosqueForm.nom.trim()) return
    const { data, error } = await supabase
      .from('kiosques')
      .insert({ nom: newKiosqueForm.nom.trim(), adresse: newKiosqueForm.adresse.trim() || null })
      .select('id')
      .single()
    if (error) {
      showToast({ type: 'error', title: 'Création impossible', message: handleSupabaseError(error) })
      return
    }
    setKiosques((current) => [
      ...current,
      { id: data.id, nom: newKiosqueForm.nom.trim(), adresse: newKiosqueForm.adresse.trim() || null },
    ])
    setNewKiosqueOpen(false)
    setNewKiosqueForm({ nom: '', adresse: '' })
    showToast({
      type: 'success',
      title: 'Kiosque créé',
      message: `${newKiosqueForm.nom.trim()} ajouté comme nouvelle colonne.`,
    })
  }

  /* ── Rendu ─────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-text">Tarifs</h1>
          <p className="text-[12px] text-text-secondary">
            Prix par kiosque — cliquez une cellule pour définir ou modifier un prix
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="rounded-full bg-warning-light px-3 py-1 text-[11px] font-semibold text-warning [font-variant-numeric:tabular-nums]">
              {pendingCount} non sauvegardé{pendingCount > 1 ? 's' : ''}
            </span>
          )}
          <Button
            type="button"
            variant="pos-secondary"
            size="sm"
            disabled={undoStackRef.current.length === 0}
            onClick={undo}
            title="Annuler (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
            Annuler
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={pendingCount === 0}
            loading={isFlushing}
            onClick={() => void flushPending()}
          >
            <Save className="h-4 w-4" />
            Enregistrer
          </Button>
        </div>
      </div>

      {/* ── Filtres + indicateurs ── */}
      <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={offreSearch}
              onChange={(event) => setOffreSearch(event.target.value)}
              placeholder="Rechercher une offre (lignes)"
              aria-label="Rechercher une offre"
              className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-[13px] text-text focus:border-primary focus:outline-none"
            />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={kiosqueSearch}
              onChange={(event) => setKiosqueSearch(event.target.value)}
              placeholder="Rechercher un kiosque (colonnes)"
              aria-label="Rechercher un kiosque"
              className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-[13px] text-text focus:border-primary focus:outline-none"
            />
          </div>
          <label className="flex min-h-11 items-center gap-2 px-1 text-[12px] font-semibold text-text-secondary">
            <input
              type="checkbox"
              checked={onlyKiosquesSansOffre}
              onChange={(event) => setOnlyKiosquesSansOffre(event.target.checked)}
              className="h-4 w-4"
            />
            Kiosques sans offre
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {kiosquesSansOffre.length > 0 && (
            <button
              type="button"
              onClick={() => {
                // Spec: le badge active le TOGGLE "kiosques sans offre"
                const next = !onlyKiosquesSansOffre
                setOnlyKiosquesSansOffre(next)
                setHighlightKiosques(next ? new Set(kiosquesSansOffre.map((k) => k.id)) : null)
                setHighlightOffres(null)
              }}
              className={
                highlightKiosques
                  ? 'min-h-11 rounded-md border-2 border-[#EB4D5E] bg-[#FDF1F2] px-3 text-[12px] font-semibold text-[#EB4D5E]'
                  : 'min-h-11 rounded-md border border-[#EB4D5E]/40 bg-[#FDF1F2] px-3 text-[12px] font-semibold text-[#EB4D5E] hover:border-[#EB4D5E]'
              }
            >
              {kiosquesSansOffre.length} kiosque(s) sans offre
            </button>
          )}
          {offresSansKiosque.length > 0 && (
            <button
              type="button"
              onClick={() => {
                // Spec: le badge filtre les LIGNES sur les offres non assignées
                setHighlightOffres(
                  highlightOffres ? null : new Set(offresSansKiosque.map((o) => o.id))
                )
                setOnlyKiosquesSansOffre(false)
                setHighlightKiosques(null)
              }}
              className={
                highlightOffres
                  ? 'min-h-11 rounded-md border-2 border-warning bg-warning-light px-3 text-[12px] font-semibold text-warning'
                  : 'min-h-11 rounded-md border border-warning/40 bg-warning-light px-3 text-[12px] font-semibold text-warning hover:border-warning'
              }
            >
              {offresSansKiosque.length} offre(s) sans kiosque
            </button>
          )}
          {(highlightKiosques || highlightOffres) && (
            <button
              type="button"
              onClick={() => {
                setHighlightKiosques(null)
                setHighlightOffres(null)
              }}
              className="min-h-11 rounded-md border border-border px-3 text-[12px] font-semibold text-text-secondary hover:border-primary"
            >
              Réinitialiser le filtre
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-9 items-center gap-2 text-[12px] font-semibold text-text-secondary">
            <input
              type="checkbox"
              checked={multiSelect}
              onChange={(event) => {
                setMultiSelect(event.target.checked)
                setSelectedCells(new Set())
              }}
              className="h-4 w-4"
            />
            Sélection multiple
          </label>
          {multiSelect && selectedCells.size > 0 && (
            <>
              <span className="text-[12px] text-text-secondary [font-variant-numeric:tabular-nums]">
                {selectedCells.size} sélectionnée(s)
              </span>
              <ApplyPriceBar onApply={applyToSelection} />
              {copyBuffer !== null && (
                <Button
                  type="button"
                  variant="pos-secondary"
                  size="sm"
                  onClick={pasteOnSelection}
                >
                  <Copy className="h-4 w-4" />
                  Coller {formatPrixCell(copyBuffer)}
                </Button>
              )}
            </>
          )}
          {copyBuffer !== null && !multiSelect && (
            <span className="text-[11px] text-[#1C5376]">
              Prix {formatPrixCell(copyBuffer)} copié — activez la sélection multiple pour coller.
            </span>
          )}
        </div>
      </div>

      {/* ── Matrice ── */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-12" />
              ))}
            </div>
          ) : visibleOffres.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Aucune offre"
                description="Créez votre première offre avec le bouton « Ajouter une offre »."
              />
            </div>
          ) : visibleKiosques.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Aucun kiosque"
                description="Ajoutez un kiosque avec « Ajouter un kiosque » ou via l'import CSV."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="border-collapse text-[12px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 border-b border-r-2 border-r-[#DCE1E5] border-b-[#DCE1E5] bg-white p-2 text-left">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1C5376]">
                        Offre
                      </span>
                    </th>
                    {visibleKiosques.map((kiosque) => (
                      <th
                        key={kiosque.id}
                        className="min-w-[96px] border-b border-b-[#DCE1E5] border-l border-l-[#F6F9FB] bg-white p-2 text-center"
                      >
                        <span className="block text-[11px] font-bold text-[#12364D]">
                          {kiosque.nom}
                        </span>
                      </th>
                    ))}
                    <th className="min-w-[120px] border-b border-b-[#DCE1E5] border-l border-l-[#F6F9FB] bg-[#F6F9FB] p-2">
                      <button
                        type="button"
                        onClick={() => setNewKiosqueOpen(true)}
                        className="flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-md border-2 border-dashed border-[#DCE1E5] text-[#1C5376] hover:border-[#009EFB] hover:text-[#009EFB]"
                      >
                        <Plus className="h-4 w-4" />
                        <span className="text-[10px] font-semibold">Ajouter un kiosque</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOffres.map((offre) => (
                    <tr key={offre.id} className="group">
                      <td className="sticky left-0 z-10 border-r-2 border-r-[#DCE1E5] border-b border-b-[#F6F9FB] bg-white p-2">
                        <span className="block text-[12px] font-semibold text-[#12364D]">
                          {offre.nom}
                        </span>
                        {offre.volume_ml ? (
                          <span className="text-[10px] text-[#7D94A6]">
                            {offre.volume_ml % 1000 === 0
                              ? `${offre.volume_ml / 1000}L`
                              : `${offre.volume_ml} ml`}
                          </span>
                        ) : null}
                      </td>
                      {visibleKiosques.map((kiosque) => {
                        const key = cellKey(kiosque.id, offre.id)
                        const prix = prixByCellRef.current.get(key)
                        const suspect = prix !== undefined && isSuspectPrice(prix)
                        const isEditing = editingCell === key
                        const isSelected = selectedCells.has(key)

                        return (
                          <td
                            key={key}
                            className="border-b border-b-[#F6F9FB] border-l border-l-[#F6F9FB] p-0.5"
                          >
                            {isEditing ? (
                              <input
                                type="number"
                                min={0}
                                autoFocus
                                value={editingValue}
                                onChange={(event) => setEditingValue(event.target.value)}
                                onBlur={() => commitEdit(kiosque.id, offre.id)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') commitEdit(kiosque.id, offre.id)
                                  if (event.key === 'Escape') setEditingCell(null)
                                }}
                                className="h-9 w-full rounded border-2 border-[#009EFB] px-1 text-center text-[12px] font-semibold text-[#12364D] focus:outline-none [font-variant-numeric:tabular-nums]"
                              />
                            ) : (
                              <div
                                role="button"
                                tabIndex={0}
                                title={
                                  suspect
                                    ? 'Prix suspect : vérifiez cette valeur'
                                    : prix !== undefined
                                      ? `Modifier (${formatPrixCell(prix)})`
                                      : 'Définir un prix'
                                }
                                onClick={() => {
                                  if (multiSelect) toggleCellSelection(key)
                                  else startEdit(kiosque.id, offre.id)
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') startEdit(kiosque.id, offre.id)
                                  if (event.key === 'Delete' && prix !== undefined)
                                    deleteCell(kiosque.id, offre.id)
                                }}
                                className={`relative flex h-9 min-w-[88px] cursor-pointer items-center justify-center rounded border text-[12px] font-semibold transition-colors [font-variant-numeric:tabular-nums] ${
                                  prix === undefined
                                    ? 'border-dashed border-[#DCE1E5] bg-white text-[#8AA3B5] hover:border-[#009EFB] hover:text-[#009EFB]'
                                    : suspect
                                      ? 'border-2 border-[#FF4949] bg-[#FDF1F2] text-[#12364D] hover:border-[#009EFB]'
                                      : 'border border-[#DCE1E5] bg-white text-[#12364D] hover:border-[#009EFB]'
                                } ${isSelected ? 'ring-2 ring-[#009EFB]' : ''}`}
                              >
                                {prix === undefined ? (
                                  '+'
                                ) : (
                                  <>
                                    {formatPrixCell(prix)}
                                    <button
                                      type="button"
                                      tabIndex={-1}
                                      aria-label={`Copier le prix de ${offre.nom} (${kiosque.nom})`}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        setCopyBuffer(prix)
                                      }}
                                      className="absolute -left-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-[#009EFB] text-white group-hover:flex"
                                      title="Copier ce prix"
                                    >
                                      <Copy className="h-2.5 w-2.5" />
                                    </button>
                                    <button
                                      type="button"
                                      tabIndex={-1}
                                      aria-label={`Supprimer le prix de ${offre.nom} pour ${kiosque.nom}`}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        deleteCell(kiosque.id, offre.id)
                                      }}
                                      className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-[#FF4949] text-[9px] font-bold text-white group-hover:flex"
                                    >
                                      ×
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className="border-b border-b-[#F6F9FB] border-l border-l-[#F6F9FB] bg-[#F6F9FB] p-1">
                        <button
                          type="button"
                          onClick={() => setNewKiosqueOpen(true)}
                          className="flex min-h-9 w-full items-center justify-center rounded-md text-[#8AA3B5] hover:text-[#009EFB]"
                          aria-label="Ajouter un kiosque"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="sticky left-0 z-10 border-r-2 border-r-[#DCE1E5] border-t border-t-[#DCE1E5] bg-[#F6F9FB] p-1.5">
                      <button
                        type="button"
                        onClick={() => setNewOffreOpen(true)}
                        className="flex min-h-11 w-full items-center justify-center gap-1 rounded-md border-2 border-dashed border-[#DCE1E5] text-[11px] font-semibold text-[#1C5376] hover:border-[#009EFB] hover:text-[#009EFB]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Ajouter une offre
                      </button>
                    </td>
                    <td
                      colSpan={visibleKiosques.length + 1}
                      className="border-t border-t-[#DCE1E5] bg-[#F6F9FB] p-1.5"
                    >
                      <Button
                        type="button"
                        variant="pos-secondary"
                        size="sm"
                        onClick={() => setNewOffreOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                        Ajouter une offre
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Dialogs ── */}
      <Dialog open={newOffreOpen} onOpenChange={setNewOffreOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle offre</DialogTitle>
            <DialogDescription>Elle apparaîtra comme nouvelle ligne de la matrice.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <PosLabel htmlFor="matrix-offre-nom">Nom *</PosLabel>
              <PosInput
                id="matrix-offre-nom"
                value={newOffreForm.nom}
                onChange={(event) => setNewOffreForm((c) => ({ ...c, nom: event.target.value }))}
                placeholder="Ex : Offre Ganale"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <PosLabel htmlFor="matrix-offre-volume">Volume (ml)</PosLabel>
              <PosInput
                id="matrix-offre-volume"
                type="number"
                min={0}
                value={newOffreForm.volume_ml}
                onChange={(event) => setNewOffreForm((c) => ({ ...c, volume_ml: event.target.value }))}
                placeholder="Ex : 10000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="pos-secondary" onClick={() => setNewOffreOpen(false)}>
              Annuler
            </Button>
            <Button variant="pos-primary" onClick={createOffre} disabled={!newOffreForm.nom.trim()}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newKiosqueOpen} onOpenChange={setNewKiosqueOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau kiosque</DialogTitle>
            <DialogDescription>Il apparaîtra comme nouvelle colonne de la matrice.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <PosLabel htmlFor="matrix-kiosque-nom">Nom *</PosLabel>
              <PosInput
                id="matrix-kiosque-nom"
                value={newKiosqueForm.nom}
                onChange={(event) => setNewKiosqueForm((c) => ({ ...c, nom: event.target.value }))}
                placeholder="Ex : Keur Massar En Propre"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <PosLabel htmlFor="matrix-kiosque-adresse">Adresse</PosLabel>
              <PosInput
                id="matrix-kiosque-adresse"
                value={newKiosqueForm.adresse}
                onChange={(event) => setNewKiosqueForm((c) => ({ ...c, adresse: event.target.value }))}
                placeholder="Quartier ou zone"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="pos-secondary" onClick={() => setNewKiosqueOpen(false)}>
              Annuler
            </Button>
            <Button variant="pos-primary" onClick={createKiosque} disabled={!newKiosqueForm.nom.trim()}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ApplyPriceBar({ onApply }: { onApply: (prix: number) => void }) {
  const [prix, setPrix] = useState('')
  const valid = prix !== '' && Number.isFinite(Number(prix)) && Number(prix) >= 0

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        value={prix}
        onChange={(event) => setPrix(event.target.value)}
        placeholder="Prix CFA"
        aria-label="Prix à appliquer à la sélection"
        className="h-9 w-28 rounded-md border border-[#DCE1E5] px-2 text-[12px] text-[#12364D] focus:border-[#009EFB] focus:outline-none [font-variant-numeric:tabular-nums]"
      />
      <Button
        type="button"
        variant="pos-primary"
        size="sm"
        disabled={!valid}
        onClick={() => onApply(Math.round(Number(prix)))}
      >
        Appliquer prix
      </Button>
    </div>
  )
}
