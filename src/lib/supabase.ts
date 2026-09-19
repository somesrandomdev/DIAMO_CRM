import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { useEnv } from '../utils/env'

/**
 * Supabase client configuration
 * Uses validated environment variables for secure connection
 */
const env = useEnv()

export const supabase: SupabaseClient = createClient(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      storageKey: 'diamo-auth-token',
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'X-Client-Info': 'diamo-apps',
      },
    },
  }
)

/**
 * Helper function to handle Supabase errors consistently
 * @param error - Error object from Supabase
 * @returns User-friendly error message
 */
export function handleSupabaseError(error: any): string {
  if (!error) {
    return 'Une erreur inconnue est survenue'
  }

  // Handle specific Supabase error codes
  switch (error.code) {
    case 'PGRST116':
      return 'Aucune donnée trouvée'
    case '23505':
      return 'Cette donnée existe déjà'
    case '23503':
      return 'Cette donnée est référencée par d\'autres enregistrements'
    case '42501':
      return 'Vous n\'avez pas les permissions nécessaires'
    case 'JWT_EXPIRED':
      return 'Votre session a expiré. Veuillez vous reconnecter.'
    case 'INVALID_REFRESH_TOKEN':
      return 'Session invalide. Veuillez vous reconnecter.'
    default:
      return error.message || 'Une erreur est survenue'
  }
}