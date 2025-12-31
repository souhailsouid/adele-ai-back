# 📱 Guide Frontend : Configuration Realtime

## 🎯 Ce que le Frontend Doit Faire

Une fois que le backend a activé Realtime (migration 018 ou 019), le frontend doit :

1. ✅ Configurer le client Supabase avec la clé **ANON** (pas SERVICE)
2. ✅ Créer un hook pour écouter les nouveaux signaux
3. ✅ Utiliser le hook dans les composants

---

## 1. Configuration Supabase Client

### Variables d'Environnement

**Fichier** : `.env.local` (Next.js) ou `.env` (React)

```bash
# ✅ CORRECT - Clé ANON (commence par eyJ...)
NEXT_PUBLIC_SUPABASE_URL=https://nmynjtrppwhiwlxfdzdh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ❌ JAMAIS dans le frontend - Clé SERVICE (commence par sb_secret_...)
# SUPABASE_SERVICE_KEY=sb_secret_...
```

**Important** : Obtenir la clé ANON dans Supabase Dashboard → Settings → API → "anon public"

### Code Client

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ⚠️ Protection : Vérifier que ce n'est PAS la clé service
if (supabaseAnonKey?.startsWith('sb_secret_')) {
  throw new Error(
    '❌ ERREUR: Vous utilisez la clé SERVICE au lieu de la clé ANON !\n' +
    'Utilisez la clé "anon public" depuis Supabase Dashboard → Settings → API'
  );
}

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
```

---

## 2. Hook Realtime pour les Signaux

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

    // ✅ S'abonner aux changements via broadcast (méthode recommandée par Supabase)
    // Le trigger backend diffuse sur le topic 'signals:events'
    const channel = supabase
      .channel('signals:events', {
        config: {
          private: true, // Channel privé avec RLS
        },
      })
      .on('broadcast', { event: '*' }, (payload) => {
        // Le payload contient : { event: 'INSERT'|'UPDATE'|'DELETE', data: Signal }
        const eventType = payload.payload.event;
        const signal = payload.payload.data as Signal;
        
        // Filtrer seulement les INSERT pour les nouveaux signaux
        if (eventType !== 'INSERT') return;
        
        const newSignal = signal;
          
        // Filtrer par source RSS (déjà fait par le trigger, mais double vérification)
        if (newSignal.source !== 'rss') return;
        
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

        // Ajouter le signal
        setSignals((prev) => [newSignal, ...prev].slice(0, 20));
          
        // Callback personnalisé
        if (onNewAlert) {
          onNewAlert(newSignal);
        }

        // Notification browser
        if (enableBrowserNotifications && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(`Nouvelle alerte: ${newSignal.raw_data.title}`, {
            body: newSignal.raw_data.description?.substring(0, 100) || '',
            icon: '/icon.png',
          });
        }
      })
      .subscribe((status) => {
        console.log('Realtime status:', status);
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          console.log('✅ Connecté à Realtime');
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          console.error('❌ Erreur de connexion Realtime');
        }
      });

    // Nettoyer à la déconnexion
    return () => {
      supabase.removeChannel(channel);
    };
  }, [keywords, onNewAlert, enableBrowserNotifications]);

  return { signals, isConnected };
};
```

---

## 3. Utilisation dans un Composant

### Exemple 1 : Liste de Signaux avec Alertes Temps Réel

```typescript
// components/SignalsListWithRealtime.tsx

'use client';

import { useState } from 'react';
import { useRealtimeSignals } from '@/hooks/useRealtimeSignals';
import SignalCard from './SignalCard';
import { Signal } from '@/types/signals';

export default function SignalsListWithRealtime() {
  const [keywords] = useState(['Trump', 'Zelenskiy', 'CPI', 'Musk', 'BTC', 'TSLA', 'AI']);
  
  const { signals: realtimeSignals, isConnected } = useRealtimeSignals({
    keywords,
    onNewAlert: (signal: Signal) => {
      console.log('🚨 Nouvelle alerte reçue:', signal.raw_data.title);
      // Optionnel : Afficher une notification toast
    },
    enableBrowserNotifications: true,
  });

  return (
    <div className="space-y-4">
      {/* Indicateur de connexion */}
      <div className="flex items-center gap-2 text-sm">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
          {isConnected ? 'Connecté en temps réel' : 'Déconnecté'}
        </span>
      </div>

      {/* Alertes en temps réel */}
      {realtimeSignals.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Alertes en temps réel ({realtimeSignals.length})</h3>
          {realtimeSignals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Exemple 2 : Intégration dans SignalsList Existante

```typescript
// components/SignalsList.tsx

