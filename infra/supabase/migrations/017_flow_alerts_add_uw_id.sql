-- Migration: Modifier la contrainte unique de flow_alerts
-- Utiliser (ticker, option_chain, created_at) comme clé unique principale
-- option_chain identifie déjà le contrat de manière unique, created_at distingue les alertes du même contrat

-- Ajouter la colonne uw_id si elle n'existe pas (pour référence future)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'flow_alerts' AND column_name = 'uw_id'
  ) THEN
    ALTER TABLE flow_alerts ADD COLUMN uw_id TEXT;
  END IF;
END $$;

-- Supprimer l'ancienne contrainte unique si elle existe
ALTER TABLE flow_alerts DROP CONSTRAINT IF EXISTS unique_flow_alert;

-- Créer une nouvelle contrainte unique sur (ticker, option_chain, created_at)
-- option_chain identifie déjà le contrat de manière unique (ex: "MSFT260116P00475000")
-- created_at distingue les alertes du même contrat à des moments différents
ALTER TABLE flow_alerts 
  ADD CONSTRAINT unique_flow_alert 
  UNIQUE (ticker, option_chain, created_at);

-- Index pour recherche rapide par uw_id (si présent)
CREATE INDEX IF NOT EXISTS idx_flow_alerts_uw_id_lookup 
  ON flow_alerts(uw_id) 
  WHERE uw_id IS NOT NULL;
