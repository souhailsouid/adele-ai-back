# 🔔 Guide Complet : Configuration Realtime

## 🎯 Deux Méthodes Disponibles

### Méthode 1 : Standard (Recommandée)
- **Fichier** : `018_add_data_extraction_and_alerts.sql`
- **Utilise** : `ALTER PUBLICATION supabase_realtime`
- **Frontend** : `postgres_changes`
- **Requis** : Activation dans Dashboard Supabase

### Méthode 2 : Alternative (Si Méthode 1 ne fonctionne pas)
- **Fichier** : `019_realtime_broadcast_alternative.sql`
- **Utilise** : `realtime.broadcast_changes` avec trigger
- **Frontend** : `broadcast`
- **Requis** : Rien, tout est en SQL

---

## 📋 Étape 1 : Essayer la Méthode Standard

### 1.1 Appliquer la Migration 018

```sql
-- Dans Supabase Dashboard → SQL Editor
-- Exécuter : infra/supabase/migrations/018_add_data_extraction_and_alerts.sql
```

### 1.2 Activer dans Dashboard

1. **Supabase Dashboard** → **Database** → **Replication**
2. Trouver la table `signals`
3. Cocher **"Enable Realtime"** ✅
4. Sauvegarder

### 1.3 Vérifier

```sql
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' AND tablename = 'signals';
-- Doit retourner une ligne
```

**Si ça fonctionne** : ✅ C'est bon, passez à l'étape 2.

**Si ça ne fonctionne pas** : ⬇️ Utilisez la Méthode 2.

---

## 📋 Étape 2 : Utiliser la Méthode Alternative (Si Nécessaire)

### 2.1 Appliquer la Migration 019

```sql
-- Dans Supabase Dashboard → SQL Editor
-- Exécuter : infra/supabase/migrations/019_realtime_broadcast_alternative.sql
```

### 2.2 Vérifier

```sql
-- Vérifier la fonction
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'signals_broadcast_trigger';
-- Doit retourner : signals_broadcast_trigger

-- Vérifier le trigger
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name = 'signals_broadcast_trigger';
-- Doit retourner : signals_broadcast_trigger
```

---

## 📱 Frontend : Configuration selon la Méthode

### Si Méthode 1 (Standard) - Utilisé

```typescript
// hooks/useRealtimeSignals.ts
const channel = supabase
  .channel('rss-signals')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'signals',
    filter: 'source=eq.rss',
  }, (payload) => {
    const signal = payload.new as Signal;
    // Traiter le signal
  })
  .subscribe();
```

### Si Méthode 2 (Alternative) - Utilisé

```typescript
// hooks/useRealtimeSignals.ts
const channel = supabase
  .channel('signals-realtime', {
    config: { broadcast: { self: true } },
  })
  .on('broadcast', { event: 'INSERT' }, (payload) => {
    const signal = payload.payload as Signal;
    // Traiter le signal
  })
  .subscribe();
```

---

## ✅ Checklist

### Méthode 1 (Standard)
- [ ] Migration 018 appliquée
- [ ] "Enable Realtime" coché dans Dashboard
- [ ] `pg_publication_tables` retourne `signals`
- [ ] Frontend utilise `postgres_changes`

### Méthode 2 (Alternative)
- [ ] Migration 019 appliquée
- [ ] Fonction `signals_broadcast_trigger` existe
- [ ] Trigger `signals_broadcast_trigger` existe
- [ ] Frontend utilise `broadcast`

---

## 🧪 Test

```sql
-- Insérer un signal de test
INSERT INTO signals (source, type, raw_data)
VALUES (
  'rss',
  'macro',
  '{"title": "Test Realtime", "feed": "financial-juice"}'
);
```

**Le frontend devrait recevoir la notification instantanément !**

---

## 🐛 Dépannage

### Méthode 1 ne fonctionne pas

**Symptômes** :
- `pg_publication_tables` retourne vide
- Pas de "Enable Realtime" dans Dashboard
- Frontend ne reçoit pas les notifications

**Solution** : Utiliser Méthode 2 (migration 019)

### Méthode 2 ne fonctionne pas

**Vérifier** :
1. ✅ La fonction `signals_broadcast_trigger` existe
2. ✅ Le trigger existe sur `signals`
3. ✅ Les policies RLS sur `realtime.messages` sont correctes
4. ✅ Le frontend s'abonne au bon topic

**Test** :
```sql
-- Vérifier les messages
SELECT * FROM realtime.messages 
WHERE topic = 'signals:events' 
ORDER BY inserted_at DESC 
LIMIT 5;
```

---

## 📝 Résumé

| Méthode | Quand Utiliser | Frontend |
|---------|----------------|----------|
| **1. Standard** | Si Dashboard disponible | `postgres_changes` |
| **2. Alternative** | Si Standard ne fonctionne pas | `broadcast` |

**Les deux méthodes fonctionnent ! Choisissez celle qui fonctionne pour vous.**


