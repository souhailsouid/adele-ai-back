# 📋 Référence des Routes par API Gateway

## 🎯 Vue d'ensemble

- **API Gateway 1** : `{project}-{stage}-http` → **Application principale** (routes métier)
- **API Gateway 2** : `{project}-{stage}-http-data` → **Données brutes** (FMP + UW)

---

## 🚀 API Gateway 1 : Application Principale

**Nom** : `personamy-prod-http` (exemple)  
**URL** : `https://{api-id-1}.execute-api.{region}.amazonaws.com/prod`  
**Routes** : 38 routes

### 📊 Catégorie : Signals (ADEL AI)
```
GET  /signals
GET  /signals/{id}
POST /signals
POST /search
POST /chat
```

### 💰 Catégorie : Funds
```
POST /funds
GET  /funds
GET  /funds/{id}
GET  /funds/{id}/holdings
GET  /funds/{id}/filings
GET  /funds/{id}/filings/{filingId}
GET  /funds/{id}/filings/{filingId}/holdings
GET  /funds/{id}/portfolio
GET  /funds/{id}/diffs
GET  /funds/{id}/diffs/{ticker}
GET  /funds/{id}/changes
POST /funds/{id}/filings/{filingId}/calculate-diff
GET  /funds/{id}/ciks
POST /funds/{id}/ciks
DELETE /funds/{id}/ciks/{cik}
GET  /funds/{id}/transparency
```

**Nouvelles routes (remplacement APIs externes) :**
- `GET /funds/{id}/portfolio` : Portefeuille actuel (dédupliqué par défaut)
- `GET /funds/{id}/filings/{filingId}` : Détails d'un filing spécifique
- `GET /funds/{id}/filings/{filingId}/holdings` : Holdings d'un filing parsé (lire les données parsées)
- `GET /funds/{id}/diffs` : Différences entre filings
- `GET /funds/{id}/diffs/{ticker}` : Historique d'un ticker
- `GET /funds/{id}/changes` : Changements récents (>10% par défaut)
- `POST /funds/{id}/filings/{filingId}/calculate-diff` : Calculer les différences
- `GET /funds/{id}/transparency` : Transparency Mode (liste tous les CIK)

### 📅 Catégorie : SEC Calendar
```
GET  /sec/calendar
```

**Utilité :** Calendrier des publications SEC (trimestres, périodes de pic, deadlines)

### 🔔 Catégorie : Fund Notifications
```
GET  /funds/{id}/notifications/preferences
PUT  /funds/{id}/notifications/preferences
GET  /notifications/funds
POST /notifications/digest
GET  /notifications/digests
GET  /notifications/digests/{digestId}
```

**Utilité :** Système de notifications intelligent pour les changements de funds
- Filtrage du bruit (min_change_pct)
- Priorisation automatique (Exit = Critical, New = High)
- Daily digest pour regrouper les notifications

### 🔍 Catégorie : Fund Transparency & Deduplication
```
GET  /funds/{id}/transparency
```

**Utilité :** Transparency Mode - Affiche tous les CIK agrégés pour un fund
- Liste toutes les entités légales (CIK)
- Statistiques par CIK (filings, dernier filing)
- Évite le double comptage dans `/portfolio` (priorise CIK Primary)

### 🏢 Catégorie : Companies
```
POST /companies
GET  /companies
GET  /companies/{id}
GET  /companies/ticker/{ticker}
GET  /companies/{id}/filings
GET  /companies/{id}/events
GET  /companies/{id}/insider-trades
```

### 📈 Catégorie : Ticker Activity
```
GET /ticker-activity/{ticker}/quote
GET /ticker-activity/{ticker}/ownership
GET /ticker-activity/{ticker}/activity
GET /ticker-activity/{ticker}/hedge-funds
GET /ticker-activity/{ticker}/insiders
GET /ticker-activity/{ticker}/congress
GET /ticker-activity/{ticker}/options
GET /ticker-activity/{ticker}/dark-pool
GET /ticker-activity/{ticker}/stats
```

### 🔍 Catégorie : Ticker Insights
```
GET /ticker-insights/{ticker}
```

### 📊 Catégorie : Analysis Combinée (FMP + UW)
```
GET  /analysis/{ticker}/complete
GET  /analysis/{ticker}/divergence
GET  /analysis/{ticker}/valuation
GET  /analysis/{ticker}/earnings-prediction
GET  /analysis/{ticker}/risk
GET  /analysis/sector/{sector}
POST /screener/multi-criteria
GET  /institutions/{name}/tracking
```

