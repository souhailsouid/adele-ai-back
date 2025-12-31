# 🔧 Correction des Erreurs de Migration

## ✅ Erreurs Corrigées

### Erreur 1 : Trigger Existant

**Problème** :
```
ERROR: 42710: trigger "update_alert_keywords_updated_at" for relation "alert_keywords" already exists
```

**Solution** : Ajout de `DROP TRIGGER IF EXISTS` avant chaque `CREATE TRIGGER`

### Erreur 2 : Policy Existant

**Problème** :
```
ERROR: 42710: policy "Allow update signals for service_role" for table "signals" already exists
```

**Solution** : Ajout de `DROP POLICY IF EXISTS` avant chaque `CREATE POLICY`

---

## 🔧 Corrections Appliquées

### Triggers
Ajout de `DROP TRIGGER IF EXISTS` avant chaque `CREATE TRIGGER` :

```sql
-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS update_alert_keywords_updated_at ON alert_keywords;

-- Créer le trigger
CREATE TRIGGER update_alert_keywords_updated_at
BEFORE UPDATE ON alert_keywords
FOR EACH ROW
EXECUTE FUNCTION update_alert_keywords_updated_at();
```

---

## ✅ Autres Corrections Appliquées

### 1. Realtime Publication (Idempotent)

La commande `ALTER PUBLICATION` est maintenant idempotente :

```sql
-- Vérifie si la table est déjà dans la publication avant d'ajouter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'signals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE signals;
  END IF;
END $$;
```

**Résultat** : La migration peut être exécutée plusieurs fois sans erreur.

### Policies RLS
Ajout de `DROP POLICY IF EXISTS` avant chaque `CREATE POLICY` :

```sql
-- Exemple pour toutes les policies
DROP POLICY IF EXISTS "Allow read signals" ON signals;
CREATE POLICY "Allow read signals" ON signals FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow write signals for service_role" ON signals;
CREATE POLICY "Allow write signals for service_role" ON signals FOR INSERT ...;

DROP POLICY IF EXISTS "Allow update signals for service_role" ON signals;
CREATE POLICY "Allow update signals for service_role" ON signals FOR UPDATE ...;

DROP POLICY IF EXISTS "Allow delete signals for service_role" ON signals;
CREATE POLICY "Allow delete signals for service_role" ON signals FOR DELETE ...;
```

**Résultat** : Toutes les policies peuvent être recréées sans erreur.

---

## 🔄 Réexécuter la Migration

Si vous avez déjà exécuté partiellement la migration :

### Option 1 : Réexécuter Complètement

```sql
-- Dans Supabase Dashboard → SQL Editor
-- Copier-coller le contenu complet de :
-- infra/supabase/migrations/018_add_data_extraction_and_alerts.sql
```

La migration est maintenant **idempotente** (peut être exécutée plusieurs fois).

### Option 2 : Nettoyer et Réexécuter

Si vous préférez nettoyer d'abord :

```sql
-- Supprimer les triggers
DROP TRIGGER IF EXISTS trigger_alert_on_signal_insert ON signals;
DROP TRIGGER IF EXISTS update_alert_keywords_updated_at ON alert_keywords;

-- Supprimer les fonctions (optionnel)
DROP FUNCTION IF EXISTS trigger_alert_on_signal();
DROP FUNCTION IF EXISTS update_alert_keywords_updated_at();
DROP FUNCTION IF EXISTS should_trigger_alert(signals);

-- Puis réexécuter la migration complète
```

---

## ✅ Vérification Post-Migration

### 1. Vérifier les Triggers

```sql
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('signals', 'alert_keywords')
ORDER BY event_object_table, trigger_name;
```

**Résultat attendu** :
- `trigger_alert_on_signal_insert` sur `signals`
- `update_alert_keywords_updated_at` sur `alert_keywords`

### 2. Vérifier Realtime

```sql
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' AND tablename = 'signals';
```

**Résultat attendu** : Une ligne avec `tablename = 'signals'`

### 3. Vérifier RLS

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('signals', 'alert_keywords', 'alerts_sent');
```

**Résultat attendu** : `rowsecurity = true` pour toutes les tables

### 4. Vérifier les Policies

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename IN ('signals', 'alert_keywords', 'alerts_sent')
ORDER BY tablename, policyname;
```

**Résultat attendu** :
- `signals` : "Allow read signals", "Allow write signals for service_role", etc.
- `alert_keywords` : "Allow read alert_keywords"
- `alerts_sent` : "Allow read alerts_sent"

---

## 🎯 Migration Idempotente

La migration est maintenant **idempotente**, ce qui signifie :

- ✅ Peut être exécutée plusieurs fois
- ✅ Ne crée pas de doublons
- ✅ Gère les objets existants
- ✅ Pas d'erreur si déjà appliquée

**Vous pouvez réexécuter la migration sans problème !**

