-- ============================================================================
-- PHASE 16 — Correctifs de production (audit sécurité + intégrité des données)
-- EXÉCUTÉ MANUELLEMENT dans l'éditeur SQL Supabase, en UNE fois, dans l'ordre.
-- Le fichier est rejouable (IF EXISTS / OR REPLACE partout).
-- ============================================================================


-- ── A1. Paniers multi-offres : index d'idempotence composite ──────────────
-- UNIQUE(idempotency_key) seul rejetait la 2e ligne d'un panier (même clé,
-- autre offre) en 23505 → le client concluait « vente déjà enregistrée » et
-- seule la 1re offre était gardée. Composite (clé, offre) : chaque offre du
-- panier est unique, un retry de la MÊME offre reste rejeté.
-- Nouvel index créé AVANT la suppression de l'ancien : aucune fenêtre sans
-- protection anti-doublon. Le nom contient « idempotency » (le client détecte
-- le 23505 d'idempotence sur ce mot, cf. src/lib/saleErrors.ts).
CREATE UNIQUE INDEX IF NOT EXISTS idx_ventes_idempotency_key_offre
  ON public.ventes (idempotency_key, offre_id)
  WHERE idempotency_key IS NOT NULL;

DROP INDEX IF EXISTS public.idx_ventes_idempotency_key;


-- ── A2. Telemetry : colonne route manquante ───────────────────────────────
-- Le client envoie `route` (src/lib/telemetry.ts) ; sans la colonne, chaque
-- batch partait en 400 (PGRST204) et tech_logs restait vide.
ALTER TABLE public.tech_logs ADD COLUMN IF NOT EXISTS route text;


-- ── A3. handle_new_user : plus d'escalade de privilège ────────────────────
-- L'ancien trigger copiait raw_user_meta_data->>'role' (et 'kiosque_id') —
-- données fournies par l'appelant de auth.signUp(), donc par n'importe qui
-- détenant la clé anon. Rôle forcé à 'fontainier', aucun kiosque : c'est
-- l'admin qui applique rôle + kiosque juste après (upsert profiles dans
-- src/lib/userProvisioning.ts, sous la policy profiles_admin_write).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role, kiosque_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    'fontainier',
    NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


-- ── A4. Corbeille : un compte désactivé perd ses droits côté serveur ──────
-- deleted_at était ignoré par toutes les fonctions d'autorisation : un compte
-- « dans la corbeille » gardait l'accès API complet. Chaque helper utilisé par
-- les policies RLS ignore désormais les profils désactivés. Effets transitifs :
--  - is_admin()/is_commercial() → false : plus aucune policy admin/commercial ;
--  - get_my_kiosque_id() → NULL : plus aucune policy fontainier (insert vente,
--    lecture clients…) ;
--  - get_my_role() → NULL : le WITH CHECK de profiles_update_own échoue, donc
--    un compte désactivé ne peut plus effacer son propre deleted_at.
-- La lecture de son propre profil (profiles_read_own) reste permise : l'app
-- voit deleted_at et affiche l'écran « Compte désactivé ».
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'administrateur' AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.is_commercial()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'commercial' AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles
  WHERE id = auth.uid() AND deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_kiosque_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT kiosque_id FROM public.profiles
  WHERE id = auth.uid() AND deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_supervised_kiosques()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ck.kiosque_id
  FROM public.commercials_kiosques ck
  JOIN public.profiles p ON p.id = ck.commercial_id
  WHERE ck.commercial_id = auth.uid() AND p.deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_supervisor_of(p_kiosque_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.commercials_kiosques ck
    JOIN public.profiles p ON p.id = ck.commercial_id
    WHERE ck.commercial_id = auth.uid()
      AND ck.kiosque_id = p_kiosque_id
      AND p.deleted_at IS NULL
  );
$$;
