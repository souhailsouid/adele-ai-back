-- Migration: Ajouter earnings_calendar et colonne category à companies
-- Date: 2026-01-10

-- ============================================
-- 1. Ajouter la colonne category à companies
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'category'
  ) THEN
    ALTER TABLE companies ADD COLUMN category TEXT;
    CREATE INDEX idx_companies_category ON companies(category);
    COMMENT ON COLUMN companies.category IS 'Catégorie basée sur le code SIC (Agriculture, Finance, Tech, etc.)';
  END IF;
END $$;

-- ============================================
-- 2. Créer la table earnings_calendar
-- ============================================

CREATE TABLE IF NOT EXISTS earnings_calendar (
  id SERIAL PRIMARY KEY,
  cik TEXT NOT NULL, -- CIK de l'entreprise
  ticker TEXT, -- Ticker de l'entreprise (peut être null)
  filing_date DATE NOT NULL, -- Date du filing 8-K
  accession_number TEXT, -- Numéro d'accession SEC
  form_type TEXT NOT NULL DEFAULT '8-K', -- Type de formulaire (toujours 8-K pour earnings)
  item TEXT NOT NULL DEFAULT '2.02', -- Item du formulaire (toujours 2.02 pour earnings)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Contrainte d'unicité : un seul événement par CIK, filing_date, form_type, item
  CONSTRAINT earnings_calendar_unique UNIQUE (cik, filing_date, form_type, item)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_cik ON earnings_calendar(cik);
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_ticker ON earnings_calendar(ticker) WHERE ticker IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_filing_date ON earnings_calendar(filing_date DESC);
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_cik_date ON earnings_calendar(cik, filing_date DESC);

-- Commentaires pour documentation
COMMENT ON TABLE earnings_calendar IS 'Calendrier des annonces de résultats (earnings) détectées depuis les filings 8-K avec item 2.02';
COMMENT ON COLUMN earnings_calendar.cik IS 'CIK de l''entreprise (peut référencer companies.cik)';
COMMENT ON COLUMN earnings_calendar.ticker IS 'Ticker de l''entreprise (peut être null si non disponible)';
COMMENT ON COLUMN earnings_calendar.filing_date IS 'Date du filing 8-K contenant l''annonce de résultats';
COMMENT ON COLUMN earnings_calendar.form_type IS 'Type de formulaire SEC (toujours 8-K pour les annonces de résultats)';
COMMENT ON COLUMN earnings_calendar.item IS 'Item du formulaire (toujours 2.02 pour "Results of Operations and Financial Condition")';

-- ============================================
-- 3. Trigger pour updated_at
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_earnings_calendar_updated_at ON earnings_calendar;
    CREATE TRIGGER update_earnings_calendar_updated_at
      BEFORE UPDATE ON earnings_calendar
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
