# Migration API vers Athena

## 📊 État de la Migration

### ✅ Tables Migrées vers S3 + Athena

| Table | Rows | Fichiers S3 | Table Athena | Status |
|-------|------|-------------|--------------|--------|
| **companies** | 8,191 | 10 | ✅ Créée | ✅ Migrée |
| **funds** | 20 | 2 | ✅ Créée | ✅ Migrée |
| **fund_filings** | 262 | 2 | ✅ Créée | ✅ Migrée |
| **company_filings** | 628,611 | 631 | ✅ Créée | ✅ Migrée |
| **fund_holdings_diff** | 50,375 | 51 | ✅ Créée | ✅ Migrée |

### 🔄 Migration API en Cours

#### ✅ Fonctions Migrées vers Athena

1. **`getCompanyByTicker`** (`services/api/src/companies.ts`)
   - ✅ Utilise `getCompanyByTickerAthena` si `USE_ATHENA=true`
   - ✅ Fallback vers Supabase si erreur ou si désactivé

#### 📝 Services Athena Créés

1. **`services/api/src/athena/query.ts`**
   - `executeAthenaQuery()` - Requête générique
   - `executeAthenaQuerySingle()` - Premier résultat
   - `executeAthenaCount()` - Requête COUNT

2. **`services/api/src/athena/companies.ts`**
   - `getCompanyByTickerAthena()` - Récupérer par ticker
   - `getCompanyByCikAthena()` - Récupérer par CIK
   - `searchCompaniesByNameAthena()` - Recherche par nom

3. **`services/api/src/athena/write.ts`** ⭐ **NOUVEAU**
   - `writeToS3Parquet()` - Écrire des données en Parquet sur S3
   - `insertRowS3()` - Insérer une ligne (remplace Supabase INSERT)
   - `insertRowsS3()` - Insérer plusieurs lignes en batch
   - Génération d'IDs uniques (timestamp + compteur)

#### ⏳ Fonctions à Migrer

**Priorité Haute (lectures fréquentes):**

1. **`services/api/src/companies.ts`**
   - [ ] `getCompanies()` - Lister toutes les entreprises
   - [ ] `getCompany(id)` - Obtenir par ID
   - [ ] `getCompanyFilings()` - Filings d'une entreprise

2. **`services/api/src/funds.ts`**
   - [ ] `getFunds()` - Lister tous les funds
   - [ ] `getFund(id)` - Obtenir un fund par ID
   - [ ] `getFundFilings()` - Filings d'un fund

3. **`services/api/src/services/fund-strategic-analysis.service.ts`**
   - [ ] `getTickersSectorsBatch()` - Récupérer secteurs par tickers (utilise `companies`)

**Priorité Moyenne (requêtes complexes):**

4. **`services/api/src/funds.ts`**
   - [ ] `getFundDiffs()` - Différences de holdings (utilise `fund_holdings_diff`, `fund_filings`)
   - [ ] `getFundTickerDiffs()` - Diffs par ticker
   - [ ] `getAllFundsRecentChanges()` - Changements récents globaux

5. **`services/api/src/services/market-pulse.service.ts`**
   - [ ] `getTickerFundsChanges()` - Changements par ticker (utilise `fund_holdings_diff`)
   - [ ] `getMarketPulse()` - Pulse global (utilise `fund_holdings_diff`)

**Priorité Basse (écritures ou requêtes complexes):**

6. **`services/api/src/services/fund-diff.service.ts`**
   - [ ] `calculateFundDiff()` - Calcul de diff (utilise `fund_filings`, `fund_holdings`)
   - Note: Nécessite aussi `fund_holdings` (pas encore migré)

## 🚀 Activation de la Migration

### Variables d'Environnement

```bash
# Activer Athena pour les lectures
USE_ATHENA=true

# Configuration Athena
ATHENA_DATABASE=adel_ai_dev
ATHENA_WORK_GROUP=adel-ai-dev-workgroup
ATHENA_RESULTS_BUCKET=adel-ai-dev-athena-results
AWS_REGION=eu-west-3
```

### Pattern de Migration

#### Lectures (Athena)
```typescript
// Lecture depuis Athena (S3 Parquet)
export async function getCompanyByTicker(ticker: string) {
  const useAthena = process.env.USE_ATHENA === 'true';
  
  if (useAthena) {
    try {
      return await getCompanyByTickerAthena(ticker);
    } catch (error) {
      console.error('[Athena] Error:', error);
      throw error; // Pas de fallback Supabase, on migre complètement
    }
  }
  
  // Fallback Supabase (temporaire, à supprimer après migration complète)
  const { data } = await supabase.from("companies")...
  return data;
}
```

#### Écritures (S3 Parquet)
```typescript
// Écriture directe sur S3 (remplace Supabase INSERT)
import { insertRowS3 } from './athena/write';

export async function createCompany(body: unknown) {
  // Validation...
  const input = CreateCompanyInput.parse(body);
  
  // Vérifier si existe déjà (lecture Athena)
  const existing = await getCompanyByTickerAthena(input.ticker);
  if (existing) {
    throw new Error(`Company with ticker ${input.ticker} already exists`);
  }
  
  // Écrire sur S3 (pas Supabase!)
  const { id, s3Key } = await insertRowS3('companies', {
    ticker: input.ticker.toUpperCase(),
    cik: input.cik,
    name: input.name,
    sector: input.sector,
    industry: input.industry,
    market_cap: input.market_cap,
    headquarters_country: input.headquarters_country,
    headquarters_state: input.headquarters_state,
  });
  
  return {
    id,
    ticker: input.ticker,
    s3Key, // Pour debug/tracking
    message: "Company created on S3",
  };
}
```

