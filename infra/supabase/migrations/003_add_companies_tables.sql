-- Migration: Ajouter les tables pour l'analyse des entreprises
-- Phase 1: Companies et Company Filings

-- Table companies (entreprises à suivre)
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  ticker TEXT UNIQUE NOT NULL, -- 'NVDA'
  cik TEXT UNIQUE NOT NULL, -- CIK de l'entreprise (ex: '0001045810' pour NVIDIA)
  name TEXT NOT NULL, -- 'NVIDIA Corporation'
  sector TEXT, -- 'Technology'
  industry TEXT, -- 'Semiconductors'
  market_cap BIGINT, -- en USD
  headquarters_country TEXT, -- 'USA'
  headquarters_state TEXT, -- 'CA'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_ticker ON companies(ticker);
CREATE INDEX idx_companies_cik ON companies(cik);
CREATE INDEX idx_companies_sector ON companies(sector);

-- Table company_filings (tous les filings SEC d'une entreprise)
CREATE TABLE company_filings (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  cik TEXT NOT NULL, -- pour requêtes directes (évite JOIN)
  form_type TEXT NOT NULL, -- '8-K', '10-K', '10-Q', '4', 'DEF 14A', etc.
  accession_number TEXT UNIQUE NOT NULL,
  filing_date DATE NOT NULL,
  period_of_report DATE, -- pour 10-K/10-Q (date de fin de période)
  document_url TEXT, -- URL du document sur EDGAR
  raw_content TEXT, -- contenu brut (pour parsing futur)
  status TEXT DEFAULT 'DISCOVERED' CHECK (status IN ('DISCOVERED', 'PARSED', 'FAILED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_company_filings_company_id ON company_filings(company_id);
CREATE INDEX idx_company_filings_cik ON company_filings(cik);
CREATE INDEX idx_company_filings_form_type ON company_filings(form_type);
CREATE INDEX idx_company_filings_filing_date ON company_filings(filing_date DESC);
CREATE INDEX idx_company_filings_status ON company_filings(status) WHERE status != 'PARSED';

-- Table company_events (événements extraits des 8-K)
CREATE TABLE company_events (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  filing_id INTEGER REFERENCES company_filings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'earnings', 'acquisition', 'management_change', 'guidance', 'product_launch', etc.
  event_date DATE,
  title TEXT,
  summary TEXT, -- résumé IA (futur)
  importance_score INTEGER CHECK (importance_score BETWEEN 1 AND 10),
  raw_data JSONB, -- données structurées extraites
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_company_events_company_id ON company_events(company_id);
CREATE INDEX idx_company_events_filing_id ON company_events(filing_id);
CREATE INDEX idx_company_events_event_type ON company_events(event_type);
CREATE INDEX idx_company_events_event_date ON company_events(event_date DESC);
CREATE INDEX idx_company_events_importance ON company_events(importance_score DESC);

-- Table insider_trades (Form 4 - achats/ventes des dirigeants)
CREATE TABLE insider_trades (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  filing_id INTEGER REFERENCES company_filings(id) ON DELETE CASCADE,
  insider_name TEXT,
  insider_title TEXT, -- 'CEO', 'CFO', 'Director', etc.
  transaction_type TEXT, -- 'buy', 'sell', 'option_exercise', 'grant', etc.
  shares BIGINT,
  price_per_share NUMERIC,
  total_value NUMERIC,
  transaction_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insider_trades_company_id ON insider_trades(company_id);
CREATE INDEX idx_insider_trades_filing_id ON insider_trades(filing_id);
CREATE INDEX idx_insider_trades_transaction_date ON insider_trades(transaction_date DESC);
CREATE INDEX idx_insider_trades_transaction_type ON insider_trades(transaction_type);
CREATE INDEX idx_insider_trades_insider_name ON insider_trades(insider_name);

-- Commentaires pour documentation
COMMENT ON TABLE companies IS 'Entreprises à suivre pour analyse SEC et macro';
COMMENT ON TABLE company_filings IS 'Tous les filings SEC d''une entreprise (8-K, 10-K, 10-Q, Form 4, etc.)';
COMMENT ON TABLE company_events IS 'Événements extraits des 8-K (earnings, acquisitions, etc.)';
COMMENT ON TABLE insider_trades IS 'Transactions des dirigeants (Form 4)';




