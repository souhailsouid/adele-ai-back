-- Script pour corriger l'association incorrecte du CIK BlackRock à Scion
-- Problème : CIK 0002012383 (BlackRock) associé à fund_id=1 (Scion) au lieu de fund_id=16 (BlackRock)

BEGIN;

-- 1. Vérifier l'état actuel
SELECT 
  '=== ÉTAT ACTUEL ===' as status,
  f.id as fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  fc.cik as additional_cik,
  fc.entity_name,
  fc.is_primary
FROM funds f
LEFT JOIN fund_ciks fc ON fc.fund_id = f.id
WHERE f.id IN (1, 16) OR (fc.fund_id IN (1, 16) AND fc.cik = '0002012383')
ORDER BY f.id, fc.is_primary DESC;

-- 2. Supprimer l'association incorrecte : CIK BlackRock sur Scion
DELETE FROM fund_ciks 
WHERE fund_id = 1 
  AND cik = '0002012383';

-- 3. Vérifier que BlackRock (fund_id=16) a bien son CIK principal
-- Le CIK 0002012383 est déjà le CIK principal de BlackRock dans funds.cik
-- Donc pas besoin de l'ajouter dans fund_ciks

-- 4. Si BlackRock doit avoir un CIK secondaire (0001364742), l'ajouter
-- Note: Selon init-all-funds.ts, BlackRock devrait avoir 0001364742 comme CIK secondaire
INSERT INTO fund_ciks (fund_id, cik, entity_name, is_primary)
SELECT 16, '0001364742', 'BlackRock Advisors LLC', false
WHERE NOT EXISTS (
  SELECT 1 FROM fund_ciks 
  WHERE fund_id = 16 AND cik = '0001364742'
)
AND EXISTS (
  SELECT 1 FROM funds WHERE id = 16 AND name LIKE '%BlackRock%'
);

-- 5. Vérifier l'état final
SELECT 
  '=== ÉTAT FINAL ===' as status,
  f.id as fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  fc.cik as additional_cik,
  fc.entity_name,
  fc.is_primary
FROM funds f
LEFT JOIN fund_ciks fc ON fc.fund_id = f.id
WHERE f.id IN (1, 16)
ORDER BY f.id, fc.is_primary DESC;

-- ROLLBACK; -- Décommenter pour annuler les changements
COMMIT;
