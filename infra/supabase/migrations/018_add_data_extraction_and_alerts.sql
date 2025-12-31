-- Migration : Extraction de données structurées et alertes temps réel
-- Date : 2025-12-27
-- Description : Ajoute le support pour extraction de données et alertes temps réel
-- 
-- NOTE : Les alertes peuvent être utilisées de 2 façons :
-- 1. Frontend : Via Supabase Realtime (recommandé) - Pas besoin de Discord
-- 2. Backend : Via worker Lambda alert-sender → Discord/Slack (optionnel)

-- ============================================
-- 1. Ajouter colonne extracted_data à signals
-- ============================================
ALTER TABLE signals 
ADD COLUMN IF NOT EXISTS extracted_data JSONB;

-- Schéma JSON fixe pour extracted_data (validation)
-- Structure garantie pour le frontend :
-- {
--   "actual": number,           -- Valeur réelle (toujours présent si extraction réussie)
--   "forecast": number,         -- Prévision (optionnel)
--   "previous": number,         -- Valeur précédente (optionnel)
--   "dataType": string,         -- 'inflation' | 'gdp' | 'employment' | 'retail_sales' | 'industrial_production' | 'other'
--   "indicator": string,        -- 'CPI', 'GDP', 'NFP', etc.
--   "surprise": string,         -- 'positive' | 'negative' | 'neutral'
--   "surpriseMagnitude": number, -- Différence en points de pourcentage
--   "unit": string,             -- 'percent' | 'absolute' | 'index'
--   "period": string,           -- 'monthly' | 'quarterly' | 'yearly'
--   "region": string            -- 'US' | 'JP' | 'EU' | 'CN'
-- }
--
-- Contrainte de validation (optionnel, peut être ajoutée plus tard si nécessaire)
-- ALTER TABLE signals ADD CONSTRAINT extracted_data_schema_check
-- CHECK (
--   extracted_data IS NULL OR
--   (
--     extracted_data ? 'actual' AND
--     jsonb_typeof(extracted_data->'actual') = 'number'
--   )
-- );

-- Index pour recherche rapide sur extracted_data
CREATE INDEX IF NOT EXISTS idx_signals_extracted_data 
ON signals USING gin(extracted_data);

-- Index pour recherche sur surprise
CREATE INDEX IF NOT EXISTS idx_signals_surprise 
ON signals((extracted_data->>'surprise')) 
WHERE extracted_data IS NOT NULL;

-- Index pour recherche sur actual (valeur principale)
CREATE INDEX IF NOT EXISTS idx_signals_extracted_actual 
ON signals((extracted_data->>'actual')) 
WHERE extracted_data IS NOT NULL;

-- Index pour recherche sur indicator
CREATE INDEX IF NOT EXISTS idx_signals_extracted_indicator 
ON signals((extracted_data->>'indicator')) 
WHERE extracted_data IS NOT NULL;

-- ============================================
-- 2. Table de configuration des alertes
-- ============================================
CREATE TABLE IF NOT EXISTS alert_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  notification_channels TEXT[] DEFAULT ARRAY['discord']::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_keywords_enabled 
ON alert_keywords(keyword) 
WHERE enabled = true;

-- Insérer les keywords critiques par défaut
INSERT INTO alert_keywords (keyword, priority, notification_channels) VALUES
  ('Trump', 10, ARRAY['discord', 'slack']),
  ('Zelenskiy', 9, ARRAY['discord']),
  ('CPI', 9, ARRAY['discord']),
  ('Musk', 8, ARRAY['discord']),
  ('BTC', 7, ARRAY['discord']),
  ('Bitcoin', 7, ARRAY['discord']),
  ('TSLA', 7, ARRAY['discord']),
  ('Tesla', 7, ARRAY['discord']),
  ('AI', 6, ARRAY['discord']),
  ('GDP', 9, ARRAY['discord']),
  ('NFP', 9, ARRAY['discord']),
  ('Nonfarm Payrolls', 9, ARRAY['discord']),
  ('Fed', 10, ARRAY['discord', 'slack']),
  ('Federal Reserve', 10, ARRAY['discord', 'slack']),
  ('FOMC', 10, ARRAY['discord', 'slack'])
ON CONFLICT (keyword) DO NOTHING;

-- ============================================
-- 3. Table pour stocker les alertes envoyées
-- ============================================
CREATE TABLE IF NOT EXISTS alerts_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  channel TEXT NOT NULL, -- 'discord', 'slack', 'telegram'
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  
  CONSTRAINT fk_signal FOREIGN KEY (signal_id) REFERENCES signals(id)
);

