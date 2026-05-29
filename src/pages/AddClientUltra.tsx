import { useState } from 'react'
import { supabase, handleSupabaseError } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { BackButton, LogoutButton } from '../components/NavControls'

export default function AddClientUltra({ onDone }: { onDone: (newId: string) => void }) {
  const { profile } = useAuthStore()
  const [formData, setFormData] = useState({
    nom_prenom: '',
    telephone: '',
    email: '',
    localite: '',
    type_client: '',
    nombre_personnes: '',
    contenant_prefere: '',
    preference_contact: '',
    accepte_offres: false
  })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.nom_prenom.trim() || !formData.telephone.trim()) {
      alert('Veuillez remplir les champs obligatoires (Nom et prénom, Téléphone)')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          nom: formData.nom_prenom.trim(),
          telephone: formData.telephone.trim(),
          email: formData.email.trim() || null,
          localite: formData.localite.trim(),
          type_client: formData.type_client,
          nombre_personnes: formData.nombre_personnes ? parseInt(formData.nombre_personnes) : null,
          contenant_prefere: formData.contenant_prefere,
          preference_contact: formData.preference_contact,
          accepte_offres: formData.accepte_offres,
          kiosque_id: profile?.kiosque_id
        })
        .select('id')
        .single()

      if (error) throw error

      onDone(data.id)
    } catch (error: any) {
      alert('Erreur lors de la création du client: ' + handleSupabaseError(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto" style={{ padding: 'var(--spacing-lg)' }}>
      <div className="flex justify-between mb-6">
        <BackButton onBack={() => onDone('')} />
        <LogoutButton />
      </div>

      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>👤 Nouveau client</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>Ajouter un nouveau client à votre kiosque</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations de base */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            Informations de base
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                Nom et prénom *
              </label>
              <input
                type="text"
                value={formData.nom_prenom}
                onChange={(e) => setFormData({ ...formData, nom_prenom: e.target.value })}
                placeholder="Ex: Dupont Jean"
                required
                className="w-full p-3 text-base rounded-lg font-medium transition-all"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-primary)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(28, 126, 214, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                Téléphone *
              </label>
              <input
                type="tel"
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                placeholder="Ex: +221 77 123 45 67"
                required
                className="w-full p-3 text-base rounded-lg font-medium transition-all"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-primary)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(28, 126, 214, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="votre.email@example.com"
                className="w-full p-3 text-base rounded-lg font-medium transition-all"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-primary)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(28, 126, 214, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                Localité/Quartier
              </label>
              <input
                type="text"
                value={formData.localite}
                onChange={(e) => setFormData({ ...formData, localite: e.target.value })}
                placeholder="Ex: Dakar, Plateau"
                className="w-full p-3 text-base rounded-lg font-medium transition-all"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-primary)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(28, 126, 214, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>
          </div>
        </div>

        {/* Préférences client */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            Préférences client
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                Type de client
              </label>
              <select
                value={formData.type_client}
                onChange={(e) => setFormData({ ...formData, type_client: e.target.value })}
                className="w-full p-3 text-base rounded-lg font-medium transition-all"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-primary)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(28, 126, 214, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border)'
                  e.target.style.boxShadow = 'none'
                }}
              >
                <option value="">Sélectionner...</option>
                <option value="Particulier">Particulier</option>
                <option value="Entreprise">Entreprise</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                Nombre de personnes
              </label>
              <input
                type="number"
                min="1"
                value={formData.nombre_personnes}
                onChange={(e) => setFormData({ ...formData, nombre_personnes: e.target.value })}
                placeholder="Ex: 4"
                className="w-full p-3 text-base rounded-lg font-medium transition-all"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-primary)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(28, 126, 214, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                Contenant préféré
              </label>
              <select
                value={formData.contenant_prefere}
                onChange={(e) => setFormData({ ...formData, contenant_prefere: e.target.value })}
                className="w-full p-3 text-base rounded-lg font-medium transition-all"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-primary)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(28, 126, 214, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border)'
                  e.target.style.boxShadow = 'none'
                }}
              >
                <option value="">Sélectionner...</option>
                <option value="Bouteille 10L">Bouteille 10L</option>
                <option value="F 19L">F 19L</option>
                <option value="Bouteille 11L">Bouteille 11L</option>
                <option value="Réservoir">Réservoir</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>
                Préférence de contact
              </label>
              <select
                value={formData.preference_contact}
                onChange={(e) => setFormData({ ...formData, preference_contact: e.target.value })}
                className="w-full p-3 text-base rounded-lg font-medium transition-all"
                style={{
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-primary)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(28, 126, 214, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--color-border)'
                  e.target.style.boxShadow = 'none'
                }}
              >
                <option value="">Sélectionner...</option>
                <option value="Téléphone">Téléphone</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">Email</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="accepte_offres"
              checked={formData.accepte_offres}
              onChange={(e) => setFormData({ ...formData, accepte_offres: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="accepte_offres" className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Souhaitez-vous recevoir des offres ou promotions ?
            </label>
          </div>
        </div>

        <div className="pt-4 space-y-3">
          <button
            type="submit"
            disabled={loading || !formData.nom_prenom.trim() || !formData.telephone.trim()}
            className="w-full py-4 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md text-lg"
            style={{
              backgroundColor: 'var(--color-success)',
              color: 'white',
              opacity: (loading || !formData.nom_prenom.trim() || !formData.telephone.trim()) ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading && formData.nom_prenom.trim() && formData.telephone.trim()) e.currentTarget.style.backgroundColor = 'var(--color-primary)'
            }}
            onMouseLeave={(e) => {
              if (!loading && formData.nom_prenom.trim() && formData.telephone.trim()) e.currentTarget.style.backgroundColor = 'var(--color-success)'
            }}
          >
            {loading ? 'Création...' : 'Créer le client'}
          </button>

          <button
            type="button"
            onClick={() => onDone('')}
            className="w-full py-3 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md"
            style={{
              backgroundColor: 'var(--color-secondary)',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-secondary)'
            }}
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}