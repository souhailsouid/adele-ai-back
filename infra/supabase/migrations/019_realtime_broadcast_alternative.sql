-- Migration Alternative : Realtime avec Broadcast + Triggers (Méthode Recommandée)
-- Date : 2025-12-27
-- Description : Méthode recommandée par Supabase pour Realtime
-- 
-- IMPORTANT : Cette migration utilise broadcast + triggers (recommandé par Supabase)
-- Plus fiable, scalable et performant que postgres_changes
-- Le frontend doit utiliser 'broadcast' (pas 'postgres_changes')

-- ============================================
-- 1. Créer la fonction trigger de diffusion
-- ============================================
-- Cette fonction envoie un broadcast via realtime.send quand la table signals change
CREATE OR REPLACE FUNCTION signals_broadcast_trigger()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  event_type TEXT;
BEGIN
  -- Déterminer le type d'événement
  event_type := TG_OP; -- 'INSERT' | 'UPDATE' | 'DELETE'
  
  -- Construire le payload avec les données du signal
  IF TG_OP = 'DELETE' THEN
    payload := row_to_json(OLD)::jsonb;
  ELSE
    payload := row_to_json(NEW)::jsonb;
  END IF;
  
  -- Envoyer un broadcast via insertion dans realtime.messages
  -- Le frontend écoutera via 'broadcast' sur le topic 'signals:events'
  -- Note: La colonne 'extension' est requise par Supabase
  INSERT INTO realtime.messages (topic, payload, extension)
  VALUES (
    'signals:events',  -- Topic global pour tous les signaux
    json_build_object(
      'event', event_type,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'data', payload
    )::jsonb,
    '{}'::jsonb  -- Extension requise (vide par défaut)
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. Créer le trigger sur la table signals
-- ============================================
DROP TRIGGER IF EXISTS signals_broadcast_trigger ON public.signals;
CREATE TRIGGER signals_broadcast_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.signals
FOR EACH ROW 
EXECUTE FUNCTION signals_broadcast_trigger();

-- ============================================
-- 3. Configurer RLS sur realtime.messages
-- ============================================
-- Permet au trigger d'insérer et au frontend de lire

-- Activer RLS sur realtime.messages si pas déjà activé
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Policy : Permettre la lecture pour anon (frontend)
DROP POLICY IF EXISTS "realtime_messages_select_for_anon" ON realtime.messages;
CREATE POLICY "realtime_messages_select_for_anon" ON realtime.messages
FOR SELECT 
TO anon
USING (topic = 'signals:events');

-- Policy : Permettre l'insertion pour service_role (trigger)
DROP POLICY IF EXISTS "realtime_messages_insert_for_service_role" ON realtime.messages;
CREATE POLICY "realtime_messages_insert_for_service_role" ON realtime.messages
FOR INSERT 
TO service_role
WITH CHECK (topic = 'signals:events');

-- ============================================
-- 4. Vérification
-- ============================================
-- Vérifier que la fonction existe
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_schema = 'public' AND routine_name = 'signals_broadcast_trigger';
-- Doit retourner : signals_broadcast_trigger

-- Vérifier que le trigger existe
-- SELECT trigger_name FROM information_schema.triggers 
-- WHERE event_object_table = 'signals' AND trigger_name = 'signals_broadcast_trigger';
-- Doit retourner : signals_broadcast_trigger

-- ============================================
-- 5. Frontend : Utilisation
-- ============================================
-- Le frontend doit utiliser 'broadcast' (pas 'postgres_changes') :
--
-- ```typescript
-- const channel = supabase
--   .channel('signals:events', { config: { private: true } })
--   .on('broadcast', { event: '*' }, (payload) => {
--     const signal = payload.payload.data as Signal;
--     const eventType = payload.payload.event; // 'INSERT' | 'UPDATE' | 'DELETE'
--     // Traiter le signal selon l'événement
--   })
--   .subscribe();
-- ```

-- ============================================
-- 6. Commentaires
-- ============================================
COMMENT ON FUNCTION signals_broadcast_trigger IS 'Fonction trigger qui diffuse les changements de la table signals via Realtime broadcast (méthode recommandée)';
COMMENT ON TRIGGER signals_broadcast_trigger ON signals IS 'Trigger qui appelle signals_broadcast_trigger() après INSERT/UPDATE/DELETE pour diffuser via broadcast';

