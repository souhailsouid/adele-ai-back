-- Script de diagnostic pour vérifier les conflits entre Scion et BlackRock
-- À exécuter AVANT rebuild-scion-blackrock.sql

-- ============================================
-- VÉRIFICATION 1: État actuel des funds
-- ============================================
SELECT 
  '=== FUNDS SCION ET BLACKROCK ===' as check_type,
  f.id as fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  f.tier_influence,
  f.category,
  f.created_at
FROM funds f
WHERE f.id IN (1, 16) 
   OR f.cik IN ('0001649339', '0002012383', '0001364742')
   OR f.name LIKE '%Scion%'
   OR f.name LIKE '%BlackRock%'
ORDER BY f.id;

-- ============================================
-- VÉRIFICATION 2: CIK associés
-- ============================================
SELECT 
  '=== CIK ASSOCIÉS ===' as check_type,
  f.id as fund_id,
  f.name as fund_name,
  fc.cik,
  fc.entity_name,
  fc.is_primary,
  fc.created_at
FROM funds f
LEFT JOIN fund_ciks fc ON fc.fund_id = f.id
WHERE f.id IN (1, 16) 
   OR f.cik IN ('0001649339', '0002012383', '0001364742')
ORDER BY f.id, fc.is_primary DESC;

-- ============================================
-- VÉRIFICATION 3: Conflit - CIK BlackRock sur Scion
-- ============================================
SELECT 
  '=== CONFLIT DÉTECTÉ ===' as check_type,
  f.id as fund_id,
  f.name as fund_name,
  fc.cik as conflicting_cik,
  fc.entity_name,
  CASE 
    WHEN fc.cik = '0002012383' AND f.name LIKE '%Scion%' THEN '❌ ERREUR: CIK BlackRock sur Scion!'
    WHEN fc.cik = '0001364742' AND f.name LIKE '%Scion%' THEN '❌ ERREUR: CIK BlackRock secondaire sur Scion!'
    ELSE '✅ OK'
  END as status
FROM funds f
JOIN fund_ciks fc ON fc.fund_id = f.id
WHERE (f.id = 1 AND fc.cik IN ('0002012383', '0001364742'))
   OR (f.name LIKE '%Scion%' AND fc.cik IN ('0002012383', '0001364742'));

-- ============================================
-- VÉRIFICATION 4: Données liées à Scion (fund_id=1)
-- ============================================
SELECT 
  '=== DONNÉES LIÉES À SCION (fund_id=1) ===' as check_type,
  'fund_filings' as table_name,
  COUNT(*) as count
FROM fund_filings
WHERE fund_id = 1

UNION ALL

SELECT 
  '=== DONNÉES LIÉES À SCION (fund_id=1) ===' as check_type,
  'fund_holdings' as table_name,
  COUNT(*) as count
FROM fund_holdings
WHERE fund_id = 1

UNION ALL

SELECT 
  '=== DONNÉES LIÉES À SCION (fund_id=1) ===' as check_type,
  'fund_holdings_diff' as table_name,
  COUNT(*) as count
FROM fund_holdings_diff
WHERE fund_id = 1

UNION ALL

SELECT 
  '=== DONNÉES LIÉES À SCION (fund_id=1) ===' as check_type,
  'fund_ciks' as table_name,
  COUNT(*) as count
FROM fund_ciks
WHERE fund_id = 1

UNION ALL

SELECT 
  '=== DONNÉES LIÉES À SCION (fund_id=1) ===' as check_type,
  'fund_notifications' as table_name,
  COUNT(*) as count
FROM fund_notifications
WHERE fund_id = 1;

-- ============================================
-- VÉRIFICATION 5: Filings par CIK pour Scion
-- ============================================
SELECT 
  '=== FILINGS SCION PAR CIK ===' as check_type,
  ff.cik,
  COUNT(*) as filings_count,
  COUNT(CASE WHEN ff.status = 'PARSED' THEN 1 END) as parsed_count,
  MAX(ff.filing_date) as latest_filing_date
FROM fund_filings ff
WHERE ff.fund_id = 1
GROUP BY ff.cik
ORDER BY ff.cik;

-- ============================================
-- VÉRIFICATION 6: Holdings par CIK pour Scion
-- ============================================
SELECT 
  '=== HOLDINGS SCION PAR CIK ===' as check_type,
  fh.cik,
  COUNT(DISTINCT fh.filing_id) as filings_with_holdings,
  COUNT(*) as total_holdings,
  SUM(fh.market_value) as total_market_value
FROM fund_holdings fh
WHERE fh.fund_id = 1
GROUP BY fh.cik
ORDER BY fh.cik;

-- ============================================
-- VÉRIFICATION 7: BlackRock (fund_id=16) - État actuel
-- ============================================
SELECT 
  '=== BLACKROCK (fund_id=16) ===' as check_type,
  f.id as fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  COUNT(DISTINCT ff.id) as filings_count,
  COUNT(DISTINCT fh.id) as holdings_count,
  COUNT(DISTINCT fc.cik) as additional_ciks_count,
  STRING_AGG(fc.cik || ' (' || fc.entity_name || ')', ', ') as additional_ciks
FROM funds f
LEFT JOIN fund_filings ff ON ff.fund_id = f.id
LEFT JOIN fund_holdings fh ON fh.fund_id = f.id
LEFT JOIN fund_ciks fc ON fc.fund_id = f.id AND fc.is_primary = false
WHERE f.id = 16
GROUP BY f.id, f.name, f.cik;

-- ============================================
-- VÉRIFICATION 8: Recommandation
-- ============================================
SELECT 
  '=== RECOMMANDATION ===' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM fund_ciks 
      WHERE fund_id = 1 AND cik IN ('0002012383', '0001364742')
    ) THEN 
      '❌ CONFLIT DÉTECTÉ: Le fund_id=1 (Scion) a un CIK BlackRock associé. ' ||
      'Recommandation: Exécuter rebuild-scion-blackrock.sql pour nettoyer et recréer.'
    WHEN (SELECT COUNT(*) FROM fund_filings WHERE fund_id = 1) > 0 THEN
      '⚠️ ATTENTION: Scion (fund_id=1) a des filings associés. ' ||
      'La suppression supprimera également ces filings. ' ||
      'Nombre de filings: ' || (SELECT COUNT(*) FROM fund_filings WHERE fund_id = 1)
    ELSE
      '✅ Pas de conflit détecté. Scion peut être supprimé en sécurité.'
  END as recommendation;
