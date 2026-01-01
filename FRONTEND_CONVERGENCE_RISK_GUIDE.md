# Guide Frontend - Service Convergence & Risque de Liquidation

## 🎯 Vue d'ensemble

Ce service transforme les données brutes (Dark Pools + Options Flow) en **indicateurs de prix uniques** pour analyser :
1. **Support Dark Pool** : Prix moyen où les institutions ont accumulé
2. **Objectif d'Expiration** : Prix de règlement attendu basé sur les options
3. **Risque de Liquidation** : Comparaison prix actuel vs support

---

## 📡 Endpoint

```
POST /analyze/convergence-risk
```

**Base URL** : `https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod` (ou votre URL de prod)

---

## 🔧 Paramètres

### Query Parameters (tous optionnels sauf `ticker`)

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `ticker` | `string` | **REQUIS** | Symbole du ticker (ex: `NVDA`, `AAPL`) |
| `darkPoolLimit` | `number` | `100` | Nombre de transactions Dark Pool à analyser |
| `optionsLimit` | `number` | `200` | Nombre d'alertes d'options à analyser |
| `minPremium` | `number` | `50000` | Prime minimum pour filtrer les options ($) |
| `expiryFilter` | `string` | `null` | Filtre d'expiration : `"YYYY-MM-DD"`, `"tomorrow"`, `"next_week"` |
| `liquidationThreshold` | `number` | `0.005` | Seuil de risque (0.005 = 0.5%) |

### Body (optionnel, override les query params)

```typescript
{
  darkPoolLimit?: number;
  optionsLimit?: number;
  minPremium?: number;
  expiryFilter?: string;
  liquidationThreshold?: number;
}
```

---

## 📥 Format de la Réponse

```typescript
interface WhaleAnalysisResponse {
  success: boolean;
  analysis: {
    ticker: string;                    // "NVDA"
    currentPrice: number;               // 186.50
    whaleSupport: number;               // 186.50 (prix moyen Dark Pool pondéré)
    targetStrike: number;               // 190.00 (strike moyen pondéré par premium)
    liquidationRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    isWhaleInProfit: boolean;           // true si currentPrice > whaleSupport
    priceDistanceFromSupport: number | null;  // % de distance au support (+ = au-dessus)
    priceDistanceFromTarget: number | null;   // % de distance à l'objectif (+ = au-dessus)
  };
  timestamp: string;                    // ISO timestamp
}
```

---

## 💻 Exemples d'utilisation

### 1. Appel basique (React/TypeScript)

```typescript
async function analyzeConvergenceRisk(ticker: string) {
  const response = await fetch(
    `${API_BASE_URL}/analyze/convergence-risk?ticker=${ticker}`,
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

  const data: WhaleAnalysisResponse = await response.json();
  return data;
}

// Utilisation
const analysis = await analyzeConvergenceRisk('NVDA');
console.log('Whale Support:', analysis.analysis.whaleSupport);
console.log('Liquidation Risk:', analysis.analysis.liquidationRisk);
```

### 2. Avec paramètres personnalisés

```typescript
async function analyzeConvergenceRiskAdvanced(
  ticker: string,
  options: {
    darkPoolLimit?: number;
    optionsLimit?: number;
    minPremium?: number;
    expiryFilter?: string;
  }
) {
  const params = new URLSearchParams({
    ticker,
    ...(options.darkPoolLimit && { darkPoolLimit: options.darkPoolLimit.toString() }),
    ...(options.optionsLimit && { optionsLimit: options.optionsLimit.toString() }),
    ...(options.minPremium && { minPremium: options.minPremium.toString() }),
    ...(options.expiryFilter && { expiryFilter: options.expiryFilter }),
  });

  const response = await fetch(
    `${API_BASE_URL}/analyze/convergence-risk?${params}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return await response.json() as WhaleAnalysisResponse;
}

// Utilisation
const analysis = await analyzeConvergenceRiskAdvanced('NVDA', {
  darkPoolLimit: 150,
  optionsLimit: 300,
  minPremium: 100000,
  expiryFilter: '2026-01-16',
});
```

### 3. Hook React personnalisé

```typescript
import { useState, useEffect } from 'react';

interface UseConvergenceRiskOptions {
  ticker: string;
  darkPoolLimit?: number;
  optionsLimit?: number;
  minPremium?: number;
  expiryFilter?: string;
  enabled?: boolean;
}

