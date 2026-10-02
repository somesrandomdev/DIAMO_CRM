-- ============================================================================
-- Snapshot du schéma PRODUCTION (projet qhvfptzezzsvvynzmxyt) — 2026-10-02.
--
-- RÉFÉRENCE, PAS UNE MIGRATION : ne pas exécuter tel quel. Généré depuis le
-- catalogue Postgres (pg_get_functiondef, pg_policies, pg_indexes…) faute
-- d'accès `supabase db pull` (mot de passe DB). Les fichiers de
-- supabase/migrations/ ne reflètent plus la prod à eux seuls (ex. :
-- get_admin_alerts différait) : en cas de doute, CE fichier fait foi.
--
-- Régénérer : supabase/schema/snapshot_queries.sql dans le SQL editor.
-- ============================================================================

-- ── Tables ────────────────────────────────────────────────────────────────

CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kiosque_id uuid,
  nom text NOT NULL,
  telephone text,
  adresse text,
  email text,
  localite text NOT NULL DEFAULT ''::text,
  type_client text NOT NULL DEFAULT 'Particulier'::text,
  nombre_personnes integer NOT NULL DEFAULT 1,
  contenant_prefere text NOT NULL DEFAULT 'Bouteille 10L'::text,
  preference_contact text NOT NULL DEFAULT 'Téléphone'::text,
  accepte_offres boolean NOT NULL DEFAULT false,
  situation_familiale text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clients_kiosque_id_fkey FOREIGN KEY (kiosque_id) REFERENCES kiosques(id) ON DELETE CASCADE,
  CONSTRAINT clients_pkey PRIMARY KEY (id),
  CONSTRAINT clients_kiosque_telephone_unique UNIQUE (kiosque_id, telephone)
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.commercials_kiosques (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  commercial_id uuid NOT NULL,
  kiosque_id uuid NOT NULL,
  assigned_at timestamp with time zone DEFAULT now(),
  CONSTRAINT commercials_kiosques_commercial_id_fkey FOREIGN KEY (commercial_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT commercials_kiosques_kiosque_id_fkey FOREIGN KEY (kiosque_id) REFERENCES kiosques(id) ON DELETE CASCADE,
  CONSTRAINT commercials_kiosques_pkey PRIMARY KEY (id),
  CONSTRAINT commercials_kiosques_commercial_id_kiosque_id_key UNIQUE (commercial_id, kiosque_id)
);
ALTER TABLE public.commercials_kiosques ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kiosque_types (
  code text NOT NULL,
  label text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT kiosque_types_pkey PRIMARY KEY (code)
);
ALTER TABLE public.kiosque_types ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.kiosques (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  adresse text,
  created_at timestamp with time zone DEFAULT now(),
  type_code text,
  CONSTRAINT kiosques_type_code_fkey FOREIGN KEY (type_code) REFERENCES kiosque_types(code),
  CONSTRAINT kiosques_pkey PRIMARY KEY (id)
);
ALTER TABLE public.kiosques ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.objectifs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kiosque_id uuid NOT NULL,
  mois date NOT NULL,
  ca_cible integer NOT NULL,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT objectifs_ca_positive CHECK ((ca_cible > 0)),
  CONSTRAINT objectifs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT objectifs_kiosque_id_fkey FOREIGN KEY (kiosque_id) REFERENCES kiosques(id) ON DELETE CASCADE,
  CONSTRAINT objectifs_pkey PRIMARY KEY (id),
  CONSTRAINT objectifs_kiosque_mois_unique UNIQUE (kiosque_id, mois)
);
ALTER TABLE public.objectifs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.offres (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  volume_ml integer,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT offres_pkey PRIMARY KEY (id),
  CONSTRAINT offres_nom_key UNIQUE (nom)
);
ALTER TABLE public.offres ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.offres_kiosque (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kiosque_id uuid,
  offre_id uuid,
  prix integer NOT NULL,
  est_actif boolean DEFAULT true,
  CONSTRAINT offres_kiosque_kiosque_id_fkey FOREIGN KEY (kiosque_id) REFERENCES kiosques(id) ON DELETE CASCADE,
  CONSTRAINT offres_kiosque_offre_id_fkey FOREIGN KEY (offre_id) REFERENCES offres(id) ON DELETE CASCADE,
  CONSTRAINT offres_kiosque_pkey PRIMARY KEY (id),
  CONSTRAINT offres_kiosque_kiosque_id_offre_id_key UNIQUE (kiosque_id, offre_id)
);
ALTER TABLE public.offres_kiosque ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  username text NOT NULL,
  role text NOT NULL DEFAULT 'fontainier'::text,
  kiosque_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  email text,
  phone text,
  address text,
  must_change_password boolean DEFAULT false,
  deleted_at timestamp with time zone,
  CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['fontainier'::text, 'commercial'::text, 'administrateur'::text]))),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT profiles_kiosque_id_fkey FOREIGN KEY (kiosque_id) REFERENCES kiosques(id),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_phone_unique UNIQUE (phone),
  CONSTRAINT profiles_username_key UNIQUE (username)
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tech_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  level text NOT NULL,
  source text NOT NULL,
  message text NOT NULL,
  context jsonb,
  build text,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  route text,
  CONSTRAINT tech_logs_level_check CHECK ((level = ANY (ARRAY['info'::text, 'warn'::text, 'error'::text]))),
  CONSTRAINT tech_logs_pkey PRIMARY KEY (id)
);
ALTER TABLE public.tech_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ventes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kiosque_id uuid,
  client_id uuid,
  offre_id uuid,
  quantite integer NOT NULL,
  montant_total integer NOT NULL,
  lien_ticket text,
  created_at timestamp with time zone DEFAULT now(),
  idempotency_key uuid,
  CONSTRAINT ventes_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT ventes_kiosque_id_fkey FOREIGN KEY (kiosque_id) REFERENCES kiosques(id) ON DELETE CASCADE,
  CONSTRAINT ventes_offre_id_fkey FOREIGN KEY (offre_id) REFERENCES offres(id) ON DELETE SET NULL,
  CONSTRAINT ventes_pkey PRIMARY KEY (id)
);
ALTER TABLE public.ventes ENABLE ROW LEVEL SECURITY;

