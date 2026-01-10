-- Script de correction globale pour tous les funds
-- Corrige les problèmes suivants:
-- 1. Filings avec cik = null (extrait depuis accession_number)
-- 2. Filings en statut FAILED remis en DISCOVERED pour re-parsing
-- 3. CIK multiples détectés et ajoutés dans fund_ciks si nécessaire

BEGIN;

-- ============================================
-- ÉTAPE 1: CORRIGER LES CIK NULL
-- ============================================
-- Mettre à jour les filings avec cik NULL en extrayant le CIK depuis l'accession_number
-- Le CIK est dans les 10 premiers caractères de l'accession_number
UPDATE fund_filings ff
SET cik = SUBSTRING(ff.accession_number, 1, 10)
WHERE ff.cik IS NULL
  AND LENGTH(ff.accession_number) >= 10
  AND SUBSTRING(ff.accession_number, 1, 10) ~ '^[0-9]+$';  -- Vérifier que c'est un nombre

-- Afficher le résultat
SELECT 
  '=== CIK CORRIGÉS ===' as step,
  COUNT(*) as filings_corriges
FROM fund_filings
WHERE cik IS NOT NULL
  AND updated_at >= NOW() - INTERVAL '1 minute';

-- ============================================
-- ÉTAPE 2: IDENTIFIER LES CIK SECONDAIRES
-- ============================================
-- Trouver les funds avec des CIK différents dans leurs accession numbers
-- et vérifier s'ils sont déjà dans fund_ciks
-- IMPORTANT: Utiliser les accession numbers directement (pas le champ cik qui peut être NULL)
CREATE TEMP TABLE IF NOT EXISTS temp_fund_secondary_ciks AS
SELECT DISTINCT
  ff.fund_id,
  f.cik as fund_primary_cik,
  SUBSTRING(ff.accession_number, 1, 10) as secondary_cik,
  COUNT(*) as filings_count,
  MIN(ff.filing_date) as earliest_filing,
  MAX(ff.filing_date) as latest_filing
FROM fund_filings ff
JOIN funds f ON f.id = ff.fund_id
WHERE LENGTH(ff.accession_number) >= 10
  AND SUBSTRING(ff.accession_number, 1, 10) ~ '^[0-9]+$'  -- CIK valide dans l'accession number
  AND SUBSTRING(ff.accession_number, 1, 10) != f.cik  -- Différent du CIK principal
GROUP BY ff.fund_id, f.cik, SUBSTRING(ff.accession_number, 1, 10)
HAVING COUNT(*) >= 2;  -- Au moins 2 filings avec ce CIK

-- Afficher les CIK secondaires détectés
SELECT 
  '=== CIK SECONDAIRES DÉTECTÉS ===' as step,
  f.id as fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  t.secondary_cik,
  t.filings_count,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM fund_ciks fc 
      WHERE fc.fund_id = t.fund_id 
      AND fc.cik = t.secondary_cik
    ) THEN '✅ Déjà dans fund_ciks'
    WHEN EXISTS (
      SELECT 1 FROM funds f2 
      WHERE f2.cik = t.secondary_cik
    ) THEN '⚠️  Existe déjà comme fund principal (à vérifier)'
    ELSE '⚠️  Non associé (peut être ajouté)'
  END as status
FROM temp_fund_secondary_ciks t
JOIN funds f ON f.id = t.fund_id
ORDER BY t.fund_id, t.filings_count DESC;

-- ============================================
-- ÉTAPE 3: VÉRIFIER LES CONFLITS AVANT D'AJOUTER
-- ============================================
-- Vérifier si des CIK secondaires sont partagés entre plusieurs funds (suspect)
SELECT 
  '=== CONFLITS POTENTIELS ===' as step,
  t.secondary_cik,
  COUNT(DISTINCT t.fund_id) as funds_count,
  STRING_AGG(DISTINCT f.name, ', ' ORDER BY f.name) as fund_names,
  CASE 
    WHEN COUNT(DISTINCT t.fund_id) > 1 THEN '⚠️  CIK partagé entre plusieurs funds (suspect)'
    ELSE '✅ OK'
  END as status
FROM temp_fund_secondary_ciks t
JOIN funds f ON f.id = t.fund_id
GROUP BY t.secondary_cik
HAVING COUNT(DISTINCT t.fund_id) > 1
ORDER BY funds_count DESC;

