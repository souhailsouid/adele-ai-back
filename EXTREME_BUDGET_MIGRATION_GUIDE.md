# 🚀 Guide de Migration: Extreme Budget Architecture

## 📋 Vue d'ensemble

Migration complète de Supabase vers **S3 + Athena** pour réduire les coûts à **$0-5/mois** (vs $25-30/mois Supabase).

### Architecture

```
┌─────────────────────────────────────────┐
│         S3 Data Lake (Parquet)          │
│  s3://bucket/data/{table}/year/month/   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         Amazon Athena (Queries)          │
│     $5/TB scanned (pay-per-query)       │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         Lambda Functions (API)           │
│      Utilise Athena pour requêtes       │
└─────────────────────────────────────────┘
```

---

## 🎯 Étapes de Migration

### 1. Installer les dépendances

```bash
npm install @aws-sdk/client-s3 @aws-sdk/client-athena parquetjs
```

### 2. Créer l'infrastructure Terraform

```bash
cd infra/terraform

# Créer S3 Data Lake
terraform apply -target=aws_s3_bucket.data_lake

# Créer Athena
terraform apply -target=aws_athena_database.main
terraform apply -target=aws_athena_workgroup.main
```

### 3. Migrer les données

#### Migrer une table à la fois:

```bash
# Companies (8K rows)
npx tsx scripts/migrate_to_s3_parquet.ts \
  --table=companies \
  --s3-bucket=personamy-prod-data-lake \
  --batch-size=10000

# Fund Holdings (5.7M rows - peut prendre du temps)
npx tsx scripts/migrate_to_s3_parquet.ts \
  --table=fund_holdings \
  --s3-bucket=personamy-prod-data-lake \
  --batch-size=100000

# Company Filings (206K rows)
npx tsx scripts/migrate_to_s3_parquet.ts \
  --table=company_filings \
  --s3-bucket=personamy-prod-data-lake \
  --batch-size=50000

# Fund Holdings Diff
npx tsx scripts/migrate_to_s3_parquet.ts \
  --table=fund_holdings_diff \
  --s3-bucket=personamy-prod-data-lake \
  --batch-size=50000
```

#### Test avec --dry-run:

```bash
npx tsx scripts/migrate_to_s3_parquet.ts \
  --table=companies \
  --s3-bucket=personamy-prod-data-lake \
  --limit=100 \
  --dry-run
```

### 4. Créer les tables Athena

1. **Se connecter à Athena Console** (AWS Console → Athena)
2. **Sélectionner la database**: `personamy_prod`
3. **Exécuter les DDL** depuis `infra/athena/ddl/create_tables.sql`
4. **Repartitionner** après chaque table:
   ```sql
   MSCK REPAIR TABLE companies;
   MSCK REPAIR TABLE fund_holdings;
   ```

### 5. Tester les requêtes Athena

```sql
-- Test simple
SELECT COUNT(*) FROM companies;
SELECT COUNT(*) FROM fund_holdings;

-- Test de corrélation (exemple)
SELECT 
  h1.ticker,
  SUM(h1.market_value) as fund1_value,
  SUM(h2.market_value) as fund2_value
FROM fund_holdings h1
INNER JOIN fund_holdings h2 ON h1.ticker = h2.ticker
WHERE h1.fund_id = 1 AND h2.fund_id = 2
GROUP BY h1.ticker
LIMIT 10;
```

### 6. Migrer le code API

#### Avant (Supabase):
```typescript
const { data } = await supabase
  .from('fund_holdings')
  .select('*')
  .eq('fund_id', fundId);
```

#### Après (Athena):
```typescript
import { executeAthenaQuery } from '@/athena/correlation';

const results = await executeAthenaQuery(`
  SELECT ticker, SUM(market_value) as total_value
  FROM fund_holdings
  WHERE fund_id = ${fundId}
  GROUP BY ticker
  ORDER BY total_value DESC
`);
```

### 7. Exemple: Corrélation entre investisseurs

```typescript
import { getInvestorCorrelation } from '@/athena/correlation';

// Comparer Scion vs ARK
const correlation = await getInvestorCorrelation(
  'Scion Asset Management',
  'ARK Investment Management'
);

console.log(`Overlap: ${correlation.total_overlap_tickers} tickers`);
console.log(`Total value: $${correlation.total_overlap_value.toLocaleString()}`);
console.log(`Correlation score: ${correlation.correlation_score.toFixed(2)}`);
```

