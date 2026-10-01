import { useEffect, useState, type ReactNode } from 'react'
import { Copy, Check } from 'lucide-react'
import {
  CheckCircle2,
  Edit,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  User,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormInput } from '@/components/ui/form-input'
import { StatusBadge } from '@/components/ui/status-badge'
import { APP_BUILD } from '@/lib/build'
import { normalizePhone } from '@/lib/phone'
import { fetchServedBuild } from '@/lib/build'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface ProfileData {
  username: string
  email?: string
  phone?: string
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
  const [buildCopied, setBuildCopied] = useState(false)
  const [servedBuild, setServedBuild] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  /**
   * Feedback carries its own kind so success and failure are visually distinct.
   * The previous single `message` string rendered both in the same neutral grey
   * box, which made a failed save look identical to a successful one.
   */
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  useEffect(() => {
    void fetchServedBuild().then(setServedBuild)
  }, [])

  const [formData, setFormData] = useState<ProfileData>({
    username: profile?.username || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
  })

  const handleSave = async () => {
    if (!formData.username.trim()) {
      setFeedback({ kind: 'error', text: "Le nom d'utilisateur ne peut pas être vide." })
      return
    }

    setLoading(true)
    setFeedback(null)
    try {
      const { error } = await supabase
        .from('profiles')
        // NOTE: profiles has no 'address' column — sending one fails the
        // whole update with PGRST204 (schema cache).
        .update({
          username: formData.username.trim(),
          email: formData.email,
          // Normalized digits: profiles_phone_unique compares this format,
          // and it doubles as a login identifier.
          phone: normalizePhone(formData.phone) || null,
        })
        .eq('id', profile?.id)

      if (error) throw error

      await loadProfile()
      setFeedback({ kind: 'success', text: 'Profil mis à jour avec succès' })
      setIsEditing(false)
    } catch (caught) {
      console.error('Profile update failed:', caught)
      const code = (caught as { code?: string } | null)?.code
      setFeedback({
        kind: 'error',
        text:
          code === '23505'
            ? 'Ce numéro est déjà utilisé par un autre compte.'
            : 'Une erreur est survenue lors de la sauvegarde',
      })
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

      {feedback && (
        <div
          role="status"
          className={
            feedback.kind === 'success'
              ? 'flex items-start gap-3 rounded-md border-2 border-green bg-green-light p-4'
              : 'flex items-start gap-3 rounded-md border-2 border-red bg-red-light p-4'
          }
        >
          {feedback.kind === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green" aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red" aria-hidden="true" />
          )}
          <p
            className={
              feedback.kind === 'success'
                ? 'text-[14px] font-semibold leading-snug text-green'
                : 'text-[14px] font-semibold leading-snug text-red'
            }
          >
            {feedback.text}
          </p>
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

      <Card>
        <CardHeader>
          <CardTitle>Système</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary">
                Version de l'application
              </p>
              <p className="mt-0.5 font-mono text-[13px] font-semibold text-text">{servedBuild ?? APP_BUILD}</p>
            </div>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(servedBuild ?? APP_BUILD)
                  setBuildCopied(true)
                  window.setTimeout(() => setBuildCopied(false), 2000)
                } catch {
                  // Copie bloquée: la version reste visible à l'écran.
                }
              }}
            >
              {buildCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {buildCopied ? 'Copié' : 'Copier'}
            </Button>
          </div>
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
