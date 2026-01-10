-- Script pour corriger les filings de Baupost Group (fund_id=25)
-- Problèmes:
-- 1. Tous les filings ont cik = null
-- 2. Tous les filings sont en statut FAILED
-- 3. Deux CIK différents dans les accession numbers (0001061768 et 0001567619)

BEGIN;

-- ============================================
-- ÉTAPE 1: DIAGNOSTIC
-- ============================================
SELECT 
  '=== DIAGNOSTIC BAUPOST GROUP ===' as step,
  f.id as fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  COUNT(*) as total_filings,
  COUNT(CASE WHEN ff.cik IS NULL THEN 1 END) as filings_with_null_cik,
  COUNT(CASE WHEN ff.status = 'FAILED' THEN 1 END) as failed_filings,
  COUNT(CASE WHEN ff.status = 'PARSED' THEN 1 END) as parsed_filings,
  COUNT(DISTINCT CASE WHEN ff.accession_number LIKE '0001061768%' THEN '0001061768'
                       WHEN ff.accession_number LIKE '0001567619%' THEN '0001567619'
                  END) as distinct_ciks_in_accession
FROM funds f
LEFT JOIN fund_filings ff ON ff.fund_id = f.id
WHERE f.id = 25
GROUP BY f.id, f.name, f.cik;

-- ============================================
-- ÉTAPE 2: IDENTIFIER LES CIK DANS LES ACCESSION NUMBERS
-- ============================================
SELECT 
  '=== CIK DANS ACCESSION NUMBERS ===' as step,
  SUBSTRING(accession_number, 1, 10) as cik_from_accession,
  COUNT(*) as count,
  MIN(filing_date) as earliest_filing,
  MAX(filing_date) as latest_filing
FROM fund_filings
WHERE fund_id = 25
GROUP BY SUBSTRING(accession_number, 1, 10)
ORDER BY SUBSTRING(accession_number, 1, 10);

-- ============================================
-- ÉTAPE 3: CORRIGER LE CIK MANQUANT
-- ============================================
-- Mettre à jour le CIK depuis l'accession number pour les filings avec cik NULL
-- Pour Baupost Group, le CIK principal est 0001061768

-- 3.1 Filings avec accession_number commençant par 0001061768
UPDATE fund_filings
SET cik = '0001061768'
WHERE fund_id = 25
  AND cik IS NULL
  AND accession_number LIKE '0001061768%';

-- 3.2 Filings avec accession_number commençant par 0001567619
-- Si c'est un CIK secondaire de Baupost, il faut vérifier
-- Pour l'instant, on le met aussi comme CIK, mais il faudrait vérifier
UPDATE fund_filings
SET cik = '0001567619'
WHERE fund_id = 25
  AND cik IS NULL
  AND accession_number LIKE '0001567619%';

-- ============================================
-- ÉTAPE 4: VÉRIFIER SI 0001567619 EST UN CIK SECONDAIRE DE BAUPOST
-- ============================================
-- Si 0001567619 est un CIK secondaire, il faut l'ajouter dans fund_ciks
-- Sinon, ces filings devraient peut-être être associés à un autre fund

SELECT 
  '=== VÉRIFICATION CIK 0001567619 ===' as step,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM funds WHERE cik = '0001567619'
    ) THEN '⚠️  CIK 0001567619 existe déjà comme fund principal. Vérifier si c''est un doublon.'
    WHEN EXISTS (
      SELECT 1 FROM fund_ciks WHERE cik = '0001567619' AND fund_id = 25
    ) THEN '✅ CIK 0001567619 est déjà dans fund_ciks pour Baupost'
    ELSE '⚠️  CIK 0001567619 n''est pas associé à Baupost. À vérifier.'
  END as status;

-- Ajouter 0001567619 comme CIK secondaire si nécessaire (si c'est vraiment Baupost)
-- DÉCOMMENTEZ UNIQUEMENT si vous êtes sûr que 0001567619 appartient à Baupost
/*
INSERT INTO fund_ciks (fund_id, cik, entity_name, is_primary)
SELECT 25, '0001567619', 'Baupost Group (secondary CIK)', false
WHERE NOT EXISTS (
  SELECT 1 FROM fund_ciks 
  WHERE fund_id = 25 AND cik = '0001567619'
)
AND NOT EXISTS (
  SELECT 1 FROM funds WHERE cik = '0001567619'
);
*/

-- ============================================
-- ÉTAPE 5: REMETTRE LES FILINGS EN STATUT DISCOVERED POUR RE-PARSING
-- ============================================
-- Remettre les filings FAILED en DISCOVERED pour qu'ils soient re-parsés
UPDATE fund_filings
SET status = 'DISCOVERED',
    updated_at = NOW()
WHERE fund_id = 25
  AND status = 'FAILED'
  AND cik IS NOT NULL;  -- Seulement ceux qui ont maintenant un CIK

-- ============================================
-- ÉTAPE 6: VÉRIFICATION FINALE
-- ============================================
SELECT 
  '=== ÉTAT APRÈS CORRECTION ===' as step,
  f.id as fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  COUNT(*) as total_filings,
  COUNT(CASE WHEN ff.cik IS NULL THEN 1 END) as filings_with_null_cik,
  COUNT(CASE WHEN ff.status = 'FAILED' THEN 1 END) as failed_filings,
  COUNT(CASE WHEN ff.status = 'DISCOVERED' THEN 1 END) as discovered_filings,
  COUNT(CASE WHEN ff.status = 'PARSED' THEN 1 END) as parsed_filings,
  COUNT(DISTINCT ff.cik) as distinct_ciks
FROM funds f
LEFT JOIN fund_filings ff ON ff.fund_id = f.id
WHERE f.id = 25
GROUP BY f.id, f.name, f.cik;

-- Afficher les filings par CIK
SELECT 
  '=== FILINGS PAR CIK ===' as step,
  ff.cik,
  COUNT(*) as filings_count,
  COUNT(CASE WHEN ff.status = 'PARSED' THEN 1 END) as parsed_count,
  COUNT(CASE WHEN ff.status = 'FAILED' THEN 1 END) as failed_count,
  COUNT(CASE WHEN ff.status = 'DISCOVERED' THEN 1 END) as discovered_count
FROM fund_filings ff
WHERE ff.fund_id = 25
GROUP BY ff.cik
ORDER BY ff.cik;

-- ROLLBACK; -- Décommenter pour annuler les changements
COMMIT;
