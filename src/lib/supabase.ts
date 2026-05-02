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

  const msg = error.message || ''
  if (
    msg.includes('Invalid login') ||
    msg.includes('User not found') ||
    msg.includes('Wrong password')
  ) {
    return 'Identifiants incorrects'
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

/**
 * Type-safe query builder helper
 * Provides type safety for common Supabase queries
 */
export async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  errorMessage: string = 'Erreur lors de la requête'
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await queryFn()
    
    if (error) {
      return {
        data: null,
        error: handleSupabaseError(error),
      }
    }

    return { data, error: null }
  } catch (error: any) {
    console.error('Query error:', error)
    return {
      data: null,
      error: error.message || errorMessage,
    }
  }
}

/**
 * Retry wrapper for Supabase queries with exponential backoff
 * @param queryFn - Query function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param delay - Initial delay in ms (default: 1000)
 */
export async function retryQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<{ data: T | null; error: string | null }> {
  let lastError: string | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await safeQuery(queryFn)
    
    if (!result.error) {
      return result
    }

    lastError = result.error

    // Don't retry on authentication errors
    if (result.error.includes('session') || result.error.includes('auth')) {
      return result
    }

    // Exponential backoff
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)))
    }
  }

  return { data: null, error: lastError }
}