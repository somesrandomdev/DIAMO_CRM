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
import { PosInput, PosLabel, PosSelect, PosTextarea } from '@/components/pos'
import { useToast } from '@/components/Toast'
import { monthKey } from '@/lib/commercialStats'
import { handleSupabaseError, supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

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
            <PosLabel htmlFor="client-nom">Nom *</PosLabel>
            <PosInput
              id="client-nom"
              value={form.nom}
              onChange={(event) => setForm((current) => ({ ...current, nom: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <PosLabel htmlFor="client-telephone">Téléphone</PosLabel>
            <PosInput
              id="client-telephone"
              value={form.telephone}
              onChange={(event) => setForm((current) => ({ ...current, telephone: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <PosLabel htmlFor="client-adresse">Adresse</PosLabel>
            <PosInput
              id="client-adresse"
              value={form.adresse}
              onChange={(event) => setForm((current) => ({ ...current, adresse: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <PosLabel htmlFor="client-email">Email</PosLabel>
            <PosInput
              id="client-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <PosLabel htmlFor="client-notes">Notes</PosLabel>
            <PosTextarea
              id="client-notes"
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </div>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="pos-secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="pos-primary" loading={isSaving}>
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
            <PosLabel htmlFor="vente-offre">Offre</PosLabel>
            <PosSelect
              id="vente-offre"
              value={form.offre_id}
              onChange={(event) => setForm((current) => ({ ...current, offre_id: event.target.value }))}
            >
              <option value="">—</option>
              {offres.map((offre) => (
                <option key={offre.id} value={offre.id}>{offre.nom}</option>
              ))}
            </PosSelect>
          </div>
          <div className="space-y-1.5">
            <PosLabel htmlFor="vente-client">Client</PosLabel>
            <PosSelect
              id="vente-client"
              value={form.client_id}
              onChange={(event) => setForm((current) => ({ ...current, client_id: event.target.value }))}
            >
              <option value="">—</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.nom}</option>
              ))}
            </PosSelect>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <PosLabel htmlFor="vente-quantite">Quantité</PosLabel>
              <PosInput
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
              <PosLabel htmlFor="vente-montant">Montant total (CFA)</PosLabel>
              <PosInput
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
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="pos-secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="pos-primary" loading={isSaving}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export interface EditableObjectif {
  id: string
  ca_cible: number
}

interface EditObjectifDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  objectif: EditableObjectif | null
  kiosqueNom: string
  onSaved: () => void
}

export function EditObjectifDialog({ open, onOpenChange, objectif, kiosqueNom, onSaved }: EditObjectifDialogProps) {
  const { showToast } = useToast()
  const [caCible, setCaCible] = useState('0')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open || !objectif) return
    setCaCible(String(objectif.ca_cible ?? 0))
    setError('')
    setIsSaving(false)
  }, [open, objectif])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!objectif) return

    const target = Number.parseFloat(caCible)
    if (!Number.isFinite(target) || target < 0) {
      setError('La cible doit être un nombre positif (CFA).')
      return
    }

    setIsSaving(true)
    const { error: updateError } = await supabase
      .from('objectifs')
      .update({ ca_cible: Math.round(target) })
      .eq('id', objectif.id)

    setIsSaving(false)

    if (updateError) {
      console.error('Objectif update failed:', updateError)
      setError(handleSupabaseError(updateError))
      return
    }

    showToast({ type: 'success', title: 'Objectif mis à jour', message: 'Objectif mis à jour' })
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier l'objectif</DialogTitle>
          <DialogDescription>Cible mensuelle de {kiosqueNom}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <PosLabel htmlFor="objectif-cible">Cible mensuelle (CFA)</PosLabel>
            <PosInput
              id="objectif-cible"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={caCible}
              onChange={(event) => setCaCible(event.target.value)}
            />
          </div>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="pos-secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="pos-primary" loading={isSaving}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface CreateObjectifDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kiosqueId: string
  kiosqueNom: string
  /** Called after a successful insert so the parent can refresh its data. */
  onCreated: () => void
}

/**
 * Sets the month's goal for a kiosk that has none yet. The (kiosque_id, mois)
 * UNIQUE constraint is the race-safe backstop: on a duplicate we surface the
 * plain-French message and refresh, so the existing row's editor takes over.
 */
export function CreateObjectifDialog({ open, onOpenChange, kiosqueId, kiosqueNom, onCreated }: CreateObjectifDialogProps) {
  const { showToast } = useToast()
  const { profile } = useAuthStore()
  const [caCible, setCaCible] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const monthName = new Date().toLocaleDateString('fr-FR', { month: 'long' })

  useEffect(() => {
    if (!open) return
    setCaCible('')
    setError('')
    setIsSaving(false)
  }, [open])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()

    const target = Number.parseFloat(caCible)
    if (!Number.isFinite(target) || target < 0) {
      setError('La cible doit être un nombre positif (CFA).')
      return
    }

    setIsSaving(true)
    const { error: insertError } = await supabase.from('objectifs').insert({
      kiosque_id: kiosqueId,
      mois: monthKey(),
      ca_cible: Math.round(target),
      created_by: profile?.id ?? null,
    })
    setIsSaving(false)

    if (insertError) {
      if (insertError.code === '23505') {
        showToast({
          type: 'error',
          title: 'Objectif existant',
          message: 'Un objectif existe déjà pour ce kiosque ce mois-ci.',
        })
        onOpenChange(false)
        onCreated()
        return
      }
      console.error('Objectif insert failed:', insertError)
      setError(handleSupabaseError(insertError))
      return
    }

    showToast({ type: 'success', title: 'Objectif défini', message: 'Objectif défini avec succès' })
    onOpenChange(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Définir l'objectif de {kiosqueNom}</DialogTitle>
          <DialogDescription>Mois de {monthName}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <PosLabel htmlFor="create-objectif-cible">Objectif CA (CFA)</PosLabel>
            <PosInput
              id="create-objectif-cible"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={caCible}
              onChange={(event) => setCaCible(event.target.value)}
              placeholder="0"
              autoFocus
            />
          </div>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="pos-secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="pos-primary" loading={isSaving}>
              Enregistrer l'objectif
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
