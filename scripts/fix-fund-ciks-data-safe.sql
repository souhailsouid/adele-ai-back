-- Script SQL SÉCURISÉ pour corriger les incohérences dans fund_ciks
-- Version avec vérifications et transactions pour éviter les pertes de données

BEGIN;

-- 1. Vérifier les incohérences AVANT correction
SELECT 
  '=== ÉTAT AVANT CORRECTION ===' as status,
  f.id as fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  fc.cik as additional_cik,
  fc.entity_name,
  fc.is_primary
FROM funds f
LEFT JOIN fund_ciks fc ON fc.fund_id = f.id
WHERE fc.cik IS NOT NULL
ORDER BY f.id, fc.is_primary DESC;

-- 2. Identifier les CIK mal associés
SELECT 
  '=== CIK MAL ASSOCIÉS ===' as status,
  fc.cik,
  fc.fund_id as current_fund_id,
  f.name as current_fund_name,
  f2.id as correct_fund_id,
  f2.name as correct_fund_name
FROM fund_ciks fc
JOIN funds f ON f.id = fc.fund_id
LEFT JOIN funds f2 ON f2.cik = fc.cik
WHERE fc.cik != f.cik  -- CIK supplémentaire différent du primary
  AND f2.id IS NOT NULL  -- Le CIK correspond à un autre fund
  AND f2.id != fc.fund_id;  -- Pas le même fund

-- 3. Corriger : Supprimer les associations incorrectes
-- CIK 0002012383 (BlackRock Advisors LLC) associé à Scion (fund_id=1) - INCORRECT
DELETE FROM fund_ciks 
WHERE fund_id = 1 
  AND cik = '0002012383';

-- 4. Vérifier que BlackRock (fund_id=16) a bien son CIK secondaire
-- Si le CIK 0001364742 n'est pas déjà associé à BlackRock, l'ajouter
INSERT INTO fund_ciks (fund_id, cik, entity_name, is_primary)
SELECT 16, '0001364742', 'BlackRock Advisors LLC', false
WHERE NOT EXISTS (
  SELECT 1 FROM fund_ciks 
  WHERE fund_id = 16 AND cik = '0001364742'
)
AND EXISTS (
  SELECT 1 FROM funds WHERE id = 16
);

-- 5. Vérifier les doublons de CIK primary dans fund_ciks
-- Un CIK primary ne devrait pas être dans fund_ciks si c'est déjà le CIK du fund
DELETE FROM fund_ciks
WHERE is_primary = true
  AND EXISTS (
    SELECT 1 FROM funds f
    WHERE f.id = fund_ciks.fund_id
      AND f.cik = fund_ciks.cik
  );

-- 6. Fusionner les doublons BlackRock (ID 14 → ID 16) - SÉCURISÉ
-- Vérifier d'abord qu'il n'y a pas de conflits

-- 6a. Vérifier les conflits de filings avant migration
SELECT 
  '=== CONFLITS DE FILINGS (ID 14 → 16) ===' as status,
  COUNT(*) as conflicts_count
FROM fund_filings ff14
JOIN fund_filings ff16 ON ff16.accession_number = ff14.accession_number
WHERE ff14.fund_id = 14
  AND ff16.fund_id = 16;

-- 6b. Migrer les filings de ID 14 vers ID 16 (si pas déjà existants)
UPDATE fund_filings
SET fund_id = 16
WHERE fund_id = 14
  AND NOT EXISTS (
    SELECT 1 FROM fund_filings ff
    WHERE ff.fund_id = 16
      AND ff.accession_number = fund_filings.accession_number
  );

-- 6c. Migrer les holdings de ID 14 vers ID 16
UPDATE fund_holdings
SET fund_id = 16
WHERE fund_id = 14;

-- 6d. Migrer les différences de ID 14 vers ID 16
UPDATE fund_holdings_diff
SET fund_id = 16
WHERE fund_id = 14;

-- 6e. Migrer les CIK de ID 14 vers ID 16 (si pas déjà existants)
UPDATE fund_ciks
SET fund_id = 16
WHERE fund_id = 14
  AND NOT EXISTS (
    SELECT 1 FROM fund_ciks fc
    WHERE fc.fund_id = 16
      AND fc.cik = fund_ciks.cik
  );

-- 6f. Vérifier qu'il ne reste plus de données liées à ID 14
SELECT 
  '=== DONNÉES RESTANTES POUR ID 14 ===' as status,
  (SELECT COUNT(*) FROM fund_filings WHERE fund_id = 14) as filings_count,
  (SELECT COUNT(*) FROM fund_holdings WHERE fund_id = 14) as holdings_count,
  (SELECT COUNT(*) FROM fund_ciks WHERE fund_id = 14) as ciks_count;

-- 6g. Supprimer l'ancien fund (ID 14) seulement si aucune donnée restante
DELETE FROM funds 
WHERE id = 14
  AND NOT EXISTS (SELECT 1 FROM fund_filings WHERE fund_id = 14)
  AND NOT EXISTS (SELECT 1 FROM fund_holdings WHERE fund_id = 14)
  AND NOT EXISTS (SELECT 1 FROM fund_ciks WHERE fund_id = 14);

-- 7. Vérification finale
SELECT 
  '=== ÉTAT APRÈS CORRECTION ===' as status,
  f.id,
  f.name,
  f.cik as primary_cik,
  COUNT(fc.id) as additional_ciks_count,
  STRING_AGG(fc.cik, ', ') as additional_ciks
FROM funds f
LEFT JOIN fund_ciks fc ON fc.fund_id = f.id
GROUP BY f.id, f.name, f.cik
ORDER BY f.id;

-- ROLLBACK; -- Décommenter pour annuler les changements
COMMIT; -- Décommenter pour valider les changements
