-- Migration : Ajouter colonne timestamp à fmp_signals (si manquante)
-- Date : 2025-12-28
-- Description : Ajoute la colonne timestamp pour compatibilité avec le frontend
--               Cette migration est idempotente et peut être exécutée même si la colonne existe déjà

-- Ajouter la colonne timestamp si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'fmp_signals' 
    AND column_name = 'timestamp'
  ) THEN
    ALTER TABLE fmp_signals ADD COLUMN timestamp TIMESTAMPTZ DEFAULT NOW();
    
    -- Copier les valeurs de created_at vers timestamp pour les données existantes
    UPDATE fmp_signals SET timestamp = created_at WHERE timestamp IS NULL;
    
    -- Créer un index
    CREATE INDEX IF NOT EXISTS idx_fmp_signals_timestamp ON fmp_signals(timestamp DESC);
    
    RAISE NOTICE 'Column timestamp added to fmp_signals';
  ELSE
    RAISE NOTICE 'Column timestamp already exists in fmp_signals';
  END IF;
END $$;


