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

---

## 🎭 Modal en Grand (Timeline)

### Exemple de Modal Complète (comme Earnings Hub)

```typescript
import { useState } from 'react';
import { X } from 'lucide-react';

interface ConvergenceRiskModalProps {
  ticker: string;
  isOpen: boolean;
  onClose: () => void;
}

function ConvergenceRiskModal({ ticker, isOpen, onClose }: ConvergenceRiskModalProps) {
  const [analysis, setAnalysis] = useState<WhaleAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isOpen || !ticker) return;

    setLoading(true);
    setError(null);

    analyzeConvergenceRisk(ticker)
      .then(setAnalysis)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [isOpen, ticker]);

  if (!isOpen) return null;

  const { analysis: data } = analysis || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Convergence & Risque de Liquidation
            </h2>
            <p className="text-sm text-gray-600 mt-1">{ticker}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Analyse en cours...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Erreur: {error.message}</p>
            </div>
          )}

          {data && (
            <div className="space-y-6">
              {/* Métriques Principales */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Prix Actuel</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${data.analysis.currentPrice.toFixed(2)}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Support Dark Pool</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${data.analysis.whaleSupport.toFixed(2)}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Objectif d'Expiration</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${data.analysis.targetStrike.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Badge de Risque */}
              <div className="flex items-center gap-4">
                <LiquidationRiskBadge risk={data.analysis.liquidationRisk} />
                {data.analysis.isWhaleInProfit && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    ✅ Baleines en profit
                  </span>
                )}
              </div>

              {/* Distances */}
              <div className="grid grid-cols-2 gap-4">
                {data.analysis.priceDistanceFromSupport !== null && (
                  <PriceDistanceIndicator
                    distance={data.analysis.priceDistanceFromSupport}
                    label="Distance au Support"
                  />
                )}
                {data.analysis.priceDistanceFromTarget !== null && (
                  <PriceDistanceIndicator
                    distance={data.analysis.priceDistanceFromTarget}
                    label="Distance à l'Objectif"
                  />
                )}
              </div>

              {/* Interprétation */}
              {data.analysis.interpretation && (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Résumé</h3>
                    <p className="text-gray-700">{data.analysis.interpretation.summary}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Points Clés</h3>
                    <ul className="space-y-2">
                      {data.analysis.interpretation.keyPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-700">
                          <span className="text-blue-600 mt-1">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Scénarios */}
                  {data.analysis.interpretation.scenarios.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Scénarios Possibles</h3>
                      <div className="space-y-3">
                        {data.analysis.interpretation.scenarios.map((scenario, i) => (
                          <div
                            key={i}
                            className="border-l-4 border-blue-500 bg-blue-50 rounded-r-lg p-3"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-900">
                                {scenario.label}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-xs ${
                                  scenario.probability === 'high'
                                    ? 'bg-red-100 text-red-800'
                                    : scenario.probability === 'medium'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {scenario.probability === 'high'
                                  ? 'Haute'
                                  : scenario.probability === 'medium'
                                  ? 'Moyenne'
                                  : 'Basse'}{' '}
                                probabilité
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">{scenario.conditions}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommandation */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <h3 className="font-semibold text-indigo-900 mb-2">Recommandation</h3>
                    <p className="text-indigo-800 capitalize">
                      {data.analysis.interpretation.recommendation === 'caution'
                        ? '⚠️ Prudence'
                        : data.analysis.interpretation.recommendation === 'opportunity'
                        ? '💡 Opportunité'
                        : data.analysis.interpretation.recommendation === 'monitor'
                        ? '👀 Surveiller'
                        : '⚪ Neutre'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Utilisation dans la Timeline
function TimelineEvent({ ticker }: { ticker: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Voir Analyse Convergence
      </button>

      <ConvergenceRiskModal
        ticker={ticker}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
```

### Styles CSS (Tailwind)

```css
/* Modal backdrop avec blur */
.backdrop-blur-sm {
  backdrop-filter: blur(4px);
}

/* Animation d'entrée */
@keyframes modalEnter {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-enter {
  animation: modalEnter 0.2s ease-out;
}
```

### Variante avec Dialog (Shadcn/UI)

```typescript
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function ConvergenceRiskDialog({
  ticker,
  isOpen,
  onClose,
}: ConvergenceRiskModalProps) {
  const { data, loading, error } = useConvergenceRisk({ ticker, enabled: isOpen });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Convergence & Risque de Liquidation - {ticker}
          </DialogTitle>
        </DialogHeader>

        {loading && <div>Chargement...</div>}
        {error && <div className="text-red-600">Erreur: {error.message}</div>}

        {data?.analysis && (
          <div className="space-y-6">
            {/* Contenu identique à la modal ci-dessus */}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

