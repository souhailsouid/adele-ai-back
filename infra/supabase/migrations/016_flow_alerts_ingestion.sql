-- Migration: Flow Alerts Ingestion
-- Table pour stocker les flow alerts (option-trades/flow-alerts) de Unusual Whales
-- Permet l'ingestion puis la lecture depuis la DB pour éviter les cold starts et latences

-- ============================================
-- Table: flow_alerts
-- ============================================
-- Stocke les flow alerts de l'API option-trades/flow-alerts
CREATE TABLE IF NOT EXISTS flow_alerts (
  id SERIAL PRIMARY KEY,
  ticker CITEXT NOT NULL,
  alert_rule TEXT, -- 'RepeatedHits', 'FloorTradeLargeCap', etc.
  type TEXT NOT NULL, -- 'call' | 'put'
  strike TEXT NOT NULL,
  expiry DATE NOT NULL,
  option_chain TEXT,
  total_premium DECIMAL(15, 2),
  total_size INTEGER,
  trade_count INTEGER,
  volume INTEGER,
  open_interest INTEGER,
  volume_oi_ratio DECIMAL(10, 4),
  underlying_price DECIMAL(10, 2),
  total_ask_side_prem DECIMAL(15, 2),
  total_bid_side_prem DECIMAL(15, 2),
  price DECIMAL(10, 2),
  all_opening_trades BOOLEAN DEFAULT false,
  has_floor BOOLEAN DEFAULT false,
  has_sweep BOOLEAN DEFAULT false,
  has_multileg BOOLEAN DEFAULT false,
  has_singleleg BOOLEAN DEFAULT true,
  expiry_count INTEGER DEFAULT 1,
  issue_type TEXT, -- 'Common Stock', 'ETF', etc.
  created_at TIMESTAMPTZ, -- Timestamp de création de l'alerte (depuis API)
  data JSONB, -- Données brutes complètes
  data_date DATE NOT NULL DEFAULT CURRENT_DATE, -- Date des données
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  -- Contrainte unique : un flow alert par ticker/strike/expiry/created_at
  -- Utilise created_at pour distinguer les alertes du même contrat
  CONSTRAINT unique_flow_alert UNIQUE (ticker, strike, expiry, created_at)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_flow_alerts_ticker ON flow_alerts(ticker);
CREATE INDEX IF NOT EXISTS idx_flow_alerts_expires ON flow_alerts(expires_at);
CREATE INDEX IF NOT EXISTS idx_flow_alerts_data_date ON flow_alerts(data_date DESC);
CREATE INDEX IF NOT EXISTS idx_flow_alerts_created_at ON flow_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flow_alerts_type ON flow_alerts(type);
CREATE INDEX IF NOT EXISTS idx_flow_alerts_alert_rule ON flow_alerts(alert_rule);
CREATE INDEX IF NOT EXISTS idx_flow_alerts_premium ON flow_alerts(total_premium DESC NULLS LAST);

-- Index composite pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_flow_alerts_ticker_date ON flow_alerts(ticker, data_date DESC, created_at DESC);

-- ============================================
-- Ajouter le module flow_alerts au catalogue
-- ============================================
INSERT INTO analysis_catalog (
  module_id, module_name, description, depends_on, 
  data_ttl_hours, analysis_ttl_hours, freshness_threshold_hours, max_stale_hours,
  cost_tokens, cost_time_seconds, enabled_by_default, priority
) VALUES
  ('flow_alerts', 'Flow Alerts', 'Alertes de flow options (option-trades/flow-alerts)', ARRAY[]::TEXT[], 0.5, 0.5, 0.1, 1.0, 0, 2, true, 1)
ON CONFLICT (module_id) DO UPDATE SET
  data_ttl_hours = EXCLUDED.data_ttl_hours,
  analysis_ttl_hours = EXCLUDED.analysis_ttl_hours,
  freshness_threshold_hours = EXCLUDED.freshness_threshold_hours,
  max_stale_hours = EXCLUDED.max_stale_hours,
  updated_at = NOW();

