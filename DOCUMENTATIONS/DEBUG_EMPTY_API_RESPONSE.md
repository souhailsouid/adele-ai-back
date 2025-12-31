# 🐛 Debug : API Retourne un Tableau Vide

## 🔍 Problème

L'API retourne `[]` (tableau vide) alors qu'elle fonctionne (200 OK).

**URL testée** :
```
GET /signals?source=rss&type=macro&min_importance=7&limit=50
```

---

## 🔎 Causes Possibles

### 1. Aucun Signal Correspondant aux Critères

Les filtres sont peut-être trop restrictifs :
- `source=rss` ✅
- `type=macro` ⚠️
- `min_importance=7` ⚠️

**Vérification** :

```sql
-- Dans Supabase Dashboard → SQL Editor

-- 1. Vérifier le total de signaux RSS
SELECT COUNT(*) as total_rss
FROM signals
WHERE source = 'rss';
-- Si 0 → Le collector-rss n'a pas encore collecté de signaux

-- 2. Vérifier les types disponibles
SELECT DISTINCT type, COUNT(*) 
FROM signals
WHERE source = 'rss'
GROUP BY type;
-- Vérifier si 'macro' existe ou si c'est 'news' ou autre

-- 3. Vérifier les importance_score
SELECT 
  MIN(importance_score) as min_importance,
  MAX(importance_score) as max_importance,
  AVG(importance_score) as avg_importance,
  COUNT(*) FILTER (WHERE importance_score >= 7) as count_7_plus
FROM signals
WHERE source = 'rss';
-- Si count_7_plus = 0 → Aucun signal avec importance >= 7

-- 4. Voir les derniers signaux RSS
SELECT 
  id,
  source,
  type,
  raw_data->>'title' as title,
  importance_score,
  raw_data->'extracted_data'->>'actual' as actual,
  created_at
FROM signals
WHERE source = 'rss'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔧 Solutions

### Solution 1 : Réduire les Filtres

Tester avec des filtres moins restrictifs :

```bash
# Test 1 : Sans min_importance
curl -X GET "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&limit=10" \
  -H "Authorization: Bearer ${TOKEN}"

# Test 2 : Sans type
curl -X GET "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&limit=10" \
  -H "Authorization: Bearer ${TOKEN}"

# Test 3 : Tous les signaux
curl -X GET "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?limit=10" \
  -H "Authorization: Bearer ${TOKEN}"
```

### Solution 2 : Vérifier le Type

Le type peut être `news` au lieu de `macro` :

```bash
# Tester avec type=news
curl -X GET "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&type=news&limit=10" \
  -H "Authorization: Bearer ${TOKEN}"
```

### Solution 3 : Vérifier l'Importance

Les signaux peuvent avoir `importance_score` null ou < 7 :

```bash
# Tester sans min_importance
curl -X GET "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&type=macro&limit=10" \
  -H "Authorization: Bearer ${TOKEN}"
```

---

## 📊 Requêtes SQL de Diagnostic

### Diagnostic Complet

```sql
-- Vue d'ensemble des signaux RSS
SELECT 
  source,
  type,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE importance_score IS NOT NULL) as with_importance,
  COUNT(*) FILTER (WHERE importance_score >= 7) as importance_7_plus,
  COUNT(*) FILTER (WHERE raw_data->'extracted_data' IS NOT NULL) as with_extracted_data,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM signals
WHERE source = 'rss'
GROUP BY source, type
ORDER BY count DESC;
```

### Voir les Derniers Signaux

```sql
-- Derniers 10 signaux RSS avec leurs métadonnées
SELECT 
  id,
  source,
  type,
  raw_data->>'title' as title,
  raw_data->>'feed' as feed,
  importance_score,
  priority,
  raw_data->'extracted_data'->>'actual' as actual,
  raw_data->'extracted_data'->>'surprise' as surprise,
  created_at
FROM signals
WHERE source = 'rss'
ORDER BY created_at DESC
LIMIT 10;
```

---

## ✅ Checklist de Diagnostic

- [ ] Vérifier le total de signaux RSS : `SELECT COUNT(*) FROM signals WHERE source = 'rss'`
- [ ] Vérifier les types disponibles : `SELECT DISTINCT type FROM signals WHERE source = 'rss'`
- [ ] Vérifier les importance_score : `SELECT MIN(importance_score), MAX(importance_score) FROM signals WHERE source = 'rss'`
- [ ] Tester l'API sans `min_importance`
- [ ] Tester l'API sans `type`
- [ ] Tester l'API avec `type=news` au lieu de `type=macro`

---

## 🎯 Actions Recommandées

### 1. Vérifier dans Supabase

Exécuter les requêtes SQL ci-dessus dans Supabase Dashboard pour voir ce qui existe réellement.

### 2. Tester avec Moins de Filtres

```bash
# Test minimal
curl "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&limit=5" \
  -H "Authorization: Bearer ${TOKEN}"
```

### 3. Vérifier le Collector-RSS

Si aucun signal RSS n'existe :
- Vérifier que le collector-rss a été déployé
- Vérifier les logs Lambda du collector-rss
- Tester le collector localement

---

## 📝 Résumé

**L'API fonctionne correctement**, mais les filtres sont peut-être trop restrictifs.

**Prochaines étapes** :
1. Vérifier dans Supabase ce qui existe réellement
2. Tester avec moins de filtres
3. Ajuster les filtres selon les données disponibles


