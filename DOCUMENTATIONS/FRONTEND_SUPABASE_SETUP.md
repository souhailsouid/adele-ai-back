# 🔧 Configuration Supabase Frontend

## ⚠️ Erreur Commune : Clé Service au lieu de Clé Anon

### Problème

Si vous voyez cette erreur :
```
WebSocket connection to ...?apikey=sb_secret_025ZPExdwYIENsABogIRsw_jDhFPTo6
❌ Erreur de connexion au canal
```

**Vous utilisez la clé SERVICE au lieu de la clé ANON !**

---

## ✅ Configuration Correcte

### 1. Obtenir les Clés dans Supabase

1. **Supabase Dashboard** → **Settings** → **API**
2. **Project API keys**
3. Copier :
   - **URL** : `https://nmynjtrppwhiwlxfdzdh.supabase.co`
   - **anon public** : `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` ✅ (Frontend)
   - **service_role** : `sb_secret_...` ❌ (Backend uniquement)

---

### 2. Variables d'Environnement Frontend

**Fichier** : `.env.local` (Next.js) ou `.env` (React)

```bash
# ✅ CORRECT
NEXT_PUBLIC_SUPABASE_URL=https://nmynjtrppwhiwlxfdzdh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # Clé ANON (commence par eyJ)

# ❌ JAMAIS dans le frontend
# SUPABASE_SERVICE_KEY=sb_secret_... # Clé SERVICE (backend uniquement)
```

**Important** :
- ✅ Clé ANON commence par `eyJ...`
- ❌ Clé SERVICE commence par `sb_secret_...`

---

### 3. Code Frontend

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Vérification de sécurité
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// ⚠️ Protection : Vérifier que ce n'est PAS la clé service
if (supabaseAnonKey.startsWith('sb_secret_')) {
  throw new Error(
    '❌ ERREUR CRITIQUE: Vous utilisez la clé SERVICE au lieu de la clé ANON !\n' +
    'La clé SERVICE ne doit JAMAIS être utilisée côté frontend.\n' +
    'Utilisez la clé "anon public" depuis Supabase Dashboard → Settings → API'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
```

---

## 🔍 Vérification

### Test Rapide

```typescript
// Test de connexion
const testConnection = async () => {
  const channel = supabase
    .channel('test-connection')
    .subscribe((status) => {
      console.log('Realtime status:', status);
      
      if (status === 'SUBSCRIBED') {
        console.log('✅ Connecté avec succès !');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Erreur de connexion');
        console.error('Vérifiez que vous utilisez la clé ANON (eyJ...), pas la clé SERVICE (sb_secret_...)');
      }
    });
  
  // Nettoyer après 5 secondes
  setTimeout(() => {
    supabase.removeChannel(channel);
  }, 5000);
};

testConnection();
```

---

## 🐛 Dépannage

### Erreur : "Invalid API key"

**Cause** : Clé incorrecte ou expirée

**Solution** :
1. Aller dans Supabase Dashboard → Settings → API
2. Regénérer la clé anon si nécessaire
3. Vérifier qu'elle commence par `eyJ` (pas `sb_secret_`)

### Erreur : "Channel error"

**Causes possibles** :
1. Migration 019 pas appliquée
2. Policies RLS manquantes
3. Clé anon n'a pas les permissions

**Solutions** :
1. Réexécuter la migration 019 dans Supabase
2. Vérifier les policies : `SELECT * FROM pg_policies WHERE tablename = 'messages' AND schemaname = 'realtime'`

---

## ✅ Checklist

- [ ] Clé ANON utilisée (commence par `eyJ`)
- [ ] Clé SERVICE absente du frontend (commence par `sb_secret_`)
- [ ] Variables d'environnement : `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Migration 019 appliquée
- [ ] Test de connexion réussit

---

## 📝 Résumé

| Clé | Usage | Format | Frontend |
|-----|-------|--------|----------|
| **anon** | Frontend | `eyJ...` | ✅ Oui |
| **service_role** | Backend | `sb_secret_...` | ❌ Non |

**La clé service ne doit JAMAIS être dans le code frontend !**


