-- 012_earnings_ingestion.sql
-- Ingestion Couche A : earnings historiques (Unusual Whales GET /earnings/{ticker})

-- Extensions
CREATE EXTENSION IF NOT EXISTS citext;

-- Table: ticker_earnings (données historiques + expected move)
CREATE TABLE IF NOT EXISTS ticker_earnings (
  id BIGSERIAL PRIMARY KEY,
  ticker CITEXT NOT NULL,
  report_date DATE NOT NULL,
  report_time TEXT,
  source TEXT,
  ending_fiscal_quarter DATE,

  -- Champs importants options-wise
  expected_move NUMERIC,
  expected_move_perc NUMERIC,
  street_mean_est NUMERIC,
  actual_eps NUMERIC,

  -- Quelques stats utiles (si présentes)
  post_earnings_move_1d NUMERIC,
  post_earnings_move_1w NUMERIC,
  post_earnings_move_2w NUMERIC,
  post_earnings_move_3d NUMERIC,

  pre_earnings_move_1d NUMERIC,
  pre_earnings_move_1w NUMERIC,
  pre_earnings_move_2w NUMERIC,
  pre_earnings_move_3d NUMERIC,

  long_straddle_1d NUMERIC,
  long_straddle_1w NUMERIC,
  short_straddle_1d NUMERIC,
  short_straddle_1w NUMERIC,

  data JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  CONSTRAINT unique_ticker_earnings UNIQUE (ticker, report_date)
);

CREATE INDEX IF NOT EXISTS idx_ticker_earnings_ticker ON ticker_earnings(ticker);
CREATE INDEX IF NOT EXISTS idx_ticker_earnings_report_date ON ticker_earnings(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_ticker_earnings_expires ON ticker_earnings(expires_at);

-- Ajouter le module dans analysis_catalog si la table existe déjà dans ton schéma
-- (sinon, tu peux l'ajouter manuellement dans ta migration "catalog")
INSERT INTO analysis_catalog (
  module_id, module_name, description, depends_on,
  data_ttl_hours, analysis_ttl_hours, freshness_threshold_hours, max_stale_hours,
  cost_tokens, cost_time_seconds, enabled_by_default, priority
)
VALUES (
  'earnings',
  'Earnings',
  'Historique des earnings (report date/time, expected move, straddle perf)',
  ARRAY[]::TEXT[],
  24.0, 24.0, 1.0, 168.0,
  0, 0, true, 0
)
ON CONFLICT (module_id) DO UPDATE SET
  module_name = EXCLUDED.module_name,
  description = EXCLUDED.description,
  data_ttl_hours = EXCLUDED.data_ttl_hours,
  analysis_ttl_hours = EXCLUDED.analysis_ttl_hours,
  freshness_threshold_hours = EXCLUDED.freshness_threshold_hours,
  max_stale_hours = EXCLUDED.max_stale_hours,
  enabled_by_default = EXCLUDED.enabled_by_default,
  priority = EXCLUDED.priority,
  updated_at = NOW();


