-- Migration : Table fmp_signals pour stocker les alertes de marché FMP
-- Date : 2025-12-28
-- Description : Stockage des signaux détectés (≥2 signaux concordants) sans système de scoring

-- ============================================
-- 1. Créer la table fmp_signals
-- ============================================
CREATE TABLE IF NOT EXISTS fmp_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(10) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('bullish', 'bearish', 'neutral')),
  severity VARCHAR(10) CHECK (severity IN ('low', 'medium', 'high')),
  signals TEXT[] NOT NULL, -- Array des libellés de signaux détectés
  message TEXT,
  details JSONB,
  source VARCHAR(10) DEFAULT 'fmp' CHECK (source IN ('fmp', 'rss', 'combined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  timestamp TIMESTAMPTZ DEFAULT NOW() -- Alias pour created_at (compatibilité avec frontend)
);

-- ============================================
-- 2. Index pour recherche rapide
-- ============================================
CREATE INDEX IF NOT EXISTS idx_fmp_signals_ticker ON fmp_signals(ticker);
CREATE INDEX IF NOT EXISTS idx_fmp_signals_created_at ON fmp_signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fmp_signals_timestamp ON fmp_signals(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_fmp_signals_type ON fmp_signals(type);
CREATE INDEX IF NOT EXISTS idx_fmp_signals_severity ON fmp_signals(severity);

-- ============================================
-- 3. RLS Policies
-- ============================================
ALTER TABLE fmp_signals ENABLE ROW LEVEL SECURITY;

-- Policy : Lecture pour tous
DROP POLICY IF EXISTS "Allow read fmp_signals" ON fmp_signals;
CREATE POLICY "Allow read fmp_signals" ON fmp_signals
  FOR SELECT
  USING (true);

-- Policy : Écriture pour service_role uniquement
DROP POLICY IF EXISTS "Allow write fmp_signals for service_role" ON fmp_signals;
CREATE POLICY "Allow write fmp_signals for service_role" ON fmp_signals
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 4. Activer Realtime (broadcast)
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'fmp_signals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE fmp_signals;
  END IF;
END $$;

-- ============================================
-- 5. Trigger pour broadcast (optionnel)
-- ============================================
CREATE OR REPLACE FUNCTION fmp_signals_broadcast_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO realtime.messages (topic, payload, extension)
  VALUES (
    'fmp_signals:events',
    json_build_object(
      'event', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'data', row_to_json(NEW)::jsonb
    )::jsonb,
    '{}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS fmp_signals_broadcast_trigger ON fmp_signals;
CREATE TRIGGER fmp_signals_broadcast_trigger
AFTER INSERT ON fmp_signals
FOR EACH ROW
EXECUTE FUNCTION fmp_signals_broadcast_trigger();

-- ============================================
-- 6. Table optionnelle : watched_tickers
-- ============================================
-- Créer la table si elle n'existe pas (pour le worker)
CREATE TABLE IF NOT EXISTS watched_tickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(10) NOT NULL UNIQUE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watched_tickers_active ON watched_tickers(active) WHERE active = true;

-- RLS pour watched_tickers
ALTER TABLE watched_tickers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read watched_tickers" ON watched_tickers;
CREATE POLICY "Allow read watched_tickers" ON watched_tickers
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow write watched_tickers for service_role" ON watched_tickers;
CREATE POLICY "Allow write watched_tickers for service_role" ON watched_tickers
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 7. Commentaires
-- ============================================
COMMENT ON TABLE fmp_signals IS 'Alertes de marché détectées via FMP (≥2 signaux concordants)';
COMMENT ON COLUMN fmp_signals.signals IS 'Array des libellés de signaux détectés (ex: ["Upgrade analyste récent", "Cluster insider buys"])';
COMMENT ON COLUMN fmp_signals.severity IS 'low si 2 signaux, medium si 2-3, high si ≥3 signaux';

