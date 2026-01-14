# 🔗 Insider Cross-Company Tracking

## Vue d'ensemble

Cette fonctionnalité permet de suivre les dirigeants (insiders) via leur **CIK personnel** pour découvrir leurs transactions dans **toutes les entreprises** où ils sont actifs, pas seulement celle où on les a initialement détectés.

## Pourquoi c'est puissant ?

### Exemple concret

1. **Détection initiale** : Le CFO d'Oracle achète des actions Oracle (Form 4 détecté)
2. **Tracking cross-company** : En suivant son CIK personnel, on découvre qu'il achète aussi massivement des actions d'une petite entreprise technologique où il siège au conseil d'administration
3. **Signal riche** : C'est un signal "cross-company" très précieux pour l'analyse

## Architecture

### 1. Extraction du CIK du dirigeant

Lors du parsing d'un Form 4, on extrait maintenant le `<rptOwnerCik>` depuis le XML :

```typescript
// Dans form4-parser.service.ts
const ownerCikMatch = xmlContent.match(/<rptOwnerCik[^>]*>([^<]+)<\/rptOwnerCik>/i);
const ownerCik = ownerCikMatch ? ownerCikMatch[1].trim().padStart(10, '0') : undefined;
```

### 2. Stockage du CIK

Le CIK du dirigeant est stocké dans `insider_trades.insider_cik` :

```sql
SELECT 
  insider_name,
  insider_cik,  -- ✅ CIK personnel du dirigeant
  relation,
  transaction_type,
  total_value,
  company_id  -- Entreprise où la transaction a eu lieu
FROM insider_trades
WHERE insider_cik IS NOT NULL;
```

### 3. Tracking cross-company

La fonction `syncInsiderCrossCompany()` :

1. **Récupère tous les CIK de dirigeants uniques** depuis `insider_trades`
2. **Pour chaque CIK**, appelle l'API SEC submissions : `https://data.sec.gov/submissions/CIK{cik}.json`
3. **Extrait tous les filings** (Form 3, 4, 5) de ce dirigeant
4. **Parse et stocke** les transactions même si elles sont pour d'autres entreprises

## Utilisation

### Synchronisation complète

```bash
# Synchroniser uniquement le tracking cross-company
npx tsx scripts/sync_sec_smart_money.ts --track-insiders
```

### Workflow recommandé

1. **D'abord**, synchroniser les Form 4 des top companies :
   ```bash
   npx tsx scripts/sync_sec_smart_money.ts --insiders-only
   ```

2. **Ensuite**, suivre les dirigeants découverts :
   ```bash
   npx tsx scripts/sync_sec_smart_money.ts --track-insiders
   ```

## API SEC Submissions pour dirigeants

### Format de l'URL

```
https://data.sec.gov/submissions/CIK{CIK_DIRIGEANT}.json
```

### Différence importante

- **Entreprise** : `name` = nom de la société (ex: "ORACLE CORP")
- **Dirigeant** : `name` = nom de la personne (ex: "ELLISON LAWRENCE J")

### Structure JSON

```json
{
  "cik": "0001341439",
  "name": "ELLISON LAWRENCE J",  // ← Nom de la personne
  "filings": {
    "recent": {
      "accessionNumber": ["0001341439-25-000090", ...],
      "form": ["4", "4", "3", ...],
      "filingDate": ["2025-01-09", ...],
      "primaryDocument": ["xslF345X05/form4.xml", ...]
    }
  }
}
```

## Découverte de corrélations

### Requête SQL pour trouver les corrélations

```sql
-- Trouver les dirigeants actifs dans plusieurs entreprises
SELECT 
  it.insider_cik,
  it.insider_name,
  COUNT(DISTINCT it.company_id) as companies_count,
  COUNT(*) as total_transactions,
  SUM(it.total_value) as total_value
FROM insider_trades it
WHERE it.insider_cik IS NOT NULL
GROUP BY it.insider_cik, it.insider_name
HAVING COUNT(DISTINCT it.company_id) > 1
ORDER BY total_value DESC;
```

### Exemple de résultat

```
insider_cik    | insider_name        | companies_count | total_transactions | total_value
0001234567     | SMITH JOHN A        | 3               | 15                 | 5000000
0002345678     | DOE JANE B          | 2               | 8                  | 2500000
```

## Limitations actuelles

1. **Form 3 et 5** : Le parsing n'est pas encore implémenté (seul Form 4 est parsé)
2. **Entreprises inconnues** : Si une entreprise n'existe pas dans notre base, on skip le filing (pourrait être amélioré)
3. **Rate limiting** : 10 requêtes/seconde max (SEC requirement)

## Améliorations futures

1. **Parser Form 3 et 5** pour avoir une vue complète
2. **Auto-création d'entreprises** si elles n'existent pas
3. **Alertes cross-company** : Notifier quand un dirigeant fait des transactions importantes dans plusieurs entreprises
4. **Graph de relations** : Visualiser les connexions entre dirigeants et entreprises
