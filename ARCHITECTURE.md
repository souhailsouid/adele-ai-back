# ADEL AI - Architecture Phase 1

## Stack Technique

- **DB**: Supabase PostgreSQL (gratuit)
- **Collectors**: Lambda TypeScript (RSS, CoinGlass, ScrapeCreators)
- **Parser 13F**: Lambda Python (parsing EDGAR XML/TXT)
- **API**: Lambda TypeScript (REST + Chat IA)
- **Orchestration**: EventBridge
- **Auth**: Cognito (existant)

## Schéma de Données Supabase

### Table `signals` (signaux multi-sources)
```sql
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

CREATE INDEX idx_signals_source_timestamp ON signals(source, timestamp DESC);
CREATE INDEX idx_signals_type_timestamp ON signals(type, timestamp DESC);
CREATE INDEX idx_signals_importance_timestamp ON signals(importance_score DESC, timestamp DESC);
CREATE INDEX idx_signals_processing_status ON signals(processing_status) WHERE processing_status = 'pending';
-- Full-text search
CREATE INDEX idx_signals_summary_fts ON signals USING gin(to_tsvector('english', COALESCE(summary, '')));
```

### Table `funds` (fonds à suivre pour 13F)
```sql
CREATE TABLE funds (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  cik TEXT UNIQUE NOT NULL,
  tier_influence INTEGER CHECK (tier_influence BETWEEN 1 AND 5),
  category TEXT, -- 'hedge_fund', 'family_office', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table `fund_filings` (13F filings)
```sql
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
```

### Table `fund_holdings` (positions dans un filing)
```sql
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
```

### Table `fund_holdings_diff` (diff entre filings)
```sql
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
```

### Table `fund_signals` (signaux générés depuis 13F)
```sql
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
```

## Pipeline de Collecte

### 1. Collectors (Lambda TypeScript)

**collector-rss** (EventBridge cron: toutes les 15 min)
- Scrape Reuters, AP, Yahoo Finance
- Insère dans `signals` avec `status='pending'`
- Publie event `NEW_SIGNAL` → EventBridge

**collector-coinglass** (EventBridge cron: toutes les heures)
- Appelle CoinGlass API (funding, OI, liquidations)
- Insère dans `signals`
- Publie event `NEW_SIGNAL`

**collector-scrapecreators** (EventBridge cron: toutes les 5 min)
- Appelle ScrapeCreators API (Trump, Twitter, Reddit)
- Insère dans `signals`
- Publie event `NEW_SIGNAL`

**collector-sec-watcher** (EventBridge cron: toutes les 5 min)
- Poll EDGAR pour liste de CIK (table `funds`)
- Détecte nouveaux 13F
- Insère dans `fund_filings` avec `status='DISCOVERED'`
- Publie event `NEW_13F_DISCOVERED`

### 2. Parser 13F (Lambda Python)

**parser-13f** (déclenché par `NEW_13F_DISCOVERED`)
- Télécharge fichier EDGAR (XML/TXT)
- Parse avec BeautifulSoup/lxml
- Insère dans `fund_holdings`
- Met à jour `fund_filings.status='PARSED'`
- Publie event `13F_PARSED`

### 3. Diff Engine (Lambda TypeScript)

**diff-13f** (déclenché par `13F_PARSED`)
- Compare avec filing précédent du même fund
- Calcule diffs (new, exit, increase, decrease)
- Insère dans `fund_holdings_diff`
- Calcule `impact_score`
- Insère dans `fund_signals`
- Publie event `NEW_13F_SIGNAL`

### 4. IA Processor (Lambda TypeScript)

**processor-ia** (déclenché par `NEW_SIGNAL`)
- Récupère signal avec `status='pending'`
- Appelle GPT pour:
  - Résumé 1 phrase
  - Score importance (1-10)
  - Tags
  - Impact
  - Priorité
- Met à jour `signals` avec résultats
- Met `status='completed'`

## API Endpoints

### GET /signals
- Liste avec filtres (source, type, date, importance)
- Full-text search sur `summary`

### GET /signals/{id}
- Détail d'un signal

### POST /search
- Recherche textuelle dans `signals`
- Retourne résultats + métadonnées

### POST /chat
- Chat IA sur les données
- Flow:
  1. Recherche dans Supabase (full-text)
  2. Récupère top N signaux pertinents
  3. Envoie à GPT avec contexte
  4. Retourne réponse

### GET /funds
- Liste des funds suivis

### GET /funds/{id}/signals
- Signaux 13F pour un fund

### GET /signals/ticker/{ticker}
- Tous les signaux pour un ticker (13F + autres sources)

## Variables d'Environnement

### Supabase
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (pour Lambda, pas la clé publique)

### OpenAI
- `OPENAI_API_KEY`

### APIs Externes
- `SCRAPECREATORS_API_KEY`
- `COINGLASS_API_KEY`

## Déploiement

1. Créer projet Supabase
2. Exécuter migrations SQL
3. Déployer Lambda collectors (TypeScript)
4. Déployer Lambda parser-13f (Python)
5. Déployer Lambda API
6. Configurer EventBridge rules