-- ── Vue ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.admin_dashboard_summary WITH (security_invoker = true) AS
 SELECT k.id AS kiosque_id,
    k.nom AS kiosque_nom,
    count(v.id) AS total_ventes,
    sum(v.montant_total) AS chiffre_affaire
   FROM (kiosques k
     LEFT JOIN ventes v ON ((v.kiosque_id = k.id)))
  GROUP BY k.id, k.nom;;

-- ── Index (hors contraintes) ──────────────────────────────────────────────

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);
CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX idx_clients_created_at ON public.clients USING btree (created_at DESC);
CREATE INDEX idx_clients_kiosque ON public.clients USING btree (kiosque_id);
CREATE INDEX idx_clients_kiosque_id ON public.clients USING btree (kiosque_id);
CREATE INDEX idx_clients_nom_trgm ON public.clients USING gin (nom gin_trgm_ops);
CREATE INDEX idx_clients_segmentation ON public.clients USING btree (kiosque_id, type_client, contenant_prefere, accepte_offres, created_at DESC);
CREATE INDEX idx_clients_telephone ON public.clients USING btree (telephone);
CREATE INDEX idx_ck_commercial ON public.commercials_kiosques USING btree (commercial_id);
CREATE INDEX idx_ck_kiosque ON public.commercials_kiosques USING btree (kiosque_id);
CREATE INDEX idx_objectifs_kiosque ON public.objectifs USING btree (kiosque_id);
CREATE INDEX idx_objectifs_kiosque_id ON public.objectifs USING btree (kiosque_id);
CREATE INDEX idx_objectifs_kiosque_mois ON public.objectifs USING btree (kiosque_id, mois DESC);
CREATE INDEX idx_offres_kiosque_active ON public.offres_kiosque USING btree (kiosque_id, est_actif);
CREATE INDEX idx_profiles_id_kiosque ON public.profiles USING btree (id, kiosque_id);
CREATE INDEX idx_profiles_id_role ON public.profiles USING btree (id, role);
CREATE INDEX idx_profiles_kiosque ON public.profiles USING btree (kiosque_id);
CREATE INDEX idx_profiles_kiosque_id ON public.profiles USING btree (kiosque_id);
CREATE INDEX idx_tech_logs_created ON public.tech_logs USING btree (created_at DESC);
CREATE INDEX idx_tech_logs_level ON public.tech_logs USING btree (level);
CREATE INDEX idx_tech_logs_source ON public.tech_logs USING btree (source);
CREATE INDEX idx_ventes_client ON public.ventes USING btree (client_id);
CREATE INDEX idx_ventes_created_at ON public.ventes USING btree (created_at DESC);
CREATE UNIQUE INDEX idx_ventes_idempotency_key_offre ON public.ventes USING btree (idempotency_key, offre_id) WHERE (idempotency_key IS NOT NULL);
CREATE INDEX idx_ventes_kiosque ON public.ventes USING btree (kiosque_id);
CREATE INDEX idx_ventes_kiosque_date ON public.ventes USING btree (kiosque_id, created_at DESC);
CREATE INDEX idx_ventes_kiosque_id ON public.ventes USING btree (kiosque_id);
CREATE INDEX idx_ventes_lien_ticket ON public.ventes USING btree (lien_ticket) WHERE (lien_ticket IS NOT NULL);
CREATE INDEX idx_ventes_offre ON public.ventes USING btree (offre_id);

