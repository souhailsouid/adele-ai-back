# 🔒 Sécurité RLS (Row Level Security)

## 🎯 Configuration

Les policies RLS sont configurées dans la migration SQL pour garantir que :

1. **Frontend (clé API `anon`)** : Peut **LIRE** les signaux (SELECT)
2. **Frontend (clé API `anon`)** : **NE PEUT PAS** modifier les signaux (INSERT/UPDATE/DELETE)
3. **Backend (clé API `service_role`)** : Peut tout faire (lecture + écriture)

---

## 📋 Policies Configurées

### Table `signals`

```sql
-- Lecture : Permise à tous (y compris clé anon)
CREATE POLICY "Allow read signals" ON signals
  FOR SELECT
  USING (true);

-- Écriture : Seulement service_role (backend)
CREATE POLICY "Deny write signals from frontend" ON signals
  FOR ALL
  USING (auth.role() = 'service_role');
```

**Résultat** :
- ✅ Frontend peut lire : `SELECT * FROM signals`
- ❌ Frontend ne peut pas écrire : `INSERT INTO signals ...` → Erreur
- ✅ Backend peut tout faire

### Table `alert_keywords`

```sql
-- Lecture seule pour frontend
CREATE POLICY "Allow read alert_keywords" ON alert_keywords
  FOR SELECT
  USING (true);
```

**Résultat** :
- ✅ Frontend peut lire les keywords
- ❌ Frontend ne peut pas modifier les keywords

### Table `alerts_sent`

```sql
-- Lecture seule pour frontend
CREATE POLICY "Allow read alerts_sent" ON alerts_sent
  FOR SELECT
  USING (true);
```

**Résultat** :
- ✅ Frontend peut lire l'historique des alertes
- ❌ Frontend ne peut pas créer/modifier des alertes

---

## 🔑 Clés API

### Frontend : Clé `anon` (Publique)

**Utilisation** :
```typescript
// lib/supabase.ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // ⚠️ Clé publique
);
```

**Permissions** :
- ✅ SELECT sur `signals`
- ✅ SELECT sur `alert_keywords`
- ✅ SELECT sur `alerts_sent`
- ✅ Realtime (lecture)
- ❌ INSERT/UPDATE/DELETE

**Sécurité** : Cette clé est publique (dans le code frontend), mais RLS empêche les modifications.

### Backend : Clé `service_role` (Secrète)

**Utilisation** :
```typescript
// workers/collector-rss/src/supabase.ts
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // ⚠️ Clé secrète
);
```

**Permissions** :
- ✅ Tout (lecture + écriture)
- ✅ Bypass RLS

**Sécurité** : Cette clé doit rester secrète (variables d'environnement, jamais dans le code frontend).

---

## ✅ Vérification

### Tester depuis le Frontend

```typescript
// ✅ Devrait fonctionner
const { data } = await supabase
  .from('signals')
  .select('*')
  .limit(10);

// ❌ Devrait échouer
const { error } = await supabase
  .from('signals')
  .insert({ source: 'rss', type: 'macro' });
// Error: new row violates row-level security policy
```

### Tester depuis le Backend

```typescript
// ✅ Devrait fonctionner
const { data } = await supabase
  .from('signals')
  .insert({ source: 'rss', type: 'macro', ... });
// Succès (service_role bypass RLS)
```

---

## 🛡️ Protection Supplémentaire

### 1. Ne jamais exposer `service_role` dans le frontend

```typescript
// ❌ MAUVAIS
const supabase = createClient(url, SERVICE_ROLE_KEY); // Dans le frontend

// ✅ BON
const supabase = createClient(url, ANON_KEY); // Dans le frontend
```

### 2. Vérifier les policies régulièrement

```sql
-- Voir toutes les policies
SELECT * FROM pg_policies WHERE tablename = 'signals';

-- Vérifier que RLS est activé
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'signals';
-- Doit retourner rowsecurity = true
```

### 3. Tester les permissions

```sql
-- Se connecter avec clé anon (via Supabase Dashboard → SQL Editor)
-- Tester la lecture
SELECT * FROM signals LIMIT 1; -- ✅ Devrait fonctionner

-- Tester l'écriture
INSERT INTO signals (source, type) VALUES ('test', 'test'); 
-- ❌ Devrait échouer avec erreur RLS
```

---

## 📝 Résumé

| Action | Frontend (anon) | Backend (service_role) |
|--------|-----------------|------------------------|
| **SELECT signals** | ✅ Oui | ✅ Oui |
| **INSERT signals** | ❌ Non | ✅ Oui |
| **UPDATE signals** | ❌ Non | ✅ Oui |
| **DELETE signals** | ❌ Non | ✅ Oui |
| **Realtime** | ✅ Oui (lecture) | ✅ Oui |

**Le frontend est en lecture seule, le backend peut tout faire.**


