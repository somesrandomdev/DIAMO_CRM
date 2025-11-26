import { useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import { BackButton, LogoutButton } from '../components/NavControls'
import { FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt, FaSave, FaEdit } from 'react-icons/fa'

interface ProfileData {
  username: string
  email?: string
  phone?: string
  address?: string
  role: string
  kiosques?: { nom: string }
}

export default function ProfilePage({ onBack }: { onBack: () => void }) {
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
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <BackButton onBack={onBack} />
        <LogoutButton />
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                <FaUser className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{profile?.username}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(profile?.role || '')}`}>
                  {getRoleDisplayName(profile?.role || '')}
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              <FaEdit className="w-4 h-4" />
              {isEditing ? 'Annuler' : 'Modifier'}
            </button>
          </div>
        </div>

        {/* Profile Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-2">
                Informations de base
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom d'utilisateur
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 py-2">{profile?.username}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                {isEditing ? (
                  <div className="relative">
                    <FaEnvelope className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="votre.email@example.com"
                    />
                  </div>
                ) : (
                  <p className="text-gray-900 py-2">{profile?.email || 'Non défini'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone
                </label>
                {isEditing ? (
                  <div className="relative">
                    <FaPhone className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+225 XX XX XX XX"
                    />
                  </div>
                ) : (
                  <p className="text-gray-900 py-2">{formData.phone || 'Non défini'}</p>
                )}
              </div>
            </div>

            {/* Work Information */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800 border-b border-gray-200 pb-2">
                Informations professionnelles
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rôle
                </label>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(profile?.role || '')}`}>
                    {getRoleDisplayName(profile?.role || '')}
                  </span>
                  <span className="text-gray-500 text-sm">
                    (Non modifiable)
                  </span>
                </div>
              </div>

              {profile?.kiosques && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kiosque assigné
                  </label>
                  <div className="flex items-center gap-2">
                    <FaMapMarkerAlt className="text-gray-400" />
                    <span className="text-gray-900">{profile.kiosques.nom}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse
                </label>
                {isEditing ? (
                  <div className="relative">
                    <FaMapMarkerAlt className="absolute left-3 top-3 text-gray-400" />
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Votre adresse complète"
                      rows={3}
                    />
                  </div>
                ) : (
                  <p className="text-gray-900 py-2">{formData.address || 'Non définie'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Account Statistics */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Statistiques du compte
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-blue-600">0</p>
                <p className="text-sm text-gray-600">Ventes totales</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">0 CFA</p>
                <p className="text-sm text-gray-600">Chiffre d'affaires</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-purple-600">0</p>
                <p className="text-sm text-gray-600">Clients actifs</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {isEditing && (
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-6 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={loading}
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 flex items-center gap-2"
              >
                <FaSave className="w-4 h-4" />
                {loading ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-white rounded-lg shadow-sm border mt-6 p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Sécurité du compte
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-700 mb-2">Changer le mot de passe</h3>
            <p className="text-sm text-gray-600 mb-3">
              Pour des raisons de sécurité, la modification du mot de passe doit être faite via l'authentification Supabase.
            </p>
            <button
              onClick={() => alert('Fonctionnalité à implémenter - Redirection vers la page de réinitialisation de mot de passe')}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm"
            >
              Réinitialiser le mot de passe
            </button>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <h3 className="font-medium text-red-700 mb-2">Zone de danger</h3>
            <p className="text-sm text-gray-600 mb-3">
              Supprimer définitivement votre compte. Cette action est irréversible.
            </p>
            <button
              onClick={() => {
                if (confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.')) {
                  alert('Fonctionnalité à implémenter - Suppression de compte')
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm"
            >
              Supprimer le compte
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}