-- ── Fonctions (schéma public) ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_active_kiosque_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.clients_normalize_choices()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.preference_contact = 'Telephone' THEN NEW.preference_contact := 'Téléphone'; END IF;
  IF NEW.contenant_prefere = 'Reservoir' THEN NEW.contenant_prefere := 'Réservoir'; END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_vente(p_vente_id uuid, p_reason text, p_comment text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.ventes%ROWTYPE; v_kiosques uuid[]; v_sibling_id uuid; v_had_siblings boolean := false;
BEGIN
  IF COALESCE(p_reason, '') = '' THEN RAISE EXCEPTION 'Motif de suppression obligatoire'; END IF;
  SELECT * INTO v_row FROM public.ventes WHERE id = p_vente_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vente introuvable'; END IF;
  IF public.is_admin() THEN NULL;
  ELSIF public.is_commercial() THEN
    v_kiosques := ARRAY(SELECT public.get_my_supervised_kiosques());
    IF NOT (v_row.kiosque_id = ANY(v_kiosques)) THEN RAISE EXCEPTION 'Cette vente ne fait pas partie de vos kiosques'; END IF;
    IF v_row.created_at < now() - interval '24 hours' THEN RAISE EXCEPTION 'Vente de plus de 24 h : suppression réservée à un administrateur'; END IF;
  ELSE RAISE EXCEPTION 'Suppression réservée aux commerciaux et aux administrateurs';
  END IF;
  IF v_row.idempotency_key IS NOT NULL THEN
    SELECT id INTO v_sibling_id FROM public.ventes
    WHERE idempotency_key = v_row.idempotency_key AND id <> v_row.id ORDER BY created_at, id LIMIT 1;
    v_had_siblings := v_sibling_id IS NOT NULL;
  END IF;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'vente.delete', 'ventes', p_vente_id::text,
          json_build_object('reason', p_reason, 'comment', p_comment, 'snapshot', to_jsonb(v_row), 'had_siblings', v_had_siblings));
  DELETE FROM public.ventes WHERE id = p_vente_id;
  IF v_had_siblings AND v_row.lien_ticket IS NOT NULL THEN
    UPDATE public.ventes SET lien_ticket = v_row.lien_ticket WHERE id = v_sibling_id AND lien_ticket IS NULL;
  END IF;
  RETURN json_build_object('success', true, 'had_siblings', v_had_siblings);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_alerts()
 RETURNS TABLE(type text, kiosque_id uuid, kiosque_nom text, message text, severity text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
    SELECT 'inactif_48h'::text AS type, k.id AS kiosque_id, k.nom AS kiosque_nom,
           'Aucune vente depuis 48 heures'::text AS message, 'danger'::text AS severity
    FROM public.kiosques k
    JOIN active a ON a.id = k.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ventes v
      WHERE v.kiosque_id = k.id AND v.created_at >= NOW() - INTERVAL '48 hours'
    )

    UNION ALL

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
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_alerts_scope()
 RETURNS TABLE(active_kiosques integer, total_kiosques integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT COUNT(*) FROM public.admin_active_kiosque_ids())::integer,
    (SELECT COUNT(*) FROM public.kiosques)::integer
  WHERE public.is_admin();
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(p_month_start date, p_prev_start date, p_last30_start date, p_kiosque_ids uuid[] DEFAULT NULL::uuid[])
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_insights(p_kiosque_ids uuid[] DEFAULT NULL::uuid[], p_start date DEFAULT (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date, p_end date DEFAULT CURRENT_DATE)
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
        -- ✅ LIGNE CORRIGÉE : interval → secondes → jours (pas de cast interval::numeric)
        'avg_days_between', COALESCE((
          SELECT ROUND((AVG(EXTRACT(EPOCH FROM gap)) / 86400.0)::numeric, 1)::float
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

    -- ── Croissance : clients cumulés par semaine sur la période ────────
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_kiosque_stats(p_kiosque_id uuid, p_mois date DEFAULT (date_trunc('month'::text, now()))::date)
 RETURNS TABLE(ca_total bigint, nb_ventes bigint, clients_actifs bigint, panier_moyen numeric, litres_vendus numeric, ca_mois_precedent bigint, delta_ca_pct numeric, ca_cible integer, pct_objectif numeric, nb_vip bigint, nb_regulier bigint, nb_occasionnel bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH
  -- Check access: user must be administrateur OR own this kiosque
  access_check AS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (
        role = 'administrateur'
        OR kiosque_id = p_kiosque_id
      )
  ),

  -- Current month ventes
  current_month AS (
    SELECT
      v.id,
      v.client_id,
      v.montant_total,
      o.volume_ml * v.quantite AS volume_total_ml
    FROM public.ventes v
    JOIN public.offres o ON o.id = v.offre_id
    WHERE v.kiosque_id = p_kiosque_id
      AND DATE_TRUNC('month', v.created_at)::date = p_mois
      AND EXISTS (SELECT 1 FROM access_check)
  ),

  -- Previous month ventes
  prev_month AS (
    SELECT SUM(montant_total) AS ca_prev
    FROM public.ventes
    WHERE kiosque_id = p_kiosque_id
      AND DATE_TRUNC('month', created_at)::date = (p_mois - INTERVAL '1 month')::date
      AND EXISTS (SELECT 1 FROM access_check)
  ),

  -- Client purchase counts this month (for segmentation)
  client_counts AS (
    SELECT client_id, COUNT(*) AS nb_achats
    FROM public.ventes
    WHERE kiosque_id = p_kiosque_id
      AND DATE_TRUNC('month', created_at)::date = p_mois
      AND EXISTS (SELECT 1 FROM access_check)
    GROUP BY client_id
  ),

  -- Monthly target
  target AS (
    SELECT ca_cible
    FROM public.objectifs
    WHERE kiosque_id = p_kiosque_id
      AND mois = p_mois
    LIMIT 1
  )

  SELECT
    -- Totals
    COALESCE(SUM(cm.montant_total), 0)::bigint                         AS ca_total,
    COUNT(cm.id)::bigint                                               AS nb_ventes,
    COUNT(DISTINCT cm.client_id)::bigint                               AS clients_actifs,
    ROUND(COALESCE(SUM(cm.montant_total), 0)::numeric
          / NULLIF(COUNT(cm.id), 0), 0)                                AS panier_moyen,
    ROUND(COALESCE(SUM(cm.volume_total_ml), 0)::numeric / 1000, 1)    AS litres_vendus,
    -- Previous month & delta
    COALESCE((SELECT ca_prev FROM prev_month), 0)::bigint              AS ca_mois_precedent,
    CASE
      WHEN COALESCE((SELECT ca_prev FROM prev_month), 0) = 0 THEN NULL
      ELSE ROUND(
        (COALESCE(SUM(cm.montant_total), 0)
          - COALESCE((SELECT ca_prev FROM prev_month), 0)
        )::numeric
        / (SELECT ca_prev FROM prev_month) * 100, 1)
    END                                                                AS delta_ca_pct,
    -- Target
    (SELECT ca_cible FROM target)                                      AS ca_cible,
    CASE
      WHEN (SELECT ca_cible FROM target) IS NULL THEN NULL
      ELSE ROUND(
        COALESCE(SUM(cm.montant_total), 0)::numeric
        / (SELECT ca_cible FROM target) * 100, 1)
    END                                                                AS pct_objectif,
    -- Segmentation
    (SELECT COUNT(*) FROM client_counts WHERE nb_achats >= 5)::bigint AS nb_vip,
    (SELECT COUNT(*) FROM client_counts
     WHERE nb_achats BETWEEN 2 AND 4)::bigint                         AS nb_regulier,
    (SELECT COUNT(*) FROM client_counts WHERE nb_achats = 1)::bigint  AS nb_occasionnel
  FROM current_month cm;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_kiosque_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT kiosque_id FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_supervised_kiosques()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ck.kiosque_id FROM public.commercials_kiosques ck JOIN public.profiles p ON p.id = ck.commercial_id
  WHERE ck.commercial_id = auth.uid() AND p.deleted_at IS NULL;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'administrateur' AND deleted_at IS NULL);
$function$
;

CREATE OR REPLACE FUNCTION public.is_commercial()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'commercial' AND deleted_at IS NULL);
$function$
;

CREATE OR REPLACE FUNCTION public.is_supervisor_of(p_kiosque_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.commercials_kiosques ck JOIN public.profiles p ON p.id = ck.commercial_id
    WHERE ck.commercial_id = auth.uid() AND ck.kiosque_id = p_kiosque_id AND p.deleted_at IS NULL);
$function$
;

CREATE OR REPLACE FUNCTION public.log_audit(p_action text, p_entity_type text, p_entity_id text DEFAULT NULL::text, p_details jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_details);
END; $function$
;

CREATE OR REPLACE FUNCTION public.resolve_login_identifier(p_identifier text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_email text; v_clean text;
BEGIN
  v_clean := regexp_replace(COALESCE(p_identifier,''), '[^0-9]', '', 'g');
  IF length(v_clean) >= 7 THEN
    SELECT u.email INTO v_email
    FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE regexp_replace(COALESCE(p.phone,''),'[^0-9]','','g') = v_clean
      AND p.deleted_at IS NULL
    LIMIT 1;
  END IF;
  IF v_email IS NULL THEN
    SELECT u.email INTO v_email
    FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE (p.username = p_identifier OR u.email = p_identifier)
      AND p.deleted_at IS NULL
    LIMIT 1;
  END IF;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Identifiant non trouvé'; END IF;
  RETURN v_email;
END; $function$
;

CREATE OR REPLACE FUNCTION public.ventes_guard_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() OR public.is_commercial() THEN
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - 'lien_ticket') IS DISTINCT FROM (to_jsonb(OLD) - 'lien_ticket') THEN
    RAISE EXCEPTION 'Modification de vente réservée aux commerciaux et administrateurs'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$
;

-- ── Triggers ──────────────────────────────────────────────────────────────

CREATE TRIGGER clients_normalize_choices BEFORE INSERT OR UPDATE OF preference_contact, contenant_prefere ON public.clients FOR EACH ROW EXECUTE FUNCTION clients_normalize_choices();
CREATE TRIGGER ventes_guard_update BEFORE UPDATE ON public.ventes FOR EACH ROW EXECUTE FUNCTION ventes_guard_update();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Policies RLS (public + storage) ───────────────────────────────────────

CREATE POLICY audit_logs_admin_read ON public.audit_logs FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY clients_admin_all ON public.clients FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY clients_commercial_read_supervised ON public.clients FOR SELECT TO authenticated
  USING ((is_commercial() AND (kiosque_id IN ( SELECT get_my_supervised_kiosques() AS get_my_supervised_kiosques))));

CREATE POLICY clients_commercial_update_supervised ON public.clients FOR UPDATE TO authenticated
  USING ((is_commercial() AND (kiosque_id IN ( SELECT get_my_supervised_kiosques() AS get_my_supervised_kiosques))))
  WITH CHECK ((is_commercial() AND (kiosque_id IN ( SELECT get_my_supervised_kiosques() AS get_my_supervised_kiosques))));

CREATE POLICY clients_fontainier_insert ON public.clients FOR INSERT TO authenticated
  WITH CHECK (((kiosque_id = get_my_kiosque_id()) AND (NOT is_admin()) AND (NOT is_commercial())));

CREATE POLICY clients_fontainier_select ON public.clients FOR SELECT TO authenticated
  USING (((kiosque_id = get_my_kiosque_id()) AND (NOT is_admin()) AND (NOT is_commercial())));

CREATE POLICY clients_fontainier_update ON public.clients FOR UPDATE TO authenticated
  USING (((kiosque_id = get_my_kiosque_id()) AND (NOT is_admin()) AND (NOT is_commercial())))
  WITH CHECK (((kiosque_id = get_my_kiosque_id()) AND (NOT is_admin()) AND (NOT is_commercial())));

CREATE POLICY ck_admin_all ON public.commercials_kiosques FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY ck_commercial_read_own ON public.commercials_kiosques FOR SELECT TO authenticated
  USING ((commercial_id = auth.uid()));

CREATE POLICY kt_admin_write ON public.kiosque_types FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY kt_read ON public.kiosque_types FOR SELECT TO authenticated
  USING (true);

CREATE POLICY kiosques_admin_write ON public.kiosques FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY kiosques_read_all ON public.kiosques FOR SELECT TO authenticated
  USING (true);

CREATE POLICY objectifs_admin_all ON public.objectifs FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY objectifs_commercial_read_supervised ON public.objectifs FOR SELECT TO authenticated
  USING ((is_commercial() AND (kiosque_id IN ( SELECT get_my_supervised_kiosques() AS get_my_supervised_kiosques))));

CREATE POLICY objectifs_user_read ON public.objectifs FOR SELECT TO authenticated
  USING (((kiosque_id = get_my_kiosque_id()) AND (NOT is_admin()) AND (NOT is_commercial())));

CREATE POLICY offres_admin_write ON public.offres FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY offres_read_all ON public.offres FOR SELECT TO authenticated
  USING (true);

CREATE POLICY offres_kiosque_admin_write ON public.offres_kiosque FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY offres_kiosque_read_all ON public.offres_kiosque FOR SELECT TO authenticated
  USING (true);

CREATE POLICY profiles_admin_read_all ON public.profiles FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY profiles_admin_write ON public.profiles FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY profiles_commercial_read_supervised ON public.profiles FOR SELECT TO authenticated
  USING ((is_commercial() AND (kiosque_id IN ( SELECT get_my_supervised_kiosques() AS get_my_supervised_kiosques))));

CREATE POLICY profiles_read_own ON public.profiles FOR SELECT TO authenticated
  USING ((id = auth.uid()));

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
  USING ((id = auth.uid()))
  WITH CHECK (((id = auth.uid()) AND (role = get_my_role()) AND (NOT (kiosque_id IS DISTINCT FROM get_my_kiosque_id()))));

CREATE POLICY tech_logs_admin_read ON public.tech_logs FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY tech_logs_insert_own ON public.tech_logs FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY ventes_admin_all ON public.ventes FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY ventes_commercial_read_supervised ON public.ventes FOR SELECT TO authenticated
  USING ((is_commercial() AND (kiosque_id IN ( SELECT get_my_supervised_kiosques() AS get_my_supervised_kiosques))));

CREATE POLICY ventes_commercial_update_supervised ON public.ventes FOR UPDATE TO authenticated
  USING ((is_commercial() AND (kiosque_id IN ( SELECT get_my_supervised_kiosques() AS get_my_supervised_kiosques))))
  WITH CHECK ((is_commercial() AND (kiosque_id IN ( SELECT get_my_supervised_kiosques() AS get_my_supervised_kiosques))));

CREATE POLICY ventes_fontainier_insert ON public.ventes FOR INSERT TO authenticated
  WITH CHECK (((kiosque_id = get_my_kiosque_id()) AND (NOT is_admin()) AND (NOT is_commercial())));

CREATE POLICY ventes_fontainier_select ON public.ventes FOR SELECT TO authenticated
  USING (((kiosque_id = get_my_kiosque_id()) AND (NOT is_admin()) AND (NOT is_commercial())));

CREATE POLICY ventes_fontainier_update ON public.ventes FOR UPDATE TO authenticated
  USING (((kiosque_id = get_my_kiosque_id()) AND (NOT is_admin()) AND (NOT is_commercial())))
  WITH CHECK (((kiosque_id = get_my_kiosque_id()) AND (NOT is_admin()) AND (NOT is_commercial())));

CREATE POLICY kiosk_insert_ticket ON storage.objects FOR INSERT TO public
  WITH CHECK (false);

CREATE POLICY kiosk_read_ticket ON storage.objects FOR SELECT TO public
  USING (false);

CREATE POLICY tickets_admin_all ON storage.objects FOR ALL TO authenticated
  USING (((bucket_id = 'private_tickets'::text) AND is_admin()));

CREATE POLICY tickets_insert_own_kiosque ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'private_tickets'::text) AND ((storage.foldername(name))[1] = (get_my_kiosque_id())::text)));

