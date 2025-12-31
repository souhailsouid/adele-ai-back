# 🔍 Requêtes SQL de Diagnostic

## 📊 Vérifications à Effectuer dans Supabase

Copiez-collez ces requêtes dans **Supabase Dashboard → SQL Editor** :

---

### 1. Vue d'Ensemble des Signaux RSS

```sql
-- Statistiques complètes
SELECT 
  source,
  type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE importance_score IS NOT NULL) as with_importance,
  COUNT(*) FILTER (WHERE importance_score >= 7) as importance_7_plus,
  COUNT(*) FILTER (WHERE raw_data->'extracted_data' IS NOT NULL) as with_extracted_data,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM signals
WHERE source = 'rss'
GROUP BY source, type
ORDER BY total DESC;
```

**Résultat attendu** :
- Si `total = 0` → Aucun signal collecté (vérifier le collector-rss)
- Si `type = 'macro'` existe → Financial Juice a collecté
- Si `importance_7_plus = 0` → Aucun signal avec importance >= 7

---

### 2. Derniers Signaux RSS (Détails)

```sql
-- Voir les 10 derniers signaux RSS avec toutes les infos
SELECT 
  id,
  source,
  type,
  raw_data->>'title' as title,
  raw_data->>'feed' as feed,
  importance_score,
  priority,
  raw_data->'extracted_data'->>'actual' as actual,
  raw_data->'extracted_data'->>'forecast' as forecast,
  raw_data->'extracted_data'->>'surprise' as surprise,
  raw_data->'extracted_data'->>'indicator' as indicator,
  created_at
FROM signals
WHERE source = 'rss'
ORDER BY created_at DESC
LIMIT 10;
```

**Ce que ça montre** :
- Les types réels (`type` column)
- Les `importance_score` réels
- Si `extracted_data` existe
- Les feeds qui ont collecté (`feed` column)

---

### 3. Vérifier les Types Disponibles

```sql
-- Types disponibles pour RSS
SELECT 
  type,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE importance_score >= 7) as count_7_plus,
  COUNT(*) FILTER (WHERE raw_data->'extracted_data' IS NOT NULL) as with_extracted_data
FROM signals
WHERE source = 'rss'
GROUP BY type
ORDER BY count DESC;
```

**Résultat** :
- Si `type = 'macro'` n'existe pas → Utiliser `type=news` ou enlever le filtre
- Si `count_7_plus = 0` → Réduire `min_importance` ou l'enlever

---

### 4. Vérifier l'Importance Score

```sql
-- Distribution des importance_score
SELECT 
  CASE 
    WHEN importance_score IS NULL THEN 'NULL'
    WHEN importance_score < 5 THEN '< 5'
    WHEN importance_score < 7 THEN '5-6'
    WHEN importance_score < 9 THEN '7-8'
    ELSE '9-10'
  END as importance_range,
  COUNT(*) as count
FROM signals
WHERE source = 'rss'
GROUP BY importance_range
ORDER BY 
  CASE importance_range
    WHEN 'NULL' THEN 0
    WHEN '< 5' THEN 1
    WHEN '5-6' THEN 2
    WHEN '7-8' THEN 3
    WHEN '9-10' THEN 4
  END;
```

**Ce que ça montre** :
- Combien de signaux ont `importance_score` null
- Combien ont `importance_score >= 7`

---

### 5. Vérifier les Données Extraites

```sql
-- Signaux avec extracted_data
SELECT 
  COUNT(*) as total_with_extracted_data,
  COUNT(DISTINCT raw_data->'extracted_data'->>'indicator') as unique_indicators,
  array_agg(DISTINCT raw_data->'extracted_data'->>'indicator') FILTER (WHERE raw_data->'extracted_data'->>'indicator' IS NOT NULL) as indicators
FROM signals
WHERE source = 'rss'
  AND raw_data->'extracted_data' IS NOT NULL;
```

---

## 🎯 Tests API Recommandés

### Test 1 : Sans Filtres

```bash
curl "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?limit=10" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Si ça retourne des données** → Les filtres sont trop restrictifs.

### Test 2 : Seulement RSS

```bash
curl "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&limit=10" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Si ça retourne des données** → Le problème vient de `type=macro` ou `min_importance=7`.

### Test 3 : RSS + Type Macro (Sans Importance)

```bash
curl "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&type=macro&limit=10" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Si ça retourne des données** → Le problème vient de `min_importance=7`.

---

## 🔧 Solutions selon les Résultats

### Si Aucun Signal RSS (total = 0)

**Problème** : Le collector-rss n'a pas collecté de signaux.

**Solutions** :
1. Vérifier que le collector-rss est déployé
2. Vérifier les logs Lambda : `aws logs tail /aws/lambda/adel-ai-dev-collector-rss --follow`
3. Tester le collector localement : `cd workers/collector-rss && npm run test:local`

### Si Type 'macro' N'Existe Pas

**Problème** : Financial Juice n'a pas encore collecté, ou le type est différent.

**Solutions** :
1. Utiliser `type=news` au lieu de `type=macro`
2. Enlever le filtre `type`
3. Vérifier que Financial Juice est dans `RSS_FEEDS` avec `type: "macro"`

### Si Aucun importance_score >= 7

**Problème** : Les signaux n'ont pas encore été traités par l'IA (processor-ia).

**Solutions** :
1. Enlever `min_importance` de la requête
2. Filtrer côté frontend : `signals.filter(s => (s.importance_score || 0) >= 7)`
3. Vérifier que le processor-ia fonctionne et met à jour `importance_score`

---

## 📝 Checklist de Diagnostic

- [ ] Exécuter la requête "Vue d'Ensemble" → Voir le total de signaux RSS
- [ ] Exécuter "Derniers Signaux" → Voir les types et importance_score réels
- [ ] Exécuter "Types Disponibles" → Vérifier si `macro` existe
- [ ] Exécuter "Distribution Importance" → Voir combien ont importance >= 7
- [ ] Test API sans filtres → Voir si des signaux existent
- [ ] Test API avec `source=rss` seulement → Voir les types disponibles
- [ ] Test API sans `min_importance` → Voir si importance_score est le problème

---

## 💡 Recommandation Frontend

**Récupérer sans filtres restrictifs, puis filtrer côté client** :

```typescript
// Récupérer tous les signaux RSS
const { data: allSignals } = useSignals({ 
  source: 'rss', 
  limit: 100 
  // Pas de type ni min_importance
});

// Filtrer côté frontend
const filtered = useMemo(() => {
  if (!allSignals) return [];
  
  return allSignals.filter(signal => {
    // Filtrer par type si nécessaire
    if (typeFilter && signal.type !== typeFilter) return false;
    
    // Filtrer par importance (gérer null)
    if (minImportance && (signal.importance_score || 0) < minImportance) return false;
    
    // Filtrer par extracted_data si nécessaire
    if (onlyWithData && !signal.raw_data?.extracted_data) return false;
    
    return true;
  });
}, [allSignals, typeFilter, minImportance, onlyWithData]);
```

Cela vous donnera plus de flexibilité et vous verrez exactement ce qui existe dans la base.


