-- Migration : Support Financial Juice RSS
-- Date : 2025-01-XX
-- Description : Ajoute les tables et index nécessaires pour le système de filtrage RSS

-- ============================================
-- 1. Table de keywords pour filtrage RSS
-- ============================================
CREATE TABLE IF NOT EXISTS rss_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE,
  category TEXT, -- 'macro', 'forex', 'crypto', 'earnings', 'geopolitical', etc.
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rss_keywords_enabled 
ON rss_keywords(keyword) 
WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_rss_keywords_category 
ON rss_keywords(category) 
WHERE enabled = true;

-- ============================================
-- 2. Table de configuration webhooks
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('discord', 'slack', 'telegram')),
  url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  min_priority INTEGER DEFAULT 7 CHECK (min_priority BETWEEN 1 AND 10),
  filters JSONB DEFAULT '{}'::jsonb, -- Ex: {"categories": ["macro"], "keywords": ["Fed"]}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_configs_enabled 
ON webhook_configs(enabled) 
WHERE enabled = true;

-- ============================================
-- 3. Index pour améliorer les performances de déduplication
-- ============================================
-- Index sur guid dans raw_data (pour déduplication rapide)
CREATE INDEX IF NOT EXISTS idx_signals_guid 
ON signals USING gin((raw_data->>'guid'));

-- Index sur url dans raw_data (fallback si pas de guid)
CREATE INDEX IF NOT EXISTS idx_signals_url 
ON signals USING gin((raw_data->>'url'));

-- ============================================
-- 4. Keywords par défaut (Macro, Forex, Crypto)
-- ============================================
INSERT INTO rss_keywords (keyword, category, priority) VALUES
  -- Macro (Priorité 10 - Critical)
  ('Fed', 'macro', 10),
  ('Federal Reserve', 'macro', 10),
  ('FOMC', 'macro', 10),
  ('Nonfarm Payrolls', 'macro', 10),
  ('NFP', 'macro', 10),
  ('CPI', 'macro', 9),
  ('Consumer Price Index', 'macro', 9),
  ('GDP', 'macro', 9),
  ('Gross Domestic Product', 'macro', 9),
  ('PCE', 'macro', 9),
  ('Personal Consumption Expenditures', 'macro', 9),
  ('Unemployment', 'macro', 8),
  ('Jobless Claims', 'macro', 8),
  ('Retail Sales', 'macro', 8),
  ('Industrial Production', 'macro', 7),
  
  -- Forex (Priorité 8)
  ('ECB', 'forex', 8),
  ('European Central Bank', 'forex', 8),
  ('BoJ', 'forex', 8),
  ('Bank of Japan', 'forex', 8),
  ('BoE', 'forex', 8),
  ('Bank of England', 'forex', 8),
  ('SNB', 'forex', 7),
  ('Swiss National Bank', 'forex', 7),
  ('RBA', 'forex', 7),
  ('Reserve Bank of Australia', 'forex', 7),
  ('RBNZ', 'forex', 7),
  ('Reserve Bank of New Zealand', 'forex', 7),
  
  -- Crypto (Priorité 7)
  ('Bitcoin', 'crypto', 7),
  ('BTC', 'crypto', 7),
  ('Ethereum', 'crypto', 7),
  ('ETH', 'crypto', 7),
  ('Crypto', 'crypto', 6),
  ('Cryptocurrency', 'crypto', 6),
  
  -- Earnings (Priorité 6)
  ('Earnings', 'earnings', 6),
  ('Q1', 'earnings', 6),
  ('Q2', 'earnings', 6),
  ('Q3', 'earnings', 6),
  ('Q4', 'earnings', 6),
  ('Quarterly', 'earnings', 6),
  
  -- Geopolitical (Priorité 9)
  ('Tariff', 'geopolitical', 9),
  ('Trade War', 'geopolitical', 9),
  ('Sanctions', 'geopolitical', 9),
  ('Embargo', 'geopolitical', 9),
  ('OPEC', 'geopolitical', 8),
  ('Oil', 'geopolitical', 7),
  ('Crude', 'geopolitical', 7),
  
  -- Commodities (Priorité 6)
  ('Gold', 'commodity', 6),
  ('Silver', 'commodity', 6),
  ('Copper', 'commodity', 6),
  ('Wheat', 'commodity', 5),
  ('Corn', 'commodity', 5)
ON CONFLICT (keyword) DO NOTHING;

-- ============================================
-- 5. Fonction pour mettre à jour updated_at automatiquement
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rss_keywords_updated_at
BEFORE UPDATE ON rss_keywords
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_configs_updated_at
BEFORE UPDATE ON webhook_configs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. Vues utiles pour monitoring
-- ============================================
CREATE OR REPLACE VIEW v_rss_signals_summary AS
SELECT 
  source,
  type,
  DATE(timestamp) as date,
  COUNT(*) as signal_count,
  COUNT(*) FILTER (WHERE processing_status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE processing_status = 'completed') as completed_count,
  AVG((raw_data->>'priority')::INTEGER) as avg_priority
FROM signals
WHERE source = 'rss'
GROUP BY source, type, DATE(timestamp)
ORDER BY date DESC, signal_count DESC;

-- ============================================
-- 7. Commentaires pour documentation
-- ============================================
COMMENT ON TABLE rss_keywords IS 'Keywords pour filtrer les news RSS importantes';
COMMENT ON TABLE webhook_configs IS 'Configuration des webhooks pour alertes (Discord, Slack, Telegram)';
COMMENT ON VIEW v_rss_signals_summary IS 'Vue récapitulative des signaux RSS par jour';


