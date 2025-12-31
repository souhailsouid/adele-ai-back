-- ============================================
-- 011_oi_iv_max_pain_ingestion.sql
-- Ingestion dédiée pour :
-- - oi_change       → table oi_change
-- - oi_per_strike   → table oi_per_strike
-- - iv_rank         → table iv_rank
-- - max_pain        → table max_pain
-- ============================================

-- Ajouter les nouveaux modules au catalogue (si manquants)
INSERT INTO analysis_catalog (
  module_id, module_name, description, depends_on,
  data_ttl_hours, analysis_ttl_hours, freshness_threshold_hours, max_stale_hours,
  cost_tokens, cost_time_seconds, enabled_by_default, priority
)
VALUES
  ('oi_per_strike', 'OI per Strike', 'Open interest total par strike (calls / puts)', ARRAY[]::TEXT[], 1.0, 0.5, 0.25, 2.0, 0, 1, true, 1),
  ('iv_rank', 'IV Rank', 'IV rank et volatilité implicite sur une période', ARRAY[]::TEXT[], 1.0, 0.5, 0.25, 2.0, 0, 1, true, 1)
ON CONFLICT (module_id) DO UPDATE SET
  data_ttl_hours = EXCLUDED.data_ttl_hours,
  analysis_ttl_hours = EXCLUDED.analysis_ttl_hours,
  freshness_threshold_hours = EXCLUDED.freshness_threshold_hours,
  max_stale_hours = EXCLUDED.max_stale_hours,
  updated_at = NOW();

-- ============================================
-- Table: oi_change (données d'open interest change par contrat)
-- ============================================
CREATE TABLE IF NOT EXISTS oi_change (
  id SERIAL PRIMARY KEY,
  ticker CITEXT NOT NULL,
  option_symbol TEXT NOT NULL,
  data_date DATE NOT NULL, -- Date de référence (curr_date)
  curr_date DATE,
  last_date DATE,
  curr_oi BIGINT,
  last_oi BIGINT,
  oi_change NUMERIC(20, 10),
  oi_diff_plain BIGINT,
  percentage_of_total NUMERIC(20, 10),
  trades BIGINT,
  volume BIGINT,
  data JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT unique_oi_change_ticker_symbol_date UNIQUE (ticker, option_symbol, data_date)
);

CREATE INDEX IF NOT EXISTS idx_oi_change_ticker ON oi_change(ticker);
CREATE INDEX IF NOT EXISTS idx_oi_change_expires ON oi_change(expires_at);
CREATE INDEX IF NOT EXISTS idx_oi_change_data_date ON oi_change(data_date DESC);

-- ============================================
-- Table: oi_per_strike (OI total par strike)
-- ============================================
CREATE TABLE IF NOT EXISTS oi_per_strike (
  id SERIAL PRIMARY KEY,
  ticker CITEXT NOT NULL,
  strike NUMERIC(20, 8) NOT NULL,
  data_date DATE NOT NULL,
  call_oi BIGINT,
  put_oi BIGINT,
  data JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT unique_oi_per_strike_ticker_strike_date UNIQUE (ticker, strike, data_date)
);

CREATE INDEX IF NOT EXISTS idx_oi_per_strike_ticker ON oi_per_strike(ticker);
CREATE INDEX IF NOT EXISTS idx_oi_per_strike_expires ON oi_per_strike(expires_at);
CREATE INDEX IF NOT EXISTS idx_oi_per_strike_data_date ON oi_per_strike(data_date DESC);

-- ============================================
-- Table: iv_rank (IV Rank par date)
-- ============================================
CREATE TABLE IF NOT EXISTS iv_rank (
  id SERIAL PRIMARY KEY,
  ticker CITEXT NOT NULL,
  data_date DATE NOT NULL, -- correspond au champ "date"
  close NUMERIC(20, 8),
  iv_rank_1y NUMERIC(20, 10),
  volatility NUMERIC(20, 10),
  updated_at TIMESTAMPTZ,
  data JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT unique_iv_rank_ticker_date UNIQUE (ticker, data_date)
);

CREATE INDEX IF NOT EXISTS idx_iv_rank_ticker ON iv_rank(ticker);
CREATE INDEX IF NOT EXISTS idx_iv_rank_expires ON iv_rank(expires_at);
CREATE INDEX IF NOT EXISTS idx_iv_rank_data_date ON iv_rank(data_date DESC);

-- ============================================
-- Table: max_pain (max pain par expiration)
-- ============================================
CREATE TABLE IF NOT EXISTS max_pain (
  id SERIAL PRIMARY KEY,
  ticker CITEXT NOT NULL,
  data_date DATE NOT NULL, -- date de référence renvoyée par l'API
  expiry DATE NOT NULL,
  max_pain NUMERIC(20, 8),
  data JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT unique_max_pain_ticker_expiry_date UNIQUE (ticker, expiry, data_date)
);

CREATE INDEX IF NOT EXISTS idx_max_pain_ticker ON max_pain(ticker);
CREATE INDEX IF NOT EXISTS idx_max_pain_expires ON max_pain(expires_at);
CREATE INDEX IF NOT EXISTS idx_max_pain_data_date ON max_pain(data_date DESC);






