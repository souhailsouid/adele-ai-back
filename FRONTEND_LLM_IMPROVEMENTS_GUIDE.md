# 🚀 Guide Frontend : Implémentation des Analyses LLM Enrichies

## 📋 Vue d'ensemble

Les 3 fonctionnalités d'analyse LLM ont été **considérablement enrichies** avec de nouvelles métriques, analyses approfondies et recommandations actionnables.

---

## 1️⃣ Options Flow Analysis (ENRICHI)

### Endpoint

```
POST /ai/options-flow-analysis
```

### Request

```typescript
{
  ticker: string; // Ex: "NVDA"
}
```

### Response Structure (ENRICHI)

```typescript
{
  success: boolean;
  ticker: string;
  signal_type: "unusual_options_flow" | "gamma_squeeze" | "dark_pool_spike" | "insider_activity";
  
  // ✨ NOUVELLES métriques enrichies
  metrics: {
    // Métriques de base (existantes)
    volume_vs_avg?: number;
    call_put_ratio?: number;
    expirations?: string[];
    biggest_trade?: {
      size: number;
      direction: "call" | "put";
      strike?: number;
      expiry?: string;
    };
    total_premium?: number;
    unusual_volume?: boolean;
    
    // ✨ NOUVEAU : Open Interest Changes
    open_interest_change?: {
      total_change: number;
      call_oi_change: number;
      put_oi_change: number;
      max_oi_strikes?: Array<{
        strike: number;
        expiry: string;
        oi_change: number;
        type: "call" | "put";
      }>;
    };
    
    // ✨ NOUVEAU : Implied Volatility
    implied_volatility?: {
      current: number;
      percentile?: number; // 0-100
      vs_historical_avg?: number;
      skew?: number; // Put skew (négatif = puts plus chères)
    };
    
    // ✨ NOUVEAU : Volume Profile
    volume_profile?: {
      by_strike?: Array<{
        strike: number;
        call_volume: number;
        put_volume: number;
      }>;
      by_expiry?: Array<{
        expiry: string;
        total_volume: number;
        call_ratio: number;
      }>;
    };
    
    // ✨ NOUVEAU : Unusual Activity
    unusual_activity?: {
      sweeps?: number;
      blocks?: number;
      largest_sweep?: {
        size: number;
        direction: "call" | "put";
        strike: number;
        expiry: string;
      };
    };
    
    // ✨ NOUVEAU : Max Pain
    max_pain?: {
      current: number;
      price_distance?: number; // Distance du prix actuel en %
      oi_at_max_pain?: number;
    };
    
    // ✨ NOUVEAU : Price Action
    price_action?: {
      current_price: number;
      support?: number;
      resistance?: number;
      trend?: "bullish" | "bearish" | "neutral";
      rsi?: number;
      volume_trend?: "increasing" | "decreasing" | "stable";
    };
  };
  
  // ✨ NOUVELLE analyse enrichie
  analysis: {
    observation: string; // Ce que l'IA observe (3-4 lignes)
    interpretation: string; // Interprétation approfondie (4-5 lignes)
    attention_level: "faible" | "moyen" | "élevé" | "critique";
    
    // ✨ NOUVEAU : Strategy Hypothesis
    strategy_hypothesis?: {
      primary: "gamma_squeeze" | "hedging" | "speculation" | "earnings_play" | "unknown";
      confidence: number; // 0-1
      reasoning: string;
    };
    
    // ✨ NOUVEAU : Key Insights avec impact
    key_insights: Array<{
      insight: string;
      impact: "faible" | "moyen" | "élevé" | "critique";
      evidence?: string;
    }>;
    
    // ✨ NOUVEAU : Scénarios multiples
    scenarios?: {
      bullish: {
        probability: number; // 0-1
        price_target?: number;
        conditions: string;
      };
      bearish: {
        probability: number;
        price_target?: number;
        conditions: string;
      };
      neutral: {
        probability: number;
        price_range?: [number, number];
        conditions: string;
      };
    };
    
    // ✨ NOUVEAU : Recommandations détaillées
    recommendations?: Array<{
      action: "buy_calls" | "buy_puts" | "sell_calls" | "sell_puts" | "spread" | "wait" | "avoid";
      strike?: number;
      expiry?: string;
      reasoning: string;
      risk_level: "low" | "medium" | "high";
    }>;
    
    // ✨ NOUVEAU : Warnings
    warnings?: string[];
    
    // ✨ NOUVEAU : Next Signals to Watch
    next_signals_to_watch?: string[];
  };
  
  cached: boolean;
  timestamp: string;
}
```