## 📋 Checklist de Migration

### Phase 1: Services Helper ✅
- [x] Créer `athena/query.ts` (helper générique)
- [x] Créer `athena/companies.ts` (requêtes companies)
- [ ] Créer `athena/funds.ts` (requêtes funds)
- [ ] Créer `athena/fund_filings.ts` (requêtes fund_filings)
- [ ] Créer `athena/fund_holdings_diff.ts` (requêtes diffs)

### Phase 2: Migrations Simples
- [x] `getCompanyByTicker()` → Athena
- [ ] `getCompanies()` → Athena
- [ ] `getCompany(id)` → Athena
- [ ] `getFunds()` → Athena
- [ ] `getFund(id)` → Athena

### Phase 3: Migrations Complexes
- [ ] `getFundDiffs()` → Athena (avec JOINs)
- [ ] `getFundTickerDiffs()` → Athena
- [ ] `getAllFundsRecentChanges()` → Athena
- [ ] `getTickerFundsChanges()` → Athena
- [ ] `getMarketPulse()` → Athena

### Phase 4: Tests & Validation
- [ ] Tests unitaires pour chaque fonction migrée
- [ ] Tests d'intégration avec données réelles
- [ ] Comparaison performances Athena vs Supabase
- [ ] Validation des résultats (même données)

### Phase 5: Déploiement
- [ ] Activer `USE_ATHENA=true` en staging
- [ ] Monitorer les erreurs et latences
- [ ] Activer en production
- [ ] Désactiver Supabase pour les tables migrées (optionnel)

## 💡 Notes Importantes

1. **Architecture Extreme Budget**: **TOUT** doit quitter Supabase
   - **Lectures**: Athena (depuis S3 Parquet) OU S3 direct read (pour lookups simples)
   - **Écritures**: Directement sur S3 en Parquet (via `athena/write.ts`)
   - **Pas de Supabase**: On migre complètement vers S3 + Athena

2. **Écritures sur S3**:
   - Utiliser `insertRowS3()` ou `insertRowsS3()` pour écrire sur S3
   - Les données sont écrites en Parquet avec partitionnement automatique (year/month)
   - Athena détecte automatiquement les nouveaux fichiers (pas besoin de MSCK REPAIR immédiatement)

3. **Optimisations Performance & Coût** ⭐ **CRITIQUE**

   **a) Cache Local Lambda**:
   - Utiliser `withCache()` pour les requêtes fréquentes
   - TTL de 5 minutes pour les petites tables (companies, funds)
   - Évite les requêtes Athena répétées pour les mêmes données
   - Exemple: `getCompanyByTicker('AAPL')` ne relance pas Athena si déjà en cache

   **b) S3 Direct Read pour Lookups Simples**:
   - **NE PAS utiliser Athena** pour récupérer 1 ligne par ID
   - Athena facture un minimum de 10MB par requête, même pour 1KB
   - Utiliser `findRowByIdInS3Parquet()` pour les lookups par ID
   - Plus rapide ET moins cher que Athena pour single-row lookups
   - Exemple: `getCompany(id)` → S3 direct read, pas Athena

   **c) Athena pour Requêtes Analytiques Seulement**:
   - Utiliser Athena pour: aggregations, JOINs, GROUP BY, filtres complexes
   - Ne PAS utiliser Athena pour: single-row lookups, petites tables (< 100 rows)

4. **Latence**: 
   - Athena: 5-30s pour requêtes complexes (acceptable pour analytics)
   - S3 direct read: < 1s pour lookups simples (meilleur UX)
   - Cache: < 1ms (instantané)

5. **Coûts**: 
   - Athena: ~$5/TB scanné, minimum 10MB par requête
   - S3 direct read: ~$0.0004/1000 requêtes (négligeable)
   - Optimisation: Utiliser S3 direct read + cache pour éviter les requêtes Athena inutiles

6. **IDs**: Les IDs sont générés localement (timestamp + compteur) car pas de séquence DB

7. **WorkGroup Athena**: Utiliser `adel-ai-dev-workgroup` pour isoler les coûts et limites

## 🔍 Requêtes de Test

```sql
-- Test companies
SELECT COUNT(*) FROM companies;
SELECT * FROM companies WHERE ticker = 'AAPL' LIMIT 1;

-- Test funds
SELECT COUNT(*) FROM funds;
SELECT * FROM funds LIMIT 10;

-- Test fund_filings
SELECT COUNT(*) FROM fund_filings;
SELECT * FROM fund_filings ORDER BY filing_date DESC LIMIT 10;

-- Test fund_holdings_diff
SELECT COUNT(*) FROM fund_holdings_diff;
SELECT * FROM fund_holdings_diff ORDER BY created_at DESC LIMIT 10;

-- Test JOINs
SELECT 
  fhd.*,
  ff_new.filing_date as new_filing_date,
  ff_old.filing_date as old_filing_date
FROM fund_holdings_diff fhd
LEFT JOIN fund_filings ff_new ON fhd.filing_id_new = ff_new.id
LEFT JOIN fund_filings ff_old ON fhd.filing_id_old = ff_old.id
LIMIT 10;
```

## 📚 Ressources

- [Documentation Athena](https://docs.aws.amazon.com/athena/)
- [Guide Migration Extreme Budget](./EXTREME_BUDGET_MIGRATION_GUIDE.md)
- [Architecture S3 + Athena](./MIGRATION_SUPABASE_TO_AWS.md)
