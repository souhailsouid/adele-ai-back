-- Migration: Admin Monitoring Tables
-- Crée les tables file_processing_queue et cron_registry pour le dashboard admin

-- ========== Table: file_processing_queue ==========
-- Suit le statut de parsing de tous les fichiers (13F, 10K, RSS, etc.)
CREATE TABLE IF NOT EXISTS file_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  doc_type TEXT CHECK (doc_type IN ('13F', '10K', '10Q', 'RSS', 'OTHER')),
  filing_id INTEGER REFERENCES fund_filings(id) ON DELETE SET NULL,
  fund_id INTEGER REFERENCES funds(id) ON DELETE SET NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error_log TEXT,
  metrics JSONB, -- Validation metrics (e.g., {"rows_parsed": 150, "holdings_count": 45})
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_file_processing_queue_status 
  ON file_processing_queue(status) 
  WHERE status IN ('PENDING', 'PROCESSING');

CREATE INDEX IF NOT EXISTS idx_file_processing_queue_filing_id 
  ON file_processing_queue(filing_id) 
  WHERE filing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_file_processing_queue_fund_id 
  ON file_processing_queue(fund_id) 
  WHERE fund_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_file_processing_queue_doc_type 
  ON file_processing_queue(doc_type) 
  WHERE doc_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_file_processing_queue_created_at 
  ON file_processing_queue(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_file_processing_queue_retry_count 
  ON file_processing_queue(retry_count, status) 
  WHERE status = 'FAILED' AND retry_count < max_retries;

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_file_processing_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_file_processing_queue_updated_at
  BEFORE UPDATE ON file_processing_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_file_processing_queue_updated_at();

-- ========== Table: cron_registry ==========
-- Suit la santé de tous les crons récurrents
CREATE TABLE IF NOT EXISTS cron_registry (
  id TEXT PRIMARY KEY, -- Identifiant du cron (e.g., 'collector-sec-watcher', 'parser-13f')
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_status TEXT CHECK (last_status IN ('SUCCESS', 'FAILED', 'RUNNING')),
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  run_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  schedule_expression TEXT, -- EventBridge schedule (e.g., 'rate(5 minutes)')
  next_run_at TIMESTAMPTZ, -- Estimated next run time
  avg_duration_ms INTEGER, -- Average execution duration in milliseconds
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_cron_registry_is_active 
  ON cron_registry(is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_cron_registry_last_run_at 
  ON cron_registry(last_run_at DESC);

CREATE INDEX IF NOT EXISTS idx_cron_registry_last_status 
  ON cron_registry(last_status) 
  WHERE last_status IN ('FAILED', 'RUNNING');

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_cron_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cron_registry_updated_at
  BEFORE UPDATE ON cron_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_cron_registry_updated_at();

-- ========== RLS Policies ==========
-- Admin peut tout voir/modifier (bypass via service role key)
-- Users peuvent lire leur propre data (si nécessaire plus tard)
ALTER TABLE file_processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_registry ENABLE ROW LEVEL SECURITY;

-- Policy: Admin (service role) peut tout faire
CREATE POLICY "Admin full access on file_processing_queue"
  ON file_processing_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin full access on cron_registry"
  ON cron_registry
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users peuvent lire (pour dashboard)
CREATE POLICY "Authenticated users can read file_processing_queue"
  ON file_processing_queue
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read cron_registry"
  ON cron_registry
  FOR SELECT
  TO authenticated
  USING (true);

-- ========== Initial cron_registry entries ==========
-- Créer les entrées pour tous les crons actifs
INSERT INTO cron_registry (id, is_active, schedule_expression) VALUES
  ('collector-sec-watcher', true, 'rate(5 hours)'),
  ('collector-rss', true, 'rate(45 minutes)'),
  ('collector-sec-company-filings', true, NULL),
  ('notification-generator', true, 'rate(40 minutes)'),
  ('parser-13f', false, NULL), -- Déclenché via EventBridge, pas de cron direct
  ('alert-sender', false, NULL) -- Désactivé
ON CONFLICT (id) DO NOTHING;
