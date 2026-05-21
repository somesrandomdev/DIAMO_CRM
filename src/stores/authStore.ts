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
  address?: string
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
  isAuthenticated: () => boolean
  hasRole: (role: UserRole) => boolean
}

// Rate limiter for login attempts (5 attempts per minute)
const loginRateLimiter = new RateLimiter(5, 60000)

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

      let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error || !profile) {
        // Fallback: create profile manually
        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          username: user.email?.split('@')[0] || 'nouveau',
          role: 'fontainier',
          kiosque_id: null,
        })

        if (insertError) {
          console.error('Profile creation error:', insertError)
          set({ user: null, profile: null })
          return
        }

        // Re-fetch profile
        const { data: fresh } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (fresh) {
          // Load kiosk information for new profile
          if (fresh.kiosque_id) {
            try {
              const { data: kioskData } = await supabase
                .from('kiosques')
                .select('nom')
                .eq('id', fresh.kiosque_id)
                .single()

              if (kioskData) {
                fresh.kiosques = { nom: kioskData.nom }
              }
            } catch (kioskError) {
              console.error('Error loading kiosk data:', kioskError)
            }
          }

          set({ user, profile: fresh })
        } else {
          set({ user: null, profile: null })
        }
        return
      }

      // Load kiosk information separately if needed
      if (profile.kiosque_id) {
        try {
          const { data: kioskData } = await supabase
            .from('kiosques')
            .select('nom')
            .eq('id', profile.kiosque_id)
            .single()

          if (kioskData) {
            profile.kiosques = { nom: kioskData.nom }
          }
        } catch (kioskError) {
          console.error('Error loading kiosk data:', kioskError)
          // Continue without kiosk data
        }
      }

      // For admin users, we don't enforce kiosk_id requirement
      if (profile.role === 'administrateur' && !profile.kiosque_id) {
        console.log('Admin user loaded with global access (no kiosk restriction)')
      }

      set({ user, profile })
    } catch (error) {
      console.error('Error in loadProfile:', error)
      set({ user: null, profile: null })
    }
  },

  isAuthenticated: () => {
    const { user, profile } = get()
    return user !== null && profile !== null
  },

  hasRole: (role: UserRole) => {
    const { profile } = get()
    return profile?.role === role
  },
}))