-- ============================================
-- ÉTAPE 4: AJOUTER LES CIK SECONDAIRES DANS fund_ciks
-- ============================================
-- Ajouter les CIK secondaires détectés dans fund_ciks
-- SEULEMENT s'ils ne sont pas déjà un fund principal, s'ils ont au moins 3 filings
-- ET s'ils ne sont pas partagés entre plusieurs funds (pour éviter les erreurs)
INSERT INTO fund_ciks (fund_id, cik, entity_name, is_primary)
SELECT 
  t.fund_id,
  t.secondary_cik,
  f.name || ' (Secondary CIK)' as entity_name,
  false as is_primary
FROM temp_fund_secondary_ciks t
JOIN funds f ON f.id = t.fund_id
WHERE NOT EXISTS (
  -- Ne pas ajouter si c'est déjà dans fund_ciks
  SELECT 1 FROM fund_ciks fc 
  WHERE fc.fund_id = t.fund_id 
  AND fc.cik = t.secondary_cik
)
AND NOT EXISTS (
  -- Ne pas ajouter si c'est déjà un fund principal
  SELECT 1 FROM funds f2 
  WHERE f2.cik = t.secondary_cik
)
AND t.filings_count >= 3  -- Seulement si au moins 3 filings (pour éviter les erreurs)
AND NOT EXISTS (
  -- Ne pas ajouter si ce CIK est partagé entre plusieurs funds (suspect)
  SELECT 1 FROM temp_fund_secondary_ciks t2
  WHERE t2.secondary_cik = t.secondary_cik
  AND t2.fund_id != t.fund_id
)
ON CONFLICT (fund_id, cik) DO NOTHING;

-- Afficher les CIK ajoutés
SELECT 
  '=== CIK SECONDAIRES AJOUTÉS ===' as step,
  fc.fund_id,
  f.name as fund_name,
  fc.cik as secondary_cik,
  fc.entity_name
FROM fund_ciks fc
JOIN funds f ON f.id = fc.fund_id
WHERE fc.is_primary = false
  AND fc.created_at >= NOW() - INTERVAL '1 minute'
ORDER BY fc.fund_id, fc.cik;

-- ============================================
-- ÉTAPE 5: REMETTRE LES FILINGS FAILED EN DISCOVERED
-- ============================================
-- Remettre les filings FAILED en DISCOVERED pour re-parsing
-- SEULEMENT si ils ont maintenant un CIK valide
UPDATE fund_filings
SET status = 'DISCOVERED',
    updated_at = NOW()
WHERE status = 'FAILED'
  AND cik IS NOT NULL
  AND LENGTH(cik) = 10;

-- Afficher le résultat
SELECT 
  '=== FILINGS REMIS EN DISCOVERED ===' as step,
  COUNT(*) as filings_rediscovered
FROM fund_filings
WHERE status = 'DISCOVERED'
  AND updated_at >= NOW() - INTERVAL '1 minute';

-- ============================================
-- ÉTAPE 6: VÉRIFICATION FINALE
-- ============================================
-- Afficher un résumé des corrections
SELECT 
  '=== RÉSUMÉ DES CORRECTIONS ===' as step,
  (SELECT COUNT(*) FROM fund_filings WHERE cik IS NULL) as filings_restants_null_cik,
  (SELECT COUNT(*) FROM fund_filings WHERE status = 'FAILED') as filings_restants_failed,
  (SELECT COUNT(*) FROM fund_filings WHERE status = 'DISCOVERED') as filings_en_discovered,
  (SELECT COUNT(*) FROM fund_ciks WHERE is_primary = false) as total_ciks_secondaires;

-- Afficher les funds avec problèmes restants
SELECT 
  '=== FUNDS AVEC PROBLÈMES RESTANTS ===' as step,
  f.id as fund_id,
  f.name as fund_name,
  COUNT(DISTINCT CASE WHEN ff.cik IS NULL THEN ff.id END) as filings_null_cik,
  COUNT(DISTINCT CASE WHEN ff.status = 'FAILED' THEN ff.id END) as filings_failed,
  COUNT(DISTINCT CASE WHEN ff.status = 'PARSED' THEN ff.id END) as filings_parsed
FROM funds f
LEFT JOIN fund_filings ff ON ff.fund_id = f.id
GROUP BY f.id, f.name
HAVING 
  COUNT(DISTINCT CASE WHEN ff.cik IS NULL THEN ff.id END) > 0
  OR COUNT(DISTINCT CASE WHEN ff.status = 'FAILED' THEN ff.id END) > 0
ORDER BY 
  COUNT(DISTINCT CASE WHEN ff.cik IS NULL THEN ff.id END) DESC,
  COUNT(DISTINCT CASE WHEN ff.status = 'FAILED' THEN ff.id END) DESC;

-- Nettoyer la table temporaire
DROP TABLE IF EXISTS temp_fund_secondary_ciks;

-- ROLLBACK; -- Décommenter pour annuler les changements
COMMIT;
