# 🎯 Guide Frontend : Intégration FMP Signals

## 📋 Vue d'ensemble

Le backend expose deux façons d'accéder aux signaux FMP :
1. **API REST** : `GET /market-signals/{ticker}?currentPrice=180` (requête manuelle)
2. **Realtime** : Broadcast Supabase sur le topic `fmp_signals:events` (alertes automatiques)

---

## 🔌 1. API REST - Détection Manuelle

### Endpoint

```
GET /market-signals/{ticker}?currentPrice=180
```

**Base URL** : `https://{api-gateway-url}/prod`

**Headers** :
```typescript
{
  "Authorization": "Bearer {JWT_TOKEN}",
  "Content-Type": "application/json"
}
```

### Exemple d'utilisation

```typescript
// services/marketSignalsService.ts
import { API_URL } from '@/config';

export interface MarketSignalResponse {
  ticker: string;
  hasAlert: boolean;
  alert?: {
    ticker: string;
    type: 'bullish' | 'bearish';
    severity: 'low' | 'medium' | 'high';
    signals: string[];
    message: string;
    timestamp: string;
    source: 'fmp';
    details?: Record<string, any>;
  };
  message?: string;
}

export async function getMarketSignal(
  ticker: string,
  currentPrice: number,
  token: string
): Promise<MarketSignalResponse> {
  const response = await fetch(
    `${API_URL}/market-signals/${ticker}?currentPrice=${currentPrice}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
```

### Utilisation dans un composant

```typescript
// components/TickerAlerts.tsx
'use client';

import { useState, useEffect } from 'react';
import { getMarketSignal } from '@/services/marketSignalsService';
import { useAuth } from '@/hooks/useAuth';

interface TickerAlertsProps {
  ticker: string;
  currentPrice: number;
}

