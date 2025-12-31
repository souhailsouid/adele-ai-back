# Guide : Persistance des Données Ticker dans Supabase

## 📋 Vue d'ensemble

Ce système permet de **persister automatiquement** les données d'options flow, dark pool et short interest dans Supabase, avec **vérification de fraîcheur** basée sur la date des données (pas seulement `expires_at`).

## 🎯 Problème résolu

**Avant** :
- Les données étaient cachées dans une table générique `unusual_whales_cache` qui n'existait pas
- Pas de vérification de fraîcheur basée sur la date réelle des données
- Les données étaient perdues entre les invocations Lambda
- Pas de persistance structurée pour options flow, dark pool, short interest

**Après** :
- ✅ Tables dédiées dans Supabase : `options_flow`, `dark_pool_trades`, `short_interest`
- ✅ Vérification de fraîcheur basée sur `data_date` (date réelle des données)
- ✅ Persistance automatique lors de chaque fetch
- ✅ Réutilisation des données fraîches sans appels API inutiles

## 📊 Architecture

### Tables Supabase

#### 1. `unusual_whales_cache` (table générique)
- **Usage** : Cache générique pour toutes les APIs UW utilisant `cache_key`
- **Structure** :
  - `cache_key` (TEXT, UNIQUE) : Clé de cache (ex: `"uw_recent_flows_NVDA_{limit:30}"`)
  - `data` (JSONB) : Données brutes
  - `data_date` (TIMESTAMPTZ) : Date des données si disponible
  - `cached_at` (TIMESTAMPTZ) : Date de mise en cache
  - `expires_at` (TIMESTAMPTZ) : Date d'expiration

#### 2. `options_flow` (améliorée)
- **Usage** : Stockage structuré des données d'options flow
- **Colonnes ajoutées** :
  - `data_date` (DATE) : Date de trading (ISO format: YYYY-MM-DD)
  - `call_volume`, `put_volume` : Volumes agrégés
  - `call_premium`, `put_premium` : Premiums agrégés
  - `date` : Date de trading (pour compatibilité)

#### 3. `dark_pool_trades` (améliorée)
- **Usage** : Stockage structuré des trades dark pool
- **Colonnes ajoutées** :
  - `data_date` (DATE) : Date du trade
  - `executed_at` (TIMESTAMPTZ) : Timestamp d'exécution
  - `institution` (TEXT) : Institution
  - `market_center` (TEXT) : Centre de marché

#### 4. `short_interest` (nouvelle)
- **Usage** : Stockage des données de short interest
- **Structure** :
  - `ticker` (TEXT) : Ticker
  - `short_interest` (BIGINT) : Nombre d'actions vendues à découvert
  - `float` (BIGINT) : Float disponible
  - `short_interest_ratio` (DECIMAL) : Ratio short interest / float
  - `days_to_cover` (DECIMAL) : Jours pour couvrir les shorts
  - `data_date` (DATE) : Date des données
  - `data` (JSONB) : Données brutes complètes
  - `cached_at`, `expires_at` : Métadonnées de cache
  - **Contrainte unique** : `(ticker, data_date)` pour éviter les doublons

## 🔄 Flux de données

### Options Flow

```typescript
// 1. Vérifier la fraîcheur dans Supabase
const cached = await supabase
  .from('options_flow')
  .select('*')
  .eq('ticker', 'NVDA')
  .gt('expires_at', NOW())
  .order('data_date', { ascending: false })
  .limit(100);

// 2. Si fraîches (< 1h), retourner depuis cache
if (ageHours < 1) {
  return { data: cached, fromCache: true };
}

// 3. Sinon, fetch depuis API UW
const freshData = await uw.getUWRecentFlows('NVDA', { limit: 30 });

// 4. Stocker dans Supabase avec data_date
await supabase
  .from('options_flow')
  .upsert(recordsToInsert);

// 5. Retourner les nouvelles données
return { data: freshData, fromCache: false };
```

### Dark Pool & Short Interest

Même logique, mais avec des `maxAgeHours` différents :
- **Dark Pool** : 24h (change moins fréquemment)
- **Short Interest** : 24h (change quotidiennement)

## 🛠️ Utilisation

### Dans la route `/ai/ticker-activity-analysis`

```typescript
import { TickerDataPersistenceService } from '../services/ticker-data-persistence.service';

const persistenceService = new TickerDataPersistenceService();

// Options Flow avec persistance
const optionsFlowResult = await persistenceService.getOrFetchOptionsFlow(
  ticker,
  async () => {
    const result = await timeout(uw.getUWRecentFlows(ticker, { limit: 30 }), 5000, 1);
    return result.value?.data || [];
  },
  1 // maxAgeHours: 1h
);

// Dark Pool avec persistance
const darkPoolResult = await persistenceService.getOrFetchDarkPool(
  ticker,
  async () => {
    const result = await timeout(uw.getUWDarkPoolTrades(ticker, { limit: 30 }), 5000, 1);
    return result.value?.data || [];
  },
  24 // maxAgeHours: 24h
);

// Short Interest avec persistance
const shortInterestResult = await persistenceService.getOrFetchShortInterest(
  ticker,
  async () => {
    const result = await timeout(uw.getUWShortInterestAndFloat(ticker), 4000, 1);
    return result.value?.data || null;
  },
  24 // maxAgeHours: 24h
);
```

## 📅 Vérification de fraîcheur

Le système utilise **3 niveaux de dates** pour déterminer la fraîcheur :

1. **`data_date`** (priorité 1) : Date réelle des données depuis l'API
2. **`executed_at`** (priorité 2) : Timestamp d'exécution (pour dark pool)
3. **`cached_at`** (priorité 3) : Date de mise en cache (fallback)

```typescript
const referenceDate = dataDate || executedAt || cachedAt;
const ageHours = (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60);

if (ageHours < maxAgeHours) {
  // Utiliser les données en cache
  return { data: cached, fromCache: true };
}
```

## 🔧 Migration SQL

La migration `008_unusual_whales_cache_and_short_interest.sql` :
1. Crée la table `unusual_whales_cache` (pour le cache générique UW)
2. Crée la table `short_interest` (nouvelle)
3. Améliore `options_flow` et `dark_pool_trades` (ajoute `data_date` et colonnes supplémentaires)
4. Configure RLS (Row Level Security) pour permettre l'accès service_role
5. Crée des fonctions utilitaires (`cleanup_expired_uw_cache`, `is_data_fresh`)

## 📈 Avantages

1. **Performance** : Réduction des appels API inutiles (réutilisation des données fraîches)
2. **Fiabilité** : Données persistées même en cas d'erreur API
3. **Traçabilité** : Historique des données avec dates réelles
4. **Coût** : Réduction des coûts API UW (moins d'appels)
5. **Latence** : Réponses plus rapides pour les données en cache

## 🚀 Prochaines étapes

1. **Insiders** : Ajouter la persistance pour les données d'insiders
2. **Institutional Ownership** : Ajouter la persistance pour l'ownership institutionnel
3. **Nettoyage automatique** : Créer un cron job pour nettoyer les données expirées
4. **Analytics** : Ajouter des métriques sur l'utilisation du cache (hit rate, etc.)

## 📝 Notes

- Les données sont stockées avec un TTL de 24h par défaut (`expires_at`)
- La vérification de fraîcheur utilise `data_date` si disponible, sinon `cached_at`
- Les données sont upsertées (pas de doublons) grâce aux contraintes uniques
- Le service gère gracieusement les erreurs (fallback vers fetch direct si Supabase échoue)





