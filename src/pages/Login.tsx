import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'

export default function Login() {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { loadProfile } = useAuthStore()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    /* BASIC VALIDATION */
    if (!email.trim()) return setError('Email manquant')
    if (!password.trim()) return setError('Mot de passe manquant')
    if (isRegister && !username.trim()) return setError('Nom d\'utilisateur manquant')
    if (password.length < 6) return setError('6 caractères minimum pour le mot de passe')

    setLoading(true)
    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username, role: 'fontainier' },
          },
        })
        if (error) throw error
        alert('Compte créé ! Vérifiez votre e-mail ou connectez-vous.')
        setIsRegister(false)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error

        // Load profile and wait for it to complete
        await loadProfile()

        // Add a small delay to ensure state is updated
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 500)
      }
    } catch (err: any) {
      /* user-friendly messages */
      const msg = err.message || 'Erreur inconnue'
      if (msg.includes('Invalid login')) setError('Identifiants incorrects')
      else if (msg.includes('Email not confirmed')) setError('Confirmez votre e-mail')
      else if (msg.includes('User not found')) setError('Aucun compte trouvé avec cet email')
      else if (msg.includes('Wrong password')) setError('Mot de passe incorrect')
      else setError(msg)
      console.error('Supabase error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--color-background)', padding: 'var(--spacing-lg)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--color-primary)' }}>Diam'o</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Client Retention Management</p>
        </div>

        {/* Form Card */}
        <div className="p-8 rounded-lg shadow-lg border" style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <h2 className="text-2xl font-bold text-center mb-6" style={{ color: 'var(--color-text)' }}>
            {isRegister ? 'Créer un compte' : 'Connexion'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                  Nom d'utilisateur
                </label>
                <input
                  id="username"
                  placeholder="Votre nom d'utilisateur"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-3 rounded-lg font-medium transition-all"
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
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="votre.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                className="w-full p-3 rounded-lg font-medium transition-all"
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
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                placeholder="Minimum 6 caractères"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 rounded-lg font-medium transition-all"
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
                required
              />
            </div>

            {error && (
              <div
                className="px-4 py-3 rounded-lg border"
                role="alert"
                aria-live="assertive"
                style={{
                  backgroundColor: 'var(--color-error)',
                  borderColor: 'var(--color-error)',
                  color: 'white'
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full py-3 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                opacity: loading ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = 'var(--color-primary-dark)'
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = 'var(--color-primary)'
              }}
            >
              {loading ? 'Chargement...' : isRegister ? 'Créer le compte' : 'Se connecter'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister)
                  setError('')
                }}
                className="px-6 py-3 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  border: '2px solid var(--color-border)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)'
                  e.currentTarget.style.color = 'var(--color-primary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                  e.currentTarget.style.color = 'var(--color-text)'
                }}
              >
                {isRegister ? 'J\'ai déjà un compte' : 'Créer un compte'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}