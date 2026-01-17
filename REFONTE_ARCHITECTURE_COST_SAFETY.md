# 🏗️ REFONTE ARCHITECTURE - Cost Safety & Scalabilité

## 🎯 Objectif

Rendre l'architecture **impossible à casser** côté coûts S3, avec séparation claire des niveaux et index de lookup.

---

## 📋 PLAN D'EXÉCUTION

### **PR #1: CI Guard + Runtime Guard** ✅ PRIORITÉ 1

#### A. ESLint Rule pour interdire `s3-direct-read`

**Fichier**: `.eslintrc.js` (à créer)

```javascript
module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '../athena/s3-direct-read',
            message: 's3-direct-read is FORBIDDEN in production code (cost safety). Use Athena with cache or DynamoDB index instead. Only allowed in dev-tools/ scripts.',
            allowTypeImports: false,
          },
          {
            name: '@/athena/s3-direct-read',
            message: 's3-direct-read is FORBIDDEN in production code (cost safety).',
            allowTypeImports: false,
          },
        ],
        patterns: [
          {
            group: ['**/athena/s3-direct-read'],
            message: 's3-direct-read is FORBIDDEN in production code (cost safety).',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // Exception: scripts dans dev-tools/ peuvent utiliser s3-direct-read
      files: ['dev-tools/**/*.ts', 'scripts/test_*.ts', 'scripts/migrate_*.ts'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
  ],
};
```

**Action**: Créer `.eslintrc.js` à la racine du projet

#### B. Runtime Guard (déjà fait ✅)

Le fichier `s3-direct-read.ts` throw déjà en prod. Vérifier qu'il est bien actif.

#### C. CI Script

**Fichier**: `.github/workflows/lint-cost-safety.yml` (ou intégrer dans CI existant)

```yaml
name: Cost Safety Lint
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run lint
      - run: |
          # Vérifier qu'aucun import s3-direct-read dans le code de prod
          if grep -r "s3-direct-read" services/ workers/ --exclude-dir=node_modules; then
            echo "❌ FORBIDDEN: s3-direct-read import found in production code"
            exit 1
          fi
```

---

### **PR #2: Index DynamoDB pour Lookups** ✅ PRIORITÉ 1

#### A. Table DynamoDB

**Fichier**: `infra/terraform/dynamodb-indexes.tf` (nouveau)

```terraform
# Index de lookup pour éviter requêtes Athena unitaires
resource "aws_dynamodb_table" "lookup_index" {
  name         = "${var.project}-${var.stage}-lookup-index"
  billing_mode = "PAY_PER_REQUEST"  # Extreme Budget
  hash_key     = "lookup_key"
  range_key    = "lookup_type"

  attribute {
    name = "lookup_key"
    type = "S"
  }

  attribute {
    name = "lookup_type"
    type = "S"
  }

  # GSI pour reverse lookup (id -> ticker/cik)
  global_secondary_index {
    name     = "id-index"
    hash_key = "entity_id"
    range_key = "lookup_type"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = false  # Pas de TTL pour l'instant
  }

  tags = {
    Name        = "Lookup Index"
    Environment = var.stage
  }
}
```

#### B. Service de Lookup

**Fichier**: `services/api/src/athena/lookup-index.service.ts` (nouveau)

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient());
const LOOKUP_TABLE = process.env.LOOKUP_INDEX_TABLE || 'adel-ai-dev-lookup-index';

type LookupType = 'ticker->company' | 'cik->company' | 'accession->filing' | 'cusip->ticker';

interface LookupEntry {
  lookup_key: string;      // ticker, cik, accession_number, cusip
  lookup_type: LookupType;
  entity_id: number;       // company_id, filing_id
  metadata?: Record<string, any>;
  updated_at: string;
}

/**
 * Récupérer un lookup depuis DynamoDB (ultra rapide, pas de S3 GET)
 */
export async function getLookup(
  key: string,
  type: LookupType
): Promise<number | null> {
  try {
    const result = await dynamoClient.send(new GetCommand({
      TableName: LOOKUP_TABLE,
      Key: {
        lookup_key: key,
        lookup_type: type,
      },
    }));

    return result.Item?.entity_id || null;
  } catch (error: any) {
    console.error(`[Lookup] Error getting ${type} for ${key}:`, error.message);
    return null;
  }
}

