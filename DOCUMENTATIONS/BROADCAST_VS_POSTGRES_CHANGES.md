# 📡 Broadcast vs Postgres Changes : Guide Complet

## 🎯 Recommandation Supabase

**Supabase déconseille `postgres_changes` pour les nouvelles applications.**

**Utilisez `broadcast` + triggers côté base de données** — c'est la méthode recommandée pour :
- ✅ Fiabilité
- ✅ Scalabilité
- ✅ Contrôle (RLS, private channels, payloads personnalisés)

---

## 🔄 Différence entre les Deux Méthodes

### ❌ Postgres Changes (Déconseillé)

```typescript
// ❌ Ancienne méthode (déconseillée)
const channel = supabase
  .channel('rss-signals')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'signals',
    filter: 'source=eq.rss',
  }, (payload) => {
    const signal = payload.new as Signal;
  })
  .subscribe();
```

**Problèmes** :
- ⚠️ Limité et ne scale pas bien
- ⚠️ Moins de contrôle sur les payloads
- ⚠️ Pas de support pour les channels privés avec RLS personnalisé

### ✅ Broadcast + Triggers (Recommandé)

```typescript
// ✅ Nouvelle méthode (recommandée)
const channel = supabase
  .channel('signals:events', {
    config: {
      private: true, // Channel privé avec RLS
    },
  })
  .on('broadcast', { event: '*' }, (payload) => {
    const signal = payload.payload.data as Signal;
    const eventType = payload.payload.event; // 'INSERT' | 'UPDATE' | 'DELETE'
  })
  .subscribe();
```

**Avantages** :
- ✅ Plus fiable et scalable
- ✅ Meilleur contrôle avec RLS et channels privés
- ✅ Payloads personnalisés
- ✅ Recommandé par Supabase

---

## 🔧 Configuration Backend

### Trigger de Base de Données

```sql
-- Fonction trigger qui diffuse via broadcast
CREATE OR REPLACE FUNCTION signals_broadcast_trigger()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  event_type TEXT;
BEGIN
  event_type := TG_OP; -- 'INSERT' | 'UPDATE' | 'DELETE'
  
  IF TG_OP = 'DELETE' THEN
    payload := row_to_json(OLD)::jsonb;
  ELSE
    payload := row_to_json(NEW)::jsonb;
  END IF;
  
  -- Insérer dans realtime.messages pour diffuser
  INSERT INTO realtime.messages (topic, payload)
  VALUES (
    'signals:events',
    json_build_object(
      'event', event_type,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'data', payload
    )::jsonb
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur la table signals
CREATE TRIGGER signals_broadcast_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.signals
FOR EACH ROW 
EXECUTE FUNCTION signals_broadcast_trigger();
```

---

## 📱 Configuration Frontend

### Hook Realtime avec Broadcast

```typescript
// hooks/useRealtimeSignals.ts
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Signal } from '@/types/signals';

export const useRealtimeSignals = (keywords: string[] = []) => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // ✅ Channel privé avec broadcast
    const channel = supabase
      .channel('signals:events', {
        config: {
          private: true, // RLS activé
        },
      })
      .on('broadcast', { event: '*' }, (payload) => {
        const eventType = payload.payload.event;
        const signal = payload.payload.data as Signal;
        
        // Filtrer seulement les INSERT
        if (eventType !== 'INSERT') return;
        
        // Filtrer par keywords si spécifiés
        if (keywords.length > 0) {
          const text = `${signal.raw_data.title} ${signal.raw_data.description || ''}`.toLowerCase();
          const hasKeyword = keywords.some(k => text.includes(k.toLowerCase()));
          if (!hasKeyword) return;
        }
        
        setSignals((prev) => [signal, ...prev].slice(0, 20));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [keywords]);

  return { signals, isConnected };
};
```

---

## 🔒 Sécurité RLS

### Policies sur realtime.messages

```sql
-- Activer RLS
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Permettre la lecture pour anon (frontend)
CREATE POLICY "realtime_messages_select_for_anon" ON realtime.messages
FOR SELECT 
TO anon
USING (topic = 'signals:events');

-- Permettre l'insertion pour service_role (trigger)
CREATE POLICY "realtime_messages_insert_for_service_role" ON realtime.messages
FOR INSERT 
TO service_role
WITH CHECK (topic = 'signals:events');
```

---

## 📊 Comparaison

| Critère | Postgres Changes | Broadcast + Triggers |
|---------|------------------|---------------------|
| **Scalabilité** | ⚠️ Limitée | ✅ Excellente |
| **Contrôle RLS** | ⚠️ Basique | ✅ Avancé |
| **Payloads** | ⚠️ Fixe | ✅ Personnalisés |
| **Channels Privés** | ❌ Non | ✅ Oui |
| **Recommandation** | ❌ Déconseillé | ✅ Recommandé |

---

## ✅ Quand Utiliser Quoi

### Utiliser Broadcast + Triggers quand :
- ✅ Vous avez besoin d'événements originaires de la base de données pour plusieurs clients
- ✅ Vous voulez des channels privés avec RLS et payloads contrôlés
- ✅ Vous avez besoin de scalabilité et performance
- ✅ **C'est une nouvelle application** (recommandé)

### Utiliser Postgres Changes seulement pour :
- ⚠️ Code legacy existant
- ⚠️ Petits prototypes non-production
- ❌ **Éviter pour les nouveaux projets**

---

## 🧪 Test

```sql
-- Insérer un signal de test
INSERT INTO signals (source, type, raw_data)
VALUES (
  'rss',
  'macro',
  '{"title": "Test Broadcast", "feed": "financial-juice", "url": "https://example.com"}'
);
```

**Le frontend devrait recevoir la notification via `broadcast` !** ✅

---

## 📝 Résumé

**Méthode recommandée** : `broadcast` + triggers  
**Méthode déconseillée** : `postgres_changes`

**Le frontend doit utiliser `broadcast` avec un channel privé !** ✅


