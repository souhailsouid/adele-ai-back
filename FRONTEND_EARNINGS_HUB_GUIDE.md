# Guide Frontend - Service Earnings Hub

## 🎯 Vue d'ensemble

Ce service reproduit l'interface "Earnings Hub" (ex: Carnival CCL) en analysant l'historique des résultats trimestriels d'une entreprise pour générer :
1. **Score Hub** : Note de A à F basée sur la performance des beats d'EPS
2. **Statistiques agrégées** : Taux de beat, surprise moyenne, market cap, etc.
3. **Historique** : Détails des 16 derniers trimestres (4 ans)
4. **Insights automatiques** : Interprétations générées par règles déterministes

---

## 📡 Endpoint

```
POST /analyze/earnings-hub
```

**Base URL** : `https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod` (ou votre URL de prod)

---

## 🔧 Paramètres

### Query Parameters

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `ticker` | `string` | **REQUIS** | Symbole du ticker (ex: `CCL`, `AAPL`, `MSFT`) |
| `quartersLimit` | `number` | `16` | Nombre de trimestres à analyser (16 = 4 ans) |

### Body (optionnel, override les query params)

```typescript
{
  quartersLimit?: number;
}
```

---

## 📥 Format de la Réponse

### Structure Complète

```typescript
interface EarningsHubResponse {
  success: boolean;
  analysis: EarningsHubAnalysis;
  timestamp: string;
}

interface EarningsHubAnalysis {
  ticker: string;
  hubScore: 'A' | 'B' | 'C' | 'D' | 'F';
  stats: EarningsStats;
  latestQuarter: EarningsQuarter | null;
  history: EarningsQuarter[];
  insights: string[];
  interpretation: {
    summary: string;
    keyPoints: string[];
    trends: Array<{
      label: string;
      direction: 'improving' | 'deteriorating' | 'stable';
      evidence: string;
    }>;
  };
}
```

### Détails des Objets

#### `EarningsStats`

```typescript
{
  marketCap: string;        // Ex: "40.1B" ou "2.5M"
  peRatio: number | null;   // Ratio P/E (peut être null si non disponible)
  currentPrice: number;      // Prix actuel du stock
  epsBeatsCount: number;     // Nombre total de beats d'EPS
  totalQuarters: number;     // Nombre total de trimestres analysés
  epsBeatRate: number;       // Taux de beat en % (ex: 58.8)
  avgEpsSurprise: number;    // Surprise moyenne d'EPS en %
}
```

#### `EarningsQuarter`

```typescript
{
  period: string;            // Ex: "Q4 2025"
  reportDate: string;        // Date ISO: "2025-12-19"
  reportTime: 'premarket' | 'postmarket' | 'unknown';
  epsActual: number;         // EPS réel publié
  epsEstimate: number;       // EPS estimé par les analystes
  epsSurprise: number;       // Surprise en % (positif = beat, négatif = miss)
  epsBeat: boolean;          // true si beat, false si miss
  priceMove1d: number | null;    // Mouvement prix 1 jour après (%)
  priceMove1w: number | null;    // Mouvement prix 1 semaine après (%)
}
```

---

## 📊 Exemple de Réponse

```json
{
  "success": true,
  "analysis": {
    "ticker": "CCL",
    "hubScore": "A",
    "stats": {
      "marketCap": "40.1B",
      "peRatio": null,
      "currentPrice": 30.55,
      "epsBeatsCount": 10,
      "totalQuarters": 17,
      "epsBeatRate": 58.8,
      "avgEpsSurprise": 8.5
    },
    "latestQuarter": {
      "period": "Q4 2025",
      "reportDate": "2025-12-19",
      "reportTime": "premarket",
      "epsActual": 0.34,
      "epsEstimate": 0.25,
      "epsSurprise": 36.0,
      "epsBeat": true,
      "priceMove1d": 2.5,
      "priceMove1w": 4.2
    },
    "history": [
      {
        "period": "Q4 2025",
        "reportDate": "2025-12-19",
        "reportTime": "premarket",
        "epsActual": 0.34,
        "epsEstimate": 0.25,
        "epsSurprise": 36.0,
        "epsBeat": true,
        "priceMove1d": 2.5,
        "priceMove1w": 4.2
      },
      {
        "period": "Q3 2025",
        "reportDate": "2025-09-15",
        "reportTime": "postmarket",
        "epsActual": 0.28,
        "epsEstimate": 0.30,
        "epsSurprise": -6.67,
        "epsBeat": false,
        "priceMove1d": -1.2,
        "priceMove1w": -0.8
      }
      // ... 15 autres trimestres
    ],
    "insights": [
      "EPS beats 10 fois sur 17 trimestres analysés",
      "Forte surprise positive moyenne sur l'EPS (+8.5%)",
      "Dernier trimestre (Q4 2025) : Beat EPS de 36.0%"
    ],
    "interpretation": {
      "summary": "CCL - Score A: Le dernier trimestre (Q4 2025) a battu les estimations d'EPS de 36.0%. Performance historique : 10 beats sur 17 trimestres (58.8% de taux de beat).",
      "keyPoints": [
        "Score Earnings Hub : A (excellent)",
        "Surprise EPS moyenne exceptionnelle : +8.5%",
        "✅ Tendance à l'amélioration : plus de beats récemment"
      ],
      "trends": [
        {
          "label": "Amélioration de la performance EPS",
          "direction": "improving",
          "evidence": "3/4 beats récents vs 2/4 précédents"
        }
      ]
    }
  },
  "timestamp": "2026-01-02T11:14:41.821Z"
}
```

