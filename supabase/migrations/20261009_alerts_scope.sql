-- Phase 17 passe 4 — alertes admin limitées aux kiosques ACTIFS.
--
-- Avant : chaque kiosque du référentiel (70) était contrôlé, dont ~60 jamais
-- ouverts → 69 alertes « Aucune vente depuis 48 heures » sur 70 : du bruit.
--
-- Kiosque actif = au moins UN de :
--   1. un fontainier assigné (profiles.role = 'fontainier', non supprimé) ;
--   2. au moins une vente sur les 30 derniers jours.
--
-- Les règles existantes sont inchangées (mêmes types, messages, sévérités) ;
-- seules les règles par kiosque sont restreintes au périmètre actif.
-- La signature de get_admin_alerts() est identique à la prod (CREATE OR
-- REPLACE, pas de DROP) : le front déjà déployé continue de fonctionner.
--
-- Corrige aussi : `k.id NOT IN (SELECT kiosque_id FROM ventes …)` renvoie
-- zéro ligne dès qu'une vente a kiosque_id NULL (colonne nullable) → NOT
-- EXISTS ; contrôle admin via is_admin() (tient compte de deleted_at).
--
-- À exécuter manuellement (SQL editor). Idempotent.

BEGIN;

-- Périmètre « kiosques actifs » : une seule définition, partagée par les
-- alertes et le compteur. Pas SECURITY DEFINER et non exposée à l'API :
-- appelée uniquement depuis les fonctions admin ci-dessous.
CREATE OR REPLACE FUNCTION public.admin_active_kiosque_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT k.id
  FROM public.kiosques k
  WHERE EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.kiosque_id = k.id
            AND p.role = 'fontainier'
            AND p.deleted_at IS NULL
        )
     OR EXISTS (
          SELECT 1 FROM public.ventes v
          WHERE v.kiosque_id = k.id
            AND v.created_at >= NOW() - INTERVAL '30 days'
        );
$$;

REVOKE ALL ON FUNCTION public.admin_active_kiosque_ids() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_alerts()
RETURNS TABLE(type text, kiosque_id uuid, kiosque_nom text, message text, severity text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH active AS (
    SELECT id FROM public.admin_active_kiosque_ids() AS id
  ),
  month_ca AS (
    SELECT v.kiosque_id, SUM(v.montant_total) AS ca_actuel
    FROM public.ventes v
    WHERE DATE_TRUNC('month', v.created_at) = DATE_TRUNC('month', NOW())
    GROUP BY v.kiosque_id
  ),
  alerts AS (
    -- 1. Kiosques actifs sans vente depuis 48 h
    SELECT 'inactif_48h'::text AS type, k.id AS kiosque_id, k.nom AS kiosque_nom,
           'Aucune vente depuis 48 heures'::text AS message, 'danger'::text AS severity
    FROM public.kiosques k
    JOIN active a ON a.id = k.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ventes v
      WHERE v.kiosque_id = k.id AND v.created_at >= NOW() - INTERVAL '48 hours'
    )

    UNION ALL

    -- 2. Kiosques actifs sans vente aujourd'hui (mais vendu dans les 48 h,
    --    sinon déjà en alerte 1)
    SELECT 'inactif_today', k.id, k.nom,
           'Aucune vente enregistrée aujourd''hui', 'warning'
    FROM public.kiosques k
    JOIN active a ON a.id = k.id
    WHERE NOT EXISTS (
            SELECT 1 FROM public.ventes v
            WHERE v.kiosque_id = k.id AND v.created_at::date = CURRENT_DATE
          )
      AND EXISTS (
            SELECT 1 FROM public.ventes v
            WHERE v.kiosque_id = k.id AND v.created_at >= NOW() - INTERVAL '48 hours'
          )

    UNION ALL

    -- 3. Offres < 5 % des ventes du mois (réseau, pas de kiosque)
    SELECT 'offre_sous_perf', NULL::uuid, o.nom,
           'Moins de 5% des ventes ce mois — envisagez une promotion', 'info'
    FROM public.offres o
    JOIN (
      SELECT v.offre_id, COUNT(*) AS nb
      FROM public.ventes v
      WHERE DATE_TRUNC('month', v.created_at) = DATE_TRUNC('month', NOW())
      GROUP BY v.offre_id
    ) stats ON stats.offre_id = o.id
    CROSS JOIN (
      SELECT COUNT(*) AS total
      FROM public.ventes v
      WHERE DATE_TRUNC('month', v.created_at) = DATE_TRUNC('month', NOW())
    ) totals
    WHERE totals.total > 0
      AND stats.nb::float / totals.total < 0.05

    UNION ALL

    -- 4. Kiosques actifs sous 60 % de l'objectif après le 15 du mois
    SELECT 'objectif_en_danger', k.id, k.nom,
           'Moins de 60% de l''objectif mensuel atteint à mi-mois', 'warning'
    FROM public.kiosques k
    JOIN active a ON a.id = k.id
    JOIN public.objectifs obj
      ON obj.kiosque_id = k.id
     AND obj.mois = DATE_TRUNC('month', NOW())::date
    LEFT JOIN month_ca perf ON perf.kiosque_id = k.id
    WHERE EXTRACT(DAY FROM NOW()) >= 15
      AND obj.ca_cible > 0
      AND COALESCE(perf.ca_actuel, 0)::float / obj.ca_cible < 0.60
  )
  SELECT alerts.type, alerts.kiosque_id, alerts.kiosque_nom, alerts.message, alerts.severity
  FROM alerts
  WHERE public.is_admin()
  ORDER BY CASE alerts.severity WHEN 'danger' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
           alerts.kiosque_nom;
$$;

REVOKE ALL ON FUNCTION public.get_admin_alerts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_alerts() TO authenticated;

-- Compteur du panneau : « X kiosques actifs surveillés ».
CREATE OR REPLACE FUNCTION public.get_admin_alerts_scope()
RETURNS TABLE(active_kiosques integer, total_kiosques integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.admin_active_kiosque_ids())::integer,
    (SELECT COUNT(*) FROM public.kiosques)::integer
  WHERE public.is_admin();
$$;

REVOKE ALL ON FUNCTION public.get_admin_alerts_scope() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_alerts_scope() TO authenticated;

COMMIT;

-- Vérification (lecture seule, à lancer connecté en admin dans l'app ou via
-- le SQL editor) :
--   SELECT type, COUNT(*) FROM public.get_admin_alerts() GROUP BY type;
--   SELECT * FROM public.get_admin_alerts_scope();
-- Attendu au 02/10/2026 : 11 kiosques actifs / 70 ; 11 alertes (10 sans
-- vente 48 h + 1 sans vente aujourd'hui) au lieu de 70.
