-- Migration: Tables de cache pour Unusual Whales et Short Interest
-- Ces tables servent de cache pour les données des APIs Unusual Whales

-- ============================================
-- Table: unusual_whales_cache (cache générique pour UW)
-- ============================================
-- Cette table est utilisée par CacheService pour stocker toutes les données UW
-- avec une clé de cache générique (cache_key)
CREATE TABLE IF NOT EXISTS unusual_whales_cache (
  id SERIAL PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE, -- Clé de cache unique (ex: "uw_recent_flows_NVDA_{limit:30}")
  data JSONB NOT NULL, -- Données brutes de l'API
  data_date TIMESTAMPTZ, -- Date des données (si disponible dans la réponse API)
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index pour recherche rapide par cache_key
CREATE INDEX IF NOT EXISTS idx_uw_cache_key ON unusual_whales_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_uw_cache_expires ON unusual_whales_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_uw_cache_data_date ON unusual_whales_cache(data_date) WHERE data_date IS NOT NULL;

-- ============================================
-- Table: short_interest (données de short interest par ticker)
-- ============================================
-- Table dédiée pour stocker les données de short interest avec vérification de fraîcheur
CREATE TABLE IF NOT EXISTS short_interest (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  short_interest BIGINT, -- Nombre d'actions vendues à découvert
  float BIGINT, -- Float disponible
  short_interest_ratio DECIMAL(10, 4), -- Ratio short interest / float
  days_to_cover DECIMAL(10, 2), -- Jours pour couvrir les shorts
  data_date DATE, -- Date des données (si disponible dans la réponse API)
  data JSONB, -- Données brutes complètes
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  -- Contrainte unique : un ticker par date de données
  CONSTRAINT unique_ticker_data_date UNIQUE (ticker, data_date)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_short_interest_ticker ON short_interest(ticker);
CREATE INDEX IF NOT EXISTS idx_short_interest_expires ON short_interest(expires_at);
CREATE INDEX IF NOT EXISTS idx_short_interest_data_date ON short_interest(data_date DESC);

-- ============================================
-- Amélioration des tables existantes : options_flow et dark_pool_trades
-- ============================================
-- Ajouter data_date si elle n'existe pas déjà pour vérifier la fraîcheur

DO $$
BEGIN
  -- Ajouter data_date à options_flow si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'options_flow' AND column_name = 'data_date'
  ) THEN
    ALTER TABLE options_flow ADD COLUMN data_date DATE;
    CREATE INDEX IF NOT EXISTS idx_options_flow_data_date ON options_flow(data_date DESC);
  END IF;

  -- Ajouter data_date à dark_pool_trades si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dark_pool_trades' AND column_name = 'data_date'
  ) THEN
    ALTER TABLE dark_pool_trades ADD COLUMN data_date DATE;
    CREATE INDEX IF NOT EXISTS idx_dark_pool_data_date ON dark_pool_trades(data_date DESC);
  END IF;

  -- Améliorer la structure de options_flow pour stocker les données RecentFlows
  -- Ajouter des colonnes pour les métriques agrégées si elles n'existent pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'options_flow' AND column_name = 'call_volume'
  ) THEN
    ALTER TABLE options_flow 
      ADD COLUMN call_volume INTEGER,
      ADD COLUMN put_volume INTEGER,
      ADD COLUMN call_premium DECIMAL(15, 2),
      ADD COLUMN put_premium DECIMAL(15, 2),
      ADD COLUMN date DATE; -- Date de trading (ISO format)
  END IF;

  -- Améliorer la structure de dark_pool_trades
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dark_pool_trades' AND column_name = 'executed_at'
  ) THEN
    ALTER TABLE dark_pool_trades 
      ADD COLUMN executed_at TIMESTAMPTZ,
      ADD COLUMN institution TEXT,
      ADD COLUMN market_center TEXT;
  END IF;

  -- Ajouter is_empty_marker à options_flow si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'options_flow' AND column_name = 'is_empty_marker'
  ) THEN
    ALTER TABLE options_flow ADD COLUMN is_empty_marker BOOLEAN DEFAULT FALSE;
  END IF;

  -- Ajouter is_empty_marker à dark_pool_trades si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'dark_pool_trades' AND column_name = 'is_empty_marker'
  ) THEN
    ALTER TABLE dark_pool_trades ADD COLUMN is_empty_marker BOOLEAN DEFAULT FALSE;
  END IF;

  -- Ajouter is_empty_marker à short_interest si elle n'existe pas
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'short_interest' AND column_name = 'is_empty_marker'
  ) THEN
    ALTER TABLE short_interest ADD COLUMN is_empty_marker BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- ============================================
