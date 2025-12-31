# 📱 Guide Frontend : Realtime avec Broadcast

## 🎯 Configuration

Si vous avez utilisé la **migration alternative (019)** avec `realtime.broadcast_changes`, le frontend doit utiliser `broadcast` au lieu de `postgres_changes`.

---

## 📋 Setup Complet

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

---

### 2. Hook pour Alertes en Temps Réel

```typescript
// hooks/useRealtimeSignals.ts

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Signal } from '@/types/signals';

interface UseRealtimeSignalsOptions {
  keywords?: string[];
  onNewAlert?: (signal: Signal) => void;
  enableBrowserNotifications?: boolean;
}

export const useRealtimeSignals = (options: UseRealtimeSignalsOptions = {}) => {
  const {
    keywords = [],
    onNewAlert,
    enableBrowserNotifications = false,
  } = options;

  const [signals, setSignals] = useState<Signal[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Demander permission pour notifications browser
    if (enableBrowserNotifications && 'Notification' in window) {
      Notification.requestPermission();
    }

    // S'abonner aux changements via broadcast
    const channel = supabase
      .channel('signals-realtime', {
        config: {
          broadcast: { self: true }, // Reçoit aussi ses propres messages
        },
      })
      .on('broadcast', { event: 'INSERT' }, (payload) => {
        const newSignal = payload.payload as Signal;
        
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
        setSignals((prev) => [newSignal, ...prev].slice(0, 20));
        
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
      })
      .on('broadcast', { event: 'UPDATE' }, (payload) => {
        // Signal mis à jour
        const updatedSignal = payload.payload as Signal;
        setSignals((prev) =>
          prev.map((s) => (s.id === updatedSignal.id ? updatedSignal : s))
        );
      })
      .on('broadcast', { event: 'DELETE' }, (payload) => {
        // Signal supprimé
        const deletedId = payload.payload.id;
        setSignals((prev) => prev.filter((s) => s.id !== deletedId));
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        console.log('Realtime status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [keywords, onNewAlert, enableBrowserNotifications]);

  return { signals, isConnected };
};
```

---

### 3. Composant d'Alertes

```typescript
// components/RealtimeAlerts.tsx

'use client';

import { useRealtimeSignals } from '@/hooks/useRealtimeSignals';
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
  const { signals, isConnected } = useRealtimeSignals({
    keywords,
    enableBrowserNotifications: true,
  });

  if (signals.length === 0) return null;

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
              🔔 {signals.length} nouvelle(s) alerte(s)
            </h3>
          </div>
        </div>

        {/* Liste des alertes */}
        <div className="space-y-2">
          {signals.slice(0, maxAlerts).map((signal) => (
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

---

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

## 🔍 Différence avec postgres_changes

### Avec `postgres_changes` (Méthode Standard)

```typescript
// ❌ NE PAS UTILISER si vous avez utilisé la migration 019
const channel = supabase
  .channel('rss-signals')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'signals',
  }, (payload) => {
    const signal = payload.new as Signal; // ⚠️ payload.new
  })
  .subscribe();
```

### Avec `broadcast` (Méthode Alternative - VOTRE CAS)

```typescript
// ✅ UTILISER si vous avez utilisé la migration 019
const channel = supabase
  .channel('signals-realtime', {
    config: { broadcast: { self: true } },
  })
  .on('broadcast', { event: 'INSERT' }, (payload) => {
    const signal = payload.payload as Signal; // ⚠️ payload.payload
  })
  .subscribe();
```

**Différences clés** :
- `postgres_changes` → `payload.new`
- `broadcast` → `payload.payload`
- `broadcast` nécessite `config: { broadcast: { self: true } }`

---

## 🧪 Test

### 1. Tester depuis SQL

```sql
-- Insérer un signal de test
INSERT INTO signals (source, type, raw_data)
VALUES (
  'rss',
  'macro',
  '{"title": "FinancialJuice: Test Realtime Broadcast", "feed": "financial-juice"}'
);
```

### 2. Vérifier dans le Frontend

Ouvrez la console du navigateur. Vous devriez voir :
```
Realtime status: SUBSCRIBED
Nouveau signal: { id: '...', raw_data: { title: '...' }, ... }
```

---

## 🐛 Dépannage

### Le frontend ne reçoit pas les messages

**Vérifier** :
1. ✅ La migration 019 a été appliquée
2. ✅ La fonction `signals_broadcast_trigger` existe
3. ✅ Le trigger existe sur `signals`
4. ✅ Le frontend utilise `broadcast` (pas `postgres_changes`)
5. ✅ Le topic est `signals:events` (vérifier dans le trigger)

**Test SQL** :
```sql
-- Vérifier les messages dans realtime.messages
SELECT * FROM realtime.messages 
WHERE topic = 'signals:events' 
ORDER BY inserted_at DESC 
LIMIT 5;
```

### Erreur : "Channel not found"

**Cause** : Le channel n'est pas correctement configuré

**Solution** :
```typescript
// Vérifier que le channel est bien créé
const channel = supabase.channel('signals-realtime', {
  config: { broadcast: { self: true } },
});

// Attendre que le subscribe soit complété
channel.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    console.log('Channel subscribed!');
  }
});
```

---

## ✅ Checklist Frontend

- [ ] Migration 019 appliquée (backend)
- [ ] Supabase client configuré avec Realtime
- [ ] Hook `useRealtimeSignals` créé avec `broadcast`
- [ ] Composant `RealtimeAlerts` créé
- [ ] Test : Insérer un signal SQL → Vérifier réception frontend
- [ ] Notifications browser activées (optionnel)

---

## 📝 Résumé

**Si vous avez utilisé la migration 019** :
- ✅ Utilisez `broadcast` (pas `postgres_changes`)
- ✅ Utilisez `payload.payload` (pas `payload.new`)
- ✅ Ajoutez `config: { broadcast: { self: true } }`

**Le code que vous avez partagé est correct !** 🎉


