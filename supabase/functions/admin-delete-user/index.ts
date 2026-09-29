// Edge Function: admin-delete-user
// Déploiement: supabase functions deploy admin-delete-user --project-ref <ref>
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont auto-injectées.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Admin client (service role): bypasses RLS for the destructive steps.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 1. Authenticate the caller from their JWT.
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    if (!jwt) {
      return json({ error: 'Jeton manquant' }, 401)
    }
    const { data: userData, error: userError } = await adminClient.auth.getUser(jwt)
    if (userError || !userData.user) {
      return json({ error: 'Session invalide' }, 401)
    }
    const callerId = userData.user.id

    // 2. Verify the caller is an administrator.
    const { data: callerProfile, error: callerError } = await adminClient
      .from('profiles')
      .select('role, username')
      .eq('id', callerId)
      .single()
    if (callerError || !callerProfile || callerProfile.role !== 'administrateur') {
      return json({ error: 'Accès refusé' }, 403)
    }

    // 3. Target user.
    const { userId } = await req.json()
    if (!userId || typeof userId !== 'string') {
      return json({ error: 'userId requis' }, 400)
    }
    if (userId === callerId) {
      return json({ error: 'Impossible de supprimer son propre compte' }, 400)
    }

    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle()
    const username = targetProfile?.username ?? null

    // 4. Cleanup: junction rows are supervisor grants, never wanted orphaned.
    const { error: junctionError } = await adminClient
      .from('commercials_kiosques')
      .delete()
      .eq('commercial_id', userId)
    if (junctionError) {
      return json({ error: 'Nettoyage des affectations impossible', details: junctionError.message }, 409)
    }

    // 5. Delete the profile row FIRST: any other FK pointing at profiles
    //    surfaces here as 23503 -> 409 with the constraint detail, and we
    //    delete NOTHING (the junction cleanup is harmless to keep).
    const { error: profileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', userId)
    if (profileError) {
      const code = (profileError as { code?: string }).code ?? ''
      if (code === '23503') {
        return json(
          {
            error: 'Suppression bloquée : cet utilisateur est encore référencé',
            details: profileError.message,
            constraint: (profileError as { constraint?: string }).constraint ?? null,
          },
          409
        )
      }
      return json({ error: 'Suppression du profil impossible', details: profileError.message }, 500)
    }

    // 6. Delete the auth account (after the profile row succeeded).
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)
    if (authError) {
      // Profile is gone; without the auth account the user cannot sign in.
      // Surface it so the admin knows cleanup is partial.
      await adminClient.from('audit_logs').insert({
        actor_id: callerId,
        action: 'user.permanent_delete_partial',
        entity_type: 'profiles',
        entity_id: userId,
        details: { username, auth_error: authError.message },
      })
      return json(
        { error: 'Profil supprimé mais compte auth restant', details: authError.message },
        500
      )
    }

    // 7. Audit (actor = the calling admin).
    await adminClient.from('audit_logs').insert({
      actor_id: callerId,
      action: 'user.permanent_delete',
      entity_type: 'profiles',
      entity_id: userId,
      details: { username },
    })

    return json({ success: true, username })
  } catch (caught) {
    console.error('admin-delete-user crashed:', caught)
    return json({ error: 'Erreur serveur', details: String(caught) }, 500)
  }
})

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
