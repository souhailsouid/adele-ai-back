-- Migration: Ajouter les index manquants pour optimiser les requêtes d'analyse stratégique
-- Ces index améliorent les performances pour:
-- - detectMultiQuarterTrends (requêtes sur fund_holdings_diff par filing_id_new)
-- - getPortfolioWeightsBatch (requêtes sur fund_holdings par filing_id et type)
-- - getTickersSectorsBatch (requêtes sur companies par ticker)

-- Index composé pour fund_holdings: filing_id + type (pour filtrer rapidement les stocks)
-- Utilisé dans getPortfolioWeightsBatch pour récupérer les holdings d'un filing
CREATE INDEX IF NOT EXISTS idx_fund_holdings_filing_id_type 
ON fund_holdings(filing_id, type) 
WHERE type = 'stock';

-- Index pour fund_holdings_diff: filing_id_new (pour les requêtes de tendances)
-- Utilisé dans detectMultiQuarterTrends pour récupérer les diffs par filing
CREATE INDEX IF NOT EXISTS idx_fund_holdings_diff_filing_id_new 
ON fund_holdings_diff(filing_id_new);

-- Index composé pour fund_holdings_diff: fund_id + ticker (pour les requêtes par ticker)
-- Utilisé dans getFundTickerDiffs et les analyses par ticker
CREATE INDEX IF NOT EXISTS idx_fund_holdings_diff_fund_id_ticker 
ON fund_holdings_diff(fund_id, ticker);

-- Index composé pour fund_holdings_diff: fund_id + filing_id_new (pour les requêtes de tendances)
-- Utilisé dans detectMultiQuarterTrends pour récupérer les diffs d'un fund par filing
CREATE INDEX IF NOT EXISTS idx_fund_holdings_diff_fund_id_filing_id_new 
ON fund_holdings_diff(fund_id, filing_id_new);

-- Index pour fund_filings: fund_id + status + filing_date (pour les requêtes de tendances)
-- Utilisé dans detectMultiQuarterTrends pour récupérer les filings parsés triés par date
CREATE INDEX IF NOT EXISTS idx_fund_filings_fund_id_status_date 
ON fund_filings(fund_id, status, filing_date DESC) 
WHERE status = 'PARSED';

-- Index pour companies: ticker (si pas déjà présent)
-- Utilisé dans getTickersSectorsBatch pour récupérer les secteurs des tickers
CREATE INDEX IF NOT EXISTS idx_companies_ticker 
ON companies(ticker);

-- Vérification: Afficher les index créés
DO $$ 
BEGIN
  RAISE NOTICE 'Index créés avec succès pour optimiser les requêtes d''analyse stratégique';
END $$;
