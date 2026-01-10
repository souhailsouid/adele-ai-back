-- Script SQL pour corriger les incohérences dans fund_ciks
-- Problème détecté : CIK de BlackRock (0002012383) associé à Scion (fund_id=1)

-- 1. Vérifier les incohérences
SELECT 
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
-- BlackRock CIK (0002012383) devrait être associé à fund_id=16 (BlackRock Inc.)
-- Pas à fund_id=1 (Scion Asset Management)

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

-- 6. Fusionner les doublons BlackRock (ID 14 → ID 16)
-- Migrer les données de l'ancien fund (ID 14) vers le nouveau (ID 16)
-- Puis supprimer l'ancien fund

-- 6a. Migrer les filings de ID 14 vers ID 16 (si pas déjà existants)
UPDATE fund_filings
SET fund_id = 16
WHERE fund_id = 14
  AND NOT EXISTS (
    SELECT 1 FROM fund_filings ff
    WHERE ff.fund_id = 16
      AND ff.accession_number = fund_filings.accession_number
  );

-- 6b. Migrer les holdings de ID 14 vers ID 16
UPDATE fund_holdings
SET fund_id = 16
WHERE fund_id = 14;

-- 6c. Migrer les différences de ID 14 vers ID 16
UPDATE fund_holdings_diff
SET fund_id = 16
WHERE fund_id = 14;

-- 6d. Migrer les CIK de ID 14 vers ID 16 (si pas déjà existants)
UPDATE fund_ciks
SET fund_id = 16
WHERE fund_id = 14
  AND NOT EXISTS (
    SELECT 1 FROM fund_ciks fc
    WHERE fc.fund_id = 16
      AND fc.cik = fund_ciks.cik
  );

-- 6e. Supprimer l'ancien fund (ID 14) - les foreign keys CASCADE supprimeront les relations
DELETE FROM funds WHERE id = 14;

-- 7. Vérification finale
SELECT 
  f.id,
  f.name,
  f.cik as primary_cik,
  COUNT(fc.id) as additional_ciks_count,
  STRING_AGG(fc.cik, ', ') as additional_ciks
FROM funds f
LEFT JOIN fund_ciks fc ON fc.fund_id = f.id
GROUP BY f.id, f.name, f.cik
ORDER BY f.id;