-- Index pour améliorer les performances (pas de contraintes uniques strictes)
-- ============================================
-- On utilise des index pour améliorer les performances, mais on gère les doublons
-- dans le code TypeScript en utilisant des upserts intelligents
DO $$
BEGIN
  -- Index composite pour options_flow pour faciliter les recherches
  -- On crée des index séparés pour data_date et date
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_options_flow_ticker_data_date_expiry_strike'
  ) THEN
    CREATE INDEX idx_options_flow_ticker_data_date_expiry_strike 
    ON options_flow(ticker, data_date, expiry, strike) 
    WHERE data_date IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_options_flow_ticker_date_expiry_strike'
  ) THEN
    CREATE INDEX idx_options_flow_ticker_date_expiry_strike 
    ON options_flow(ticker, date, expiry, strike) 
    WHERE data_date IS NULL AND date IS NOT NULL;
  END IF;

  -- Index composite pour dark_pool_trades
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_dark_pool_ticker_executed_at'
  ) THEN
    CREATE INDEX idx_dark_pool_ticker_executed_at 
    ON dark_pool_trades(ticker, executed_at);
  END IF;
END $$;

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE unusual_whales_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE short_interest ENABLE ROW LEVEL SECURITY;

-- Politiques pour permettre l'accès service_role (pour les Lambdas)
DROP POLICY IF EXISTS "Service role can manage unusual_whales_cache" ON unusual_whales_cache;
CREATE POLICY "Service role can manage unusual_whales_cache" ON unusual_whales_cache
    FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage short_interest" ON short_interest;
CREATE POLICY "Service role can manage short_interest" ON short_interest
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- Fonction pour nettoyer les données expirées
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_uw_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM unusual_whales_cache WHERE expires_at < NOW();
  DELETE FROM short_interest WHERE expires_at < NOW();
  -- Nettoyer aussi les tables existantes
  DELETE FROM options_flow WHERE expires_at < NOW();
  DELETE FROM dark_pool_trades WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Fonction pour vérifier la fraîcheur des données
-- ============================================
-- Retourne true si les données sont fraîches (moins de maxAgeHours)
CREATE OR REPLACE FUNCTION is_data_fresh(
  p_ticker TEXT,
  p_table_name TEXT,
  p_max_age_hours INTEGER DEFAULT 24
)
RETURNS BOOLEAN AS $$
DECLARE
  v_data_date TIMESTAMPTZ;
  v_cached_at TIMESTAMPTZ;
BEGIN
  -- Vérifier dans la table spécifiée
  IF p_table_name = 'short_interest' THEN
    SELECT data_date, cached_at INTO v_data_date, v_cached_at
    FROM short_interest
    WHERE ticker = p_ticker
    ORDER BY data_date DESC NULLS LAST, cached_at DESC
    LIMIT 1;
  ELSIF p_table_name = 'options_flow' THEN
    SELECT data_date, cached_at INTO v_data_date, v_cached_at
    FROM options_flow
    WHERE ticker = p_ticker
    ORDER BY data_date DESC NULLS LAST, cached_at DESC
    LIMIT 1;
  ELSIF p_table_name = 'dark_pool_trades' THEN
    SELECT data_date, cached_at INTO v_data_date, v_cached_at
    FROM dark_pool_trades
    WHERE ticker = p_ticker
    ORDER BY data_date DESC NULLS LAST, cached_at DESC
    LIMIT 1;
  END IF;

  -- Si pas de données, retourner false (besoin de fetch)
  IF v_data_date IS NULL AND v_cached_at IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Utiliser data_date si disponible, sinon cached_at
  IF v_data_date IS NOT NULL THEN
    RETURN (NOW() - v_data_date) < (p_max_age_hours || INTERVAL '1 hour');
  ELSE
    RETURN (NOW() - v_cached_at) < (p_max_age_hours || INTERVAL '1 hour');
  END IF;
END;
$$ LANGUAGE plpgsql;