---

## 💰 Coûts Estimés

### S3 Storage
- **Standard**: $0.023/GB/mois
- **Standard-IA** (après 90 jours): $0.0125/GB/mois
- **Glacier** (après 1 an): $0.004/GB/mois

**Exemple**: 10GB de données
- Mois 1-3: 10GB × $0.023 = $0.23/mois
- Mois 4-12: 10GB × $0.0125 = $0.125/mois
- Après 1 an: 10GB × $0.004 = $0.04/mois

### Athena
- **$5/TB scanned** (pay-per-query)
- **Premier 10TB/mois**: Gratuit (Free Tier)

**Exemple**: 100 requêtes/mois, 1GB scanné par requête
- 100 × 1GB = 100GB = 0.1TB
- Coût: 0.1TB × $5 = $0.50/mois

### Total Mensuel
- **S3**: ~$0.20/mois (10GB)
- **Athena**: ~$0.50/mois (100 requêtes)
- **Total**: **~$0.70/mois** (vs $25-30/mois Supabase)

**Économie**: **~$24-29/mois** (97% de réduction)

---

## ⚠️ Points d'Attention

### 1. Latence Athena
- **Première requête**: 2-5 secondes (cold start)
- **Requêtes suivantes**: 1-3 secondes
- **Solution**: Cache CloudFront pour requêtes fréquentes

### 2. Partitionnement
- **Obligatoire** pour performances optimales
- **Structure**: `year=2025/month=12/`
- **Avantage**: Athena scanne uniquement les partitions nécessaires

### 3. Compression Parquet
- **Snappy**: Bon compromis vitesse/compression
- **Réduction**: ~70% de la taille originale
- **Avantage**: Moins de données scannées = moins cher

### 4. Limites Athena
- **Query timeout**: 30 minutes max
- **Result size**: 10MB max (utiliser pagination)
- **Concurrent queries**: 20 par défaut (augmentable)

---

## 🔧 Maintenance

### Ajouter de nouvelles données

```typescript
// Après parsing d'un nouveau filing
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { convertToParquet } from '@/utils/parquet';

const parquetBuffer = await convertToParquet(holdings, schema);
await s3Client.send(new PutObjectCommand({
  Bucket: 'personamy-prod-data-lake',
  Key: `data/fund_holdings/year=${year}/month=${month}/data_${filingId}.parquet`,
  Body: parquetBuffer,
}));

// Repartitionner (automatique avec projection, ou manuel)
// MSCK REPAIR TABLE fund_holdings;
```

### Optimiser les coûts

1. **Partitionnement intelligent**: Utiliser `year/month` pour filtrer efficacement
2. **Compression**: Toujours utiliser Snappy
3. **Lifecycle S3**: Transition vers IA/Glacier après 90 jours
4. **Cache**: Mettre en cache les requêtes fréquentes

---

## 📚 Ressources

- [Athena Documentation](https://docs.aws.amazon.com/athena/)
- [Parquet Format](https://parquet.apache.org/)
- [S3 Pricing](https://aws.amazon.com/s3/pricing/)
- [Athena Pricing](https://aws.amazon.com/athena/pricing/)

---

## ✅ Checklist de Migration

- [ ] Installer dépendances (`@aws-sdk/client-s3`, `@aws-sdk/client-athena`, `parquetjs`)
- [ ] Créer infrastructure Terraform (S3, Athena)
- [ ] Migrer `companies` vers S3
- [ ] Migrer `fund_holdings` vers S3
- [ ] Migrer `company_filings` vers S3
- [ ] Migrer `fund_holdings_diff` vers S3
- [ ] Créer tables Athena (DDL)
- [ ] Tester requêtes Athena
- [ ] Migrer code API (remplacer Supabase par Athena)
- [ ] Tester endpoints API
- [ ] Monitorer les coûts CloudWatch
- [ ] Désactiver Supabase (après validation complète)

---

## 🚨 Rollback Plan

Si besoin de revenir à Supabase:

1. Les données Supabase sont toujours présentes (non supprimées)
2. Rebasculer les variables d'environnement vers Supabase
3. Redéployer le code avec Supabase
4. Les données S3 restent disponibles pour migration future
