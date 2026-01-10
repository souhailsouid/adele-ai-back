# 🔧 Nettoyage des Données Funds - Incohérences Détectées

## 🐛 Problèmes Identifiés

### 1. **CIK Mal Associé**
- **Problème** : Le CIK `0002012383` (BlackRock Advisors LLC) est associé au fund ID 1 (Scion Asset Management)
- **Attendu** : Ce CIK devrait être associé au fund ID 16 (BlackRock Inc.)
- **Impact** : Transparency Mode affiche des données incorrectes

### 2. **Duplication dans Transparency Mode**
- **Problème** : Le CIK primary `0001649339` apparaît deux fois dans `/funds/1/transparency`
- **Cause** : Le CIK primary est ajouté depuis `funds.cik` ET peut aussi être dans `fund_ciks` avec `is_primary=true`
- **Impact** : Affichage confus pour l'utilisateur

### 3. **Doublons BlackRock**
- **Problème** : Deux entrées pour BlackRock :
  - ID 16: "BlackRock Inc." avec CIK `0002012383` (correct)
  - ID 14: "BlackRock Inc" avec CIK `0001364742` (ancien, devrait être CIK secondaire)
- **Impact** : Confusion dans la liste des funds

---

## ✅ Corrections Appliquées

### 1. **Correction de `getFundTransparencyInfo`**
- ✅ Détection et suppression des doublons de CIK
- ✅ Utilisation d'un `Set` pour éviter les CIK dupliqués
- ✅ Le CIK primary n'apparaît qu'une seule fois

### 2. **Script SQL de Nettoyage**
- ✅ Script `fix-fund-ciks-data.sql` créé
- ✅ Supprime les associations incorrectes
- ✅ Vérifie et corrige les doublons

---

## 🔧 Actions à Effectuer

### Étape 1 : Exécuter le Script SQL

```bash
# Via Supabase CLI
supabase db execute --file scripts/fix-fund-ciks-data.sql

# Ou via l'interface Supabase
# Copier-coller le contenu de scripts/fix-fund-ciks-data.sql
```

### Étape 2 : Vérifier les Corrections

```bash
# Vérifier que Scion n'a plus le CIK de BlackRock
GET /funds/1/ciks

# Vérifier que BlackRock a bien ses CIK
GET /funds/16/ciks

# Vérifier Transparency Mode (plus de doublons)
GET /funds/1/transparency
```

### Étape 3 : Nettoyer les Doublons BlackRock

Si vous avez deux entrées BlackRock (ID 14 et 16) :

```sql
-- Option 1 : Supprimer l'ancienne entrée (ID 14)
DELETE FROM funds WHERE id = 14;

-- Option 2 : Migrer les données de ID 14 vers ID 16
-- (si ID 14 a des filings importants)
UPDATE fund_filings SET fund_id = 16 WHERE fund_id = 14;
UPDATE fund_holdings SET fund_id = 16 WHERE fund_id = 14;
DELETE FROM funds WHERE id = 14;
```

---

## 📊 État Actuel vs État Attendu

### Fund ID 1 (Scion Asset Management)

**État Actuel (INCORRECT) :**
```json
{
  "ciks": [
    { "cik": "0001649339", "entity_name": "Scion Asset Management, LLC", "is_primary": true },
    { "cik": "0002012383", "entity_name": "BlackRock Advisors LLC", "is_primary": false }  // ❌ INCORRECT
  ]
}
```

**État Attendu (CORRECT) :**
```json
{
  "ciks": [
    { "cik": "0001649339", "entity_name": "Scion Asset Management, LLC", "is_primary": true }
  ]
}
```

### Fund ID 16 (BlackRock Inc.)

**État Attendu :**
```json
{
  "ciks": [
    { "cik": "0002012383", "entity_name": "BlackRock Inc.", "is_primary": true },
    { "cik": "0001364742", "entity_name": "BlackRock Advisors LLC", "is_primary": false }
  ]
}
```

---

## 🔍 Vérifications Post-Correction

### 1. Vérifier les CIK par Fund

```sql
SELECT 
  f.id,
  f.name,
  f.cik as primary_cik,
  COUNT(fc.id) as additional_ciks_count
FROM funds f
LEFT JOIN fund_ciks fc ON fc.fund_id = f.id
GROUP BY f.id, f.name, f.cik
ORDER BY f.id;
```

### 2. Vérifier les Associations Incorrectes

```sql
-- Trouver les CIK qui sont associés à plusieurs funds
SELECT 
  fc.cik,
  COUNT(DISTINCT fc.fund_id) as fund_count,
  STRING_AGG(f.name, ', ') as fund_names
FROM fund_ciks fc
JOIN funds f ON f.id = fc.fund_id
GROUP BY fc.cik
HAVING COUNT(DISTINCT fc.fund_id) > 1;
```

### 3. Vérifier Transparency Mode

```bash
# Devrait retourner chaque CIK une seule fois
GET /funds/1/transparency
GET /funds/16/transparency
```

---

## 📝 Notes

- **Idempotence** : Le script SQL peut être exécuté plusieurs fois sans problème
- **Sécurité** : Le script ne supprime que les associations incorrectes, pas les funds
- **Backup** : Faire un backup de la base avant d'exécuter le script

---

## ✅ Checklist de Validation

- [ ] Script SQL exécuté
- [ ] Scion n'a plus le CIK de BlackRock
- [ ] BlackRock a bien ses 2 CIK
- [ ] Transparency Mode n'a plus de doublons
- [ ] Tous les funds ont des CIK cohérents
- [ ] Pas de CIK associés à plusieurs funds (sauf si intentionnel)

---

**Une fois les corrections appliquées, les données seront cohérentes !** ✅
