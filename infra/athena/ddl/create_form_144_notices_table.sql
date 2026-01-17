-- ============================================
-- Table: form_144_notices
-- Description: Notices of Proposed Sale of Securities (Form 144)
-- Signal prédictif: Annonce une intention de vente avant qu'elle ne se produise
-- ============================================

CREATE EXTERNAL TABLE IF NOT EXISTS form_144_notices (
  id BIGINT,
  accession_number STRING,
  cik STRING,
  company_name STRING,
  insider_name STRING,
  insider_cik STRING,
  shares BIGINT,
  price_per_share DOUBLE,
  total_value DOUBLE,
  filing_date DATE,
  proposed_sale_date DATE,
  created_at TIMESTAMP
)
PARTITIONED BY (
  year INT,
  month INT
)
STORED AS PARQUET
LOCATION 's3://adel-ai-dev-data-lake/data/form_144_notices/'
TBLPROPERTIES (
  'projection.enabled' = 'true',
  'projection.year.type' = 'integer',
  'projection.year.range' = '2020,2030',
  'projection.year.interval' = '1',
  'projection.month.type' = 'integer',
  'projection.month.range' = '1,12',
  'projection.month.interval' = '1',
  'storage.location.template' = 's3://adel-ai-dev-data-lake/data/form_144_notices/year=${year}/month=${month}',
  'parquet.compress' = 'SNAPPY'
);
