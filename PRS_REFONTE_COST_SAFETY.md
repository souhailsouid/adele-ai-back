# 🎯 PRs CIBLÉS - Refonte Architecture Cost Safety

## 📋 Vue d'ensemble

6 PRs pour rendre l'architecture **impossible à casser** côté coûts S3.

---

## **PR #1: CI Guard + Runtime Guard** 🔒 PRIORITÉ 1

### Fichiers
- ✅ `.eslintrc.js` (créé)
- ✅ `services/api/src/athena/s3-direct-read.ts` (runtime guard déjà fait)

### Actions
1. Installer ESLint:
   ```bash
   npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
   ```

2. Ajouter script lint dans `package.json`:
   ```json
   "scripts": {
     "lint": "eslint . --ext .ts,.tsx"
   }
   ```

3. Intégrer dans CI (GitHub Actions ou équivalent):
   ```yaml
   - run: npm run lint
   - run: |
       if grep -r "s3-direct-read" services/ workers/ --exclude-dir=node_modules; then
         echo "❌ FORBIDDEN: s3-direct-read import found"
         exit 1
       fi
   ```

### Test
```bash
# Doit fail
echo "import { findRowByIdInS3Parquet } from './athena/s3-direct-read';" > services/api/src/test.ts
npm run lint
# Expected: ESLint error
```

---

## **PR #2: Index DynamoDB** 🗄️ PRIORITÉ 1

### Fichiers
- ✅ `infra/terraform/dynamodb-indexes.tf` (créé)
- ✅ `services/api/src/athena/lookup-index.service.ts` (créé)

### Actions

1. **Déployer DynamoDB table**:
   ```bash
   cd infra/terraform
   terraform plan -target=aws_dynamodb_table.lookup_index
   terraform apply -target=aws_dynamodb_table.lookup_index
   ```

2. **Ajouter variable d'environnement** dans les Lambdas:
   ```terraform
   environment {
     variables = {
       LOOKUP_INDEX_TABLE = aws_dynamodb_table.lookup_index.name
     }
   }
   ```

3. **Intégrer dans writers**:
   - Modifier `services/api/src/athena/write.ts`:
     ```typescript
     import { putLookup } from './lookup-index.service';
     
     // Après insertion company
     await putLookup(company.ticker, 'ticker->company', company.id);
     await putLookup(company.cik, 'cik->company', company.id);
     
     // Après insertion filing
     await putLookup(filing.accession_number, 'accession->filing', filing.id);
     ```

4. **Migrer API endpoints**:
   - Modifier `services/api/src/athena/companies.ts`:
     ```typescript
     import { getLookup } from './lookup-index.service';
     
     export async function getCompanyByIdAthena(id: number): Promise<Company | null> {
       return withCache(
         CacheKeys.companyById(id),
         async () => {
           // 1. Essayer DynamoDB index d'abord (ultra rapide)
           const companyId = await getLookup(String(id), 'company_id->ticker');
           if (companyId) {
             // Récupérer depuis Athena avec l'ID
             return await executeAthenaQuerySingle(`SELECT * FROM companies WHERE id = ${id} LIMIT 1`);
           }
           
           // 2. Fallback Athena direct (si index non disponible)
           return await executeAthenaQuerySingle(`SELECT * FROM companies WHERE id = ${id} LIMIT 1`);
         },
         5 * 60 * 1000
       );
     }
     ```

### Coût DynamoDB
- **PAY_PER_REQUEST**: $0.25 par million de requêtes
- **vs S3 GET**: $420 par million (1680x plus cher!)
- **Économie**: ~$28/jour

---

## **PR #3: Optimisation Scripts Batch** ⚡ PRIORITÉ 2

### Fichiers
- ✅ `workers/sec-smart-money-sync/src/index.ts` (modifié avec batch queries)

### Changements appliqués
- ✅ `processInsiderFilingsBatch()` - Traite tous les filings en batch
- ✅ 1 requête batch pour tous les CIKs uniques (au lieu de N requêtes)
- ✅ 1 requête batch pour de-dup (au lieu de N requêtes)

### Impact
- **Avant**: 2000 filings × 1 requête = 2000 requêtes Athena
- **Après**: 2000 filings = 2 requêtes Athena (1 pour CIKs, 1 pour de-dup)
- **Réduction**: 99.9% de requêtes Athena

---

## **PR #4: Vérification Partitions S3** ✅ PRIORITÉ 2

### Fichiers
- ✅ `scripts/verify_s3_partitions.ts` (créé)

### Actions
1. **Exécuter le script**:
   ```bash
   npx tsx scripts/verify_s3_partitions.ts
   ```

2. **Corriger partitions invalides** si nécessaire

3. **Documenter structure** dans `REFONTE_ARCHITECTURE_COST_SAFETY.md`

### Structure attendue
```
data/
  insider_trades/
    year=2025/
      month=1/
        batch_*.parquet
  company_financials/
    year=2025/
      month=1/
        batch_*.parquet
  transaction_alerts/
    year=2025/
      month=1/
        batch_*.parquet
```

---

## **PR #5: Top 100 Companies View** 📊 PRIORITÉ 2

