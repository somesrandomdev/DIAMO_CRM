import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormInput, FormSelect } from '@/components/ui/form-input'
import { useToast } from '@/components/Toast'
import { normalizePhone } from '@/lib/phone'
import { supabase } from '@/lib/supabase'
import { enqueueClient, type QueuedClient } from '@/utils/offlineClientQueue'
import { useAuthStore } from '@/stores/authStore'

export default function AddClientUltra({ onDone }: { onDone: (newId: string) => void }) {
  const { profile } = useAuthStore()
  const { showToast } = useToast()
  const [formData, setFormData] = useState({
    nom_prenom: '',
    telephone: '',
    email: '',
    localite: '',
    type_client: 'Particulier',
    nombre_personnes: '',
    contenant_prefere: 'Bouteille 10L',
    preference_contact: 'Telephone',
    accepte_offres: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /**
   * Per-kiosk duplicate check (the UNIQUE constraint is (kiosque_id, telephone)
   * — the SAME client MAY exist in several kiosques on purpose). Normalized
   * digits only, so spacing never hides a duplicate.
   */
  async function findDuplicateInKiosk(normalized: string, kiosqueId: string) {
    const { data } = await supabase
      .from('clients')
      .select('id, nom')
      .eq('telephone', normalized)
      .eq('kiosque_id', kiosqueId)
      .maybeSingle()
    return data
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')

    if (!formData.nom_prenom.trim() || !formData.telephone.trim()) {
      setError('Nom et telephone sont obligatoires.')
      return
    }

    const normalizedPhone = normalizePhone(formData.telephone)

    // Offline: queue the client in IndexedDB with a placeholder id. Offline
    // sales can reference that id; the flush re-points them to the real uuid.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (!profile?.kiosque_id) {
        setError('Impossible de creer un client hors ligne sans kiosque attribue.')
        return
      }

      const duplicate = await findDuplicateInKiosk(normalizedPhone, profile.kiosque_id)
      if (duplicate) {
        showToast({
          type: 'error',
          title: 'Doublon',
          message: `Ce numéro existe déjà dans ce kiosque pour « ${duplicate.nom} ».`,
        })
        return
      }

      const queuedClient: QueuedClient = {
        offline_id: `offline-${crypto.randomUUID()}`,
        kiosque_id: profile.kiosque_id,
        nom: formData.nom_prenom.trim(),
        telephone: normalizedPhone,
        email: formData.email.trim() || null,
        localite: formData.localite.trim(),
        type_client: formData.type_client,
        nombre_personnes: formData.nombre_personnes ? parseInt(formData.nombre_personnes, 10) : 1,
        contenant_prefere: formData.contenant_prefere,
        preference_contact: formData.preference_contact,
        accepte_offres: formData.accepte_offres,
        created_at: new Date().toISOString(),
      }

      await enqueueClient(queuedClient)
      showToast({
        type: 'info',
        title: 'Client enregistre hors ligne',
        message: 'Il sera synchronise a la reconnexion.',
      })
      onDone(queuedClient.offline_id)
      return
    }

    setLoading(true)
    try {
      if (!profile?.kiosque_id) {
        setError('Aucun kiosque attribue : impossible de creer un client.')
        setLoading(false)
        return
      }

      const duplicate = await findDuplicateInKiosk(normalizedPhone, profile.kiosque_id)
      if (duplicate) {
        showToast({
          type: 'error',
          title: 'Doublon',
          message: `Ce numéro existe déjà dans ce kiosque pour « ${duplicate.nom} ».`,
        })
        setLoading(false)
        return
      }

      const { data, error: insertError } = await supabase
        .from('clients')
        .insert({
          nom: formData.nom_prenom.trim(),
          // Stored normalized so duplicate checks and login resolution match
          // regardless of how the number was typed.
          telephone: normalizedPhone,
          email: formData.email.trim() || null,
          localite: formData.localite.trim(),
          type_client: formData.type_client,
          // clients.nombre_personnes is NOT NULL (default 1): sending null
          // fails the insert with 23502 when the field is left empty.
          nombre_personnes: formData.nombre_personnes ? parseInt(formData.nombre_personnes, 10) : 1,
          contenant_prefere: formData.contenant_prefere,
          preference_contact: formData.preference_contact,
          accepte_offres: formData.accepte_offres,
          kiosque_id: profile?.kiosque_id,
        })
        .select('id')
        .single()

      if (insertError) throw insertError
      onDone(data.id)
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Erreur lors de la creation du client.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-[15px] font-semibold text-text">Nouveau client</h1>
        <p className="text-[12px] text-text-secondary">Ajouter un client au kiosque courant.</p>
      </div>

      {error && (
        <div className="rounded-md border border-red/30 bg-red-light p-3 text-[12px] text-red">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Informations de base</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">Nom et prenom</span>
                <FormInput
                  type="text"
                  value={formData.nom_prenom}
                  onChange={(event) => setFormData({ ...formData, nom_prenom: event.target.value })}
                  placeholder="Ex: Fatou Diallo"
                  required
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">Telephone</span>
                <FormInput
                  type="tel"
                  value={formData.telephone}
                  onChange={(event) => setFormData({ ...formData, telephone: event.target.value })}
                  placeholder="Ex: +221 77 123 45 67"
                  required
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">Email</span>
                <FormInput
                  type="email"
                  value={formData.email}
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                  placeholder="email@example.com"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">Localite</span>
                <FormInput
                  type="text"
                  value={formData.localite}
                  onChange={(event) => setFormData({ ...formData, localite: event.target.value })}
                  placeholder="Quartier ou zone"
                />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences client</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">Type</span>
                <FormSelect
                  value={formData.type_client}
                  onChange={(event) => setFormData({ ...formData, type_client: event.target.value })}
                >
                  <option value="Particulier">Particulier</option>
                  <option value="Entreprise">Entreprise</option>
                </FormSelect>
              </label>
              <label className="space-y-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">Nombre de personnes</span>
                <FormInput
                  type="number"
                  min={1}
                  value={formData.nombre_personnes}
                  onChange={(event) => setFormData({ ...formData, nombre_personnes: event.target.value })}
                  placeholder="Ex: 4"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">Contenant prefere</span>
                <FormSelect
                  value={formData.contenant_prefere}
                  onChange={(event) => setFormData({ ...formData, contenant_prefere: event.target.value })}
                >
                  <option value="Bouteille 10L">Bouteille 10L</option>
                  <option value="F 19L">F 19L</option>
                  <option value="Bouteille 11L">Bouteille 11L</option>
                  <option value="Reservoir">Reservoir</option>
                </FormSelect>
              </label>
              <label className="space-y-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">Contact prefere</span>
                <FormSelect
                  value={formData.preference_contact}
                  onChange={(event) => setFormData({ ...formData, preference_contact: event.target.value })}
                >
                  <option value="Telephone">Telephone</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Email">Email</option>
                </FormSelect>
              </label>
            </div>

            <label className="mt-4 flex min-h-11 items-center gap-3 rounded-md bg-muted px-3 text-[12px] text-text">
              <input
                type="checkbox"
                checked={formData.accepte_offres}
                onChange={(event) => setFormData({ ...formData, accepte_offres: event.target.checked })}
                className="h-4 w-4 rounded border-border text-blue"
              />
              Accepte de recevoir des offres ou promotions
            </label>
          </CardContent>
        </Card>

        <div className="sticky bottom-3 grid gap-2 rounded-md border border-border bg-surface p-3 sm:grid-cols-2">
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={loading || !formData.nom_prenom.trim() || !formData.telephone.trim()}
          >
            Creer le client
          </Button>
          <Button type="button" variant="default" onClick={() => onDone('')}>
            Annuler
          </Button>
        </div>
      </form>
    </div>
  )
}
