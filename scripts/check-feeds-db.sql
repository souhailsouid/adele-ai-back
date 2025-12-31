-- ============================================
-- Script SQL pour vérifier les feeds Investing et Barchart
-- À exécuter dans Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Vérifier les feeds Investing
SELECT 
  COUNT(*) as total_investing,
  MAX(created_at) as dernier_investing,
  MIN(created_at) as premier_investing
FROM signals
WHERE source = 'rss' 
AND raw_data->>'feed' = 'investing';

-- 2. Vérifier les feeds Barchart
SELECT 
  COUNT(*) as total_barchart,
  MAX(created_at) as dernier_barchart,
  MIN(created_at) as premier_barchart
FROM signals
WHERE source = 'rss' 
AND raw_data->>'feed' = 'barchart';

-- 3. Voir tous les feeds RSS collectés (résumé)
SELECT 
  raw_data->>'feed' as feed,
  COUNT(*) as count,
  MAX(created_at) as dernier,
  MIN(created_at) as premier
FROM signals
WHERE source = 'rss'
GROUP BY raw_data->>'feed'
ORDER BY count DESC;

-- 4. Voir les types de feeds Investing (détail)
SELECT 
  raw_data->>'feed' as feed,
  type,
  COUNT(*) as count,
  MAX(created_at) as dernier
FROM signals
WHERE source = 'rss' 
AND raw_data->>'feed' = 'investing'
GROUP BY raw_data->>'feed', type
ORDER BY count DESC;

-- 5. Voir les types de feeds Barchart (détail)
SELECT 
  raw_data->>'feed' as feed,
  type,
  COUNT(*) as count,
  MAX(created_at) as dernier
FROM signals
WHERE source = 'rss' 
AND raw_data->>'feed' = 'barchart'
GROUP BY raw_data->>'feed', type
ORDER BY count DESC;

-- 6. Exemples de signaux Investing récents
SELECT 
  id,
  raw_data->>'title' as title,
  type,
  created_at
FROM signals
WHERE source = 'rss' 
AND raw_data->>'feed' = 'investing'
ORDER BY created_at DESC
LIMIT 5;

-- 7. Exemples de signaux Barchart récents
SELECT 
  id,
  raw_data->>'title' as title,
  type,
  created_at
FROM signals
WHERE source = 'rss' 
AND raw_data->>'feed' = 'barchart'
ORDER BY created_at DESC
LIMIT 5;


