-- ============================================
-- Migration 010: Corrections critiques pour production
-- ============================================
-- Fixes:
-- 1. unit_analyses: UNIQUE constraint avec data_date NULL
-- 2. ticker_modules_status: refreshing_effective (éviter "refreshing" bloqué)
-- 3. acquire_refresh_lock: mieux gérer un "refreshing" zombie (lock expiré)
-- 4. options_volume: supprimer date (garder data_date)
-- 5. Index expires_at manquants
-- 6. Extension pgcrypto

-- ============================================
-- 0) UUID helper
-- ============================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1) unit_analyses: FIX UNIQUE avec data_date NULL
-- ============================================
-- Postgres considère NULL != NULL, donc UNIQUE(ticker, module_id, data_date, analysis_version)
-- n'empêche pas les doublons quand data_date est NULL.
-- Fix: 2 contraintes partielles
-- POLISH: Wrapper dans un bloc DO $$ pour gérer le cas où la table n'existe pas encore
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unit_analyses') THEN
    -- Supprimer l'ancienne contrainte si elle existe
    ALTER TABLE unit_analyses
      DROP CONSTRAINT IF EXISTS unique_unit_analysis;

    -- Unique quand data_date est présent
    CREATE UNIQUE INDEX IF NOT EXISTS uq_unit_analyses_by_date
      ON unit_analyses (ticker, module_id, data_date, analysis_version)
      WHERE data_date IS NOT NULL;

    -- Unique quand data_date est NULL (intraday)
    CREATE UNIQUE INDEX IF NOT EXISTS uq_unit_analyses_intraday
      ON unit_analyses (ticker, module_id, analysis_version)
      WHERE data_date IS NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore si la table n'existe pas
END $$;

-- Le hash unique est OK, on le garde tel quel (déjà partiel)

-- ============================================
-- 2) ticker_modules_status: refreshing_effective (éviter "refreshing" bloqué)
-- ============================================
-- Ne jamais faire confiance à status=refreshing seul
-- Considérer refreshing comme actif uniquement si refresh_lock_until > now()
-- POLISH: Wrapper dans un bloc DO $$ pour gérer le cas où les tables dépendantes n'existent pas
DO $$
BEGIN
  -- Vérifier que les tables dépendantes existent
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticker_data_modules')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analysis_catalog') THEN
    
    EXECUTE '
    CREATE OR REPLACE VIEW ticker_modules_status AS
    SELECT 
      tdm.ticker,
      tdm.module_id,
      ac.module_name,
      tdm.status,
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

      -- refreshing "réel" seulement si lock encore valide
      CASE
        WHEN tdm.status = ''refreshing''
         AND tdm.refresh_lock_until IS NOT NULL
         AND tdm.refresh_lock_until > NOW()
        THEN TRUE
        ELSE FALSE
      END AS refreshing_effective,

      CASE 
        WHEN tdm.status = ''missing'' OR tdm.status = ''error'' THEN ''missing''
        WHEN tdm.expires_at IS NOT NULL AND NOW() > tdm.expires_at THEN ''expired''
        WHEN tdm.fetched_at IS NOT NULL AND ac.freshness_threshold_hours IS NOT NULL 
             AND NOW() - tdm.fetched_at > (ac.freshness_threshold_hours || '' hours'')::INTERVAL THEN ''stale''
        WHEN tdm.status = ''ready'' THEN ''fresh''
        ELSE ''unknown''
      END as freshness_status,

      CASE
        WHEN tdm.fetched_at IS NOT NULL 
             AND ac.max_stale_hours IS NOT NULL
             AND NOW() - tdm.fetched_at <= (ac.max_stale_hours || '' hours'')::INTERVAL
             AND (tdm.expires_at IS NULL OR NOW() <= tdm.expires_at) THEN TRUE
        ELSE FALSE
      END as can_serve_stale
    FROM ticker_data_modules tdm
    LEFT JOIN analysis_catalog ac ON tdm.module_id = ac.module_id';
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore si les tables n'existent pas
END $$;

