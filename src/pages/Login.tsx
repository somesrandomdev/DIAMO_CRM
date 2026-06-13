import { useState, useCallback } from 'react'
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

  const { loadProfile } = useAuthStore()

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Basic validation
    if (!email.trim()) {
      setError('Email manquant')
      return
    }
    if (!password.trim()) {
      setError('Mot de passe manquant')
      return
    }
    if (isRegister && !username.trim()) {
      setError("Nom d'utilisateur manquant")
      return
    }
    if (password.length < 6) {
      setError('6 caractères minimum pour le mot de passe')
      return
    }

    setLoading(true)
    try {
      if (isRegister) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username, role: 'fontainier' },
          },
        })
        if (signUpError) throw signUpError
        setError('')
        setIsRegister(false)
        // Show success message
        alert('Compte créé ! Vérifiez votre e-mail ou connectez-vous.')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError

        // Load profile and wait for it to complete
        await loadProfile()

        // Add a small delay to ensure state is updated
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 500)
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      // User-friendly messages
      if (errorMessage.includes('Invalid login')) {
        setError('Identifiants incorrects')
      } else if (errorMessage.includes('Email not confirmed')) {
        setError('Confirmez votre e-mail')
      } else if (errorMessage.includes('User not found')) {
        setError('Aucun compte trouvé avec cet email')
      } else if (errorMessage.includes('Wrong password')) {
        setError('Mot de passe incorrect')
      } else {
        setError(errorMessage)
      }
      console.error('Supabase error:', err)
    } finally {
      setLoading(false)
    }
  }, [email, password, username, isRegister, loadProfile])

  const toggleMode = useCallback(() => {
    setIsRegister((prev) => !prev)
    setError('')
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 text-center">
          <img
            src="/logo-principal.png"
            alt="Diam'o"
            className="mx-auto mb-2 h-20 w-auto object-contain"
          />
          <p className="text-[12px] text-text-secondary">Client Retention Management</p>
        </div>

        {/* Form Card */}
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
                  placeholder="Minimum 6 caractères"
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

              <Button type="submit" variant="primary" className="w-full" loading={loading}>
                {loading
                  ? 'Chargement...'
                  : isRegister
                    ? 'Créer le compte'
                    : 'Se connecter'}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="default"
                  onClick={toggleMode}
                >
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
