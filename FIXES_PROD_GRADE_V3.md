# Corrections PROD-GRADE V3 - Points Critiques

## ✅ Corrections Appliquées

### 1. Verrou Atomique (Pas de Race Condition)

**Problème** : `acquire_refresh_lock()` faisait SELECT puis UPDATE → race condition possible

**Solution** : UPDATE conditionnel atomique
```sql
-- UPDATE ne réussit QUE si lock absent/expiré (ATOMIQUE)
UPDATE ticker_data_modules
SET refresh_lock_until = v_lock_until, ...
WHERE ticker = p_ticker AND module_id = p_module_id
  AND (refresh_lock_until IS NULL OR refresh_lock_until < NOW());

IF FOUND THEN RETURN TRUE; END IF;

-- Sinon INSERT avec DO NOTHING (évite la course à la création)
INSERT ... ON CONFLICT DO NOTHING;
RETURN FOUND;
```

**Résultat** : Aucun "read then write", opération atomique au niveau SQL

### 2. Skip If Fresh (Évite Refresh Inutile)

**Problème** : Même avec lock, on appelait l'API externe dès qu'on obtenait le lock

**Solution** : Vérification au début de chaque `ingestX()`
```typescript
// 1) SKIP IF FRESH
const currentState = await this.getModuleState(ticker, moduleId);
if (currentState.status === 'ready' && currentState.expires_at) {
  const expiresAt = new Date(currentState.expires_at);
  if (expiresAt > new Date()) {
    logger.info('Data already fresh, skipping ingestion');
    return currentState; // Retourne immédiatement, pas d'appel API
  }
}

// 2) Acquérir le lock seulement si nécessaire
const lockAcquired = await this.acquireRefreshLock(...);
```

**Résultat** : Latence réduite, coût API réduit

### 3. Table Dédiée pour `options_volume`

**Problème** : `options_volume` allait dans `unusual_whales_cache` → incohérence avec le schéma modulaire

**Solution** : Table dédiée `options_volume` (cohérent avec `ticker_quotes`, `options_flow`, etc.)
```sql
CREATE TABLE options_volume (
  ticker CITEXT NOT NULL,
  date DATE,
  call_volume BIGINT,
  put_volume BIGINT,
  call_premium DECIMAL(15, 2),
  -- ... autres colonnes
  data JSONB,
  data_date DATE,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT unique_options_volume_ticker_date UNIQUE (ticker, data_date)
);
```

**Résultat** : Schéma cohérent, TTL/freshness unifiés

### 4. Release Lock avec Status

**Problème** : `release_refresh_lock()` ne mettait pas à jour le status → risque de rester en `refreshing`

**Solution** : Paramètre `p_new_status` dans `release_refresh_lock()`
```sql
CREATE OR REPLACE FUNCTION release_refresh_lock(
  p_ticker CITEXT,
  p_module_id TEXT,
  p_lock_owner TEXT,
  p_new_status TEXT DEFAULT NULL -- 'ready' | 'error' | NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE ticker_data_modules
  SET 
    refresh_lock_until = NULL,
    refresh_lock_owner = NULL,
    status = COALESCE(p_new_status, status) -- Met à jour status si fourni
  WHERE ...;
END;
```

**Utilisation** :
```typescript
await this.releaseRefreshLock(ticker, moduleId, owner, 'ready'); // Libère + met status à 'ready'
await this.releaseRefreshLock(ticker, moduleId, owner, 'error'); // Libère + met status à 'error'
```

**Résultat** : Status toujours cohérent, même en cas d'erreur

### 5. CITEXT (Plus de toUpperCase() Redondant)

**Problème** : `ticker.toUpperCase()` partout alors que CITEXT normalise automatiquement

**Solution** : Retirer tous les `toUpperCase()` (sauf pour affichage)
```typescript
// Avant
const upperTicker = ticker.toUpperCase();
await supabase.rpc('acquire_refresh_lock', { p_ticker: ticker.toUpperCase() });

// Après
const upperTicker = ticker; // CITEXT normalise automatiquement
await supabase.rpc('acquire_refresh_lock', { p_ticker: ticker });
```

**Résultat** : Code plus simple, pas de doublons `nvda` vs `NVDA`

### 6. get_or_create_job() Robuste

**Problème** : `ON CONFLICT DO UPDATE` sans garantie de récupérer le bon job

**Solution** : `ON CONFLICT DO NOTHING` puis SELECT
```sql
-- 1) Chercher job existant
SELECT ... WHERE idempotency_key = ...;

-- 2) Si pas trouvé, INSERT avec DO NOTHING
INSERT ... ON CONFLICT (idempotency_key) DO NOTHING;

-- 3) Si INSERT réussi (FOUND), retourner le nouveau job
-- 4) Sinon (conflit), récupérer le job existant
SELECT ... WHERE idempotency_key = ...;
```

**Résultat** : Pas de race condition, toujours le bon job retourné

## 📊 Impact

### Avant
- ❌ Race conditions possibles (SELECT puis UPDATE)
- ❌ Appels API inutiles même si données fraîches
- ❌ Schéma incohérent (options_volume dans unusual_whales_cache)
- ❌ Status peut rester en `refreshing` si erreur
- ❌ Code redondant (toUpperCase() partout)

### Après
- ✅ Verrous atomiques (UPDATE conditionnel)
- ✅ Skip si fresh (pas d'appel API inutile)
- ✅ Schéma cohérent (table dédiée par module)
- ✅ Status toujours cohérent (release avec status)
- ✅ Code simplifié (CITEXT)

## 🎯 Résultat Final

- **Latence réduite** : Skip si fresh évite les appels API inutiles
- **Pas de race conditions** : Verrous atomiques au niveau SQL
- **Schéma cohérent** : Une table par module, TTL/freshness unifiés
- **Status fiable** : Toujours mis à jour, même en cas d'erreur
- **Code maintenable** : CITEXT simplifie le code

## 🚀 Prochaines Étapes

1. ✅ Migration SQL appliquée
2. ✅ Service d'ingestion mis à jour
3. ⏳ Tester les verrous atomiques
4. ⏳ Tester le skip if fresh
5. ⏳ Refactoriser la route globale (assemble only)