### Exemple de Réponse

```json
{
  "success": true,
  "ticker": "NVDA",
  "signal_type": "gamma_squeeze",
  "metrics": {
    "volume_vs_avg": 15.5,
    "call_put_ratio": 0.85,
    "open_interest_change": {
      "total_change": 500000,
      "call_oi_change": 400000,
      "put_oi_change": 100000,
      "max_oi_strikes": [
        {
          "strike": 500,
          "expiry": "2025-12-20",
          "oi_change": 200000,
          "type": "call"
        }
      ]
    },
    "implied_volatility": {
      "current": 0.45,
      "percentile": 85
    },
    "unusual_activity": {
      "sweeps": 15,
      "blocks": 8
    },
    "max_pain": {
      "current": 495,
      "price_distance": 0.01
    },
    "price_action": {
      "current_price": 500,
      "support": 480,
      "resistance": 520,
      "trend": "bullish"
    }
  },
  "analysis": {
    "observation": "Volume d'options 15.5x supérieur à la moyenne avec 85% de calls...",
    "interpretation": "Accumulation massive de calls suggère un setup de gamma squeeze...",
    "attention_level": "critique",
    "strategy_hypothesis": {
      "primary": "gamma_squeeze",
      "confidence": 0.85,
      "reasoning": "Volume élevé, OI massif, expirations courtes"
    },
    "scenarios": {
      "bullish": {
        "probability": 0.5,
        "price_target": 520,
        "conditions": "Si prix dépasse 510 avec volume"
      },
      "bearish": {
        "probability": 0.3,
        "price_target": 480,
        "conditions": "Si prix casse 495"
      },
      "neutral": {
        "probability": 0.2,
        "price_range": [490, 510],
        "conditions": "Consolidation"
      }
    },
    "recommendations": [
      {
        "action": "buy_calls",
        "strike": 500,
        "expiry": "2025-12-20",
        "reasoning": "Setup de gamma squeeze avec probabilité élevée",
        "risk_level": "high"
      }
    ],
    "warnings": [
      "IV très élevée (85e percentile), risque de crush après earnings"
    ]
  }
}
```

### Recommandations d'Implémentation Frontend

#### 1. **Affichage Principal**

```tsx
// Composant principal
<OptionsFlowAnalysis 
  ticker="NVDA"
  analysis={data.analysis}
  metrics={data.metrics}
/>

// Structure recommandée :
- Header : Ticker + Signal Type + Attention Level (badge coloré)
- Observation + Interpretation (texte enrichi)
- Strategy Hypothesis (badge + confidence bar)
- Key Insights (liste avec badges d'impact)
- Scénarios (3 cards avec probabilités en barres)
- Recommandations (cards avec action, strike, expiry, risk level)
- Warnings (alertes rouges)
- Next Signals (liste)
```

#### 2. **Métriques Enrichies**

```tsx
// Section Open Interest
<OIMetrics 
  totalChange={metrics.open_interest_change?.total_change}
  callChange={metrics.open_interest_change?.call_oi_change}
  putChange={metrics.open_interest_change?.put_oi_change}
  maxOIStrikes={metrics.open_interest_change?.max_oi_strikes}
/>

// Section IV
<IVMetrics 
  current={metrics.implied_volatility?.current}
  percentile={metrics.implied_volatility?.percentile}
  // Afficher percentile en barre de progression colorée
/>

// Section Unusual Activity
<UnusualActivity 
  sweeps={metrics.unusual_activity?.sweeps}
  blocks={metrics.unusual_activity?.blocks}
  largestSweep={metrics.unusual_activity?.largest_sweep}
/>

// Section Max Pain
<MaxPainMetrics 
  current={metrics.max_pain?.current}
  priceDistance={metrics.max_pain?.price_distance}
  currentPrice={metrics.price_action?.current_price}
/>
```

#### 3. **Scénarios**

