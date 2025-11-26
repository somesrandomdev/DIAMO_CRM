// src/stores/authStore.ts
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

type AuthStore = {
  user: any
  profile: any
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  loadProfile: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  profile: null,

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    set({ user: data.user })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },

  loadProfile: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        set({ user: null, profile: null })
        return
      }

      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!profile) {
        // fallback : on crée le profil manuellement
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

        // re-fetch
        const { data: fresh } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (fresh) {
          // Load kiosk information for the new profile
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
}))