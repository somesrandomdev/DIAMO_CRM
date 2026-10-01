import { useCallback, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { looksLikePhone, normalizePhone } from '@/lib/phone'
import { supabase } from '@/lib/supabase'
import { logWarn } from '@/lib/telemetry'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * Sign-in only, by phone / identifiant / email.
 *
 * Public self-registration was deliberately removed: this is an internal tool,
 * and an open sign-up form on a public URL let anyone create a working account.
 * Employee accounts are now created by an administrator from
 * Administration > Utilisateurs > "Ajouter un employé", which also assigns the
 * role and kiosk in the same step.
 *
 * A non-email identifier (phone or username) is resolved to the account email
 * by the resolve_login_identifier RPC (DB-side, security definer) before the
 * password check.
 */
export default function Login() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { signIn } = useAuthStore()
  const { showToast } = useToast()

  /**
   * Emails go through as-is; digit-shaped input is normalized so "77 123 45
   * 67" and "771234567" resolve identically; anything else is a username.
   * Returns null (with a toast) when the RPC can't match the identifier.
   */
  const resolveEmail = useCallback(
    async (raw: string): Promise<string | null> => {
      if (raw.includes('@')) return raw.trim().toLowerCase()

      const pIdentifier = looksLikePhone(raw) ? normalizePhone(raw) : raw.trim()

      const { data, error } = await supabase.rpc('resolve_login_identifier', {
        p_identifier: pIdentifier,
      })
      if (error) {
        console.error('resolve_login_identifier failed:', error.code, error.message)
        // The RPC RAISES 'Identifiant non trouvé' when nothing matches — that
        // is a "no account" answer, not a technical failure.
        if (error.code === 'P0001' && error.message.toLowerCase().includes('identifiant')) {
          logWarn('login', 'identifiant non trouvé', { pIdentifier })
          showToast({
            type: 'error',
            title: 'Identifiant non trouvé',
            message:
              'Aucun compte ne correspond à ce numéro ou identifiant. Contactez votre administrateur.',
          })
        } else {
          showToast({
            type: 'error',
            title: 'Connexion impossible',
            message: 'La recherche de votre compte a échoué. Veuillez réessayer.',
          })
        }
        return null
      }

      // Accept the shapes a Postgres function might return: a bare email
      // string, an object, or a single-row table.
      const email =
        typeof data === 'string'
          ? data
          : ((Array.isArray(data) ? data[0] : data)?.email ?? null)

      if (!email) {
        showToast({
          type: 'error',
          title: 'Identifiant non trouvé',
          message:
            'Aucun compte ne correspond à ce numéro ou identifiant. Contactez votre administrateur.',
        })
        return null
      }
      return email
    },
    [showToast]
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError('')

      if (!identifier.trim()) {
        setError('Veuillez saisir votre téléphone, identifiant ou e-mail.')
        return
      }
      if (!password.trim()) {
        setError('Veuillez saisir votre mot de passe.')
        return
      }

      setLoading(true)
      try {
        const email = await resolveEmail(identifier)
        if (!email) {
          setLoading(false)
          return
        }

        // Routed through the store so rate limiting, e-mail validation and
        // profile loading all happen in one place. On success the store sets
        // `profile` and App.tsx swaps to the authenticated routes on its own.
        const result = await signIn(email, password)
        if (!result.success) {
          logWarn('login', 'connexion échouée (mot de passe ou session)', { emailDomain: email.split('@')[1] ?? '' })
          setError(friendlyAuthError(result.error))
        }
      } catch (err: unknown) {
        setError(friendlyAuthError(err instanceof Error ? err.message : undefined))
        console.error('Auth error:', err)
      } finally {
        setLoading(false)
      }
    },
    [identifier, password, resolveEmail, signIn]
  )

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img
            src="/logo-principal.png"
            alt="Diam'o"
            className="mx-auto mb-2 h-20 w-auto object-contain"
          />
          <p className="text-xs text-text-secondary">Client Retention Management</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Connexion</CardTitle>
            <CardDescription>Connectez-vous à votre espace Diam'o</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">Téléphone, identifiant ou email</Label>
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="Ex : 77 123 45 67 ou votre identifiant"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" variant="primary" className="w-full" loading={loading} loadingText="Connexion…">
                Se connecter
              </Button>
            </form>

            <p className="mt-5 text-center text-xs leading-relaxed text-text-secondary">
              Pas encore de compte ? Contactez votre administrateur pour obtenir vos
              identifiants.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * Maps Supabase's English auth errors to plain French.
 * Anything unrecognised falls back to a generic message rather than leaking
 * raw provider text at a non-technical user.
 */
function friendlyAuthError(raw?: string): string {
  if (!raw) return 'Connexion impossible. Veuillez réessayer.'

  const message = raw.toLowerCase()

  if (message.includes('invalid login') || message.includes('invalid credentials')) {
    return 'Identifiant ou mot de passe incorrect.'
  }
  if (message.includes('email not confirmed')) {
    return 'Veuillez confirmer votre e-mail avant de vous connecter.'
  }
  if (message.includes('user not found')) {
    return 'Aucun compte ne correspond à cet identifiant.'
  }
  if (message.includes('rate') || message.includes('trop de tentatives')) {
    return raw // store's rate-limit message is already in French
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Connexion au serveur impossible. Vérifiez votre connexion internet.'
  }
  if (message.includes("format d'email") || message.includes('mot de passe doit')) {
    return raw // already French, from the store's own validation
  }

  return 'Connexion impossible. Veuillez réessayer.'
}
