-- Script de vérification globale pour tous les funds
-- Vérifie les problèmes suivants:
-- 1. Filings avec cik = null
-- 2. Filings avec statut FAILED
-- 3. CIK multiples dans les accession numbers (possible CIK secondaire)
-- 4. Funds sans filings parsés

-- ============================================
-- VÉRIFICATION 1: RÉSUMÉ GLOBAL
-- ============================================
SELECT 
  '=== RÉSUMÉ GLOBAL ===' as check_type,
  COUNT(DISTINCT f.id) as total_funds,
  COUNT(DISTINCT ff.id) as total_filings,
  COUNT(DISTINCT CASE WHEN ff.cik IS NULL THEN ff.id END) as filings_with_null_cik,
  COUNT(DISTINCT CASE WHEN ff.status = 'FAILED' THEN ff.id END) as failed_filings,
  COUNT(DISTINCT CASE WHEN ff.status = 'DISCOVERED' THEN ff.id END) as discovered_filings,
  COUNT(DISTINCT CASE WHEN ff.status = 'PARSED' THEN ff.id END) as parsed_filings,
  COUNT(DISTINCT CASE WHEN fh.id IS NOT NULL THEN fh.id END) as total_holdings
FROM funds f
LEFT JOIN fund_filings ff ON ff.fund_id = f.id
LEFT JOIN fund_holdings fh ON fh.fund_id = f.id;

-- ============================================
-- VÉRIFICATION 2: FUNDS AVEC PROBLÈMES
-- ============================================
SELECT 
  '=== FUNDS AVEC PROBLÈMES ===' as check_type,
  f.id as fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  COUNT(DISTINCT ff.id) as total_filings,
  COUNT(DISTINCT CASE WHEN ff.cik IS NULL THEN ff.id END) as filings_null_cik,
  COUNT(DISTINCT CASE WHEN ff.status = 'FAILED' THEN ff.id END) as failed_filings,
  COUNT(DISTINCT CASE WHEN ff.status = 'PARSED' THEN ff.id END) as parsed_filings,
  COUNT(DISTINCT CASE WHEN fh.id IS NOT NULL THEN fh.id END) as total_holdings,
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN ff.cik IS NULL THEN ff.id END) > 0 THEN '❌ CIK NULL'
    WHEN COUNT(DISTINCT CASE WHEN ff.status = 'FAILED' THEN ff.id END) > 0 THEN '⚠️  FAILED'
    WHEN COUNT(DISTINCT CASE WHEN ff.status = 'PARSED' THEN ff.id END) = 0 THEN '⚠️  AUCUN PARSÉ'
    ELSE '✅ OK'
  END as status
FROM funds f
LEFT JOIN fund_filings ff ON ff.fund_id = f.id
LEFT JOIN fund_holdings fh ON fh.fund_id = f.id
GROUP BY f.id, f.name, f.cik
HAVING 
  COUNT(DISTINCT CASE WHEN ff.cik IS NULL THEN ff.id END) > 0
  OR COUNT(DISTINCT CASE WHEN ff.status = 'FAILED' THEN ff.id END) > 0
  OR COUNT(DISTINCT CASE WHEN ff.status = 'PARSED' THEN ff.id END) = 0
ORDER BY 
  COUNT(DISTINCT CASE WHEN ff.cik IS NULL THEN ff.id END) DESC,
  COUNT(DISTINCT CASE WHEN ff.status = 'FAILED' THEN ff.id END) DESC;

-- ============================================
-- VÉRIFICATION 3: FILINGS AVEC CIK NULL
-- ============================================
SELECT 
  '=== FILINGS AVEC CIK NULL ===' as check_type,
  ff.fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  ff.id as filing_id,
  ff.accession_number,
  SUBSTRING(ff.accession_number, 1, 10) as cik_from_accession,
  ff.form_type,
  ff.filing_date,
  ff.status
FROM fund_filings ff
JOIN funds f ON f.id = ff.fund_id
WHERE ff.cik IS NULL
ORDER BY ff.fund_id, ff.filing_date DESC
LIMIT 50;  -- Limiter pour ne pas surcharger

-- ============================================
-- VÉRIFICATION 4: FILINGS EN STATUT FAILED
-- ============================================
SELECT 
  '=== FILINGS EN STATUT FAILED ===' as check_type,
  ff.fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  COUNT(*) as failed_count,
  MIN(ff.filing_date) as earliest_failed,
  MAX(ff.filing_date) as latest_failed
FROM fund_filings ff
JOIN funds f ON f.id = ff.fund_id
WHERE ff.status = 'FAILED'
GROUP BY ff.fund_id, f.name, f.cik
ORDER BY failed_count DESC;

