-- ============================================================================
-- Filtre par kiosque(s) sur get_admin_dashboard_stats.
-- EXÉCUTÉ MANUELLEMENT EN BASE — ce fichier est la référence de ce qui tourne.
--
-- On CRÉE d'abord la version 4 args (surcharge), puis on SUPPRIME l'ancienne
-- 3 args. Si la création échoue, l'ancienne survit (ordre sécurisé).
-- ============================================================================

-- 1) Nouvelle version : 3 args identiques + p_kiosque_ids (NULL = tous)
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(
  p_month_start date,
  p_prev_start date,
  p_last30_start date,
  p_kiosque_ids uuid[] DEFAULT NULL
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean;
  v_current json;
  v_previous json;
  v_daily json;
BEGIN
  -- 1. Contrôle d'accès admin
  v_is_admin := public.is_admin();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- 2. Période courante (par kiosque + offre) + filtre kiosques
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO v_current
  FROM (
    SELECT
      kiosque_id,
      offre_id,
      SUM(montant_total) AS ca,
      COUNT(*) AS nb,
      SUM(quantite) AS qty
    FROM public.ventes
    WHERE created_at >= p_month_start
      AND (p_kiosque_ids IS NULL OR kiosque_id = ANY(p_kiosque_ids))
    GROUP BY kiosque_id, offre_id
  ) t;

  -- 3. Période précédente (par kiosque, avec nb pour le delta) + filtre
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO v_previous
  FROM (
    SELECT
      kiosque_id,
      SUM(montant_total) AS ca,
      COUNT(*) AS nb
    FROM public.ventes
    WHERE created_at >= p_prev_start AND created_at < p_month_start
      AND (p_kiosque_ids IS NULL OR kiosque_id = ANY(p_kiosque_ids))
    GROUP BY kiosque_id
  ) t;

  -- 4. Tendance quotidienne (30 derniers jours) + filtre
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO v_daily
  FROM (
    SELECT
      created_at::date AS day,
      SUM(montant_total) AS ca,
      COUNT(*) AS nb
    FROM public.ventes
    WHERE created_at >= p_last30_start
      AND (p_kiosque_ids IS NULL OR kiosque_id = ANY(p_kiosque_ids))
    GROUP BY created_at::date
    ORDER BY day
  ) t;

  -- 5. Retour JSON identique à avant
  RETURN json_build_object(
    'current', v_current,
    'previous', v_previous,
    'daily', v_daily
  );
END;
$function$;

-- 2) Supprimer l'ancienne version 3 args (pour que les appels à 3 args
--    basculent sur la nouvelle avec p_kiosque_ids = NULL par défaut)
DROP FUNCTION IF EXISTS public.get_admin_dashboard_stats(date, date, date);

-- 3) Droits d'exécution
REVOKE ALL ON FUNCTION public.get_admin_dashboard_stats(date, date, date, uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats(date, date, date, uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_admin_dashboard_stats(date, date, date, uuid[]) IS
  'Stats admin (CA par kiosque/offre, mois courant vs précédent, tendance 30j). p_kiosque_ids NULL = tous les kiosques.';
