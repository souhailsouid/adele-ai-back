-- ============================================
-- Tables Athena pour Smart Money SEC Sync
-- ============================================
-- Architecture Extreme Budget: S3 + Athena (pas de Supabase)
--
-- Usage:
--   1. Se connecter à Athena Console
--   2. Sélectionner la database: adel_ai_dev
--   3. Exécuter ces requêtes une par une
--   4. Après chaque table, exécuter: MSCK REPAIR TABLE {table_name};

-- ============================================
-- Table: insider_trades (Form 4 transactions)
-- ============================================
CREATE EXTERNAL TABLE IF NOT EXISTS insider_trades (
  id BIGINT,
  company_id BIGINT,
  filing_id BIGINT,
  insider_name STRING,
  insider_cik STRING,  -- CIK du dirigeant (reporting owner)
  insider_title STRING,
  relation STRING,  -- CEO, CFO, Director, etc.
  transaction_type STRING,  -- buy, sell, option_exercise, grant, etc.
  shares BIGINT,
  price_per_share DOUBLE,
  total_value DOUBLE,
  transaction_date DATE,
  alert_flag BOOLEAN,  -- true si transaction > 1M$
  created_at TIMESTAMP
)
PARTITIONED BY (year INT, month INT)
STORED AS PARQUET
LOCATION 's3://adel-ai-dev-data-lake/data/insider_trades/'
TBLPROPERTIES (
  'parquet.compress'='SNAPPY',
  'projection.enabled'='true',
  'projection.year.type'='integer',
  'projection.year.range'='2020,2030',
  'projection.month.type'='integer',
  'projection.month.range'='1,12',
  'storage.location.template'='s3://adel-ai-dev-data-lake/data/insider_trades/year=${year}/month=${month}/'
);

MSCK REPAIR TABLE insider_trades;

-- ============================================
-- Table: company_financials (XBRL data from 10-Q/10-K)
-- ============================================
CREATE EXTERNAL TABLE IF NOT EXISTS company_financials (
  id BIGINT,
  company_id BIGINT,
  filing_id BIGINT,
  period_end_date DATE,
  form_type STRING,  -- '10-Q' or '10-K'
  net_income BIGINT,  -- Net Income (USD)
  total_revenue BIGINT,  -- Total Revenue (USD)
  cash_and_equivalents BIGINT,  -- Cash & Cash Equivalents (USD)
  xbrl_data STRING,  -- JSON string avec données XBRL brutes
  extraction_method STRING,  -- 'xbrl', 'manual', 'api'
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
PARTITIONED BY (year INT, month INT)
STORED AS PARQUET
LOCATION 's3://adel-ai-dev-data-lake/data/company_financials/'
TBLPROPERTIES (
  'parquet.compress'='SNAPPY',
  'projection.enabled'='true',
  'projection.year.type'='integer',
  'projection.year.range'='2020,2030',
  'projection.month.type'='integer',
  'projection.month.range'='1,12',
  'storage.location.template'='s3://adel-ai-dev-data-lake/data/company_financials/year=${year}/month=${month}/'
);

MSCK REPAIR TABLE company_financials;

-- ============================================
-- Table: cusip_ticker_mapping (cache local)
-- ============================================
-- Petite table, pas de partitionnement nécessaire
CREATE EXTERNAL TABLE IF NOT EXISTS cusip_ticker_mapping (
  id BIGINT,
  cusip STRING,
  ticker STRING,
  company_name STRING,
  isin STRING,
  source STRING,  -- 'openfigi', 'sec', 'manual'
  last_verified_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
STORED AS PARQUET
LOCATION 's3://adel-ai-dev-data-lake/data/cusip_ticker_mapping/'
TBLPROPERTIES (
  'parquet.compress'='SNAPPY'
);

-- ============================================
-- Table: transaction_alerts
-- ============================================
CREATE EXTERNAL TABLE IF NOT EXISTS transaction_alerts (
  id BIGINT,
  alert_type STRING,  -- 'insider_large', 'fund_major_change', 'earnings_surprise'
  company_id BIGINT,
  fund_id BIGINT,
  filing_id BIGINT,
  insider_trade_id BIGINT,
  title STRING,
  description STRING,
  transaction_value DOUBLE,
  threshold_value DOUBLE,  -- Seuil déclencheur (ex: 1000000 pour 1M$)
  severity STRING,  -- 'low', 'medium', 'high', 'critical'
  status STRING,  -- 'new', 'viewed', 'dismissed'
  created_at TIMESTAMP,
  viewed_at TIMESTAMP
)
PARTITIONED BY (year INT, month INT)
STORED AS PARQUET
LOCATION 's3://adel-ai-dev-data-lake/data/transaction_alerts/'
TBLPROPERTIES (
  'parquet.compress'='SNAPPY',
  'projection.enabled'='true',
  'projection.year.type'='integer',
  'projection.year.range'='2020,2030',
  'projection.month.type'='integer',
  'projection.month.range'='1,12',
  'storage.location.template'='s3://adel-ai-dev-data-lake/data/transaction_alerts/year=${year}/month=${month}/'
);

MSCK REPAIR TABLE transaction_alerts;

-- ============================================
-- Améliorer fund_holdings avec change_pct
-- ============================================
-- Note: Si la table existe déjà, il faut la recréer ou utiliser ALTER TABLE
-- Pour l'instant, on suppose que la table sera recréée avec les nouvelles colonnes
-- Si la table existe déjà, exécuter manuellement:
-- ALTER TABLE fund_holdings ADD COLUMN IF NOT EXISTS change_pct DOUBLE;
-- ALTER TABLE fund_holdings ADD COLUMN IF NOT EXISTS previous_holding_id BIGINT;

-- ============================================
-- Vérification
-- ============================================
SHOW TABLES;

-- Tester des requêtes simples:
SELECT COUNT(*) FROM insider_trades LIMIT 10;
SELECT COUNT(*) FROM company_financials LIMIT 10;
SELECT COUNT(*) FROM cusip_ticker_mapping LIMIT 10;
SELECT COUNT(*) FROM transaction_alerts LIMIT 10;