```tsx
<ScenariosPanel>
  <ScenarioCard 
    type="bullish"
    probability={scenarios.bullish.probability}
    priceTarget={scenarios.bullish.price_target}
    conditions={scenarios.bullish.conditions}
  />
  <ScenarioCard type="bearish" ... />
  <ScenarioCard type="neutral" ... />
</ScenariosPanel>
```

#### 4. **Recommandations**

```tsx
<RecommendationsList>
  {recommendations.map(rec => (
    <RecommendationCard
      action={rec.action} // Badge coloré selon action
      strike={rec.strike}
      expiry={rec.expiry}
      reasoning={rec.reasoning}
      riskLevel={rec.risk_level} // Badge risk
    />
  ))}
</RecommendationsList>
```

---

## 2️⃣ Institution Moves Analysis (ENRICHI)

### Endpoint

```
POST /ai/institution-moves-analysis
```

### Request

```typescript
{
  institution_cik: string; // Ex: "0001364742"
  institution_name: string; // Ex: "BLACKROCK, INC."
  period?: "1M" | "3M" | "6M" | "1Y"; // Défaut: "3M"
}
```

### Response Structure (ENRICHI)

```typescript
{
  success: boolean;
  institution_cik: string;
  institution_name: string;
  
  analysis: {
    summary: string; // Résumé en 4-5 lignes
    
    // ✨ NOUVEAU : Strategy Insight
    strategy_insight?: {
      primary_strategy: "sector_rotation" | "style_shift" | "conviction_building" | "risk_reduction" | "opportunistic" | "unknown";
      confidence: number; // 0-1
      reasoning: string;
      evidence?: string[];
    };
    
    // ✨ ENRICHI : Key Moves
    key_moves: Array<{
      ticker: string;
      action: "buy" | "sell" | "hold" | "trim";
      magnitude: "faible" | "moyen" | "élevé" | "critique";
      change_pct?: number; // +25%
      reason: string; // 2-3 lignes
      conviction_level?: "low" | "medium" | "high" | "very_high";
      copy_trade_potential?: "low" | "medium" | "high";
    }>;
    
    // ✨ NOUVEAU : Portfolio Analysis
    portfolio_analysis?: {
      concentration_risk: "low" | "medium" | "high";
      sector_bets?: Array<{
        sector: string;
        bet: "overweight" | "underweight" | "neutral";
        reasoning: string;
      }>;
      style_analysis?: {
        current_style: "growth" | "value" | "momentum" | "blend";
        style_shift: boolean;
        reasoning: string;
      };
    };
    
    // ✨ NOUVEAU : Performance Analysis
    performance_analysis?: {
      overall_performance: "outperforming" | "underperforming" | "in_line";
      top_performers?: Array<{
        ticker: string;
        pnl_pct: number;
        contribution: number;
      }>;
      underperformers?: Array<{
        ticker: string;
        pnl_pct: number;
        contribution: number;
      }>;
      insights?: string;
    };
    
    attention_level: "faible" | "moyen" | "élevé" | "critique";
    
    // ✨ NOUVEAU : Copy Trade Opportunities
    copy_trade_opportunities?: Array<{
      ticker: string;
      action: "buy" | "sell";
      reasoning: string;
      risk_level: "low" | "medium" | "high";
      entry_strategy: "DCA sur 2 semaines" | "Entry immédiat" | "Wait for pullback";
    }>;
    
    warnings?: string[];
    next_moves_to_watch?: string[];
  };
  
  period?: string;
  cached: boolean;
  timestamp: string;
}
```

### Exemple de Réponse

