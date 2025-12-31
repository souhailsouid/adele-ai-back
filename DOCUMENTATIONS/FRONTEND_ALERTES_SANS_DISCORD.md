# 📱 Guide Frontend : Alertes Temps Réel (Sans Discord)

## 🎯 Architecture Recommandée

**Discord/Slack sont optionnels** - ils servent uniquement à notifier l'équipe backend.

**Pour le frontend**, vous avez **2 options** :

### Option 1 : Supabase Realtime (Recommandé) ⭐
- ✅ Alertes instantanées (< 1 seconde)
- ✅ Pas besoin de backend supplémentaire
- ✅ Notifications browser natives
- ✅ Gratuit (inclus dans Supabase)

### Option 2 : Polling API
- ✅ Simple à implémenter
- ⚠️ Latence (dépend de la fréquence de polling)
- ⚠️ Consomme plus de ressources

---

## 🚀 Option 1 : Supabase Realtime (Recommandé)

### 1. Configuration Supabase Client

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

### 2. Hook pour Alertes en Temps Réel

```typescript
// hooks/useRealtimeAlerts.ts

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Signal } from '@/types/signals';

interface UseRealtimeAlertsOptions {
  keywords?: string[];
  onNewAlert?: (signal: Signal) => void;
  enableBrowserNotifications?: boolean;
}

export const useRealtimeAlerts = (options: UseRealtimeAlertsOptions = {}) => {
  const {
    keywords = [],
    onNewAlert,
    enableBrowserNotifications = false,
  } = options;

  const [alerts, setAlerts] = useState<Signal[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Demander permission pour notifications browser
    if (enableBrowserNotifications && 'Notification' in window) {
      Notification.requestPermission();
    }

    // S'abonner aux nouveaux signaux RSS
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
          const newSignal = payload.new as Signal;
          
          // Filtrer par keywords si spécifiés
          if (keywords.length > 0) {
            const text = `${newSignal.raw_data.title} ${newSignal.raw_data.description || ''}`.toLowerCase();
            const hasKeyword = keywords.some(keyword => 
              text.includes(keyword.toLowerCase())
            );
            
            if (!hasKeyword) return; // Ignorer si pas de keyword match
          }

          // Vérifier aussi les surprises économiques significatives
          const extractedData = newSignal.raw_data?.extracted_data;
          const isSignificantSurprise = extractedData?.surprise && 
            extractedData.surprise !== 'neutral' &&
            (extractedData.surpriseMagnitude || 0) > 0.2;

          // Ajouter l'alerte
          setAlerts((prev) => [newSignal, ...prev].slice(0, 20));
          
          // Callback personnalisé
          if (onNewAlert) {
            onNewAlert(newSignal);
          }

          // Notification browser
          if (enableBrowserNotifications && 'Notification' in window && Notification.permission === 'granted') {
            const title = isSignificantSurprise 
              ? `📊 ${extractedData?.indicator || 'Economic'} Surprise: ${extractedData?.surprise}`
              : `🔔 Nouvelle alerte: ${newSignal.raw_data.title}`;
            
            new Notification(title, {
              body: newSignal.raw_data.description?.substring(0, 100) || newSignal.raw_data.title,
              icon: '/icon.png',
              tag: newSignal.id, // Évite les doublons
            });
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [keywords, onNewAlert, enableBrowserNotifications]);

  return { alerts, isConnected };
};
```

### 3. Composant d'Alertes

```typescript
// components/RealtimeAlerts.tsx

'use client';

import { useRealtimeAlerts } from '@/hooks/useRealtimeAlerts';
import { SignalCard } from './SignalCard';
import { Bell, BellOff } from 'lucide-react';

interface RealtimeAlertsProps {
  keywords?: string[];
  maxAlerts?: number;
}

export const RealtimeAlerts = ({ 
  keywords = ['Trump', 'CPI', 'Fed', 'GDP', 'NFP'],
  maxAlerts = 5 
}: RealtimeAlertsProps) => {
  const { alerts, isConnected } = useRealtimeAlerts({
    keywords,
    enableBrowserNotifications: true,
  });

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 w-96 max-h-[600px] overflow-y-auto z-50">
      <div className="bg-white border-2 border-yellow-400 rounded-lg shadow-xl p-4 space-y-3">
        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Bell className="w-5 h-5 text-green-600" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-400" />
            )}
            <h3 className="font-bold text-lg">
              🔔 {alerts.length} nouvelle(s) alerte(s)
            </h3>
          </div>
        </div>

        {/* Liste des alertes */}
        <div className="space-y-2">
          {alerts.slice(0, maxAlerts).map((signal) => (
            <SignalCard key={signal.id} signal={signal} compact />
          ))}
        </div>

        {/* Badge de connexion */}
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
          {isConnected ? 'Connecté en temps réel' : 'Déconnecté'}
        </div>
      </div>
    </div>
  );
};
```

