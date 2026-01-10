-- Migration: Ajouter le support des notifications d'accumulation multi-trimestres
-- Permet de notifier globalement les utilisateurs lorsqu'un fund accumule une position sur plusieurs trimestres

-- Ajouter le type 'accumulation' à l'action dans fund_notifications
ALTER TABLE fund_notifications
  DROP CONSTRAINT IF EXISTS fund_notifications_action_check;

ALTER TABLE fund_notifications
  ADD CONSTRAINT fund_notifications_action_check 
  CHECK (action IN ('new', 'exit', 'increase', 'decrease', 'accumulation'));

-- Ajouter les colonnes pour les métadonnées d'accumulation
ALTER TABLE fund_notifications
  ADD COLUMN IF NOT EXISTS trend_quarters INTEGER,
  ADD COLUMN IF NOT EXISTS is_strong_accumulation BOOLEAN DEFAULT false; -- true si 3+ trimestres

-- Ajouter une préférence pour notifier les accumulations
ALTER TABLE user_fund_notifications
  ADD COLUMN IF NOT EXISTS notify_on_accumulation BOOLEAN DEFAULT true; -- Notifier les accumulations multi-trimestres

-- Index pour rechercher les notifications d'accumulation
CREATE INDEX IF NOT EXISTS idx_fund_notifications_action_accumulation 
  ON fund_notifications(action, trend_quarters) 
  WHERE action = 'accumulation';

CREATE INDEX IF NOT EXISTS idx_fund_notifications_accumulation_created 
  ON fund_notifications(created_at DESC) 
  WHERE action = 'accumulation' AND status IN ('pending', 'batched');

-- Vue pour les notifications d'accumulation globales (pour tous les utilisateurs)
DROP VIEW IF EXISTS global_accumulation_notifications;
CREATE VIEW global_accumulation_notifications AS
SELECT 
  fn.id,
  fn.user_id,
  fn.fund_id,
  f.name as fund_name,
  fn.ticker,
  fn.trend_quarters,
  fn.is_strong_accumulation,
  fn.title,
  fn.message,
  fn.priority,
  fn.status,
  fn.created_at,
  fn.filing_id_new,
  ff.filing_date as filing_date
FROM fund_notifications fn
JOIN funds f ON f.id = fn.fund_id
LEFT JOIN fund_filings ff ON ff.id = fn.filing_id_new
WHERE fn.action = 'accumulation'
  AND fn.status IN ('pending', 'batched')
ORDER BY 
  fn.is_strong_accumulation DESC, -- Prioriser les accumulations 3+Q
  fn.trend_quarters DESC,
  fn.created_at DESC;
