# 🚨 Guide d'Intégration : FMP Alerts & Market Signals

## 📋 Vue d'ensemble

Ce guide explique comment intégrer les endpoints FMP pour créer un système d'alertes quasi real-time capable de détecter les événements qui peuvent faire "trembler les marchés" pour un ticker donné.

### Architecture

```
RSS Feeds (Macro) + FMP APIs (Corporate) → Backend Scoring → Alertes Frontend
```

- **RSS Feeds** : News macroéconomiques (CPI, Fed, NFP) et breaking news
- **FMP APIs** : Signaux company-specific (grades, insider trading, price targets)
- **Backend** : Agrégation, scoring bullish/bearish, génération d'alertes
- **Frontend** : Notifications push/in-app en temps réel

---

## 🎯 Endpoints FMP Disponibles

### 1. Stock Grades (Analyst Ratings)

#### Latest Stock Grades
```typescript
GET /fmp/grades/{symbol}
```

**Exemple** :
```bash
GET https://{api-data-url}/fmp/grades/AAPL
```

**Réponse** :
```json
[
  {
    "symbol": "AAPL",
    "date": "2025-01-31",
    "gradingCompany": "Morgan Stanley",
    "previousGrade": "Overweight",
    "newGrade": "Overweight",
    "action": "maintain"
  }
]
```

**Signaux** :
- `action: "upgrade"` → **Bullish** 🟢
- `action: "downgrade"` → **Bearish** 🔴
- `action: "maintain"` → **Neutre** ⚪

---

#### Historical Stock Grades
```typescript
GET /fmp/grades-historical/{symbol}?limit=100
```

**Exemple** :
```bash
GET https://{api-data-url}/fmp/grades-historical/AAPL?limit=100
```

**Réponse** :
```json
[
  {
    "symbol": "AAPL",
    "date": "2025-02-01",
    "analystRatingsBuy": 8,
    "analystRatingsHold": 14,
    "analystRatingsSell": 2,
    "analystRatingsStrongSell": 2
  }
]
```

**Signaux** :
- Augmentation de `analystRatingsBuy` → **Bullish** 🟢
- Augmentation de `analystRatingsSell` → **Bearish** 🔴

---

#### Stock Grades Consensus (Summary)
```typescript
GET /fmp/grades-consensus/{symbol}
```

**Exemple** :
```bash
GET https://{api-data-url}/fmp/grades-consensus/AAPL
```

**Réponse** :
```json
[
  {
    "symbol": "AAPL",
    "strongBuy": 1,
    "buy": 29,
    "hold": 11,
    "sell": 4,
    "strongSell": 0,
    "consensus": "Buy"
  }
]
```

**Signaux** :
- `consensus: "Buy"` ou `"Strong Buy"` → **Bullish** 🟢
- `consensus: "Sell"` ou `"Strong Sell"` → **Bearish** 🔴
- Baisse du consensus (ex: "Buy" → "Hold") → **Bearish** 🔴

---

### 2. Price Target Consensus

```typescript
GET /fmp/price-target-consensus/{symbol}
```

**Exemple** :
```bash
GET https://{api-data-url}/fmp/price-target-consensus/AAPL
```

**Réponse** :
```json
[
  {
    "symbol": "AAPL",
    "targetHigh": 300,
    "targetLow": 200,
    "targetConsensus": 251.7,
    "targetMedian": 258
  }
]
```

**Signaux** :
- `targetConsensus > currentPrice` → **Bullish** (upside potentiel) 🟢
- `targetConsensus < currentPrice` → **Bearish** (downside) 🔴
- Hausse significative du `targetConsensus` → **Bullish** 🟢
- Baisse du `targetConsensus` → **Bearish** 🔴

---

### 3. Insider Trading

#### Latest Insider Trading
```typescript
GET /fmp/insider-trading/latest?page=0&limit=100&date=2025-02-04
```

**Exemple** :
```bash
GET https://{api-data-url}/fmp/insider-trading/latest?page=0&limit=100
```

**Réponse** :
```json
[
  {
    "symbol": "APA",
    "filingDate": "2025-02-04",
    "transactionDate": "2025-02-01",
    "transactionType": "M-Exempt",
    "acquisitionOrDisposition": "A",
    "securitiesTransacted": 3450,
    "price": 0,
    "reportingName": "Hoyt Rebecca A",
    "typeOfOwner": "officer: Sr. VP, Chief Acct Officer"
  }
]
```

**Signaux** :
- Cluster d'achats (`acquisitionOrDisposition: "A"`) → **Bullish** 🟢
- Ventes massives (`acquisitionOrDisposition: "D"`) → **Bearish** 🔴
- Achats par CEO/Directors → **Bullish fort** 🟢🟢

---

#### Search Insider Trades
```typescript
GET /fmp/insider-trading/search?symbol=AAPL&transactionType=S-Sale&page=0&limit=100
```