---

## 🎨 Utilisation Frontend

### Exemple React/TypeScript

```typescript
import { useState } from 'react';

interface EarningsHubAnalysis {
  ticker: string;
  hubScore: 'A' | 'B' | 'C' | 'D' | 'F';
  stats: {
    marketCap: string;
    peRatio: number | null;
    currentPrice: number;
    epsBeatsCount: number;
    totalQuarters: number;
    epsBeatRate: number;
    avgEpsSurprise: number;
  };
  latestQuarter: EarningsQuarter | null;
  history: EarningsQuarter[];
  insights: string[];
  interpretation: {
    summary: string;
    keyPoints: string[];
    trends: Array<{
      label: string;
      direction: 'improving' | 'deteriorating' | 'stable';
      evidence: string;
    }>;
  };
}

async function fetchEarningsHub(ticker: string): Promise<EarningsHubAnalysis> {
  const response = await fetch(
    `${API_BASE_URL}/analyze/earnings-hub?ticker=${ticker}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.analysis;
}

// Utilisation dans un composant
function EarningsHubWidget({ ticker }: { ticker: string }) {
  const [analysis, setAnalysis] = useState<EarningsHubAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchEarningsHub(ticker)
      .then(setAnalysis)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return <div>Chargement...</div>;
  if (!analysis) return null;

  return (
    <div>
      <h2>Earnings Hub - {analysis.ticker}</h2>
      
      {/* Score Badge */}
      <div className={`score-badge score-${analysis.hubScore}`}>
        Score: {analysis.hubScore}
      </div>

      {/* Statistiques */}
      <div className="stats">
        <div>Market Cap: {analysis.stats.marketCap}</div>
        <div>Prix: ${analysis.stats.currentPrice}</div>
        <div>Beats: {analysis.stats.epsBeatsCount}/{analysis.stats.totalQuarters}</div>
        <div>Taux de beat: {analysis.stats.epsBeatRate.toFixed(1)}%</div>
      </div>

      {/* Dernier trimestre */}
      {analysis.latestQuarter && (
        <div className="latest-quarter">
          <h3>{analysis.latestQuarter.period}</h3>
          <div>
            EPS: {analysis.latestQuarter.epsActual} vs {analysis.latestQuarter.epsEstimate}
            {analysis.latestQuarter.epsBeat ? ' ✅ Beat' : ' ❌ Miss'}
          </div>
          <div>Surprise: {analysis.latestQuarter.epsSurprise.toFixed(1)}%</div>
        </div>
      )}

      {/* Insights */}
      <div className="insights">
        <h3>Insights</h3>
        <ul>
          {analysis.insights.map((insight, i) => (
            <li key={i}>{insight}</li>
          ))}
        </ul>
      </div>

      {/* Trends */}
      <div className="trends">
        {analysis.interpretation.trends.map((trend, i) => (
          <div key={i} className={`trend trend-${trend.direction}`}>
            <strong>{trend.label}</strong>
            <p>{trend.evidence}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 🎨 Suggestions d'Affichage

### 1. Badge de Score

```css
.score-badge {
  display: inline-block;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: bold;
  font-size: 24px;
}

.score-A { background: #10b981; color: white; } /* Vert */
.score-B { background: #3b82f6; color: white; } /* Bleu */
.score-C { background: #f59e0b; color: white; } /* Orange */
.score-D { background: #ef4444; color: white; } /* Rouge */
.score-F { background: #6b7280; color: white; } /* Gris */
```

### 2. Graphique Historique

Utilisez `analysis.history` pour créer un graphique en barres montrant :
- Barres vertes pour les beats
- Barres rouges pour les misses
- Hauteur proportionnelle à la surprise (%)

### 3. Tableau des Trimestres

Affichez `analysis.history` dans un tableau avec colonnes :
- Période (Q4 2025)
- EPS Actual vs Estimate
- Surprise (%)
- Beat/Miss (badge)
- Mouvement prix 1j (%)

---

## ⚠️ Gestion d'Erreurs

```typescript
try {
  const analysis = await fetchEarningsHub('CCL');
  // Utiliser analysis
} catch (error) {
  if (error.message.includes('Missing required parameter')) {
    // Ticker manquant
  } else if (error.message.includes('Unable to fetch')) {
    // Données non disponibles
  } else {
    // Erreur générique
  }
}
```

---

## 📝 Notes Importantes

1. **Pas d'IA** : Tous les insights sont générés par règles déterministes
2. **Sources Unusual Whales uniquement** : Pas de dépendance à FMP
3. **Données EPS uniquement** : L'API UW ne fournit pas les revenus (revenue) dans l'historique
4. **P/E Ratio** : Peut être `null` si non disponible dans l'API UW

---

## 🔄 Refresh & Cache

- Les données sont fraîches à chaque appel (pas de cache côté backend)
- Recommandation : Mettre en cache côté frontend pendant 5-10 minutes
- Recharger automatiquement avant les prochains earnings (utiliser `next_earnings_date` depuis Stock Info)

