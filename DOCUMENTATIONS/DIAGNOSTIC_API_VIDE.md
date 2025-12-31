# 🔍 Diagnostic : API Retourne []

## ✅ Bonne Nouvelle

L'API fonctionne (200 OK), mais retourne un tableau vide. Cela signifie que :
- ✅ L'endpoint existe
- ✅ L'authentification fonctionne
- ⚠️ Aucun signal ne correspond aux critères

---

## 🔎 Causes Possibles

### 1. Filtres Trop Restrictifs

Votre requête :
```
source=rss&type=macro&min_importance=7
```

**Problèmes possibles** :
- `type=macro` : Seul Financial Juice a `type=macro`, les autres sont `type=news`
- `min_importance=7` : Les signaux peuvent avoir `importance_score` null ou < 7

### 2. Aucun Signal Collecté

Le collector-rss n'a peut-être pas encore collecté de signaux.

---

## 🧪 Tests à Effectuer

### Test 1 : Sans Filtres (Voir Tout)

```bash
curl -X GET "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?limit=10" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Si ça retourne des données** → Les filtres sont trop restrictifs.

### Test 2 : Seulement RSS (Sans Type)

```bash
curl -X GET "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&limit=10" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Si ça retourne des données** → Le type `macro` n'existe pas ou est rare.

### Test 3 : Sans min_importance

```bash
curl -X GET "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&type=macro&limit=10" \
  -H "Authorization: Bearer ${TOKEN}"
```

**Si ça retourne des données** → Les signaux n'ont pas `importance_score >= 7`.

---

## 📊 Vérification dans Supabase

Exécutez ces requêtes dans **Supabase Dashboard → SQL Editor** :

### 1. Vue d'Ensemble

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

### 2. Derniers Signaux RSS

```sql
-- Voir les 10 derniers signaux RSS
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

### 3. Vérifier les Types Disponibles

```sql
-- Types disponibles pour RSS
SELECT 
  type,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE importance_score >= 7) as count_7_plus
FROM signals
WHERE source = 'rss'
GROUP BY type
ORDER BY count DESC;
```

---

## 🔧 Solutions

### Solution 1 : Réduire les Filtres

```typescript
// Au lieu de :
const response = await fetch(
  '.../signals?source=rss&type=macro&min_importance=7&limit=50'
);

// Essayer :
const response = await fetch(
  '.../signals?source=rss&limit=50' // Sans type ni min_importance
);

// Puis filtrer côté frontend
const signals = await response.json();
const macroSignals = signals.filter(s => s.type === 'macro');
const importantSignals = signals.filter(s => (s.importance_score || 0) >= 7);
```

### Solution 2 : Vérifier le Type Réel

D'après le code, Financial Juice a `type: "macro"`, mais vérifiez dans Supabase :

```sql
SELECT DISTINCT type FROM signals WHERE source = 'rss';
```

Si c'est `news` au lieu de `macro`, utilisez :
```bash
curl ".../signals?source=rss&type=news&limit=10"
```

### Solution 3 : Filtrer Côté Frontend

```typescript
// Récupérer tous les signaux RSS
const allSignals = await fetchSignals({ source: 'rss', limit: 100 });

// Filtrer côté frontend
const macroSignals = allSignals.filter(s => s.type === 'macro');
const importantSignals = allSignals.filter(s => (s.importance_score || 0) >= 7);
const withExtractedData = allSignals.filter(s => s.raw_data?.extracted_data);
```

---

## 📋 Checklist de Diagnostic

- [ ] Test 1 : Sans filtres → Voir si des signaux existent
- [ ] Test 2 : `source=rss` seulement → Voir les types disponibles
- [ ] Test 3 : Sans `min_importance` → Voir si importance_score existe
- [ ] Requête SQL : Vérifier les statistiques dans Supabase
- [ ] Requête SQL : Voir les derniers signaux RSS
- [ ] Vérifier les logs du collector-rss (Lambda)

---

## 🎯 Actions Immédiates

1. **Tester sans filtres** :
```bash
curl "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?limit=10" \
  -H "Authorization: Bearer ${TOKEN}"
```

2. **Vérifier dans Supabase** :
```sql
SELECT COUNT(*) FROM signals WHERE source = 'rss';
```

3. **Voir les types** :
```sql
SELECT DISTINCT type FROM signals WHERE source = 'rss';
```

---

## 💡 Recommandation

**Pour le frontend**, récupérez d'abord sans filtres, puis filtrez côté client :

```typescript
// Récupérer tous les signaux RSS
const { data: allSignals } = useSignals({ source: 'rss', limit: 100 });

// Filtrer côté frontend
const filtered = useMemo(() => {
  return allSignals?.filter(signal => {
    // Filtrer par type
    if (typeFilter && signal.type !== typeFilter) return false;
    
    // Filtrer par importance
    if (minImportance && (signal.importance_score || 0) < minImportance) return false;
    
    // Filtrer par extracted_data
    if (onlyWithData && !signal.raw_data?.extracted_data) return false;
    
    return true;
  });
}, [allSignals, typeFilter, minImportance, onlyWithData]);
```

Cela vous donnera plus de flexibilité et vous verrez exactement ce qui existe.


