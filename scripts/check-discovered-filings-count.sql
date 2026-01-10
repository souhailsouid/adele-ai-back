-- Vérifier le nombre de filings DISCOVERED et FAILED

SELECT 
  '=== STATISTIQUES ===' as check_type,
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN cik IS NULL THEN 1 END) as without_cik,
  COUNT(CASE WHEN raw_storage_path IS NULL THEN 1 END) as without_url,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM fund_filings
WHERE status IN ('DISCOVERED', 'FAILED')
GROUP BY status
ORDER BY status;

-- Détails par fund
SELECT 
  '=== PAR FUND ===' as check_type,
  f.name as fund_name,
  ff.status,
  COUNT(*) as count
FROM fund_filings ff
JOIN funds f ON f.id = ff.fund_id
WHERE ff.status IN ('DISCOVERED', 'FAILED')
GROUP BY f.name, ff.status
ORDER BY f.name, ff.status;

-- Filings sans CIK
SELECT 
  '=== SANS CIK ===' as check_type,
  ff.id,
  ff.accession_number,
  f.name as fund_name,
  f.cik as fund_cik,
  ff.status,
  ff.created_at
FROM fund_filings ff
JOIN funds f ON f.id = ff.fund_id
WHERE ff.status IN ('DISCOVERED', 'FAILED')
  AND ff.cik IS NULL
ORDER BY ff.created_at DESC
LIMIT 20;
