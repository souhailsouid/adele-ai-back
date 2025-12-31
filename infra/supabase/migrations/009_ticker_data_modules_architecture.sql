-- Migration: Architecture modulaire pour les données de ticker (PROD-GRADE)
-- Séparation en 3 couches : Collecte → Analyses unitaires → Synthèse
-- Version améliorée avec : verrous, idempotency, TTL séparés, freshness par module

-- ============================================
-- Table: ticker_data_modules (état des modules par ticker)
-- ============================================
-- Gère l'état de chaque module de données pour chaque ticker
-- ✅ Status dérivé (pas de "stale" stocké)
-- ✅ Verrous/leases pour éviter cache stampede
-- ✅ CITEXT pour ticker (normalisation automatique)
CREATE TABLE IF NOT EXISTS ticker_data_modules (
  id SERIAL PRIMARY KEY,
  ticker CITEXT NOT NULL, -- CITEXT = case-insensitive text (normalise automatiquement)
  module_id TEXT NOT NULL, -- 'options_flow', 'dark_pool', 'short_interest', 'options_volume', 'oi_change', 'greeks', 'max_pain', etc.
  status TEXT NOT NULL DEFAULT 'missing', -- 'missing' | 'refreshing' | 'ready' | 'error' (PAS 'stale' - dérivé)
  fetched_at TIMESTAMPTZ,
  data_date DATE, -- Date des données (si disponible dans la réponse API)
  expires_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB, -- Métadonnées additionnelles (count, source, etc.)
  -- Verrous/leases pour éviter cache stampede
  refresh_lock_until TIMESTAMPTZ, -- Expiration du verrou (si NULL = pas de verrou)
  refresh_lock_owner TEXT, -- Identifiant du job/process qui détient le verrou (job_id, request_id, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Contrainte unique : un module par ticker
  CONSTRAINT unique_ticker_module UNIQUE (ticker, module_id)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_ticker_modules_ticker ON ticker_data_modules(ticker);
CREATE INDEX IF NOT EXISTS idx_ticker_modules_module ON ticker_data_modules(module_id);
CREATE INDEX IF NOT EXISTS idx_ticker_modules_status ON ticker_data_modules(status);
CREATE INDEX IF NOT EXISTS idx_ticker_modules_expires ON ticker_data_modules(expires_at);
CREATE INDEX IF NOT EXISTS idx_ticker_modules_data_date ON ticker_data_modules(data_date DESC);
CREATE INDEX IF NOT EXISTS idx_ticker_modules_refresh_lock ON ticker_data_modules(refresh_lock_until) WHERE refresh_lock_until IS NOT NULL;

-- ============================================
-- Table: unit_analyses (résultats d'analyses unitaires)
-- ============================================
-- Stocke les résultats structurés de chaque analyse unitaire
-- ✅ Unicité améliorée avec version ou input_hash
-- ✅ Support pour data_date null (price_action intraday)
CREATE TABLE IF NOT EXISTS unit_analyses (
  id SERIAL PRIMARY KEY,
  ticker CITEXT NOT NULL,
  module_id TEXT NOT NULL, -- 'options_flow', 'dark_pool', etc.
  analysis_date TIMESTAMPTZ DEFAULT NOW(),
  data_date DATE, -- Date des données analysées (peut être NULL pour données intraday)
  analysis_version INT DEFAULT 1, -- Version de l'analyse (permet plusieurs analyses le même jour)
  input_hash TEXT, -- Hash des inputs normalisés (pour cache exact par contenu)
  result JSONB NOT NULL, -- Résultat structuré de l'analyse
  -- Structure standardisée :
  -- {
  --   "signals": [{"name": "...", "score": 0.78, "evidence": ["..."]}],
  --   "summary": "...",
  --   "confidence": 0.7,
  --   "metrics": {...}
  -- }
  confidence DECIMAL(3, 2), -- 0.00 à 1.00
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
  -- Note: Les contraintes UNIQUE avec WHERE ne sont pas supportées directement
  -- On utilisera des index uniques partiels à la place (voir après la création de la table)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_unit_analyses_ticker ON unit_analyses(ticker);
CREATE INDEX IF NOT EXISTS idx_unit_analyses_module ON unit_analyses(module_id);

-- Contraintes uniques partielles (remplacent les contraintes UNIQUE avec WHERE)
-- Unique par date (quand data_date est présent)
CREATE UNIQUE INDEX IF NOT EXISTS uq_unit_analyses_by_date
  ON unit_analyses (ticker, module_id, data_date, analysis_version)
  WHERE data_date IS NOT NULL;

-- Unique quand data_date est NULL (intraday)
CREATE UNIQUE INDEX IF NOT EXISTS uq_unit_analyses_intraday
  ON unit_analyses (ticker, module_id, analysis_version)
  WHERE data_date IS NULL;

-- Unique par input_hash (quand input_hash est présent)
CREATE UNIQUE INDEX IF NOT EXISTS uq_unit_analyses_by_hash
  ON unit_analyses (ticker, module_id, input_hash)
  WHERE input_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unit_analyses_expires ON unit_analyses(expires_at);
CREATE INDEX IF NOT EXISTS idx_unit_analyses_data_date ON unit_analyses(data_date DESC);
CREATE INDEX IF NOT EXISTS idx_unit_analyses_input_hash ON unit_analyses(input_hash) WHERE input_hash IS NOT NULL;

-- ============================================
-- Table: analysis_catalog (catalogue des modules disponibles)
-- ============================================
-- Définit les modules d'analyse disponibles et leurs métadonnées
-- ✅ TTL séparés : data_ttl_hours vs analysis_ttl_hours
-- ✅ max_stale_hours pour servir du vieux plutôt que rien
CREATE TABLE IF NOT EXISTS analysis_catalog (
  id SERIAL PRIMARY KEY,
  module_id TEXT NOT NULL UNIQUE, -- 'options_flow', 'dark_pool', 'short_interest', etc.
  module_name TEXT NOT NULL, -- Nom lisible
  description TEXT,
  depends_on TEXT[], -- Modules requis (ex: ['options_flow'] pour 'options_flow_analysis')
  -- TTL séparés : données brutes vs analyses
  data_ttl_hours DECIMAL(5, 2) NOT NULL DEFAULT 24.0, -- TTL des données brutes (API snapshot)
  analysis_ttl_hours DECIMAL(5, 2) NOT NULL DEFAULT 24.0, -- TTL des analyses (résultat LLM/règles)
  freshness_threshold_hours DECIMAL(5, 2) DEFAULT 1.0, -- Seuil de fraîcheur (après X heures = stale)
  max_stale_hours DECIMAL(5, 2) DEFAULT NULL, -- Si accepte de servir du vieux plutôt que rien (NULL = pas de limite)
  cost_tokens INTEGER DEFAULT 0, -- Coût estimé en tokens LLM
  cost_time_seconds INTEGER DEFAULT 0, -- Temps estimé en secondes
  enabled_by_default BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Priorité (0 = normal, 1 = haute, -1 = basse)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_analysis_catalog_enabled ON analysis_catalog(enabled_by_default, priority);

-- Insérer les modules par défaut avec TTL séparés
INSERT INTO analysis_catalog (
  module_id, module_name, description, depends_on, 
  data_ttl_hours, analysis_ttl_hours, freshness_threshold_hours, max_stale_hours,
  cost_tokens, cost_time_seconds, enabled_by_default, priority
) VALUES
  ('options_flow', 'Options Flow', 'Flux d''options récents', ARRAY[]::TEXT[], 1.0, 0.5, 0.25, 2.0, 0, 2, true, 1),
  ('options_volume', 'Options Volume', 'Volumes agrégés d''options (call/put, premiums)', ARRAY[]::TEXT[], 1.0, 0.5, 0.25, 2.0, 0, 2, true, 1),
  ('oi_change', 'OI Change', 'Changements d''open interest', ARRAY[]::TEXT[], 1.0, 0.5, 0.25, 2.0, 0, 2, true, 1),
  ('greeks', 'Greeks', 'Sensibilités des options (delta, gamma, theta, vega)', ARRAY[]::TEXT[], 1.0, 0.5, 0.25, 2.0, 0, 2, true, 1),
  ('max_pain', 'Max Pain', 'Niveau de max pain', ARRAY[]::TEXT[], 1.0, 0.5, 0.25, 2.0, 0, 1, true, 1),
  ('dark_pool', 'Dark Pool', 'Transactions dark pool', ARRAY[]::TEXT[], 24.0, 2.0, 1.0, 48.0, 0, 2, true, 1),
  ('short_interest', 'Short Interest', 'Intérêt à la vente et float', ARRAY[]::TEXT[], 24.0, 2.0, 1.0, 48.0, 0, 2, true, 1),
  ('insiders', 'Insiders', 'Transactions des initiés', ARRAY[]::TEXT[], 24.0, 2.0, 1.0, 48.0, 0, 2, true, 1),
  ('institutional_ownership', 'Institutional Ownership', 'Propriété institutionnelle', ARRAY[]::TEXT[], 24.0, 2.0, 1.0, 48.0, 0, 2, true, 1),
  ('price_action', 'Price Action', 'Données de prix (quote)', ARRAY[]::TEXT[], 0.25, 0.25, 0.05, 1.0, 0, 1, true, 0)
ON CONFLICT (module_id) DO UPDATE SET
  data_ttl_hours = EXCLUDED.data_ttl_hours,
  analysis_ttl_hours = EXCLUDED.analysis_ttl_hours,
  freshness_threshold_hours = EXCLUDED.freshness_threshold_hours,
  max_stale_hours = EXCLUDED.max_stale_hours,
  updated_at = NOW();

-- ============================================
-- Table: options_volume (données d'options volume par ticker)
-- ============================================
-- Table dédiée pour stocker les données d'options volume (au lieu de unusual_whales_cache)
-- Cohérent avec le schéma modulaire : une table par module
CREATE TABLE IF NOT EXISTS options_volume (
  id SERIAL PRIMARY KEY,
  ticker CITEXT NOT NULL,
  date DATE, -- Date des données
  call_volume BIGINT,
  put_volume BIGINT,
  call_premium DECIMAL(15, 2),
  put_premium DECIMAL(15, 2),
  bullish_premium DECIMAL(15, 2),
  bearish_premium DECIMAL(15, 2),
  net_call_premium DECIMAL(15, 2),
  net_put_premium DECIMAL(15, 2),
  call_open_interest BIGINT,
  put_open_interest BIGINT,
  avg_30_day_call_volume DECIMAL(10, 2),
  avg_30_day_put_volume DECIMAL(10, 2),
  data JSONB, -- Données brutes complètes
  data_date DATE NOT NULL DEFAULT CURRENT_DATE, -- Date des données (NOT NULL pour garantir l'unicité)
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  -- Contrainte unique : un ticker par date de données
  CONSTRAINT unique_options_volume_ticker_date UNIQUE (ticker, data_date)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_options_volume_ticker ON options_volume(ticker);
CREATE INDEX IF NOT EXISTS idx_options_volume_expires ON options_volume(expires_at);
CREATE INDEX IF NOT EXISTS idx_options_volume_data_date ON options_volume(data_date DESC);

-- ============================================
-- Table: analysis_jobs (jobs asynchrones pour analyses lourdes)
-- ============================================
-- Gère les jobs asynchrones pour les analyses qui prennent du temps
-- ✅ Idempotency key pour éviter les doublons
CREATE TABLE IF NOT EXISTS analysis_jobs (
  id SERIAL PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE, -- UUID ou identifiant unique
  idempotency_key TEXT UNIQUE, -- Clé d'idempotence (ex: ticker + job_type + modules_selected + day/hour bucket)
  ticker CITEXT NOT NULL,
  job_type TEXT NOT NULL, -- 'ticker_activity_analysis', 'options_flow_analysis', 'refresh_module', 'run_unit_analysis', etc.
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'
  input_data JSONB, -- Données d'entrée
  result JSONB, -- Résultat (si completed)
  error_message TEXT, -- Message d'erreur (si failed)
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_job_id ON analysis_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_idempotency_key ON analysis_jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_ticker ON analysis_jobs(ticker);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_expires ON analysis_jobs(expires_at);

-- ============================================
-- Fonction pour mettre à jour updated_at automatiquement
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER update_ticker_data_modules_updated_at
  BEFORE UPDATE ON ticker_data_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_unit_analyses_updated_at
  BEFORE UPDATE ON unit_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analysis_catalog_updated_at
  BEFORE UPDATE ON analysis_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analysis_jobs_updated_at
  BEFORE UPDATE ON analysis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Fonction helper: acquire_refresh_lock(ticker, module_id, lock_owner, lock_duration_seconds)
-- ============================================
-- Acquiert un verrou pour éviter cache stampede (ATOMIQUE - pas de race condition)
-- Retourne true si le verrou a été acquis, false sinon
CREATE OR REPLACE FUNCTION acquire_refresh_lock(
  p_ticker CITEXT,
  p_module_id TEXT,
  p_lock_owner TEXT,
  p_lock_duration_seconds INT DEFAULT 120
)
RETURNS BOOLEAN AS $$
DECLARE
  v_lock_until TIMESTAMPTZ := NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL;
BEGIN
  -- 1) Essayer de prendre le lock sur une ligne existante (ATOMIQUE)
  -- UPDATE ne réussit QUE si lock absent/expiré
  UPDATE ticker_data_modules
  SET 
    refresh_lock_until = v_lock_until,
    refresh_lock_owner = p_lock_owner,
    status = 'refreshing'
  WHERE ticker = p_ticker
    AND module_id = p_module_id
    AND (refresh_lock_until IS NULL OR refresh_lock_until < NOW());

  -- Si UPDATE a réussi (FOUND = true), on a le lock
  IF FOUND THEN
    RETURN TRUE;
  END IF;

  -- 2) Sinon, tenter d'insérer (première fois pour ce module)
  INSERT INTO ticker_data_modules (ticker, module_id, status, refresh_lock_until, refresh_lock_owner)
  VALUES (p_ticker, p_module_id, 'refreshing', v_lock_until, p_lock_owner)
  ON CONFLICT (ticker, module_id) DO NOTHING;

  -- Si INSERT a réussi (FOUND = true), on a le lock
  -- Sinon, quelqu'un d'autre l'a créé entre temps → pas de lock
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Fonction helper: finalize_module_refresh(ticker, module_id, lock_owner, status, data_date, expires_at, error_message, metadata)
-- ============================================
-- Finalise un refresh : libère le lock ET met à jour status/fetched_at/expires_at/error_message/metadata en une seule transaction
-- Évite le double boulot (updateModuleStatus + releaseRefreshLock)
CREATE OR REPLACE FUNCTION finalize_module_refresh(
  p_ticker CITEXT,
  p_module_id TEXT,
  p_lock_owner TEXT,
  p_status TEXT, -- 'ready' | 'error'
  p_data_date DATE DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE ticker_data_modules
  SET 
    refresh_lock_until = NULL,
    refresh_lock_owner = NULL,
    status = p_status,
    fetched_at = CASE WHEN p_status = 'ready' THEN NOW() ELSE fetched_at END,
    data_date = COALESCE(p_data_date, data_date),
    expires_at = COALESCE(p_expires_at, expires_at),
    -- error_message : NULL si ready, p_error_message si error
    error_message = CASE WHEN p_status = 'error' THEN p_error_message ELSE NULL END,
    -- metadata : mis à jour si fourni
    metadata = COALESCE(p_metadata, metadata)
  WHERE ticker = p_ticker 
    AND module_id = p_module_id
    AND refresh_lock_owner = p_lock_owner;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Fonction helper: release_refresh_lock() - juste unlock (pour compatibilité)
CREATE OR REPLACE FUNCTION release_refresh_lock(
  p_ticker CITEXT,
  p_module_id TEXT,
  p_lock_owner TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE ticker_data_modules
  SET 
    refresh_lock_until = NULL,
    refresh_lock_owner = NULL
  WHERE ticker = p_ticker 
    AND module_id = p_module_id
    AND refresh_lock_owner = p_lock_owner;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Vue: ticker_modules_status (vue pratique pour voir l'état de tous les modules d'un ticker)
-- ============================================
-- ✅ Freshness dérivé via freshness_threshold_hours du catalog (pas de règle globale)
-- ✅ Status dérivé : fresh | stale | expired (pas stocké)
CREATE OR REPLACE VIEW ticker_modules_status AS
SELECT 
  tdm.ticker,
  tdm.module_id,
  ac.module_name,
  tdm.status, -- missing | refreshing | ready | error (PAS stale)
  tdm.fetched_at,
  tdm.data_date,
  tdm.expires_at,
  tdm.refresh_lock_until,
  tdm.refresh_lock_owner,
  tdm.error_message,
  ac.data_ttl_hours,
  ac.analysis_ttl_hours,
  ac.freshness_threshold_hours,
  ac.max_stale_hours,
  ac.enabled_by_default,
  ac.priority,
  -- Dériver freshness_status (fresh | stale | expired)
  CASE 
    WHEN tdm.status = 'missing' OR tdm.status = 'error' THEN 'missing'
    WHEN tdm.expires_at IS NOT NULL AND NOW() > tdm.expires_at THEN 'expired'
    WHEN tdm.fetched_at IS NOT NULL AND ac.freshness_threshold_hours IS NOT NULL 
         AND NOW() - tdm.fetched_at > (ac.freshness_threshold_hours || ' hours')::INTERVAL THEN 'stale'
    WHEN tdm.status = 'ready' THEN 'fresh'
    ELSE 'unknown'
  END as freshness_status,
  -- Calculer si on peut servir du stale (si max_stale_hours permet)
  CASE
    WHEN tdm.fetched_at IS NOT NULL 
         AND ac.max_stale_hours IS NOT NULL
         AND NOW() - tdm.fetched_at <= (ac.max_stale_hours || ' hours')::INTERVAL
         AND (tdm.expires_at IS NULL OR NOW() <= tdm.expires_at) THEN TRUE
    ELSE FALSE
  END as can_serve_stale
FROM ticker_data_modules tdm
LEFT JOIN analysis_catalog ac ON tdm.module_id = ac.module_id;

-- ============================================
-- Fonction helper: get_ticker_modules_status(ticker)
-- ============================================
CREATE OR REPLACE FUNCTION get_ticker_modules_status(p_ticker CITEXT)
RETURNS TABLE (
  module_id TEXT,
  module_name TEXT,
  status TEXT,
  freshness_status TEXT,
  fetched_at TIMESTAMPTZ,
  data_date DATE,
  expires_at TIMESTAMPTZ,
  error_message TEXT,
  data_ttl_hours DECIMAL(5, 2),
  analysis_ttl_hours DECIMAL(5, 2),
  freshness_threshold_hours DECIMAL(5, 2),
  enabled_by_default BOOLEAN,
  can_serve_stale BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tms.module_id,
    tms.module_name,
    tms.status,
    tms.freshness_status,
    tms.fetched_at,
    tms.data_date,
    tms.expires_at,
    tms.error_message,
    tms.data_ttl_hours,
    tms.analysis_ttl_hours,
    tms.freshness_threshold_hours,
    tms.enabled_by_default,
    tms.can_serve_stale
  FROM ticker_modules_status tms
  WHERE tms.ticker = p_ticker
  ORDER BY tms.priority DESC, tms.module_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Fonction helper: get_or_create_job(idempotency_key, ...)
-- ============================================
-- Get-or-create pattern pour éviter les doublons de jobs (SIMPLE ET SAFE)
CREATE OR REPLACE FUNCTION get_or_create_job(
  p_idempotency_key TEXT,
  p_ticker CITEXT,
  p_job_type TEXT,
  p_input_data JSONB DEFAULT NULL
)
RETURNS TABLE (
  job_id TEXT,
  status TEXT,
  result JSONB,
  created BOOLEAN
) AS $$
DECLARE
  v_job_id TEXT;
  v_status TEXT;
  v_result JSONB;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- 1) Tenter d'insérer (ATOMIQUE)
  INSERT INTO analysis_jobs (job_id, idempotency_key, ticker, job_type, input_data, status)
  VALUES (gen_random_uuid()::TEXT, p_idempotency_key, p_ticker, p_job_type, p_input_data, 'pending')
  ON CONFLICT (idempotency_key) DO NOTHING;

  -- 2) Toujours SELECT (retourne la ligne existante ou celle qu'on vient de créer)
  SELECT aj.job_id, aj.status, aj.result, aj.created_at
    INTO v_job_id, v_status, v_result, v_created_at
  FROM analysis_jobs aj
  WHERE aj.idempotency_key = p_idempotency_key
    AND aj.expires_at > NOW()
  ORDER BY aj.created_at DESC
  LIMIT 1;

  -- 3) Déterminer si créé (job créé il y a moins de 2 secondes = probablement par nous)
  RETURN QUERY
  SELECT 
    v_job_id,
    v_status,
    v_result,
    (v_created_at > NOW() - INTERVAL '2 seconds') as created;
END;
$$ LANGUAGE plpgsql;
