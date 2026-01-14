# 🚀 Plan de Migration : Supabase → AWS

## 📊 État Actuel

### Données Supabase
- **Entreprises** : 8,191
- **Filings SEC** : 206,194
- **Filings 13F** : 262
- **Holdings 13F** : 5,772,225
- **Stockage** : ~3 GB (dépassement plan FREE)
- **Coût actuel** : $25-30/mois (plan PRO)

### Stack AWS Existante
- ✅ **Lambda** : API, Collectors, Parsers
- ✅ **Cognito** : Authentification
- ✅ **S3** : Stockage fichiers
- ✅ **EventBridge** : Orchestration
- ✅ **SQS** : Queues pour lissage
- ⚠️ **Athena** : Mentionné mais pas encore utilisé

---

## 🎯 Architecture Cible AWS

### Stratégie de Data-Tiering

```
┌─────────────────────────────────────────────────────────┐
│                    DONNÉES VOLUMINEUSES                 │
│              S3 (Parquet) + Athena                      │
│  - fund_holdings (5.7M rows)                            │
│  - company_filings (206K rows)                          │
│  - fund_filings (262 rows, mais fichiers XML lourds)    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              DONNÉES RELATIONNELLES                      │
│              RDS PostgreSQL (db.t3.micro)              │
│  - companies (8K rows)                                   │
│  - funds (petit volume)                                 │
│  - fund_holdings_diff (calculs)                         │
│  - earnings_calendar                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              DONNÉES HAUTE FRÉQUENCE                     │
│              DynamoDB                                    │
│  - signals (realtime)                                   │
│  - notifications (fréquentes)                           │
│  - cron_registry (métadonnées)                          │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Plan d'Action Détaillé

### Phase 1 : Préparation (Semaine 1)

#### 1.1 Analyse et Inventaire
- [ ] **Audit des tables Supabase**
  ```bash
  # Script à créer : scripts/audit_supabase_tables.ts
  # - Lister toutes les tables
  # - Compter les rows par table
  # - Estimer la taille par table
  # - Identifier les dépendances (foreign keys)
  ```

- [ ] **Mapping Tables → Services AWS**
  | Table Supabase | Service AWS | Raison |
  |----------------|-------------|--------|
  | `fund_holdings` | S3 + Athena | 5.7M rows, requêtes analytiques |
  | `company_filings` | S3 + Athena | 206K rows, fichiers volumineux |
  | `fund_filings` | S3 + Athena | Fichiers XML bruts |
  | `companies` | RDS PostgreSQL | 8K rows, relations fréquentes |
  | `funds` | RDS PostgreSQL | Petit volume, relations |
  | `fund_holdings_diff` | RDS PostgreSQL | Calculs relationnels |
  | `signals` | DynamoDB | Haute fréquence, realtime |
  | `notifications` | DynamoDB | Haute fréquence |
  | `cron_registry` | DynamoDB | Métadonnées légères |
  | `earnings_calendar` | RDS PostgreSQL | Relations avec companies |

#### 1.2 Création Infrastructure Terraform
- [ ] **RDS PostgreSQL**
  ```hcl
  # infra/terraform/rds.tf
  resource "aws_db_instance" "main" {
    identifier     = "${var.project}-${var.stage}-db"
    engine         = "postgres"
    engine_version = "15.4"
    instance_class = "db.t3.micro"  # $15/mois
    allocated_storage = 20  # GB
    storage_type   = "gp3"
    
    db_name  = "personamy"
    username = var.db_username
    password = var.db_password
    
    vpc_security_group_ids = [aws_security_group.rds.id]
    db_subnet_group_name   = aws_db_subnet_group.main.name
    
    backup_retention_period = 7
    skip_final_snapshot    = false
    final_snapshot_identifier = "${var.project}-${var.stage}-final-snapshot"
  }
  ```

- [ ] **S3 Buckets pour Data Lake**
  ```hcl
  # infra/terraform/s3-data-lake.tf
  resource "aws_s3_bucket" "data_lake" {
    bucket = "${var.project}-${var.stage}-data-lake"
  }
  
  # Structure :
  # s3://data-lake/
  #   ├── fund_holdings/
  #   │   └── year=2024/month=01/day=15/
  #   │       └── holdings.parquet
  #   ├── company_filings/
  #   │   └── year=2024/month=01/
  #   │       └── filings.parquet
  #   └── fund_filings/
  #       └── raw/  # Fichiers XML bruts
  ```

- [ ] **Athena Database & Tables**
  ```hcl
  # infra/terraform/athena.tf
  resource "aws_athena_database" "main" {
    name   = "${var.project}_${var.stage}"
    bucket = aws_s3_bucket.athena_results.bucket
  }
  
  # Tables externes (Hive format) pointant vers S3 Parquet
  ```

- [ ] **DynamoDB Tables**
  ```hcl
  # infra/terraform/dynamodb.tf
  resource "aws_dynamodb_table" "signals" {
    name           = "${var.project}-${var.stage}-signals"
    billing_mode   = "PAY_PER_REQUEST"  # Pas de provisioned capacity
    hash_key       = "id"
    range_key      = "timestamp"
    
    attribute {
      name = "id"
      type = "S"
    }
    attribute {
      name = "timestamp"
      type = "S"
    }
    
    # GSI pour requêtes par source/type
    global_secondary_index {
      name     = "source-timestamp-index"
      hash_key = "source"
      range_key = "timestamp"
    }
  }
  ```

#### 1.3 Scripts de Migration
- [ ] **Export Supabase → S3 (Parquet)**
  ```typescript
  // scripts/migrate_holdings_to_s3.ts
  // 1. Exporter fund_holdings depuis Supabase
  // 2. Convertir en Parquet
  // 3. Upload vers S3 avec partitionnement (year/month/day)
  ```

- [ ] **Export Supabase → RDS**
  ```typescript
  // scripts/migrate_companies_to_rds.ts
  // 1. Exporter companies, funds, earnings_calendar
  // 2. Insérer dans RDS PostgreSQL
  ```

- [ ] **Export Supabase → DynamoDB**
  ```typescript
  // scripts/migrate_signals_to_dynamodb.ts
  // 1. Exporter signals, notifications
  // 2. Batch write vers DynamoDB
  ```

---

### Phase 2 : Migration des Données (Semaine 2)

#### 2.1 Migration S3 + Athena (Gros Volumes)

**Étape 1 : Export fund_holdings**
```bash
npx tsx scripts/migrate_holdings_to_s3.ts \
  --batch-size=100000 \
  --s3-bucket=personamy-prod-data-lake \
  --s3-prefix=fund_holdings/
