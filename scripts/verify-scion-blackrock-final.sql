-- Script de vérification finale après rebuild-scion-blackrock.sql
-- Vérifie que Scion (ID 32) et BlackRock (ID 16) sont correctement configurés

-- ============================================
-- VÉRIFICATION 1: Funds Scion et BlackRock
-- ============================================
SELECT 
  '=== FUNDS FINAUX ===' as check_type,
  f.id as fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  f.tier_influence,
  f.category
FROM funds f
WHERE f.id IN (16, 32) 
   OR f.cik IN ('0001649339', '0002012383', '0001364742')
ORDER BY f.id;

-- ============================================
-- VÉRIFICATION 2: CIK associés à chaque fund
-- ============================================
SELECT 
  '=== CIK ASSOCIÉS ===' as check_type,
  f.id as fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  fc.cik as additional_cik,
  fc.entity_name,
  fc.is_primary,
  CASE 
    WHEN fc.cik IS NULL THEN '✅ Pas de CIK supplémentaires (normal)'
    WHEN fc.cik = '0002012383' AND f.name LIKE '%Scion%' THEN '❌ ERREUR: CIK BlackRock sur Scion!'
    WHEN fc.cik = '0001364742' AND f.name LIKE '%Scion%' THEN '❌ ERREUR: CIK BlackRock secondaire sur Scion!'
    WHEN fc.cik = '0001649339' AND f.name LIKE '%BlackRock%' THEN '❌ ERREUR: CIK Scion sur BlackRock!'
    ELSE '✅ OK'
  END as status
FROM funds f
LEFT JOIN fund_ciks fc ON fc.fund_id = f.id
WHERE f.id IN (16, 32)
ORDER BY f.id, fc.is_primary DESC NULLS LAST;

-- ============================================
-- VÉRIFICATION 3: BlackRock doit avoir son CIK secondaire
-- ============================================
SELECT 
  '=== BLACKROCK CIK SECONDARY ===' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM fund_ciks 
      WHERE fund_id = 16 AND cik = '0001364742' AND is_primary = false
    ) THEN '✅ BlackRock a son CIK secondaire (0001364742)'
    ELSE '⚠️  BlackRock n''a pas son CIK secondaire (0001364742) - devrait être ajouté'
  END as status;

-- ============================================
-- VÉRIFICATION 4: Scion ne doit PAS avoir de CIK BlackRock
-- ============================================
SELECT 
  '=== SCION - PAS DE CIK BLACKROCK ===' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM fund_ciks 
      WHERE fund_id = (SELECT id FROM funds WHERE cik = '0001649339' LIMIT 1)
      AND cik IN ('0002012383', '0001364742')
    ) THEN '❌ ERREUR: Scion a un CIK BlackRock associé!'
    ELSE '✅ Scion n''a pas de CIK BlackRock associé'
  END as status;

-- ============================================
-- VÉRIFICATION 5: Données existantes (filings, holdings)
-- ============================================
SELECT 
  '=== DONNÉES LIÉES ===' as check_type,
  f.id as fund_id,
  f.name as fund_name,
  COUNT(DISTINCT ff.id) as filings_count,
  COUNT(DISTINCT fh.id) as holdings_count,
  COUNT(DISTINCT fhd.id) as diffs_count,
  COUNT(DISTINCT fc.cik) as additional_ciks_count
FROM funds f
LEFT JOIN fund_filings ff ON ff.fund_id = f.id
LEFT JOIN fund_holdings fh ON fh.fund_id = f.id
LEFT JOIN fund_holdings_diff fhd ON fhd.fund_id = f.id
LEFT JOIN fund_ciks fc ON fc.fund_id = f.id AND fc.is_primary = false
WHERE f.id IN (16, 32)
GROUP BY f.id, f.name
ORDER BY f.id;

-- ============================================
-- VÉRIFICATION 6: Recommandation finale
-- ============================================
SELECT 
  '=== RECOMMANDATION FINALE ===' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM fund_ciks 
      WHERE fund_id = (SELECT id FROM funds WHERE cik = '0001649339' LIMIT 1)
      AND cik IN ('0002012383', '0001364742')
    ) THEN '❌ ERREUR: Scion a encore un CIK BlackRock. Exécuter fix-scion-blackrock-cik.sql'
    WHEN NOT EXISTS (
      SELECT 1 FROM fund_ciks 
      WHERE fund_id = 16 AND cik = '0001364742'
    ) THEN '⚠️  BlackRock n''a pas son CIK secondaire. L''ajouter via API ou script.'
    ELSE '✅ Configuration correcte! Scion (ID 32) et BlackRock (ID 16) sont propres.'
  END as recommendation;
