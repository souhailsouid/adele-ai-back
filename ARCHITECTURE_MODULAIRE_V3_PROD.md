# Architecture Modulaire V3 - Version PROD-GRADE

## 🎯 Améliorations Production

Cette version intègre les recommandations pour éviter les pièges classiques :
- ✅ Race conditions (verrous/leases)
- ✅ Cache stampede (idempotency keys)
- ✅ Stale vs expired (freshness dérivé, pas stocké)
- ✅ Unicité améliorée (version/input_hash)
- ✅ TTL séparés (data vs analyse)
- ✅ Freshness par module (pas de règle globale)

## 📋 Changements Clés

### 1. Status "stale" dérivé (pas stocké)

**Avant** :
```sql
status TEXT NOT NULL DEFAULT 'missing', -- 'missing' | 'refreshing' | 'ready' | 'error' | 'stale'
```

**Après** :
```sql
status TEXT NOT NULL DEFAULT 'missing', -- 'missing' | 'refreshing' | 'ready' | 'error' (PAS 'stale')
-- freshness_status dérivé dans la vue via freshness_threshold_hours
```

**Vue `ticker_modules_status`** :
```sql
CASE 
  WHEN tdm.status = 'missing' OR tdm.status = 'error' THEN 'missing'
  WHEN tdm.expires_at IS NOT NULL AND NOW() > tdm.expires_at THEN 'expired'
  WHEN tdm.fetched_at IS NOT NULL AND ac.freshness_threshold_hours IS NOT NULL 
       AND NOW() - tdm.fetched_at > (ac.freshness_threshold_hours || ' hours')::INTERVAL THEN 'stale'
  WHEN tdm.status = 'ready' THEN 'fresh'
  ELSE 'unknown'
END as freshness_status
```

### 2. Verrous/Leases pour éviter cache stampede

**Nouveaux champs** :
```sql
refresh_lock_until TIMESTAMPTZ, -- Expiration du verrou
refresh_lock_owner TEXT, -- Identifiant du job/process qui détient le verrou
```

**Fonctions SQL** :
- `acquire_refresh_lock(ticker, module_id, lock_owner, lock_duration_seconds)` : Acquiert un verrou (retourne true/false)
- `release_refresh_lock(ticker, module_id, lock_owner)` : Libère un verrou

**Utilisation dans le service** :
```typescript
const lockAcquired = await this.acquireRefreshLock(ticker, moduleId, owner, 120);
if (!lockAcquired) {
  // Un autre processus est déjà en train de refresh, skip
  return;
}
// ... faire le refresh ...
await this.releaseRefreshLock(ticker, moduleId, owner);
```

### 3. Unicité améliorée pour `unit_analyses`

**Avant** :
```sql
CONSTRAINT unique_unit_analysis UNIQUE (ticker, module_id, data_date)
-- Problème : data_date peut être NULL (price_action intraday)
```

**Après** :
```sql
analysis_version INT DEFAULT 1, -- Version de l'analyse
input_hash TEXT, -- Hash des inputs normalisés
CONSTRAINT unique_unit_analysis UNIQUE (ticker, module_id, data_date, analysis_version),
CONSTRAINT unique_unit_analysis_hash UNIQUE (ticker, module_id, input_hash) WHERE input_hash IS NOT NULL
```

**Avantages** :
- Support pour `data_date = NULL` (données intraday)
- Plusieurs analyses le même jour si nécessaire
- Cache exact par contenu via `input_hash`

### 4. TTL séparés : data vs analyse

**Avant** :
```sql
ttl_hours INTEGER NOT NULL DEFAULT 24, -- Un seul TTL
```

**Après** :
```sql
data_ttl_hours DECIMAL(5, 2) NOT NULL DEFAULT 24.0, -- TTL des données brutes (API snapshot)
analysis_ttl_hours DECIMAL(5, 2) NOT NULL DEFAULT 24.0, -- TTL des analyses (résultat LLM/règles)
max_stale_hours DECIMAL(5, 2) DEFAULT NULL, -- Si accepte de servir du vieux plutôt que rien
```

**Exemple** :
- `options_flow` : `data_ttl_hours = 1.0`, `analysis_ttl_hours = 0.5`
- Les données brutes expirent après 1h, mais l'analyse peut être réutilisée pendant 30min

### 5. Freshness par module (pas de règle globale)

**Avant** (dangereux) :
```sql
WHEN tdm.data_date IS NOT NULL AND tdm.data_date < CURRENT_DATE - INTERVAL '1 day' THEN 'stale'
-- Problème : marque stale des modules "lents" (short_interest) même si c'est normal
```

**Après** :
```sql
WHEN tdm.fetched_at IS NOT NULL AND ac.freshness_threshold_hours IS NOT NULL 
     AND NOW() - tdm.fetched_at > (ac.freshness_threshold_hours || ' hours')::INTERVAL THEN 'stale'
-- Utilise freshness_threshold_hours du catalog (par module)
```

**Exemple** :
- `options_flow` : `freshness_threshold_hours = 0.25` (15 min)
- `short_interest` : `freshness_threshold_hours = 1.0` (1h)
- Chaque module a son propre seuil de fraîcheur

### 6. Idempotency key sur `analysis_jobs`