CREATE POLICY tickets_select_own_kiosque ON storage.objects FOR SELECT TO authenticated
  USING (((bucket_id = 'private_tickets'::text) AND ((storage.foldername(name))[1] = (get_my_kiosque_id())::text)));

CREATE POLICY tickets_select_supervised ON storage.objects FOR SELECT TO authenticated
  USING (((bucket_id = 'private_tickets'::text) AND is_commercial() AND ((storage.foldername(name))[1] IN ( SELECT (k.k)::text AS k
   FROM get_my_supervised_kiosques() k(k)))));

CREATE POLICY tickets_select_via_vente ON storage.objects FOR SELECT TO authenticated
  USING (((bucket_id = 'private_tickets'::text) AND (EXISTS ( SELECT 1
   FROM ventes v
  WHERE (v.lien_ticket = objects.name)))));

-- ── Droits EXECUTE des fonctions (proacl ; "=X" = PUBLIC) ─────────────────

-- admin_active_kiosque_ids(): postgres=X/postgres service_role=X/postgres
-- clients_normalize_choices(): =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres
-- delete_vente(p_vente_id uuid, p_reason text, p_comment text): postgres=X/postgres authenticated=X/postgres service_role=X/postgres
-- get_admin_alerts(): postgres=X/postgres authenticated=X/postgres service_role=X/postgres
-- get_admin_alerts_scope(): postgres=X/postgres authenticated=X/postgres service_role=X/postgres
-- get_admin_dashboard_stats(p_month_start date, p_prev_start date, p_last30_start date, p_kiosque_ids uuid[]): postgres=X/postgres service_role=X/postgres authenticated=X/postgres
-- get_admin_insights(p_kiosque_ids uuid[], p_start date, p_end date): postgres=X/postgres service_role=X/postgres authenticated=X/postgres
-- get_kiosque_stats(p_kiosque_id uuid, p_mois date): postgres=X/postgres authenticated=X/postgres service_role=X/postgres
-- get_my_kiosque_id(): postgres=X/postgres authenticated=X/postgres service_role=X/postgres
-- get_my_role(): postgres=X/postgres authenticated=X/postgres service_role=X/postgres
-- get_my_supervised_kiosques(): postgres=X/postgres authenticated=X/postgres service_role=X/postgres
-- handle_new_user(): postgres=X/postgres service_role=X/postgres
-- is_admin(): postgres=X/postgres authenticated=X/postgres service_role=X/postgres
-- is_commercial(): postgres=X/postgres authenticated=X/postgres service_role=X/postgres
-- is_supervisor_of(p_kiosque_id uuid): postgres=X/postgres authenticated=X/postgres service_role=X/postgres
-- log_audit(p_action text, p_entity_type text, p_entity_id text, p_details jsonb): postgres=X/postgres authenticated=X/postgres service_role=X/postgres
-- resolve_login_identifier(p_identifier text): =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres
-- ventes_guard_update(): =X/postgres postgres=X/postgres anon=X/postgres authenticated=X/postgres service_role=X/postgres
