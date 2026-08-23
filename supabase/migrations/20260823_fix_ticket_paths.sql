-- ============================================================================
-- Fix legacy ventes.lien_ticket paths (run in the Supabase SQL editor).
--
-- Bug: rows written by the old client look like
--   private_tickets/ticket-multi-<uuid>.pdf
-- (bucket name prefix -> 400 on createSignedUrl, missing kiosque folder ->
-- violates the storage RLS policy). The CURRENT client already writes
--   {kiosque_id}/ticket-{saleId}.pdf  (see src/features/sale/useTicketUpload.ts)
-- so this migration only repairs existing data.
--
-- IMPORTANT: the old client UPLOADED files to {kiosque_id}/ticket-multi-<id>.pdf
-- (folder present, '-multi-' in the name). Blindly rewriting rows to
-- {kiosque_id}/ticket-<id>.pdf would point at objects that do not exist
-- (404 instead of 400). Each step below rewrites rows to the path where the
-- object ACTUALLY lives, verified against storage.objects.
-- ============================================================================

-- ── 0. Diagnostics: what's broken, and where the real objects are ──────────
SELECT
  v.id,
  v.kiosque_id,
  v.lien_ticket,
  nested.id   AS object_nested_id,   -- object exists at {kiosque_id}/<name>
  root.id     AS object_root_id      -- object exists at root level
FROM public.ventes v
LEFT JOIN storage.objects nested
  ON nested.bucket_id = 'private_tickets'
 AND nested.name = v.kiosque_id || '/' || REPLACE(v.lien_ticket, 'private_tickets/', '')
LEFT JOIN storage.objects root
  ON root.bucket_id = 'private_tickets'
 AND root.name = REPLACE(v.lien_ticket, 'private_tickets/', '')
WHERE v.lien_ticket LIKE 'private_tickets/%'
LIMIT 50;

-- ── Step A: object already nested under its kiosque folder (common case) ──
-- Row -> the exact existing object path.
UPDATE public.ventes v
SET lien_ticket = v.kiosque_id || '/' || REPLACE(v.lien_ticket, 'private_tickets/', '')
FROM storage.objects o
WHERE o.bucket_id = 'private_tickets'
  AND o.name = v.kiosque_id || '/' || REPLACE(v.lien_ticket, 'private_tickets/', '')
  AND v.lien_ticket LIKE 'private_tickets/%';

-- ── Step B: object sits at the bucket root (oldest writes) ────────────────
-- Move the object under the kiosque folder (required by the storage RLS
-- policy) and point the row at it. Moving = renaming within the bucket.
UPDATE storage.objects o
SET name = v.kiosque_id || '/' || o.name
FROM public.ventes v
WHERE o.bucket_id = 'private_tickets'
  AND v.lien_ticket LIKE 'private_tickets/%'
  AND o.name = REPLACE(v.lien_ticket, 'private_tickets/', '')
  AND v.kiosque_id IS NOT NULL;

UPDATE public.ventes v
SET lien_ticket = v.kiosque_id || '/' || REPLACE(v.lien_ticket, 'private_tickets/', '')
WHERE v.lien_ticket LIKE 'private_tickets/%'
  AND v.kiosque_id IS NOT NULL;

-- Rows with no kiosque_id cannot be given a valid folder: leave them broken
-- on purpose (they'd violate RLS regardless).
SELECT id, lien_ticket AS still_broken_no_kiosque
FROM public.ventes
WHERE lien_ticket LIKE 'private_tickets/%';

-- ── Step C (OPTIONAL, off by default): naming consistency ─────────────────
-- Renames 'ticket-multi-<id>.pdf' to 'ticket-<id>.pdf' in both rows and
-- objects so every ticket follows the new convention. Only run AFTER steps
-- A+B verify clean; it changes nothing functionally.
--
-- UPDATE storage.objects o
-- SET name = REPLACE(o.name, 'ticket-multi-', 'ticket-')
-- FROM public.ventes v
-- WHERE o.bucket_id = 'private_tickets'
--   AND v.lien_ticket = o.name
--   AND o.name LIKE '%/ticket-multi-%';
--
-- UPDATE public.ventes
-- SET lien_ticket = REPLACE(lien_ticket, 'ticket-multi-', 'ticket-')
-- WHERE lien_ticket LIKE '%/ticket-multi-%';

-- ── Verification ───────────────────────────────────────────────────────────
-- 1) No row still carries the bucket-name prefix:
SELECT count(*) AS remaining_broken
FROM public.ventes
WHERE lien_ticket LIKE 'private_tickets/%';

-- 2) Every non-null ticket path resolves to a real object:
SELECT v.id, v.lien_ticket
FROM public.ventes v
LEFT JOIN storage.objects o
  ON o.bucket_id = 'private_tickets' AND o.name = v.lien_ticket
WHERE v.lien_ticket IS NOT NULL
  AND o.id IS NULL
LIMIT 20;  -- expect 0 rows

-- 3) Sample of corrected paths:
SELECT id, kiosque_id, lien_ticket
FROM public.ventes
WHERE lien_ticket IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
