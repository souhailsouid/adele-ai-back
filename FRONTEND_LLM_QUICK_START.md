# 🚀 Quick Start : Analyses LLM Enrichies

## 📋 Résumé Exécutif

Les 3 endpoints d'analyse LLM ont été **enrichis** avec de nouvelles métriques et analyses approfondies.

---

## 🎯 Endpoints

### 1. Options Flow Analysis (ENRICHI)
```
POST /ai/options-flow-analysis
Body: { "ticker": "NVDA" }
```

**Nouveautés** :
- ✨ Open Interest changes, IV analysis, Volume Profile
- ✨ Strategy Hypothesis (gamma squeeze, hedging, etc.)
- ✨ Scénarios multiples (bullish/bearish/neutral) avec probabilités
- ✨ Recommandations avec strikes/expiries et risk level
- ✨ Warnings (IV crush, max pain risk)

### 2. Institution Moves Analysis (ENRICHI)
```
POST /ai/institution-moves-analysis
Body: { 
  "institution_cik": "0001364742",
  "institution_name": "BLACKROCK, INC.",
  "period": "3M"
}
```

**Nouveautés** :
- ✨ Strategy Insight avec confidence
- ✨ Performance Attribution (top/underperformers)
- ✨ Copy Trade Opportunities avec entry strategies
- ✨ Portfolio Analysis (concentration, sector bets, style)

### 3. Ticker Activity Analysis
```
POST /ai/ticker-activity-analysis
Body: { "ticker": "NVDA" }
```

**Note** : À enrichir dans Phase 1.5/1.6

---

## 📊 Structures de Données Clés

### Options Flow - Nouveaux Champs

```typescript
analysis: {
  strategy_hypothesis?: {
    primary: "gamma_squeeze" | "hedging" | "speculation" | "earnings_play";
    confidence: number; // 0-1
    reasoning: string;
  };
  scenarios?: {
    bullish: { probability: number; price_target?: number; conditions: string };
    bearish: { probability: number; price_target?: number; conditions: string };
    neutral: { probability: number; price_range?: [number, number]; conditions: string };
  };
  recommendations?: Array<{
    action: "buy_calls" | "buy_puts" | "wait" | "avoid";
    strike?: number;
    expiry?: string;
    reasoning: string;
    risk_level: "low" | "medium" | "high";
  }>;
  warnings?: string[];
}

metrics: {
  open_interest_change?: { total_change, call_oi_change, put_oi_change, max_oi_strikes };
  implied_volatility?: { current, percentile, skew };
  unusual_activity?: { sweeps, blocks, largest_sweep };
  max_pain?: { current, price_distance };
  price_action?: { current_price, support, resistance, trend };
}
```

### Institution Moves - Nouveaux Champs

```typescript
analysis: {
  strategy_insight?: {
    primary_strategy: "sector_rotation" | "style_shift" | "conviction_building";
    confidence: number;
    reasoning: string;
    evidence?: string[];
  };
  key_moves: Array<{
    change_pct?: number;
    conviction_level?: "low" | "medium" | "high" | "very_high";
    copy_trade_potential?: "low" | "medium" | "high";
  }>;
  portfolio_analysis?: {
    concentration_risk: "low" | "medium" | "high";
    sector_bets?: Array<{ sector, bet, reasoning }>;
    style_analysis?: { current_style, style_shift, reasoning };
  };
  performance_analysis?: {
    overall_performance: "outperforming" | "underperforming" | "in_line";
    top_performers?: Array<{ ticker, pnl_pct, contribution }>;
  };
  copy_trade_opportunities?: Array<{
    ticker, action, reasoning, risk_level,
    entry_strategy: "DCA sur 2 semaines" | "Entry immédiat" | "Wait for pullback";
  }>;
}
```

---

## 🎨 Composants UI à Créer

1. **AttentionLevelBadge** : Badge coloré (faible/moyen/élevé/critique)
2. **ConfidenceBar** : Barre de progression pour confidence (0-1)
3. **ScenarioCard** : Carte avec probabilité, price target, conditions
4. **RecommendationCard** : Carte avec action, strike, expiry, risk level
5. **CopyTradeCard** : Carte avec entry strategy
6. **StrategyInsight** : Badge + confidence + evidence list

---

## 📖 Documentation Complète

Voir le guide détaillé : `FRONTEND_LLM_IMPROVEMENTS_GUIDE.md`

---

**URL Production** : `https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod`  
**Auth** : `Authorization: Bearer {ACCESS_TOKEN}`