CREATE INDEX IF NOT EXISTS idx_alerts_sent_signal_id 
ON alerts_sent(signal_id);

CREATE INDEX IF NOT EXISTS idx_alerts_sent_sent_at 
ON alerts_sent(sent_at DESC);

-- ============================================
-- 4. Fonction pour vérifier si un signal doit déclencher une alerte
-- ============================================
CREATE OR REPLACE FUNCTION should_trigger_alert(signal_row signals)
RETURNS BOOLEAN AS $$
DECLARE
  keyword_record RECORD;
  text_content TEXT;
BEGIN
  -- Construire le texte à analyser (titre + description)
  text_content := LOWER(
    COALESCE(signal_row.raw_data->>'title', '') || ' ' || 
    COALESCE(signal_row.raw_data->>'description', '')
  );
  
  -- Chercher les keywords activés
  FOR keyword_record IN 
    SELECT keyword, priority, notification_channels
    FROM alert_keywords
    WHERE enabled = true
  LOOP
    -- Vérifier si le keyword est présent dans le texte
    IF text_content LIKE '%' || LOWER(keyword_record.keyword) || '%' THEN
      RETURN TRUE;
    END IF;
  END LOOP;
  
  -- Vérifier aussi si extracted_data contient une surprise significative
  IF signal_row.extracted_data IS NOT NULL THEN
    IF signal_row.extracted_data->>'surprise' IN ('positive', 'negative') THEN
      -- Vérifier la magnitude de la surprise
      IF (signal_row.extracted_data->>'surpriseMagnitude')::NUMERIC > 0.2 THEN
        RETURN TRUE;
      END IF;
    END IF;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Trigger pour déclencher une alerte lors de l'insertion d'un signal
-- ============================================
CREATE OR REPLACE FUNCTION trigger_alert_on_signal()
RETURNS TRIGGER AS $$
DECLARE
  keyword_record RECORD;
  text_content TEXT;
  channel TEXT;
