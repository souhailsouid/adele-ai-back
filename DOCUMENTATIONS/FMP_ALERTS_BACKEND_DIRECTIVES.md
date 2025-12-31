# 🎯 Directives Backend : Intégration FMP Alerts

## ✅ Statut Actuel

**Toutes les routes FMP sont déjà implémentées !** ✅

- ✅ Routes API Gateway 2 configurées (`api-data-fmp-routes.tf`)
- ✅ Repository FMP implémenté (`fmp.repository.ts`)
- ✅ Service FMP implémenté (`fmp.service.ts`)
- ✅ Routes handlers implémentés (`fmp.routes.ts`)

## 📋 Endpoints Disponibles

### 1. Stock Grades
```
GET /fmp/grades/{symbol}
GET /fmp/grades-historical/{symbol}?limit=100
GET /fmp/grades-consensus/{symbol}
```

### 2. Price Target Consensus
```
GET /fmp/price-target-consensus/{symbol}
```

### 3. Insider Trading
```
GET /fmp/insider-trading/latest?page=0&limit=100&date=2025-02-04
GET /fmp/insider-trading/search?symbol=AAPL&transactionType=S-Sale
GET /fmp/insider-trading/reporting-name?name=Zuckerberg
```

**Base URL** : `https://{api-data-gateway-url}/prod`

---

## 🚀 Actions Requises

### 1. Créer le Service de Scoring (Nouveau)

**Fichier** : `services/api/src/services/market-signals.service.ts`

```typescript
import { FMPService } from './fmp.service';
import { logger } from '../utils/logger';

export interface MarketSignal {
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

export class MarketSignalsService {
  private fmpService: FMPService;

  constructor() {
    this.fmpService = new FMPService();
  }

  async scoreTicker(ticker: string, currentPrice?: number): Promise<MarketSignal> {
    const [grades, consensus, priceTarget, latestInsiders] = await Promise.all([
      this.fmpService.getStockGrades(ticker),
      this.fmpService.getStockGradesSummary(ticker),
      this.fmpService.getPriceTargetConsensus(ticker),
      this.fmpService.getLatestInsiderTrading({ limit: 50 }),
    ]);

    let bullishScore = 0;
    let bearishScore = 0;
    const signals: any = {};

    // 1. Grades (30 points)
    const latestGrade = grades.data?.[0];
    if (latestGrade?.action === 'upgrade') {
      bullishScore += 30;
      signals.grades = 'upgrade';
    } else if (latestGrade?.action === 'downgrade') {
      bearishScore += 30;
      signals.grades = 'downgrade';
    }

    // 2. Consensus (25 points)
    const consensusData = consensus.data?.[0];
    if (consensusData?.consensus === 'Buy' || consensusData?.consensus === 'Strong Buy') {
      bullishScore += 25;
      signals.consensus = 'Buy';
    } else if (consensusData?.consensus === 'Sell' || consensusData?.consensus === 'Strong Sell') {
      bearishScore += 25;
      signals.consensus = 'Sell';
    }

    // 3. Price Target (25 points)
    if (currentPrice && priceTarget.data?.[0]?.targetConsensus) {
      const target = priceTarget.data[0].targetConsensus;
      if (target > currentPrice) {
        const upside = ((target - currentPrice) / currentPrice) * 100;
        bullishScore += Math.min(25, upside * 2);
        signals.priceTargetUpside = upside;
      } else {
        const downside = ((currentPrice - target) / currentPrice) * 100;
        bearishScore += Math.min(25, downside * 2);
      }
    }

    // 4. Insider Trading (20 points)
    const tickerInsiders = latestInsiders.data?.filter((i: any) => i.symbol === ticker) || [];
    const buys = tickerInsiders.filter((i: any) => i.acquisitionOrDisposition === 'A').length;
    const sells = tickerInsiders.filter((i: any) => i.acquisitionOrDisposition === 'D').length;
    
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
}
```

---

### 2. Créer la Route API (Nouveau)

**Fichier** : `services/api/src/routes/market-signals.routes.ts`

```typescript
import { MarketSignalsService } from '../services/market-signals.service';
import { getPathParam, getQueryParam } from '../utils/event-helpers';

const marketSignalsService = new MarketSignalsService();

export const marketSignalsRoutes = [
  {
    method: 'GET',
    path: '/market-signals/{ticker}',
    handler: async (event) => {
      const ticker = getPathParam(event, 'ticker');
      if (!ticker) throw new Error('Missing ticker parameter');
      
      const currentPriceParam = getQueryParam(event, 'currentPrice');
      const currentPrice = currentPriceParam ? parseFloat(currentPriceParam) : undefined;
      
      const signal = await marketSignalsService.scoreTicker(ticker, currentPrice);
      return signal;
    },
  },
];
```

**Ajouter dans** : `services/api/src/router.ts`

```typescript
import { marketSignalsRoutes } from './routes/market-signals.routes';

// Dans la fonction findRoute, ajouter :
routes.push(...marketSignalsRoutes);
```

**Ajouter la route Terraform** : `infra/terraform/api.tf` (API Gateway 1)

```terraform
resource "aws_apigatewayv2_route" "get_market_signals" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /market-signals/{ticker}"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}
```

---

### 3. Créer le Worker Collector (Optionnel)

**Fichier** : `workers/collector-fmp-signals/src/index.ts`

