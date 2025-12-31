# 🔄 Configuration Realtime Alternative

## 🎯 Quand Utiliser Cette Méthode

Utilisez cette méthode **SI** :
- ❌ `ALTER PUBLICATION supabase_realtime ADD TABLE signals` ne fonctionne pas
- ❌ Vous ne trouvez pas "Enable Realtime" dans le Dashboard
- ❌ La méthode standard ne fonctionne pas pour votre projet Supabase

---

## 📋 Étapes

### 1. Appliquer la Migration Alternative

```sql
-- Dans Supabase Dashboard → SQL Editor
-- Exécuter :
-- infra/supabase/migrations/019_realtime_broadcast_alternative.sql
```

**Ce que ça fait** :
- ✅ Crée une fonction trigger `signals_broadcast_trigger()`
- ✅ Crée un trigger sur `signals` qui diffuse les changements
- ✅ Configure les policies RLS sur `realtime.messages`
- ✅ Permet au frontend de recevoir les notifications

---

### 2. Vérifier que ça Fonctionne

```sql
-- Vérifier la fonction
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'signals_broadcast_trigger';
-- Doit retourner : signals_broadcast_trigger

-- Vérifier le trigger
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'signals' 
AND trigger_name = 'signals_broadcast_trigger';
-- Doit retourner : signals_broadcast_trigger
```

---

### 3. Tester avec un Signal

```sql
-- Insérer un signal de test
INSERT INTO signals (source, type, raw_data)
VALUES (
  'rss',
  'macro',
  '{"title": "Test Realtime", "feed": "financial-juice"}'
);

-- Le trigger devrait diffuser automatiquement via realtime.messages
```

---

## 📱 Frontend : Utilisation

### Configuration Client

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

### S'abonner aux Changements

```typescript
// hooks/useRealtimeSignals.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Signal } from '@/types/signals';

export const useRealtimeSignals = () => {
  const [signals, setSignals] = useState<Signal[]>([]);

  useEffect(() => {
    // S'abonner au topic 'signals:events'
    const channel = supabase
      .channel('signals-realtime', {
        config: {
          // Utiliser broadcast au lieu de postgres_changes
          broadcast: { self: true },
        },
      })
      .on('broadcast', { event: 'INSERT' }, (payload) => {
        // Nouveau signal reçu
        const newSignal = payload.payload as Signal;
        setSignals((prev) => [newSignal, ...prev].slice(0, 20));
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return signals;
};
```

**Note** : Avec `broadcast`, le payload contient directement les données du signal.

---

## 🔄 Différence avec la Méthode Standard

### Méthode Standard (018)
- Utilise `ALTER PUBLICATION supabase_realtime ADD TABLE`
- Frontend utilise `postgres_changes`
- Plus simple, mais nécessite activation Dashboard

### Méthode Alternative (019)
- Utilise `realtime.broadcast_changes` avec trigger
- Frontend utilise `broadcast`
- Plus de contrôle, fonctionne sans Dashboard

---

## ✅ Avantages de la Méthode Alternative

1. ✅ **Pas besoin de Dashboard** : Tout est dans SQL
2. ✅ **Plus de contrôle** : Vous choisissez le topic et le format
3. ✅ **Fonctionne toujours** : Même si la publication ne fonctionne pas
4. ✅ **Flexible** : Vous pouvez filtrer/customiser les broadcasts

---

## 🐛 Dépannage

### Le trigger ne diffuse pas

**Vérifier** :
```sql
-- Vérifier que le trigger existe
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'signals_broadcast_trigger';

-- Tester manuellement
SELECT signals_broadcast_trigger();
-- Ne devrait pas retourner d'erreur
```

### Le frontend ne reçoit pas les messages

**Vérifier** :
1. ✅ Le trigger existe et fonctionne
2. ✅ Les policies RLS sur `realtime.messages` sont correctes
3. ✅ Le frontend s'abonne au bon topic (`signals:events`)
4. ✅ La clé API `anon` a les permissions

**Test** :
```sql
-- Vérifier les messages dans realtime.messages
SELECT * FROM realtime.messages 
WHERE topic = 'signals:events' 
ORDER BY inserted_at DESC 
LIMIT 5;
```

---

## 📝 Résumé

| Méthode | Fichier | Frontend |
|---------|---------|----------|
| **Standard** | `018_add_data_extraction_and_alerts.sql` | `postgres_changes` |
| **Alternative** | `019_realtime_broadcast_alternative.sql` | `broadcast` |

**Utilisez la méthode alternative si la standard ne fonctionne pas !**


