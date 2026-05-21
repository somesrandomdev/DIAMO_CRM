-- Diam'o CRM professional dashboard support
-- Role values: fontainier | commercial | administrateur

CREATE OR REPLACE VIEW public.admin_dashboard_summary AS
SELECT
  k.id AS kiosque_id,
  k.nom AS kiosque_nom,
  DATE_TRUNC('day', v.created_at)::date AS jour,
  COUNT(v.id) AS nb_ventes,
  COALESCE(SUM(v.montant_total), 0) AS ca_jour,
  COALESCE(SUM(o.volume_ml * v.quantite), 0) / 1000.0 AS litres_jour,
  COUNT(DISTINCT v.client_id) AS clients_uniques
FROM public.ventes v
JOIN public.kiosques k ON k.id = v.kiosque_id
JOIN public.offres o ON o.id = v.offre_id
GROUP BY k.id, k.nom, DATE_TRUNC('day', v.created_at)::date;

REVOKE ALL ON public.admin_dashboard_summary FROM anon, authenticated;
GRANT SELECT ON public.admin_dashboard_summary TO authenticated;

CREATE INDEX IF NOT EXISTS idx_ventes_kiosque_date ON public.ventes (kiosque_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ventes_client ON public.ventes (client_id);
CREATE INDEX IF NOT EXISTS idx_clients_kiosque ON public.clients (kiosque_id);

ALTER TABLE public.ventes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offres_kiosque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_profile_kiosque_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT kiosque_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE TABLE IF NOT EXISTS public.objectifs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kiosque_id uuid NOT NULL REFERENCES public.kiosques(id) ON DELETE CASCADE,
  mois date NOT NULL,
  ca_cible integer NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT objectifs_pkey PRIMARY KEY (id),
  CONSTRAINT objectifs_kiosque_mois_unique UNIQUE (kiosque_id, mois)
);

ALTER TABLE public.objectifs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_admin_alerts()
RETURNS TABLE (type text, kiosque_nom text, message text, severity text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH is_admin AS (
    SELECT public.current_profile_role() = 'administrateur' AS allowed
  ),
  month_sales AS (
    SELECT offre_id, COUNT(*) AS nb
    FROM public.ventes
    WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
    GROUP BY offre_id
  ),
  month_total AS (
    SELECT COUNT(*) AS total
    FROM public.ventes
    WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
  )
  SELECT
    'inactif_today'::text,
    k.nom,
    'Aucune vente enregistree aujourd''hui',
    'warning'
  FROM public.kiosques k, is_admin
  WHERE is_admin.allowed
    AND NOT EXISTS (
      SELECT 1
      FROM public.ventes v
      WHERE v.kiosque_id = k.id
        AND v.created_at::date = CURRENT_DATE
    )

  UNION ALL

  SELECT
    'inactif_48h'::text,
    k.nom,
    'Aucune vente depuis 48 heures',
    'danger'
  FROM public.kiosques k, is_admin
  WHERE is_admin.allowed
    AND NOT EXISTS (
      SELECT 1
      FROM public.ventes v
      WHERE v.kiosque_id = k.id
        AND v.created_at >= NOW() - INTERVAL '48 hours'
    )

  UNION ALL

  SELECT
    'offre_sous_perf'::text,
    o.nom,
    'Moins de 5% des ventes ce mois',
    'info'
  FROM public.offres o
  JOIN month_sales stats ON stats.offre_id = o.id
  CROSS JOIN month_total totals
  CROSS JOIN is_admin
  WHERE is_admin.allowed
    AND totals.total > 0
    AND stats.nb::float / totals.total < 0.05;
$$;

DROP POLICY IF EXISTS "administrateur_read_all_ventes" ON public.ventes;
CREATE POLICY "administrateur_read_all_ventes" ON public.ventes
  FOR SELECT TO authenticated
  USING (
    public.current_profile_role() = 'administrateur'
  );

DROP POLICY IF EXISTS "user_read_own_kiosque_ventes" ON public.ventes;
CREATE POLICY "user_read_own_kiosque_ventes" ON public.ventes
  FOR SELECT TO authenticated
  USING (
    kiosque_id = public.current_profile_kiosque_id()
    OR public.current_profile_role() = 'administrateur'
  );

DROP POLICY IF EXISTS "administrateur_read_all_clients" ON public.clients;
CREATE POLICY "administrateur_read_all_clients" ON public.clients
  FOR SELECT TO authenticated
  USING (
    public.current_profile_role() = 'administrateur'
  );

DROP POLICY IF EXISTS "user_read_own_kiosque_clients" ON public.clients;
CREATE POLICY "user_read_own_kiosque_clients" ON public.clients
  FOR SELECT TO authenticated
  USING (
    kiosque_id = public.current_profile_kiosque_id()
    OR public.current_profile_role() = 'administrateur'
  );

DROP POLICY IF EXISTS "administrateur_manage_offres" ON public.offres;
CREATE POLICY "administrateur_manage_offres" ON public.offres
  FOR ALL TO authenticated
  USING (public.current_profile_role() = 'administrateur')
  WITH CHECK (public.current_profile_role() = 'administrateur');

DROP POLICY IF EXISTS "administrateur_manage_offres_kiosque" ON public.offres_kiosque;
CREATE POLICY "administrateur_manage_offres_kiosque" ON public.offres_kiosque
  FOR ALL TO authenticated
  USING (public.current_profile_role() = 'administrateur')
  WITH CHECK (public.current_profile_role() = 'administrateur');

DROP POLICY IF EXISTS "administrateur_manage_profiles" ON public.profiles;
CREATE POLICY "administrateur_manage_profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.current_profile_role() = 'administrateur')
  WITH CHECK (public.current_profile_role() = 'administrateur');

DROP POLICY IF EXISTS "user_read_own_profile" ON public.profiles;
CREATE POLICY "user_read_own_profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "administrateur_manage_objectifs" ON public.objectifs;
CREATE POLICY "administrateur_manage_objectifs" ON public.objectifs
  FOR ALL TO authenticated
  USING (public.current_profile_role() = 'administrateur')
  WITH CHECK (public.current_profile_role() = 'administrateur');

DROP POLICY IF EXISTS "user_read_own_objectifs" ON public.objectifs;
CREATE POLICY "user_read_own_objectifs" ON public.objectifs
  FOR SELECT TO authenticated
  USING (
    kiosque_id = public.current_profile_kiosque_id()
    OR public.current_profile_role() = 'administrateur'
  );
