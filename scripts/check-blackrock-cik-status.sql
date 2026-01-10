-- Vérifier l'état actuel des CIK de BlackRock (fund_id=16)

-- ============================================
-- VÉRIFICATION 1: Fund BlackRock
-- ============================================
SELECT 
  '=== FUND BLACKROCK ===' as check_type,
  id as fund_id,
  name as fund_name,
  cik as fund_primary_cik,
  tier_influence,
  category,
  created_at
FROM funds
WHERE id = 16 OR name LIKE '%BlackRock%'
ORDER BY id;

-- ============================================
-- VÉRIFICATION 2: CIK associés à BlackRock
-- ============================================
SELECT 
  '=== CIK ASSOCIÉS À BLACKROCK ===' as check_type,
  f.id as fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  fc.cik as additional_cik,
  fc.entity_name,
  fc.is_primary,
  fc.created_at
FROM funds f
LEFT JOIN fund_ciks fc ON fc.fund_id = f.id
WHERE f.id = 16 OR f.name LIKE '%BlackRock%'
ORDER BY f.id, fc.is_primary DESC NULLS LAST;

-- ============================================
-- VÉRIFICATION 3: CIK Principal attendu vs actuel
-- ============================================
SELECT 
  '=== CIK PRINCIPAL BLACKROCK ===' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM funds 
      WHERE id = 16 AND cik = '0002012383'
    ) THEN '✅ CIK principal correct: 0002012383'
    ELSE '❌ ERREUR: CIK principal incorrect ou manquant!'
  END as status;

-- ============================================
-- VÉRIFICATION 4: CIK Secondaire attendu vs actuel
-- ============================================
SELECT 
  '=== CIK SECONDARY BLACKROCK ===' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM fund_ciks 
      WHERE fund_id = 16 AND cik = '0001364742' AND is_primary = false
    ) THEN '✅ CIK secondaire présent: 0001364742 (BlackRock Advisors LLC)'
    ELSE '⚠️  CIK secondaire manquant: 0001364742 (BlackRock Advisors LLC) - devrait être ajouté'
  END as status;

-- ============================================
-- VÉRIFICATION 5: CIK incorrectement associés
-- ============================================
SELECT 
  '=== CIK INCORRECTEMENT ASSOCIÉS ===' as check_type,
  f.id as fund_id,
  f.name as fund_name,
  fc.cik as incorrect_cik,
  fc.entity_name,
  CASE 
    WHEN fc.cik = '0001649339' THEN '❌ ERREUR: CIK Scion sur BlackRock!'
    WHEN fc.cik = '0002012383' AND fc.is_primary = true THEN '⚠️  CIK principal dans fund_ciks (redondant, normalement)'
    ELSE '⚠️  CIK suspect'
  END as status
FROM funds f
JOIN fund_ciks fc ON fc.fund_id = f.id
WHERE (f.id = 16 OR f.name LIKE '%BlackRock%')
  AND (
    fc.cik = '0001649339' -- CIK Scion
    OR (fc.cik = '0002012383' AND fc.is_primary = true) -- CIK principal redondant
  );

-- ============================================
-- VÉRIFICATION 6: Recommandation
-- ============================================
SELECT 
  '=== RECOMMANDATION ===' as check_type,
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM funds 
      WHERE id = 16 AND cik = '0002012383'
    ) THEN '❌ CRITIQUE: CIK principal incorrect. Doit être 0002012383'
    WHEN NOT EXISTS (
      SELECT 1 FROM fund_ciks 
      WHERE fund_id = 16 AND cik = '0001364742'
    ) THEN '⚠️  Ajouter le CIK secondaire: INSERT INTO fund_ciks (fund_id, cik, entity_name, is_primary) VALUES (16, ''0001364742'', ''BlackRock Advisors LLC'', false);'
    WHEN EXISTS (
      SELECT 1 FROM fund_ciks 
      WHERE fund_id = 16 AND cik = '0001649339'
    ) THEN '❌ ERREUR: CIK Scion présent sur BlackRock. Supprimer!'
    ELSE '✅ Configuration correcte: CIK principal (0002012383) et secondaire (0001364742) OK'
  END as recommendation;
