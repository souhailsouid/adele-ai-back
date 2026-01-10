-- Diagnostic du filing 0000905148-24-003106 de Scion

-- ============================================
-- VÉRIFICATION 1: Le filing existe-t-il ?
-- ============================================
SELECT 
  '=== FILING ===' as check_type,
  ff.id as filing_id,
  ff.fund_id,
  f.name as fund_name,
  ff.accession_number,
  ff.form_type,
  ff.filing_date,
  ff.period_of_report,
  ff.raw_storage_path,
  ff.status,
  ff.cik,
  ff.created_at,
  ff.updated_at
FROM fund_filings ff
JOIN funds f ON f.id = ff.fund_id
WHERE ff.accession_number = '0000905148-24-003106';

-- ============================================
-- VÉRIFICATION 2: Holdings associés
-- ============================================
SELECT 
  '=== HOLDINGS ===' as check_type,
  COUNT(*) as total_holdings,
  COUNT(CASE WHEN fh.type = 'stock' THEN 1 END) as stock_holdings,
  COUNT(CASE WHEN fh.type = 'call' THEN 1 END) as call_holdings,
  COUNT(CASE WHEN fh.type = 'put' THEN 1 END) as put_holdings,
  SUM(fh.market_value) as total_market_value,
  MIN(fh.created_at) as first_holding_created,
  MAX(fh.created_at) as last_holding_created
FROM fund_holdings fh
WHERE fh.filing_id = (
  SELECT id FROM fund_filings WHERE accession_number = '0000905148-24-003106'
);

-- ============================================
-- VÉRIFICATION 3: Détail des holdings (si existants)
-- ============================================
SELECT 
  '=== DÉTAIL HOLDINGS ===' as check_type,
  fh.id,
  fh.ticker,
  fh.cusip,
  fh.shares,
  fh.market_value,
  fh.type,
  fh.created_at
FROM fund_holdings fh
WHERE fh.filing_id = (
  SELECT id FROM fund_filings WHERE accession_number = '0000905148-24-003106'
)
ORDER BY fh.market_value DESC
LIMIT 20;

-- ============================================
-- VÉRIFICATION 4: CIK du filing
-- ============================================
SELECT 
  '=== CIK ===' as check_type,
  ff.cik as filing_cik,
  f.cik as fund_primary_cik,
  SUBSTRING(ff.accession_number, 1, 10) as cik_from_accession,
  CASE 
    WHEN ff.cik IS NULL THEN '❌ CIK NULL'
    WHEN ff.cik != SUBSTRING(ff.accession_number, 1, 10) THEN '⚠️  CIK différent de l''accession number'
    WHEN ff.cik != f.cik THEN '⚠️  CIK différent du CIK principal du fund (peut être CIK secondaire)'
    ELSE '✅ CIK OK'
  END as cik_status
FROM fund_filings ff
JOIN funds f ON f.id = ff.fund_id
WHERE ff.accession_number = '0000905148-24-003106';

-- ============================================
-- VÉRIFICATION 5: URL du fichier XML
-- ============================================
SELECT 
  '=== URL XML ===' as check_type,
  ff.raw_storage_path,
  CASE 
    WHEN ff.raw_storage_path IS NULL THEN '❌ Pas d''URL stockée'
    WHEN ff.raw_storage_path LIKE '%0000905148%' THEN '✅ URL semble correcte'
    ELSE '⚠️  URL présente mais format suspect'
  END as url_status
FROM fund_filings ff
WHERE ff.accession_number = '0000905148-24-003106';

-- ============================================
-- VÉRIFICATION 6: Statut du parsing
-- ============================================
SELECT 
  '=== STATUT PARSING ===' as check_type,
  ff.status,
  CASE 
    WHEN ff.status = 'PARSED' THEN '✅ Parsé'
    WHEN ff.status = 'FAILED' THEN '❌ Échec du parsing'
    WHEN ff.status = 'DISCOVERED' THEN '⚠️  Découvert mais pas encore parsé'
    WHEN ff.status = 'DOWNLOADED' THEN '⚠️  Téléchargé mais pas encore parsé'
    ELSE '⚠️  Statut inconnu'
  END as status_description,
  ff.updated_at as last_update
FROM fund_filings ff
WHERE ff.accession_number = '0000905148-24-003106';

-- ============================================
-- VÉRIFICATION 7: Recommandation
-- ============================================
SELECT 
  '=== RECOMMANDATION ===' as check_type,
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM fund_filings WHERE accession_number = '0000905148-24-003106'
    ) THEN '❌ Le filing n''existe pas dans la base de données'
    WHEN EXISTS (
      SELECT 1 FROM fund_filings 
      WHERE accession_number = '0000905148-24-003106' 
      AND status = 'FAILED'
    ) THEN '❌ Le parsing a échoué. Vérifier les logs CloudWatch du parser-13f'
    WHEN EXISTS (
      SELECT 1 FROM fund_filings 
      WHERE accession_number = '0000905148-24-003106' 
      AND status = 'DISCOVERED'
    ) THEN '⚠️  Le filing est en DISCOVERED. Le parsing devrait se déclencher automatiquement. Vérifier les logs EventBridge.'
    WHEN EXISTS (
      SELECT 1 FROM fund_filings ff
      WHERE ff.accession_number = '0000905148-24-003106' 
      AND ff.status = 'PARSED'
      AND NOT EXISTS (
        SELECT 1 FROM fund_holdings fh WHERE fh.filing_id = ff.id
      )
    ) THEN '❌ Le filing est marqué PARSED mais n''a pas de holdings. Le parser a peut-être échoué silencieusement ou le fichier XML est vide.'
    WHEN EXISTS (
      SELECT 1 FROM fund_holdings fh
      JOIN fund_filings ff ON ff.id = fh.filing_id
      WHERE ff.accession_number = '0000905148-24-003106'
    ) THEN '✅ Le filing a des holdings. Vérifier la route API ou le fund_id.'
    ELSE '⚠️  Situation inconnue'
  END as recommendation;
