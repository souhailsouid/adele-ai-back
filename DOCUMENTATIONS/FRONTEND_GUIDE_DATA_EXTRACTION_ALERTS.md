# 📱 Guide Frontend : Données Extraites & Alertes

## 🎯 Vue d'Ensemble

Le backend extrait automatiquement les données structurées depuis les news RSS Financial Juice et les stocke dans `raw_data.extracted_data`. Le frontend peut utiliser ces données pour afficher des indicateurs visuels (surprises, comparaisons, etc.).

---

## 📊 Structure des Données

### Type TypeScript pour Signal avec Données Extraites

```typescript
// types/signals.ts

export interface ExtractedData {
  actual?: number;
  forecast?: number;
  previous?: number;
  dataType?: 'inflation' | 'gdp' | 'employment' | 'retail_sales' | 'industrial_production' | 'other';
  indicator?: string; // 'CPI', 'GDP', 'NFP', etc.
  surprise?: 'positive' | 'negative' | 'neutral';
  surpriseMagnitude?: number; // Différence en points de pourcentage
  unit?: 'percent' | 'absolute' | 'index';
  period?: 'monthly' | 'quarterly' | 'yearly';
  region?: 'US' | 'JP' | 'EU' | 'CN';
}

export interface Signal {
  id: string;
  source: 'rss' | 'scrapecreators' | 'coinglass' | 'sec_8k' | 'sec_13f';
  type: string;
  timestamp: string;
  raw_data: {
    title: string;
    description?: string;
    url: string;
    feed?: string;
    guid?: string;
    extracted_data?: ExtractedData; // NOUVEAU
  };
  summary?: string;
  importance_score?: number;
  tags?: string[];
  impact?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
}
```

---

## 🔌 Endpoints API

### 1. Récupérer les Signaux RSS avec Données Extraites

```typescript
// GET /signals?source=rss&type=macro&limit=50

const response = await fetch(
  `${API_URL}/signals?source=rss&type=macro&limit=50`,
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  }
);

const signals: Signal[] = await response.json();
```

### 2. Filtrer par Surprise Économique

```typescript
// Récupérer tous les signaux, puis filtrer côté frontend
const signalsWithSurprise = signals.filter(
  (signal) => signal.raw_data?.extracted_data?.surprise
);
```

### 3. Rechercher par Keyword

```typescript
// POST /search
const response = await fetch(`${API_URL}/search`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    query: 'CPI',
    limit: 20,
  }),
});

const results: Signal[] = await response.json();
```

---

## 🎨 Composants React Recommandés

### 1. Composant SignalCard avec Données Extraites

```typescript
// components/SignalCard.tsx

import { Signal, ExtractedData } from '@/types/signals';

interface SignalCardProps {
  signal: Signal;
}

export const SignalCard = ({ signal }: SignalCardProps) => {
  const extractedData = signal.raw_data?.extracted_data;
  const hasData = extractedData && extractedData.actual !== undefined;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Titre */}
      <h3 className="font-semibold text-lg">{signal.raw_data.title}</h3>

      {/* Données Extraites */}
      {hasData && (
        <ExtractedDataDisplay data={extractedData} />
      )}

      {/* Description */}
      {signal.raw_data.description && (
        <p className="text-sm text-gray-600">{signal.raw_data.description}</p>
      )}

      {/* Métadonnées */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>{signal.raw_data.feed}</span>
        <span>{new Date(signal.timestamp).toLocaleString()}</span>
        {signal.importance_score && (
          <span>⭐ {signal.importance_score}/10</span>
        )}
      </div>

      {/* Lien */}
      <a
        href={signal.raw_data.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline text-sm"
      >
        Lire la suite →
      </a>
    </div>
  );
};
```

### 2. Composant ExtractedDataDisplay

