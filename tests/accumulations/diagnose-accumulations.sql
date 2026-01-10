-- Diagnostic SQL: Pourquoi aucune accumulation n'est détectée pour Scion Asset Management (fund_id = 32)
-- Ce script analyse les filings parsés et les diffs calculés pour identifier les séquences d'accumulation

-- 1. Vérifier les filings parsés pour le fund 32
SELECT 
  'Filings parsés pour fund 32' as diagnostic_step,
  COUNT(*) as total_filings,
  MIN(filing_date) as oldest_filing,
  MAX(filing_date) as newest_filing,
  MAX(filing_date)::date - MIN(filing_date)::date as days_span
FROM fund_filings
WHERE fund_id = 32
  AND status = 'PARSED'
ORDER BY filing_date DESC;

-- 2. Lister tous les filings parsés avec leurs IDs (pour référence)
SELECT 
  'Liste des filings parsés' as diagnostic_step,
  id as filing_id,
  filing_date,
  form_type,
  status,
  ROW_NUMBER() OVER (ORDER BY filing_date DESC) as filing_rank
FROM fund_filings
WHERE fund_id = 32
  AND status = 'PARSED'
ORDER BY filing_date DESC
LIMIT 10;

-- 3. Vérifier combien de diffs sont calculés pour ces filings
WITH latest_filings AS (
  SELECT id, filing_date
  FROM fund_filings
  WHERE fund_id = 32
    AND status = 'PARSED'
  ORDER BY filing_date DESC
  LIMIT 8
)
SELECT 
  'Diffs calculés pour les 8 derniers filings' as diagnostic_step,
  COUNT(*) as total_diffs,
  COUNT(DISTINCT filing_id_new) as distinct_new_filings,
  COUNT(DISTINCT ticker) as distinct_tickers
FROM fund_holdings_diff
WHERE fund_id = 32
  AND filing_id_new IN (SELECT id FROM latest_filings);

-- 4. Analyser les séquences d'achat pour chaque ticker (détection manuelle)
WITH latest_filings AS (
  SELECT id, filing_date
  FROM fund_filings
  WHERE fund_id = 32
    AND status = 'PARSED'
  ORDER BY filing_date DESC
  LIMIT 8
),
relevant_diffs AS (
  SELECT 
    fhd.*,
    ff_new.filing_date as filing_date_new,
    ff_old.filing_date as filing_date_old
  FROM fund_holdings_diff fhd
  JOIN fund_filings ff_new ON fhd.filing_id_new = ff_new.id
  LEFT JOIN fund_filings ff_old ON fhd.filing_id_old = ff_old.id
  WHERE fhd.fund_id = 32
    AND fhd.filing_id_new IN (SELECT id FROM latest_filings)
),
ticker_diffs AS (
  SELECT 
    UPPER(TRIM(ticker)) as ticker_key,
    filing_date_new,
    filing_date_old,
    action,
    diff_shares,
    diff_value,
    filing_id_new,
    filing_id_old,
    ROW_NUMBER() OVER (PARTITION BY UPPER(TRIM(ticker)) ORDER BY filing_date_new DESC) as seq_num
  FROM relevant_diffs
  WHERE ticker IS NOT NULL
)
SELECT 
  'Séquences d\'achat par ticker (trié par date décroissante)' as diagnostic_step,
  ticker_key,
  filing_date_new,
  filing_date_old,
  action,
  diff_shares,
  diff_value,
  seq_num,
  CASE 
    WHEN action IN ('new', 'increase') AND diff_value > 0 THEN 'ACHAT'
    WHEN action = 'exit' OR (action = 'decrease' AND diff_value < 0) THEN 'VENTE'
    ELSE 'AUTRE'
  END as mouvement_type
FROM ticker_diffs
ORDER BY ticker_key, filing_date_new DESC
LIMIT 50;

