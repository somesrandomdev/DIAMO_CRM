// Edge Function: admin-delete-user
// Supprime définitivement un utilisateur (profil + compte auth + junctions)
// Déploiement : Dashboard Supabase → Edge Functions → Create
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont auto-injectées (pas de secret à ajouter)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // Vérification des variables d'environnement
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error('Variables d\'environnement manquantes')
      return json({ error: 'Configuration serveur invalide' }, 500)
    }

    // Admin client (service role) : contourne RLS pour les opérations destructives
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 1. Authentifier le caller via son JWT
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

    // 2. Vérifier que le caller est un administrateur ACTIF (un admin mis à la
    //    corbeille garde une session valide jusqu'à expiration, mais n'a plus
    //    aucun droit)
    const { data: callerProfile, error: callerError } = await adminClient
      .from('profiles')
      .select('role, username, deleted_at')
      .eq('id', callerId)
      .single()
    if (
      callerError ||
      !callerProfile ||
      callerProfile.role !== 'administrateur' ||
      callerProfile.deleted_at !== null
    ) {
      return json({ error: 'Accès refusé' }, 403)
    }

    // 3. Récupérer l'utilisateur cible
    const body = await req.json()
    const { userId } = body
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

    // 4. Suppression du profil EN PREMIER — si FK violation (23503) on s'arrête
    //    sans rien supprimer (atomicité : soit tout passe, soit rien n'est touché)
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

    // 5. Cleanup des junctions commercials_kiosques (safe maintenant que le profil est supprimé)
    const { error: junctionError } = await adminClient
      .from('commercials_kiosques')
      .delete()
      .eq('commercial_id', userId)
    if (junctionError) {
      // Le profil est déjà supprimé — on log pour cleanup manuel
      await adminClient.from('audit_logs').insert({
        actor_id: callerId,
        action: 'user.permanent_delete_junction_orphan',
        entity_type: 'profiles',
        entity_id: userId,
        details: { username, junction_error: junctionError.message },
      })
    }

    // 6. Suppression du compte auth
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)
    if (authError) {
      // Le profil est déjà supprimé, l'utilisateur ne peut plus se connecter
      // mais son compte auth reste — on log ce cas partiel
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

    // 7. Audit de succès (actor = l'admin appelant)
    await adminClient.from('audit_logs').insert({
      actor_id: callerId,
      action: 'user.permanent_delete',
      entity_type: 'profiles',
      entity_id: userId,
      details: { username },
    })

    console.log(`Admin ${callerProfile.username} a supprimé définitivement ${username} (${userId})`)

    return json({ success: true, username })
  } catch (caught) {
    console.error('admin-delete-user crashed:', caught)
    return json({ error: 'Erreur serveur', details: String(caught) }, 500)
  }
})
