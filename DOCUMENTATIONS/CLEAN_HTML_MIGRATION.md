# 🧹 Migration : Nettoyer les Entités HTML

## 🎯 Objectif

Nettoyer les entités HTML (`&#x2019;`, `&amp;`, etc.) dans les données RSS existantes qui auraient pu être stockées avant l'ajout de `decodeHtmlEntities` côté backend.

---

## ✅ Vérification Avant Migration

### 1. Vérifier si des données non nettoyées existent

```sql
-- Dans Supabase Dashboard → SQL Editor
SELECT 
  id,
  raw_data->>'title' as title,
  raw_data->>'description' as description
FROM signals
WHERE source = 'rss'
AND (
  raw_data->>'title' ~ '&#|&amp;|&lt;|&gt;|&quot;|&apos;|&nbsp;' OR
  raw_data->>'description' ~ '&#|&amp;|&lt;|&gt;|&quot;|&apos;|&nbsp;'
)
LIMIT 10;
```

**Si cette requête retourne des résultats** → Exécuter la migration  
**Si cette requête retourne 0 résultats** → Pas besoin de migration ✅

---

## 🚀 Exécution de la Migration

### Option 1 : Via Supabase Dashboard

1. **Supabase Dashboard** → **SQL Editor**
2. Ouvrir le fichier `infra/supabase/migrations/020_clean_html_entities.sql`
3. Copier-coller le contenu
4. Cliquer sur **Run**

### Option 2 : Via CLI

```bash
# Si vous utilisez Supabase CLI
supabase db push
```

---

## 📊 Résultat Attendu

Après la migration, vous devriez voir :

```
✅ Tous les signaux RSS ont été nettoyés
```

Ou si des données non nettoyées restent :

```
⚠️  Il reste X signaux avec des entités HTML non nettoyées
```

---

## 🔍 Vérification Après Migration

```sql
-- Vérifier qu'il ne reste plus d'entités HTML
SELECT COUNT(*) as remaining_dirty
FROM signals
WHERE source = 'rss'
AND (
  raw_data->>'title' ~ '&#|&amp;|&lt;|&gt;|&quot;|&apos;|&nbsp;' OR
  raw_data->>'description' ~ '&#|&amp;|&lt;|&gt;|&quot;|&apos;|&nbsp;'
);
-- Doit retourner : 0
```

---

## ✅ Après la Migration

Une fois la migration exécutée et vérifiée :

1. **Supprimer `decodeHtmlEntities` du frontend** (redondant)
2. **Utiliser directement les données** :

```typescript
// ❌ AVANT (redondant)
const title = signal.raw_data?.title ? decodeHtmlEntities(signal.raw_data.title) : ''

// ✅ APRÈS (simplifié)
const title = signal.raw_data?.title || ''
```

---

## 🎯 Résumé

| Étape | Action |
|-------|--------|
| 1. Vérifier | Exécuter la requête SQL de vérification |
| 2. Migrer | Exécuter `020_clean_html_entities.sql` |
| 3. Vérifier | Confirmer que le count = 0 |
| 4. Simplifier | Supprimer `decodeHtmlEntities` du frontend |

**Le backend nettoie déjà les nouvelles données. Cette migration nettoie les anciennes.** ✅


