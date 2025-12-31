# Architecture Modulaire V3 - Refonte Complète

## 🎯 Objectif

Résoudre les problèmes de timeout Lambda (20s) en séparant l'architecture en **3 couches** :
1. **Collecte (ingestion)** - Rapide, idempotente
2. **Analyses unitaires** - Une analyse = un module
3. **Synthèse globale** - Assemble only (pas d'API externe)

## 📋 Architecture en 3 Couches

### Couche A : Collecte (Ingestion)

**Objectif** : Appeler les APIs externes, normaliser et stocker en base
- ✅ Pas de LLM
- ✅ Pas d'agrégation globale
- ✅ Idempotent (peut être appelé plusieurs fois)
- ✅ Rapide (< 5s par module)

**Routes** :
- `POST /ingest/options-flow?ticker=NVDA`
- `POST /ingest/options-volume?ticker=NVDA`
- `POST /ingest/dark-pool?ticker=NVDA`
- `POST /ingest/short-interest?ticker=NVDA`
- `POST /ingest/price-action?ticker=NVDA`
- `POST /ingest/all?ticker=NVDA&modules=options_flow,dark_pool,...`
- `GET /ingest/status?ticker=NVDA`

**Service** : `TickerDataIngestionService`

**Tables** :
- `ticker_data_modules` : État de chaque module (status, fetched_at, data_date, expires_at)
- Tables existantes : `options_flow`, `dark_pool_trades`, `short_interest`, `ticker_quotes`, etc.

### Couche B : Analyses Unitaires

**Objectif** : Lire les données en base, exécuter une analyse "petite" (LLM ou règles), écrire un résultat structuré
- ✅ Chaque analyse est indépendante
- ✅ Court (< 2-5s)
- ✅ Résultat structuré et standardisé

**Routes** :
- `POST /analyze/options-flow?ticker=NVDA`
- `POST /analyze/dark-pool?ticker=NVDA`
- `POST /analyze/all?ticker=NVDA&modules=options_flow,dark_pool`
- `GET /analyze/results?ticker=NVDA&modules=options_flow,dark_pool`

**Service** : `UnitAnalysisService`

**Table** : `unit_analyses`
- Structure standardisée :
  ```json
  {
    "signals": [
      {"name": "bullish_flow", "score": 0.78, "evidence": ["..."]}
    ],
    "summary": "...",
    "confidence": 0.7,
    "metrics": {...}
  }
  ```

### Couche C : Synthèse Globale

**Objectif** : Assembler les données et analyses déjà calculées, faire une synthèse légère (LLM court)
- ✅ Pas d'API externe
- ✅ Pas de gros calcul
- ✅ Lit uniquement depuis la base
- ✅ Objectif : < 5s de latence

**Route** : `POST /ai/ticker-activity-analysis` (refactorisée)

**Comportement** :
1. Vérifie l'état des modules (lecture rapide en base)
2. Identifie les modules manquants/stale
3. Déclenche l'ingestion en arrière-plan si nécessaire (ne bloque pas)
4. Lit les analyses unitaires depuis la base
5. Lit les données brutes depuis la base (pour contexte)
6. Construit le pack de données
7. Appelle l'IA pour la synthèse (prompt court)

## 🗄️ Schéma de Base de Données

### Table : `ticker_data_modules`

Gère l'état de chaque module pour chaque ticker :

```sql
CREATE TABLE ticker_data_modules (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  module_id TEXT NOT NULL, -- 'options_flow', 'dark_pool', etc.
  status TEXT NOT NULL DEFAULT 'missing', -- 'missing' | 'refreshing' | 'ready' | 'error' | 'stale'
  fetched_at TIMESTAMPTZ,
  data_date DATE,
  expires_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB,
  UNIQUE (ticker, module_id)
);
```

### Table : `unit_analyses`

Stocke les résultats structurés de chaque analyse unitaire :

```sql
CREATE TABLE unit_analyses (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  module_id TEXT NOT NULL,
  analysis_date TIMESTAMPTZ DEFAULT NOW(),
  data_date DATE,
  result JSONB NOT NULL, -- Résultat structuré
  confidence DECIMAL(3, 2),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (ticker, module_id, data_date)
);
```

### Table : `analysis_catalog`

Catalogue des modules disponibles :

```sql
CREATE TABLE analysis_catalog (
  id SERIAL PRIMARY KEY,
  module_id TEXT NOT NULL UNIQUE,
  module_name TEXT NOT NULL,
  description TEXT,
  depends_on TEXT[],
  ttl_hours INTEGER NOT NULL DEFAULT 24,
  freshness_threshold_hours INTEGER DEFAULT 1,
  cost_tokens INTEGER DEFAULT 0,
  cost_time_seconds INTEGER DEFAULT 0,
  enabled_by_default BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0
);
```

### Table : `analysis_jobs`

Jobs asynchrones pour analyses lourdes (futur) :

```sql
CREATE TABLE analysis_jobs (
  id SERIAL PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE,
  ticker TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'
  input_data JSONB,
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);
```

## 🔄 Flux de Données

### Scénario 1 : Première Requête (Données Manquantes)

1. **Client** : `POST /ai/ticker-activity-analysis` avec `{"ticker": "NVDA"}`
2. **Synthèse** : Vérifie l'état des modules → détecte que `options_flow` est `missing`
3. **Synthèse** : Déclenche `ingestionService.ingestOptionsFlow()` en arrière-plan (non-bloquant)
4. **Synthèse** : Continue avec les modules disponibles
5. **Synthèse** : Retourne une analyse partielle (ou attend si nécessaire)

### Scénario 2 : Données Fraîches Disponibles

1. **Client** : `POST /ai/ticker-activity-analysis` avec `{"ticker": "NVDA"}`
2. **Synthèse** : Vérifie l'état des modules → tous sont `ready` et `fresh`
3. **Synthèse** : Lit les analyses unitaires depuis `unit_analyses`
4. **Synthèse** : Lit les données brutes depuis les tables de cache
5. **Synthèse** : Construit le pack de données
6. **Synthèse** : Appelle l'IA pour la synthèse (prompt court)
7. **Synthèse** : Retourne l'analyse complète (< 5s)

### Scénario 3 : Refresh Manuel

1. **Client** : `POST /ingest/all?ticker=NVDA&modules=options_flow,dark_pool`
2. **Ingestion** : Appelle les APIs externes en parallèle
3. **Ingestion** : Normalise et stocke en base
4. **Ingestion** : Met à jour `ticker_data_modules` avec `status='ready'`
5. **Client** : `POST /analyze/all?ticker=NVDA&modules=options_flow,dark_pool`
6. **Analyses** : Lit les données depuis la base
7. **Analyses** : Exécute les analyses unitaires
8. **Analyses** : Stocke les résultats dans `unit_analyses`

## 📊 Modules Disponibles

| Module ID | Nom | TTL | Freshness Threshold |
|-----------|-----|-----|---------------------|
| `options_flow` | Options Flow | 1h | 15 min |
| `options_volume` | Options Volume | 1h | 15 min |
| `oi_change` | OI Change | 1h | 15 min |
| `greeks` | Greeks | 1h | 15 min |
| `max_pain` | Max Pain | 1h | 15 min |
| `dark_pool` | Dark Pool | 24h | 1h |
| `short_interest` | Short Interest | 24h | 1h |
| `insiders` | Insiders | 24h | 1h |
| `institutional_ownership` | Institutional Ownership | 24h | 1h |
| `price_action` | Price Action | 15 min | 5 min |

## 🚀 Migration Progressive

### Étape 1 : Infrastructure (✅ Fait)
- [x] Migration SQL `009_ticker_data_modules_architecture.sql`
- [x] Service `TickerDataIngestionService`
- [x] Service `UnitAnalysisService`
- [x] Routes d'ingestion
- [x] Routes d'analyses unitaires

### Étape 2 : Refactorisation de la Synthèse (🔄 En cours)
- [ ] Refactoriser `/ai/ticker-activity-analysis` pour utiliser la nouvelle architecture
- [ ] Tester avec des données fraîches
- [ ] Tester avec des données manquantes

### Étape 3 : Jobs Asynchrones (⏳ Futur)
- [ ] Implémenter le système de jobs asynchrones
- [ ] Route `POST /jobs/ticker-activity-analysis` → retourne `jobId`
- [ ] Route `GET /jobs/:jobId` → retourne le statut/resultat
- [ ] Lambda async pour traiter les jobs

### Étape 4 : Dashboard (⏳ Futur)
- [ ] Interface pour voir l'état des modules
- [ ] Bouton "Refresh" pour déclencher l'ingestion
- [ ] Sélection des modules à inclure dans l'analyse

## 🧪 Tests

### Test 1 : Ingestion Simple
```bash
POST /ingest/options-flow?ticker=NVDA
# Devrait retourner : { "success": true, "state": { "status": "ready", ... } }
```

### Test 2 : Analyse Unitaire
```bash
POST /analyze/options-flow?ticker=NVDA
# Devrait retourner : { "success": true, "analysis": { "signals": [...], ... } }
```

### Test 3 : Synthèse Globale
```bash
POST /ai/ticker-activity-analysis
Body: { "ticker": "NVDA" }
# Devrait retourner une analyse complète en < 5s
```

### Test 4 : État des Modules
```bash
GET /ingest/status?ticker=NVDA
# Devrait retourner l'état de tous les modules
```

## 📝 Notes Importantes

1. **Standardisation des Sorties** : Chaque analyse unitaire doit écrire un résultat structuré et stable (pas de gros texte)
2. **Cache = État** : Le "cache" devient un problème de fraîcheur + statut (pas juste TTL)
3. **Asynchrone + Polling** : Pour les analyses lourdes, utiliser des jobs asynchrones avec polling
4. **TTL Adaptatif** : Analyses incomplètes → TTL court (1h), analyses complètes → TTL long (24h)

## 🔗 Fichiers Créés/Modifiés

### Nouveaux Fichiers
- `infra/supabase/migrations/009_ticker_data_modules_architecture.sql`
- `services/api/src/services/ticker-data-ingestion.service.ts`
- `services/api/src/services/unit-analysis.service.ts`
- `services/api/src/routes/ticker-ingestion.routes.ts`
- `services/api/src/routes/unit-analysis.routes.ts`
- `services/api/src/routes/ai-analyst.routes-refactored.ts` (exemple de refactorisation)

### Fichiers à Modifier
- `services/api/src/router.ts` (ajouter les nouvelles routes)
- `services/api/src/routes/ai-analyst.routes.ts` (refactoriser `/ai/ticker-activity-analysis`)

## 🎯 Résultat Attendu

- ✅ Latence HTTP < 5s pour la synthèse globale
- ✅ Pas de timeout Lambda (20s)
- ✅ Données fraîches et à jour
- ✅ Analyses modulaires et réutilisables
- ✅ Architecture scalable et maintenable





