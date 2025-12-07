# Documentation API Backend - Guide Frontend

## Table des matières

1. [Authentification](#authentification)
2. [Endpoints Ticker Activity](#endpoints-ticker-activity)
3. [Endpoints Ticker Insights](#endpoints-ticker-insights)
4. [Structure des réponses](#structure-des-réponses)
5. [Gestion des erreurs](#gestion-des-erreurs)
6. [Exemples d'implémentation](#exemples-dimplémentation)

---

## Authentification

Toutes les requêtes doivent inclure un **JWT Access Token** dans le header `Authorization`.

### Format

```http
Authorization: Bearer <access_token>
```

### Obtention du token

Le token est obtenu via AWS Cognito après authentification de l'utilisateur.

**Important** : Utilisez l'**Access Token** (pas l'ID Token) pour les appels API.

---

## Endpoints Ticker Activity

### Base URL

```
https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod
```

### 1. Quote (Prix actuel)

Récupère le prix actuel, le volume et la capitalisation boursière d'un ticker.

**Endpoint** : `GET /ticker-activity/{ticker}/quote`

**Paramètres** :
- `ticker` (path) : Symbole du ticker (ex: `NVDA`, `TSLA`, `AAPL`)

**Exemple de requête** :
```typescript
const response = await fetch(
  'https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/ticker-activity/NVDA/quote',
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }
);
```

**Réponse** :
```typescript
{
  success: true,
  data: {
    symbol: "NVDA",
    price: 183.38,
    change: 3.79,
    changePercent: 2.11036,
    volume: 166479246,
    marketCap: 4464752902544,
    timestamp: "2025-12-05T10:47:36.879Z"
  },
  cached: false,
  timestamp: "2025-12-05T10:47:36.879Z"
}
```

---

### 2. Ownership (Propriété institutionnelle)

Récupère la liste des institutions qui détiennent le ticker (13F filings).

**Endpoint** : `GET /ticker-activity/{ticker}/ownership`

**Paramètres** :
- `ticker` (path) : Symbole du ticker
- `limit` (query, optionnel) : Nombre de résultats (défaut: 100)

**Exemple de requête** :
```typescript
const response = await fetch(
  'https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/ticker-activity/NVDA/ownership?limit=10',
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }
);
```

**Réponse** :
```typescript
{
  success: true,
  data: [
    {
      name: "VANGUARD GROUP INC",
      shares: 2223533800,
      units: 2223533800,
      value: 414866936311,
      is_hedge_fund: false,
      report_date: "2025-09-30",
      filing_date: "2025-11-07",
      percentage?: number
    },
    // ... autres institutions
  ],
  cached: true,
  count: 10,
  timestamp: "2025-12-02T10:54:17.04055+00:00"
}
```

---

### 3. Activity (Transactions institutionnelles)

Récupère les transactions récentes des institutions pour le ticker.

**Endpoint** : `GET /ticker-activity/{ticker}/activity`

**Paramètres** :
- `ticker` (path) : Symbole du ticker
- `limit` (query, optionnel) : Nombre de résultats (défaut: 100)

**Exemple de requête** :
```typescript
const response = await fetch(
  'https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/ticker-activity/NVDA/activity?limit=5',
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }
);
```

**Réponse** :
```typescript
{
  success: true,
  data: [
    {
      institution_name: "VANGUARD GROUP INC",
      units_change: -8911158,
      change: -8911158,
      avg_price: 9.36,
      buy_price: null,
      sell_price: 173.86,
      filing_date: "2025-11-07",
      report_date: "2025-09-30",
      price_on_filing: 164.92,
      price_on_report: 164.92,
      close: 183.38,
      transaction_type: "SELL"
    },
    // ... autres transactions
  ],
  cached: true,
  count: 2,
  timestamp: "2025-12-05T10:13:56.131948+00:00"
}
```

---

### 4. Hedge Funds

Récupère uniquement les hedge funds qui détiennent le ticker.

**Endpoint** : `GET /ticker-activity/{ticker}/hedge-funds`

**Paramètres** :
- `ticker` (path) : Symbole du ticker
- `limit` (query, optionnel) : Nombre de résultats

**Réponse** : Même structure que `/ownership`, mais filtrée pour `is_hedge_fund: true`

---

### 5. Insiders (Transactions des dirigeants)

Récupère les transactions des dirigeants et employés de l'entreprise.

**Endpoint** : `GET /ticker-activity/{ticker}/insiders`

**Paramètres** :
- `ticker` (path) : Symbole du ticker
- `limit` (query, optionnel) : Nombre de résultats

**Réponse** :
```typescript
{
  success: true,
  data: [
    {
      owner_name: "EVERS ANTHONY GEORGE",
      officer_title: "Chief Financial Officer",
      transaction_code: "S",
      amount: -175966,
      transaction_date: "2025-12-04",
      price: "1.7000"
    },
    // ... autres transactions
  ],
  cached: false,
  count: 3,
  timestamp: "2025-12-05T10:47:38.076Z"
}
```

---

### 6. Congress (Transactions du Congrès)

Récupère les transactions des membres du Congrès américain.

**Endpoint** : `GET /ticker-activity/{ticker}/congress`

**Paramètres** :
- `ticker` (path) : Symbole du ticker
- `limit` (query, optionnel) : Nombre de résultats

**Réponse** :
```typescript
{
  success: true,
  data: [
    {
      name: "Lisa McClain",
      member_type: "house",
      txn_type: "Sell",
      amounts: "$15,001 - $50,000",
      transaction_date: "2025-10-31"
    },
    // ... autres transactions
  ],
  cached: false,
  count: 3,
  timestamp: "2025-12-05T10:47:38.480Z"
}
```

---

### 7. Options (Flow d'options)

Récupère le flow d'options (calls/puts) pour le ticker.

**Endpoint** : `GET /ticker-activity/{ticker}/options`

**Paramètres** :
- `ticker` (path) : Symbole du ticker
- `limit` (query, optionnel) : Nombre de résultats
- `is_call` (query, optionnel) : Filtrer les calls (`true`/`false`)
- `is_put` (query, optionnel) : Filtrer les puts (`true`/`false`)
- `min_size` (query, optionnel) : Taille minimale
- `max_size` (query, optionnel) : Taille maximale

**Réponse** :
```typescript
{
  success: true,
  data: [
    {
      type: "put",
      strike: 185,
      total_premium: 117500,
      premium: 0,
      volume: 39681,
      expiry: "2025-12-05",
      created_at: "2025-12-04T20:59:57.242244+00:00",
      open_interest: 15646
    },
    // ... autres options
  ],
  cached: true,
  count: 3,
  timestamp: "2025-12-05T10:13:52.864336+00:00"
}
```

---

### 8. Dark Pool

Récupère les dark pool trades pour le ticker.

**Endpoint** : `GET /ticker-activity/{ticker}/dark-pool`

**Paramètres** :
- `ticker` (path) : Symbole du ticker
- `limit` (query, optionnel) : Nombre de résultats

**Réponse** :
```typescript
{
  success: true,
  data: [
    {
      date: "2025-12-04",
      executed_at: "2025-12-04T23:57:52Z",
      volume: 167137247,
      size: 751,
      price: 183.23,
      value: 137605.73,
      premium: "137605.73",
      ticker: "NVDA",
      market_center: "L",
      canceled: false
    },
    // ... autres trades
  ],
  cached: false,
  count: 3,
  timestamp: "2025-12-05T10:47:38.892Z"
}
```

---

### 9. Stats (Statistiques agrégées)

Récupère toutes les statistiques agrégées pour le ticker.

**Endpoint** : `GET /ticker-activity/{ticker}/stats`

**Réponse** :
```typescript
{
  success: true,
  data: {
    totalInstitutions: 100,
    totalHedgeFunds: 0,
    totalInstitutionalShares: 13400252319,
    totalInstitutionalValue: 2498583671510,
    recentBuys: 0,
    recentSells: 2,
    netActivity: -2,
    insiderTrades: 50,
    congressTrades: 3,
    optionsFlow: {
      totalAlerts: 100,
      callPremium: 0,
      putPremium: 0,
      putCallRatio: 0.6666666666666666
    },
    darkPool: {
      totalTrades: 500,
      totalVolume: 79688833276
    }
  },
  cached: false,
  timestamp: "2025-12-05T10:47:39.609Z"
}
```

---

## Endpoints Ticker Insights

### Endpoint principal : Insights agrégés

Récupère **toutes** les informations agrégées qui pourraient influencer le cours d'un ticker.

**Endpoint** : `GET /ticker-insights/{ticker}`

**Paramètres** :
- `ticker` (path) : Symbole du ticker

**Exemple de requête** :
```typescript
const response = await fetch(
  'https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/ticker-insights/NVDA',
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  }
);
```

**Réponse complète** :
```typescript
{
  success: true,
  data: {
    ticker: "NVDA",
    
    // Informations de l'entreprise
    companyInfo: {
      name: "NVIDIA Corporation",
      exchange: "NASDAQ",
      description: "...",
      website: "https://www.nvidia.com",
      ceo: "Jen-Hsun Huang"
    },
    
    // Prix actuel
    quote: {
      price: 183.38,
      change: 3.79,
      changePercent: 2.11036,
      volume: 166479246,
      dayLow: 179.97,
      dayHigh: 184.515,
      yearLow: 86.62,
      yearHigh: 212.19,
      marketCap: 4464752902544
    },
    
    // Flow d'options
    optionsFlow: {
      totalAlerts: 100,
      callVolume: 0,
      putVolume: 0,
      callPremium: 0,
      putPremium: 0,
      putCallRatio: 0.67,
      maxPain: 180,
      greeks: {
        delta: 0.5,
        gamma: 0.02,
        theta: -0.05,
        vega: 0.1
      },
      // ... autres données options
    },
    
    // Activité institutionnelle (NOUVEAU - maintenant fonctionnel)
    institutionalActivity: {
      topHolders: [
        {
          name: "VANGUARD GROUP INC",
          shares: 2223533800,
          value: 414866936311,
          percentage: 0,
          isHedgeFund: false,
          change: 0
        },
        // ... top 10 institutions
      ],
      recentActivity: [
        {
          institutionName: "VANGUARD GROUP INC",
          transactionType: "SELL",
          shares: 8911158,
          value: 83408438.88,
          date: "2025-11-07",
          price: 9.36,
          volume: 8911158,
          cik: ""
        },
        // ... transactions récentes
      ],
      stats: {
        totalInstitutions: 50,
        totalHedgeFunds: 0,
        totalShares: 12113506765,
        totalValue: 2259608271612,
        netActivity: -2,
        totalBuyVolume: 0,
        totalSellVolume: 24182381,
        totalBuyValue: 0,
        totalSellValue: 2883845312.62,
        netVolume: -24182381,
        netValue: -2883845312.62
      }
    },
    
    // Activité des dirigeants
    insiderActivity: {
      recentTransactions: [
        {
          ownerName: "EVERS ANTHONY GEORGE",
          title: "Chief Financial Officer",
          transactionType: "S",
          shares: 175966,
          value: 299142.2,
          date: "2025-12-04"
        },
        // ... autres transactions
      ],
      stats: {
        totalTransactions: 50,
        totalBuys: 10,
        totalSells: 40,
        netActivity: -30
      }
    },
    
    // Dark pool
    darkPool: {
      recentTrades: [
        {
          date: "2025-12-04",
          volume: 167137247,
          price: 183.23,
          value: 137605.73
        },
        // ... autres trades
      ],
      stats: {
        totalTrades: 500,
        totalVolume: 79688833276,
        averagePrice: 183.15
      }
    },
    
    // Earnings (résultats)
    earnings: {
      nextEarningsDate: "2025-02-21",
      lastEarningsDate: "2024-11-20",
      lastEarnings: {
        eps: 5.98,
        epsEstimated: 5.47,
        revenue: 18120000000,
        revenueEstimated: 16090000000,
        surprise: 0.51,
        surprisePercentage: 9.32
      },
      upcomingEarnings: [
        {
          date: "2025-02-21",
          epsEstimated: 6.2,
          revenueEstimated: 20000000000
        }
      ]
    },
    
    // News
    news: {
      recentArticles: [
        {
          title: "NVIDIA Announces New AI Chip",
          url: "https://...",
          publishedDate: "2025-12-05",
          source: "Reuters"
        },
        // ... autres articles
      ],
      totalArticles: 50
    },
    
    // Événements économiques
    economicEvents: [
      {
        date: "2025-12-10",
        event: "CPI Release",
        impact: "High",
        country: "US"
      },
      // ... autres événements
    ],
    
    // Short interest
    shortInterest: {
      shortRatio: 1.2,
      shortPercentOfFloat: 2.5,
      sharesShort: 50000000
    },
    
    // Métriques financières
    financialMetrics: {
      peRatio: 65.2,
      priceToBook: 25.8,
      debtToEquity: 0.15,
      returnOnEquity: 0.35
    },
    
    // Filings SEC récents
    recentFilings: [
      {
        formType: "8-K",
        filingDate: "2025-11-20",
        description: "Current Report"
      },
      // ... autres filings
    ],
    
    // Alertes générées
    alerts: [
      {
        type: "HIGH_VOLUME",
        severity: "medium",
        message: "Unusual trading volume detected",
        timestamp: "2025-12-05T10:00:00Z"
      },
      // ... autres alertes
    ]
  },
  cached: false,
  timestamp: "2025-12-05T10:47:39.609Z"
}
```

---

## Structure des réponses

### Format standard

Toutes les réponses suivent ce format :

```typescript
{
  success: boolean,        // true si succès, false si erreur
  data: T,                // Données de la réponse (type T)
  cached?: boolean,       // true si données en cache
  count?: number,         // Nombre d'éléments (pour les tableaux)
  timestamp: string,      // ISO 8601 timestamp
  error?: string          // Message d'erreur (si success = false)
}
```

### Types TypeScript recommandés

```typescript
// Types de base
interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  timestamp: string;
}

interface Ownership {
  name: string;
  shares: number;
  units: number;
  value: number;
  is_hedge_fund: boolean;
  report_date: string;
  filing_date: string;
  percentage?: number;
}

interface Activity {
  institution_name: string;
  units_change: number;
  change: number;
  avg_price: number;
  buy_price: number | null;
  sell_price: number | null;
  filing_date: string;
  report_date: string;
  price_on_filing: number;
  price_on_report: number;
  close: number;
  transaction_type: "BUY" | "SELL";
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  cached?: boolean;
  count?: number;
  timestamp: string;
  error?: string;
}

// Utilisation
type QuoteResponse = ApiResponse<Quote>;
type OwnershipResponse = ApiResponse<Ownership[]>;
type ActivityResponse = ApiResponse<Activity[]>;
```

---

## Gestion des erreurs

### Codes HTTP

- `200` : Succès
- `400` : Requête invalide (paramètres manquants ou incorrects)
- `401` : Non autorisé (token invalide ou expiré)
- `404` : Ressource non trouvée
- `429` : Trop de requêtes (rate limiting)
- `500` : Erreur serveur

### Format d'erreur

```typescript
{
  success: false,
  error: "Message d'erreur descriptif",
  timestamp: "2025-12-05T10:47:39.609Z"
}
```

### Exemple de gestion d'erreur

```typescript
async function fetchTickerQuote(ticker: string, accessToken: string) {
  try {
    const response = await fetch(
      `https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/ticker-activity/${ticker}/quote`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        // Token expiré, rediriger vers login
        throw new Error('Unauthorized - Please login again');
      }
      if (response.status === 429) {
        // Rate limit, attendre avant de réessayer
        throw new Error('Rate limit exceeded - Please wait');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Unknown error');
    }

    return data.data;
  } catch (error) {
    console.error('Error fetching ticker quote:', error);
    throw error;
  }
}
```

---

## Exemples d'implémentation

### React Hook personnalisé

```typescript
import { useState, useEffect } from 'react';

interface UseTickerQuoteResult {
  data: Quote | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useTickerQuote(ticker: string, accessToken: string): UseTickerQuoteResult {
  const [data, setData] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuote = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/ticker-activity/${ticker}/quote`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticker && accessToken) {
      fetchQuote();
    }
  }, [ticker, accessToken]);

  return { data, loading, error, refetch: fetchQuote };
}

// Utilisation
function TickerQuoteComponent({ ticker, accessToken }: { ticker: string; accessToken: string }) {
  const { data, loading, error } = useTickerQuote(ticker, accessToken);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!data) return <div>No data</div>;

  return (
    <div>
      <h2>{data.symbol}</h2>
      <p>Price: ${data.price}</p>
      <p>Change: {data.changePercent}%</p>
      <p>Volume: {data.volume.toLocaleString()}</p>
    </div>
  );
}
```

### Service TypeScript

```typescript
class TickerApiService {
  private baseUrl = 'https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod';
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Unknown error');
    }

    return data.data;
  }

  async getQuote(ticker: string): Promise<Quote> {
    return this.request<Quote>(`/ticker-activity/${ticker}/quote`);
  }

  async getOwnership(ticker: string, limit = 100): Promise<Ownership[]> {
    return this.request<Ownership[]>(`/ticker-activity/${ticker}/ownership?limit=${limit}`);
  }

  async getActivity(ticker: string, limit = 100): Promise<Activity[]> {
    return this.request<Activity[]>(`/ticker-activity/${ticker}/activity?limit=${limit}`);
  }

  async getInsights(ticker: string): Promise<TickerInsights> {
    return this.request<TickerInsights>(`/ticker-insights/${ticker}`);
  }
}

