import { supabase } from '@/lib/supabase'
import type { Profile } from '@/stores/authStore'

/**
 * Kiosque ids the current user may see, per role:
 * - fontainier: their single assigned kiosque (profiles.kiosque_id)
 * - commercial: the kiosques they supervise via commercials_kiosques —
 *   commercials have no profiles.kiosque_id since the supervisor redesign
 * - administrateur: null, meaning "no filter — everything"
 *
 * Returns [] when the user has no kiosque at all; callers should show an
 * explicit empty state rather than bouncing the user off the page.
 */
export async function resolveKioskScope(profile: Profile | null): Promise<string[] | null> {
  if (!profile) return []
  if (profile.role === 'administrateur') return null
  if (profile.role === 'commercial') {
    const { data, error } = await supabase
      .from('commercials_kiosques')
      .select('kiosque_id')
      .eq('commercial_id', profile.id)
    if (error) {
      console.error('Failed to load supervised kiosques:', error.code, error.message, error.hint)
      return []
    }
    return (data ?? []).map((row) => row.kiosque_id as string)
  }
  return profile.kiosque_id ? [profile.kiosque_id] : []
}