**Exemple** :
```bash
GET https://{api-data-url}/fmp/insider-trading/search?symbol=AAPL
```

**Paramètres** :
- `symbol` : Ticker (optionnel)
- `transactionType` : Type de transaction (ex: "S-Sale", "M-Exempt")
- `page` : Page (0-indexed)
- `limit` : Nombre de résultats (max 1000)

---

#### Search by Reporting Name
```typescript
GET /fmp/insider-trading/reporting-name?name=Zuckerberg
```

**Exemple** :
```bash
GET https://{api-data-url}/fmp/insider-trading/reporting-name?name=Zuckerberg
```

**Réponse** :
```json
[
  {
    "reportingCik": "0001548760",
    "reportingName": "Zuckerberg Mark"
  }
]
```

---

## 🔧 Intégration Backend

### 1. Repository (Déjà Implémenté)

Les méthodes existent déjà dans `services/api/src/repositories/fmp.repository.ts` :

```typescript
// Grades
await fmpRepository.getStockGrades(symbol);
await fmpRepository.getHistoricalStockGrades({ symbol, limit });
await fmpRepository.getStockGradesSummary(symbol);

// Price Targets
await fmpRepository.getPriceTargetConsensus(symbol);

// Insider Trading
await fmpRepository.getLatestInsiderTrading({ date, page, limit });
await fmpRepository.searchInsiderTrading({ symbol, transactionType, page, limit });
await fmpRepository.searchInsiderTradingByReportingName(name);
```

### 2. Service (Déjà Implémenté)

Les services existent dans `services/api/src/services/fmp.service.ts` :

```typescript
const fmpService = new FMPService();

// Grades
const grades = await fmpService.getStockGrades(symbol);
const historicalGrades = await fmpService.getHistoricalStockGrades({ symbol, limit });
const consensus = await fmpService.getStockGradesSummary(symbol);

// Price Targets
const priceTarget = await fmpService.getPriceTargetConsensus(symbol);

// Insider Trading
const latestInsiders = await fmpService.getLatestInsiderTrading({ date, page, limit });
```

### 3. Routes (Déjà Implémentées)

Les routes sont dans `services/api/src/routes/fmp.routes.ts` et `infra/terraform/api-data-fmp-routes.tf`.

---

## 🎯 Système de Scoring Bullish/Bearish

### Algorithme de Scoring

```typescript
interface MarketSignal {
  ticker: string;
  bullishScore: number; // 0-100
  bearishScore: number; // 0-100
  signals: {
    grades?: 'upgrade' | 'downgrade' | 'maintain';
    consensus?: 'Buy' | 'Hold' | 'Sell';
    priceTargetUpside?: number; // %
    insiderBuys?: number;
    insiderSells?: number;
  };
  timestamp: string;
}

async function scoreTicker(ticker: string): Promise<MarketSignal> {
  const [grades, consensus, priceTarget, latestInsiders] = await Promise.all([
    fmpService.getStockGrades(ticker),
    fmpService.getStockGradesSummary(ticker),
    fmpService.getPriceTargetConsensus(ticker),
    fmpService.getLatestInsiderTrading({ limit: 50 }),
  ]);

  let bullishScore = 0;
  let bearishScore = 0;
  const signals: any = {};

  // 1. Grades (30 points)
  const latestGrade = grades[0];
  if (latestGrade?.action === 'upgrade') {
    bullishScore += 30;
    signals.grades = 'upgrade';
  } else if (latestGrade?.action === 'downgrade') {
    bearishScore += 30;
    signals.grades = 'downgrade';
  }

  // 2. Consensus (25 points)
  const consensusData = consensus[0];
  if (consensusData?.consensus === 'Buy' || consensusData?.consensus === 'Strong Buy') {
    bullishScore += 25;
    signals.consensus = 'Buy';
  } else if (consensusData?.consensus === 'Sell' || consensusData?.consensus === 'Strong Sell') {
    bearishScore += 25;
    signals.consensus = 'Sell';
  }

  // 3. Price Target (25 points)
  const currentPrice = await getCurrentPrice(ticker); // À implémenter
  if (priceTarget[0]?.targetConsensus > currentPrice) {
    const upside = ((priceTarget[0].targetConsensus - currentPrice) / currentPrice) * 100;
    bullishScore += Math.min(25, upside * 2); // Max 25 points
    signals.priceTargetUpside = upside;
  } else {
    const downside = ((currentPrice - priceTarget[0].targetConsensus) / currentPrice) * 100;
    bearishScore += Math.min(25, downside * 2);
  }

  // 4. Insider Trading (20 points)
  const tickerInsiders = latestInsiders.filter(i => i.symbol === ticker);
  const buys = tickerInsiders.filter(i => i.acquisitionOrDisposition === 'A').length;
  const sells = tickerInsiders.filter(i => i.acquisitionOrDisposition === 'D').length;
  
  if (buys > sells * 2) {
    bullishScore += 20;
    signals.insiderBuys = buys;
  } else if (sells > buys * 2) {
    bearishScore += 20;
    signals.insiderSells = sells;
  }

  return {
    ticker,
    bullishScore: Math.min(100, bullishScore),
    bearishScore: Math.min(100, bearishScore),
    signals,
    timestamp: new Date().toISOString(),
  };
}
```

