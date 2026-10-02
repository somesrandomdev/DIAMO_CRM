-- Intégrité des données : liens de tickets morts + valeurs clients sans accents.
-- Idempotent. Aucune suppression de données.

-- ── 1. Tickets : 224 ventes pointaient vers un PDF inexistant ─────────────
-- La migration 20260823 a réécrit les liens en {kiosque_id}/ticket-<id>.pdf
-- sans que les fichiers soient déplacés : ils sont restés à la racine du
-- bucket sous ticket-multi-<id vente>.pdf. On repointe chaque vente vers le
-- fichier qui EXISTE (vérifié dans storage.objects) ; aucun fichier n'est
-- déplacé (renommer storage.objects en SQL casserait le lien vers S3).
UPDATE public.ventes v
SET lien_ticket = o.name
FROM storage.objects o
WHERE o.bucket_id = 'private_tickets'
  AND o.name = 'ticket-multi-' || v.id || '.pdf'
  AND v.lien_ticket IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM storage.objects cur
    WHERE cur.bucket_id = 'private_tickets' AND cur.name = v.lien_ticket
  );

-- Ces fichiers racine n'ont pas de dossier kiosque : les policies
-- tickets_select_own_kiosque / _supervised ne les couvrent pas (seul l'admin
-- pouvait les lire). Lecture autorisée à quiconque VOIT la vente : la
-- sous-requête sur ventes applique la RLS de ventes (fontainier = son
-- kiosque, commercial = kiosques supervisés).
CREATE INDEX IF NOT EXISTS idx_ventes_lien_ticket ON public.ventes (lien_ticket)
  WHERE lien_ticket IS NOT NULL;

DROP POLICY IF EXISTS tickets_select_via_vente ON storage.objects;
CREATE POLICY tickets_select_via_vente ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'private_tickets'
    AND EXISTS (SELECT 1 FROM public.ventes v WHERE v.lien_ticket = storage.objects.name)
  );

-- ── 2. Valeurs clients : une seule orthographe, accentuée ─────────────────
UPDATE public.clients SET preference_contact = 'Téléphone' WHERE preference_contact = 'Telephone';
UPDATE public.clients SET contenant_prefere = 'Réservoir' WHERE contenant_prefere = 'Reservoir';

-- Les apps pas encore mises à jour et la file hors-ligne peuvent encore
-- envoyer l'ancienne valeur : normalisée à l'écriture (pas de contrainte,
-- qui ferait échouer la synchronisation des clients en file).
CREATE OR REPLACE FUNCTION public.clients_normalize_choices()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.preference_contact = 'Telephone' THEN NEW.preference_contact := 'Téléphone'; END IF;
  IF NEW.contenant_prefere = 'Reservoir' THEN NEW.contenant_prefere := 'Réservoir'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER clients_normalize_choices
  BEFORE INSERT OR UPDATE OF preference_contact, contenant_prefere ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_normalize_choices();

-- Contrôle :
--   SELECT count(*) FILTER (WHERE o.id IS NULL) AS liens_morts
--   FROM public.ventes v
--   LEFT JOIN storage.objects o ON o.bucket_id = 'private_tickets' AND o.name = v.lien_ticket
--   WHERE v.lien_ticket IS NOT NULL;                       -- attendu : 0
--   SELECT preference_contact, count(*) FROM public.clients GROUP BY 1;  -- plus de 'Telephone'
