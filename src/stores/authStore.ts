import { create } from 'zustand'
import { supabase, handleSupabaseError } from '@/lib/supabase'
import { validateEmail } from '@/utils/validation'
import { RateLimiter } from '@/utils/security'

/**
 * Type definitions for authentication
 */
export type UserRole = 'fontainier' | 'commercial' | 'administrateur'

export interface Kiosk {
  id: string
  nom: string
}

export interface Profile {
  id: string
  username: string
  email?: string
  phone?: string
  role: UserRole
  kiosque_id?: string | null
  kiosques?: { nom: string }
  created_at?: string
  updated_at?: string
}

export interface User {
  id: string
  email?: string
  created_at?: string
}

interface AuthStore {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  loadProfile: () => Promise<void>
}

// Rate limiter for login attempts (5 attempts per minute)
const loginRateLimiter = new RateLimiter(5, 60000)

/**
 * Creates a new profile row for a freshly-registered internal staff member.
 * Returns the created profile, or null if the insert fails.
 *
 * Kept as a module-level helper so loadProfile stays readable.
 */
async function createProfileForUser(user: { id: string; email?: string }): Promise<Profile | null> {
  const username = user.email?.split('@')[0] || 'nouveau'

  const { error } = await supabase.from('profiles').insert({
    id: user.id,
    username,
    role: 'fontainier',
    kiosque_id: null,
  })

  if (error) {
    console.error('Auto-profile creation failed:', error)
    return null
  }

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  return (data as Profile | null) ?? null
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  profile: null,
  isLoading: false,

  signIn: async (email: string, password: string) => {
    set({ isLoading: true })

    try {
      // Validate email format
      const validatedEmail = validateEmail(email)
      if (!validatedEmail) {
        set({ isLoading: false })
        return { success: false, error: "Format d'email invalide" }
      }

      // Check rate limiting
      if (loginRateLimiter.isRateLimited(validatedEmail)) {
        set({ isLoading: false })
        const remaining = loginRateLimiter.getRemainingAttempts(validatedEmail)
        return {
          success: false,
          error: `Trop de tentatives. Réessayez dans une minute. (${remaining} tentatives restantes)`,
        }
      }

      // Validate password
      if (!password || password.length < 6) {
        set({ isLoading: false })
        return { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères' }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: validatedEmail,
        password,
      })

      if (error) {
        set({ isLoading: false })
        return { success: false, error: handleSupabaseError(error) }
      }

      // Reset rate limiter on successful login
      loginRateLimiter.reset(validatedEmail)

      set({ user: data.user, isLoading: false })

      // Load profile after successful sign in
      await get().loadProfile()

      return { success: true }
    } catch (error: unknown) {
      set({ isLoading: false })
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de la connexion'
      return {
        success: false,
        error: errorMessage,
      }
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut()
      set({ user: null, profile: null, isLoading: false })
    } catch (error: unknown) {
      console.error('Sign out error:', error)
      // Force clear state even if sign out fails
      set({ user: null, profile: null, isLoading: false })
    }
  },

  loadProfile: async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        set({ user: null, profile: null })
        return
      }

      // maybeSingle() returns { data: null, error: null } for "no row", so a
      // missing profile is not reported as an error. Only real failures
      // (network, RLS rejection) land in `error`.
      const { data: existing, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Error loading profile:', error)
        set({ user: null, profile: null })
        return
      }

      // ── Frictionless onboarding ──────────────────────────────────────
      // New internal staff have an Auth account but no profile row yet. We
      // create one on first sign-in so an admin never has to pre-provision.
      // Kept deliberately silent: no toast, no intermediate state — the user
      // just lands on their dashboard.
      const profile = existing ?? (await createProfileForUser(user))

      if (!profile) {
        set({ user: null, profile: null })
        return
      }

      // Resolve the kiosk name for the header/profile page. A failure here is
      // non-fatal: the app is fully usable without the label.
      if (profile.kiosque_id) {
        const { data: kiosk } = await supabase
          .from('kiosques')
          .select('nom')
          .eq('id', profile.kiosque_id)
          .maybeSingle()

        if (kiosk) profile.kiosques = { nom: kiosk.nom }
      }

      set({ user, profile })
    } catch (error) {
      console.error('Error in loadProfile:', error)
      set({ user: null, profile: null })
    }
  },
}))
