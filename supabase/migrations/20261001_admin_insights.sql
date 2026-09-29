-- ============================================================================
-- PHASE 13 / CHANTIER C — Insights admin
-- get_admin_insights(p_kiosque_ids uuid[], p_start date, p_end date)
--
-- Contrat de retour (json):
-- {
--   top_offres:  [{offre_id, nom, ca, qty, nb}]                     -- top 5
--   heatmap:     [{dow, hour, ca, nb}]                              -- dow 0=dim, heures avec ventes seulement
--   client_health: {nouveaux, vip, actifs, a_risque, dormants}
--   retention:   {repeat_rate, avg_days_between}
--   growth:      [{week_start, cumulative_clients}]
-- }
--
-- SECURITY DEFINER + guard is_admin(). À exécuter manuellement.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_insights(
  p_kiosque_ids uuid[] DEFAULT NULL,
  p_start date DEFAULT (date_trunc('month', current_date))::date,
  p_end date DEFAULT current_date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_from timestamptz;
  v_to timestamptz;      -- exclusif
  v_cutoff_30 timestamptz;
  v_cutoff_60 timestamptz;
BEGIN
  IF NOT COALESCE(public.is_admin(), false) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  v_from := p_start::timestamptz;
  v_to := (p_end + interval '1 day')::timestamptz;   -- p_end inclus
  v_cutoff_30 := now() - interval '30 days';
  v_cutoff_60 := now() - interval '60 days';

  RETURN json_build_object(

    -- ── Top 5 offres par CA sur la période ─────────────────────────────
    'top_offres', (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.ca DESC), '[]'::json)
      FROM (
        SELECT
          v.offre_id,
          COALESCE(o.nom, 'Offre inconnue') AS nom,
          SUM(v.montant_total) AS ca,
          SUM(v.quantite) AS qty,
          COUNT(*) AS nb
        FROM public.ventes v
        LEFT JOIN public.offres o ON o.id = v.offre_id
        WHERE v.created_at >= v_from
          AND v.created_at < v_to
          AND (p_kiosque_ids IS NULL OR v.kiosque_id = ANY(p_kiosque_ids))
        GROUP BY v.offre_id, o.nom
        ORDER BY ca DESC
        LIMIT 5
      ) t
    ),

    -- ── Heatmap jour × heure (uniquement les créneaux avec ventes) ─────
    'heatmap', (
      SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.dow, t.hour), '[]'::json)
      FROM (
        SELECT
          EXTRACT(DOW FROM v.created_at)::int AS dow,      -- 0 = dimanche
          EXTRACT(HOUR FROM v.created_at)::int AS hour,
          SUM(v.montant_total) AS ca,
          COUNT(*) AS nb
        FROM public.ventes v
        WHERE v.created_at >= v_from
          AND v.created_at < v_to
          AND (p_kiosque_ids IS NULL OR v.kiosque_id = ANY(p_kiosque_ids))
        GROUP BY 1, 2
        HAVING COUNT(*) > 0
      ) t
    ),

    -- ── Santé clients (base scoppée par kiosque) ───────────────────────
    'client_health', (
      SELECT json_build_object(
        'nouveaux', (
          SELECT COUNT(*) FROM public.clients c
          WHERE c.created_at >= v_from AND c.created_at < v_to
            AND (p_kiosque_ids IS NULL OR c.kiosque_id = ANY(p_kiosque_ids))
        ),
        'vip', (
          SELECT COUNT(*) FROM (
            SELECT v.client_id
            FROM public.ventes v
            JOIN public.clients c ON c.id = v.client_id
            WHERE v.created_at >= v_from AND v.created_at < v_to
              AND (p_kiosque_ids IS NULL OR c.kiosque_id = ANY(p_kiosque_ids))
            GROUP BY v.client_id
            HAVING COUNT(*) >= 3
          ) vip
        ),
        'actifs', (
          SELECT COUNT(*) FROM (
            SELECT v.client_id
            FROM public.ventes v
            JOIN public.clients c ON c.id = v.client_id
            WHERE v.created_at >= v_cutoff_30
              AND (p_kiosque_ids IS NULL OR c.kiosque_id = ANY(p_kiosque_ids))
            GROUP BY v.client_id
            HAVING COUNT(*) BETWEEN 1 AND 2
          ) actifs
        ),
        'a_risque', (
          SELECT COUNT(*) FROM public.clients c
          WHERE (p_kiosque_ids IS NULL OR c.kiosque_id = ANY(p_kiosque_ids))
            AND EXISTS (SELECT 1 FROM public.ventes v WHERE v.client_id = c.id)
            AND NOT EXISTS (
              SELECT 1 FROM public.ventes v
              WHERE v.client_id = c.id AND v.created_at >= v_cutoff_30
            )
            AND EXISTS (
              SELECT 1 FROM public.ventes v
              WHERE v.client_id = c.id
                AND v.created_at >= v_cutoff_60 AND v.created_at < v_cutoff_30
            )
        ),
        'dormants', (
          SELECT COUNT(*) FROM public.clients c
          WHERE (p_kiosque_ids IS NULL OR c.kiosque_id = ANY(p_kiosque_ids))
            AND EXISTS (SELECT 1 FROM public.ventes v WHERE v.client_id = c.id)
            AND NOT EXISTS (
              SELECT 1 FROM public.ventes v
              WHERE v.client_id = c.id AND v.created_at >= v_cutoff_60
            )
        )
      )
    ),

    -- ── Rétention (clients avec >= 2 achats période) ───────────────────
    'retention', (
      SELECT json_build_object(
        'repeat_rate', COALESCE((
          SELECT ROUND(
            100.0 * COUNT(*) FILTER (WHERE nb >= 2) / GREATEST(COUNT(*), 1)
          )::int
          FROM (
            SELECT v.client_id, COUNT(*) AS nb
            FROM public.ventes v
            JOIN public.clients c ON c.id = v.client_id
            WHERE v.created_at >= v_from AND v.created_at < v_to
              AND (p_kiosque_ids IS NULL OR c.kiosque_id = ANY(p_kiosque_ids))
            GROUP BY v.client_id
          ) per_client
        ), 0),
        'avg_days_between', COALESCE((
          SELECT ROUND(AVG(gap)::numeric, 1)::float
          FROM (
            SELECT
              v.client_id,
              v.created_at - LAG(v.created_at) OVER (PARTITION BY v.client_id ORDER BY v.created_at) AS gap
            FROM public.ventes v
            JOIN public.clients c ON c.id = v.client_id
            WHERE v.created_at >= v_from AND v.created_at < v_to
              AND (p_kiosque_ids IS NULL OR c.kiosque_id = ANY(p_kiosque_ids))
          ) gaps
          WHERE gap IS NOT NULL
        ), 0)
      )
    ),

    -- ── Croissance: clients cumulés par semaine sur la période ─────────
    'growth', (
      SELECT COALESCE(json_agg(row_to_json(g) ORDER BY g.week_start), '[]'::json)
      FROM (
        SELECT
          d.week_start,
          (
            SELECT COUNT(*) FROM public.clients c
            WHERE c.created_at < (d.week_start + interval '7 days')
              AND (p_kiosque_ids IS NULL OR c.kiosque_id = ANY(p_kiosque_ids))
          ) AS cumulative_clients
        FROM generate_series(
          date_trunc('week', v_from)::date,
          date_trunc('week', v_to - interval '1 day')::date,
          interval '7 days'
        ) AS d(week_start)
      ) g
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_admin_insights(uuid[], date, date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_insights(uuid[], date, date) TO authenticated;

COMMENT ON FUNCTION public.get_admin_insights(uuid[], date, date) IS
  'Insights admin: top offres, heatmap jour×heure, santé clients, rétention, croissance cumulée. p_kiosque_ids NULL = tous.';