-- 5. Détecter les séquences d'accumulation potentielles (analyse manuelle)
WITH latest_filings AS (
  SELECT id, filing_date
  FROM fund_filings
  WHERE fund_id = 32
    AND status = 'PARSED'
  ORDER BY filing_date DESC
  LIMIT 8
),
relevant_diffs AS (
  SELECT 
    fhd.*,
    ff_new.filing_date as filing_date_new,
    ff_old.filing_date as filing_date_old,
    EXTRACT(EPOCH FROM (ff_new.filing_date - LAG(ff_new.filing_date) OVER (
      PARTITION BY UPPER(TRIM(fhd.ticker)) 
      ORDER BY ff_new.filing_date DESC
    ))) / (60 * 60 * 24 * 30) as months_since_previous
  FROM fund_holdings_diff fhd
  JOIN fund_filings ff_new ON fhd.filing_id_new = ff_new.id
  LEFT JOIN fund_filings ff_old ON fhd.filing_id_old = ff_old.id
  WHERE fhd.fund_id = 32
    AND fhd.filing_id_new IN (SELECT id FROM latest_filings)
),
ticker_sequences AS (
  SELECT 
    UPPER(TRIM(ticker)) as ticker_key,
    filing_date_new,
    action,
    diff_value,
    months_since_previous,
    CASE 
      WHEN action IN ('new', 'increase') AND diff_value > 0 THEN 1
      ELSE 0
    END as is_accumulation,
    CASE 
      WHEN action = 'exit' OR (action = 'decrease' AND diff_value < 0) THEN 1
      ELSE 0
    END as is_sale,
    ROW_NUMBER() OVER (PARTITION BY UPPER(TRIM(ticker)) ORDER BY filing_date_new DESC) as seq_num
  FROM relevant_diffs
  WHERE ticker IS NOT NULL
)
SELECT 
  'Séquences d\'accumulation potentielles (3+ trimestres)' as diagnostic_step,
  ticker_key,
  COUNT(*) as total_diffs,
  SUM(is_accumulation) as total_accumulations,
  SUM(is_sale) as total_sales,
  MAX(months_since_previous) as max_gap_months,
  MIN(filing_date_new) as first_filing,
  MAX(filing_date_new) as last_filing,
  STRING_AGG(
    CASE 
      WHEN is_accumulation = 1 THEN CONCAT(action, ' (', filing_date_new::text, ')')
      ELSE NULL
    END, 
    ' -> ' ORDER BY filing_date_new DESC
  ) as accumulation_sequence
FROM ticker_sequences
GROUP BY ticker_key
HAVING SUM(is_accumulation) >= 3
ORDER BY total_accumulations DESC, ticker_key;

-- 6. Identifier les problèmes potentiels (gaps temporels, ventes intermédiaires)
WITH latest_filings AS (
  SELECT id, filing_date
  FROM fund_filings
  WHERE fund_id = 32
    AND status = 'PARSED'
  ORDER BY filing_date DESC
  LIMIT 8
),
relevant_diffs AS (
  SELECT 
    fhd.*,
    ff_new.filing_date as filing_date_new,
    ff_old.filing_date as filing_date_old,
    LAG(ff_new.filing_date) OVER (
      PARTITION BY UPPER(TRIM(fhd.ticker)) 
      ORDER BY ff_new.filing_date DESC
    ) as previous_filing_date,
    EXTRACT(EPOCH FROM (ff_new.filing_date - LAG(ff_new.filing_date) OVER (
      PARTITION BY UPPER(TRIM(fhd.ticker)) 
      ORDER BY ff_new.filing_date DESC
    ))) / (60 * 60 * 24 * 30) as months_since_previous
  FROM fund_holdings_diff fhd
  JOIN fund_filings ff_new ON fhd.filing_id_new = ff_new.id
  LEFT JOIN fund_filings ff_old ON fhd.filing_id_old = ff_old.id
  WHERE fhd.fund_id = 32
    AND fhd.filing_id_new IN (SELECT id FROM latest_filings)
),
ticker_sequences AS (
  SELECT 
    UPPER(TRIM(ticker)) as ticker_key,
    filing_date_new,
    action,
    diff_value,
    months_since_previous,
    CASE 
      WHEN action IN ('new', 'increase') AND diff_value > 0 THEN 1
      ELSE 0
    END as is_accumulation,
    CASE 
      WHEN action = 'exit' OR (action = 'decrease' AND diff_value < 0) THEN 1
      ELSE 0
    END as is_sale
  FROM relevant_diffs
  WHERE ticker IS NOT NULL
)
SELECT 
  'Problèmes détectés dans les séquences' as diagnostic_step,
  ticker_key,
  filing_date_new,
  action,
  months_since_previous,
  CASE 
    WHEN months_since_previous IS NOT NULL AND months_since_previous > 5 THEN 'GAP_TEMPOREL'
    WHEN is_sale = 1 THEN 'VENTE_INTERMEDIAIRE'
    WHEN is_accumulation = 0 AND action != 'exit' AND action != 'decrease' THEN 'ACTION_INCONNUE'
    ELSE 'OK'
  END as probleme,
  CASE 
    WHEN months_since_previous IS NOT NULL AND months_since_previous > 5 
      THEN CONCAT('Gap de ', ROUND(months_since_previous::numeric, 1), ' mois (> 5 mois tolérés)')
    WHEN is_sale = 1 
      THEN 'Vente détectée (séquence brisée)'
    ELSE NULL
  END as details
