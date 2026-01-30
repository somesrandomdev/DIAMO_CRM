import { useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import { FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt, FaSave, FaEdit, FaShieldAlt, FaTrashAlt } from 'react-icons/fa'

interface ProfileData {
  username: string
  email?: string
  phone?: string
  address?: string
  role: string
  kiosques?: { nom: string }
}

export default function ProfilePage() {
  const { profile } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<ProfileData>({
    username: profile?.username || '',
    email: profile?.email || '',
    phone: '',
    address: '',
    role: profile?.role || '',
    kiosques: profile?.kiosques
  })

  const handleSave = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: formData.username,
          email: formData.email,
          phone: formData.phone,
          address: formData.address
        })
        .eq('id', profile?.id)

      if (error) throw error

      alert('Profil mis à jour avec succès!')
      setIsEditing(false)
    } catch (error: any) {
      console.error('Error updating profile:', error)
      alert('Erreur lors de la mise à jour: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'fontainier': return 'Fontainier'
      case 'commercial': return 'Commercial'
      case 'administrateur': return 'Administrateur'
      default: return role
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'fontainier': return 'bg-green-100 text-green-800'
      case 'commercial': return 'bg-blue-100 text-blue-800'
      case 'administrateur': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>Mon Profil</h1>
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
      </div>

      {/* Profile Card */}
      <div className="card p-0 overflow-hidden">
        {/* Profile Header */}
        <div 
          className="px-6 py-6 border-b"
          style={{ 
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
            borderColor: 'var(--color-border)'
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center icon-enhanced" style={{ backgroundColor: 'var(--color-surface)' }}>
                <FaUser className="w-8 h-8 icon-enhanced" style={{ color: 'var(--color-primary)' }} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{profile?.username}</h2>
                <span 
                  className={`px-3 py-1 rounded-full text-sm font-medium inline-block ${getRoleColor(profile?.role || '')}`}
                >
                  {getRoleDisplayName(profile?.role || '')}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="btn btn-secondary flex items-center gap-2"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-surface)'
              }}
            >
              <FaEdit className="w-4 h-4" />
              {isEditing ? 'Annuler' : 'Modifier'}
            </button>
          </div>
        </div>

        {/* Profile Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Basic Information */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 border-b pb-2" style={{ 
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-border)'
                }}>
                  📋 Informations de base
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="form-label">
                      Nom d'utilisateur
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="form-input w-full"
                        placeholder="Votre nom d'utilisateur"
                      />
                    ) : (
                      <div className="kpi-card">
                        <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{profile?.username}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="form-label">
                      Email
                    </label>
                    {isEditing ? (
                      <div className="relative">
                        <FaEnvelope className="absolute left-3 top-3 icon-enhanced" style={{ color: 'var(--color-text-secondary)' }} />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="form-input w-full pl-10"
                          placeholder="votre.email@example.com"
                        />
                      </div>
                    ) : (
                      <div className="kpi-card flex items-center gap-3">
                        <FaEnvelope className="w-5 h-5 icon-enhanced" style={{ color: 'var(--color-primary)' }} />
                        <span style={{ color: 'var(--color-text)' }}>{profile?.email || 'Non défini'}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="form-label">
                      Téléphone
                    </label>
                    {isEditing ? (
                      <div className="relative">
                        <FaPhone className="absolute left-3 top-3 icon-enhanced" style={{ color: 'var(--color-text-secondary)' }} />
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="form-input w-full pl-10"
                          placeholder="+225 XX XX XX XX"
                        />
                      </div>
                    ) : (
                      <div className="kpi-card flex items-center gap-3">
                        <FaPhone className="w-5 h-5 icon-enhanced" style={{ color: 'var(--color-primary)' }} />
                        <span style={{ color: 'var(--color-text)' }}>{formData.phone || 'Non défini'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Professional Information */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 border-b pb-2" style={{ 
                  color: 'var(--color-text)',
                  borderColor: 'var(--color-border)'
                }}>
                  💼 Informations professionnelles
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="form-label">
                      Rôle
                    </label>
                    <div className="kpi-card flex items-center gap-3">
                      <span 
                        className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(profile?.role || '')}`}
                      >
                        {getRoleDisplayName(profile?.role || '')}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        (Non modifiable)
                      </span>
                    </div>
                  </div>

                  {profile?.kiosques && (
                    <div>
                      <label className="form-label">
                        Kiosque assigné
                      </label>
                      <div className="kpi-card flex items-center gap-3">
                        <FaMapMarkerAlt className="w-5 h-5 icon-enhanced" style={{ color: 'var(--color-primary)' }} />
                        <span style={{ color: 'var(--color-text)' }}>{profile.kiosques.nom}</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="form-label">
                      Adresse
                    </label>
                    {isEditing ? (
                      <div className="relative">
                        <FaMapMarkerAlt className="absolute left-3 top-3 icon-enhanced" style={{ color: 'var(--color-text-secondary)' }} />
                        <textarea
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          className="form-input w-full pl-10"
                          placeholder="Votre adresse complète"
                          rows={3}
                        />
                      </div>
                    ) : (
                      <div className="kpi-card flex items-start gap-3">
                        <FaMapMarkerAlt className="w-5 h-5 icon-enhanced mt-1" style={{ color: 'var(--color-primary)' }} />
                        <span style={{ color: 'var(--color-text)' }}>{formData.address || 'Non définie'}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Account Statistics */}
          <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--color-border)' }}>
            <h3 className="text-lg font-semibold mb-6" style={{ color: 'var(--color-text)' }}>
              📊 Statistiques du compte
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="kpi-card text-center">
                <div className="kpi-value" style={{ color: 'var(--color-primary)' }}>0</div>
                <div className="kpi-label">Ventes totales</div>
              </div>
              <div className="kpi-card text-center">
                <div className="kpi-value" style={{ color: 'var(--color-success)' }}>0 CFA</div>
                <div className="kpi-label">Chiffre d'affaires</div>
              </div>
              <div className="kpi-card text-center">
                <div className="kpi-value" style={{ color: 'var(--color-accent)' }}>0</div>
                <div className="kpi-label">Clients actifs</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="btn"
                style={{
                  backgroundColor: 'var(--color-text-secondary)',
                  color: 'white'
                }}
                disabled={loading}
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="btn btn-primary flex items-center gap-2"
              >
                <FaSave className="w-4 h-4" />
                {loading ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Security Section */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
          <FaShieldAlt className="w-5 h-5 icon-enhanced" style={{ color: 'var(--color-primary)' }} />
          Sécurité du compte
        </h3>
        <div className="space-y-6">
          <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--color-primary-light)' }}>
            <h4 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>🔐 Changer le mot de passe</h4>
            <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Pour des raisons de sécurité, la modification du mot de passe doit être faite via l'authentification Supabase.
            </p>
            <button
              onClick={() => alert('Fonctionnalité à implémenter - Redirection vers la page de réinitialisation de mot de passe')}
              className="btn"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'white'
              }}
            >
              Réinitialiser le mot de passe
            </button>
          </div>

          <div className="p-4 rounded-lg border-2" style={{ borderColor: 'var(--color-error)', backgroundColor: 'rgba(250, 82, 82, 0.05)' }}>
            <h4 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--color-error)' }}>
              <FaTrashAlt className="w-4 h-4" />
              Zone de danger
            </h4>
            <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              Supprimer définitivement votre compte. Cette action est irréversible.
            </p>
            <button
              onClick={() => {
                if (confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.')) {
                  alert('Fonctionnalité à implémenter - Suppression de compte')
                }
              }}
              className="btn"
              style={{
                backgroundColor: 'var(--color-error)',
                color: 'white'
              }}
            >
              Supprimer le compte
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}