'use client';

import { useState, useEffect } from 'react';
import { useRealtimeSignals } from '@/hooks/useRealtimeSignals';
import SignalCard from './SignalCard';
import { Signal } from '@/types/signals';
import signalsService from '@/services/signalsService';

export default function SignalsList() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  // Realtime pour les nouvelles alertes
  const { signals: realtimeSignals } = useRealtimeSignals({
    keywords: ['Trump', 'Zelenskiy', 'CPI', 'Musk', 'BTC', 'TSLA', 'AI'],
    onNewAlert: (newSignal) => {
      // Ajouter le nouveau signal en haut de la liste
      setSignals((prev) => [newSignal, ...prev]);
    },
  });

  // Charger les signaux initiaux
  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const response = await signalsService.getSignals({
          source: 'rss',
          limit: 50,
        });
        setSignals(response.data || []);
      } catch (error) {
        console.error('Erreur:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSignals();
  }, []);

  if (loading) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      {signals.map((signal) => (
        <SignalCard key={signal.id} signal={signal} />
      ))}
    </div>
  );
}
```

---

## 4. Types TypeScript

```typescript
// types/signals.ts

export interface ExtractedData {
  actual?: number;
  forecast?: number;
  previous?: number;
  dataType?: 'inflation' | 'gdp' | 'employment' | 'retail_sales' | 'industrial_production' | 'other';
  indicator?: string;
  surprise?: 'positive' | 'negative' | 'neutral';
  surpriseMagnitude?: number;
  unit?: 'percent' | 'absolute' | 'index';
  period?: string;
  region?: string;
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
    author?: string;
    extracted_data?: ExtractedData;
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

## ✅ Checklist Frontend

- [ ] Variables d'environnement : `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clé ANON, pas SERVICE)
- [ ] Client Supabase configuré avec `realtime.params.eventsPerSecond`
- [ ] Hook `useRealtimeSignals` créé
- [ ] Utilisation de `broadcast` (pas `postgres_changes`) - **Méthode recommandée par Supabase**
- [ ] Channel configuré avec `private: true` pour RLS
- [ ] Test : Insérer un signal dans la DB et vérifier la notification

---

## 🧪 Test Rapide

### 1. Vérifier la Connexion

```typescript
// Test dans un composant
const { isConnected } = useRealtimeSignals();

console.log('Realtime connecté:', isConnected);
// Doit afficher : true
```

### 2. Tester avec un Signal

```sql
-- Dans Supabase Dashboard → SQL Editor
INSERT INTO signals (source, type, raw_data)
VALUES (
  'rss',
  'macro',
  '{"title": "Test Realtime Frontend", "feed": "financial-juice", "url": "https://example.com"}'
);
```

**Le frontend devrait recevoir la notification instantanément !** ✅

---

## 🐛 Dépannage

### Erreur : "Channel error" ou "Connection closed"

**Causes possibles** :
1. Clé SERVICE utilisée au lieu de clé ANON
2. Realtime pas activé dans Dashboard
3. Migration 018/019 pas appliquée

**Solutions** :
1. Vérifier la clé : doit commencer par `eyJ` (pas `sb_secret_`)
2. Activer Realtime dans Dashboard → Database → Replication
3. Vérifier la migration : `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'signals';`

### Pas de Notifications Reçues

**Vérifications** :
1. ✅ `isConnected` est `true` ?
2. ✅ Le signal inséré a `source = 'rss'` ?
3. ✅ Les keywords correspondent ?
4. ✅ Console du navigateur : pas d'erreurs ?

---

## 📝 Résumé

| Étape | Action |
|-------|--------|
| 1. Config | Variables d'environnement avec clé ANON |
| 2. Client | Créer `lib/supabase.ts` avec `createClient` |
| 3. Hook | Créer `hooks/useRealtimeSignals.ts` |
| 4. Utiliser | Utiliser le hook dans les composants |
| 5. Tester | Insérer un signal et vérifier la notification |

**Le frontend doit utiliser `broadcast` (méthode recommandée par Supabase) !** ✅

**Pourquoi `broadcast` et pas `postgres_changes` ?**
- ✅ Plus fiable et scalable
- ✅ Meilleur contrôle avec RLS et channels privés
- ✅ Payloads personnalisés
- ✅ Recommandé par Supabase pour les nouvelles applications

