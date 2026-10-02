-- Pages Clients par kiosque, Performance, Rapports, Supervision : calculs
-- en base, résultats paginés.
--
-- Avant : chaque page téléchargeait les lignes brutes (toutes les ventes,
-- tous les clients) et agrégeait dans le navigateur. PostgREST plafonne une
-- requête à 1 000 lignes : au-delà, CA et compteurs devenaient FAUX sans
-- erreur, et le volume transféré grandissait avec le réseau.
--
-- Après : chaque fonction agrège côté Postgres et renvoie UN json
-- { total, totals|counts, rows } (une seule ligne : pas de plafond), avec
-- recherche, tri et pagination côté serveur.
--
-- Périmètre (SECURITY DEFINER + contrôle explicite, comme get_admin_*) :
-- administrateur = tous les kiosques ; commercial = ses kiosques supervisés ;
-- autres rôles = rien.
--
-- Additif : aucune table ni fonction existante modifiée. Idempotent.

-- ── Périmètre de l'appelant ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.scoped_kiosque_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT k.id
  FROM public.kiosques k
  WHERE public.is_admin()
     OR (public.is_commercial() AND k.id IN (SELECT public.get_my_supervised_kiosques()));
$$;

REVOKE ALL ON FUNCTION public.scoped_kiosque_ids() FROM PUBLIC, anon, authenticated;

