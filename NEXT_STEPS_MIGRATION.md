# 🎯 Prochaines Étapes - Migration Extreme Budget

## 📊 État Actuel

✅ **Complété:**
- Tables migrées vers S3 (5 tables, 687K+ rows)
- Tables Athena créées et vérifiées
- Services de base créés (query, companies, write, cache, s3-direct-read)
- Optimisations implémentées (cache, S3 direct read)
- Documentation complète

## 🚀 Plan d'Action Priorisé

### Phase 1: Tests & Validation (1-2 jours)

#### 1.1 Tester les Services Créés
```bash
# Tester le cache
npx tsx scripts/test_athena_cache.ts

# Tester S3 direct read
npx tsx scripts/test_s3_direct_read.ts

# Tester getCompanyByTicker avec optimisations
npx tsx scripts/test_company_lookup.ts
```

**À créer:**
- `scripts/test_athena_cache.ts` - Tester le cache local
- `scripts/test_s3_direct_read.ts` - Tester la lecture directe S3
- `scripts/test_company_lookup.ts` - Tester getCompanyByTicker optimisé

#### 1.2 Comparer Performance & Coût
```bash
# Comparer Supabase vs Athena vs S3 direct read
npx tsx scripts/benchmark_queries.ts
```

**Métriques à mesurer:**
- Latence (ms)
- Coût estimé par requête
- Taux de succès

### Phase 2: Migration Fonctions Simples (2-3 jours)

#### 2.1 Companies (Priorité Haute)
- [ ] `getCompanies()` - Lister toutes les entreprises
  - Utiliser Athena avec cache
  - Limiter à 1000 résultats par défaut
  
- [ ] `getCompany(id)` - Obtenir par ID
  - Utiliser `getCompanyByIdAthena()` (S3 direct read)
  - Déjà créé, juste à intégrer

- [ ] `getCompanyFilings()` - Filings d'une entreprise
  - Utiliser Athena avec partition filtering (year/month)

#### 2.2 Funds (Priorité Haute)
- [ ] Créer `services/api/src/athena/funds.ts`
  - `getFundByIdAthena()` - S3 direct read
  - `getFundByCikAthena()` - S3 direct read + cache
  - `getFundsAthena()` - Athena avec cache

- [ ] Migrer `getFunds()` dans `services/api/src/funds.ts`
- [ ] Migrer `getFund(id)` dans `services/api/src/funds.ts`

#### 2.3 Fund Filings (Priorité Moyenne)
- [ ] Créer `services/api/src/athena/fund_filings.ts`
- [ ] Migrer `getFundFilings()` avec partition filtering

### Phase 3: Migration Fonctions Complexes (3-5 jours)

#### 3.1 Fund Diffs (Priorité Haute - Utilisé partout)
- [ ] Créer `services/api/src/athena/fund_holdings_diff.ts`
- [ ] Migrer `getFundDiffs()` avec JOINs Athena
- [ ] Migrer `getFundTickerDiffs()`
- [ ] Migrer `getAllFundsRecentChanges()`

**Requête exemple:**
```sql
SELECT 
  fhd.*,
  ff_new.filing_date as new_filing_date,
  ff_old.filing_date as old_filing_date
FROM fund_holdings_diff fhd
LEFT JOIN fund_filings ff_new ON fhd.filing_id_new = ff_new.id
LEFT JOIN fund_filings ff_old ON fhd.filing_id_old = ff_old.id
WHERE fhd.fund_id = ${fundId}
ORDER BY fhd.created_at DESC
LIMIT ${limit}
```

#### 3.2 Market Pulse (Priorité Moyenne)
- [ ] Migrer `getTickerFundsChanges()` dans `market-pulse.service.ts`
- [ ] Migrer `getMarketPulse()`
- [ ] Migrer `getPulseFeed()`

#### 3.3 Strategic Analysis (Priorité Moyenne)
- [ ] Migrer `getTickersSectorsBatch()` pour utiliser Athena
- [ ] Optimiser avec cache pour secteurs fréquents

### Phase 4: Écritures S3 (2-3 jours)

#### 4.1 Migrer createCompany
- [x] Déjà fait avec fallback Supabase
- [ ] Tester en conditions réelles
- [ ] Activer `USE_S3_WRITES=true` en staging

#### 4.2 Migrer createFund
- [ ] Modifier `createFund()` pour utiliser `insertRowS3()`
- [ ] Tester

#### 4.3 Migrer Autres Écritures
- [ ] Filings creation (fund_filings, company_filings)
- [ ] Holdings diffs creation

### Phase 5: Activation Progressive (1 semaine)

#### 5.1 Staging
```bash
# Activer progressivement
export USE_ATHENA=true
export USE_S3_WRITES=false  # D'abord tester les lectures

# Tester toutes les routes
npm run test:api

# Activer les écritures
export USE_S3_WRITES=true
```

#### 5.2 Monitoring
- [ ] Surveiller les latences (CloudWatch)
- [ ] Surveiller les coûts Athena (AWS Cost Explorer)
- [ ] Surveiller les erreurs (CloudWatch Logs)

#### 5.3 Production
- [ ] Activer `USE_ATHENA=true` en production
- [ ] Monitorer 24-48h
- [ ] Activer `USE_S3_WRITES=true` en production
- [ ] Désactiver Supabase progressivement

### Phase 6: Nettoyage (1 jour)

#### 6.1 Supprimer Fallbacks Supabase
- [ ] Retirer les fallbacks Supabase des fonctions migrées
- [ ] Nettoyer les imports inutilisés

#### 6.2 Documentation Finale
- [ ] Mettre à jour README avec nouvelle architecture
- [ ] Documenter les patterns dans `.cursorrules`
- [ ] Créer guide de troubleshooting

## 🎯 Actions Immédiates (Aujourd'hui)

### 1. Créer les Scripts de Test
```bash
# Créer scripts/test_athena_cache.ts
# Créer scripts/test_s3_direct_read.ts
# Créer scripts/test_company_lookup.ts
```

### 2. Tester getCompanyByTicker
```bash
# Activer Athena
export USE_ATHENA=true

# Tester via API
curl https://api.personamy.com/companies/ticker/AAPL
```

### 3. Créer athena/funds.ts
- Implémenter les fonctions de base
- Tester avec les funds existants

## 📋 Checklist Rapide

- [ ] Créer scripts de test
- [ ] Tester cache + S3 direct read
- [ ] Créer athena/funds.ts
- [ ] Migrer getFunds() et getFund(id)
- [ ] Tester en staging
- [ ] Activer USE_ATHENA en production
- [ ] Monitorer 24-48h
- [ ] Activer USE_S3_WRITES
- [ ] Nettoyer fallbacks Supabase

## 💡 Conseils

1. **Tester d'abord**: Ne pas activer en production sans tests
2. **Activer progressivement**: D'abord lectures, puis écritures
3. **Monitorer**: Surveiller coûts et latences
4. **Fallback**: Garder Supabase actif pendant la transition
5. **Documentation**: Mettre à jour au fur et à mesure

## 🚨 Points d'Attention

1. **IDs générés localement**: Vérifier qu'il n'y a pas de collisions
2. **Cache invalidation**: Gérer l'invalidation si données mises à jour
3. **Partitions**: S'assurer que les partitions sont correctes pour Athena
4. **Latence**: Accepter 5-30s pour requêtes complexes (analytics)
5. **Coûts**: Monitorer les coûts Athena (peut être cher si mal optimisé)
