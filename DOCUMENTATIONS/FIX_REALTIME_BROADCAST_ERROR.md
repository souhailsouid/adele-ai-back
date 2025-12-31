# 🔧 Correction : Erreur realtime.broadcast_changes

## 🐛 Problème

```
ERROR: 42883: function realtime.broadcast_changes(unknown, text, text, name, name, json, unknown) does not exist
```

**Cause** : La fonction `realtime.broadcast_changes` n'existe pas dans Supabase.

---

## ✅ Solution

### Utiliser la Méthode Standard (Recommandée)

La méthode standard avec `ALTER PUBLICATION` est la seule qui fonctionne vraiment avec Supabase Realtime.

**Migration 019 corrigée** : Utilise maintenant uniquement `ALTER PUBLICATION` (comme la migration 018).

---

## 🚀 Étapes de Correction

### 1. Exécuter la Migration 019 Corrigée

La migration 019 a été corrigée pour utiliser uniquement `ALTER PUBLICATION` :

```sql
-- infra/supabase/migrations/019_realtime_broadcast_alternative.sql
-- Maintenant utilise uniquement ALTER PUBLICATION (méthode standard)
```

**Exécuter dans Supabase Dashboard → SQL Editor**

### 2. Activer Realtime dans le Dashboard

**IMPORTANT** : Même après la migration SQL, vous devez activer Realtime dans le Dashboard :

1. **Supabase Dashboard** → **Database** → **Replication**
2. Trouver la table **"signals"**
3. Cocher **"Enable Realtime"**
4. Sauvegarder

### 3. Vérifier que ça Fonctionne

```sql
-- Vérifier que la table est dans la publication
SELECT 
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'signals';
-- Doit retourner : signals
```

---

## 📱 Frontend : Utilisation

Une fois Realtime activé, utilisez `postgres_changes` (pas `broadcast`) :

```typescript
// hooks/useRealtimeSignals.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Signal } from '@/types/signals';

export const useRealtimeSignals = (keywords: string[] = []) => {
  const [signals, setSignals] = useState<Signal[]>([]);

  useEffect(() => {
    // ✅ Utiliser postgres_changes (méthode standard)
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
        (payload) => {
          const newSignal = payload.new as Signal;
          
          // Filtrer par keywords si spécifiés
          if (keywords.length > 0) {
            const text = `${newSignal.raw_data.title} ${newSignal.raw_data.description || ''}`.toLowerCase();
            const hasKeyword = keywords.some(keyword => 
              text.includes(keyword.toLowerCase())
            );
            if (!hasKeyword) return;
          }
          
          setSignals((prev) => [newSignal, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [keywords]);

  return signals;
};
```

---

## 🔄 Différence avec l'Ancienne Méthode

### ❌ Ancienne Méthode (Ne Fonctionne Pas)

```sql
-- ❌ Cette fonction n'existe pas
PERFORM realtime.broadcast_changes(...);
```

### ✅ Nouvelle Méthode (Fonctionne)

```sql
-- ✅ Méthode standard Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE signals;
```

---

## 🐛 Dépannage

### Erreur : "table signals is already in publication"

**C'est normal !** Cela signifie que Realtime est déjà activé. ✅

### Erreur : "publication supabase_realtime does not exist"

**Solution** : La publication sera créée automatiquement par Supabase. Vérifiez dans le Dashboard.

### Frontend ne reçoit pas les notifications

**Vérifications** :
1. ✅ Migration 019 exécutée
2. ✅ "Enable Realtime" coché dans Dashboard
3. ✅ Frontend utilise `postgres_changes` (pas `broadcast`)
4. ✅ Clé ANON utilisée (pas SERVICE)

---

## ✅ Checklist

- [ ] Migration 019 corrigée exécutée
- [ ] "Enable Realtime" coché dans Dashboard
- [ ] Vérification SQL : `pg_publication_tables` retourne `signals`
- [ ] Frontend utilise `postgres_changes`
- [ ] Test : Insérer un signal et vérifier la notification

---

## 📝 Résumé

| Méthode | Fonctionne ? | Recommandation |
|---------|--------------|----------------|
| `ALTER PUBLICATION` | ✅ Oui | ⭐ Utiliser |
| `realtime.broadcast_changes` | ❌ Non | Ne pas utiliser |
| `pg_notify` | ⚠️ Partiel | Pas vraiment Realtime |

**La méthode standard `ALTER PUBLICATION` est la seule qui fonctionne vraiment !** ✅


