# Architecture Insiders API - Documentation Complète

## 📋 Vue d'ensemble

Architecture complète pour consulter, analyser et alerter sur les transactions insider (Form 4).

### Composants

1. **API de Consultation (Read API)** - Endpoints pour récupérer les données
2. **Cache DynamoDB** - Cache rapide pour les requêtes fréquentes
3. **Service d'Alertes** - Notifications Telegram/Discord/Email
4. **Service d'Analytics** - ROI et scoring des dirigeants

---

## 🚀 API Endpoints

### 1. GET /insiders/trending

Top entreprises avec le plus d'achats d'insiders.

**Query params:**
- `days` (défaut: 7) - Nombre de jours à analyser
- `limit` (défaut: 20) - Nombre de résultats

**Exemple:**
```bash
GET /insiders/trending?days=7&limit=20
```

**Réponse:**
```json
[
  {
    "ticker": "AAPL",
    "company_name": "Apple Inc.",
    "total_buy_value": 5000000,
    "total_sell_value": 1000000,
    "net_value": 4000000,
    "transaction_count": 15,
    "last_transaction_date": "2026-01-14"
  }
]
```

### 2. GET /insiders/company/{ticker}

Liste toutes les transactions pour une entreprise.

**Query params:**
- `limit` (défaut: 100) - Nombre de résultats
- `offset` (défaut: 0) - Pagination

**Exemple:**
```bash
GET /insiders/company/AAPL?limit=50&offset=0
```

### 3. GET /insiders/person/{cik}

Track record d'un dirigeant (cross-company).

**Exemple:**
```bash
GET /insiders/person/0000320193
```

**Réponse:**
```json
{
  "insider_cik": "0000320193",
  "insider_name": "Tim Cook",
  "total_companies": 1,
  "total_buy_value": 10000000,
  "total_sell_value": 2000000,
  "net_value": 8000000,
  "transaction_count": 25,
  "companies": [
    {
      "ticker": "AAPL",
      "company_name": "Apple Inc.",
      "transaction_count": 25,
      "net_value": 8000000
    }
  ]
}
```

### 4. GET /insiders/analytics/roi/{cik}

Calculer le ROI moyen d'un insider.

**Query params:**
- `days` (défaut: 365) - Période d'analyse

**Exemple:**
```bash
GET /insiders/analytics/roi/0000320193?days=365
```

**Réponse:**
```json
{
  "insider_cik": "0000320193",
  "insider_name": "Tim Cook",
  "total_transactions": 25,
  "buy_transactions": 15,
  "sell_transactions": 10,
  "avg_roi_pct": 25.5,
  "median_roi_pct": 22.3,
  "win_rate": 65.0,
  "reliability_score": "A",
  "total_buy_value": 10000000,
  "total_sell_value": 2000000
}
```

### 5. GET /insiders/analytics/company/{ticker}

ROI moyen pour une entreprise (tous les insiders).

**Exemple:**
```bash
GET /insiders/analytics/company/AAPL
```

### 6. GET /insiders/analytics/top

Top insiders par ROI.

**Query params:**
- `limit` (défaut: 20)
- `min_transactions` (défaut: 5)

### 7. POST /insiders/alerts/scan

Scanner les nouvelles transactions et générer des alertes.

**Body:**
```json
{
  "since_date": "2026-01-14",
  "min_buy_value": 100000,
  "min_sell_value": 500000,
  "alert_channels": ["telegram", "discord"],
  "telegram_bot_token": "...",
  "telegram_chat_id": "...",
  "discord_webhook_url": "..."
}
```

### 8. GET /insiders/alerts/daily-summary

Résumé quotidien des Top 5 Insider Buys.

---

## 💾 Architecture de Données

### S3 + Athena (Data Lake)

**Table:** `insider_trades`

- **Stockage:** Parquet sur S3 (partitionné par year/month)
- **Usage:** Analytics, requêtes complexes, historique complet
- **Coût:** ~$5/TB scanné (Athena)

### DynamoDB (Cache Rapide)

**Table:** `adel-ai-dev-insiders-cache`

- **Stockage:** Transactions importantes (> 100k$)
- **Usage:** API rapide (< 200ms)
- **TTL:** 7 jours
- **Coût:** PAY_PER_REQUEST (~$0.25/mois)

**Structure:**
```json
{
  "cache_key": "transaction_1234567890",
  "data": {
    "id": 1234567890,
    "company_id": 1,
    "insider_name": "Tim Cook",
    "total_value": 500000,
    ...
  },
  "ttl": 1736899200,
  "created_at": "2026-01-14T10:00:00Z"
}
```

