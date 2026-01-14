# 📊 Guide: Synchronisation SEC Smart Money

## Vue d'ensemble

Ce système améliore la synchronisation SEC pour inclure trois volets de données Smart Money :

1. **Funds (13F-HR)** : Holdings des Investment Managers avec calcul des changements trimestriels
2. **Insiders (Form 4)** : Transactions des dirigeants avec alertes pour transactions > 1M$
3. **Earnings (10-Q/10-K)** : Données financières extraites via XBRL

**Architecture Extreme Budget**: Utilise **S3 + Athena** (pas de Supabase)

---

## 🏗️ Architecture

### Tables Athena créées

#### 1. `insider_trades` (nouvelle table Athena)
- Colonnes: `relation` (CEO/CFO/Director), `alert_flag` (true si transaction > 1M$)
- Partitionnée par `year` et `month`
- Stockée en Parquet sur S3

#### 2. `company_financials` (nouvelle table Athena)
- Stocke les données XBRL extraites
- Colonnes: `net_income`, `total_revenue`, `cash_and_equivalents`
- Un record par filing (10-Q ou 10-K)
- Partitionnée par `year` et `month`

#### 3. `cusip_ticker_mapping` (nouvelle table Athena)
- Cache local pour mapping CUSIP → Ticker
- Évite les appels API répétés à OpenFIGI
- Source: `openfigi`, `sec`, `manual`
- Petite table, pas de partitionnement

#### 4. `transaction_alerts` (nouvelle table Athena)
- Alertes automatiques pour transactions importantes
- Types: `insider_large`, `fund_major_change`, `earnings_surprise`
- Seuils configurables
- Partitionnée par `year` et `month`

#### 5. `fund_holdings` (améliorée)
- Ajout de `change_pct` (pourcentage de changement trimestriel)
- Ajout de `previous_holding_id` (référence au holding précédent)
- **Note**: Le calcul du `change_pct` se fait côté application (pas de trigger SQL dans Athena)

---

## 🔧 Services créés

### 1. `cusip-mapping.service.ts`
**Fonctionnalités:**
- Mapping CUSIP → Ticker via OpenFIGI API
- Cache local sur S3/Athena (table `cusip_ticker_mapping`)
- Support batch pour plusieurs CUSIPs
- Rate limiting respecté
- Utilise S3 direct read pour les lookups rapides

**Usage:**
```typescript
import { mapCusipToTicker, mapCusipsToTickers } from './services/cusip-mapping.service';

// Single mapping
const ticker = await mapCusipToTicker('037833100'); // → 'AAPL'

// Batch mapping
const mapping = await mapCusipsToTickers(['037833100', '594918104']);
// → Map { '037833100' => 'AAPL', '594918104' => 'MSFT' }
```

### 2. `form4-parser.service.ts`
**Fonctionnalités:**
- Parse les fichiers XML Form 4 depuis SEC EDGAR
- Extrait: nom, relation, type d'opération, prix, valeur totale
- Crée automatiquement des alertes si transaction > 1M$
- Insère dans `insider_trades` sur S3 (Parquet)

**Usage:**
```typescript
import { parseForm4FromUrl } from './services/form4-parser.service';

const transactions = await parseForm4FromUrl(
  companyId,
  filingId,
  accessionNumber,
  cik
);
```

### 3. `xbrl-parser.service.ts`
**Fonctionnalités:**
- Parse les fichiers XBRL des 10-Q/10-K
- Extrait: Net Income, Total Revenue, Cash & Equivalents
- Gère les namespaces XBRL (us-gaap, dei, etc.)
- Insère dans `company_financials` sur S3 (Parquet)

**Usage:**
```typescript
import { parseXBRLFromUrl } from './services/xbrl-parser.service';

const financialData = await parseXBRLFromUrl(
  companyId,
  filingId,
  '10-Q',
  accessionNumber,
  cik,
  primaryDocument
);
```

---

## 🚀 Utilisation

### Prérequis

1. **Créer les tables Athena** :
   ```bash
   # Exécuter le DDL dans Athena Console
   # Fichier: infra/athena/ddl/create_sec_smart_money_tables.sql
   ```

2. **Variables d'environnement** :
   ```bash
   USE_ATHENA=true
   ATHENA_DATABASE=adel_ai_dev
   ATHENA_WORK_GROUP=adel-ai-dev-workgroup
   S3_DATA_BUCKET=adel-ai-dev-data-lake
   AWS_REGION=eu-west-3
   ```

### Script de synchronisation

Le script `scripts/sync_sec_smart_money.ts` synchronise automatiquement les trois volets :

