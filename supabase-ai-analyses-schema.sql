-- Table pour mettre en cache les analyses IA
-- À exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS ai_analyses (
  id BIGSERIAL PRIMARY KEY,
  cache_key TEXT UNIQUE NOT NULL,
  analysis_data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_ai_analyses_cache_key ON ai_analyses(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_expires_at ON ai_analyses(expires_at);

-- Fonction pour nettoyer automatiquement les analyses expirées (optionnel)
CREATE OR REPLACE FUNCTION cleanup_expired_ai_analyses()
RETURNS void AS $$
BEGIN
  DELETE FROM ai_analyses WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_ai_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_analyses_updated_at
  BEFORE UPDATE ON ai_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_analyses_updated_at();

-- RLS (Row Level Security) - optionnel, selon vos besoins
-- ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow service role full access" ON ai_analyses FOR ALL USING (auth.role() = 'service_role');







