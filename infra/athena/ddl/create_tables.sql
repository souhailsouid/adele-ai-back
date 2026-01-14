-- ============================================
-- DDL pour créer les tables Athena (Extreme Budget)
-- ============================================
-- 
-- Usage:
--   1. Se connecter à Athena Console
--   2. Sélectionner la database: personamy_prod
--   3. Exécuter ces requêtes une par une
--   4. Après chaque table, exécuter: MSCK REPAIR TABLE {table_name};

-- Database (créée via Terraform)
-- CREATE DATABASE IF NOT EXISTS personamy_prod;

-- ============================================
-- Table: companies
-- ============================================
-- Note: Remplacer 'adel-ai-dev-data-lake' par ton bucket si différent
CREATE EXTERNAL TABLE IF NOT EXISTS companies (
  id BIGINT,
  ticker STRING,
  cik STRING,
  name STRING,
  sector STRING,
  industry STRING,
  market_cap BIGINT,
  headquarters_country STRING,
  headquarters_state STRING,
  sic_code STRING,
  category STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
PARTITIONED BY (year INT, month INT)
STORED AS PARQUET
LOCATION 's3://adel-ai-dev-data-lake/data/companies/'
TBLPROPERTIES (
  'parquet.compress'='SNAPPY',
  'projection.enabled'='true',
  'projection.year.type'='integer',
  'projection.year.range'='2020,2030',
  'projection.month.type'='integer',
  'projection.month.range'='1,12',
  'storage.location.template'='s3://adel-ai-dev-data-lake/data/companies/year=${year}/month=${month}/'
);

-- Repartitionner après création
MSCK REPAIR TABLE companies;

-- ============================================
-- Table: company_filings
-- ============================================
CREATE EXTERNAL TABLE IF NOT EXISTS company_filings (
  id BIGINT,
  company_id BIGINT,
  cik STRING,
  form_type STRING,
  accession_number STRING,
  filing_date DATE,
  period_of_report DATE,
  document_url STRING,
  status STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
PARTITIONED BY (year INT, month INT)
STORED AS PARQUET
LOCATION 's3://personamy-prod-data-lake/data/company_filings/'
TBLPROPERTIES (
  'parquet.compress'='SNAPPY',
  'projection.enabled'='true',
  'projection.year.type'='integer',
  'projection.year.range'='2020,2030',
  'projection.month.type'='integer',
  'projection.month.range'='1,12',
  'storage.location.template'='s3://personamy-prod-data-lake/data/company_filings/year=${year}/month=${month}/'
);

MSCK REPAIR TABLE company_filings;

-- ============================================
-- Table: fund_holdings
-- ============================================
CREATE EXTERNAL TABLE IF NOT EXISTS fund_holdings (
  id BIGINT,
  fund_id BIGINT,
  filing_id BIGINT,
  ticker STRING,
  cusip STRING,
  shares BIGINT,
  market_value BIGINT,
  type STRING,
  created_at TIMESTAMP
)
PARTITIONED BY (year INT, month INT)
STORED AS PARQUET
LOCATION 's3://personamy-prod-data-lake/data/fund_holdings/'
TBLPROPERTIES (
  'parquet.compress'='SNAPPY',
  'projection.enabled'='true',
  'projection.year.type'='integer',
  'projection.year.range'='2020,2030',
  'projection.month.type'='integer',
  'projection.month.range'='1,12',
  'storage.location.template'='s3://personamy-prod-data-lake/data/fund_holdings/year=${year}/month=${month}/'
);

MSCK REPAIR TABLE fund_holdings;

-- ============================================
-- Table: fund_holdings_diff
-- ============================================
CREATE EXTERNAL TABLE IF NOT EXISTS fund_holdings_diff (
  id BIGINT,
  fund_id BIGINT,
  ticker STRING,
  filing_id_new BIGINT,
  filing_id_old BIGINT,
  diff_shares BIGINT,
  diff_value BIGINT,
  diff_pct_shares DOUBLE,
  action STRING,
  created_at TIMESTAMP
)
PARTITIONED BY (year INT, month INT)
STORED AS PARQUET
LOCATION 's3://personamy-prod-data-lake/data/fund_holdings_diff/'
TBLPROPERTIES (
  'parquet.compress'='SNAPPY',
  'projection.enabled'='true',
  'projection.year.type'='integer',
  'projection.year.range'='2020,2030',
  'projection.month.type'='integer',
  'projection.month.range'='1,12',
  'storage.location.template'='s3://personamy-prod-data-lake/data/fund_holdings_diff/year=${year}/month=${month}/'
);

MSCK REPAIR TABLE fund_holdings_diff;

-- ============================================
-- Table: funds (petite table, pas de partitionnement)
-- ============================================
CREATE EXTERNAL TABLE IF NOT EXISTS funds (
  id BIGINT,
  name STRING,
  cik STRING,
  tier_influence INT,
  category STRING,
  created_at TIMESTAMP
)
STORED AS PARQUET
LOCATION 's3://personamy-prod-data-lake/data/funds/'
TBLPROPERTIES (
  'parquet.compress'='SNAPPY'
);

-- ============================================
-- Table: fund_filings
-- ============================================
CREATE EXTERNAL TABLE IF NOT EXISTS fund_filings (
  id BIGINT,
  fund_id BIGINT,
  accession_number STRING,
  form_type STRING,
  filing_date DATE,
  period_of_report DATE,
  raw_storage_path STRING,
  status STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
PARTITIONED BY (year INT, month INT)
STORED AS PARQUET
LOCATION 's3://personamy-prod-data-lake/data/fund_filings/'
TBLPROPERTIES (
  'parquet.compress'='SNAPPY',
  'projection.enabled'='true',
  'projection.year.type'='integer',
  'projection.year.range'='2020,2030',
  'projection.month.type'='integer',
  'projection.month.range'='1,12',
  'storage.location.template'='s3://personamy-prod-data-lake/data/fund_filings/year=${year}/month=${month}/'
);

MSCK REPAIR TABLE fund_filings;

-- ============================================
-- Vérification
-- ============================================
-- Vérifier que les tables sont créées:
SHOW TABLES;

-- Tester une requête simple:
SELECT COUNT(*) FROM companies LIMIT 10;
SELECT COUNT(*) FROM fund_holdings LIMIT 10;
