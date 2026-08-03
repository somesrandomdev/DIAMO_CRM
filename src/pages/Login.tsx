import { useCallback, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'

export default function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { signIn } = useAuthStore()

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError('')
      setSuccess('')

      if (!email.trim()) {
        setError('Veuillez saisir votre adresse e-mail.')
        return
      }
      if (!password.trim()) {
        setError('Veuillez saisir votre mot de passe.')
        return
      }
      if (isRegister && !username.trim()) {
        setError("Veuillez saisir un nom d'utilisateur.")
        return
      }
      if (password.length < 6) {
        setError('Le mot de passe doit contenir au moins 6 caractères.')
        return
      }

      setLoading(true)
      try {
        if (isRegister) {
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { username } },
          })
          if (signUpError) throw signUpError

          setIsRegister(false)
          setPassword('')
          setSuccess('Compte créé avec succès ! Vous pouvez maintenant vous connecter.')
        } else {
          // Route through the store so rate limiting, e-mail validation and
          // profile loading all happen in one place. On success the store sets
          // `profile`, and App.tsx swaps to the authenticated routes on its own
          // — no manual redirect or page reload needed.
          const result = await signIn(email, password)
          if (!result.success) {
            setError(friendlyAuthError(result.error))
          }
        }
      } catch (err: unknown) {
        setError(friendlyAuthError(err instanceof Error ? err.message : undefined))
        console.error('Auth error:', err)
      } finally {
        setLoading(false)
      }
    },
    [email, password, username, isRegister, signIn]
  )

  const toggleMode = useCallback(() => {
    setIsRegister((prev) => !prev)
    setError('')
    setSuccess('')
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img
            src="/logo-principal.png"
            alt="Diam'o"
            className="mx-auto mb-2 h-20 w-auto object-contain"
          />
          <p className="text-[12px] text-text-secondary">Client Retention Management</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {isRegister ? 'Créer un compte' : 'Connexion'}
            </CardTitle>
            <CardDescription>
              {isRegister
                ? 'Créez votre compte pour accéder à la plateforme'
                : "Connectez-vous à votre espace Diam'o"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-2">
                  <Label htmlFor="username">Nom d'utilisateur</Label>
                  <Input
                    id="username"
                    placeholder="Votre nom d'utilisateur"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="votre.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  placeholder="Minimum 6 caractères"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {/* Large, unmissable success banner — replaces the old blocking
                  alert(), which non-technical users often dismissed without
                  reading. role="status" announces it to screen readers. */}
              {success && (
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-md border-2 border-green bg-green-light p-4"
                >
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-green" aria-hidden="true" />
                  <p className="text-[14px] font-semibold leading-snug text-green">{success}</p>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" variant="primary" className="w-full" loading={loading}>
                {isRegister ? 'Créer le compte' : 'Se connecter'}
              </Button>

              <div className="text-center">
                <Button type="button" variant="default" onClick={toggleMode}>
                  {isRegister ? "J'ai déjà un compte" : 'Créer un compte'}
                </Button>
              </div>
            </form>
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
    return 'E-mail ou mot de passe incorrect.'
  }
  if (message.includes('email not confirmed')) {
    return 'Veuillez confirmer votre e-mail avant de vous connecter.'
  }
  if (message.includes('user not found')) {
    return 'Aucun compte ne correspond à cet e-mail.'
  }
  if (message.includes('already registered') || message.includes('already exists')) {
    return 'Un compte existe déjà avec cet e-mail.'
  }
  if (message.includes('rate') || message.includes('trop de tentatives')) {
    return raw // store's rate-limit message is already in French
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Connexion au serveur impossible. Vérifiez votre connexion internet.'
  }
  if (message.includes("format d'email")) {
    return raw
  }

  return 'Connexion impossible. Veuillez réessayer.'
}