```bash
# Synchroniser tout
npx tsx scripts/sync_sec_smart_money.ts

# Synchroniser uniquement les 13F
npx tsx scripts/sync_sec_smart_money.ts --funds-only

# Synchroniser uniquement les Form 4
npx tsx scripts/sync_sec_smart_money.ts --insiders-only

# Synchroniser uniquement les XBRL
npx tsx scripts/sync_sec_smart_money.ts --earnings-only
```

**Note**: Le script utilise S3/Athena, pas Supabase. Toutes les données sont écrites directement sur S3 en Parquet.

### Fonctionnalités automatiques

#### 1. Calcul des changements trimestriels (13F)
Le calcul du `change_pct` se fait côté application lors de l'insertion :
- Compare avec le holding du trimestre précédent (via Athena)
- Calcule le pourcentage de changement
- Stocke la référence au holding précédent (`previous_holding_id`)

**Note**: Athena ne supporte pas les triggers SQL. Le calcul doit être fait avant l'insertion.

#### 2. Alertes automatiques (Form 4)
Les alertes sont créées automatiquement lors de l'insertion dans `insider_trades` :
- Transaction insider > 1M$ → crée une alerte dans `transaction_alerts`
- Severity basée sur le montant:
  - `critical`: > 10M$
  - `high`: > 5M$
  - `medium`: > 1M$

**Note**: Les alertes sont créées côté application (pas de trigger SQL dans Athena).

---

## 📋 Mapping CUSIP → Ticker

### Problème
Les rapports 13F utilisent des codes CUSIP au lieu de Tickers. Exemple:
- CUSIP `037833100` = Ticker `AAPL`

### Solution
1. **Cache local** : Vérifie d'abord `cusip_ticker_mapping`
2. **OpenFIGI API** : Si non trouvé, appelle l'API OpenFIGI
3. **Mise en cache** : Stocke le résultat pour les prochaines fois

### OpenFIGI API
- **URL**: `https://api.openfigi.com/v3/mapping`
- **Rate Limit**: ~10 requêtes/seconde
- **Gratuit**: Oui (sans API key)
- **Format**: POST avec `[{ "idType": "ID_CUSIP", "idValue": "037833100" }]`

---

## 🔍 Exemples de requêtes Athena

### Récupérer les transactions insider > 1M$
```sql
SELECT 
  it.*,
  c.ticker,
  c.name as company_name
FROM insider_trades it
INNER JOIN companies c ON c.id = it.company_id
WHERE it.total_value > 1000000
ORDER BY it.transaction_date DESC
LIMIT 100;
```

### Récupérer les alertes non vues
```sql
SELECT 
  ta.*,
  c.ticker,
  c.name as company_name
FROM transaction_alerts ta
LEFT JOIN companies c ON c.id = ta.company_id
WHERE ta.status = 'new'
ORDER BY ta.created_at DESC
LIMIT 100;
```

### Récupérer les changements majeurs de holdings
```sql
SELECT 
  fh.*,
  f.name as fund_name,
  fh.change_pct
FROM fund_holdings fh
INNER JOIN funds f ON f.id = fh.fund_id
WHERE ABS(fh.change_pct) > 50  -- Changement > 50%
ORDER BY ABS(fh.change_pct) DESC
LIMIT 100;
```

### Récupérer les données financières récentes
```sql
SELECT 
  cf.*,
  c.ticker,
  c.name as company_name
FROM company_financials cf
INNER JOIN companies c ON c.id = cf.company_id
WHERE cf.form_type = '10-Q'
ORDER BY cf.period_end_date DESC
LIMIT 100;
```

---

## ⚠️ Rate Limiting SEC

**Important**: SEC EDGAR impose un rate limiting strict :
- **10 requêtes/seconde maximum**
- **User-Agent obligatoire**: `ADEL AI (contact@adel.ai)`

Le script `sync_sec_smart_money.ts` respecte automatiquement ce rate limiting avec un délai de 100ms entre chaque requête.

---

## 🎯 Prochaines étapes

1. **Créer un CRON** pour exécuter `sync_sec_smart_money.ts` quotidiennement
2. **Améliorer le parser XBRL** pour extraire plus de métriques (EBITDA, Debt, etc.)
3. **Ajouter des alertes** pour les changements majeurs de holdings (> 50%)
4. **Créer un dashboard** pour visualiser les alertes et transactions

---

## 📚 Références

- [SEC EDGAR API](https://www.sec.gov/edgar/sec-api-documentation)
- [OpenFIGI API](https://www.openfigi.com/api)
- [XBRL Taxonomy](https://www.xbrl.org/)
- [Form 4 Structure](https://www.sec.gov/files/form4.pdf)
- [13F-HR Structure](https://www.sec.gov/files/form13f.pdf)