```

**Étape 2 : Créer table Athena**
```sql
-- infra/terraform/athena-schemas/fund_holdings.sql
CREATE EXTERNAL TABLE fund_holdings (
  id BIGINT,
  fund_id INT,
  filing_id INT,
  ticker STRING,
  cusip STRING,
  shares BIGINT,
  market_value BIGINT,
  type STRING,
  created_at TIMESTAMP
)
PARTITIONED BY (year INT, month INT, day INT)
STORED AS PARQUET
LOCATION 's3://personamy-prod-data-lake/fund_holdings/'
TBLPROPERTIES ('parquet.compress'='SNAPPY');
```

**Étape 3 : Repartitionner les données existantes**
```sql
MSCK REPAIR TABLE fund_holdings;
```

#### 2.2 Migration RDS (Données Relationnelles)

**Étape 1 : Créer schéma RDS**
```bash
# Appliquer migrations SQL sur RDS
psql -h $RDS_ENDPOINT -U $DB_USER -d personamy -f infra/supabase/migrations/001_initial_schema.sql
psql -h $RDS_ENDPOINT -U $DB_USER -d personamy -f infra/supabase/migrations/003_add_companies_tables.sql
# ... autres migrations nécessaires
```

**Étape 2 : Migrer les données**
```bash
npx tsx scripts/migrate_companies_to_rds.ts \
  --supabase-url=$SUPABASE_URL \
  --supabase-key=$SUPABASE_KEY \
  --rds-endpoint=$RDS_ENDPOINT \
  --rds-user=$DB_USER \
  --rds-password=$DB_PASSWORD
```

#### 2.3 Migration DynamoDB (Haute Fréquence)

```bash
npx tsx scripts/migrate_signals_to_dynamodb.ts \
  --batch-size=1000 \
  --table-name=personamy-prod-signals
