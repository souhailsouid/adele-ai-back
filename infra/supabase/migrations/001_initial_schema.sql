-- ADEL AI - Initial Schema
-- Tables pour signaux multi-sources et 13F filings

-- Table signals (signaux multi-sources)
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- 'scrapecreators', 'coinglass', 'rss', 'sec_8k', 'sec_13f'
  type TEXT NOT NULL, -- 'trump', 'social', 'funding', 'oi', 'liquidation', 'news', 'corporate', 'institutional'
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_data JSONB, -- Données brutes de la source
  
  -- Champs IA (enrichis par worker)
  summary TEXT,
  importance_score INTEGER CHECK (importance_score BETWEEN 1 AND 10),
  tags TEXT[],
  impact TEXT,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  
  -- Métadonnées
  processed_at TIMESTAMPTZ,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour signals
CREATE INDEX idx_signals_source_timestamp ON signals(source, timestamp DESC);
CREATE INDEX idx_signals_type_timestamp ON signals(type, timestamp DESC);
CREATE INDEX idx_signals_importance_timestamp ON signals(importance_score DESC, timestamp DESC);
CREATE INDEX idx_signals_processing_status ON signals(processing_status) WHERE processing_status = 'pending';
-- Full-text search
CREATE INDEX idx_signals_summary_fts ON signals USING gin(to_tsvector('english', COALESCE(summary, '')));

-- Table funds (fonds à suivre pour 13F)
CREATE TABLE funds (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  cik TEXT UNIQUE NOT NULL,
  tier_influence INTEGER CHECK (tier_influence BETWEEN 1 AND 5),
  category TEXT, -- 'hedge_fund', 'family_office', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table fund_filings (13F filings)
CREATE TABLE fund_filings (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER REFERENCES funds(id),
  accession_number TEXT UNIQUE NOT NULL,
  form_type TEXT, -- '13F-HR', '13F-HR/A'
  filing_date DATE,
  period_of_report DATE, -- date de fin de trimestre
  raw_storage_path TEXT, -- S3 path ou Supabase Storage
  status TEXT DEFAULT 'DISCOVERED' CHECK (status IN ('DISCOVERED', 'DOWNLOADED', 'PARSED', 'FAILED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fund_filings_fund_id ON fund_filings(fund_id);
CREATE INDEX idx_fund_filings_status ON fund_filings(status) WHERE status != 'PARSED';

-- Table fund_holdings (positions dans un filing)
CREATE TABLE fund_holdings (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER REFERENCES funds(id),
  filing_id INTEGER REFERENCES fund_filings(id),
  ticker TEXT,
  cusip TEXT,
  shares BIGINT,
  market_value BIGINT, -- en USD
  type TEXT CHECK (type IN ('stock', 'call', 'put')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fund_holdings_fund_id ON fund_holdings(fund_id);
CREATE INDEX idx_fund_holdings_filing_id ON fund_holdings(filing_id);
CREATE INDEX idx_fund_holdings_ticker ON fund_holdings(ticker);

-- Table fund_holdings_diff (diff entre filings)
CREATE TABLE fund_holdings_diff (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER REFERENCES funds(id),
  ticker TEXT,
  filing_id_new INTEGER REFERENCES fund_filings(id),
  filing_id_old INTEGER REFERENCES fund_filings(id),
  diff_shares BIGINT,
  diff_value BIGINT,
  diff_pct_shares NUMERIC,
  action TEXT CHECK (action IN ('new', 'exit', 'increase', 'decrease')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fund_holdings_diff_fund_id ON fund_holdings_diff(fund_id);
CREATE INDEX idx_fund_holdings_diff_ticker ON fund_holdings_diff(ticker);

-- Table fund_signals (signaux générés depuis 13F)
CREATE TABLE fund_signals (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER REFERENCES funds(id),
  ticker TEXT,
  filing_id INTEGER REFERENCES fund_filings(id),
  impact_score NUMERIC,
  action TEXT CHECK (action IN ('new', 'exit', 'increase', 'decrease')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fund_signals_ticker ON fund_signals(ticker);
CREATE INDEX idx_fund_signals_impact ON fund_signals(impact_score DESC);

