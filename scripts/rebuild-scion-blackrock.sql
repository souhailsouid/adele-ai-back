-- Script pour nettoyer et recréer Scion et BlackRock avec des IDs propres
-- Problème : fund_id=1 (Scion) a un CIK BlackRock associé incorrectement

BEGIN;

-- ============================================
-- ÉTAPE 1: DIAGNOSTIC
-- ============================================
SELECT 
  '=== DIAGNOSTIC AVANT SUPPRESSION ===' as step,
  f.id as fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  COUNT(DISTINCT ff.id) as filings_count,
  COUNT(DISTINCT fh.id) as holdings_count,
  COUNT(DISTINCT fhd.id) as diffs_count,
  COUNT(DISTINCT fc.cik) as additional_ciks_count
FROM funds f
LEFT JOIN fund_filings ff ON ff.fund_id = f.id
LEFT JOIN fund_holdings fh ON fh.fund_id = f.id
LEFT JOIN fund_holdings_diff fhd ON fhd.fund_id = f.id
LEFT JOIN fund_ciks fc ON fc.fund_id = f.id AND fc.is_primary = false
WHERE f.id IN (1, 16)
GROUP BY f.id, f.name, f.cik
ORDER BY f.id;

-- Afficher les CIK associés
SELECT 
  '=== CIK ASSOCIÉS ===' as step,
  f.id as fund_id,
  f.name as fund_name,
  fc.cik,
  fc.entity_name,
  fc.is_primary
FROM funds f
LEFT JOIN fund_ciks fc ON fc.fund_id = f.id
WHERE f.id IN (1, 16)
ORDER BY f.id, fc.is_primary DESC;

-- ============================================
-- ÉTAPE 2: SAUVEGARDE DES DONNÉES SCION (fund_id=1)
-- ============================================
-- Sauvegarder les informations Scion avant suppression
DO $$
DECLARE
  scion_cik TEXT;
  scion_name TEXT;
  scion_tier INTEGER;
  scion_category TEXT;
BEGIN
  SELECT cik, name, tier_influence, category 
  INTO scion_cik, scion_name, scion_tier, scion_category
  FROM funds 
  WHERE id = 1;
  
  -- Afficher les données sauvegardées
  RAISE NOTICE 'Scion sauvegardé: CIK=%, Name=%, Tier=%, Category=%', 
    scion_cik, scion_name, scion_tier, scion_category;
END $$;

-- ============================================
-- ÉTAPE 3: IDENTIFIER TOUS LES FUNDS SCION (par CIK)
-- ============================================
-- Trouver tous les funds avec le CIK Scion (y compris fund_id=1)
SELECT 
  '=== FUNDS SCION À SUPPRIMER ===' as step,
  id as fund_id,
  name as fund_name,
  cik,
  tier_influence,
  category,
  (SELECT COUNT(*) FROM fund_filings WHERE fund_id = funds.id) as filings_count,
  (SELECT COUNT(*) FROM fund_holdings WHERE fund_id = funds.id) as holdings_count
FROM funds
WHERE cik = '0001649339'
ORDER BY id;

-- ============================================
-- ÉTAPE 4: SUPPRESSION DES DONNÉES LIÉES À TOUS LES FUNDS SCION
-- ============================================
-- Supprimer dans l'ordre des dépendances pour TOUS les funds avec CIK 0001649339

-- 4.1 Notifications
DELETE FROM fund_notifications 
WHERE fund_id IN (SELECT id FROM funds WHERE cik = '0001649339');
DELETE FROM user_fund_notifications 
WHERE fund_id IN (SELECT id FROM funds WHERE cik = '0001649339');

-- 4.2 Diffs
DELETE FROM fund_holdings_diff 
WHERE fund_id IN (SELECT id FROM funds WHERE cik = '0001649339');

-- 4.3 Holdings
DELETE FROM fund_holdings 
WHERE fund_id IN (SELECT id FROM funds WHERE cik = '0001649339');

-- 4.4 Filings
DELETE FROM fund_filings 
WHERE fund_id IN (SELECT id FROM funds WHERE cik = '0001649339');

-- 4.5 CIK associés
DELETE FROM fund_ciks 
WHERE fund_id IN (SELECT id FROM funds WHERE cik = '0001649339');