function useConvergenceRisk(options: UseConvergenceRiskOptions) {
  const { ticker, enabled = true, ...params } = options;
  const [data, setData] = useState<WhaleAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !ticker) return;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ ticker });
    if (options.darkPoolLimit) params.set('darkPoolLimit', options.darkPoolLimit.toString());
    if (options.optionsLimit) params.set('optionsLimit', options.optionsLimit.toString());
    if (options.minPremium) params.set('minPremium', options.minPremium.toString());
    if (options.expiryFilter) params.set('expiryFilter', options.expiryFilter);

    fetch(`${API_BASE_URL}/analyze/convergence-risk?${params}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
      .then(res => res.json())
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [ticker, enabled, JSON.stringify(params)]);

  return { data, loading, error };
}

// Utilisation dans un composant
function ConvergenceRiskWidget({ ticker }: { ticker: string }) {
  const { data, loading, error } = useConvergenceRisk({
    ticker,
    darkPoolLimit: 100,
    optionsLimit: 200,
  });

  if (loading) return <div>Analyse en cours...</div>;
  if (error) return <div>Erreur: {error.message}</div>;
  if (!data) return null;

  const { analysis } = data;

  return (
    <div>
      <h3>Convergence & Risque de Liquidation - {analysis.ticker}</h3>
      <div>
        <p>Prix actuel: ${analysis.currentPrice.toFixed(2)}</p>
        <p>Support Dark Pool: ${analysis.whaleSupport.toFixed(2)}</p>
        <p>Objectif d'expiration: ${analysis.targetStrike.toFixed(2)}</p>
        <p>
          Risque de liquidation: 
          <span className={analysis.liquidationRisk === 'HIGH' ? 'text-red' : ''}>
            {analysis.liquidationRisk}
          </span>
        </p>
        {analysis.priceDistanceFromSupport !== null && (
          <p>
            Distance au support: {analysis.priceDistanceFromSupport.toFixed(2)}%
          </p>
        )}
        {analysis.isWhaleInProfit && (
          <p className="text-green">✅ Baleines en profit</p>
        )}
      </div>
    </div>
  );
}
```

### 4. Avec gestion d'erreurs robuste

```typescript
async function analyzeConvergenceRiskSafe(ticker: string) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/analyze/convergence-risk?ticker=${ticker}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data: WhaleAnalysisResponse = await response.json();

    if (!data.success) {
      throw new Error('Analysis failed');
    }

    return data;
  } catch (error) {
    console.error('Error analyzing convergence risk:', error);
    throw error;
  }
}
```

---

## 🎨 Exemples d'affichage UI

### Badge de Risque

```typescript
function LiquidationRiskBadge({ risk }: { risk: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const colors = {
    LOW: 'bg-green-100 text-green-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    HIGH: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2 py-1 rounded ${colors[risk]}`}>
      {risk === 'HIGH' && '⚠️ '}
      Risque: {risk}
    </span>
  );
}
```

### Indicateur de Distance

```typescript
function PriceDistanceIndicator({ 
  distance, 
  label 
}: { 
  distance: number | null; 
  label: string;
}) {
  if (distance === null) return null;

  const isPositive = distance > 0;
  const color = isPositive ? 'text-green-600' : 'text-red-600';
  const icon = isPositive ? '↑' : '↓';

  return (
    <div className={color}>
      {icon} {label}: {Math.abs(distance).toFixed(2)}%
    </div>
  );
}
```

---

## 📊 Interprétation des Résultats

### `liquidationRisk`

- **HIGH** : Prix actuel à moins de 0.5% du support Dark Pool → Risque de liquidation élevé
- **MEDIUM** : Prix actuel entre 0.5% et 1% du support → Risque modéré
- **LOW** : Prix actuel à plus de 1% du support → Risque faible

### `priceDistanceFromSupport`

- **Positif** : Prix actuel **au-dessus** du support → Baleines en profit potentiel
- **Négatif** : Prix actuel **en-dessous** du support → Baleines en perte potentielle
- **Proche de 0** : Prix très proche du support → Zone de risque

### `targetStrike`

- Prix de règlement attendu basé sur les options flow
- Si `currentPrice < targetStrike` → Potentiel haussier
- Si `currentPrice > targetStrike` → Potentiel baissier

---

## 🔄 Exemples de Requêtes

### Basique
```bash
POST /analyze/convergence-risk?ticker=NVDA
```

### Avec filtres
```bash
POST /analyze/convergence-risk?ticker=NVDA&darkPoolLimit=150&optionsLimit=300&minPremium=100000
```

### Filtre expiration "demain"
```bash
POST /analyze/convergence-risk?ticker=AAPL&expiryFilter=tomorrow
```

### Filtre expiration date spécifique
```bash
POST /analyze/convergence-risk?ticker=TSLA&expiryFilter=2026-01-16
```

---

## ⚠️ Notes importantes

1. **Authentification** : Toutes les requêtes nécessitent un `Bearer Token` dans le header `Authorization`
2. **Méthode POST** : Même si c'est une lecture, utiliser POST (convention API)
3. **Cache** : Le service peut mettre en cache les données Dark Pool et Options Flow
4. **Performance** : L'analyse peut prendre 2-5 secondes selon la quantité de données

---

## 🐛 Gestion d'erreurs

```typescript
try {
  const analysis = await analyzeConvergenceRisk('NVDA');
} catch (error) {
  if (error.message.includes('Missing required parameter')) {
    // Ticker manquant
  } else if (error.message.includes('Unable to fetch current price')) {
    // Prix actuel non disponible
  } else {
    // Autre erreur
  }
}
```