### 🎯 Catégorie : Scoring & Gamma Squeeze
```
GET /ticker-analysis/{ticker}/score
GET /ticker-analysis/{ticker}/breakdown
GET /ticker-analysis/{ticker}/gamma-squeeze
```

---

## 📦 API Gateway 2 : Données Brutes

**Nom** : `personamy-prod-http-data` (exemple)  
**URL** : `https://{api-id-2}.execute-api.{region}.amazonaws.com/prod`  
**Routes** : 263 routes

### 💼 Catégorie : FMP (Financial Modeling Prep)
**Préfixe** : `/fmp/*`

#### Quote & Market Data
```
GET /fmp/quote/{symbol}
```

#### Financial Statements
```
GET /fmp/income-statement/{symbol}
GET /fmp/income-statement-ttm/{symbol}
GET /fmp/balance-sheet-statement/{symbol}
GET /fmp/balance-sheet-statement-ttm/{symbol}
GET /fmp/cash-flow-statement/{symbol}
GET /fmp/cash-flow-statement-ttm/{symbol}
```

#### Financial Ratios
```
GET /fmp/ratios/{symbol}
GET /fmp/key-metrics/{symbol}
GET /fmp/enterprise-values/{symbol}
```

#### Company Profile
```
GET /fmp/profile/{symbol}
GET /fmp/key-executives/{symbol}
GET /fmp/company-rating/{symbol}
```

#### Earnings
```
GET /fmp/earnings/{symbol}
GET /fmp/earnings-calendar
GET /fmp/earnings-surprises/{symbol}
```

#### Analyst Estimates
```
GET /fmp/analyst-estimates/{symbol}
GET /fmp/price-target/{symbol}
GET /fmp/recommendations/{symbol}
```

#### Market Data
```
GET /fmp/historical-price-full/{symbol}
GET /fmp/historical-price/{symbol}
GET /fmp/quote-short/{symbol}
GET /fmp/real-time-price/{symbol}
```

#### SEC Filings
```
GET /fmp/sec-filings/{symbol}
GET /fmp/insider-trading/{symbol}
GET /fmp/institutional-holders/{symbol}
GET /fmp/fund-holders/{symbol}
```

#### Stock Screener
```
GET /fmp/stock-screener
GET /fmp/stock-list
GET /fmp/stock-symbol-list
```

#### Market News
```
GET /fmp/stock-news/{symbol}
GET /fmp/stock-news
GET /fmp/stock-news-sentiment/{symbol}
```

#### ETFs & Mutual Funds
```
GET /fmp/etf-list
GET /fmp/etf-holders/{symbol}
GET /fmp/mutual-fund-holders/{symbol}
```

#### Commodities & Forex
```
GET /fmp/commodities
GET /fmp/forex
GET /fmp/forex/{symbol}
```

#### Crypto
```
GET /fmp/crypto
GET /fmp/crypto/{symbol}
```

#### Economic Indicators
```
GET /fmp/economic-indicators
GET /fmp/economic-indicator/{indicator}
```

#### ... (et ~100 autres routes FMP)

---

### 🐋 Catégorie : Unusual Whales
**Préfixe** : `/unusual-whales/*`

#### Institutions
```
GET /unusual-whales/institution-ownership/{ticker}
GET /unusual-whales/institution-activity/{ticker}
GET /unusual-whales/institution/{name}/activity
GET /unusual-whales/institution/{name}/holdings
GET /unusual-whales/institution/{name}/sectors
GET /unusual-whales/institution/{ticker}/ownership
GET /unusual-whales/institutions
GET /unusual-whales/institutions/latest-filings
```

#### Options Flow
```
GET /unusual-whales/options-flow/{ticker}
GET /unusual-whales/flow-alerts/{ticker}
GET /unusual-whales/greek-flow/{ticker}
GET /unusual-whales/stock/{ticker}/flow-recent
GET /unusual-whales/stock/{ticker}/flow-per-expiry
GET /unusual-whales/stock/{ticker}/flow-per-strike
GET /unusual-whales/stock/{ticker}/flow-alerts
```

#### Dark Pool
```
GET /unusual-whales/dark-pool/recent
GET /unusual-whales/dark-pool/{ticker}
```

#### Insiders
```
GET /unusual-whales/insider-trades/{ticker}
GET /unusual-whales/insider/transactions
GET /unusual-whales/insider/{sector}/sector-flow
GET /unusual-whales/insider/{ticker}
GET /unusual-whales/insider/{ticker}/ticker-flow
GET /unusual-whales/stock/{ticker}/insider-buy-sells
GET /unusual-whales/market/insider-buy-sells
```