```json
{
  "success": true,
  "institution_cik": "0001364742",
  "institution_name": "BLACKROCK, INC.",
  "analysis": {
    "summary": "BLACKROCK montre une rotation majeure vers Tech (+10% exposure)...",
    "strategy_insight": {
      "primary_strategy": "sector_rotation",
      "confidence": 0.80,
      "reasoning": "Rotation significative vers Tech, réductions dans Energy",
      "evidence": ["Tech +10%", "Energy -5%", "Nouvelles positions NVDA, AMD"]
    },
    "key_moves": [
      {
        "ticker": "NVDA",
        "action": "buy",
        "magnitude": "critique",
        "change_pct": 0.50,
        "reason": "Nouvelle position majeure (+$500M) avant cycle haussier tech",
        "conviction_level": "very_high",
        "copy_trade_potential": "high"
      }
    ],
    "portfolio_analysis": {
      "concentration_risk": "medium",
      "sector_bets": [
        {
          "sector": "Technology",
          "bet": "overweight",
          "reasoning": "Exposition 35% vs marché 25%"
        }
      ],
      "style_analysis": {
        "current_style": "growth",
        "style_shift": false,
        "reasoning": "Maintenu focus sur growth stocks"
      }
    },
    "performance_analysis": {
      "overall_performance": "outperforming",
      "top_performers": [
        {
          "ticker": "AAPL",
          "pnl_pct": 0.25,
          "contribution": 0.15
        }
      ]
    },
    "copy_trade_opportunities": [
      {
        "ticker": "NVDA",
        "action": "buy",
        "reasoning": "Nouvelle position majeure avec conviction élevée",
        "risk_level": "medium",
        "entry_strategy": "DCA sur 2 semaines"
      }
    ]
  }
}
```

### Recommandations d'Implémentation Frontend

#### 1. **Affichage Principal**

```tsx
<InstitutionMovesAnalysis 
  institution={data.institution_name}
  analysis={data.analysis}
/>

// Structure recommandée :
- Header : Institution Name + Period + Attention Level
- Summary (texte)
- Strategy Insight (badge + confidence + evidence)
- Key Moves (tableau avec action, magnitude, conviction, copy trade potential)
- Portfolio Analysis (concentration risk, sector bets, style)
- Performance Analysis (overall + top/underperformers)
- Copy Trade Opportunities (cards avec entry strategy)
- Warnings
```

#### 2. **Key Moves Table**

```tsx
<KeyMovesTable>
  {keyMoves.map(move => (
    <TableRow>
      <Ticker>{move.ticker}</Ticker>
      <ActionBadge action={move.action} /> // Vert/rouge
      <MagnitudeBadge magnitude={move.magnitude} />
      <ChangePct>{move.change_pct}%</ChangePct>
      <ConvictionBadge level={move.conviction_level} />
      <CopyTradeBadge potential={move.copy_trade_potential} />
      <Reason>{move.reason}</Reason>
    </TableRow>
  ))}
</KeyMovesTable>
```

#### 3. **Copy Trade Opportunities**

```tsx
<CopyTradeSection>
  {copyTradeOpportunities.map(opp => (
    <CopyTradeCard
      ticker={opp.ticker}
      action={opp.action}
      reasoning={opp.reasoning}
      riskLevel={opp.risk_level}
      entryStrategy={opp.entry_strategy} // Badge avec icône
    />
  ))}
</CopyTradeSection>
```

---

## 3️⃣ Ticker Activity Analysis

### Endpoint

```
POST /ai/ticker-activity-analysis
```

### Request

```typescript
{
  ticker: string; // Ex: "NVDA"
}
```

### Response Structure (Actuelle - À enrichir dans Phase 1.5/1.6)

```typescript
{
  success: boolean;
  ticker: string;
  analysis: {
    overview: string;
    key_signals: Array<{
      type: string;
      description: string;
      impact: "faible" | "moyen" | "élevé" | "critique";
    }>;
    attention_level: "faible" | "moyen" | "élevé" | "critique";
    narrative: string; // Récit humain
    recommendations?: string[];
  };
  cached: boolean;
  timestamp: string;
}
```

**Note** : Cette fonctionnalité sera enrichie dans les phases 1.5/1.6 avec :
- Signal Consensus Analysis
- Multi-Scenario Prediction
- Entry Strategy Recommendations

---

## 🎨 Composants UI Recommandés

### 1. **Attention Level Badge**

```tsx
const AttentionLevelBadge = ({ level }: { level: "faible" | "moyen" | "élevé" | "critique" }) => {
  const colors = {
    faible: "gray",
    moyen: "yellow",
    élevé: "orange",
    critique: "red"
  };
  
  return <Badge color={colors[level]}>{level.toUpperCase()}</Badge>;
};
```

### 2. **Confidence Bar**

```tsx
const ConfidenceBar = ({ confidence }: { confidence: number }) => {
  return (
    <div>
      <ProgressBar value={confidence * 100} />
      <span>{Math.round(confidence * 100)}%</span>
    </div>
  );
};
```

### 3. **Scenario Cards**

