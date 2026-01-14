# Système Top Signals - Documentation

## 🎯 Objectif

Transformer le flux de données S3 en un outil d'aide à la décision en filtrant automatiquement les "Top Signals" - les achats volontaires significatifs d'insiders.

## 📊 Critères "Golden Filter"

Les transactions doivent répondre à **tous** ces critères pour être considérées comme Top Signals:

1. **Code de transaction**: `Purchase` uniquement (Code P)
2. **Volume**: Montant total > **50 000$**
3. **Qualité**: Priorité aux CEO, CFO, Director, President, Chairman, COO

## ⭐ Score de Qualité (1-10)

Le score est calculé automatiquement:

- **Base**: 5 points
- **+3 points**: Si l'insider est CEO/CFO/Director/President/Chairman/COO
- **+2 points**: Si montant > 1M$
- **+1 point**: Si montant > 500k$

## 🏗️ Architecture

### 1. Filtrage Automatique

Le filtrage se fait automatiquement après chaque parsing Form 4 dans `form4-parser.service.ts`:

```typescript
// Après insertion des transactions dans insider_trades
const topSignals = filterTopSignals(toInsert);
if (topSignals.length > 0) {
  await insertTopSignals(topSignals);
  // Envoyer alertes si configuré
}
```

### 2. Stockage

- **Table S3**: `top_insider_signals`
- **Format**: Parquet
- **Partitionnement**: `year/month` basé sur `transaction_date`
- **Schéma**: Identique à `insider_trades` + colonne `signal_score`

### 3. API Endpoint

**GET `/insiders/signals/hot`**

Query params:
- `limit`: Nombre de résultats (défaut: 10, max: 50)
- `min_score`: Score minimum (défaut: 5)

Exemple:
```bash
GET /insiders/signals/hot?limit=10&min_score=7
```

Réponse:
```json
[
  {
    "id": 123,
    "ticker": "AAPL",
    "company_name": "Apple Inc.",
    "insider_name": "Tim Cook",
    "insider_title": "CEO",
    "transaction_type": "Purchase",
    "shares": 10000,
    "price_per_share": 150.50,
    "total_value": 1505000,
    "transaction_date": "2025-01-15",
    "signal_score": 10,
    "sec_url": "https://www.sec.gov/...",
    ...
  }
]
```

### 4. Alertes Telegram

**Configuration:**
- Bot: `@boumbobot`
- Token: `8327759989:AAGa8KWU5jJX8Tarm_hLGvkM38Vipgcr8EY`
- Chat ID: `6704156697`

**Format du message:**
```
🔥 TOP INSIDER SIGNAL DETECTED

AAPL - Apple Inc.
👤 Tim Cook (CEO)
📊 PURCHASE - 10,000 shares @ $150.50
💰 Total: $1,505,000
⭐ Score: 10/10
📅 Date: 2025-01-15

📄 [View SEC Filing](https://www.sec.gov/...)
```

## 🚀 Déploiement

### 1. Créer la table Athena

```sql
-- Exécuter: infra/athena/ddl/create_top_insider_signals_table.sql
```

### 2. Configurer Terraform

Ajouter dans `terraform.tfvars`:
```hcl
telegram_bot_token = "8327759989:AAGa8KWU5jJX8Tarm_hLGvkM38Vipgcr8EY"
telegram_chat_id   = "6704156697"
```

### 3. Déployer

```bash
terraform apply
```

## 🧪 Tests

### Test local

```bash
# 1. Obtenir Chat ID
export TELEGRAM_BOT_TOKEN="8327759989:AAGa8KWU5jJX8Tarm_hLGvkM38Vipgcr8EY"
npx tsx scripts/get_telegram_chat_id.ts

# 2. Définir Chat ID
export TELEGRAM_CHAT_ID="6704156697"

# 3. Tester l'alerte
npx tsx scripts/test_telegram_alert.ts
```

### Test API

```bash
curl -X GET "https://api.example.com/insiders/signals/hot?limit=10&min_score=5" \
  -H "Authorization: Bearer <token>"
```

## 📈 Statistiques

Le système filtre automatiquement:
- **~5-10%** des transactions (seulement les Purchase > 50k$)
- **Priorité** aux CEO/CFO/Director
- **Score** pour trier par qualité

## 🔄 Workflow Complet

1. **Parsing Form 4** → Transactions extraites
2. **Insertion** → `insider_trades` (toutes les transactions)
3. **Filtrage** → `top_insider_signals` (seulement les Top Signals)
4. **Alerte** → Telegram/Discord (si configuré)
5. **API** → Endpoint `/insiders/signals/hot` pour consultation

## 📝 Fichiers Clés

- `services/api/src/services/top-signals.service.ts` - Logique de filtrage
- `services/api/src/services/signal-alerts.service.ts` - Envoi d'alertes
- `services/api/src/services/form4-parser.service.ts` - Intégration
- `services/api/src/services/insiders.service.ts` - Endpoint API
- `infra/athena/ddl/create_top_insider_signals_table.sql` - DDL Athena
- `scripts/test_telegram_alert.ts` - Test d'alertes
- `scripts/get_telegram_chat_id.ts` - Récupération Chat ID

## ✅ Statut

- ✅ Filtrage Golden Filter implémenté
- ✅ Stockage S3 Parquet configuré
- ✅ Endpoint API créé
- ✅ Alertes Telegram testées et fonctionnelles
- ⏳ Table Athena à créer
- ⏳ Déploiement Terraform à faire