/**
 * Batch lookup (pour éviter N requêtes)
 */
export async function batchGetLookups(
  keys: string[],
  type: LookupType
): Promise<Map<string, number>> {
  const map = new Map<string, number>();

  if (keys.length === 0) return map;

  try {
    const result = await dynamoClient.send(new BatchGetCommand({
      RequestItems: {
        [LOOKUP_TABLE]: {
          Keys: keys.map(key => ({
            lookup_key: key,
            lookup_type: type,
          })),
        },
      },
    }));

    const items = result.Responses?.[LOOKUP_TABLE] || [];
    for (const item of items) {
      if (item.entity_id) {
        map.set(item.lookup_key, item.entity_id);
      }
    }
  } catch (error: any) {
    console.error(`[Lookup] Error batch getting ${type}:`, error.message);
  }

  return map;
}

/**
 * Mettre à jour un lookup (appelé lors de l'insertion de données)
 */
export async function putLookup(
  key: string,
  type: LookupType,
  entityId: number,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await dynamoClient.send(new PutCommand({
      TableName: LOOKUP_TABLE,
      Item: {
        lookup_key: key,
        lookup_type: type,
        entity_id: entityId,
        metadata: metadata || {},
        updated_at: new Date().toISOString(),
      },
    }));
  } catch (error: any) {
    console.error(`[Lookup] Error putting ${type} for ${key}:`, error.message);
    // Ne pas faire échouer l'insertion principale si le lookup échoue
  }
}
```

#### C. Intégration dans les Writers

**Modifier**: `services/api/src/athena/write.ts`

Ajouter après chaque insertion :
```typescript
import { putLookup } from './lookup-index.service';

// Après insertion company
await putLookup(company.ticker, 'ticker->company', company.id);
await putLookup(company.cik, 'cik->company', company.id);

// Après insertion filing
await putLookup(filing.accession_number, 'accession->filing', filing.id);
```

---

### **PR #3: Refactor Scripts Batch Queries** ✅ PRIORITÉ 2

#### A. Optimiser `processInsiderFiling()` dans `workers/sec-smart-money-sync`

**AVANT** (ligne 585-591):
```typescript
// ❌ MAUVAIS: Requête unitaire pour chaque filing
const companyQuery = `
  SELECT id
  FROM companies
  WHERE cik = '${companyCik}'
  LIMIT 1
`;
```

**APRÈS**:
```typescript
// ✅ BON: Batch query pour tous les CIKs uniques
async function processInsiderFilingsBatch(insiderCik: string, filings: any[]): Promise<void> {
  // 1. Extraire tous les CIKs uniques
  const companyCiks = new Set<string>();
  for (const filing of filings) {
    const match = filing.accessionNumber.match(/^(\d{10})-/);
    if (match) {
      companyCiks.add(match[1]);
    }
  }

  // 2. 1 seule requête batch pour tous les CIKs
  if (companyCiks.size === 0) return;

  const cikList = Array.from(companyCiks).map(cik => `'${cik.replace(/'/g, "''")}'`).join(', ');
  const companyQuery = `
    SELECT id, cik
    FROM companies
    WHERE cik IN (${cikList})
  `;
  
  const companies = await executeAthenaQuery(companyQuery);
  const cikToIdMap = new Map<string, number>();
  for (const row of companies) {
    cikToIdMap.set(row[1], parseInt(row[0], 10));
  }

  // 3. Utiliser le Map pour tous les filings
  for (const filing of filings) {
    const match = filing.accessionNumber.match(/^(\d{10})-/);
    const companyCik = match ? match[1] : null;
    const companyId = companyCik ? cikToIdMap.get(companyCik) : null;
    
    if (!companyId) {
      console.log(`    Skipping ${filing.accessionNumber} (company CIK ${companyCik} not found)`);
      continue;
    }

    await processInsiderFilingWithId(insiderCik, filing, companyId);
  }
}
```

#### B. Cache Map dans Worker Lambda

**Modifier**: `workers/sec-smart-money-sync/src/index.ts`

```typescript
// Cache in-memory pour éviter requêtes répétées dans la même exécution
const companyCache = new Map<string, number>();
const filingCache = new Map<string, number>();

