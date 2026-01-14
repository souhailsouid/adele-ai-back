-- Migration: Ajouter les colonnes pour l'enrichissement SEC
-- Date: 2026-01-10

-- Ajouter les colonnes manquantes à la table companies pour l'enrichissement SEC

DO $$ 
BEGIN
  -- EIN (Employer Identification Number)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'ein'
  ) THEN
    ALTER TABLE companies ADD COLUMN ein TEXT;
    CREATE INDEX idx_companies_ein ON companies(ein);
    COMMENT ON COLUMN companies.ein IS 'Employer Identification Number (ID fiscal)';
  END IF;

  -- Fiscal Year End
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'fiscal_year_end'
  ) THEN
    ALTER TABLE companies ADD COLUMN fiscal_year_end TEXT;
    COMMENT ON COLUMN companies.fiscal_year_end IS 'Date de fin d''exercice fiscal (format: MM-DD)';
  END IF;

  -- Filer Category
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'filer_category'
  ) THEN
    ALTER TABLE companies ADD COLUMN filer_category TEXT;
    COMMENT ON COLUMN companies.filer_category IS 'Catégorie de filer SEC (ex: Large accelerated filer)';
  END IF;

  -- Exchanges
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'exchanges'
  ) THEN
    ALTER TABLE companies ADD COLUMN exchanges TEXT;
    COMMENT ON COLUMN companies.exchanges IS 'Bourses où l''entreprise est cotée (ex: NYSE, NASDAQ)';
  END IF;

  -- Former Names
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'former_names'
  ) THEN
    ALTER TABLE companies ADD COLUMN former_names JSONB;
    COMMENT ON COLUMN companies.former_names IS 'Historique des noms de l''entreprise (format JSON)';
  END IF;
END $$;