export function TickerAlerts({ ticker, currentPrice }: TickerAlertsProps) {
  const [signal, setSignal] = useState<MarketSignalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const { getToken } = useAuth();

  const checkSignal = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const result = await getMarketSignal(ticker, currentPrice, token);
      setSignal(result);
    } catch (error) {
      console.error('Error fetching market signal:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticker && currentPrice > 0) {
      checkSignal();
    }
  }, [ticker, currentPrice]);

  if (loading) {
    return <div>Checking signals...</div>;
  }

  if (!signal?.hasAlert) {
    return null;
  }

  const { alert } = signal;
  const isBullish = alert.type === 'bullish';

  return (
    <div className={`p-4 rounded-lg border ${
      isBullish 
        ? 'bg-green-500/10 border-green-500/30' 
        : 'bg-red-500/10 border-red-500/30'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-lg font-bold ${
          isBullish ? 'text-green-400' : 'text-red-400'
        }`}>
          {isBullish ? '🟢' : '🔴'} {alert.type.toUpperCase()}
        </span>
        <span className={`px-2 py-1 rounded text-xs ${
          alert.severity === 'high' 
            ? 'bg-orange-500/20 text-orange-400'
            : 'bg-blue-500/20 text-blue-400'
        }`}>
          {alert.severity}
        </span>
      </div>
      
      <p className="text-sm text-neutral-300 mb-2">{alert.message}</p>
      
      <div className="space-y-1">
        {alert.signals.map((signal, idx) => (
          <div key={idx} className="text-xs text-neutral-400 flex items-center gap-2">
            <span>•</span>
            <span>{signal}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 📡 2. Realtime - Alertes Automatiques

### Hook React pour Realtime

```typescript
// hooks/useFMPSignals.ts
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/config';

interface FMPSignal {
  id: string;
  ticker: string;
  type: 'bullish' | 'bearish';
  severity: 'low' | 'medium' | 'high';
  signals: string[];
  message: string;
  timestamp: string;
  source: 'fmp';
  details?: Record<string, any>;
}

export function useFMPSignals(ticker?: string) {
  const [signals, setSignals] = useState<FMPSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // 1. Charger les signaux existants
    const loadInitialSignals = async () => {
      try {
        let query = supabase
          .from('fmp_signals')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (ticker) {
          query = query.eq('ticker', ticker);
        }

        const { data, error } = await query;

        if (error) throw error;
        setSignals(data || []);
      } catch (error) {
        console.error('Error loading FMP signals:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialSignals();

    // 2. S'abonner aux nouveaux signaux via Realtime
    const channel = supabase
      .channel('fmp_signals:events', {
        config: { private: true },
      })
      .on(
        'broadcast',
        { event: '*' },
        (payload) => {
          const event = payload.payload;
          
          if (event.event === 'INSERT' && event.data) {
            const newSignal = event.data as FMPSignal;
            
            // Filtrer par ticker si spécifié
            if (!ticker || newSignal.ticker === ticker) {
              setSignals((prev) => [newSignal, ...prev]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [ticker]);

  return { signals, loading };
}
```

### Composant d'Alertes Realtime

```typescript
// components/FMPAlertsList.tsx
'use client';

import { useFMPSignals } from '@/hooks/useFMPSignals';
import { FMPAlertCard } from './FMPAlertCard';

interface FMPAlertsListProps {
  ticker?: string;
  maxItems?: number;
}

export function FMPAlertsList({ ticker, maxItems = 10 }: FMPAlertsListProps) {
  const { signals, loading } = useFMPSignals(ticker);

  if (loading) {
    return (
      <div className="glass-card rounded-lg p-8 text-center">
        <div className="inline-block w-6 h-6 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
        <p className="text-neutral-400 mt-4">Chargement des alertes...</p>
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div className="glass-card rounded-lg p-8 text-center">
        <p className="text-neutral-400">Aucune alerte FMP pour le moment</p>
      </div>
    );
  }

  const displayedSignals = signals.slice(0, maxItems);

  return (
    <div className="space-y-4">
      {displayedSignals.map((signal) => (
        <FMPAlertCard key={signal.id} signal={signal} />
      ))}
    </div>
  );
}
```

### Carte d'Alerte

```typescript
// components/FMPAlertCard.tsx
'use client';

interface FMPSignal {
  id: string;
  ticker: string;
  type: 'bullish' | 'bearish';
  severity: 'low' | 'medium' | 'high';
  signals: string[];
  message: string;
  timestamp: string;
  source: 'fmp';
  details?: Record<string, any>;
}

interface FMPAlertCardProps {
  signal: FMPSignal;
}

export function FMPAlertCard({ signal }: FMPAlertCardProps) {
  const isBullish = signal.type === 'bullish';
  const severityColors = {
    high: 'bg-red-500/10 border-red-500/30 text-red-400',
    medium: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    low: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  };

  return (
    <div className={`glass-card rounded-lg p-5 border transition-all hover:border-white/20 ${
      isBullish 
        ? 'border-green-500/30 bg-green-500/5' 
        : 'border-red-500/30 bg-red-500/5'
    }`}>
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold">
              {isBullish ? '🟢' : '🔴'} {signal.ticker}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${
              severityColors[signal.severity]
            }`}>
              {signal.severity}
            </span>
          </div>
          <p className="text-sm text-neutral-300 font-medium">
            {signal.message}
          </p>
        </div>
      </div>

      {/* Signaux détectés */}
      <div className="space-y-1.5 mb-3">
        {signal.signals.map((sig, idx) => (
          <div key={idx} className="text-xs text-neutral-400 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-orange-400"></span>
            <span>{sig}</span>
          </div>
        ))}
      </div>

      {/* Métadonnées */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <span className="text-xs text-neutral-500">
          {new Date(signal.timestamp).toLocaleString('fr-FR')}
        </span>
        <span className="text-xs text-neutral-500">Source: FMP</span>
      </div>
    </div>
  );
}
```

---

## 🔄 3. Intégration avec Signaux RSS

### Hook Combiné (RSS + FMP)

```typescript
// hooks/useAllSignals.ts
'use client';

import { useRealtimeSignals } from './useRealtimeSignals';
import { useFMPSignals } from './useFMPSignals';

export function useAllSignals(ticker?: string) {
  const { signals: rssSignals } = useRealtimeSignals();
  const { signals: fmpSignals } = useFMPSignals(ticker);

  // Combiner et trier par timestamp
  const allSignals = [
    ...rssSignals.map(s => ({ ...s, source: 'rss' as const })),
    ...fmpSignals.map(s => ({ ...s, source: 'fmp' as const })),
  ].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return {
    signals: allSignals,
    rssCount: rssSignals.length,
    fmpCount: fmpSignals.length,
  };
}
```

---

## 📱 4. Notification Push (Optionnel)

```typescript
// hooks/useFMPNotifications.ts
'use client';

import { useEffect } from 'react';
import { useFMPSignals } from './useFMPSignals';

export function useFMPNotifications(enabled: boolean = true) {
  const { signals } = useFMPSignals();

  useEffect(() => {
    if (!enabled || signals.length === 0) return;

    const latestSignal = signals[0];
    
    // Vérifier si c'est une nouvelle alerte (moins de 5 minutes)
    const signalAge = Date.now() - new Date(latestSignal.timestamp).getTime();
    if (signalAge > 5 * 60 * 1000) return; // Ignorer les anciennes alertes

    // Demander permission pour les notifications
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Alerte ${latestSignal.type.toUpperCase()} : ${latestSignal.ticker}`, {
        body: latestSignal.message,
        icon: '/icon.png',
        tag: latestSignal.id,
      });
    }
  }, [signals, enabled]);
}
```

---

## 🎨 5. Exemple d'Intégration Complète

```typescript
// app/ticker/[symbol]/page.tsx
'use client';

import { TickerAlerts } from '@/components/TickerAlerts';
import { FMPAlertsList } from '@/components/FMPAlertsList';
import { useAllSignals } from '@/hooks/useAllSignals';

export default function TickerPage({ params }: { params: { symbol: string } }) {
  const ticker = params.symbol.toUpperCase();
  const { signals, rssCount, fmpCount } = useAllSignals(ticker);
  const currentPrice = 180; // À récupérer depuis votre source de prix

  return (
    <div className="space-y-6">
      {/* Détection manuelle */}
      <section>
        <h2 className="text-xl font-bold mb-4">Détection de Signaux</h2>
        <TickerAlerts ticker={ticker} currentPrice={currentPrice} />
      </section>

      {/* Alertes Realtime FMP */}
      <section>
        <h2 className="text-xl font-bold mb-4">
          Alertes FMP ({fmpCount})
        </h2>
        <FMPAlertsList ticker={ticker} maxItems={10} />
      </section>

      {/* Tous les signaux combinés */}
      <section>
        <h2 className="text-xl font-bold mb-4">
          Tous les Signaux ({signals.length})
        </h2>
        <div className="space-y-4">
          {signals.map((signal) => (
            <div key={signal.id} className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">{signal.ticker}</span>
                <span className="text-xs text-neutral-500">
                  {signal.source === 'fmp' ? 'FMP' : 'RSS'}
                </span>
              </div>
              {/* Afficher selon le type de signal */}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

---

## ✅ Checklist Frontend

- [ ] Créer `services/marketSignalsService.ts`
- [ ] Créer hook `useFMPSignals.ts`
- [ ] Créer composant `FMPAlertCard.tsx`
- [ ] Créer composant `FMPAlertsList.tsx`
- [ ] Créer composant `TickerAlerts.tsx` (détection manuelle)
- [ ] Intégrer dans la page ticker
- [ ] Tester avec un ticker réel (AAPL, TSLA, etc.)
- [ ] (Optionnel) Ajouter notifications push

---

## 🧪 Test Rapide

```typescript
// Test dans la console du navigateur
const testSignal = async () => {
  const token = 'YOUR_JWT_TOKEN';
  const response = await fetch(
    'https://{api-url}/prod/market-signals/AAPL?currentPrice=180',
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  const data = await response.json();
  console.log('Signal:', data);
};
```

---

## 📚 Références

- **API Endpoint** : `GET /market-signals/{ticker}?currentPrice={price}`
- **Realtime Topic** : `fmp_signals:events`
- **Table Supabase** : `fmp_signals`
- **Backend Service** : `market-signals.service.ts`