async function getCompanyIdByCik(cik: string): Promise<number | null> {
  if (companyCache.has(cik)) {
    return companyCache.get(cik)!;
  }
  
  // Requête Athena (ou lookup DynamoDB si index disponible)
  const query = `SELECT id FROM companies WHERE cik = '${cik.replace(/'/g, "''")}' LIMIT 1`;
  const results = await executeAthenaQuery(query);
  
  if (results && results.length > 0) {
    const companyId = parseInt(results[0][0], 10);
    companyCache.set(cik, companyId);
    return companyId;
  }
  
  return null;
}
```

---

### **PR #4: Vérifier Partitions S3** ✅ PRIORITÉ 2

#### A. Audit des Writers

**Vérifier**:
- `workers/form4-parser/src/index.ts` → `writeToS3ParquetInPartition()` utilise `year/month` ✅
- `services/api/src/athena/write.ts` → `writeToS3Parquet()` utilise `year/month` ✅
- `scripts/sync_sec_smart_money.ts` → Utilise `insertRowS3()` qui doit utiliser partition ✅

#### B. Script de Vérification

**Fichier**: `scripts/verify_s3_partitions.ts` (nouveau)

```typescript
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const s3Client = new S3Client();
const BUCKET = process.env.S3_DATA_LAKE_BUCKET || 'adel-ai-dev-data-lake';

async function verifyPartitions() {
  const tables = ['insider_trades', 'company_financials', 'transaction_alerts'];
  
  for (const table of tables) {
    console.log(`\n📊 Checking ${table}...`);
    
    const prefix = `data/${table}/`;
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      Delimiter: '/',
    });
    
    const response = await s3Client.send(command);
    const prefixes = response.CommonPrefixes || [];
    
    // Vérifier que les partitions sont year=YYYY/month=MM
    const validPartitions = prefixes.filter(p => {
      const key = p.Prefix || '';
      return /year=\d{4}\/month=\d{1,2}\//.test(key);
    });
    
    console.log(`  ✅ ${validPartitions.length} valid partitions found`);
    console.log(`  ❌ ${prefixes.length - validPartitions.length} invalid partitions`);
    
    if (prefixes.length - validPartitions.length > 0) {
      console.log(`  ⚠️  Invalid partitions:`);
      prefixes
        .filter(p => !validPartitions.includes(p))
        .forEach(p => console.log(`     - ${p.Prefix}`));
    }
  }
}

verifyPartitions();
```

---

### **PR #5: Top 100 Companies Dataset** ✅ PRIORITÉ 2

#### A. Table Athena Dédiée

**Fichier**: `infra/athena/ddl/create_top_companies_view.sql` (nouveau)

```sql
-- Vue matérialisée pour top 100 companies (mise à jour quotidienne)
CREATE OR REPLACE VIEW top_companies AS
SELECT 
  id,
  ticker,
  cik,
  name,
  sector,
  industry,
  market_cap,
  ROW_NUMBER() OVER (ORDER BY market_cap DESC NULLS LAST) as rank
FROM companies
WHERE cik IS NOT NULL
  AND cik != ''
  AND market_cap IS NOT NULL
ORDER BY market_cap DESC NULLS LAST
LIMIT 100;
```

#### B. Utilisation dans Worker

**Modifier**: `workers/sec-smart-money-sync/src/index.ts`

```typescript
// ✅ BON: Utiliser la vue top_companies
async function getTopCompanies(limit: number = 100): Promise<any[]> {
  const query = `
    SELECT 
      id,
      ticker,
      cik,
      name,
      sector,
      industry,
      market_cap,
      rank
    FROM top_companies
    ORDER BY rank
    LIMIT ${limit}
  `;
  
  return await executeAthenaQuery(query);
}
```

---

### **PR #6: De-dup par Accession Number** ✅ PRIORITÉ 1

#### A. Vérification avant Insertion

**Modifier**: `services/api/src/athena/write.ts`

```typescript
/**
 * Vérifier si un filing existe déjà (de-dup par accession_number)
 */
async function checkFilingExists(accessionNumber: string, formType: string): Promise<number | null> {
  // 1. Vérifier DynamoDB index d'abord (ultra rapide)
  const filingId = await getLookup(accessionNumber, 'accession->filing');
  if (filingId) {
    return filingId;
  }

  // 2. Fallback Athena (si index non disponible)
  const query = `
    SELECT id
    FROM company_filings
    WHERE accession_number = '${accessionNumber.replace(/'/g, "''")}'
      AND form_type = '${formType}'
    LIMIT 1
  `;
  
  const results = await executeAthenaQuery(query);
  return results && results.length > 0 ? parseInt(results[0][0], 10) : null;
}

