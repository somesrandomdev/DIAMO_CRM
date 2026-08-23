-- ============================================================================
-- Supervisor feature verification — run in the Supabase SQL editor.
--
-- Reported bug: "error when linking a commercial to multiple kiosques from
-- the admin UI". The client code sends
--   INSERT INTO commercials_kiosques (commercial_id, kiosque_id) VALUES ...
-- (no id, no assigned_at — both must be auto-generated) and
--   DELETE FROM commercials_kiosques WHERE commercial_id = ... AND kiosque_id IN (...)
--
-- Every query below returns a row ONLY when something is missing/wrong.
-- Empty results everywhere = the database side is correct.
-- ============================================================================

-- 1. Table + columns. commercials_kiosques needs: id uuid (default
--    gen_random_uuid), commercial_id uuid, kiosque_id uuid, assigned_at
--    timestamptz WITH a default (the client insert omits it).
SELECT 'MISSING TABLE commercials_kiosques' AS problem
WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = 'commercials_kiosques');

SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'commercials_kiosques'
ORDER BY ordinal_position;

-- 2. Foreign keys. The dashboard's `.select('kiosques(id, nom)')` embed and
--    referential integrity both require these. A missing FK makes the embed
--    fail with "Could not find a relationship".
SELECT 'MISSING FK commercial_id -> profiles(id)' AS problem
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
  JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'commercials_kiosques' AND kcu.column_name = 'commercial_id'
    AND ccu.table_name = 'profiles' AND ccu.column_name = 'id'
);
SELECT 'MISSING FK kiosque_id -> kiosques(id)' AS problem
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
  JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'commercials_kiosques' AND kcu.column_name = 'kiosque_id'
    AND ccu.table_name = 'kiosques' AND ccu.column_name = 'id'
);

-- 3. UNIQUE (commercial_id, kiosque_id). Without it, a retried insert
--    creates duplicate supervision rows; with it, client retries are safe.
SELECT 'NO UNIQUE (commercial_id, kiosque_id) constraint' AS problem
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes
  WHERE schemaname = 'public' AND tablename = 'commercials_kiosques'
    AND indexdef ~* 'unique.*commercial_id.*kiosque_id|unique.*kiosque_id.*commercial_id'
);

-- 4. RLS enabled + admin write policy. The admin UI writes as the signed-in
--    admin, so a FOR ALL policy with is_admin() (or equivalent) must cover
--    INSERT/DELETE. This lists what actually exists — eyeball the definitions.
SELECT 'RLS NOT ENABLED on commercials_kiosques' AS problem
WHERE NOT EXISTS (
  SELECT 1 FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'commercials_kiosques' AND rowsecurity
);

SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'commercials_kiosques';

-- 5. Helper functions used by the policies above and by the supervised-scope
--    policies on clients/ventes/objectifs.
SELECT 'MISSING FUNCTION is_admin()' AS problem
WHERE NOT EXISTS (SELECT 1 FROM information_schema.routines
                  WHERE routine_schema = 'public' AND routine_name = 'is_admin');
SELECT 'MISSING FUNCTION get_my_supervised_kiosques()' AS problem
WHERE NOT EXISTS (SELECT 1 FROM information_schema.routines
                  WHERE routine_schema = 'public' AND routine_name = 'get_my_supervised_kiosques');
SELECT 'MISSING FUNCTION is_supervisor_of(uuid)' AS problem
WHERE NOT EXISTS (SELECT 1 FROM information_schema.routines
                  WHERE routine_schema = 'public' AND routine_name = 'is_supervisor_of');

-- 6. Supervised-scope policies the commercial dashboard depends on.
--    Expected shapes (names may differ; the USING/WITH CHECK is what matters):
--    clients:   SELECT/UPDATE allowed where is_supervisor_of(kiosque_id)
--    ventes:    SELECT/UPDATE same
--    objectifs: SELECT/INSERT/UPDATE same
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('clients', 'ventes', 'objectifs')
  AND (qual ~* 'supervisor|commercials_kiosques' OR with_check ~* 'supervisor|commercials_kiosques')
ORDER BY tablename, policyname;

-- 7. Sanity: any pre-existing duplicate rows (would break a future UNIQUE).
SELECT commercial_id, kiosque_id, count(*)
FROM public.commercials_kiosques
GROUP BY commercial_id, kiosque_id
HAVING count(*) > 1;
