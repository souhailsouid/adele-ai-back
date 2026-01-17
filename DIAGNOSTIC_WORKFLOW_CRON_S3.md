# 🔍 DIAGNOSTIC - Workflow CRON & Risque S3

## 📊 Analyse du Workflow CRON

### ✅ **BONNE NOUVELLE**: Le worker Lambda n'utilise PAS `s3-direct-read`

Le worker `sec-smart-money-sync` utilise **uniquement Athena** directement :
- ✅ `getCompaniesAthena()` → Requête Athena directe (pas de S3 GET)
- ✅ `processInsiderFiling()` → Requête Athena directe pour lookup company par CIK (ligne 585-591)
- ✅ Pas d'import de `s3-direct-read.ts`

---

## ⚠️ **MAIS**: Risque d'Explosion de Requêtes Athena

### CRON Quotidien (`syncInsiderTransactions`)

**Fonction**: Ligne 241-290
```typescript
// 1. Récupère 100 companies (1 requête Athena)
const companies = await getCompaniesAthena(100, 0);

// 2. Pour chaque company:
for (const company of companies) {
  // - 1 requête SEC API pour découvrir les filings
  const newFilings = await discoverNewForm4Filings(company.cik, lastModified);
  
  // - Pour chaque filing découvert:
  for (const filing of newFilings) {
    // - 1 requête Athena pour vérifier si filing existe (ligne 397-404)
    await processForm4Filing(company.id, company.cik, filing);
  }
}
```

**Estimation**:
- 100 companies × 1 requête SEC API = **100 requêtes SEC**
- Si 10 filings par company = 1000 filings
- 1000 filings × 1 requête Athena = **1000 requêtes Athena**
- **Total**: ~1000 requêtes Athena/jour ✅ **RAISONNABLE**

---

### CRON Hebdomadaire (`syncInsiderCrossCompany`)

**Fonction**: Ligne 471-523
```typescript
// 1. Récupère 100 dirigeants uniques (1 requête Athena)
const insiderCiks = await executeAthenaQuery(query); // LIMIT 100

// 2. Pour chaque dirigeant:
for (const insiderCik of insiderCiks) {
  // - 1 requête SEC API pour découvrir les filings
  const filings = await discoverInsiderFilings(insiderCik);
  
  // - Pour chaque filing:
  for (const filing of filings) {
    // ⚠️ PROBLÈME ICI: 1 requête Athena par filing pour lookup company (ligne 585-591)
    await processInsiderFiling(insiderCik, filing);
  }
}
```

**Estimation**:
- 100 dirigeants × 1 requête SEC API = **100 requêtes SEC**
- Si 20 filings par dirigeant = 2000 filings
- **2000 filings × 1 requête Athena = 2000 requêtes Athena/semaine**
- **Total**: ~286 requêtes Athena/jour ✅ **RAISONNABLE**

---

## 🚨 **PROBLÈME IDENTIFIÉ**: Lookups Company Non Optimisés

### Dans `processInsiderFiling()` (ligne 585-591)

```typescript
// ⚠️ MAUVAIS: Requête Athena unitaire pour chaque filing
const companyQuery = `
  SELECT id
  FROM companies
  WHERE cik = '${companyCik}'
  LIMIT 1
`;
const companies = await executeAthenaQuery(companyQuery);
```

**Problème**: Si on a 2000 filings avec 1000 CIKs uniques, ça fait **1000 requêtes Athena** pour le lookup company.

**Solution**: Batch query avec `WHERE cik IN (...)`

---

## 💥 **CAUSE RACINE DES 43M REQUÊTES S3**

### Hypothèse 1: API Frontend appelée en boucle

Si le frontend appelle l'API fréquemment et que l'API utilise encore l'ancien code avec `s3-direct-read`, ça expliquerait les 146k lookups/jour.

**Vérification**: Les corrections API sont déjà déployées ✅

### Hypothèse 2: Scripts locaux exécutés en boucle