/**
 * Insérer un filing avec de-dup automatique
 */
export async function insertFilingS3(data: any): Promise<{ id: number; created: boolean }> {
  const { accession_number, form_type } = data;
  
  // Vérifier si existe déjà
  const existingId = await checkFilingExists(accession_number, form_type);
  if (existingId) {
    console.log(`[De-dup] Filing ${accession_number} already exists (id: ${existingId})`);
    return { id: existingId, created: false };
  }

  // Insérer nouveau
  const result = await insertRowS3('company_filings', data);
  
  // Mettre à jour l'index DynamoDB
  await putLookup(accession_number, 'accession->filing', result.id);
  
  return { id: result.id, created: true };
}
```

#### B. De-dup dans Parser

**Modifier**: `workers/form4-parser/src/index.ts`

Vérifier avant insertion :
```typescript
// Avant d'insérer les transactions
const existingFiling = await checkFilingExists(accessionNumber, '4');
if (existingFiling && existingFiling.status === 'PARSED') {
  console.log(`[De-dup] Filing ${accessionNumber} already parsed, skipping`);
  return;
}
```

---

## 📊 ARCHITECTURE FINALE

```
┌─────────────────────────────────────────────────────────┐
│ RAW DATA (S3)                                           │
│ - raw/submissions/{cik}.json                            │
│ - raw/filings/{accession}.xml                           │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ CURATED DATA (S3 Parquet Partitionné)                  │
│ - curated/insider_trades/year=YYYY/month=MM/           │
│ - curated/company_financials/year=YYYY/month=MM/        │
│ - curated/transaction_alerts/year=YYYY/month=MM/        │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ INDEX (DynamoDB PAY_PER_REQUEST)                        │
│ - ticker -> company_id                                  │
│ - cik -> company_id                                     │
│ - accession_number -> filing_id                         │
│ - cusip -> ticker (optionnel, si hot)                   │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ QUERY LAYER (Athena)                                    │
│ - Requêtes analytiques (JOIN, GROUP BY, etc.)           │
│ - Pas de lookups unitaires (utiliser index DynamoDB)    │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ CHECKLIST DÉPLOIEMENT

### Phase 1: Sécurité (PR #1)
- [ ] Créer `.eslintrc.js` avec rule `no-restricted-imports`
- [ ] Ajouter script CI pour vérifier imports
- [ ] Vérifier runtime guard dans `s3-direct-read.ts`
- [ ] Tester que ESLint fail sur import interdit

### Phase 2: Index DynamoDB (PR #2)
- [ ] Créer table DynamoDB `lookup-index` via Terraform
- [ ] Créer service `lookup-index.service.ts`
- [ ] Intégrer `putLookup()` dans tous les writers
- [ ] Migrer les lookups API vers `getLookup()` DynamoDB

### Phase 3: Optimisation Scripts (PR #3)
- [ ] Refactor `processInsiderFiling()` avec batch query
- [ ] Ajouter cache Map dans worker Lambda
- [ ] Tester que requêtes Athena diminuent

### Phase 4: Vérification Partitions (PR #4)
- [ ] Exécuter `verify_s3_partitions.ts`
- [ ] Corriger partitions invalides si nécessaire
- [ ] Documenter structure partitions

### Phase 5: Top 100 Companies (PR #5)
- [ ] Créer vue Athena `top_companies`
- [ ] Modifier worker pour utiliser la vue
- [ ] Tester que le CRON utilise bien top 100

### Phase 6: De-dup (PR #6)
- [ ] Implémenter `checkFilingExists()` avec index DynamoDB
- [ ] Intégrer de-dup dans tous les writers
- [ ] Tester qu'aucun double insert n'est possible

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

1. **DynamoDB PAY_PER_REQUEST**: Coût = $0.25 par million de requêtes (vs $18 pour 43M S3 GET)
2. **Batch Queries**: Réduire de 1000 requêtes à 1 requête = économie massive
3. **CI Guard**: Fail fast, empêche les erreurs avant déploiement
4. **Monitoring**: Ajouter CloudWatch metrics pour tracker requêtes Athena/DynamoDB