-- ============================================
-- 3) acquire_refresh_lock: mieux gérer un "refreshing" zombie (lock expiré)
-- ============================================
-- Si un worker crash après avoir pris le lock, le lock expire mais status reste refreshing.
-- Fix: reset error_message et vérifier que le lock est vraiment expiré
-- POLISH: Utiliser INSERT ... ON CONFLICT DO UPDATE pour atomicité maximale
-- IMPORTANT: Créer directement la fonction (pas dans DO $$) pour qu'elle soit visible par PostgREST
-- Si la table n'existe pas, la fonction échouera à l'exécution (c'est OK, la migration 009 doit être exécutée avant)
CREATE OR REPLACE FUNCTION acquire_refresh_lock(
  p_ticker CITEXT,
  p_module_id TEXT,
  p_lock_owner TEXT,
  p_lock_duration_seconds INT DEFAULT 120
)
RETURNS BOOLEAN AS $$
DECLARE
  v_lock_until TIMESTAMPTZ := NOW() + (p_lock_duration_seconds || ' seconds')::INTERVAL;
  v_rows_affected INT;
BEGIN
  -- Tenter d'acquérir le lock sur une ligne existante ou de la créer si elle n'existe pas
  -- Utilise INSERT ... ON CONFLICT DO UPDATE pour atomicité maximale
  INSERT INTO ticker_data_modules (ticker, module_id, status, refresh_lock_until, refresh_lock_owner)
  VALUES (p_ticker, p_module_id, 'refreshing', v_lock_until, p_lock_owner)
  ON CONFLICT (ticker, module_id) DO UPDATE SET
    refresh_lock_until = EXCLUDED.refresh_lock_until,
    refresh_lock_owner = EXCLUDED.refresh_lock_owner,
    status = EXCLUDED.status,
    error_message = NULL -- Reset error_message lors de l'acquisition du lock
  WHERE ticker_data_modules.refresh_lock_until IS NULL 
     OR ticker_data_modules.refresh_lock_until < NOW();

  -- Vérifier si le lock a été acquis (INSERT créé une ligne OU UPDATE a modifié une ligne)
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  
  -- Si aucune ligne n'a été affectée, c'est que le lock était déjà pris (WHERE n'a pas matché)
  RETURN v_rows_affected > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3b) finalize_module_refresh: S'assurer que la fonction existe et est correcte
-- ============================================
-- IMPORTANT: Créer directement la fonction (pas dans DO $$) pour qu'elle soit visible par PostgREST
-- Cette fonction finalise un refresh : libère le lock ET met à jour status/fetched_at/expires_at/error_message/metadata
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

-- ============================================
-- 4) options_volume : supprimer date (garder data_date) + NOT NULL
-- ============================================
-- Double champ date + data_date cause confusion et cast implicite foire selon driver
-- S'assurer que data_date est NOT NULL pour éviter les NULL multiples
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'options_volume') THEN
    -- Supprimer la colonne date si elle existe
    ALTER TABLE options_volume DROP COLUMN IF EXISTS date;
    
    -- S'assurer que data_date est NOT NULL
    ALTER TABLE options_volume ALTER COLUMN data_date SET NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore si la table n'existe pas
END $$;

-- ============================================
-- 5) Index expires_at manquants sur les tables data
-- FIX BUG #4: Wrapper dans des blocs DO $$ avec gestion d'exception
-- ============================================
-- Pour purge/lookup rapide
-- Utilise des blocs DO $$ pour éviter les erreurs si les tables n'existent pas encore

-- ticker_quotes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticker_quotes') THEN
    CREATE INDEX IF NOT EXISTS idx_ticker_quotes_expires ON ticker_quotes(expires_at);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore si la table n'existe pas
END $$;

-- options_flow
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'options_flow') THEN
    CREATE INDEX IF NOT EXISTS idx_options_flow_expires ON options_flow(expires_at);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- dark_pool_trades
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dark_pool_trades') THEN
    CREATE INDEX IF NOT EXISTS idx_dark_pool_trades_expires ON dark_pool_trades(expires_at);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- short_interest
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'short_interest') THEN
    CREATE INDEX IF NOT EXISTS idx_short_interest_expires ON short_interest(expires_at);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- insider_trades (si la table existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'insider_trades') THEN
    CREATE INDEX IF NOT EXISTS idx_insider_trades_expires ON insider_trades(expires_at);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- institutional_ownership (si la table existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'institutional_ownership') THEN
    CREATE INDEX IF NOT EXISTS idx_institutional_ownership_expires ON institutional_ownership(expires_at);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ============================================
-- 6) Fonction helper: get_module_ttls(module_id)
-- ============================================
-- Pour éviter les TTL hardcodés dans le code TS
-- IMPORTANT: Créer directement la fonction (pas dans DO $$) pour qu'elle soit visible par PostgREST
CREATE OR REPLACE FUNCTION get_module_ttls(p_module_id TEXT)
RETURNS TABLE (
  data_ttl_hours DECIMAL(5, 2),
  analysis_ttl_hours DECIMAL(5, 2),
  freshness_threshold_hours DECIMAL(5, 2),
  max_stale_hours DECIMAL(5, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ac.data_ttl_hours,
    ac.analysis_ttl_hours,
    ac.freshness_threshold_hours,
    ac.max_stale_hours
  FROM analysis_catalog ac
  WHERE ac.module_id = p_module_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

