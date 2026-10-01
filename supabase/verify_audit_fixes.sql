-- ============================================================================
-- Vérification des correctifs 20261003_audit_fixes.sql — éditeur SQL Supabase.
--
-- NE MODIFIE RIEN : tout se passe dans un seul bloc DO qui se termine par une
-- exception volontaire (« VÉRIFICATION TERMINÉE ») → rollback complet, y
-- compris les ventes, profils et comptes de test créés pendant le contrôle.
-- Le message de l'exception EST le rapport : chaque ligne doit finir par OK.
--
-- À lancer AVANT la migration (chaque contrôle doit afficher BUG) puis APRÈS
-- (chaque contrôle doit afficher OK). Les comptes testés sont choisis
-- automatiquement parmi les comptes actifs existants.
-- ============================================================================
DO $verify$
DECLARE
  r text := E'\n';
  m text;
  n int;
  nk int;
  k uuid;     -- kiosque testé (a un fontainier, un commercial, 2 offres, 1 client)
  f uuid;      -- fontainier de k
  f2 uuid;     -- fontainier d'un AUTRE kiosque
  com uuid;    -- commercial qui supervise k
  adm uuid;    -- administrateur actif
  c uuid; o1 uuid; o2 uuid; u uuid;
  key uuid := gen_random_uuid();
  id1 uuid; id2 uuid;