-- Recherche texte : les jokers LIKE saisis par l'utilisateur sont littéraux.
CREATE OR REPLACE FUNCTION public.like_pattern(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT '%' || replace(replace(replace(coalesce(p_text, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
$$;

-- ── 1. Vue d'ensemble par kiosque (Clients par kiosque, Rapports, Supervision)
-- p_from / p_to : période des ventes et objectifs (p_to exclusif ; NULL = sans borne).
-- p_sort : nom | ca | clients | activite | pct_asc | pct_desc | ventes
-- p_only_active : seulement les kiosques avec ventes sur la période ou un objectif.
CREATE OR REPLACE FUNCTION public.kiosk_overview(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'nom',
  p_only_active boolean DEFAULT false,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scope AS (
    SELECT id FROM public.scoped_kiosque_ids() AS id
  ),
  sales AS (
    SELECT v.kiosque_id, v.client_id, v.offre_id, v.montant_total, v.quantite
    FROM public.ventes v
    JOIN scope s ON s.id = v.kiosque_id
    WHERE (p_from IS NULL OR v.created_at >= p_from)
      AND (p_to IS NULL OR v.created_at < p_to)
  ),
  sales_agg AS (
    SELECT kiosque_id,
           SUM(montant_total)::bigint AS ca,
           COUNT(*)::int AS nb_ventes,
           COUNT(DISTINCT client_id)::int AS clients_actifs
    FROM sales
    GROUP BY kiosque_id
  ),
  clients_agg AS (
    SELECT c.kiosque_id,
           COUNT(*)::int AS nb_clients,
           (COUNT(*) FILTER (WHERE c.created_at >= now() - interval '7 days'))::int AS nouveaux_7j
    FROM public.clients c
    JOIN scope s ON s.id = c.kiosque_id
    GROUP BY c.kiosque_id
  ),
  last_sale AS (
    SELECT v.kiosque_id, MAX(v.created_at) AS last_sale_at
    FROM public.ventes v
    JOIN scope s ON s.id = v.kiosque_id
    GROUP BY v.kiosque_id
  ),
  targets AS (
    SELECT o.kiosque_id, SUM(o.ca_cible)::bigint AS objectif
    FROM public.objectifs o
    JOIN scope s ON s.id = o.kiosque_id
    WHERE p_from IS NOT NULL
      AND o.mois >= date_trunc('month', p_from)::date
      AND (p_to IS NULL OR o.mois < p_to::date)
    GROUP BY o.kiosque_id
  ),
  all_rows AS (
    SELECT k.id AS kiosque_id,
           k.nom,
           k.adresse,
           COALESCE(ca.nb_clients, 0) AS nb_clients,
           COALESCE(ca.nouveaux_7j, 0) AS nouveaux_7j,
           COALESCE(sa.ca, 0) AS ca,
           COALESCE(sa.nb_ventes, 0) AS nb_ventes,
           COALESCE(sa.clients_actifs, 0) AS clients_actifs,
           ls.last_sale_at,
           t.objectif,
           CASE WHEN t.objectif > 0 THEN round(COALESCE(sa.ca, 0)::numeric * 100 / t.objectif, 1) END AS pct
    FROM public.kiosques k
    JOIN scope s ON s.id = k.id
    LEFT JOIN clients_agg ca ON ca.kiosque_id = k.id
    LEFT JOIN sales_agg sa ON sa.kiosque_id = k.id
    LEFT JOIN last_sale ls ON ls.kiosque_id = k.id
    LEFT JOIN targets t ON t.kiosque_id = k.id
  ),
  filtered AS (
    SELECT *
    FROM all_rows
    WHERE (coalesce(p_search, '') = '' OR nom ILIKE public.like_pattern(p_search))
      AND (NOT p_only_active OR nb_ventes > 0 OR objectif > 0)
  ),
  page AS (
    SELECT f.*,
           row_number() OVER (
             ORDER BY
               CASE WHEN p_sort = 'ca' THEN f.ca END DESC NULLS LAST,
               CASE WHEN p_sort = 'ventes' THEN f.nb_ventes END DESC NULLS LAST,
               CASE WHEN p_sort = 'clients' THEN f.nb_clients END DESC NULLS LAST,
               CASE WHEN p_sort = 'activite' THEN f.last_sale_at END DESC NULLS LAST,
               CASE WHEN p_sort = 'pct_asc' THEN f.pct END ASC NULLS LAST,
               CASE WHEN p_sort = 'pct_desc' THEN f.pct END DESC NULLS LAST,
               f.nom, f.kiosque_id
           ) AS rn
    FROM filtered f
  ),
  page_rows AS (
    SELECT * FROM page
    WHERE rn > GREATEST(p_offset, 0) AND rn <= GREATEST(p_offset, 0) + LEAST(GREATEST(p_limit, 1), 200)
  )
  SELECT json_build_object(
    'total', (SELECT count(*) FROM filtered),
    'totals', (
      SELECT json_build_object(
        'kiosques', count(*),
        'kiosques_actifs', count(*) FILTER (WHERE nb_ventes > 0),
        'clients', COALESCE(sum(nb_clients), 0),
        'nouveaux_7j', COALESCE(sum(nouveaux_7j), 0),
        'ca', COALESCE(sum(ca), 0),
        'nb_ventes', COALESCE(sum(nb_ventes), 0),
        'avec_objectif', count(*) FILTER (WHERE objectif > 0),
        'objectif_atteint', count(*) FILTER (WHERE pct >= 100)
      )
      FROM all_rows
    ),
    'rows', COALESCE((
      SELECT json_agg(json_build_object(
               'kiosque_id', p.kiosque_id,
               'nom', p.nom,
               'adresse', p.adresse,
               'nb_clients', p.nb_clients,
               'nouveaux_7j', p.nouveaux_7j,
               'ca', p.ca,
               'nb_ventes', p.nb_ventes,
               'clients_actifs', p.clients_actifs,
               'last_sale_at', p.last_sale_at,
               'objectif', p.objectif,
               'pct', p.pct,
               -- Calculés pour la page affichée seulement (coût borné).
               'top_client', (
                 SELECT c.nom
                 FROM sales sl JOIN public.clients c ON c.id = sl.client_id
                 WHERE sl.kiosque_id = p.kiosque_id
                 GROUP BY c.id, c.nom
                 ORDER BY SUM(sl.montant_total) DESC, c.nom
                 LIMIT 1
               ),
               'best_offre', (
                 SELECT o.nom
                 FROM sales sl JOIN public.offres o ON o.id = sl.offre_id
                 WHERE sl.kiosque_id = p.kiosque_id
                 GROUP BY o.id, o.nom
                 ORDER BY SUM(sl.quantite) DESC, o.nom
                 LIMIT 1
               )
             ) ORDER BY p.rn)
      FROM page_rows p
    ), '[]'::json)
  );
$$;

REVOKE ALL ON FUNCTION public.kiosk_overview(timestamptz, timestamptz, text, text, boolean, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_overview(timestamptz, timestamptz, text, text, boolean, integer, integer) TO authenticated;

-- ── 2. Clients d'un kiosque (recherche nom/téléphone, tri, pagination) ──
-- p_sort : nom | depense | dernier_achat | recent
CREATE OR REPLACE FUNCTION public.kiosk_clients(
  p_kiosque_id uuid,
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'nom',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT 1 WHERE p_kiosque_id IN (SELECT public.scoped_kiosque_ids())
  ),
  digits AS (
    SELECT regexp_replace(coalesce(p_search, ''), '[^0-9]', '', 'g') AS d
  ),
  base AS (
    SELECT c.*
    FROM public.clients c, digits
    WHERE c.kiosque_id = p_kiosque_id
      AND EXISTS (SELECT 1 FROM allowed)
      AND (
        coalesce(p_search, '') = ''
        OR c.nom ILIKE public.like_pattern(p_search)
        OR (digits.d <> '' AND regexp_replace(coalesce(c.telephone, ''), '[^0-9]', '', 'g') LIKE '%' || digits.d || '%')
      )
  ),
  stats AS (
    SELECT v.client_id,
           SUM(v.montant_total)::bigint AS total_depense,
           MAX(v.created_at) AS dernier_achat,
           COUNT(*)::int AS nb_achats
    FROM public.ventes v
    WHERE v.kiosque_id = p_kiosque_id
      AND v.client_id IN (SELECT id FROM base)
    GROUP BY v.client_id
  ),
  page AS (
    SELECT b.id, b.kiosque_id, b.nom, b.telephone, b.adresse, b.email, b.notes,
           b.type_client, b.nombre_personnes, b.created_at,
           COALESCE(st.total_depense, 0) AS total_depense,
           st.dernier_achat,
           COALESCE(st.nb_achats, 0) AS nb_achats,
           row_number() OVER (
             ORDER BY
               CASE WHEN p_sort = 'depense' THEN COALESCE(st.total_depense, 0) END DESC NULLS LAST,
               CASE WHEN p_sort = 'dernier_achat' THEN st.dernier_achat END DESC NULLS LAST,
               CASE WHEN p_sort = 'recent' THEN b.created_at END DESC NULLS LAST,
               b.nom, b.id
           ) AS rn
    FROM base b
    LEFT JOIN stats st ON st.client_id = b.id
  )
  SELECT json_build_object(
    'total', (SELECT count(*) FROM base),
    'rows', COALESCE((
      SELECT json_agg(json_build_object(
               'id', p.id, 'kiosque_id', p.kiosque_id, 'nom', p.nom, 'telephone', p.telephone,
               'adresse', p.adresse, 'email', p.email, 'notes', p.notes,
               'type_client', p.type_client, 'nombre_personnes', p.nombre_personnes,
               'created_at', p.created_at, 'total_depense', p.total_depense,
               'dernier_achat', p.dernier_achat, 'nb_achats', p.nb_achats
             ) ORDER BY p.rn)
      FROM page p
      WHERE p.rn > GREATEST(p_offset, 0) AND p.rn <= GREATEST(p_offset, 0) + LEAST(GREATEST(p_limit, 1), 200)
    ), '[]'::json)
  );
$$;

REVOKE ALL ON FUNCTION public.kiosk_clients(uuid, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiosk_clients(uuid, text, text, integer, integer) TO authenticated;

-- ── 3. Performance des fontainiers (métriques de leur kiosque) ──────────
-- p_status : NULL (tous) | atteint | en_bonne_voie | en_difficulte | sans_objectif
--   atteint ≥ 100 % ; en bonne voie 80–99,9 % ; en difficulté < 80 %.
-- p_sort : pct_asc (les plus en difficulté d'abord) | pct_desc | ca | nom
CREATE OR REPLACE FUNCTION public.fontainier_performance(
  p_from timestamptz,
  p_to timestamptz,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_sort text DEFAULT 'pct_asc',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scope AS (
    SELECT id FROM public.scoped_kiosque_ids() AS id
  ),
  kio AS (
    SELECT v.kiosque_id,
           SUM(v.montant_total)::bigint AS ca,
           COUNT(*)::int AS nb_ventes,
           COUNT(DISTINCT v.client_id)::int AS clients
    FROM public.ventes v
    JOIN scope s ON s.id = v.kiosque_id
    WHERE v.created_at >= p_from AND v.created_at < p_to
    GROUP BY v.kiosque_id
  ),
  targets AS (
    SELECT o.kiosque_id, SUM(o.ca_cible)::bigint AS objectif
    FROM public.objectifs o
    JOIN scope s ON s.id = o.kiosque_id
    WHERE o.mois >= date_trunc('month', p_from)::date AND o.mois < p_to::date
    GROUP BY o.kiosque_id
  ),
  all_rows AS (
    SELECT p.id,
           p.username AS nom,
           p.kiosque_id,
           k.nom AS kiosque_nom,
           COALESCE(kio.ca, 0) AS ca,
           t.objectif,
           CASE WHEN t.objectif > 0 THEN round(COALESCE(kio.ca, 0)::numeric * 100 / t.objectif, 1) END AS pct,
           COALESCE(kio.nb_ventes, 0) AS nb_ventes,
           COALESCE(kio.clients, 0) AS clients,
           CASE WHEN COALESCE(kio.nb_ventes, 0) > 0 THEN round(kio.ca::numeric / kio.nb_ventes) ELSE 0 END AS panier
    FROM public.profiles p
    LEFT JOIN public.kiosques k ON k.id = p.kiosque_id
    LEFT JOIN kio ON kio.kiosque_id = p.kiosque_id
    LEFT JOIN targets t ON t.kiosque_id = p.kiosque_id
    WHERE p.role = 'fontainier'
      AND p.deleted_at IS NULL
      AND (p.kiosque_id IN (SELECT id FROM scope) OR (p.kiosque_id IS NULL AND public.is_admin()))
  ),
  with_status AS (
    SELECT r.*,
           CASE
             WHEN r.objectif IS NULL OR r.objectif = 0 THEN 'sans_objectif'
             WHEN r.pct >= 100 THEN 'atteint'
             WHEN r.pct >= 80 THEN 'en_bonne_voie'
             ELSE 'en_difficulte'
           END AS statut
    FROM all_rows r
  ),
  filtered AS (
    SELECT *
    FROM with_status
    WHERE (coalesce(p_status, '') = '' OR statut = p_status)
      AND (coalesce(p_search, '') = ''
           OR nom ILIKE public.like_pattern(p_search)
           OR coalesce(kiosque_nom, '') ILIKE public.like_pattern(p_search))
  ),
  page AS (
    SELECT f.*,
           row_number() OVER (
             ORDER BY
               CASE WHEN p_sort = 'pct_asc' THEN f.pct END ASC NULLS LAST,
               CASE WHEN p_sort = 'pct_desc' THEN f.pct END DESC NULLS LAST,
               CASE WHEN p_sort = 'ca' THEN f.ca END DESC NULLS LAST,
               f.nom, f.id
           ) AS rn
    FROM filtered f
  )
  SELECT json_build_object(
    'total', (SELECT count(*) FROM filtered),
    'counts', (
      SELECT json_build_object(
        'tous', count(*),
        'atteint', count(*) FILTER (WHERE statut = 'atteint'),
        'en_bonne_voie', count(*) FILTER (WHERE statut = 'en_bonne_voie'),
        'en_difficulte', count(*) FILTER (WHERE statut = 'en_difficulte'),
        'sans_objectif', count(*) FILTER (WHERE statut = 'sans_objectif')
      )
      FROM with_status
    ),
    'rows', COALESCE((
      SELECT json_agg(json_build_object(
               'id', p.id, 'nom', p.nom, 'kiosque_id', p.kiosque_id, 'kiosque_nom', p.kiosque_nom,
               'ca', p.ca, 'objectif', p.objectif, 'pct', p.pct, 'nb_ventes', p.nb_ventes,
               'clients', p.clients, 'panier', p.panier, 'statut', p.statut
             ) ORDER BY p.rn)
      FROM page p
      WHERE p.rn > GREATEST(p_offset, 0) AND p.rn <= GREATEST(p_offset, 0) + LEAST(GREATEST(p_limit, 1), 200)
    ), '[]'::json)
  );
$$;

REVOKE ALL ON FUNCTION public.fontainier_performance(timestamptz, timestamptz, text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fontainier_performance(timestamptz, timestamptz, text, text, text, integer, integer) TO authenticated;

-- ── 4. Tendance quotidienne du périmètre (Supervision) ──────────────────
CREATE OR REPLACE FUNCTION public.scoped_daily_revenue(p_days integer DEFAULT 30)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(json_agg(json_build_object('day', d.day, 'ca', d.ca, 'nb', d.nb) ORDER BY d.day), '[]'::json)
  FROM (
    SELECT v.created_at::date AS day, SUM(v.montant_total)::bigint AS ca, COUNT(*)::int AS nb
    FROM public.ventes v
    WHERE v.kiosque_id IN (SELECT public.scoped_kiosque_ids())
      AND v.created_at >= (current_date - (LEAST(GREATEST(p_days, 1), 366) - 1))
    GROUP BY 1
  ) d;
$$;

REVOKE ALL ON FUNCTION public.scoped_daily_revenue(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scoped_daily_revenue(integer) TO authenticated;
