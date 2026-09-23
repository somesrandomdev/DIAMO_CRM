-- ============================================================================
-- Phase 10 — filtres admin sur get_admin_dashboard_stats.
--
-- ÉTAT ACTUEL : la fonction live a été créée manuellement (elle n'est pas
-- dans les migrations du repo). Sa signature documentée est
--   get_admin_dashboard_stats(p_month_start date, p_prev_start date, p_last30_start date)
--   -> { current: [{kiosque_id, offre_id, ca, nb, qty, clients}],
--        previous: [{kiosque_id, ca}], daily: [{day, ca}] }  (clés NULL si vide)
-- et elle refuse les non-admins avec 'Unauthorized: Admin access required'.
--
-- CETTE MIGRATION remplace la fonction en conservant la signature (3 premiers
-- paramètres identiques, valeurs de retour identiques) et ajoute :
--   p_kiosque_ids uuid[] DEFAULT NULL   -- NULL = tous les kiosques
--
-- Si le corps de votre fonction live diffère (calculs spécifiques), fusionnez
-- le filtre `p_kiosque_ids` dans VOTRE corps plutôt que d'exécuter celui-ci.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(
  p_month_start date,
  p_prev_start date,
  p_last30_start date,
  p_kiosque_ids uuid[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN (
    SELECT json_build_object(
      -- current: agrégat par (kiosque, offre) sur le mois courant
      'current', (
        SELECT json_agg(json_build_object(
          'kiosque_id', v.kiosque_id,
          'offre_id', v.offre_id,
          'ca', SUM(v.montant_total),
          'nb', COUNT(*),
          'qty', SUM(v.quantite),
          'clients', COUNT(DISTINCT v.client_id)
        ))
        FROM public.ventes v
        WHERE v.created_at >= p_month_start::timestamptz
          AND v.created_at < (p_month_start + INTERVAL '1 month')::timestamptz
          AND (p_kiosque_ids IS NULL OR v.kiosque_id = ANY(p_kiosque_ids))
      ),
      -- previous: agrégat par kiosque sur le mois précédent
      'previous', (
        SELECT json_agg(json_build_object(
          'kiosque_id', v.kiosque_id,
          'ca', SUM(v.montant_total)
        ))
        FROM public.ventes v
        WHERE v.created_at >= p_prev_start::timestamptz
          AND v.created_at < p_month_start::timestamptz
          AND (p_kiosque_ids IS NULL OR v.kiosque_id = ANY(p_kiosque_ids))
      ),
      -- daily: recette par jour (fenêtre glissante, toujours 30 jours)
      'daily', (
        SELECT json_agg(json_build_object(
          'day', d.day,
          'ca', d.ca
        ) ORDER BY d.day)
        FROM (
          SELECT (v.created_at AT TIME ZONE 'UTC')::date AS day,
                 SUM(v.montant_total) AS ca
          FROM public.ventes v
          WHERE v.created_at >= p_last30_start::timestamptz
            AND (p_kiosque_ids IS NULL OR v.kiosque_id = ANY(p_kiosque_ids))
          GROUP BY 1
        ) d
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_dashboard_stats(date, date, date, uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats(date, date, date, uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_admin_dashboard_stats(date, date, date, uuid[]) IS
  'Stats admin (CA par kiosque/offre, mois courant vs précédent, tendance 30j). p_kiosque_ids NULL = tous les kiosques.';