BEGIN
  -- Construire le texte à analyser
  text_content := LOWER(
    COALESCE(NEW.raw_data->>'title', '') || ' ' || 
    COALESCE(NEW.raw_data->>'description', '')
  );
  
  -- Chercher les keywords activés
  FOR keyword_record IN 
    SELECT keyword, priority, notification_channels
    FROM alert_keywords
    WHERE enabled = true
  LOOP
    -- Vérifier si le keyword est présent
    IF text_content LIKE '%' || LOWER(keyword_record.keyword) || '%' THEN
      -- Envoyer une alerte pour chaque canal configuré
      FOREACH channel IN ARRAY keyword_record.notification_channels
      LOOP
        -- Insérer dans alerts_sent (le worker Lambda traitera l'envoi)
        INSERT INTO alerts_sent (signal_id, keyword, channel, status)
        VALUES (NEW.id, keyword_record.keyword, channel, 'pending')
        ON CONFLICT DO NOTHING;
      END LOOP;
    END IF;
  END LOOP;
  
  -- Vérifier aussi les surprises significatives
  IF NEW.extracted_data IS NOT NULL THEN
    IF NEW.extracted_data->>'surprise' IN ('positive', 'negative') THEN
      IF (NEW.extracted_data->>'surpriseMagnitude')::NUMERIC > 0.2 THEN
        -- Alerte pour surprise économique significative
        INSERT INTO alerts_sent (signal_id, keyword, channel, status)
        VALUES (
          NEW.id, 
          COALESCE(NEW.extracted_data->>'indicator', 'Economic Surprise'),
          'discord',
          'pending'
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger
DROP TRIGGER IF EXISTS trigger_alert_on_signal_insert ON signals;
CREATE TRIGGER trigger_alert_on_signal_insert
AFTER INSERT ON signals
FOR EACH ROW
WHEN (NEW.source = 'rss')
EXECUTE FUNCTION trigger_alert_on_signal();

-- ============================================
-- 6. Fonction pour mettre à jour updated_at automatiquement
-- ============================================
CREATE OR REPLACE FUNCTION update_alert_keywords_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS update_alert_keywords_updated_at ON alert_keywords;

-- Créer le trigger
CREATE TRIGGER update_alert_keywords_updated_at
BEFORE UPDATE ON alert_keywords
FOR EACH ROW
EXECUTE FUNCTION update_alert_keywords_updated_at();

-- ============================================
-- 7. Vue pour monitoring des alertes
-- ============================================
CREATE OR REPLACE VIEW v_alerts_summary AS
SELECT 
  DATE(sent_at) as date,
  channel,
  status,
  COUNT(*) as alert_count,
  COUNT(DISTINCT signal_id) as unique_signals
FROM alerts_sent
GROUP BY DATE(sent_at), channel, status
ORDER BY date DESC, channel, status;

-- ============================================
-- 8. Activer Supabase Realtime pour le Frontend
-- ============================================
-- MÉTHODE 1 : Publication Standard (Recommandée si disponible)
-- IMPORTANT : Cette commande SQL active Realtime, MAIS vous devez AUSSI :
-- 1. Aller dans Supabase Dashboard → Database → Replication
-- 2. Trouver la table "signals"
-- 3. Cocher "Enable Realtime" pour la table signals
-- 4. Sauvegarder
--
-- Si cette méthode ne fonctionne pas, utilisez la MÉTHODE 2 (migration 019)
-- Permet au frontend de s'abonner aux nouveaux signaux en temps réel
-- Note: Si la table est déjà dans la publication, cette commande peut échouer
-- C'est normal, cela signifie que Realtime est déjà activé
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'signals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE signals;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Si la publication n'existe pas ou ne fonctionne pas,
    -- utiliser la méthode alternative (migration 019)
    RAISE NOTICE 'Publication standard non disponible. Utilisez la migration 019_realtime_broadcast_alternative.sql';
END $$;

-- Vérification que Realtime est activé
-- Exécuter cette requête pour vérifier :
-- SELECT * FROM pg_publication_tables WHERE tablename = 'signals';
-- Doit retourner une ligne avec tablename = 'signals'
--
-- Si cette requête retourne vide, utilisez la migration alternative :
-- infra/supabase/migrations/019_realtime_broadcast_alternative.sql

-- ============================================
-- 9. Sécurité RLS (Row Level Security)
-- ============================================
-- Permet au frontend (via clé API anon) de LIRE les signaux mais pas de les modifier

-- Activer RLS sur signals si pas déjà activé
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;

-- Policy : Permettre la lecture (SELECT) à tous les utilisateurs authentifiés
-- Cette policy permet au frontend d'utiliser la clé API anon pour lire les signaux
DROP POLICY IF EXISTS "Allow read signals" ON signals;
CREATE POLICY "Allow read signals" ON signals
  FOR SELECT
  USING (true); -- Permet la lecture à tous (y compris clé anon)

-- Policy : Permettre les modifications (INSERT/UPDATE/DELETE) seulement au backend
-- Seul le backend (service_role) peut modifier les signaux
-- Note: Par défaut, RLS bloque tout. Cette policy permet seulement service_role.
DROP POLICY IF EXISTS "Allow write signals for service_role" ON signals;
CREATE POLICY "Allow write signals for service_role" ON signals
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow update signals for service_role" ON signals;
CREATE POLICY "Allow update signals for service_role" ON signals
  FOR UPDATE
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow delete signals for service_role" ON signals;
CREATE POLICY "Allow delete signals for service_role" ON signals
  FOR DELETE
  USING (auth.role() = 'service_role');

-- Activer RLS sur alert_keywords (lecture seule pour frontend)
ALTER TABLE alert_keywords ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read alert_keywords" ON alert_keywords;
CREATE POLICY "Allow read alert_keywords" ON alert_keywords
  FOR SELECT
  USING (true);

-- Activer RLS sur alerts_sent (lecture seule pour frontend)
ALTER TABLE alerts_sent ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read alerts_sent" ON alerts_sent;
CREATE POLICY "Allow read alerts_sent" ON alerts_sent
  FOR SELECT
  USING (true);

-- ============================================
-- 10. Commentaires
-- ============================================
COMMENT ON TABLE alert_keywords IS 'Keywords critiques pour déclencher des alertes temps réel';
COMMENT ON TABLE alerts_sent IS 'Historique des alertes envoyées (backend Discord/Slack - optionnel)';
COMMENT ON FUNCTION should_trigger_alert IS 'Vérifie si un signal doit déclencher une alerte';
COMMENT ON FUNCTION trigger_alert_on_signal IS 'Trigger qui crée une alerte lors de l insertion d un signal RSS';
COMMENT ON COLUMN signals.extracted_data IS 'Données structurées extraites (actual, forecast, surprise) - Utilisé par le frontend. Schéma fixe : actual (number), forecast (number), previous (number), dataType (string), indicator (string), surprise (string), surpriseMagnitude (number), unit (string), period (string), region (string)';