```

---

### Phase 3 : Refactoring Code (Semaine 3-4)

#### 3.1 Créer Abstraction Layer

**Nouveau fichier : `services/api/src/db/index.ts`**
```typescript
// Abstraction pour masquer la source de données
export interface DatabaseClient {
  // Companies
  getCompanyByTicker(ticker: string): Promise<Company | null>;
  getCompanyByCik(cik: string): Promise<Company | null>;
  
  // Funds
  getFundById(id: number): Promise<Fund | null>;
  getFundByCik(cik: string): Promise<Fund | null>;
  
  // Holdings (depuis Athena)
  getHoldingsByFiling(filingId: number): Promise<Holding[]>;
  getHoldingsByFund(fundId: number, period?: string): Promise<Holding[]>;
  
  // Signals (depuis DynamoDB)
  getSignals(filters: SignalFilters): Promise<Signal[]>;
  createSignal(signal: SignalInput): Promise<Signal>;
}

// Implémentation RDS pour companies/funds
export class RDSClient implements DatabaseClient {
  // Utilise pg (node-postgres) pour RDS
}

// Implémentation Athena pour holdings
export class AthenaClient {
  // Utilise @aws-sdk/client-athena
}

// Implémentation DynamoDB pour signals
export class DynamoDBClient {
  // Utilise @aws-sdk/client-dynamodb
}
```

#### 3.2 Migrer Services API

**Avant (Supabase) :**
```typescript
// services/api/src/companies.ts
import { supabase } from '../supabase';

export async function getCompanyByTicker(ticker: string) {
  const { data } = await supabase
    .from('companies')
    .select('*')
    .eq('ticker', ticker)
    .single();
  return data;
}
```

**Après (RDS) :**
```typescript
// services/api/src/companies.ts
import { db } from '../db';