### Fichiers
- ✅ `infra/athena/ddl/create_top_companies_view.sql` (créé)

### Actions
1. **Créer la vue dans Athena**:
   ```bash
   # Exécuter le SQL dans Athena Console
   cat infra/athena/ddl/create_top_companies_view.sql
   ```

2. **Modifier worker**:
   ```typescript
   // Dans workers/sec-smart-money-sync/src/index.ts
   async function getTopCompanies(limit: number = 100): Promise<any[]> {
     const query = `
       SELECT 
         id, ticker, cik, name, sector, industry, market_cap, rank
       FROM top_companies
       ORDER BY rank
       LIMIT ${limit}
     `;
     return await executeAthenaQuery(query);
   }
   ```

### Avantages
- ✅ Pas besoin de scanner toutes les companies
- ✅ Performance optimale (LIMIT 100)
- ✅ Rank disponible pour tri

---

## **PR #6: De-dup Automatique** 🔄 PRIORITÉ 1

### Fichiers
- ✅ `services/api/src/athena/write-with-dedup.ts` (créé)

### Actions
1. **Intégrer dans form4-parser**:
   ```typescript
   // Dans workers/form4-parser/src/index.ts
   import { insertFilingS3WithDedup } from '../../services/api/src/athena/write-with-dedup';
   
   // Avant insertion
   const result = await insertFilingS3WithDedup({
     company_cik: companyCik,
     form_type: '4',
     accession_number: accessionNumber,
     filing_date: filingDate,
   });
   
   if (!result.created) {
     console.log(`[De-dup] Filing ${accessionNumber} already exists, skipping`);
     return;
   }
   ```

2. **Intégrer dans sec-smart-money-sync**:
   - Déjà fait dans `processInsiderFilingsBatch()` ✅

### Garanties
- ✅ Accession number = clé unique
- ✅ Pas de double insert possible
- ✅ Compatible intraday (même si CRON tourne plusieurs fois)

---

## 📊 ARCHITECTURE FINALE

```
┌─────────────────────────────────────────┐
│ RAW (S3)                                 │
│ - raw/submissions/{cik}.json             │
│ - raw/filings/{accession}.xml            │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ CURATED (S3 Parquet Partitionné)        │
│ - curated/insider_trades/year/month/     │
│ - curated/company_financials/year/month│
│ - curated/transaction_alerts/year/month│
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ INDEX (DynamoDB PAY_PER_REQUEST)        │
│ - ticker -> company_id                   │
│ - cik -> company_id                      │
│ - accession_number -> filing_id         │
└─────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ QUERY (Athena)                          │
│ - Requêtes analytiques uniquement       │
│ - Pas de lookups unitaires              │
└─────────────────────────────────────────┘
```

---

## ✅ CHECKLIST DÉPLOIEMENT

### Phase 1: Sécurité (PR #1)
- [ ] Installer ESLint
- [ ] Tester que ESLint fail sur import interdit
- [ ] Intégrer dans CI
- [ ] Vérifier runtime guard actif

### Phase 2: Index DynamoDB (PR #2)
- [ ] Déployer table DynamoDB
- [ ] Ajouter variable d'environnement LOOKUP_INDEX_TABLE
- [ ] Intégrer `putLookup()` dans tous les writers
- [ ] Migrer API endpoints vers `getLookup()` avec fallback Athena

### Phase 3: Optimisation (PR #3, #5)
- [ ] Vérifier que batch queries fonctionnent
- [ ] Créer vue `top_companies` dans Athena
- [ ] Modifier worker pour utiliser la vue

### Phase 4: De-dup (PR #6)
- [ ] Intégrer `insertFilingS3WithDedup()` dans form4-parser
- [ ] Tester qu'aucun double insert n'est possible
- [ ] Vérifier avec CRON intraday (si activé)

### Phase 5: Vérification (PR #4)
- [ ] Exécuter `verify_s3_partitions.ts`
- [ ] Corriger partitions invalides si nécessaire

---

## 🎯 RÉSULTAT ATTENDU

✅ **Plus aucun chemin qui puisse produire des millions de GET/LIST**
- CI Guard bloque les imports interdits
- Runtime guard bloque l'exécution en prod
- Index DynamoDB remplace tous les lookups S3

✅ **Workflows stables**
- Raw → Curated → Query/Index
- Partitions bien structurées
- De-dup automatique

✅ **Scripts batch efficaces**
- Batch queries (IN/JOIN) au lieu de N requêtes unitaires
- Cache in-memory pour éviter répétitions
- Monitoring des requêtes Athena

✅ **Option intraday possible**
- De-dup par accession_number = clé unique
- Index DynamoDB pour lookups rapides
- Coûts maîtrisés (pas de S3 GET, DynamoDB PAY_PER_REQUEST)

---

## 📝 NOTES IMPORTANTES

1. **Migration progressive**: L'index DynamoDB peut être peuplé progressivement
2. **Pas de downtime**: Le système fonctionne avec ou sans index DynamoDB
3. **Monitoring**: Ajouter CloudWatch metrics pour tracker requêtes DynamoDB/Athena
4. **Coût DynamoDB**: $0.25/M req vs $420/M pour S3 GET (1680x moins cher)