Si des scripts locaux sont exécutés en boucle (tests, dev), ils pourraient générer des milliers de requêtes.

**Vérification**: `sync_sec_smart_money.ts` corrigé ✅

### Hypothèse 3: Worker Lambda ancien code

Si le worker Lambda `sec-smart-money-sync` était déployé avec l'ancien code qui utilisait `s3-direct-read`, chaque exécution CRON générerait des milliers de requêtes.

**Vérification**: Le worker utilise Athena directement ✅

### Hypothèse 4: API Endpoints appelés massivement

Si les endpoints API (`/companies/{id}`, `/funds/{cik}`, etc.) sont appelés massivement (scraping, polling, etc.), même avec le nouveau code, les requêtes répétées peuvent s'accumuler.

**Analyse**: 
- Cache Lambda 5 min → Limite les requêtes répétées
- Mais si 146k appels uniques/jour, le cache ne sert à rien

---

## 🔧 **CORRECTIONS NÉCESSAIRES**

### 1. ✅ Optimiser `processInsiderFiling()` avec Batch Query

**AVANT** (actuel):
```typescript
// Ligne 585-591: Requête unitaire
const companyQuery = `
  SELECT id
  FROM companies
  WHERE cik = '${companyCik}'
  LIMIT 1
`;
```

**APRÈS** (optimisé):
```typescript
// Collecter tous les CIKs uniques d'abord
const uniqueCiks = new Set(filings.map(f => extractCikFromAccession(f.accessionNumber)));

// 1 seule requête batch
const companyQuery = `
  SELECT id, cik
  FROM companies
  WHERE cik IN (${Array.from(uniqueCiks).map(cik => `'${cik}'`).join(', ')})
`;
const companies = await executeAthenaQuery(companyQuery);
const cikToIdMap = new Map(companies.map(row => [row[1], row[0]]));

// Utiliser le Map pour les lookups
const companyId = cikToIdMap.get(companyCik);
```

### 2. ✅ Ajouter Cache Map dans Worker Lambda

```typescript
// Cache in-memory pour éviter requêtes répétées dans la même exécution
const companyCache = new Map<string, number>();

async function getCompanyIdByCik(cik: string): Promise<number | null> {
  if (companyCache.has(cik)) {
    return companyCache.get(cik)!;
  }
  
  // ... requête Athena ...
  
  if (companyId) {
    companyCache.set(cik, companyId);
  }
  
  return companyId;
}
```

### 3. ✅ Monitoring des Requêtes Athena

Ajouter des logs pour tracker le nombre de requêtes Athena par exécution CRON :
```typescript
let athenaQueryCount = 0;

async function executeAthenaQuery(query: string): Promise<any[]> {
  athenaQueryCount++;
  console.log(`[Athena Query #${athenaQueryCount}] ${query.substring(0, 100)}...`);
  // ...
}
```

---

## 📋 **CHECKLIST VÉRIFICATION**

- [x] ✅ Worker Lambda n'utilise pas `s3-direct-read`
- [x] ✅ Script `sync_sec_smart_money.ts` corrigé
- [x] ✅ API corrigée et déployée
- [ ] ⚠️ **TODO**: Optimiser `processInsiderFiling()` avec batch query
- [ ] ⚠️ **TODO**: Ajouter cache Map dans worker Lambda
- [ ] ⚠️ **TODO**: Monitoring des requêtes Athena

---

## 🎯 **CONCLUSION**

Le workflow CRON lui-même n'est **probablement PAS** la cause directe des 43M requêtes S3, MAIS :

1. **Les corrections API** sont déjà déployées → Les requêtes S3 devraient chuter
2. **Le worker Lambda** utilise Athena directement → Pas de problème S3
3. **Optimisation recommandée**: Batch queries dans `processInsiderFiling()` pour réduire les requêtes Athena

**Action immédiate**: 
- Surveiller les métriques S3 sur 24-48h pour confirmer la baisse
- Si les requêtes S3 continuent, vérifier les logs CloudWatch pour identifier la source