**Nouveau champ** :
```sql
idempotency_key TEXT UNIQUE, -- Clé d'idempotence (ex: ticker + job_type + modules_selected + day/hour bucket)
```

**Fonction SQL** :
```sql
get_or_create_job(idempotency_key, ticker, job_type, input_data)
-- Retourne le job existant si la clé existe, sinon crée un nouveau job
```

**Utilisation** :
```typescript
const idempotencyKey = `${ticker}_${jobType}_${modules.join(',')}_${dayHourBucket}`;
const { job_id, status, created } = await getOrCreateJob(idempotencyKey, ticker, jobType, inputData);
if (!created) {
  // Job déjà existant, retourner le job_id
  return { job_id, status };
}
```

### 7. CITEXT pour ticker (normalisation automatique)

**Avant** :
```sql
ticker TEXT NOT NULL, -- Risque d'avoir 'nvda' et 'NVDA' en base
```

**Après** :
```sql
ticker CITEXT NOT NULL, -- Case-insensitive text (normalise automatiquement)
```

**Avantages** :
- Plus besoin de `UPPER()` partout
- Pas de doublons `nvda` vs `NVDA`
- Performance similaire à TEXT

## 🔄 Flux avec Verrous

### Scénario : Cache Stampede

1. **Requête 1** : `POST /ingest/options-flow?ticker=NVDA`
   - Acquiert le verrou (`refresh_lock_until = NOW() + 120s`, `refresh_lock_owner = 'req1'`)
   - Status = `refreshing`
   - Commence à appeler l'API UW

2. **Requête 2** (pendant que req1 est en cours) : `POST /ingest/options-flow?ticker=NVDA`
   - Tente d'acquérir le verrou → **ÉCHEC** (verrou déjà détenu par req1)
   - Retourne immédiatement l'état actuel (status = `refreshing`)
   - **Pas d'appel API dupliqué** ✅

3. **Requête 1** termine :
   - Status = `ready`
   - Libère le verrou (`refresh_lock_until = NULL`)

4. **Requête 3** (après req1) : `POST /ingest/options-flow?ticker=NVDA`
   - Acquiert le verrou (req1 a libéré)
   - Vérifie si les données sont encore fraîches
   - Si oui, skip l'API
   - Si non, refresh

## 📊 Vue `ticker_modules_status` Améliorée

La vue retourne maintenant :
- `status` : `missing` | `refreshing` | `ready` | `error` (stocké)
- `freshness_status` : `missing` | `fresh` | `stale` | `expired` | `unknown` (dérivé)
- `can_serve_stale` : `true` si `max_stale_hours` permet de servir du vieux

**Exemple** :
```sql
SELECT * FROM ticker_modules_status WHERE ticker = 'NVDA';
```

| module_id | status | freshness_status | can_serve_stale |
|-----------|--------|------------------|-----------------|
| options_flow | ready | stale | true |
| dark_pool | ready | fresh | false |
| short_interest | ready | stale | true |

## 🚀 Utilisation dans les Routes

### Route d'Ingestion avec Verrou

```typescript
async ingestOptionsFlow(ticker: string, params?: any, lockOwner?: string) {
  const owner = lockOwner || `ingest_${Date.now()}_${Math.random()}`;
  
  // Acquérir le verrou
  const lockAcquired = await this.acquireRefreshLock(ticker, 'options_flow', owner, 120);
  if (!lockAcquired) {
    // Un autre processus est déjà en train de refresh
    return this.getModuleState(ticker, 'options_flow');
  }
  
  try {
    // Faire le refresh
    await this.updateModuleStatus(ticker, 'options_flow', 'refreshing');
    const response = await uw.getUWRecentFlows(ticker, params);
    // ... stocker les données ...
    await this.updateModuleStatus(ticker, 'options_flow', 'ready');
  } finally {
    // Toujours libérer le verrou
    await this.releaseRefreshLock(ticker, 'options_flow', owner);
  }
}
```

### Route Globale (Assemble Only)

```typescript
POST /ai/ticker-activity-analysis
{
  "ticker": "NVDA",
  "modules": ["options_flow", "dark_pool", ...] // optionnel
}
```

**Comportement** :
1. Lit l'état des modules depuis `ticker_modules_status`
2. Identifie les modules manquants/stale
3. **Si manquants** : Enqueue un job (pas d'attente)
4. Lit les analyses unitaires depuis `unit_analyses`
5. Lit les données brutes depuis les tables de cache
6. Construit le pack de données
7. Appelle l'IA pour la synthèse (prompt court)
8. **Retourne en < 5s** ✅

## 📝 Checklist Migration

- [x] Migration SQL avec toutes les améliorations
- [x] Service d'ingestion avec verrous
- [ ] Service d'analyses unitaires avec `input_hash`
- [ ] Route globale refactorisée (assemble only)
- [ ] Jobs asynchrones avec idempotency
- [ ] Dashboard avec sélection de modules

## 🎯 Résultat Attendu

- ✅ **Pas de cache stampede** : Verrous empêchent les appels API dupliqués
- ✅ **Pas de race conditions** : Verrous atomiques au niveau SQL
- ✅ **Freshness correcte** : Dérivé par module via `freshness_threshold_hours`
- ✅ **TTL flexibles** : Data vs Analyse séparés
- ✅ **Idempotency** : Jobs évitent les doublons
- ✅ **Latence < 5s** : Route globale = assemble only





