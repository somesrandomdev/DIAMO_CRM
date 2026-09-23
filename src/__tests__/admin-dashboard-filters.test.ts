/**
 * LIVE verification of the admin dashboard kiosque filter — requires real
 * credentials, so it SKIPS unless they are provided on the command line:
 *
 * VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... \
 * SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... \
 * npx jest admin-dashboard-filters
 *
 * No credentials live in the repo. Proves that RPC results for one kiosque
 * differ from "all kiosques" and contain only the requested kiosque.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL_ENV = process.env.VITE_SUPABASE_URL
const KEY_ENV = process.env.VITE_SUPABASE_ANON_KEY
const EMAIL = process.env.SMOKE_ADMIN_EMAIL
const PASSWORD = process.env.SMOKE_ADMIN_PASSWORD

const maybe = URL_ENV && KEY_ENV && EMAIL && PASSWORD ? it : it.skip

describe('Filtres admin (live RPC)', () => {
  let supabase: SupabaseClient

  beforeAll(async () => {
    supabase = createClient(URL_ENV!, KEY_ENV!)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: EMAIL!,
      password: PASSWORD!,
    })
    if (error || !data.session) throw new Error(`admin login failed: ${error?.message}`)
    await supabase.auth.setSession(data.session)
  })

  maybe('renvoie des stats différentes pour un kiosque filtré', async () => {
    const args = {
      p_month_start: '2000-01-01',
      p_prev_start: '2000-01-01',
      p_last30_start: '2000-01-01',
    }

    const tous = await supabase.rpc('get_admin_dashboard_stats', {
      ...args,
      p_kiosque_ids: null,
    })
    expect(tous.error).toBeNull()

    // Pick any real kiosque, then ask for it alone.
    const { data: kiosques } = await supabase.from('kiosques').select('id').limit(1)
    const kiosqueId = (kiosques ?? [])[0]?.id
    expect(kiosqueId).toBeTruthy()

    const un = await supabase.rpc('get_admin_dashboard_stats', {
      ...args,
      p_kiosque_ids: [kiosqueId],
    })
    expect(un.error).toBeNull()

    const current = (tous.data as { current: Array<{ kiosque_id: string }> }).current ?? []
    const currentFiltered = (un.data as { current: Array<{ kiosque_id: string }> }).current ?? []

    // Every current-bucket row must belong to the filtered kiosque.
    expect(currentFiltered.every((row) => row.kiosque_id === kiosqueId)).toBe(true)

    // And the two payloads must not be identical (the filter actually filters).
    expect(JSON.stringify(un.data)).not.toBe(JSON.stringify(tous.data))

    console.log(
      'Tous kiosques:',
      current.length,
      'lignes current | Un kiosque:',
      currentFiltered.length,
      'ligne(s), kiosque',
      kiosqueId
    )
  }, 30000)
})
