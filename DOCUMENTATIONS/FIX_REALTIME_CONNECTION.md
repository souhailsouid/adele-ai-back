# 🔧 Correction : Erreur de Connexion Realtime

## 🐛 Problème

```
WebSocket connection to wss://nmynjtrppwhiwlxfdzdh.supabase.co/realtime/v1/websocket?apikey=sb_secret_025ZPExdwYIENsABogIRsw_jDhFPTo6
❌ [useRealtimeSignals] Erreur de connexion au canal
```

**Problème identifié** : Vous utilisez la **clé `service_key`** (sb_secret_...) au lieu de la **clé `anon`** (eyJ...).

---

## ⚠️ Erreur Critique

**La clé `service_key` ne doit JAMAIS être utilisée côté frontend !**

- ❌ `sb_secret_...` → Clé service (backend uniquement)
- ✅ `eyJ...` → Clé anon (frontend)

---

## 🔧 Solution

### 1. Vérifier la Configuration Supabase Client

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // ⚠️ Doit être la clé ANON, pas service_key
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
```

### 2. Vérifier les Variables d'Environnement

Dans `.env.local` (frontend) :

```bash
# ✅ CORRECT
NEXT_PUBLIC_SUPABASE_URL=https://nmynjtrppwhiwlxfdzdh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # Clé ANON (commence par eyJ)

# ❌ INCORRECT (ne jamais mettre ça dans le frontend)
# SUPABASE_SERVICE_KEY=sb_secret_025ZPExdwYIENsABogIRsw_jDhFPTo6
```

**Comment obtenir la clé ANON** :
1. Supabase Dashboard → Settings → API
2. Section "Project API keys"
3. Copier la clé **"anon" public** (pas "service_role")

---

## 🔍 Vérifications

### 1. Vérifier que la Migration 019 est Appliquée

```sql
-- Dans Supabase Dashboard → SQL Editor
-- Vérifier que la fonction existe
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'signals_broadcast_trigger';
-- Doit retourner : signals_broadcast_trigger

-- Vérifier que le trigger existe
SELECT trigger_name 
FROM information_schema.triggers 
WHERE event_object_table = 'signals' 
AND trigger_name = 'signals_broadcast_trigger';
-- Doit retourner : signals_broadcast_trigger
```

### 2. Vérifier les Policies RLS sur realtime.messages

```sql
-- Vérifier les policies
SELECT * FROM pg_policies 
WHERE tablename = 'messages' 
AND schemaname = 'realtime';
-- Doit retourner les policies pour anon et authenticated
```

Si les policies n'existent pas, réexécuter la migration 019.

---

## 🔧 Correction Complète

### Étape 1 : Corriger les Variables d'Environnement

**Frontend** (`.env.local`) :
```bash
NEXT_PUBLIC_SUPABASE_URL=https://nmynjtrppwhiwlxfdzdh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # Clé ANON
```

**Backend** (`.env` ou variables Lambda) :
```bash
SUPABASE_URL=https://nmynjtrppwhiwlxfdzdh.supabase.co
SUPABASE_SERVICE_KEY=sb_secret_025ZPExdwYIENsABogIRsw_jDhFPTo6 # Clé SERVICE (backend uniquement)
```

### Étape 2 : Vérifier le Code Frontend

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Vérification
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Vérifier que ce n'est PAS la clé service
if (supabaseAnonKey.startsWith('sb_secret_')) {
  throw new Error('❌ ERREUR: Vous utilisez la clé SERVICE au lieu de la clé ANON !');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
```

### Étape 3 : Réexécuter la Migration 019

Si les policies sur `realtime.messages` n'existent pas :

```sql
-- Dans Supabase Dashboard → SQL Editor
-- Réexécuter la section 3 et 4 de la migration 019
-- (Policies pour realtime.messages)
```

---

## 🧪 Test Après Correction

### 1. Vérifier la Connexion

```typescript
// Test de connexion
const channel = supabase
  .channel('test-connection')
  .subscribe((status) => {
    console.log('Status:', status);
    if (status === 'SUBSCRIBED') {
      console.log('✅ Connecté !');
    } else if (status === 'CHANNEL_ERROR') {
      console.error('❌ Erreur de connexion');
    }
  });
```

### 2. Tester le Broadcast

```sql
-- Insérer un signal de test
INSERT INTO signals (source, type, raw_data)
VALUES (
  'rss',
  'macro',
  '{"title": "Test Realtime", "feed": "financial-juice"}'
);
```

Le frontend devrait recevoir la notification.

---

## 🐛 Dépannage

### Erreur : "Invalid API key"

**Cause** : Clé incorrecte ou expirée

**Solution** :
1. Vérifier dans Supabase Dashboard → Settings → API
2. Copier la clé **anon public** (pas service_role)
3. Vérifier qu'elle commence par `eyJ` (pas `sb_secret_`)

### Erreur : "Channel error" ou "Connection closed"

**Causes possibles** :
1. Migration 019 pas appliquée
2. Policies RLS manquantes sur `realtime.messages`
3. Clé anon n'a pas les permissions

**Solutions** :
1. Réexécuter la migration 019
2. Vérifier les policies : `SELECT * FROM pg_policies WHERE tablename = 'messages' AND schemaname = 'realtime'`
3. Vérifier que la clé anon a les permissions dans Supabase Dashboard

---

## ✅ Checklist

- [ ] Clé ANON utilisée (pas service_key)
- [ ] Variables d'environnement correctes (NEXT_PUBLIC_SUPABASE_ANON_KEY)
- [ ] Migration 019 appliquée
- [ ] Fonction `signals_broadcast_trigger` existe
- [ ] Trigger `signals_broadcast_trigger` existe
- [ ] Policies RLS sur `realtime.messages` existent
- [ ] Test de connexion réussit

---

## 📝 Résumé

**Le problème** : Utilisation de la clé `service_key` au lieu de `anon_key`.

**La solution** :
1. Utiliser `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clé anon)
2. Vérifier qu'elle commence par `eyJ` (pas `sb_secret_`)
3. Réexécuter la migration 019 si nécessaire

**La clé service ne doit JAMAIS être dans le code frontend !**


