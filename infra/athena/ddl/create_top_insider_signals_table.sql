CREATE EXTERNAL TABLE IF NOT EXISTS top_insider_signals (
  id BIGINT,
  company_id BIGINT,
  filing_id BIGINT,
  accession_number STRING,
  insider_name STRING,
  insider_cik STRING,
  insider_title STRING,
  relation STRING,
  transaction_type STRING,
  shares BIGINT,
  price_per_share DOUBLE,
  total_value DOUBLE,
  transaction_date DATE,
  signal_score INT,
  source_type STRING,
  created_at TIMESTAMP
)
PARTITIONED BY (
  year INT,
  month INT
)
STORED AS PARQUET
LOCATION 's3://adel-ai-dev-data-lake/data/top_insider_signals/'
TBLPROPERTIES (
  'projection.enabled' = 'true',
  'projection.year.type' = 'integer',
  'projection.year.range' = '2020,2030',
  'projection.year.interval' = '1',
  'projection.month.type' = 'integer',
  'projection.month.range' = '1,12',
  'projection.month.interval' = '1',
  'storage.location.template' = 's3://adel-ai-dev-data-lake/data/top_insider_signals/year=${year}/month=${month}',
  'parquet.compress' = 'SNAPPY'
)