```typescript
import { EventBridgeEvent } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';
import { MarketSignalsService } from '../../services/api/src/services/market-signals.service';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const marketSignalsService = new MarketSignalsService();

export const handler = async (event: EventBridgeEvent<'Scheduled Event', any>) => {
  console.log('FMP Signals Collector triggered');

  try {
    // 1. Récupérer les tickers à surveiller (depuis Supabase)
    const { data: watchedTickers } = await supabase
      .from('watched_tickers')
      .select('ticker')
      .eq('active', true);

    if (!watchedTickers || watchedTickers.length === 0) {
      console.log('No watched tickers found');
      return;
    }

    // 2. Pour chaque ticker, scorer
    for (const { ticker } of watchedTickers) {
      try {
        const signal = await marketSignalsService.scoreTicker(ticker);
        
        // 3. Si score > seuil, créer une alerte
        if (signal.bullishScore > 70 || signal.bearishScore > 70) {
          await supabase.from('fmp_signals').insert({
            ticker: signal.ticker,
            bullish_score: signal.bullishScore,
            bearish_score: signal.bearishScore,
            signals: signal.signals,
            created_at: signal.timestamp,
          });
          
          console.log(`Alert created for ${ticker}: ${signal.bullishScore > 70 ? 'BULLISH' : 'BEARISH'}`);
        }
      } catch (error) {
        console.error(`Error processing ticker ${ticker}:`, error);
      }
    }
  } catch (error) {
    console.error('Error in FMP Signals Collector:', error);
    throw error;
  }
};
```

---

### 4. Migration Supabase (Nouveau)

**Fichier** : `infra/supabase/migrations/021_add_fmp_signals.sql`

```sql
-- Table pour stocker les signaux FMP
CREATE TABLE IF NOT EXISTS fmp_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker VARCHAR(10) NOT NULL,
  bullish_score INTEGER CHECK (bullish_score >= 0 AND bullish_score <= 100),
  bearish_score INTEGER CHECK (bearish_score >= 0 AND bearish_score <= 100),
  signals JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX idx_fmp_signals_ticker ON fmp_signals(ticker);
CREATE INDEX idx_fmp_signals_created_at ON fmp_signals(created_at DESC);
CREATE INDEX idx_fmp_signals_scores ON fmp_signals(bullish_score, bearish_score);

-- RLS Policies
ALTER TABLE fmp_signals ENABLE ROW LEVEL SECURITY;

-- Policy : Lecture pour tous
DROP POLICY IF EXISTS "Allow read fmp_signals" ON fmp_signals;
CREATE POLICY "Allow read fmp_signals" ON fmp_signals
  FOR SELECT
  USING (true);

-- Policy : Écriture pour service_role uniquement
DROP POLICY IF EXISTS "Allow write fmp_signals for service_role" ON fmp_signals;
CREATE POLICY "Allow write fmp_signals for service_role" ON fmp_signals
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Activer Realtime (broadcast)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'fmp_signals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE fmp_signals;
  END IF;
END $$;

-- Trigger pour broadcast (optionnel, si vous utilisez broadcast)
CREATE OR REPLACE FUNCTION fmp_signals_broadcast_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO realtime.messages (topic, payload, extension)
  VALUES (
    'fmp_signals:events',
    json_build_object(
      'event', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'data', row_to_json(NEW)::jsonb
    )::jsonb,
    '{}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS fmp_signals_broadcast_trigger ON fmp_signals;
CREATE TRIGGER fmp_signals_broadcast_trigger
AFTER INSERT ON fmp_signals
FOR EACH ROW
EXECUTE FUNCTION fmp_signals_broadcast_trigger();
```

---

## 📝 Résumé des Actions

| Action | Fichier | Statut |
|--------|---------|--------|
| Routes FMP | `api-data-fmp-routes.tf` | ✅ Déjà fait |
| Repository FMP | `fmp.repository.ts` | ✅ Déjà fait |
| Service FMP | `fmp.service.ts` | ✅ Déjà fait |
| **Service Scoring** | `market-signals.service.ts` | ⚠️ **À créer** |
| **Route API** | `market-signals.routes.ts` | ⚠️ **À créer** |
| **Route Terraform** | `api.tf` | ⚠️ **À ajouter** |
| **Worker Collector** | `collector-fmp-signals/` | ⚠️ **Optionnel** |
| **Migration SQL** | `021_add_fmp_signals.sql` | ⚠️ **À créer** |

---

## 🧪 Test des Endpoints

```bash
# 1. Grades
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://{api-data-url}/fmp/grades/AAPL

# 2. Consensus
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://{api-data-url}/fmp/grades-consensus/AAPL

# 3. Price Target
curl -H "Authorization: Bearer $JWT_TOKEN" \
  https://{api-data-url}/fmp/price-target-consensus/AAPL

# 4. Insider Trading
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "https://{api-data-url}/fmp/insider-trading/latest?limit=50"

# 5. Market Signals (nouveau)
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "https://{api-url}/market-signals/AAPL?currentPrice=180"
```

---

## 📚 Documentation Complète

Voir : `DOCUMENTATIONS/FMP_ALERTS_INTEGRATION.md`

---

## ✅ Checklist

- [ ] Créer `market-signals.service.ts`
- [ ] Créer `market-signals.routes.ts`
- [ ] Ajouter route dans `router.ts`
- [ ] Ajouter route Terraform dans `api.tf`
- [ ] Créer migration SQL `021_add_fmp_signals.sql`
- [ ] Tester les endpoints
- [ ] Déployer avec Terraform
- [ ] (Optionnel) Créer worker `collector-fmp-signals`


