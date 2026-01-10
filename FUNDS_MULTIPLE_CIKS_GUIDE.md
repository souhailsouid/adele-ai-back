# 🔗 Gestion des Fonds avec Plusieurs CIK

## 📋 Problématique

Certaines institutions (comme **BlackRock**) ont plusieurs entités légales avec des CIK différents. Par exemple :
- BlackRock Inc. : `0002012383` (CIK principal)
- BlackRock Advisors LLC : `0001364742` (entité secondaire)
- BlackRock Fund Advisors : `0001045810` (autre entité)

Le système précédent ne permettait qu'un seul CIK par fund, ce qui limitait la couverture complète.

## ✅ Solution Implémentée

### 1. Table `fund_ciks`

Nouvelle table pour lier plusieurs CIK à un même fund :

```sql
CREATE TABLE fund_ciks (
  id SERIAL PRIMARY KEY,
  fund_id INTEGER REFERENCES funds(id),
  cik TEXT NOT NULL,
  entity_name TEXT, -- Nom de l'entité légale
  is_primary BOOLEAN DEFAULT false,
  UNIQUE(fund_id, cik)
);
```

**Caractéristiques :**
- Un fund peut avoir plusieurs CIK
- Le CIK dans `funds.cik` reste le CIK principal (`is_primary = true`)
- Les CIK supplémentaires sont dans `fund_ciks` avec `is_primary = false`

### 2. Collector Mis à Jour

Le `collector-sec-watcher` vérifie maintenant **tous les CIK** d'un fund :

```typescript
// Pour chaque fund, récupère tous ses CIK (primary + supplémentaires)
const allCiks = [fund.cik, ...additionalCiks];

// Vérifie chaque CIK pour de nouveaux filings
for (const cik of allCiks) {
  await checkFundForNewFilings({ id: fund.id, name: fund.name, cik });
}
```

### 3. API Routes

Nouvelles routes pour gérer les CIK multiples :

| Route | Méthode | Description |
|-------|---------|-------------|
| `GET /funds/{id}/ciks` | GET | Liste tous les CIK d'un fund |
| `POST /funds/{id}/ciks` | POST | Ajoute un CIK supplémentaire |
| `DELETE /funds/{id}/ciks/{cik}` | DELETE | Supprime un CIK supplémentaire |

## 🚀 Utilisation

### Ajouter un CIK supplémentaire à BlackRock

```bash
# 1. Récupérer l'ID de BlackRock
curl https://your-api.com/funds \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.[] | select(.name | contains("BlackRock"))'

# 2. Ajouter un CIK supplémentaire
curl -X POST https://your-api.com/funds/1/ciks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cik": "0001364742",
    "entity_name": "BlackRock Advisors LLC"
  }'
```

### Vérifier tous les CIK d'un fund

```bash
curl https://your-api.com/funds/1/ciks \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Réponse :**
```json
[
  {
    "id": 1,
    "fund_id": 1,
    "cik": "0002012383",
    "entity_name": "BlackRock Inc.",
    "is_primary": true,
    "created_at": "2025-01-05T10:00:00Z"
  },
  {
    "id": 2,
    "fund_id": 1,
    "cik": "0001364742",
    "entity_name": "BlackRock Advisors LLC",
    "is_primary": false,
    "created_at": "2025-01-05T10:05:00Z"
  }
]
```

### Supprimer un CIK supplémentaire

```bash
curl -X DELETE https://your-api.com/funds/1/ciks/0001364742 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📊 Vue Agregée

Une vue SQL `fund_filings_aggregated` permet de voir tous les filings d'un fund, tous CIK confondus :

```sql
SELECT * FROM fund_filings_aggregated 
WHERE fund_id = 1 
ORDER BY filing_date DESC;
```

## 🔄 Migration Automatique

La migration `008_add_fund_ciks_table.sql` :
1. Crée la table `fund_ciks`
2. Migre automatiquement les CIK existants (crée une entrée `is_primary = true` pour chaque fund)
3. Crée la vue `fund_filings_aggregated`

**Aucune action manuelle requise** - les funds existants continuent de fonctionner normalement.

## ⚠️ Règles de Validation

1. **CIK unique** : Un CIK ne peut être associé qu'à un seul fund
2. **CIK primary** : Le CIK dans `funds.cik` ne peut pas être supprimé via l'API
3. **Format CIK** : Doit être 10 chiffres (ex: `0002012383`)

## 📝 Exemples d'Institutions avec Plusieurs CIK

### BlackRock
- Principal : `0002012383` (BlackRock Inc.)
- Secondaire : `0001364742` (BlackRock Advisors LLC)
- Autre : `0001045810` (BlackRock Fund Advisors)

### Vanguard
- Principal : `0000102905` (Vanguard Group Inc)
- Secondaire : `0000102906` (Vanguard Group Inc - autre entité)

### Appaloosa (David Tepper)
- Principal : `0001656456` (Appaloosa LP)
- Secondaire : `0001006438` (Appaloosa Management)

## 🎯 Avantages

1. **Couverture complète** : Tous les filings de toutes les entités sont capturés
2. **Agrégation facile** : Les données sont automatiquement agrégées par fund
3. **Flexibilité** : Ajout/suppression de CIK sans impact sur les données existantes
4. **Rétrocompatibilité** : Les funds avec un seul CIK continuent de fonctionner

## 🔍 Vérification

### Vérifier qu'un fund a plusieurs CIK

```sql
SELECT 
  f.name,
  f.cik as primary_cik,
  COUNT(fc.cik) as additional_ciks
FROM funds f
LEFT JOIN fund_ciks fc ON fc.fund_id = f.id
GROUP BY f.id, f.name, f.cik
HAVING COUNT(fc.cik) > 0;
```

### Vérifier les filings de tous les CIK d'un fund

```sql
SELECT 
  ff.*,
  fc.entity_name
FROM fund_filings ff
JOIN fund_ciks fc ON fc.cik = ff.cik
WHERE fc.fund_id = 1
ORDER BY ff.filing_date DESC;
```

## 🚨 Notes Importantes

- Le CIK principal (`funds.cik`) reste la référence principale
- Les CIK supplémentaires sont optionnels
- Le collector vérifie automatiquement tous les CIK
- Les filings sont stockés avec leur CIK respectif dans `fund_filings.cik`
