import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/Toast'
import { handleSupabaseError, supabase } from '@/lib/supabase'
import { Label } from '@/components/ui/label'
import { Input, Select, Textarea } from '@/components/ui/input'

/**
 * POS-styled edit dialogs shared by the commercial supervisor dashboard and
 * the admin clients-by-kiosk view. Update-only by design: the commercial role
 * has no DELETE or INSERT grants on clients/ventes.
 */

export interface EditableClient {
  id: string
  nom: string
  telephone?: string | null
  adresse?: string | null
  email?: string | null
  notes?: string | null
}

interface EditClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: EditableClient | null
  /** Called after a successful update so the parent can refresh its data. */
  onSaved: () => void
}

export function EditClientDialog({ open, onOpenChange, client, onSaved }: EditClientDialogProps) {
  const { showToast } = useToast()
  const [form, setForm] = useState({ nom: '', telephone: '', adresse: '', email: '', notes: '' })
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open || !client) return
    setForm({
      nom: client.nom ?? '',
      telephone: client.telephone ?? '',
      adresse: client.adresse ?? '',
      email: client.email ?? '',
      notes: client.notes ?? '',
    })
    setError('')
    setIsSaving(false)
  }, [open, client])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!client) return

    if (!form.nom.trim()) {
      setError('Le nom du client est obligatoire.')
      return
    }

    setIsSaving(true)
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        nom: form.nom.trim(),
        telephone: form.telephone.trim() || null,
        adresse: form.adresse.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
      })
      .eq('id', client.id)

    setIsSaving(false)

    if (updateError) {
      console.error('Client update failed:', updateError)
      setError(handleSupabaseError(updateError))
      return
    }

    showToast({ type: 'success', title: 'Client mis à jour', message: 'Client mis à jour avec succès' })
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier le client</DialogTitle>
          <DialogDescription>Corrigez les informations du client.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label variant="caps" htmlFor="client-nom">Nom *</Label>
            <Input fieldSize="lg"
              id="client-nom"
              value={form.nom}
              onChange={(event) => setForm((current) => ({ ...current, nom: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label variant="caps" htmlFor="client-telephone">Téléphone</Label>
            <Input fieldSize="lg"
              id="client-telephone"
              value={form.telephone}
              onChange={(event) => setForm((current) => ({ ...current, telephone: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label variant="caps" htmlFor="client-adresse">Adresse</Label>
            <Input fieldSize="lg"
              id="client-adresse"
              value={form.adresse}
              onChange={(event) => setForm((current) => ({ ...current, adresse: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label variant="caps" htmlFor="client-email">Email</Label>
            <Input fieldSize="lg"
              id="client-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label variant="caps" htmlFor="client-notes">Notes</Label>
            <Textarea fieldSize="lg"
              id="client-notes"
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </div>
          {error && <p className="text-sm font-medium text-red">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" size="touch" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" size="touch" loading={isSaving} loadingText="Enregistrement…">
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export interface EditableVente {
  id: string
  quantite: number
  montant_total: number
  offre_id: string | null
  client_id: string | null
}

export interface VenteOption {
  id: string
  nom: string
}

interface EditVenteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vente: EditableVente | null
  clients: VenteOption[]
  offres: VenteOption[]
  onSaved: () => void
}

export function EditVenteDialog({ open, onOpenChange, vente, clients, offres, onSaved }: EditVenteDialogProps) {
  const { showToast } = useToast()
  const [form, setForm] = useState({ quantite: '1', montant_total: '0', offre_id: '', client_id: '' })
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open || !vente) return
    setForm({
      quantite: String(vente.quantite ?? 1),
      montant_total: String(vente.montant_total ?? 0),
      offre_id: vente.offre_id ?? '',
      client_id: vente.client_id ?? '',
    })
    setError('')
    setIsSaving(false)
  }, [open, vente])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!vente) return

    const quantite = Number.parseInt(form.quantite, 10)
    const montantTotal = Number.parseFloat(form.montant_total)

    if (!Number.isInteger(quantite) || quantite < 1) {
      setError('La quantité doit être un nombre entier positif.')
      return
    }
    if (!Number.isFinite(montantTotal) || montantTotal < 0) {
      setError('Le montant total doit être un nombre positif.')
      return
    }

    setIsSaving(true)
    const { error: updateError } = await supabase
      .from('ventes')
      .update({
        quantite,
        montant_total: montantTotal,
        offre_id: form.offre_id || null,
        client_id: form.client_id || null,
      })
      .eq('id', vente.id)

    setIsSaving(false)

    if (updateError) {
      console.error('Vente update failed:', updateError)
      setError(handleSupabaseError(updateError))
      return
    }

    showToast({ type: 'success', title: 'Vente corrigée', message: 'Vente corrigée avec succès' })
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier la vente</DialogTitle>
          <DialogDescription>Corrigez les détails de la vente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label variant="caps" htmlFor="vente-offre">Offre</Label>
            <Select fieldSize="lg"
              id="vente-offre"
              value={form.offre_id}
              onChange={(event) => setForm((current) => ({ ...current, offre_id: event.target.value }))}
            >
              <option value="">—</option>
              {offres.map((offre) => (
                <option key={offre.id} value={offre.id}>{offre.nom}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label variant="caps" htmlFor="vente-client">Client</Label>
            <Select fieldSize="lg"
              id="vente-client"
              value={form.client_id}
              onChange={(event) => setForm((current) => ({ ...current, client_id: event.target.value }))}
            >
              <option value="">—</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.nom}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label variant="caps" htmlFor="vente-quantite">Quantité</Label>
              <Input fieldSize="lg"
                id="vente-quantite"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={form.quantite}
                onChange={(event) => setForm((current) => ({ ...current, quantite: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label variant="caps" htmlFor="vente-montant">Montant total (CFA)</Label>
              <Input fieldSize="lg"
                id="vente-montant"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={form.montant_total}
                onChange={(event) => setForm((current) => ({ ...current, montant_total: event.target.value }))}
              />
            </div>
          </div>
          {error && <p className="text-sm font-medium text-red">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" size="touch" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" size="touch" loading={isSaving} loadingText="Enregistrement…">
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