BEGIN
  -- ── Choix des comptes ────────────────────────────────────────────────────
  SELECT p.kiosque_id, p.id, ck.commercial_id INTO k, f, com
  FROM public.profiles p
  JOIN public.commercials_kiosques ck ON ck.kiosque_id = p.kiosque_id
  JOIN public.profiles pc ON pc.id = ck.commercial_id AND pc.role = 'commercial' AND pc.deleted_at IS NULL
  WHERE p.role = 'fontainier' AND p.deleted_at IS NULL
    AND (SELECT count(*) FROM public.offres_kiosque ok WHERE ok.kiosque_id = p.kiosque_id) >= 2
    AND EXISTS (SELECT 1 FROM public.clients cl WHERE cl.kiosque_id = p.kiosque_id)
  LIMIT 1;
  SELECT id INTO f2 FROM public.profiles
  WHERE role = 'fontainier' AND deleted_at IS NULL AND kiosque_id IS NOT NULL AND kiosque_id <> k LIMIT 1;
  SELECT id INTO adm FROM public.profiles WHERE role = 'administrateur' AND deleted_at IS NULL LIMIT 1;
  IF k IS NULL OR f2 IS NULL OR adm IS NULL THEN
    RAISE EXCEPTION 'Jeu de comptes insuffisant pour la vérification (k=%, f2=%, adm=%)', k, f2, adm;
  END IF;
  SELECT id INTO c FROM public.clients WHERE kiosque_id = k LIMIT 1;
  SELECT offre_id INTO o1 FROM public.offres_kiosque WHERE kiosque_id = k ORDER BY offre_id LIMIT 1;
  SELECT offre_id INTO o2 FROM public.offres_kiosque WHERE kiosque_id = k AND offre_id <> o1 ORDER BY offre_id LIMIT 1;

  -- ── En tant que fontainier de k ──────────────────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  INSERT INTO public.ventes (kiosque_id, client_id, offre_id, quantite, montant_total, idempotency_key)
    VALUES (k, c, o1, 1, 500, key) RETURNING id INTO id1;
  BEGIN
    INSERT INTO public.ventes (kiosque_id, client_id, offre_id, quantite, montant_total, idempotency_key)
      VALUES (k, c, o2, 2, 1000, key) RETURNING id INTO id2;
    r := r || E'A1 panier 2 offres, même clé : 2 lignes enregistrées ........ OK\n';
  EXCEPTION WHEN unique_violation THEN
    r := r || E'A1 panier 2 offres, même clé : 2e offre REJETÉE ............. BUG\n';
  END;
  BEGIN
    INSERT INTO public.ventes (kiosque_id, client_id, offre_id, quantite, montant_total, idempotency_key)
      VALUES (k, c, o1, 1, 500, key);
    r := r || E'A1 retry de la même offre : ACCEPTÉ (doublon) ............... BUG\n';
  EXCEPTION WHEN unique_violation THEN
    r := r || E'A1 retry de la même offre : rejeté (23505) ................... OK\n';
  END;

  BEGIN
    INSERT INTO public.tech_logs (level, source, message, route, user_id) VALUES ('info', 'verify', 'x', '/verify', f);
    r := r || E'A2 tech_logs accepte la colonne route ......................... OK\n';
  EXCEPTION WHEN OTHERS THEN
    r := r || 'A2 tech_logs refuse route (' || SQLSTATE || E') ....................... BUG\n';
  END;

  BEGIN
    UPDATE public.ventes SET montant_total = 0 WHERE id = id1;
    GET DIAGNOSTICS n = ROW_COUNT;
    r := r || CASE WHEN n > 0 THEN E'A5 fontainier modifie montant_total ............................ BUG\n'
                              ELSE E'A5 fontainier modifie montant_total : aucune ligne ............ OK\n' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || 'A5 fontainier modifie montant_total : refusé (' || SQLSTATE || E') ...... OK\n';
  END;
  BEGIN
    UPDATE public.ventes SET lien_ticket = k::text || '/ticket-' || id1 || '.pdf' WHERE id = id1;
    GET DIAGNOSTICS n = ROW_COUNT;
    r := r || CASE WHEN n = 1 THEN E'A5 fontainier écrit lien_ticket (flux normal) .................. OK\n'
                              ELSE E'A5 fontainier ne peut plus écrire lien_ticket ................... BUG\n' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || 'A5 fontainier ne peut plus écrire lien_ticket (' || SQLSTATE || E') ..... BUG\n';
  END;
  EXECUTE 'RESET ROLE';

  -- ── En tant que fontainier d'un AUTRE kiosque ────────────────────────────
  PERFORM set_config('request.jwt.claims', json_build_object('sub', f2, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  -- Tout objet hors de SON dossier kiosque (autres kiosques ET fichiers à la
  -- racine du bucket, où dorment d'anciens tickets).
  SELECT count(*) INTO n FROM storage.objects
  WHERE bucket_id = 'private_tickets'
    AND COALESCE((storage.foldername(name))[1], '') <> COALESCE((SELECT kiosque_id::text FROM public.profiles WHERE id = f2), '');
  r := r || CASE WHEN n > 0 THEN 'A6 fontainier lit ' || n || E' tickets hors de son kiosque ......... BUG\n'
                            ELSE E'A6 fontainier ne lit aucun ticket hors de son kiosque ........... OK\n' END;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('private_tickets', k::text || '/verify.pdf');
    r := r || E'A6 autre kiosque dépose un ticket dans k ....................... BUG\n';
  EXCEPTION WHEN OTHERS THEN
    r := r || E'A6 autre kiosque dépose un ticket dans k : refusé ............. OK\n';
  END;
  EXECUTE 'RESET ROLE';

  -- ── En tant que commercial superviseur de k ──────────────────────────────
  -- Total réel des tickets de k (sans RLS), puis ce que voit le commercial.
  SELECT count(*) INTO nk FROM storage.objects
  WHERE bucket_id = 'private_tickets' AND (storage.foldername(name))[1] = k::text;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', com, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM storage.objects
  WHERE bucket_id = 'private_tickets' AND (storage.foldername(name))[1] = k::text;
  r := r || CASE WHEN n = nk THEN 'A6 commercial lit les ' || nk || E' tickets de son kiosque supervisé .... OK\n'
                             ELSE 'A6 commercial ne voit que ' || n || '/' || nk || E' tickets de son kiosque .. BUG\n' END;
  IF id2 IS NOT NULL THEN
    BEGIN
      SELECT public.delete_vente(id1, 'Erreur de saisie', NULL)::text INTO m;
      r := r || CASE WHEN m LIKE '%"had_siblings" : true%' OR m LIKE '%"had_siblings": true%' OR m LIKE '%had_siblings":true%'
                     THEN E'A8 delete_vente (commercial) : had_siblings = true ............. OK\n'
                     ELSE 'A8 delete_vente (commercial) : ' || m || E' ... BUG\n' END;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS m = MESSAGE_TEXT;
      r := r || 'A8 delete_vente (commercial) ÉCHOUE : ' || m || E' ... BUG\n';
    END;
  END IF;
  EXECUTE 'RESET ROLE';
  IF id2 IS NOT NULL THEN
    SELECT lien_ticket INTO m FROM public.ventes WHERE id = id2;
    r := r || CASE WHEN m IS NOT NULL THEN E'A8 ticket reporté sur la ligne restante du panier ............. OK\n'
                                      ELSE E'A8 ticket perdu pour la ligne restante du panier ............... BUG\n' END;
  END IF;

  -- ── Compte désactivé (corbeille) ─────────────────────────────────────────
  UPDATE public.profiles SET deleted_at = now() WHERE id = f;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    INSERT INTO public.ventes (kiosque_id, client_id, offre_id, quantite, montant_total, idempotency_key)
      VALUES (k, c, o1, 1, 500, gen_random_uuid());
    r := r || E'A4 compte désactivé enregistre une vente ....................... BUG\n';
  EXCEPTION WHEN OTHERS THEN
    r := r || E'A4 compte désactivé enregistre une vente : refusé ............. OK\n';
  END;
  BEGIN
    UPDATE public.profiles SET deleted_at = NULL WHERE id = f;
    GET DIAGNOSTICS n = ROW_COUNT;
    r := r || CASE WHEN n > 0 THEN E'A4 compte désactivé se restaure lui-même ....................... BUG\n'
                              ELSE E'A4 compte désactivé se restaure lui-même : aucune ligne ........ OK\n' END;
  EXCEPTION WHEN OTHERS THEN
    r := r || E'A4 compte désactivé se restaure lui-même : refusé ............. OK\n';
  END;
  SELECT count(*) INTO n FROM public.profiles WHERE id = f;
  r := r || CASE WHEN n = 1 THEN E'A4 compte désactivé lit son profil (écran « désactivé ») ........ OK\n'
                            ELSE E'A4 compte désactivé ne lit plus son profil ...................... BUG\n' END;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := r || CASE WHEN public.is_admin() THEN E'A4 admin actif garde ses droits .................................. OK\n'
                                        ELSE E'A4 admin actif a PERDU ses droits ................................ BUG\n' END;
  EXECUTE 'RESET ROLE';

  -- ── Inscription publique avec role=administrateur en metadata ────────────
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'verify-' || replace(gen_random_uuid()::text, '-', '') || '@example.invalid',
            json_build_object('role', 'administrateur', 'username', 'verify_' || left(md5(random()::text), 8),
                              'kiosque_id', k)::jsonb,
            now(), now())
    RETURNING id INTO u;
  SELECT role INTO m FROM public.profiles WHERE id = u;
  r := r || CASE WHEN m = 'fontainier' THEN E'A3 signup avec role=administrateur → profil fontainier ......... OK\n'
                 ELSE 'A3 signup avec role=administrateur → profil ' || COALESCE(m, '∅') || E' ...... BUG\n' END;

  RAISE EXCEPTION 'VÉRIFICATION TERMINÉE (rollback volontaire, rien n''est modifié) :%', r;
END $verify$;
