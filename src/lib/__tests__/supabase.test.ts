// Mock env utility before importing supabase
jest.mock('../../utils/env', () => ({
  useEnv: () => ({
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'anon-key',
  })
}))

// We have to unmock supabase first because setupTests.ts mocks it globally
jest.unmock('../supabase')

import { handleSupabaseError } from '../supabase'

describe('handleSupabaseError', () => {
  it('returns default message for null or undefined error', () => {
    expect(handleSupabaseError(null)).toBe('Une erreur inconnue est survenue')
    expect(handleSupabaseError(undefined)).toBe('Une erreur inconnue est survenue')
  })

  describe('PostgREST errors', () => {
    it('handles PGRST116 (No data found)', () => {
      expect(handleSupabaseError({ code: 'PGRST116' })).toBe('Aucune donnée trouvée')
    })

    it('handles 23505 (Unique violation)', () => {
      expect(handleSupabaseError({ code: '23505' })).toBe('Cette donnée existe déjà')
    })

    it('handles 23503 (Foreign key violation)', () => {
      expect(handleSupabaseError({ code: '23503' })).toBe('Cette donnée est référencée par d\'autres enregistrements')
    })

    it('handles 42501 (Insufficient privileges)', () => {
      expect(handleSupabaseError({ code: '42501' })).toBe('Vous n\'avez pas les permissions nécessaires')
    })
  })

  describe('Auth errors', () => {
    it('handles security enumeration errors consistently', () => {
      expect(handleSupabaseError({ message: 'Invalid login credentials' })).toBe('Identifiants incorrects')
      expect(handleSupabaseError({ message: 'User not found in system' })).toBe('Identifiants incorrects')
      expect(handleSupabaseError({ message: 'Wrong password provided' })).toBe('Identifiants incorrects')
    })

    it('handles JWT_EXPIRED', () => {
      expect(handleSupabaseError({ code: 'JWT_EXPIRED' })).toBe('Votre session a expiré. Veuillez vous reconnecter.')
    })

    it('handles INVALID_REFRESH_TOKEN', () => {
      expect(handleSupabaseError({ code: 'INVALID_REFRESH_TOKEN' })).toBe('Session invalide. Veuillez vous reconnecter.')
    })
  })

  describe('Fallback behaviors', () => {
    it('returns error.message if available for unknown codes', () => {
      const customError = { code: 'UNKNOWN_CODE', message: 'Erreur personnalisée' }
      expect(handleSupabaseError(customError)).toBe('Erreur personnalisée')
    })

    it('returns error.message if no code is provided', () => {
      const customError = { message: 'Une erreur réseau est survenue' }
      expect(handleSupabaseError(customError)).toBe('Une erreur réseau est survenue')
    })

    it('returns default message if empty object is provided', () => {
      expect(handleSupabaseError({})).toBe('Une erreur est survenue')
    })

    it('returns default message for unknown codes without message', () => {
      expect(handleSupabaseError({ code: 'WEIRD_CODE' })).toBe('Une erreur est survenue')
    })
  })
})