-- ============================================
-- VÉRIFICATION 5: CIK MULTIPLES DANS ACCESSION NUMBERS
-- ============================================
-- Détecter les funds qui ont des accession numbers avec différents CIK
WITH filing_ciks AS (
  SELECT 
    ff.fund_id,
    SUBSTRING(ff.accession_number, 1, 10) as cik_from_accession,
    COUNT(*) as filings_count,
    MIN(ff.filing_date) as earliest_filing,
    MAX(ff.filing_date) as latest_filing
  FROM fund_filings ff
  WHERE ff.cik IS NOT NULL
  GROUP BY ff.fund_id, SUBSTRING(ff.accession_number, 1, 10)
  HAVING COUNT(*) > 0
)
SELECT 
  '=== FUNDS AVEC CIK MULTIPLES (POSSIBLE CIK SECONDAIRE) ===' as check_type,
  fc.fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  fc.cik_from_accession,
  fc.filings_count,
  fc.earliest_filing,
  fc.latest_filing,
  CASE 
    WHEN fc.cik_from_accession = f.cik THEN '✅ CIK Principal'
    WHEN EXISTS (
      SELECT 1 FROM fund_ciks fc2 
      WHERE fc2.fund_id = fc.fund_id 
      AND fc2.cik = fc.cik_from_accession
    ) THEN '✅ CIK Secondaire (dans fund_ciks)'
    ELSE '⚠️  CIK Non Associé (à vérifier)'
  END as status
FROM filing_ciks fc
JOIN funds f ON f.id = fc.fund_id
ORDER BY fc.fund_id, fc.filings_count DESC;

-- ============================================
-- VÉRIFICATION 6: DÉTAIL DES CIK MULTIPLES
-- ============================================
-- Identifier les funds avec plusieurs CIK distincts dans leurs filings
SELECT 
  '=== DÉTAIL CIK MULTIPLES PAR FUND ===' as check_type,
  ff.fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  COUNT(DISTINCT SUBSTRING(ff.accession_number, 1, 10)) as distinct_ciks_in_filings,
  STRING_AGG(DISTINCT SUBSTRING(ff.accession_number, 1, 10), ', ' ORDER BY SUBSTRING(ff.accession_number, 1, 10)) as all_ciks_in_filings,
  COUNT(DISTINCT fc.cik) as ciks_in_fund_ciks_table,
  CASE 
    WHEN COUNT(DISTINCT SUBSTRING(ff.accession_number, 1, 10)) > 1 THEN 
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM fund_ciks fc2 
          WHERE fc2.fund_id = ff.fund_id 
          AND fc2.cik IN (
            SELECT DISTINCT SUBSTRING(ff2.accession_number, 1, 10)
            FROM fund_filings ff2
            WHERE ff2.fund_id = ff.fund_id
            AND SUBSTRING(ff2.accession_number, 1, 10) != f.cik
          )
        ) THEN '⚠️  CIK multiples détectés, certains dans fund_ciks'
        ELSE '❌ CIK multiples détectés, non associés dans fund_ciks'
      END
    ELSE '✅ Un seul CIK'
  END as status
FROM fund_filings ff
JOIN funds f ON f.id = ff.fund_id
LEFT JOIN fund_ciks fc ON fc.fund_id = ff.fund_id
WHERE ff.cik IS NOT NULL  -- Seulement les filings avec CIK
GROUP BY ff.fund_id, f.name, f.cik
HAVING COUNT(DISTINCT SUBSTRING(ff.accession_number, 1, 10)) > 1
ORDER BY distinct_ciks_in_filings DESC;

-- ============================================
-- VÉRIFICATION 7: FUNDS SANS FILINGS PARSÉS
-- ============================================
SELECT 
  '=== FUNDS SANS FILINGS PARSÉS ===' as check_type,
  f.id as fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  COUNT(DISTINCT ff.id) as total_filings,
  COUNT(DISTINCT CASE WHEN ff.status = 'DISCOVERED' THEN ff.id END) as discovered_count,
  COUNT(DISTINCT CASE WHEN ff.status = 'FAILED' THEN ff.id END) as failed_count,
  COUNT(DISTINCT CASE WHEN ff.status = 'PARSED' THEN ff.id END) as parsed_count,
  MIN(ff.filing_date) as earliest_filing_date,
  MAX(ff.filing_date) as latest_filing_date
FROM funds f
LEFT JOIN fund_filings ff ON ff.fund_id = f.id
GROUP BY f.id, f.name, f.cik
HAVING COUNT(DISTINCT CASE WHEN ff.status = 'PARSED' THEN ff.id END) = 0
   AND COUNT(DISTINCT ff.id) > 0  -- Avoir au moins un filing
ORDER BY total_filings DESC;

-- ============================================
-- VÉRIFICATION 8: STATISTIQUES PAR STATUT
-- ============================================
SELECT 
  '=== STATISTIQUES PAR STATUT ===' as check_type,
  ff.status,
  COUNT(*) as count,
  COUNT(DISTINCT ff.fund_id) as funds_count,
  COUNT(DISTINCT CASE WHEN ff.cik IS NULL THEN ff.id END) as with_null_cik,
  MIN(ff.filing_date) as earliest_filing,
  MAX(ff.filing_date) as latest_filing
FROM fund_filings ff
GROUP BY ff.status
ORDER BY count DESC;

-- ============================================
-- VÉRIFICATION 9: CIK MANQUANTS PAR FUND
-- ============================================
SELECT 
  '=== CIK MANQUANTS PAR FUND ===' as check_type,
  ff.fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  COUNT(*) as filings_with_null_cik,
  STRING_AGG(DISTINCT SUBSTRING(ff.accession_number, 1, 10), ', ' ORDER BY SUBSTRING(ff.accession_number, 1, 10)) as ciks_from_accession
FROM fund_filings ff
JOIN funds f ON f.id = ff.fund_id
WHERE ff.cik IS NULL
GROUP BY ff.fund_id, f.name, f.cik
ORDER BY filings_with_null_cik DESC;