```tsx
const ScenarioCard = ({ type, probability, priceTarget, conditions }) => {
  return (
    <Card>
      <CardHeader>
        <Badge>{type}</Badge>
        <ProgressBar value={probability * 100} />
      </CardHeader>
      <CardBody>
        {priceTarget && <PriceTarget>{priceTarget}</PriceTarget>}
        <Conditions>{conditions}</Conditions>
      </CardBody>
    </Card>
  );
};
```

### 4. **Recommendation Card**

```tsx
const RecommendationCard = ({ action, strike, expiry, reasoning, riskLevel }) => {
  const actionIcons = {
    buy_calls: "📈",
    buy_puts: "📉",
    wait: "⏳",
    avoid: "⚠️"
  };
  
  return (
    <Card>
      <CardHeader>
        <Icon>{actionIcons[action]}</Icon>
        <ActionBadge>{action}</ActionBadge>
        <RiskBadge level={riskLevel} />
      </CardHeader>
      <CardBody>
        {strike && <Strike>Strike: {strike}</Strike>}
        {expiry && <Expiry>Expiry: {expiry}</Expiry>}
        <Reasoning>{reasoning}</Reasoning>
      </CardBody>
    </Card>
  );
};
```

---

## 📊 Exemples d'Intégration

### React Hook Example

```typescript
const useOptionsFlowAnalysis = (ticker: string) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!ticker) return;
    
    setLoading(true);
    fetch(`${API_URL}/ai/options-flow-analysis`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ticker })
    })
      .then(res => res.json())
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [ticker]);
  
  return { data, loading, error };
};
```

### Vue Component Example

```vue
<template>
  <div v-if="loading">Loading...</div>
  <div v-else-if="error">Error: {{ error }}</div>
  <div v-else>
    <AttentionLevelBadge :level="analysis.attention_level" />
    <StrategyHypothesis :hypothesis="analysis.strategy_hypothesis" />
    <ScenariosPanel :scenarios="analysis.scenarios" />
    <RecommendationsList :recommendations="analysis.recommendations" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps(['ticker']);
const analysis = ref(null);
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  const res = await fetch(`${API_URL}/ai/options-flow-analysis`, {
    method: 'POST',
    body: JSON.stringify({ ticker: props.ticker })
  });
  const data = await res.json();
  analysis.value = data.analysis;
  loading.value = false;
});
</script>
```

---

## 🚀 URLs des Endpoints

### Production

```
Base URL: https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod

POST /ai/options-flow-analysis
POST /ai/institution-moves-analysis
POST /ai/ticker-activity-analysis
```

### Authentification

Tous les endpoints nécessitent un **Bearer Token** dans le header :

```
Authorization: Bearer {ACCESS_TOKEN}
```

---

## 📝 Notes Importantes

1. **Cache** : Les réponses peuvent être mises en cache (champ `cached: true`)
2. **Timeouts** : Les analyses peuvent prendre 5-10 secondes
3. **Erreurs** : Gérer les erreurs 500 (timeout API externe) avec retry
4. **Loading States** : Afficher des skeletons pendant le chargement
5. **Responsive** : Adapter l'affichage pour mobile (cartes au lieu de tableaux)

---

## ✅ Checklist d'Implémentation

### Options Flow Analysis
- [ ] Afficher les métriques enrichies (OI, IV, Volume Profile)
- [ ] Afficher Strategy Hypothesis avec confidence
- [ ] Afficher les 3 scénarios avec probabilités
- [ ] Afficher les recommandations avec strikes/expiries
- [ ] Afficher les warnings en alertes
- [ ] Afficher Next Signals to Watch

### Institution Moves Analysis
- [ ] Afficher Strategy Insight avec evidence
- [ ] Afficher Key Moves avec conviction et copy trade potential
- [ ] Afficher Portfolio Analysis (concentration, sector bets, style)
- [ ] Afficher Performance Analysis (top/underperformers)
- [ ] Afficher Copy Trade Opportunities avec entry strategies
- [ ] Afficher les warnings

### Ticker Activity Analysis
- [ ] Afficher l'analyse actuelle
- [ ] Préparer la structure pour les enrichissements futurs (Phase 1.5/1.6)

---

**Dernière mise à jour** : 2025-12-09  
**Version** : 1.0