### 4. Utilisation dans une Page

```typescript
// app/signals/page.tsx

'use client';

import { RealtimeAlerts } from '@/components/RealtimeAlerts';
import { SignalsList } from '@/components/SignalsList';

export default function SignalsPage() {
  const criticalKeywords = ['Trump', 'CPI', 'Fed', 'GDP', 'NFP', 'Musk', 'BTC', 'TSLA'];

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Signaux RSS Financial Juice</h1>

      {/* Alertes en temps réel (flottant) */}
      <RealtimeAlerts keywords={criticalKeywords} />

      {/* Liste principale */}
      <SignalsList />
    </div>
  );
}
```

---

## 🔄 Option 2 : Polling API (Alternative Simple)

Si Supabase Realtime n'est pas disponible, vous pouvez poller l'API :

```typescript
// hooks/usePollingAlerts.ts

'use client';

import { useEffect, useState, useRef } from 'react';
import { Signal } from '@/types/signals';

export const usePollingAlerts = (
  keywords: string[] = [],
  intervalMs: number = 30000 // 30 secondes
) => {
  const [alerts, setAlerts] = useState<Signal[]>([]);
  const lastSignalIdRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchNewSignals = async () => {
      try {
        const params = new URLSearchParams({
          source: 'rss',
          type: 'macro',
          limit: '20',
          min_importance: '7',
        });

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/signals?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        const signals: Signal[] = await response.json();

        // Filtrer par keywords
        const filtered = signals.filter((signal) => {
          if (keywords.length === 0) return true;
          
          const text = `${signal.raw_data.title} ${signal.raw_data.description || ''}`.toLowerCase();
          return keywords.some(k => text.includes(k.toLowerCase()));
        });

        // Garder seulement les nouveaux
        if (lastSignalIdRef.current) {
          const newSignals = filtered.filter(
            (s) => s.id !== lastSignalIdRef.current && 
            new Date(s.created_at) > new Date(Date.now() - intervalMs)
          );
          
          if (newSignals.length > 0) {
            setAlerts((prev) => [...newSignals, ...prev].slice(0, 20));
            lastSignalIdRef.current = newSignals[0].id;
          }
        } else {
          lastSignalIdRef.current = filtered[0]?.id || null;
        }
      } catch (error) {
        console.error('Error fetching alerts:', error);
      }
    };

    // Poll immédiatement puis à intervalles
    fetchNewSignals();
    const interval = setInterval(fetchNewSignals, intervalMs);

    return () => clearInterval(interval);
  }, [keywords, intervalMs]);

  return alerts;
};
```

---

## 🎯 Comparaison des Options

| Critère | Supabase Realtime | Polling API |
|---------|-------------------|-------------|
| **Latence** | < 1 seconde | 30s+ (selon intervalle) |
| **Ressources** | Faible (WebSocket) | Moyenne (requêtes HTTP) |
| **Complexité** | Moyenne | Simple |
| **Coût** | Gratuit (Supabase) | Gratuit (API existante) |
| **Recommandé** | ✅ Oui | Si Realtime indisponible |

---

## 📋 Checklist Frontend

### Avec Supabase Realtime
- [ ] Installer `@supabase/supabase-js`
- [ ] Configurer Supabase client avec Realtime
- [ ] Créer le hook `useRealtimeAlerts`
- [ ] Implémenter les notifications browser (optionnel)
- [ ] Créer le composant `RealtimeAlerts`
- [ ] Tester avec des signaux réels

### Avec Polling
- [ ] Créer le hook `usePollingAlerts`
- [ ] Configurer l'intervalle de polling
- [ ] Implémenter le filtrage par keywords
- [ ] Tester avec des signaux réels

---

## 💡 Recommandation

**Utilisez Supabase Realtime** :
- ✅ Plus performant
- ✅ Alertes instantanées
- ✅ Moins de charge sur l'API
- ✅ Expérience utilisateur meilleure

**Discord/Slack sont optionnels** - ils servent uniquement à notifier l'équipe backend, pas les utilisateurs finaux.

---

## 🔧 Configuration Supabase Realtime

Pour que Realtime fonctionne, vérifiez dans Supabase Dashboard :

1. **Settings** → **API** → Vérifier que Realtime est activé
2. **Database** → **Replication** → Activer pour la table `signals`
3. **RLS Policies** : S'assurer que les policies permettent la lecture

```sql
-- Vérifier que Realtime est activé pour signals
SELECT * FROM pg_publication_tables WHERE tablename = 'signals';
```

Si vide, activer :
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE signals;
```