---

## 🔄 Flux de Données

### 1. Parsing Form 4

```
Form 4 Parser Lambda
  ↓
Parse XML → Extraire transactions
  ↓
Buffer (50 transactions ou 30s)
  ↓
┌─────────────────┬──────────────────┐
│ S3 Parquet      │ DynamoDB Cache   │
│ (Toutes)       │ (> 100k$ uniquement)│
└─────────────────┴──────────────────┘
```

### 2. API Read

```
API Request
  ↓
Check DynamoDB Cache (si disponible)
  ↓
┌─────────────┐
│ Cache Hit?  │ → Oui → Retourner (fast)
└─────────────┘
  ↓ Non
Query Athena (analytics)
  ↓
Write to DynamoDB Cache
  ↓
Return results
```

---

## 📊 Reliability Score

Le **Reliability Score** (A, B, C, D, F) est calculé selon:

- **A:** ROI > 20%, win rate > 60%, > 10 transactions
- **B:** ROI > 10%, win rate > 50%, > 5 transactions
- **C:** ROI > 0%, win rate > 40%, > 3 transactions
- **D:** ROI > -10%, win rate > 30%
- **F:** Sinon

---

## 🔔 Service d'Alertes

### Configuration

**Seuils par défaut:**
- `minBuyValue`: 100,000$ (100k$)
- `minSellValue`: 500,000$ (500k$)

**Canaux:**
- Telegram (bot token + chat ID)
- Discord (webhook URL)
- Email (SES - TODO)

### Types d'alertes

- `buy` - Achat < 1M$
- `large_buy` - Achat >= 1M$
- `sell` - Vente < 2M$
- `large_sell` - Vente >= 2M$

### Priorités

- `high` - Transactions très importantes (> 1M$ buy, > 2M$ sell)
- `medium` - Transactions importantes (> 500k$ buy, > 1M$ sell)
- `low` - Transactions normales (> 100k$ buy, > 500k$ sell)

---

## 🚀 Déploiement

### 1. Créer la table DynamoDB

```bash
cd infra/terraform
terraform apply -target=aws_dynamodb_table.insiders_cache
```

### 2. Déployer les routes API

Les routes sont automatiquement ajoutées au router principal.

### 3. Configurer les variables d'environnement

**API Lambda:**
- `INSIDERS_CACHE_TABLE` - Nom de la table DynamoDB

**Form 4 Parser Lambda:**
- `INSIDERS_CACHE_TABLE` - Nom de la table DynamoDB

### 4. Tester les endpoints

```bash
# Trending
curl https://api.example.com/insiders/trending?days=7

# Company
curl https://api.example.com/insiders/company/AAPL

# Person
curl https://api.example.com/insiders/person/0000320193

# Analytics ROI
curl https://api.example.com/insiders/analytics/roi/0000320193
```

---

## 💡 Optimisations

### 1. Cache Strategy

- **DynamoDB:** Requêtes fréquentes (trending, company, person)
- **TTL:** 1 heure pour trending, 30 minutes pour company/person
- **Invalidation:** Automatique via TTL

### 2. Batch Writing

- **S3:** Écriture par batch de 50 transactions
- **DynamoDB:** Seulement transactions > 100k$

### 3. Rate Limiting

- **SEC API:** 10 req/s (géré par SQS + Lambda batch_size=1)
- **Athena:** Pas de limite, mais coût par requête

---

## 📈 Métriques à Monitorer

1. **API Latency:**
   - Cache hit rate (DynamoDB)
   - Athena query duration

2. **Cache Performance:**
   - DynamoDB read/write units
   - Cache hit ratio

3. **Alertes:**
   - Nombre d'alertes générées
   - Taux de succès (Telegram/Discord)

4. **Analytics:**
   - Temps de calcul ROI
   - Nombre d'insiders analysés

---

## 🔮 Améliorations Futures

1. **Pré-calcul des stats ROI** dans une table dédiée (évite recalcul)
2. **Webhooks** pour alertes personnalisées
3. **Machine Learning** pour prédire les mouvements insider
4. **Dashboard** temps réel des transactions
5. **Backtesting** des stratégies insider

---

## 📝 Notes

- **Architecture Extreme Budget:** DynamoDB PAY_PER_REQUEST, pas de provisioned capacity
- **S3 comme source de vérité:** Toutes les données sont dans S3 Parquet
- **DynamoDB comme cache:** Seulement pour performance API
- **TTL automatique:** DynamoDB supprime automatiquement les items expirés
