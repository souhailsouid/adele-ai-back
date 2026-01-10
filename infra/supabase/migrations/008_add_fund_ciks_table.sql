-- Migration: Support des fonds avec plusieurs CIK
-- Certaines institutions (comme BlackRock) ont plusieurs entités légales avec des CIK différents

-- Table fund_ciks : Lier plusieurs CIK à un même fund
CREATE TABLE IF NOT EXISTS fund_ciks (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER NOT NULL REFERENCES funds(id) ON DELETE CASCADE,
  cik TEXT NOT NULL,
  entity_name TEXT, -- Nom de l'entité légale (ex: "BlackRock Inc.", "BlackRock Advisors LLC")
  is_primary BOOLEAN DEFAULT false, -- CIK principal (celui dans funds.cik)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter la contrainte UNIQUE si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fund_ciks_fund_id_cik_key'
  ) THEN
    ALTER TABLE fund_ciks ADD CONSTRAINT fund_ciks_fund_id_cik_key UNIQUE(fund_id, cik);
  END IF;
END $$;

-- Index pour les requêtes (IF NOT EXISTS n'existe pas pour CREATE INDEX, utiliser DROP IF EXISTS)
DROP INDEX IF EXISTS idx_fund_ciks_fund_id;
DROP INDEX IF EXISTS idx_fund_ciks_cik;
DROP INDEX IF EXISTS idx_fund_ciks_primary;

CREATE INDEX idx_fund_ciks_fund_id ON fund_ciks(fund_id);
CREATE INDEX idx_fund_ciks_cik ON fund_ciks(cik);
CREATE INDEX idx_fund_ciks_primary ON fund_ciks(fund_id, is_primary) WHERE is_primary = true;

-- Migrer les CIK existants : créer une entrée dans fund_ciks pour chaque fund existant
-- (Seulement si la table fund_ciks existe et n'est pas vide)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fund_ciks') THEN
    INSERT INTO fund_ciks (fund_id, cik, entity_name, is_primary)
    SELECT id, cik, name, true
    FROM funds
    WHERE NOT EXISTS (
      SELECT 1 FROM fund_ciks fc 
      WHERE fc.fund_id = funds.id AND fc.cik = funds.cik
    );
  END IF;
END $$;

-- Fonction pour obtenir tous les CIK d'un fund
CREATE OR REPLACE FUNCTION get_fund_ciks(p_fund_id INTEGER)
RETURNS TABLE(cik TEXT, entity_name TEXT, is_primary BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT fc.cik, fc.entity_name, fc.is_primary
  FROM fund_ciks fc
  WHERE fc.fund_id = p_fund_id
  ORDER BY fc.is_primary DESC, fc.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Vue pour faciliter les requêtes (tous les filings d'un fund, tous CIK confondus)
DROP VIEW IF EXISTS fund_filings_aggregated;
CREATE VIEW fund_filings_aggregated AS
SELECT 
  f.id as fund_id,
  f.name as fund_name,
  ff.id as filing_id,
  ff.cik as filing_cik,
  COALESCE(fc.entity_name, f.name) as entity_name,
  COALESCE(fc.is_primary, true) as is_primary,
  ff.accession_number,
  ff.form_type,
  ff.filing_date,
  ff.status
FROM funds f
LEFT JOIN fund_ciks fc ON fc.fund_id = f.id AND fc.cik = f.cik
JOIN fund_filings ff ON ff.cik = f.cik
UNION
SELECT 
  f.id as fund_id,
  f.name as fund_name,
  ff.id as filing_id,
  ff.cik as filing_cik,
  fc.entity_name as entity_name,
  fc.is_primary,
  ff.accession_number,
  ff.form_type,
  ff.filing_date,
  ff.status
FROM funds f
JOIN fund_ciks fc ON fc.fund_id = f.id
JOIN fund_filings ff ON ff.cik = fc.cik
WHERE fc.is_primary = false
ORDER BY fund_id, filing_date DESC;

-- Vue pour le portefeuille dédupliqué (évite le double comptage)
-- Priorise le CIK Primary pour chaque ticker
DROP VIEW IF EXISTS fund_portfolio_deduplicated;
CREATE VIEW fund_portfolio_deduplicated AS
WITH primary_holdings AS (
  -- Holdings du CIK Primary
  SELECT DISTINCT ON (fh.ticker, fh.fund_id)
    fh.fund_id,
    fh.ticker,
    fh.shares,
    fh.market_value,
    fh.cik,
    ff.filing_date,
    true as is_primary
  FROM fund_holdings fh
  JOIN fund_filings ff ON ff.id = fh.filing_id
  JOIN funds f ON f.id = fh.fund_id
  WHERE fh.type = 'stock'
    AND fh.cik = f.cik  -- CIK Primary
    AND ff.status = 'PARSED'
  ORDER BY fh.ticker, fh.fund_id, ff.filing_date DESC
),
secondary_holdings AS (
  -- Holdings des CIK secondaires (uniquement si ticker n'existe pas dans primary)
  SELECT DISTINCT ON (fh.ticker, fh.fund_id)
    fh.fund_id,
    fh.ticker,
    fh.shares,
    fh.market_value,
    fh.cik,
    ff.filing_date,
    false as is_primary
  FROM fund_holdings fh
  JOIN fund_filings ff ON ff.id = fh.filing_id
  JOIN fund_ciks fc ON fc.cik = fh.cik AND fc.fund_id = fh.fund_id
  WHERE fh.type = 'stock'
    AND fc.is_primary = false
    AND ff.status = 'PARSED'
    AND NOT EXISTS (
      SELECT 1 FROM primary_holdings ph
      WHERE ph.fund_id = fh.fund_id AND ph.ticker = fh.ticker
    )
  ORDER BY fh.ticker, fh.fund_id, ff.filing_date DESC
)
SELECT * FROM primary_holdings
UNION ALL
SELECT * FROM secondary_holdings;