#### Congress
```
GET /unusual-whales/congress-trader
GET /unusual-whales/congress-late-reports
GET /unusual-whales/congress-recent-trades
GET /unusual-whales/congress-trades/{ticker}
```

#### Options & Greeks
```
GET /unusual-whales/option-chains/{ticker}
GET /unusual-whales/stock/{ticker}/option-chains
GET /unusual-whales/stock/{ticker}/greeks
GET /unusual-whales/stock/{ticker}/greek-flow
GET /unusual-whales/stock/{ticker}/greek-flow/{expiry}
GET /unusual-whales/stock/{ticker}/greek-exposure
GET /unusual-whales/stock/{ticker}/greek-exposure/expiry
GET /unusual-whales/stock/{ticker}/greek-exposure/strike
GET /unusual-whales/stock/{ticker}/greek-exposure/strike-expiry
```

#### Short Interest
```
GET /unusual-whales/shorts/{ticker}/data
GET /unusual-whales/shorts/{ticker}/ftds
GET /unusual-whales/shorts/{ticker}/interest-float
GET /unusual-whales/shorts/{ticker}/volume-and-ratio
GET /unusual-whales/shorts/{ticker}/volumes-by-exchange
```

#### Earnings
```
GET /unusual-whales/earnings/afterhours
GET /unusual-whales/earnings/premarket
GET /unusual-whales/earnings/{ticker}
```

#### ETFs
```
GET /unusual-whales/etfs/{ticker}/exposure
GET /unusual-whales/etfs/{ticker}/holdings
GET /unusual-whales/etfs/{ticker}/in-outflow
GET /unusual-whales/etfs/{ticker}/info
GET /unusual-whales/etfs/{ticker}/weights
```

#### Market Data
```
GET /unusual-whales/market/correlations
GET /unusual-whales/market/economic-calendar
GET /unusual-whales/market/fda-calendar
GET /unusual-whales/market/market-tide
GET /unusual-whales/market/oi-change
GET /unusual-whales/market/sector-etfs
GET /unusual-whales/market/spike
GET /unusual-whales/market/top-net-impact
GET /unusual-whales/market/total-options-volume
GET /unusual-whales/market/{sector}/sector-tide
GET /unusual-whales/market/{ticker}/etf-tide
```

#### Stock Data
```
GET /unusual-whales/stock/{ticker}/info
GET /unusual-whales/stock/{ticker}/ohlc/{candle_size}
GET /unusual-whales/stock/{ticker}/max-pain
GET /unusual-whales/stock/{ticker}/spot-exposures
GET /unusual-whales/stock/{ticker}/spot-exposures/expiry-strike
GET /unusual-whales/stock/{ticker}/spot-exposures/strike
GET /unusual-whales/stock/{ticker}/stock-state
GET /unusual-whales/stock/{ticker}/volatility/realized
GET /unusual-whales/stock/{ticker}/volatility/stats
GET /unusual-whales/stock/{ticker}/volatility/term-structure
```

#### Alerts
```
GET /unusual-whales/alerts
GET /unusual-whales/alert-configurations
```

#### ... (et ~150 autres routes UW)

---

## 🔑 Comment identifier l'API Gateway à utiliser ?

### Règle simple :
1. **Si la route commence par `/fmp/` ou `/unusual-whales/`** → **API Gateway 2** (données brutes)
2. **Sinon** → **API Gateway 1** (application principale)

### Exemples :
```typescript
// API Gateway 1 (application)
const API_MAIN = process.env.REACT_APP_API_MAIN_URL;
fetch(`${API_MAIN}/ticker-insights/AAPL`);
fetch(`${API_MAIN}/analysis/AAPL/complete`);

// API Gateway 2 (données brutes)
const API_DATA = process.env.REACT_APP_API_DATA_URL;
fetch(`${API_DATA}/fmp/quote/AAPL`);
fetch(`${API_DATA}/unusual-whales/options-flow/AAPL`);
```

---

## 📊 Statistiques

| API Gateway | Routes | Catégories |
|------------|--------|------------|
| **API Gateway 1** | 38 | Signals, Funds, Companies, Ticker Activity, Insights, Analysis, Scoring |
| **API Gateway 2** | 263 | FMP (100+), Unusual Whales (150+) |
| **Total** | 301 | - |

---

## 🚀 Déploiement

Après `terraform apply`, vous obtiendrez deux URLs :

```bash
# Outputs Terraform
api_gateway_url = "https://xxx.execute-api.eu-west-3.amazonaws.com/prod"
api_data_gateway_url = "https://yyy.execute-api.eu-west-3.amazonaws.com/prod"
```

---

**Dernière mise à jour** : 2025-01-05

