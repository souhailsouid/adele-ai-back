-- 013_price_context_ingestion.sql
-- Ingestion Couche A : price_context (FMP quote + SMA 20/50 + range 5j)

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS ticker_price_context (
  id BIGSERIAL PRIMARY KEY,
  ticker CITEXT NOT NULL,
  data_date DATE NOT NULL,

  spot NUMERIC,
  change_percent NUMERIC,
  volume BIGINT,

  sma_20 NUMERIC,
  sma_50 NUMERIC,
  stddev_20 NUMERIC,

  range_5d_abs NUMERIC,
  range_5d_pct NUMERIC,

  data JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  CONSTRAINT unique_ticker_price_context UNIQUE (ticker, data_date)
);

CREATE INDEX IF NOT EXISTS idx_ticker_price_context_ticker ON ticker_price_context(ticker);
CREATE INDEX IF NOT EXISTS idx_ticker_price_context_expires ON ticker_price_context(expires_at);
CREATE INDEX IF NOT EXISTS idx_ticker_price_context_data_date ON ticker_price_context(data_date DESC);

INSERT INTO analysis_catalog (
  module_id, module_name, description, depends_on,
  data_ttl_hours, analysis_ttl_hours, freshness_threshold_hours, max_stale_hours,
  cost_tokens, cost_time_seconds, enabled_by_default, priority
)
VALUES (
  'price_context',
  'Price Context',
  'Contexte prix (spot, SMA20/50, volatilité proxy, range 5j)',
  ARRAY[]::TEXT[],
  0.25, 0.25, 0.05, 1.0,
  0, 1, true, 0
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






