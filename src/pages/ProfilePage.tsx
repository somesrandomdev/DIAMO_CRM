import { useState, type ReactNode } from 'react'
import { Edit, Mail, MapPin, Phone, Save, Shield, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormInput } from '@/components/ui/form-input'
import { StatusBadge } from '@/components/ui/status-badge'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface ProfileData {
  username: string
  email?: string
  phone?: string
  address?: string
}

const roleLabels: Record<string, string> = {
  fontainier: 'Fontainier',
  commercial: 'Commercial',
  administrateur: 'Administrateur',
}

function roleVariant(role?: string) {
  if (role === 'administrateur') return 'info'
  if (role === 'commercial') return 'success'
  return 'warning'
}

export default function ProfilePage() {
  const { profile, loadProfile } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [formData, setFormData] = useState<ProfileData>({
    username: profile?.username || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    address: profile?.address || '',
  })

  const handleSave = async () => {
    setLoading(true)
    setMessage('')
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: formData.username,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
        })
        .eq('id', profile?.id)

      if (error) throw error

      await loadProfile()
      setMessage('Profil mis a jour.')
      setIsEditing(false)
    } catch (caught: unknown) {
      setMessage(caught instanceof Error ? caught.message : 'Erreur lors de la mise a jour.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-text">Mon profil</h1>
          <p className="text-[12px] text-text-secondary">Informations du compte et affectation courante.</p>
        </div>
        <Button type="button" variant="default" size="sm" onClick={() => setIsEditing((current) => !current)}>
          <Edit className="h-4 w-4" />
          {isEditing ? 'Annuler' : 'Modifier'}
        </Button>
      </div>

      {message && (
        <div className="rounded-md border border-border bg-surface p-3 text-[12px] text-text-secondary">
          {message}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-light text-blue">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <CardTitle>{profile?.username || 'Utilisateur'}</CardTitle>
              <div className="mt-1">
                <StatusBadge variant={roleVariant(profile?.role)}>
                  {roleLabels[profile?.role || ''] || profile?.role || 'Role inconnu'}
                </StatusBadge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-[12px] font-semibold text-text">Informations de base</h2>
              <label className="block space-y-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">Nom utilisateur</span>
                {isEditing ? (
                  <FormInput
                    value={formData.username}
                    onChange={(event) => setFormData({ ...formData, username: event.target.value })}
                  />
                ) : (
                  <ReadonlyLine icon={<User className="h-4 w-4" />} value={profile?.username || 'Non defini'} />
                )}
              </label>

              <label className="block space-y-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">Email</span>
                {isEditing ? (
                  <FormInput
                    type="email"
                    value={formData.email}
                    onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                  />
                ) : (
                  <ReadonlyLine icon={<Mail className="h-4 w-4" />} value={profile?.email || 'Non defini'} />
                )}
              </label>

              <label className="block space-y-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">Telephone</span>
                {isEditing ? (
                  <FormInput
                    type="tel"
                    value={formData.phone}
                    onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                  />
                ) : (
                  <ReadonlyLine icon={<Phone className="h-4 w-4" />} value={profile?.phone || 'Non defini'} />
                )}
              </label>
            </div>

            <div className="space-y-3">
              <h2 className="text-[12px] font-semibold text-text">Affectation</h2>
              <ReadonlyLine icon={<Shield className="h-4 w-4" />} value={roleLabels[profile?.role || ''] || 'Role inconnu'} />
              <ReadonlyLine icon={<MapPin className="h-4 w-4" />} value={profile?.kiosques?.nom || 'Aucun kiosque assigne'} />

              <label className="block space-y-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">Adresse</span>
                {isEditing ? (
                  <FormInput
                    value={formData.address}
                    onChange={(event) => setFormData({ ...formData, address: event.target.value })}
                  />
                ) : (
                  <ReadonlyLine icon={<MapPin className="h-4 w-4" />} value={profile?.address || 'Non definie'} />
                )}
              </label>
            </div>
          </div>

          {isEditing && (
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="primary" onClick={handleSave} loading={loading}>
                <Save className="h-4 w-4" />
                Sauvegarder
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ReadonlyLine({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-md bg-muted px-3 text-[12px] text-text">
      <span className="text-blue">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  )
}
