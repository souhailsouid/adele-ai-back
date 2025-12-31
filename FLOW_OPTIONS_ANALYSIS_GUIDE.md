# Guide d'utilisation - Analyse Pro du Flow Options

## Vue d'ensemble

Cette fonctionnalité permet d'analyser des signals de flow options selon la méthodologie d'un analyste de marché professionnel. Elle transforme des données brutes de flow options en un raisonnement structuré et actionnable.

## Endpoint

```
POST /ai/flow-options-analysis-pro
```

## Format de la requête

```json
{
  "signals": [
    {
      "ticker": "MSFT",
      "type": "call",
      "strike": "375",
      "expiry": "2023-12-22",
      "total_premium": 186705,
      "total_size": 461,
      "trade_count": 32,
      "volume": 2442,
      "open_interest": 7913,
      "volume_oi_ratio": 0.308,
      "underlying_price": 372.99,
      "alert_rule": "RepeatedHits",
      "all_opening_trades": false,
      "has_floor": false,
      "has_sweep": true,
      "has_multileg": false,
      "created_at": "2023-12-12T16:35:52.168490Z"
    }
  ],
  "context": {
    "days_to_earnings": 5,
    "price_trend": "up",
    "recent_news": ["Microsoft announces new AI features"]
  }
}
```

## Format de la réponse

```json
{
  "success": true,
  "signals_analyzed": 1,
  "analyses": [
    {
      "signal": { /* signal original */ },
      "importance": {
        "premium_significance": "significatif",
        "repetition": true,
        "concentration": "Plusieurs trades sur le même strike",
        "score": 75
      },
      "market_intention": {
        "flow_type": "événementiel",
        "time_horizon": "court",
        "days_to_expiry": 10,
        "reasoning": "Plusieurs achats de calls sur MSFT, taille significative, probablement des positions ouvertes. Expiration proche → possible anticipation d'un événement (earnings / news)."
      },
      "credibility": {
        "new_money_indicators": "fort",
        "structure_complexity": "simple",
        "hedge_indicators": ["Trades d'ouverture", "Volume > OI"],
        "score": 80
      },
      "conclusion": {
        "action": "SURVEILLER",
        "reasoning": "Signal crédible avec montant significatif. Expiration proche suggère une anticipation d'événement. À surveiller pour confirmation.",
        "key_factors": [
          "Prime significative ($186k)",
          "Expiration dans 10 jours",
          "Volume/OI ratio faible (0.3) suggère nouvelles positions",
          "Règle RepeatedHits indique répétition"
        ]
      }
    }
  ],
  "summary": "1 signal(s) analysé(s). 1 signal(s) significatif(s). Actions recommandées: 1 à surveiller, 0 à analyser davantage, 0 à ignorer.",
  "cached": false,
  "timestamp": "2023-12-12T16:40:00.000Z"
}
```

## Méthodologie d'analyse

L'analyse suit strictement 4 points :

### 1. Importance du signal
- **Montant engagé** : significatif ou marginal ?
- **Répétition** : y a-t-il répétition ou concentration du flux ?
- **Score** : 0-100

### 2. Intention probable du marché
- **Type de flux** : directionnel, événementiel, ou indéterminé
- **Horizon temporel** : court, moyen, long, ou indéterminé (basé sur l'expiration)
- **Raisonnement** : explication en 2-3 phrases

### 3. Crédibilité du signal
- **New money** : fort, modéré, faible, ou indéterminé
- **Complexité** : simple, potentiellement complexe, ou complexe
- **Indices de hedge/spread** : liste d'indices
- **Score** : 0-100

### 4. Conclusion opérationnelle
- **Action** : IGNORER / SURVEILLER / À_ANALYSER_DAVANTAGE
- **Raisonnement** : explication en 2-3 phrases
- **Facteurs clés** : liste de 3-5 points

## Exemple d'utilisation avec l'API Unusual Whales

```typescript
// 1. Récupérer les flow alerts depuis UW
const flowAlerts = await uw.getUWOptionTradeFlowAlerts({
  ticker_symbol: "MSFT",
  limit: 10,
  min_premium: 50000
});

// 2. Transformer en format FlowOptionsSignal
const signals: FlowOptionsSignal[] = flowAlerts.data.map(alert => ({
  ticker: alert.ticker,
  type: alert.type,
  strike: alert.strike,
  expiry: alert.expiry,
  total_premium: alert.total_premium,
  total_size: alert.total_size,
  trade_count: alert.trade_count,
  volume: alert.volume,
  open_interest: alert.open_interest,
  volume_oi_ratio: alert.volume_oi_ratio,
  underlying_price: alert.underlying_price,
  alert_rule: alert.alert_rule,
  all_opening_trades: alert.all_opening_trades,
  has_floor: alert.has_floor,
  has_sweep: alert.has_sweep,
  has_multileg: alert.has_multileg,
  created_at: alert.created_at
}));

// 3. Analyser avec le service
const request: FlowOptionsAnalysisProRequest = {
  signals,
  context: {
    days_to_earnings: 5,
    price_trend: "up"
  }
};

const analysis = await flowOptionsAnalysisService.analyzeFlowOptions(request);
```

## Notes importantes

- **Pas de conseil financier** : L'analyse ne donne pas de conseil financier, elle qualifie et analyse les flux
- **Pas de prédiction de prix** : Aucune prédiction de prix n'est faite
- **Pas de stratégie de trading** : Aucune stratégie de trading n'est proposée
- **Factuel et synthétique** : L'analyse reste factuelle, synthétique et prudente
- **Cache** : Les analyses sont mises en cache pendant 24h pour éviter les appels répétés

## Intégration avec le frontend

Le frontend peut appeler cet endpoint directement :

```typescript
const response = await fetch('/ai/flow-options-analysis-pro', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    signals: [...],
    context: { ... }
  })
});

const analysis = await response.json();
```

## Erreurs possibles

- `Missing or empty signals array` : Aucun signal fourni
- `Each signal must have at least: ticker, type (call/put), and expiry` : Signal incomplet
- `OPENAI_API_KEY not configured` : Clé API OpenAI manquante