```typescript
// components/ExtractedDataDisplay.tsx

import { ExtractedData } from '@/types/signals';

interface ExtractedDataDisplayProps {
  data: ExtractedData;
}

export const ExtractedDataDisplay = ({ data }: ExtractedDataDisplayProps) => {
  const getSurpriseColor = () => {
    if (data.surprise === 'positive') return 'text-green-600 bg-green-50';
    if (data.surprise === 'negative') return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getSurpriseIcon = () => {
    if (data.surprise === 'positive') return '📈';
    if (data.surprise === 'negative') return '📉';
    return '➡️';
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
      {/* En-tête */}
      <div className="flex items-center gap-2">
        <span className="font-semibold text-blue-900">
          {data.indicator || 'Données économiques'}
        </span>
        {data.region && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
            {data.region}
          </span>
        )}
      </div>

      {/* Valeurs */}
      <div className="grid grid-cols-3 gap-4">
        {data.actual !== undefined && (
          <div>
            <div className="text-xs text-gray-600">Actual</div>
            <div className="text-lg font-bold">{data.actual}%</div>
          </div>
        )}
        {data.forecast !== undefined && (
          <div>
            <div className="text-xs text-gray-600">Forecast</div>
            <div className="text-lg">{data.forecast}%</div>
          </div>
        )}
        {data.previous !== undefined && (
          <div>
            <div className="text-xs text-gray-600">Previous</div>
            <div className="text-lg">{data.previous}%</div>
          </div>
        )}
      </div>

      {/* Surprise */}
      {data.surprise && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded ${getSurpriseColor()}`}>
          <span className="text-xl">{getSurpriseIcon()}</span>
          <div>
            <div className="font-semibold">
              Surprise: {data.surprise}
            </div>
            {data.surpriseMagnitude && (
              <div className="text-xs">
                {data.surpriseMagnitude.toFixed(2)} points de pourcentage
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
```

### 3. Composant Alertes en Temps Réel (Supabase Realtime)

```typescript
// hooks/useRealtimeAlerts.ts

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Signal } from '@/types/signals';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const useRealtimeAlerts = (keywords: string[] = []) => {
  const [alerts, setAlerts] = useState<Signal[]>([]);

  useEffect(() => {
    // S'abonner aux nouveaux signaux RSS
    const channel = supabase
      .channel('rss-signals')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'signals',
          filter: 'source=eq.rss',
        },
        async (payload) => {
          const newSignal = payload.new as Signal;
          
          // Vérifier si le signal contient un keyword
          const text = `${newSignal.raw_data.title} ${newSignal.raw_data.description || ''}`.toLowerCase();
          const hasKeyword = keywords.some(keyword => 
            text.includes(keyword.toLowerCase())
          );
          
          if (hasKeyword) {
            setAlerts((prev) => [newSignal, ...prev].slice(0, 10)); // Garder les 10 derniers
            
            // Optionnel : Notification browser
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`Nouvelle alerte: ${newSignal.raw_data.title}`, {
                body: newSignal.raw_data.description?.substring(0, 100),
                icon: '/icon.png',
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [keywords]);

  return alerts;
};
```

### 4. Composant Liste de Signaux avec Filtres

```typescript
// components/SignalsList.tsx

'use client';

import { useState, useEffect } from 'react';
import { SignalCard } from './SignalCard';
import { Signal } from '@/types/signals';

export const SignalsList = () => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    source: 'rss',
    type: 'macro',
    minImportance: 7,
    showSurprisesOnly: false,
  });

  useEffect(() => {
    fetchSignals();
  }, [filters]);

  const fetchSignals = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        source: filters.source,
        type: filters.type,
        min_importance: filters.minImportance.toString(),
        limit: '50',
      });

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/signals?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      let data: Signal[] = await response.json();

      // Filtrer les surprises si demandé
      if (filters.showSurprisesOnly) {
        data = data.filter(
          (s) => s.raw_data?.extracted_data?.surprise
        );
      }

      setSignals(data);
    } catch (error) {
      console.error('Error fetching signals:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Chargement...</div>;

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex gap-4 items-center">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={filters.showSurprisesOnly}
            onChange={(e) =>
              setFilters({ ...filters, showSurprisesOnly: e.target.checked })
            }
          />
          <span>Surprises uniquement</span>
        </label>
        <select
          value={filters.minImportance}
          onChange={(e) =>
            setFilters({ ...filters, minImportance: Number(e.target.value) })
          }
          className="border rounded px-2 py-1"
        >
          <option value={5}>Importance ≥ 5</option>
          <option value={7}>Importance ≥ 7</option>
          <option value={9}>Importance ≥ 9</option>
        </select>
      </div>

      {/* Liste */}
      <div className="space-y-4">
        {signals.map((signal) => (
          <SignalCard key={signal.id} signal={signal} />
        ))}
      </div>
    </div>
  );
};
```

---

## 📊 Exemples d'Affichage

### Badge de Surprise

```typescript
// components/SurpriseBadge.tsx

interface SurpriseBadgeProps {
  surprise: 'positive' | 'negative' | 'neutral';
  magnitude?: number;
}

