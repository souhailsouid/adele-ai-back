-- Migration: Ajouter CIK aux tables fund_filings et fund_holdings
-- Pour simplifier les requêtes et éviter les JOINs

-- 1. Ajouter cik à fund_filings
ALTER TABLE fund_filings 
ADD COLUMN cik TEXT;

-- 2. Ajouter cik à fund_holdings
ALTER TABLE fund_holdings 
ADD COLUMN cik TEXT;

-- 3. Remplir les valeurs existantes depuis la table funds
UPDATE fund_filings ff
SET cik = f.cik
FROM funds f
WHERE ff.fund_id = f.id;

UPDATE fund_holdings fh
SET cik = f.cik
FROM funds f
WHERE fh.fund_id = f.id;

-- 4. Créer des index pour améliorer les performances
CREATE INDEX idx_fund_filings_cik ON fund_filings(cik);
CREATE INDEX idx_fund_holdings_cik ON fund_holdings(cik);

-- 5. Optionnel: Ajouter une contrainte pour s'assurer que le CIK correspond
-- (on peut le faire plus tard si nécessaire)

