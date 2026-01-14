-- Migration: Mise à jour de la table companies et création de earnings_history
-- Date: 2026-01-10

-- ============================================
-- 1. Ajouter sic_code à la table companies
-- ============================================

-- Ajouter la colonne sic_code si elle n'existe pas déjà
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'sic_code'
  ) THEN
    ALTER TABLE companies ADD COLUMN sic_code TEXT;
    CREATE INDEX idx_companies_sic_code ON companies(sic_code);
    COMMENT ON COLUMN companies.sic_code IS 'Standard Industrial Classification code';
  END IF;
END $$;

-- ============================================
-- 2. Créer la table earnings_history
-- ============================================

CREATE TABLE IF NOT EXISTS earnings_history (
  id SERIAL PRIMARY KEY,
  cik TEXT NOT NULL, -- CIK de l'entreprise (ex: '0001045810')
  report_date DATE NOT NULL, -- Date de publication du rapport
  fiscal_year INTEGER NOT NULL, -- Année fiscale (ex: 2024)
  fiscal_period TEXT NOT NULL, -- 'Q1', 'Q2', 'Q3', 'Q4', 'FY' (Full Year)
  eps_actual NUMERIC, -- Earnings Per Share réel
  revenue_actual BIGINT, -- Revenue réel (en USD)
  eps_estimate NUMERIC, -- Estimation EPS (optionnel)
  revenue_estimate BIGINT, -- Estimation Revenue (optionnel)
  eps_surprise NUMERIC, -- Surprise EPS (optionnel)
  revenue_surprise NUMERIC, -- Surprise Revenue en % (optionnel)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Contrainte d'unicité : un seul rapport par CIK, fiscal_year, fiscal_period
  CONSTRAINT earnings_history_unique UNIQUE (cik, fiscal_year, fiscal_period)
);

-- Index pour performances
CREATE INDEX idx_earnings_history_cik ON earnings_history(cik);
CREATE INDEX idx_earnings_history_report_date ON earnings_history(report_date DESC);
CREATE INDEX idx_earnings_history_fiscal_year ON earnings_history(fiscal_year DESC, fiscal_period);
CREATE INDEX idx_earnings_history_cik_fiscal ON earnings_history(cik, fiscal_year DESC, fiscal_period);

-- Commentaires pour documentation
COMMENT ON TABLE earnings_history IS 'Historique des résultats financiers (earnings) par entreprise';
COMMENT ON COLUMN earnings_history.cik IS 'CIK de l''entreprise (peut référencer companies.cik)';
COMMENT ON COLUMN earnings_history.report_date IS 'Date de publication du rapport de résultats';
COMMENT ON COLUMN earnings_history.fiscal_year IS 'Année fiscale du rapport';
COMMENT ON COLUMN earnings_history.fiscal_period IS 'Période fiscale: Q1, Q2, Q3, Q4, ou FY (Full Year)';
COMMENT ON COLUMN earnings_history.eps_actual IS 'Earnings Per Share réel';
COMMENT ON COLUMN earnings_history.revenue_actual IS 'Revenue réel en USD';

-- ============================================
-- 3. Optionnel : Créer une vue pour joindre companies et earnings_history
-- ============================================

CREATE OR REPLACE VIEW companies_with_earnings AS
SELECT 
  c.id,
  c.cik,
  c.ticker,
  c.name,
  c.sic_code,
  c.industry,
  c.sector,
  c.market_cap,
  c.headquarters_country,
  c.headquarters_state,
  c.created_at,
  c.updated_at,
  e.report_date AS latest_earnings_date,
  e.fiscal_year AS latest_fiscal_year,
  e.fiscal_period AS latest_fiscal_period,
  e.eps_actual AS latest_eps_actual,
  e.revenue_actual AS latest_revenue_actual
FROM companies c
LEFT JOIN LATERAL (
  SELECT *
  FROM earnings_history
  WHERE earnings_history.cik = c.cik
  ORDER BY earnings_history.report_date DESC
  LIMIT 1
) e ON true;

COMMENT ON VIEW companies_with_earnings IS 'Vue combinant companies avec les dernières informations earnings';
