# Corrections : Persistance des Données Ticker

## 🔧 Problèmes identifiés

### 1. Erreurs de cache `unusual_whales_cache`
- **Erreur** : `Could not find the '0' column` ou `Could not find the 'created_at' column`
- **Cause** : Le `CacheService` essayait d'insérer des arrays directement en les spreadant, créant des propriétés numériques (0, 1, 2...)
- **Solution** : Correction du `CacheService.set()` pour détecter les arrays et les stocker dans un champ JSONB `data`

### 2. Tables vides dans Supabase
- **Problème** : Les données n'étaient pas stockées car le service de persistance ne stockait pas les résultats vides
- **Conséquence** : Refetch inutile à chaque requête même si l'API retourne toujours un array vide
- **Solution** : Stockage de "marqueurs vides" avec un TTL plus court (1h) pour éviter les refetch inutiles

## ✅ Corrections apportées

### 1. `CacheService.set()` - Gestion des arrays

**Avant** :
```typescript
const cacheEntry = {
  [keyField]: key.toUpperCase(),
  ...data, // ❌ Si data est un array, crée des propriétés 0, 1, 2...
  expires_at: expiresAt.toISOString(),
  cached_at: new Date().toISOString(),
};
```

**Après** :
```typescript
const isArray = Array.isArray(data);
const cacheEntry = {
  [keyField]: key.toUpperCase(),
  ...(isArray ? {} : data), // ✅ Ne spreader que si ce n'est pas un array
  ...(isArray ? { data: data as any } : {}), // ✅ Stocker l'array dans 'data' si c'est un array
  expires_at: expiresAt.toISOString(),
  cached_at: new Date().toISOString(),
};
```

### 2. `TickerDataPersistenceService` - Stockage des marqueurs vides

**Avant** :
```typescript
if (!freshData || freshData.length === 0) {
  logger.warn('No options_flow data returned from API', { ticker });
  return { data: [], fromCache: false }; // ❌ Ne stocke rien
}
```

**Après** :
```typescript
if (!freshData || freshData.length === 0) {
  logger.warn('No options_flow data returned from API, storing empty marker', { ticker });
  
  // ✅ Stocker un marqueur "vide" avec un TTL plus court (1h au lieu de 24h)
  const emptyMarker = {
    ticker: upperTicker,
    // ... colonnes avec valeurs par défaut
    data: { empty: true, fetched_at: new Date().toISOString() },
    cached_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(), // TTL: 1h
  };
  
  await supabase.from('options_flow').upsert(emptyMarker);
  return { data: [], fromCache: false };
}
```

### 3. Détection des marqueurs vides lors de la lecture

Le service détecte maintenant les marqueurs vides et les retourne sans refetch :

```typescript
const isEmptyMarker = latest.data?.empty === true || 
  (latest.call_volume === 0 && latest.put_volume === 0);

if (isEmptyMarker) {
  logger.info('Using cached empty options_flow marker', { ticker });
  return { data: [], fromCache: true };
}
```

## 📋 Étapes pour appliquer les corrections

### 1. Appliquer la migration SQL

La migration `008_unusual_whales_cache_and_short_interest.sql` doit être appliquée dans Supabase :

```bash
# Via Supabase CLI
supabase db push

# Ou manuellement via le dashboard Supabase
# SQL Editor > New Query > Coller le contenu de la migration
```

### 2. Vérifier les tables créées

```sql
-- Vérifier que les tables existent
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'unusual_whales_cache',
    'short_interest',
    'options_flow',
    'dark_pool_trades'
  );

-- Vérifier la structure de unusual_whales_cache
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'unusual_whales_cache';
```

### 3. Tester avec un ticker

```bash
# Tester la route
POST /ai/ticker-activity-analysis
{
  "ticker": "NVDA"
}
```

### 4. Vérifier les données dans Supabase

```sql
-- Vérifier les options_flow stockées
SELECT ticker, COUNT(*), MIN(cached_at), MAX(cached_at)
FROM options_flow
WHERE ticker = 'NVDA'
GROUP BY ticker;

-- Vérifier les dark_pool_trades stockées
SELECT ticker, COUNT(*), MIN(cached_at), MAX(cached_at)
FROM dark_pool_trades
WHERE ticker = 'NVDA'
GROUP BY ticker;

-- Vérifier les short_interest stockées
SELECT ticker, short_interest, float, data_date, cached_at
FROM short_interest
WHERE ticker = 'NVDA'
ORDER BY cached_at DESC
LIMIT 1;
```

## 🎯 Résultats attendus

1. **Plus d'erreurs de cache** : Le `CacheService` gère correctement les arrays
2. **Données stockées** : Même les résultats vides sont stockés (marqueurs vides)
3. **Moins de refetch** : Les marqueurs vides évitent les appels API inutiles pendant 1h
4. **Tables remplies** : Les tables `options_flow`, `dark_pool_trades`, et `short_interest` contiennent des données

## 📊 Logs à surveiller

### Succès
```
[INFO] Using cached options_flow data { ticker: 'NVDA', count: 50, ageHours: '0.5' }
[INFO] Stored options_flow data { ticker: 'NVDA', count: 50 }
[INFO] Using cached empty options_flow marker { ticker: 'NVDA', ageHours: '0.3' }
```

### Erreurs (ne devraient plus apparaître)
```
[ERROR] Cache set failed for uw_recent_flows_NVDA - Could not find the '0' column ❌
[ERROR] Cache set failed for uw_short_interest_float_NVDA - Could not find the 'created_at' column ❌
```

## 🔍 Dépannage

### Si les tables sont toujours vides

1. **Vérifier que la migration a été appliquée** :
   ```sql
   SELECT EXISTS (
     SELECT 1 FROM information_schema.tables 
     WHERE table_name = 'unusual_whales_cache'
   );
   ```

2. **Vérifier les permissions RLS** :
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'options_flow';
   ```

3. **Vérifier les logs Lambda** pour voir si les insertions échouent silencieusement

4. **Tester manuellement une insertion** :
   ```sql
   INSERT INTO options_flow (ticker, data, cached_at, expires_at)
   VALUES ('TEST', '{"test": true}'::jsonb, NOW(), NOW() + INTERVAL '1 hour');
   ```

### Si les erreurs de cache persistent

1. Vérifier que le code déployé contient les corrections du `CacheService`
2. Vérifier que la table `unusual_whales_cache` a bien les colonnes `cached_at` et `data` (JSONB)