// Utilisation
const apiService = new TickerApiService(accessToken);
const quote = await apiService.getQuote('NVDA');
const insights = await apiService.getInsights('NVDA');
```

### Vue.js Composable

```typescript
import { ref, computed } from 'vue';

export function useTickerInsights(ticker: string, accessToken: string) {
  const data = ref(null);
  const loading = ref(false);
  const error = ref(null);

  const fetchInsights = async () => {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch(
        `https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/ticker-insights/${ticker}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      data.value = result.data;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  const institutionalActivity = computed(() => data.value?.institutionalActivity);
  const topHolders = computed(() => institutionalActivity.value?.topHolders || []);
  const recentActivity = computed(() => institutionalActivity.value?.recentActivity || []);

  return {
    data,
    loading,
    error,
    fetchInsights,
    institutionalActivity,
    topHolders,
    recentActivity
  };
}
```

---

## Notes importantes

### Cache

- Les données peuvent être mises en cache côté serveur
- Le champ `cached` indique si les données proviennent du cache
- Pour forcer un refresh, vous pouvez ajouter un paramètre `force_refresh=true` (si supporté)

### Rate Limiting

- Respectez les limites de taux pour éviter les erreurs 429
- Implémentez un système de retry avec backoff exponentiel

### Performance

- L'endpoint `/ticker-insights` peut prendre plusieurs secondes (il agrège beaucoup de données)
- Utilisez des loaders/spinners pendant le chargement
- Considérez le chargement progressif des sections

### Données manquantes

- Certains champs peuvent être `null` ou `undefined` si les données ne sont pas disponibles
- Toujours vérifier l'existence des données avant de les utiliser
- Les tableaux peuvent être vides (`[]`) si aucune donnée n'est disponible

---

## Support

Pour toute question ou problème, contactez l'équipe backend.

**Dernière mise à jour** : 2025-12-05