---

## 🚨 Système d'Alertes

### Déclenchement d'Alerte

Une alerte est déclenchée quand :

1. **Upgrade + Consensus Buy + Price Target Upside + Insider Buys** → **High Bullish** (score > 70)
2. **Downgrade + Consensus Sell + Price Target Downside + Insider Sells** → **High Bearish** (score > 70)
3. **Changement significatif** : Consensus passe de "Buy" à "Hold" ou "Sell"
4. **Cluster d'insider buys** : > 5 achats nets dans les 7 derniers jours

### Structure d'Alerte

```typescript
interface MarketAlert {
  id: string;
  ticker: string;
  type: 'bullish' | 'bearish';
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  signals: MarketSignal['signals'];
  message: string;
  timestamp: string;
  source: 'fmp' | 'rss' | 'combined';
}
```

---

## 📡 Intégration Frontend

### Hook React pour Alertes

```typescript
// hooks/useMarketAlerts.ts
import { useState, useEffect } from 'react';
import { useRealtimeSignals } from './useRealtimeSignals';

export function useMarketAlerts(ticker?: string) {
  const [alerts, setAlerts] = useState<MarketAlert[]>([]);
  const { signals } = useRealtimeSignals();

  useEffect(() => {
    // Écouter les signaux RSS + FMP
    const relevantSignals = signals.filter(s => 
      !ticker || s.raw_data?.symbol === ticker
    );
    
    // Convertir en alertes
    const newAlerts = relevantSignals.map(signal => ({
      id: signal.id,
      ticker: signal.raw_data?.symbol || 'N/A',
      type: signal.extracted_data?.surprise === 'positive' ? 'bullish' : 'bearish',
      severity: signal.priority || 'medium',
      score: signal.importance_score || 5,
      signals: signal.extracted_data,
      message: signal.raw_data?.title || '',
      timestamp: signal.timestamp,
      source: signal.source,
    }));
    
    setAlerts(newAlerts);
  }, [signals, ticker]);

  return { alerts };
}
```

---

## 🔄 Workflow Complet

### 1. Collecte (Backend)

```typescript
// workers/collector-fmp-signals/src/index.ts
export const handler = async () => {
  // 1. Récupérer les tickers à surveiller (depuis Supabase)
  const watchedTickers = await getWatchedTickers();
  
  // 2. Pour chaque ticker, scorer
  for (const ticker of watchedTickers) {
    const signal = await scoreTicker(ticker);
    
    // 3. Si score > seuil, créer une alerte
    if (signal.bullishScore > 70 || signal.bearishScore > 70) {
      await createAlert(signal);
    }
  }
};
```

### 2. Stockage (Supabase)

```sql
-- Table pour stocker les signaux FMP
CREATE TABLE IF NOT EXISTS fmp_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(10) NOT NULL,
  bullish_score INTEGER,
  bearish_score INTEGER,
  signals JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX idx_fmp_signals_ticker ON fmp_signals(ticker);
CREATE INDEX idx_fmp_signals_created_at ON fmp_signals(created_at DESC);
```

### 3. Diffusion (Realtime)

Utiliser le même système de broadcast que pour les signaux RSS (migration `019_realtime_broadcast_alternative.sql`).

---

## ✅ Checklist d'Implémentation

### Backend

- [x] Routes API Gateway 2 configurées
- [x] Repository FMP implémenté
- [x] Service FMP implémenté
- [ ] Fonction `scoreTicker()` à créer
- [ ] Worker `collector-fmp-signals` à créer
- [ ] Table Supabase `fmp_signals` à créer
- [ ] Trigger Realtime pour `fmp_signals` à créer

### Frontend

- [ ] Hook `useMarketAlerts` à créer
- [ ] Composant `MarketAlertCard` à créer
- [ ] Intégration avec Realtime
- [ ] Notifications push/in-app

---

## 📚 Références

- **FMP API Docs** : https://financialmodelingprep.com/developer/docs/
- **Routes existantes** : `infra/terraform/api-data-fmp-routes.tf`
- **Repository** : `services/api/src/repositories/fmp.repository.ts`
- **Service** : `services/api/src/services/fmp.service.ts`
- **Routes** : `services/api/src/routes/fmp.routes.ts`

---

## 🚀 Prochaines Étapes

1. **Créer le worker `collector-fmp-signals`** pour scorer les tickers
2. **Créer la table Supabase `fmp_signals`**
3. **Intégrer avec le système d'alertes existant** (RSS)
4. **Créer le hook frontend `useMarketAlerts`**
5. **Tester avec des tickers réels** (AAPL, TSLA, NVDA)


