import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Génération de mot de passe avec garantie de caractères
function generatePassword(length = 12): string {
  const charsets = {
    uppercase: "ABCDEFGHJKLMNPQRSTUVWXYZ",
    lowercase: "abcdefghijkmnopqrstuvwxyz",
    digits: "23456789",
    special: "!@#$%",
  };
  
  const allChars = Object.values(charsets).join("");
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  
  let password = "";
  
  // Garantir au moins un caractère de chaque type
  const requiredChars = [
    charsets.uppercase[randomValues[0] % charsets.uppercase.length],
    charsets.lowercase[randomValues[1] % charsets.lowercase.length],
    charsets.digits[randomValues[2] % charsets.digits.length],
    charsets.special[randomValues[3] % charsets.special.length],
  ];
  
  password = requiredChars.join("");
  
  // Remplir le reste aléatoirement
  for (let i = 4; i < length; i++) {
    password += allChars[randomValues[i] % allChars.length];
  }
  
  // Mélanger les caractères
  return password.split("").sort(() => Math.random() - 0.5).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // Vérification stricte des variables d'environnement
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Variables d'environnement manquantes");
      return new Response(
        JSON.stringify({ error: "Configuration serveur invalide" }),
        { status: 500, headers: jsonHeaders }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Vérification de l'authentification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Token d'authentification manquant" }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } =
      await supabaseAdmin.auth.getUser(token);
    
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Token invalide ou expiré" }),
        { status: 401, headers: jsonHeaders }
      );
    }

    // 2. Vérification du rôle administrateur (un admin mis à la corbeille
    //    n'a plus aucun droit, même avec une session encore valide)
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, deleted_at")
      .eq("id", caller.id)
      .single();

    if (
      profileError ||
      callerProfile?.role !== "administrateur" ||
      callerProfile?.deleted_at !== null
    ) {
      return new Response(
        JSON.stringify({ error: "Accès administrateur requis" }),
        { status: 403, headers: jsonHeaders }
      );
    }

    // 3. Lecture des paramètres
    const body = await req.json();
    const { userId, newPassword } = body;
    
    if (!userId || typeof userId !== "string") {
      return new Response(
        JSON.stringify({ error: "userId requis et doit être une chaîne" }),
        { status: 400, headers: jsonHeaders }
      );
    }

    // Compte cible désactivé (corbeille) : pas de réinitialisation — elle lui
    // redonnerait des identifiants valides. Le restaurer d'abord.
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("deleted_at")
      .eq("id", userId)
      .maybeSingle();

    if (targetError || !targetProfile) {
      return new Response(
        JSON.stringify({ error: "Utilisateur introuvable" }),
        { status: 404, headers: jsonHeaders }
      );
    }
    if (targetProfile.deleted_at !== null) {
      return new Response(
        JSON.stringify({ error: "Ce compte est désactivé" }),
        { status: 410, headers: jsonHeaders }
      );
    }

    // 4. Utilisation du mot de passe fourni ou génération
    const finalPassword = newPassword || generatePassword();

    // 5. Reset du mot de passe via Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin
      .updateUserById(userId, { password: finalPassword });
    
    if (updateError) {
      console.error("Erreur update password:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: jsonHeaders }
      );
    }

    // 6. Mise à jour du flag avec vérification d'erreur
    const { error: flagError } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", userId);
    
    if (flagError) {
      console.error("Erreur update flag:", flagError);
      // Le mot de passe est déjà changé, on log l'erreur mais on continue
      return new Response(
        JSON.stringify({ 
          success: true,
          warning: "Mot de passe changé mais impossible de forcer le changement à la prochaine connexion",
          newPassword: newPassword ? undefined : finalPassword,
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // Logging pour l'audit
    console.log(`Admin ${caller.email} a réinitialisé le mot de passe de ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        newPassword: newPassword ? undefined : finalPassword,
      }),
      { status: 200, headers: jsonHeaders }
    );
    
  } catch (err) {
    console.error("Erreur non gérée:", err);
    return new Response(
      JSON.stringify({ error: "Erreur interne du serveur" }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