export async function getCompanyByTicker(ticker: string) {
  return await db.getCompanyByTicker(ticker);
}
```

#### 3.3 Migrer Workers

**Parser 13F :**
- Avant : Insert `fund_holdings` dans Supabase
- Après : 
  1. Parser XML → générer Parquet
  2. Upload vers S3 (partitionné par date)
  3. Refresh table Athena (`MSCK REPAIR TABLE`)

**Collectors (RSS, SEC) :**
- Avant : Insert `signals` dans Supabase
- Après : Insert dans DynamoDB

---

### Phase 4 : Tests & Validation (Semaine 5)

#### 4.1 Tests de Migration
- [ ] **Vérifier intégrité des données**
  ```bash
  # Comparer counts Supabase vs AWS
  npx tsx scripts/validate_migration.ts
  ```

- [ ] **Tests de performance**
  - Comparer latence API avant/après
  - Tester requêtes Athena (holdings)
  - Tester requêtes RDS (companies)

#### 4.2 Tests d'Intégration
- [ ] **Tester endpoints API**
  - `/funds/{id}/holdings` (depuis Athena)
  - `/companies/ticker/{ticker}` (depuis RDS)
  - `/signals` (depuis DynamoDB)

- [ ] **Tester workers**
  - Parser 13F → S3
  - Collectors → DynamoDB

---

### Phase 5 : Déploiement & Cutover (Semaine 6)

#### 5.1 Déploiement Progressif
1. **Déployer infrastructure Terraform**
   ```bash
   cd infra/terraform
   terraform plan
   terraform apply
   ```

2. **Migrer les données** (voir Phase 2)

3. **Déployer code refactorisé** (voir Phase 3)

4. **Basculer progressivement**
   - Semaine 1 : 10% du trafic vers AWS
   - Semaine 2 : 50% du trafic
   - Semaine 3 : 100% du trafic

#### 5.2 Monitoring
- [ ] **CloudWatch Dashboards**
  - Latence API
  - Erreurs Lambda
  - Coûts AWS (RDS, S3, Athena, DynamoDB)

- [ ] **Alertes**
  - RDS CPU > 80%
  - Lambda errors > 1%
  - Coûts > seuil

---

## 💰 Estimation des Coûts AWS

### Coûts Mensuels Estimés

| Service | Configuration | Coût/mois |
|---------|--------------|-----------|
| **RDS PostgreSQL** | db.t3.micro (20GB) | $15 |
| **S3 Storage** | 10GB (Parquet compressé) | $0.23 |
| **S3 Requests** | PUT/GET (1M requests) | $0.05 |
| **Athena** | 100GB scanned/mois | $5 |
| **DynamoDB** | PAY_PER_REQUEST (1M writes) | $1.25 |
| **Lambda** | Inchangé (déjà en place) | $0 |
| **Data Transfer** | 10GB out | $0.90 |
| **TOTAL** | | **~$22.50/mois** |

### Comparaison Supabase vs AWS

| | Supabase PRO | AWS (estimé) |
|---|---|---|
| **Coût base** | $25/mois | $22.50/mois |
| **Stockage** | 8GB inclus | 20GB RDS + 10GB S3 |
| **Scalabilité** | Limite 8GB | Illimitée (S3) |
| **Performance** | Bonne | Excellente (Athena pour analytics) |
| **Flexibilité** | Limitée | Totale (AWS native) |

**Économie estimée** : ~$2.50/mois + scalabilité illimitée

---

## 🚨 Risques & Mitigation

### Risque 1 : Downtime pendant migration
**Mitigation** :
- Migration en parallèle (Supabase + AWS)
- Basculer progressivement (10% → 50% → 100%)
- Rollback possible vers Supabase

### Risque 2 : Perte de données
**Mitigation** :
- Scripts de validation (counts, checksums)
- Snapshots RDS avant migration
- Backup S3 versionné

### Risque 3 : Latence Athena
**Mitigation** :
- Cache CloudFront pour requêtes fréquentes
- Partitionnement optimal (year/month/day)
- Compression Parquet (Snappy)

### Risque 4 : Coûts AWS imprévus
**Mitigation** :
- Budgets AWS avec alertes
- Monitoring CloudWatch
- Optimisation continue (S3 lifecycle, RDS reserved instances)

---

## 📝 Checklist Complète

### Infrastructure
- [ ] Créer RDS PostgreSQL (Terraform)
- [ ] Créer S3 buckets (data-lake, athena-results)
- [ ] Créer tables Athena (schemas Parquet)
- [ ] Créer tables DynamoDB
- [ ] Configurer VPC, Security Groups
- [ ] Configurer IAM roles/policies

### Migration Données
- [ ] Exporter `fund_holdings` → S3 Parquet
- [ ] Exporter `company_filings` → S3 Parquet
- [ ] Exporter `companies` → RDS
- [ ] Exporter `funds` → RDS
- [ ] Exporter `signals` → DynamoDB
- [ ] Exporter `notifications` → DynamoDB
- [ ] Valider intégrité (counts, samples)

### Code
- [ ] Créer abstraction layer (`db/index.ts`)
- [ ] Migrer `services/api/src/companies.ts`
- [ ] Migrer `services/api/src/funds.ts`
- [ ] Migrer `services/api/src/holdings.ts`
- [ ] Migrer `workers/parser-13f` → S3
- [ ] Migrer `workers/collector-*` → DynamoDB
- [ ] Mettre à jour tests

### Tests
- [ ] Tests unitaires (abstraction layer)
- [ ] Tests d'intégration (endpoints API)
- [ ] Tests de performance (latence)
- [ ] Tests de charge (Lambda concurrency)

### Déploiement
- [ ] Déployer infrastructure Terraform
- [ ] Migrer données
- [ ] Déployer code refactorisé
- [ ] Basculer trafic progressivement
- [ ] Monitorer CloudWatch
- [ ] Désactiver Supabase (après validation)

---

## 🎯 Prochaines Étapes Immédiates

1. **Créer script d'audit Supabase**
   ```bash
   npx tsx scripts/audit_supabase_tables.ts
   ```

2. **Créer Terraform pour RDS**
   ```bash
   # Créer infra/terraform/rds.tf
   ```

3. **Créer script de migration holdings → S3**
   ```bash
   # Créer scripts/migrate_holdings_to_s3.ts
   ```

4. **Tester migration sur un subset**
   ```bash
   # Migrer 10K holdings pour tester
   npx tsx scripts/migrate_holdings_to_s3.ts --limit=10000
   ```

---

## 📚 Ressources

- [AWS RDS Pricing](https://aws.amazon.com/rds/pricing/)
- [AWS S3 Pricing](https://aws.amazon.com/s3/pricing/)
- [AWS Athena Pricing](https://aws.amazon.com/athena/pricing/)
- [AWS DynamoDB Pricing](https://aws.amazon.com/dynamodb/pricing/)
- [Parquet Format](https://parquet.apache.org/)
- [Athena Partitioning](https://docs.aws.amazon.com/athena/latest/ug/partitions.html)
