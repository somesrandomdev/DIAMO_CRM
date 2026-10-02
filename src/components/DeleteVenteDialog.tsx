import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/Toast'
import { logError, logInfo, logWarn } from '@/lib/telemetry'
import { handleSupabaseError, supabase } from '@/lib/supabase'

export interface VenteDeleteTarget {
  id: string
  date: string
  clientNom: string
  offresResume: string
  montant: number
  lienTicket?: string | null
}

import { validateDeleteVente, type DeleteMotif } from '@/lib/venteDeleteRules'
import { Label } from '@/components/ui/label'
import { Input, Select } from '@/components/ui/input'

const MOTIFS: DeleteMotif[] = ['Erreur de saisie', 'Doublon', 'Retour client', 'Autre']

interface DeleteVenteDialogProps {
  target: VenteDeleteTarget | null
  role: string
  onOpenChange: (open: boolean) => void
  /** Appelé après succès : rafraîchit liste + résumé. */
  onDeleted: () => void
}

export function DeleteVenteDialog({ target, role, onOpenChange, onDeleted }: DeleteVenteDialogProps) {
  const { showToast } = useToast()
  const [motif, setMotif] = useState<DeleteMotif | ''>('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!target) return
    setMotif('')
    setComment('')
    setError('')
    setIsDeleting(false)
  }, [target])

  const submit = async () => {
    if (!target) return
    const validationError = validateDeleteVente(motif, comment)
    if (validationError) {
      setError(validationError)
      return
    }

    // Capture AVANT la RPC: la ligne disparaît après suppression.
    const { data: row } = await supabase
      .from('ventes')
      .select('lien_ticket')
      .eq('id', target.id)
      .maybeSingle()
    const lienTicket = (row as { lien_ticket?: string | null } | null)?.lien_ticket ?? null

    setIsDeleting(true)
    const { data: rpcData, error: rpcError } = await supabase.rpc('delete_vente', {
      p_vente_id: target.id,
      p_reason: motif,
      p_comment: comment.trim() || null,
    })
    setIsDeleting(false)

    if (rpcError) {
      const message = rpcError.message.toLowerCase()
      logError('vente.delete', 'échec suppression vente', {
        code: rpcError.code,
        message: rpcError.message,
        venteId: target.id,
        motif,
      })
      if (message.includes('motif')) setError('Le motif de suppression est obligatoire.')
      else if (message.includes('24') || message.includes('heure') || message.includes('fenêtre'))
        setError('Suppression réservée à un administrateur au-delà de 24 heures.')
      else if (message.includes('kiosque') || rpcError.code === '42501')
        setError('Vous ne pouvez supprimer que les ventes de votre kiosque.')
      else setError(handleSupabaseError(rpcError))
      return
    }

    logInfo('vente.delete', 'vente supprimée', {
      venteId: target.id,
      motif,
      montant: target.montant,
      role,
    })

    // Vente multi-offres : le ticket couvre encore les lignes restantes (la RPC
    // l'a reporté sur une ligne sœur) — surtout ne pas le supprimer.
    const hadSiblings = (rpcData as { had_siblings?: boolean } | null)?.had_siblings === true

    // Best-effort: suppression de l'objet ticket en storage (orphelin acceptable).
    if (lienTicket && !hadSiblings) {
      try {
        const { error: storageError } = await supabase.storage
          .from('private_tickets')
          .remove([lienTicket])
        if (storageError) {
          logWarn('ticket', 'ticket orphelin non supprimé', {
            lienTicket,
            message: storageError.message,
          })
        } else {
          logInfo('ticket', 'ticket supprimé du storage', { lienTicket })
        }
      } catch {
        logWarn('ticket', 'suppression storage échouée', { lienTicket })
      }
    }

    showToast({ type: 'success', title: 'Vente supprimée', message: 'Vente supprimée et tracée dans le journal d’audit.' })
    onDeleted()
    onOpenChange(false)
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onOpenChange(false)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red" aria-hidden="true" />
            Supprimer la vente
          </DialogTitle>
          <DialogDescription>
            {target
              ? `${new Date(target.date).toLocaleString('fr-FR')} — ${target.clientNom} — ${target.offresResume} — ${target.montant.toLocaleString('fr-FR')} CFA`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label variant="caps" htmlFor="delete-vente-motif">Motif *</Label>
            <Select fieldSize="lg" id="delete-vente-motif" value={motif} onChange={(e) => setMotif(e.target.value as DeleteMotif)}>
              <option value="">Choisir un motif…</option>
              {MOTIFS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          {motif === 'Autre' && (
            <div className="space-y-1.5">
              <Label variant="caps" htmlFor="delete-vente-comment">Commentaire *</Label>
              <Input fieldSize="lg"
                id="delete-vente-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Précisez la raison de la suppression"
              />
            </div>
          )}
          <p className="rounded-md bg-red-soft p-2.5 text-xs text-red">
            Action définitive. Elle sera tracée dans le journal d'audit.
          </p>
          {error && <p className="text-sm font-medium text-red">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" size="touch" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="destructive" size="touch" loading={isDeleting} loadingText="Suppression…" onClick={submit} disabled={!motif}>
            <Trash2 className="h-4 w-4" />
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
