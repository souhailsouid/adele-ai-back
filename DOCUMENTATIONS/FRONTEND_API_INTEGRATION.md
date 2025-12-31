# 🔌 Intégration Frontend : API + Realtime

## 🎯 Architecture Complète

Le frontend utilise **2 méthodes** pour obtenir les signaux :

1. **API REST** : Récupération initiale et pagination
2. **Supabase Realtime** : Alertes en temps réel

---

## 📋 1. API REST (Récupération Initiale)

### Endpoint

```
GET https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals
```

### Authentification

**⚠️ JWT Token requis (Cognito)**

```typescript
// lib/auth.ts
import { Auth } from 'aws-amplify';

export const getAccessToken = async (): Promise<string> => {
  try {
    const session = await Auth.currentSession();
    return session.getIdToken().getJwtToken();
  } catch (error) {
    // Rediriger vers login si pas authentifié
    throw new Error('Non authentifié');
  }
};
```

### Exemple Complet

```typescript
// hooks/useSignals.ts
import { useQuery } from '@tanstack/react-query';
import { getAccessToken } from '@/lib/auth';
import { Signal } from '@/types/signals';

export const useSignals = (filters: {
  source?: string;
  type?: string;
  minImportance?: number;
  limit?: number;
  offset?: number;
} = {}) => {
  return useQuery<Signal[]>({
    queryKey: ['signals', filters],
    queryFn: async () => {
      const token = await getAccessToken();
      
      const params = new URLSearchParams();
      if (filters.source) params.append('source', filters.source);
      if (filters.type) params.append('type', filters.type);
      if (filters.minImportance) params.append('min_importance', filters.minImportance.toString());
      params.append('limit', (filters.limit || 50).toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const response = await fetch(
        `https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          // Rediriger vers login
          window.location.href = '/login';
          throw new Error('Non autorisé');
        }
        throw new Error(`Erreur API: ${response.status}`);
      }

      return response.json();
    },
    staleTime: 30000, // 30 secondes
    refetchInterval: 60000, // Refetch toutes les minutes
  });
};
```

---

## 📋 2. Supabase Realtime (Alertes Temps Réel)

### Configuration

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

### Hook Realtime

```typescript
// hooks/useRealtimeSignals.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Signal } from '@/types/signals';

export const useRealtimeSignals = (keywords: string[] = []) => {
  const [newSignals, setNewSignals] = useState<Signal[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('signals-realtime', {
        config: { broadcast: { self: true } },
      })
      .on('broadcast', { event: 'INSERT' }, (payload) => {
        const signal = payload.payload as Signal;
        
        // Filtrer par keywords
        if (keywords.length > 0) {
          const text = `${signal.raw_data.title} ${signal.raw_data.description || ''}`.toLowerCase();
          const hasKeyword = keywords.some(k => text.includes(k.toLowerCase()));
          if (!hasKeyword) return;
        }

        setNewSignals((prev) => [signal, ...prev].slice(0, 20));
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [keywords]);

  return { signals: newSignals, isConnected };
};
```

---

## 🎨 Composant Complet

```typescript
// app/signals/page.tsx

'use client';

import { useSignals } from '@/hooks/useSignals';
import { useRealtimeSignals } from '@/hooks/useRealtimeSignals';
import { SignalCard } from '@/components/SignalCard';
import { Bell } from 'lucide-react';

export default function SignalsPage() {
  const criticalKeywords = ['Trump', 'CPI', 'Fed', 'GDP', 'NFP'];
  
  // Récupération initiale via API
  const { data: signals, isLoading } = useSignals({
    source: 'rss',
    type: 'macro',
    minImportance: 7,
    limit: 50,
  });

  // Alertes temps réel via Realtime
  const { signals: newAlerts, isConnected } = useRealtimeSignals(criticalKeywords);

  if (isLoading) return <div>Chargement...</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Signaux RSS Financial Juice</h1>

      {/* Alertes en temps réel */}
      {newAlerts.length > 0 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-5 h-5 text-yellow-600" />
            <h2 className="font-semibold">
              🔔 {newAlerts.length} nouvelle(s) alerte(s)
            </h2>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
          </div>
          <div className="space-y-2">
            {newAlerts.slice(0, 3).map((signal) => (
              <div key={signal.id} className="text-sm">
                {signal.raw_data.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste principale */}
      <div className="space-y-4">
        {signals?.map((signal) => (
          <SignalCard key={signal.id} signal={signal} />
        ))}
      </div>
    </div>
  );
}
```

---

## 🔄 Flux Complet

```
1. Page Load
   ↓
2. useSignals() → API REST
   → Récupère les 50 derniers signaux
   → Affiche la liste
   ↓
3. useRealtimeSignals() → Supabase Realtime
   → S'abonne aux nouveaux signaux
   → Affiche les alertes en temps réel
   ↓
4. Nouveau signal arrive
   → Trigger Supabase diffuse via broadcast
   → Frontend reçoit instantanément
   → Affiche l'alerte
```

---

## ✅ Checklist Frontend

### API REST
- [ ] Configurer AWS Amplify pour Cognito
- [ ] Créer `getAccessToken()` pour obtenir le JWT
- [ ] Créer hook `useSignals()` avec React Query
- [ ] Gérer les erreurs 401 (redirection login)
- [ ] Tester avec l'URL : `https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&type=macro&min_importance=7&limit=50`

### Supabase Realtime
- [ ] Configurer Supabase client
- [ ] Créer hook `useRealtimeSignals()` avec `broadcast`
- [ ] Tester : Insérer un signal SQL → Vérifier réception frontend

---

## 🎯 Résumé

| Méthode | Usage | Authentification |
|---------|-------|------------------|
| **API REST** | Récupération initiale, pagination | JWT Cognito (obligatoire) |
| **Supabase Realtime** | Alertes temps réel | Clé anon (publique) |

**Les deux méthodes fonctionnent ensemble pour une expérience complète !**


