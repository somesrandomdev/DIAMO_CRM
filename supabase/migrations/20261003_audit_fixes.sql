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
