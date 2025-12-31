# ✅ Déploiement Final : Checklist Complète

## 🎯 3 Points Critiques

1. ✅ **Activer Realtime dans Dashboard Supabase**
2. ✅ **Schéma JSON fixe pour `extracted_data`**
3. ✅ **Sécurité RLS configurée**

---

## 📋 Étape 1 : Migration SQL

### Appliquer la Migration

```sql
-- Dans Supabase Dashboard → SQL Editor
-- Copier-coller le contenu de :
-- infra/supabase/migrations/018_add_data_extraction_and_alerts.sql
```

**Ce que ça fait** :
- ✅ Ajoute `extracted_data` avec schéma fixe
- ✅ Active Realtime (SQL)
- ✅ Configure RLS (sécurité)

---

## 📋 Étape 2 : Activer Realtime dans Dashboard

### ⚠️ IMPORTANT : Double Activation Requise

La migration SQL active Realtime, **MAIS** vous devez AUSSI l'activer dans le Dashboard :

1. **Aller dans Supabase Dashboard**
2. **Database** → **Replication**
3. **Trouver la table `signals`**
4. **Cocher "Enable Realtime"** ✅
5. **Sauvegarder**

### Vérification

```sql
-- Vérifier que Realtime est activé
SELECT * FROM pg_publication_tables WHERE tablename = 'signals';
-- Doit retourner une ligne avec tablename = 'signals'
```

**Si vide** :
```sql
-- Activer manuellement
ALTER PUBLICATION supabase_realtime ADD TABLE signals;
```

Puis **re-vérifier dans le Dashboard** que "Enable Realtime" est coché.

---

## 📋 Étape 3 : Vérifier le Schéma JSON

### Structure Garantie

Le frontend peut toujours s'attendre à :

```typescript
{
  actual: number;              // ⭐ TOUJOURS présent si extraction réussie
  forecast?: number;          // Optionnel
  previous?: number;              // Optionnel
  dataType?: string;
  indicator?: string;
  surprise?: 'positive' | 'negative' | 'neutral';
  surpriseMagnitude?: number;
  unit?: string;
  period?: string;
  region?: string;
}
```

### Test

```sql
-- Vérifier qu'un signal a extracted_data avec actual
SELECT 
  id,
  raw_data->'extracted_data'->>'actual' as actual,
  raw_data->'extracted_data'->>'forecast' as forecast,
  raw_data->'extracted_data'->>'surprise' as surprise
FROM signals
WHERE raw_data->'extracted_data' IS NOT NULL
LIMIT 5;
```

**Résultat attendu** : Des lignes avec `actual` comme nombre.

---

## 📋 Étape 4 : Vérifier RLS (Sécurité)

### Vérifier que RLS est Activé

```sql
-- Vérifier RLS
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('signals', 'alert_keywords', 'alerts_sent');
-- Doit retourner rowsecurity = true pour toutes les tables
```

### Vérifier les Policies

```sql
-- Voir toutes les policies
SELECT * FROM pg_policies WHERE tablename = 'signals';
-- Doit retourner :
-- 1. "Allow read signals" (SELECT)
-- 2. "Deny write signals from frontend" (INSERT/UPDATE/DELETE)
```

### Tester les Permissions

```sql
-- Test 1 : Lecture (devrait fonctionner)
SELECT * FROM signals LIMIT 1;
-- ✅ Devrait retourner des données

-- Test 2 : Écriture avec clé anon (devrait échouer)
-- À tester depuis le frontend ou avec clé anon
INSERT INTO signals (source, type) VALUES ('test', 'test');
-- ❌ Devrait échouer : "new row violates row-level security policy"
```

---

## ✅ Checklist Complète

### Backend

- [ ] Migration SQL appliquée
- [ ] Realtime activé dans Dashboard Supabase
- [ ] Realtime vérifié avec `SELECT * FROM pg_publication_tables`
- [ ] RLS vérifié avec `SELECT tablename, rowsecurity FROM pg_tables`
- [ ] Policies vérifiées avec `SELECT * FROM pg_policies`

### Frontend

- [ ] Type `ExtractedData` défini avec `actual: number`
- [ ] Utiliser `NEXT_PUBLIC_SUPABASE_ANON_KEY` (pas service_role)
- [ ] Tester la lecture : `SELECT * FROM signals`
- [ ] Tester Realtime : S'abonner aux changements
- [ ] Vérifier que l'écriture échoue (sécurité)

---

## 🐛 Dépannage

### Realtime ne fonctionne pas

**Symptôme** : Le frontend ne reçoit pas les notifications

**Vérifications** :
1. ✅ Migration SQL appliquée
2. ✅ "Enable Realtime" coché dans Dashboard
3. ✅ `SELECT * FROM pg_publication_tables` retourne `signals`
4. ✅ RLS permet la lecture

**Solution** :
```sql
-- Réactiver Realtime
ALTER PUBLICATION supabase_realtime DROP TABLE signals;
ALTER PUBLICATION supabase_realtime ADD TABLE signals;
-- Puis re-vérifier dans Dashboard
```

### RLS bloque la lecture

**Symptôme** : Le frontend ne peut pas lire les signaux

**Vérifications** :
```sql
-- Vérifier que la policy existe
SELECT * FROM pg_policies WHERE tablename = 'signals' AND policyname = 'Allow read signals';

-- Si absente, créer
CREATE POLICY "Allow read signals" ON signals
  FOR SELECT
  USING (true);
```

### extracted_data est null

**Symptôme** : Aucun signal n'a `extracted_data`

**Vérifications** :
1. ✅ Le collector-rss a été rebuild et redéployé
2. ✅ Des signaux RSS récents existent
3. ✅ Les signaux contiennent des patterns extractibles (CPI, GDP, etc.)

**Test** :
```sql
-- Vérifier les signaux RSS récents
SELECT 
  id,
  raw_data->>'title' as title,
  raw_data->'extracted_data' as extracted_data
FROM signals
WHERE source = 'rss'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📝 Résumé

| Point | Statut | Action |
|-------|--------|--------|
| **Migration SQL** | ✅ Fait | Appliquer dans Dashboard |
| **Realtime Dashboard** | ⚠️ Manuel | Cocher "Enable Realtime" |
| **Schéma JSON** | ✅ Fixe | Documenté dans `SCHEMA_EXTRACTED_DATA.md` |
| **RLS** | ✅ Configuré | Vérifier avec `pg_policies` |

---

## 📚 Documentation

- **Schéma JSON** : `DOCUMENTATIONS/SCHEMA_EXTRACTED_DATA.md`
- **Sécurité RLS** : `DOCUMENTATIONS/SECURITE_RLS.md`
- **Realtime** : `DOCUMENTATIONS/REALTIME_CONFIGURATION.md`

**Tout est prêt ! 🚀**


