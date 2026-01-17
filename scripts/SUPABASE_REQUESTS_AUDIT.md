# 🔍 Audit: Requêtes Supabase (5435 requêtes)

## Problème identifié

**5435 requêtes REST Supabase** détectées dans les dernières 60 minutes.

## Scripts suspects

### 1. `scripts/enrich_companies_from_sec_parallel.ts` ⚠️ CRITIQUE

**Problème** : 2 requêtes Supabase par company dans une boucle

```typescript
// Ligne 416-420: 1 requête par company
const { data: existingCompany } = await supabase
  .from('companies')
  .select('ein')
  .eq('cik', company.cik)
  .maybeSingle();

// Ligne 422-425: 1 requête par company
const { count: filingsCount } = await supabase
  .from('company_filings')
  .select('id', { count: 'exact', head: true })
  .eq('cik', company.cik);
```

**Impact** :
- Si exécuté sur **~2700 companies** = **5400 requêtes** (2700 × 2)
- + overhead = **5435 requêtes** ✅ **MATCH**

**Solution** : Optimiser avec batch queries

```typescript
// ✅ OPTIMISÉ: 1 requête batch pour toutes les companies
const ciks = workerCompanies.map(c => c.cik);
const { data: existingCompanies } = await supabase
  .from('companies')
  .select('cik, ein')
  .in('cik', ciks);

const existingMap = new Map(
  existingCompanies?.map(c => [c.cik, c.ein]) || []
);

// ✅ OPTIMISÉ: 1 requête batch pour compter les filings
const { data: filingsCounts } = await supabase
  .from('company_filings')
  .select('cik')
  .in('cik', ciks);

const filingsCountMap = new Map<string, number>();
for (const filing of filingsCounts || []) {
  filingsCountMap.set(filing.cik, (filingsCountMap.get(filing.cik) || 0) + 1);
}

// Ensuite, utiliser les maps dans la boucle
for (const company of workerCompanies) {
  const ein = existingMap.get(company.cik);
  const count = filingsCountMap.get(company.cik) || 0;
  
  if (ein || count >= 10) {
    // Skip
    continue;
  }
  // ...
}
```

---

### 2. `scripts/enrich_companies_from_sec.ts` ⚠️ CRITIQUE

**Problème** : Même pattern que `enrich_companies_from_sec_parallel.ts`

**Solution** : Même optimisation batch

---

### 3. `scripts/check_company_id_in_filings.ts` ⚠️ MOYEN

**Problème** : Boucle avec requêtes Supabase

```typescript
// Ligne 98-100: 1 requête par company
const { count: filingsCount } = await supabase
  .from('company_filings')
  .select('*', { count: 'exact', head: true })
  .eq('cik', company.cik);
```

**Impact** : Si exécuté sur 100+ companies = 100+ requêtes

**Solution** : Batch query avec `IN`

---

### 4. `scripts/verify_filings_reality.ts` ⚠️ MOYEN

**Problème** : Boucle avec requêtes Supabase

```typescript
// Ligne 112-114: 1 requête par company
const { count: filingsCount } = await supabase
  .from('company_filings')
  .select('*', { count: 'exact', head: true })
  .eq('cik', company.cik);
```

**Impact** : Si exécuté sur 100+ companies = 100+ requêtes

**Solution** : Batch query avec `IN`

---

## Solutions immédiates

### Option 1 : Optimiser les scripts (recommandé)

Modifier `enrich_companies_from_sec_parallel.ts` et `enrich_companies_from_sec.ts` pour utiliser des batch queries.

### Option 2 : Désactiver les scripts (temporaire)

Si les scripts ne sont pas nécessaires immédiatement, les désactiver ou les supprimer.

### Option 3 : Limiter l'exécution

Ajouter une limite au nombre de companies traitées :

```typescript
const MAX_COMPANIES = 100; // Limiter à 100 companies max
const workerCompanies = companiesToEnrich.slice(start, end).slice(0, MAX_COMPANIES);
```

---

## Monitoring

### Vérifier les requêtes Supabase

**Dashboard Supabase** :
- Database → Statistics → REST Requests
- Filtrer par période (dernières 60 minutes)

**CloudWatch** (si configuré) :
- Métriques custom pour les appels Supabase

---

## Prévention

### Règles à suivre

1. **Jamais de requêtes Supabase dans une boucle**
   - Utiliser `IN` pour batch queries
   - Utiliser `Map` pour lookups en mémoire

2. **Limiter le nombre d'items traités**
   - Ajouter `LIMIT` dans les requêtes
   - Traiter par batch de 100-1000 items

3. **Utiliser des caches**
   - Cache en mémoire pour les lookups fréquents
   - DynamoDB pour les lookups cross-Lambda

4. **Monitoring**
   - Vérifier régulièrement les statistiques Supabase
   - Alertes si > 1000 requêtes/heure

---

## Checklist de correction

- [ ] Optimiser `enrich_companies_from_sec_parallel.ts` (batch queries)
- [ ] Optimiser `enrich_companies_from_sec.ts` (batch queries)
- [ ] Optimiser `check_company_id_in_filings.ts` (batch queries)
- [ ] Optimiser `verify_filings_reality.ts` (batch queries)
- [ ] Ajouter des limites (MAX_COMPANIES) dans les scripts
- [ ] Tester les scripts optimisés
- [ ] Monitorer les requêtes Supabase après correction

---

**Dernière mise à jour** : 2025-01-XX