export const SurpriseBadge = ({ surprise, magnitude }: SurpriseBadgeProps) => {
  const config = {
    positive: { emoji: '📈', color: 'bg-green-100 text-green-800', label: 'Surprise positive' },
    negative: { emoji: '📉', color: 'bg-red-100 text-red-800', label: 'Surprise négative' },
    neutral: { emoji: '➡️', color: 'bg-gray-100 text-gray-800', label: 'Dans les attentes' },
  };

  const { emoji, color, label } = config[surprise];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${color}`}>
      <span>{emoji}</span>
      <span>{label}</span>
      {magnitude && (
        <span className="ml-1">({magnitude.toFixed(2)}pp)</span>
      )}
    </span>
  );
};
```

### Graphique de Comparaison Actual vs Forecast

```typescript
// components/DataComparisonChart.tsx

import { ExtractedData } from '@/types/signals';

export const DataComparisonChart = ({ data }: { data: ExtractedData }) => {
  if (!data.actual || !data.forecast) return null;

  const max = Math.max(data.actual, data.forecast, data.previous || 0) * 1.1;
  const actualPercent = (data.actual / max) * 100;
  const forecastPercent = (data.forecast / max) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2 h-32">
        {/* Forecast */}
        <div className="flex-1 flex flex-col items-center">
          <div
            className="w-full bg-blue-200 rounded-t"
            style={{ height: `${forecastPercent}%` }}
          />
          <div className="text-xs mt-1">Forecast</div>
          <div className="text-sm font-semibold">{data.forecast}%</div>
        </div>

        {/* Actual */}
        <div className="flex-1 flex flex-col items-center">
          <div
            className={`w-full rounded-t ${
              data.actual > data.forecast ? 'bg-green-500' : 'bg-red-500'
            }`}
            style={{ height: `${actualPercent}%` }}
          />
          <div className="text-xs mt-1">Actual</div>
          <div className="text-sm font-semibold">{data.actual}%</div>
        </div>

        {/* Previous */}
        {data.previous && (
          <div className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-gray-300 rounded-t"
              style={{ height: `${(data.previous / max) * 100}%` }}
            />
            <div className="text-xs mt-1">Previous</div>
            <div className="text-sm font-semibold">{data.previous}%</div>
          </div>
        )}
      </div>
    </div>
  );
};
```

---

## 🔔 Alertes Temps Réel (Optionnel)

### Configuration Supabase Realtime

```typescript
// lib/supabase.ts

import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
```

### Hook pour Alertes en Temps Réel

```typescript
// hooks/useRealtimeSignals.ts

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Signal } from '@/types/signals';

export const useRealtimeSignals = (keywords: string[] = []) => {
  const [newSignals, setNewSignals] = useState<Signal[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel('rss-signals-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'signals',
          filter: 'source=eq.rss',
        },
        (payload) => {
          const signal = payload.new as Signal;
          const text = `${signal.raw_data.title} ${signal.raw_data.description || ''}`.toLowerCase();
          
          // Vérifier si contient un keyword
          if (keywords.length === 0 || keywords.some(k => text.includes(k.toLowerCase()))) {
            setNewSignals((prev) => [signal, ...prev].slice(0, 20));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [keywords]);

  return newSignals;
};
```

---

## 🎨 Exemple de Page Complète

```typescript
// app/signals/page.tsx

'use client';

import { SignalsList } from '@/components/SignalsList';
import { useRealtimeSignals } from '@/hooks/useRealtimeSignals';

export default function SignalsPage() {
  const criticalKeywords = ['Trump', 'CPI', 'Fed', 'GDP', 'NFP'];
  const newAlerts = useRealtimeSignals(criticalKeywords);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Signaux RSS Financial Juice</h1>

      {/* Alertes en temps réel */}
      {newAlerts.length > 0 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h2 className="font-semibold mb-2">
            🔔 {newAlerts.length} nouvelle(s) alerte(s)
          </h2>
          <div className="space-y-2">
            {newAlerts.slice(0, 3).map((signal) => (
              <div key={signal.id} className="text-sm">
                {signal.raw_data.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste des signaux */}
      <SignalsList />
    </div>
  );
}
```

---

## 📋 Checklist Frontend

- [ ] Créer les types TypeScript (`ExtractedData`, `Signal`)
- [ ] Créer le composant `SignalCard` avec affichage des données extraites
- [ ] Créer le composant `ExtractedDataDisplay` pour les surprises
- [ ] Ajouter les filtres (surprises uniquement, importance minimale)
- [ ] Implémenter Supabase Realtime pour les alertes (optionnel)
- [ ] Ajouter les notifications browser (optionnel)
- [ ] Tester avec les données réelles depuis l'API

---

## 🔗 URLs de Test

```typescript
// Exemples de requêtes

// Tous les signaux RSS macro
GET /signals?source=rss&type=macro&limit=50

// Signaux avec importance ≥ 8
GET /signals?source=rss&min_importance=8

// Rechercher "CPI"
POST /search
Body: { "query": "CPI", "limit": 20 }
```

---

## 💡 Bonnes Pratiques

1. **Cache** : Utiliser React Query ou SWR pour cacher les signaux
2. **Pagination** : Implémenter la pagination avec `offset` et `limit`
3. **Filtres** : Permettre de filtrer par `surprise`, `indicator`, `region`
4. **Performance** : Virtualiser la liste si > 100 signaux
5. **Accessibilité** : Ajouter des labels ARIA pour les graphiques