-- 4.6 Signals
DELETE FROM fund_signals 
WHERE fund_id IN (SELECT id FROM funds WHERE cik = '0001649339');

-- ============================================
-- ÉTAPE 5: SUPPRESSION DE TOUS LES FUNDS SCION
-- ============================================
-- Supprimer TOUS les funds avec le CIK Scion (pas seulement fund_id=1)
DELETE FROM funds WHERE cik = '0001649339';

-- ============================================
-- ÉTAPE 6: NETTOYER BLACKROCK (fund_id=16)
-- ============================================
-- Supprimer tous les CIK associés à BlackRock (on les recréera proprement)
DELETE FROM fund_ciks WHERE fund_id = 16;

-- Vérifier que BlackRock existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM funds WHERE id = 16 AND name LIKE '%BlackRock%') THEN
    RAISE EXCEPTION 'BlackRock (fund_id=16) n''existe pas!';
  END IF;
END $$;

-- ============================================
-- ÉTAPE 7: VÉRIFIER QU'IL N'Y A PLUS DE FUND SCION
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM funds WHERE cik = '0001649339') THEN
    RAISE EXCEPTION 'Erreur: Il existe encore un fund avec le CIK 0001649339 après suppression!';
  END IF;
  RAISE NOTICE '✅ Tous les funds Scion ont été supprimés';
END $$;

-- ============================================
-- ÉTAPE 8: RECRÉER SCION AVEC UN NOUVEL ID
-- ============================================
-- Insérer Scion (obtiendra un nouvel ID auto-increment)
-- Maintenant qu'on a supprimé tous les funds avec ce CIK, on peut le recréer
INSERT INTO funds (name, cik, tier_influence, category)
VALUES ('Scion Asset Management, LLC', '0001649339', 5, 'hedge_fund')
RETURNING id, name, cik;

-- Récupérer et afficher le nouvel ID de Scion
DO $$
DECLARE
  new_scion_id INTEGER;
BEGIN
  SELECT id INTO new_scion_id 
  FROM funds 
  WHERE cik = '0001649339' AND name = 'Scion Asset Management, LLC'
  ORDER BY id DESC LIMIT 1;
  
  IF new_scion_id IS NULL THEN
    RAISE EXCEPTION 'Erreur: Scion n''a pas été créé!';
  END IF;
  
  RAISE NOTICE '✅ Scion recréé avec ID: %', new_scion_id;
END $$;

-- ============================================
-- ÉTAPE 9: CONFIGURER BLACKROCK CORRECTEMENT
-- ============================================
-- BlackRock devrait avoir:
-- - CIK principal: 0002012383 (déjà dans funds.cik)
-- - CIK secondaire: 0001364742 (BlackRock Advisors LLC)

-- Ajouter le CIK secondaire de BlackRock si nécessaire
INSERT INTO fund_ciks (fund_id, cik, entity_name, is_primary)
SELECT 16, '0001364742', 'BlackRock Advisors LLC', false
WHERE NOT EXISTS (
  SELECT 1 FROM fund_ciks 
  WHERE fund_id = 16 AND cik = '0001364742'
);

-- ============================================
-- ÉTAPE 10: VÉRIFICATION FINALE
-- ============================================
SELECT 
  '=== ÉTAT FINAL ===' as step,
  f.id as fund_id,
  f.name as fund_name,
  f.cik as fund_primary_cik,
  fc.cik as additional_cik,
  fc.entity_name, 
  fc.is_primary,
  (SELECT COUNT(*) FROM fund_filings WHERE fund_id = f.id) as filings_count,
  (SELECT COUNT(*) FROM fund_holdings WHERE fund_id = f.id) as holdings_count
FROM funds f
LEFT JOIN fund_ciks fc ON fc.fund_id = f.id
WHERE f.cik IN ('0001649339', '0002012383') 
   OR f.name LIKE '%Scion%' 
   OR f.name LIKE '%BlackRock%'
ORDER BY f.id, fc.is_primary DESC;

-- Afficher tous les funds pour vérifier qu'il n'y a pas de doublons
SELECT 
  '=== TOUS LES FUNDS ===' as step,
  id,
  name,
  cik,
  tier_influence,
  category
FROM funds
WHERE cik IN ('0001649339', '0002012383', '0001364742')
ORDER BY id;

-- ROLLBACK; -- Décommenter pour annuler les changements
COMMIT;
