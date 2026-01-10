# Guide de Tests et Validation - Backend Personamy

Ce document regroupe tous les tests et scripts de validation créés aujourd'hui pour vérifier la pertinence et la fiabilité des données backend.

## 📋 Table des Matières

1. [Tests d'Analyse Stratégique](#tests-danalyse-stratégique)
2. [Tests de Notifications d'Accumulation](#tests-de-notifications-daccumulation)
3. [Scripts de Diagnostic](#scripts-de-diagnostic)
4. [Utilisation et Exécution](#utilisation-et-exécution)

---

## 🧪 Tests d'Analyse Stratégique

### Script Principal : `tests/strategic-analysis/test-strategic-analysis.ts`

**Objectif** : Valider la pertinence et la cohérence des données retournées par `/funds/{id}/diffs/strategic`

**Fonctionnalités testées** :
- ✅ Structure de la réponse `StrategicAnalysis`
- ✅ Calculs de `portfolio_impact_pct` et `portfolio_weight`
- ✅ Classification par conviction (high/medium/low/noise)
- ✅ Détection des tendances multi-trimestres (accumulations/distributions)
- ✅ Cohérence des flux sectoriels
- ✅ **NOUVEAU** : Validation de `all_movements` (liste fusionnée et triée)
- ✅ **NOUVEAU** : Validation de `sector_flows_filtered` (exclut "Unknown")
- ✅ **NOUVEAU** : Validation de `has_only_unknown_sectors`
- ✅ **NOUVEAU** : Test avec `include_low_conviction=true`

**Utilisation** :
```bash
# Tester un fund spécifique (par défaut: fund 32)
npx tsx tests/strategic-analysis/test-strategic-analysis.ts

# Ou modifier FUND_ID dans le script pour tester un autre fund
```

**Résultats attendus** :
- ✅ Succès : 19+ validations
- ⚠️ Avertissements : 0-2 (non critiques)
- ❌ Erreurs : 0

**Exemple de sortie** :
```
✅ all_movements existe: 10 mouvements
✅ Tri par priorité validé: accumulations 3+ > 2+ > impact décroissant
✅ sector_flows_filtered exclut bien les secteurs 'Unknown'
✅ has_only_unknown_sectors = true (cohérent avec les données)
```

---

## 🔔 Tests de Notifications d'Accumulation

### Route : `GET /notifications/accumulations`

**Objectif** : Tester l'historique complet des accumulations multi-trimestres

**Tests effectués** :

#### 1. Test de base (feed global)
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/notifications/accumulations?only_global=true&limit=50"
```

**Résultat attendu** : Tableau d'accumulations avec :
- `fund_id`, `fund_name`, `ticker`
- `trend_quarters` (2+ pour signal pertinent, 3+ pour signal fort)
- `is_strong_accumulation` (true si 3+ trimestres)
- `total_added` (en milliers USD)
- `filing_date` (date du filing le plus récent)

#### 2. Test avec filtres
```bash
# Uniquement les accumulations 3+ trimestres (signal très fort)
curl -H "Authorization: Bearer $TOKEN" \
  "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/notifications/accumulations?only_global=true&only_strong=true&limit=20"

# Filtrer par année
curl -H "Authorization: Bearer $TOKEN" \
  "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/notifications/accumulations?only_global=true&year=2024&limit=10"

# Filtrer par trimestre
curl -H "Authorization: Bearer $TOKEN" \
  "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/notifications/accumulations?only_global=true&quarter=Q1-2024&limit=10"
```

**Statistiques attendues** (exemple) :
- Total accumulations : ~97
- Accumulations fortes (3+) : ~26
- Funds analysés : ~9
- Top funds : Bridgewater (27), Soros (18), Berkshire (16)

---

## 🔍 Scripts de Diagnostic

### 1. Diagnostic SQL : `tests/accumulations/diagnose-accumulations.sql`

**Objectif** : Analyser pourquoi les accumulations ne sont pas détectées pour un fund spécifique

**Utilisation** :
```sql
-- Exécuter dans l'éditeur SQL de Supabase
-- Remplacer fund_id = 32 par le fund_id à analyser
```

**Requêtes incluses** :
1. Vérification des filings parsés
2. Liste des filings avec leurs IDs
3. Diffs calculés pour les 8 derniers filings
4. Top 10 tickers avec le plus de mouvements
5. Séquences d'accumulation détectées (2+ trimestres)
6. Raisons de non-détection (gaps, ventes intermédiaires)
7. Tickers avec seulement 2 accumulations consécutives
8. Exemple détaillé pour un ticker spécifique

### 2. Script TypeScript : `tests/accumulations/diagnose-accumulations.ts`

**Objectif** : Automatiser l'exécution des requêtes SQL de diagnostic

**Utilisation** :
```bash
# Configurer les variables d'environnement
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-key"

# Exécuter le diagnostic
npx tsx tests/accumulations/diagnose-accumulations.ts <fund_id>
```

**Exemple** :
```bash
npx tsx tests/accumulations/diagnose-accumulations.ts 32
```

**Résultat** : Affiche les résultats de toutes les requêtes de diagnostic de manière structurée

---

## 📊 Tests de Cohérence des Données

### Validation des Calculs

#### 1. Portfolio Impact
- **Formule** : `portfolio_impact_pct = |diff_value| / total_portfolio_value * 100`
- **Validation** : Vérifie que le calcul est cohérent pour chaque diff

#### 2. Conviction Level
- **High** : `portfolio_impact_pct > 5%` OU nouvelle position `> 3%`
- **Medium** : `1% <= portfolio_impact_pct <= 5%`
- **Low** : `0.5% <= portfolio_impact_pct < 1%`
- **Noise** : `portfolio_impact_pct < 0.5%` (filtré)

#### 3. Net Inflow / Net Outflow
- **Net Inflow** : Somme des `|diff_value|` pour `action = 'new'` OU `'increase'`
- **Net Outflow** : Somme des `|diff_value|` pour `action = 'exit'` OU `'decrease'`
- **Validation** : Vérifie que les totaux correspondent aux diffs individuels

#### 4. Flux Sectoriels
- **Inflow** : Somme des `diff_value` positifs par secteur
- **Outflow** : Somme des `diff_value` négatifs par secteur
- **Net Flow** : `inflow - outflow`
- **Validation** : Tolérance de $1000 pour les arrondis

---

## 🎯 Tests des Nouvelles Fonctionnalités (Aujourd'hui)

### 1. `all_movements` - Liste Fusionnée et Triée

**Test** :
```typescript
// Vérifier que all_movements existe
if (!analysis.all_movements || !Array.isArray(analysis.all_movements)) {
  throw new Error("all_movements manquant");
}

// Vérifier le contenu (strong + medium, optionnellement low)
const expectedCount = analysis.strong_conviction_movements.length + 
                      analysis.medium_conviction_movements.length;
if (analysis.all_movements.length < expectedCount) {
  throw new Error("all_movements incomplet");
}

// Vérifier le tri par priorité
// 1. Accumulations 3+ trimestres en premier
// 2. Accumulations 2+ trimestres ensuite
// 3. Impact décroissant pour les autres
```

**Résultat attendu** :
- ✅ `all_movements.length` = `strong.length + medium.length` (sans `include_low_conviction`)
- ✅ `all_movements.length` = `strong.length + medium.length + low.length` (avec `include_low_conviction=true`)
- ✅ Tri correct : LULULEMON (8.68%, accumulation 2Q) avant MOLINA HEA (35.11%, pas d'accumulation)

### 2. `sector_flows_filtered` - Exclusion des "Unknown"

**Test** :
```typescript
// Vérifier que sector_flows_filtered existe
if (!analysis.sector_flows_filtered || !Array.isArray(analysis.sector_flows_filtered)) {
  throw new Error("sector_flows_filtered manquant");
}

// Vérifier qu'aucun secteur "Unknown" n'est présent
const hasUnknown = analysis.sector_flows_filtered.some(
  sf => sf.sector === 'Unknown' || !sf.sector
);
if (hasUnknown) {
  throw new Error("sector_flows_filtered contient des 'Unknown'");
}
```

**Résultat attendu** :
- ✅ `sector_flows_filtered` exclut tous les secteurs "Unknown"
- ✅ Utilisable directement pour le graphique frontend

### 3. `has_only_unknown_sectors` - Flag pour le Frontend

**Test** :
```typescript
// Vérifier la cohérence
const allSectorsAreUnknown = analysis.sector_flows.length > 0 && 
                              analysis.sector_flows.every(
                                sf => !sf.sector || sf.sector === 'Unknown'
                              );

if (allSectorsAreUnknown && !analysis.has_only_unknown_sectors) {
  throw new Error("Incohérence: tous Unknown mais flag = false");
}
```

**Résultat attendu** :
- ✅ `has_only_unknown_sectors = true` si tous les secteurs sont "Unknown"
- ✅ `has_only_unknown_sectors = false` sinon

### 4. Paramètre `include_low_conviction`

**Test** :
```bash
# Sans include_low_conviction (par défaut)
curl "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/funds/32/diffs/strategic?limit=500"

# Avec include_low_conviction=true
curl "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/funds/32/diffs/strategic?limit=500&include_low_conviction=true"
```

**Résultat attendu** :
- ✅ Sans : `all_movements.length` = `strong.length + medium.length`
- ✅ Avec : `all_movements.length` = `strong.length + medium.length + low.length`

---

## 🚀 Utilisation et Exécution

### Prérequis

1. **Variables d'environnement** :
   ```bash
   export SUPABASE_URL="https://your-project.supabase.co"
   export SUPABASE_SERVICE_KEY="your-service-key"
   ```

2. **Token JWT** (pour les tests API) :
   - Récupérer depuis Cognito ou utiliser un token valide
   - Mettre à jour `ACCESS_TOKEN` dans `test-strategic-analysis.ts`

### Exécution des Tests

#### Test d'Analyse Stratégique
```bash
cd /Users/souhailsouid/startup/personamy/backend
npx tsx test-strategic-analysis.ts
```

#### Test des Notifications d'Accumulation
```bash
# Via curl (remplacer $TOKEN par votre token)
TOKEN="your-jwt-token"

# Test de base
curl -H "Authorization: Bearer $TOKEN" \
  "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/notifications/accumulations?only_global=true&limit=20"

# Test avec filtres
curl -H "Authorization: Bearer $TOKEN" \
  "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/notifications/accumulations?only_global=true&only_strong=true&limit=10"
```

#### Diagnostic d'Accumulations
```bash
# Via script TypeScript
npx tsx scripts/diagnose-accumulations.ts <fund_id>

# Via SQL (dans Supabase)
# Copier-coller le contenu de scripts/diagnose-accumulations.sql
# Remplacer fund_id = 32 par le fund_id à analyser
```

---

## 📝 Checklist de Validation

Avant de déployer ou de considérer une fonctionnalité comme validée, vérifier :

### Analyse Stratégique
- [ ] `all_movements` existe et contient strong + medium
- [ ] Tri par priorité correct (accumulations 3+ > 2+ > impact)
- [ ] `sector_flows_filtered` exclut "Unknown"
- [ ] `has_only_unknown_sectors` est cohérent
- [ ] `include_low_conviction` fonctionne correctement
- [ ] Portfolio impact calculé correctement
- [ ] Conviction levels cohérents
- [ ] Net inflow/outflow cohérents

### Notifications d'Accumulation
- [ ] Route `/notifications/accumulations?only_global=true` retourne des données
- [ ] Filtres `only_strong`, `min_quarters`, `year`, `quarter` fonctionnent
- [ ] Les accumulations sont triées par priorité (3+ > 2+)
- [ ] Les données incluent `filing_date` et `fund_name`

### Diagnostic
- [ ] Script SQL exécutable dans Supabase
- [ ] Script TypeScript fonctionne avec les variables d'environnement
- [ ] Les résultats sont clairs et exploitables

---

## 🔧 Maintenance et Mise à Jour

### Quand mettre à jour ce guide

1. **Nouvelle fonctionnalité ajoutée** : Ajouter une section de test
2. **Bug corrigé** : Documenter le test qui aurait dû le détecter
3. **Changement d'API** : Mettre à jour les exemples de requêtes
4. **Nouveau script de test** : Ajouter dans la section appropriée

### Structure recommandée pour nouveaux tests

```typescript
/**
 * Test: [Nom du test]
 * Objectif: [Ce que le test valide]
 * 
 * Prérequis:
 * - [Liste des prérequis]
 * 
 * Exécution:
 * npx tsx scripts/test-[nom].ts
 * 
 * Résultat attendu:
 * - [Liste des validations]
 */
```

---

## 📚 Références

- **Guide Frontend** : `FRONTEND_STRATEGIC_ANALYSIS_GUIDE.md`
- **Guide Admin Dashboard** : `ADMIN_DASHBOARD_FRONTEND_GUIDE.md`
- **Guide Accumulation Notifications** : `ACCUMULATION_NOTIFICATIONS_GUIDE.md`
- **Script de Diagnostic** : `scripts/diagnose-accumulations-summary.md`

---

## 🎯 Résultats des Tests Aujourd'hui

### Fund 32 (Scion Asset Management)

**Analyse Stratégique** :
- ✅ 10 mouvements dans `all_movements` (sans low conviction)
- ✅ 140 mouvements avec `include_low_conviction=true`
- ✅ 1 accumulation détectée (LULULEMON, 2Q)
- ✅ 5 distributions détectées
- ✅ Portfolio value: $68.14M
- ✅ Net inflow: $58.84M
- ✅ Net outflow: $36.91M

**Notifications d'Accumulation** :
- ✅ 97 accumulations globales détectées
- ✅ 26 accumulations fortes (3+ trimestres)
- ✅ 9 funds analysés
- ✅ Top fund: Bridgewater (27 accumulations)

**Tous les tests passent avec succès** ✅

---

*Dernière mise à jour : 2026-01-09*
*Tests validés pour : Fund 32, Fund 18, Fund 25, Fund 23*
