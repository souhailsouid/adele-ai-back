-- Migration: Système de notifications pour les changements de funds
-- Gère les préférences utilisateur, les notifications et les daily digests

-- Table user_fund_notifications : Préférences de notification par utilisateur
CREATE TABLE IF NOT EXISTS user_fund_notifications (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL, -- UUID de l'utilisateur (Supabase Auth)
  fund_id INTEGER REFERENCES funds(id) ON DELETE CASCADE,
  
  -- Règles de filtrage
  min_change_pct NUMERIC DEFAULT 5.0, -- Changement minimum en % pour notifier
  notify_on_new BOOLEAN DEFAULT true, -- Notifier les nouvelles positions
  notify_on_exit BOOLEAN DEFAULT true, -- Notifier les sorties totales (priorité haute)
  notify_on_increase BOOLEAN DEFAULT true, -- Notifier les augmentations
  notify_on_decrease BOOLEAN DEFAULT false, -- Notifier les diminutions (moins prioritaire)
  
  -- Canaux de notification
  email_enabled BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT false,
  webhook_url TEXT, -- URL webhook personnalisée
  
  -- Batching/Digest
  digest_enabled BOOLEAN DEFAULT true, -- Activer le daily digest
  digest_time TIME DEFAULT '09:00:00', -- Heure d'envoi du digest (UTC)
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter la contrainte UNIQUE si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_fund_notifications_user_id_fund_id_key'
  ) THEN
    ALTER TABLE user_fund_notifications ADD CONSTRAINT user_fund_notifications_user_id_fund_id_key UNIQUE(user_id, fund_id);
  END IF;
END $$;

-- Index pour user_fund_notifications (idempotent)
DROP INDEX IF EXISTS idx_user_fund_notifications_user_id;
DROP INDEX IF EXISTS idx_user_fund_notifications_fund_id;
CREATE INDEX idx_user_fund_notifications_user_id ON user_fund_notifications(user_id);
CREATE INDEX idx_user_fund_notifications_fund_id ON user_fund_notifications(fund_id);

-- Table fund_notifications : Notifications générées
CREATE TABLE IF NOT EXISTS fund_notifications (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  fund_id INTEGER REFERENCES funds(id) ON DELETE CASCADE,
  diff_id INTEGER REFERENCES fund_holdings_diff(id) ON DELETE CASCADE,
  filing_id_new INTEGER REFERENCES fund_filings(id),
  
  -- Contenu de la notification
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  
  -- Métadonnées
  ticker TEXT,
  action TEXT CHECK (action IN ('new', 'exit', 'increase', 'decrease')),
  diff_shares_pct NUMERIC,
  
  -- Statut
  status TEXT CHECK (status IN ('pending', 'sent', 'failed', 'batched')) DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  digest_id INTEGER, -- ID du digest si regroupée
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour fund_notifications (idempotent)
DROP INDEX IF EXISTS idx_fund_notifications_user_id;
DROP INDEX IF EXISTS idx_fund_notifications_status;
DROP INDEX IF EXISTS idx_fund_notifications_digest;
DROP INDEX IF EXISTS idx_fund_notifications_created_at;
CREATE INDEX idx_fund_notifications_user_id ON fund_notifications(user_id);
CREATE INDEX idx_fund_notifications_status ON fund_notifications(status) WHERE status = 'pending';
CREATE INDEX idx_fund_notifications_digest ON fund_notifications(digest_id) WHERE digest_id IS NOT NULL;
CREATE INDEX idx_fund_notifications_created_at ON fund_notifications(created_at DESC);

-- Table notification_digests : Daily digests regroupés
CREATE TABLE IF NOT EXISTS notification_digests (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  digest_date DATE NOT NULL,
  
  -- Contenu
  title TEXT NOT NULL,
  summary TEXT,
  total_notifications INTEGER DEFAULT 0,
  funds_count INTEGER DEFAULT 0,
  
  -- Statut
  status TEXT CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter la contrainte UNIQUE si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notification_digests_user_id_digest_date_key'
  ) THEN
    ALTER TABLE notification_digests ADD CONSTRAINT notification_digests_user_id_digest_date_key UNIQUE(user_id, digest_date);
  END IF;
END $$;

-- Index pour notification_digests (idempotent)
DROP INDEX IF EXISTS idx_notification_digests_user_id;
DROP INDEX IF EXISTS idx_notification_digests_status;
DROP INDEX IF EXISTS idx_notification_digests_date;
CREATE INDEX idx_notification_digests_user_id ON notification_digests(user_id);
CREATE INDEX idx_notification_digests_status ON notification_digests(status) WHERE status = 'pending';
CREATE INDEX idx_notification_digests_date ON notification_digests(digest_date DESC);

-- Fonction pour déterminer la priorité d'une notification
CREATE OR REPLACE FUNCTION get_notification_priority(
  p_action TEXT,
  p_diff_pct NUMERIC
) RETURNS TEXT AS $$
BEGIN
  -- Exit = toujours critical
  IF p_action = 'exit' THEN
    RETURN 'critical';
  END IF;
  
  -- New = high
  IF p_action = 'new' THEN
    RETURN 'high';
  END IF;
  
  -- Increase/Decrease selon le pourcentage
  IF p_diff_pct >= 20 THEN
    RETURN 'high';
  ELSIF p_diff_pct >= 10 THEN
    RETURN 'medium';
  ELSE
    RETURN 'low';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Vue pour les notifications en attente (non regroupées)
DROP VIEW IF EXISTS pending_fund_notifications;
CREATE VIEW pending_fund_notifications AS
SELECT 
  fn.id,
  fn.user_id,
  fn.fund_id,
  fn.diff_id,
  fn.filing_id_new,
  fn.title,
  fn.message,
  fn.priority,
  COALESCE(ffd.ticker, fn.ticker) as ticker,
  COALESCE(ffd.action, fn.action) as action,
  COALESCE(fn.diff_shares_pct, ffd.diff_pct_shares) as diff_shares_pct,
  fn.status,
  fn.sent_at,
  fn.digest_id,
  fn.created_at,
  f.name as fund_name,
  COALESCE(ffd.diff_shares, 0) as diff_shares,
  ff.filing_date as filing_date
FROM fund_notifications fn
JOIN funds f ON f.id = fn.fund_id
LEFT JOIN fund_holdings_diff ffd ON ffd.id = fn.diff_id
LEFT JOIN fund_filings ff ON ff.id = fn.filing_id_new
WHERE fn.status = 'pending'
  AND fn.digest_id IS NULL
ORDER BY 
  CASE fn.priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  fn.created_at DESC;