FROM ticker_sequences
WHERE months_since_previous IS NOT NULL 
  AND (months_since_previous > 5 OR is_sale = 1)
ORDER BY ticker_key, filing_date_new DESC;

-- 7. Vérifier si les diffs sont bien calculés entre filings consécutifs
WITH latest_filings AS (
  SELECT id, filing_date,
    LAG(id) OVER (ORDER BY filing_date DESC) as previous_filing_id,
    LAG(filing_date) OVER (ORDER BY filing_date DESC) as previous_filing_date
  FROM fund_filings
  WHERE fund_id = 32
    AND status = 'PARSED'
  ORDER BY filing_date DESC
  LIMIT 8
)
SELECT 
  'Vérification des diffs entre filings consécutifs' as diagnostic_step,
  ff.id as filing_id_new,
  ff.filing_date as filing_date_new,
  ff.previous_filing_id as expected_filing_id_old,
  ff.previous_filing_date as expected_filing_date_old,
  COUNT(fhd.id) as diffs_found
FROM latest_filings ff
LEFT JOIN fund_holdings_diff fhd 
  ON fhd.filing_id_new = ff.id 
  AND fhd.filing_id_old = ff.previous_filing_id
  AND fhd.fund_id = 32
WHERE ff.previous_filing_id IS NOT NULL
GROUP BY ff.id, ff.filing_date, ff.previous_filing_id, ff.previous_filing_date
ORDER BY ff.filing_date DESC;

-- 8. Exemple détaillé pour un ticker spécifique (ex: LULULEMON qui apparaît dans les données)
SELECT 
  'Exemple détaillé: LULULEMON' as diagnostic_step,
  fhd.ticker,
  ff_new.filing_date as filing_date_new,
  ff_old.filing_date as filing_date_old,
  fhd.action,
  fhd.diff_shares,
  fhd.diff_value,
  fhd.filing_id_new,
  fhd.filing_id_old,
  CASE 
    WHEN fhd.action IN ('new', 'increase') AND fhd.diff_value > 0 THEN '✅ ACHAT'
    WHEN fhd.action = 'exit' OR (fhd.action = 'decrease' AND fhd.diff_value < 0) THEN '❌ VENTE'
    ELSE '⚠️  AUTRE'
  END as mouvement_type
FROM fund_holdings_diff fhd
JOIN fund_filings ff_new ON fhd.filing_id_new = ff_new.id
LEFT JOIN fund_filings ff_old ON fhd.filing_id_old = ff_old.id
WHERE fhd.fund_id = 32
  AND UPPER(TRIM(fhd.ticker)) = 'LULULEMON'
ORDER BY ff_new.filing_date DESC;
