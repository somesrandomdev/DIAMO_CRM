-- Requêtes de lecture seule pour régénérer prod_snapshot.sql (SQL editor).
-- Chaque requête renvoie UNE cellule texte à coller dans la section voulue.

-- 1. Tables (colonnes, défauts, contraintes, RLS)
SELECT string_agg(
  'CREATE TABLE public.' || quote_ident(c.relname) || E' (\n' ||
  (SELECT string_agg('  ' || quote_ident(a.attname) || ' ' || format_type(a.atttypid, a.atttypmod)
      || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END
      || coalesce(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), ''), E',\n' ORDER BY a.attnum)
   FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
   WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped)
  || coalesce((SELECT E',\n' || string_agg('  CONSTRAINT ' || quote_ident(co.conname) || ' ' || pg_get_constraintdef(co.oid), E',\n' ORDER BY co.contype, co.conname)
               FROM pg_constraint co WHERE co.conrelid = c.oid), '')
  || E'\n);' || CASE WHEN c.relrowsecurity THEN E'\nALTER TABLE public.' || quote_ident(c.relname) || ' ENABLE ROW LEVEL SECURITY;' ELSE '' END,
  E'\n\n' ORDER BY c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';

-- 2. Fonctions
SELECT string_agg(pg_get_functiondef(p.oid) || ';', E'\n\n' ORDER BY p.proname)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p')
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e');

-- 3. Policies (public + storage)
SELECT string_agg(
  'CREATE POLICY ' || quote_ident(policyname) || ' ON ' || schemaname || '.' || quote_ident(tablename)
  || CASE WHEN permissive = 'RESTRICTIVE' THEN ' AS RESTRICTIVE' ELSE '' END
  || ' FOR ' || cmd || ' TO ' || array_to_string(roles, ', ')
  || coalesce(E'\n  USING (' || qual || ')', '')
  || coalesce(E'\n  WITH CHECK (' || with_check || ')', '') || ';', E'\n\n' ORDER BY schemaname, tablename, policyname)
FROM pg_policies WHERE schemaname IN ('public', 'storage');

-- 4. Index, triggers, vues, droits EXECUTE
SELECT string_agg(indexdef || ';', E'\n' ORDER BY tablename, indexname)
FROM pg_indexes i WHERE schemaname = 'public'
  AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname = i.indexname);

SELECT string_agg(pg_get_triggerdef(t.oid) || ';', E'\n' ORDER BY t.tgname)
FROM pg_trigger t
WHERE NOT t.tgisinternal
  AND (t.tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace) OR t.tgrelid = 'auth.users'::regclass);

SELECT string_agg('CREATE OR REPLACE VIEW public.' || quote_ident(viewname) || E' AS\n' || definition, E'\n\n')
FROM pg_views WHERE schemaname = 'public';

SELECT string_agg('-- ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || '): '
  || coalesce(array_to_string(p.proacl, ' '), 'default (PUBLIC)'), E'\n' ORDER BY p.proname)
FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
  AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e');
