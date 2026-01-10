# 🔄 Guide de Déduplication - Éviter le Double Comptage

## 🎯 Problématique

Certaines institutions (comme **BlackRock**) ont plusieurs entités légales avec des CIK différents qui peuvent déclarer les **mêmes positions**. 

**Risque** : Si on additionne simplement les `market_value` et `shares` des CIK `0002012383` et `0001364742`, on risque de **doubler artificiellement** la taille de la position.

## ✅ Solution Implémentée

### 1. Règle d'Or : Prioriser le CIK Primary

Le CIK Primary (dans `funds.cik`) est généralement le **filing "Parent"** qui consolide les filiales. C'est celui qu'on utilise en priorité.

**Algorithme de déduplication :**
1. Pour chaque ticker, utiliser d'abord la position du **CIK Primary**
2. Si le ticker n'existe pas dans le CIK Primary, utiliser la position du CIK secondaire
3. **Ne jamais additionner** les positions du même ticker entre plusieurs CIK

### 2. Service de Déduplication

**`fund-deduplication.service.ts`** :
- `getFundPortfolioDeduplicated()` : Portefeuille sans double comptage
- `getFundTransparencyInfo()` : Transparency Mode (liste tous les CIK)

### 3. Vue SQL `fund_portfolio_deduplicated`

Vue SQL qui applique automatiquement la déduplication :

```sql
SELECT * FROM fund_portfolio_deduplicated 
WHERE fund_id = 1;
```

## 🚀 Utilisation

### Portefeuille Dédupliqué (Recommandé)

```bash
GET /funds/1/portfolio
```

**Réponse :**
```json
{
  "fund_id": 1,
  "fund_name": "BlackRock Inc.",
  "primary_cik": "0002012383",
  "total_holdings": 1250,
  "total_market_value": 250000000000,
  "holdings": [
    {
      "ticker": "AAPL",
      "shares": 50000000,
      "market_value": 10000000000,
      "source_cik": "0002012383",
      "is_primary": true
    },
    {
      "ticker": "TSLA",
      "shares": 10000000,
      "market_value": 2000000000,
      "source_cik": "0001364742",
      "is_primary": false
    }
  ]
}
```

**Note** : Si AAPL existe dans les deux CIK, seule la position du CIK Primary (`0002012383`) est utilisée.

### Transparency Mode

```bash
GET /funds/1/transparency
```

**Réponse :**
```json
{
  "fund_id": 1,
  "fund_name": "BlackRock Inc.",
  "primary_cik": "0002012383",
  "total_ciks": 3,
  "ciks": [
    {
      "cik": "0002012383",
      "entity_name": "BlackRock Inc.",
      "is_primary": true,
      "total_filings": 45,
      "last_filing_date": "2025-11-12",
      "last_filing_type": "13F-HR",
      "last_filing_status": "PARSED"
    },
    {
      "cik": "0001364742",
      "entity_name": "BlackRock Advisors LLC",
      "is_primary": false,
      "total_filings": 12,
      "last_filing_date": "2025-10-15",
      "last_filing_type": "13F-HR",
      "last_filing_status": "PARSED"
    }
  ],
  "note": "Le portefeuille agrégé priorise le CIK Primary pour éviter le double comptage"
}
```

## 📊 Exemple Concret : BlackRock

### Scénario

- **CIK Primary** (`0002012383`) : BlackRock Inc. déclare 50M actions AAPL
- **CIK Secondaire** (`0001364742`) : BlackRock Advisors LLC déclare aussi 50M actions AAPL

### Sans Déduplication ❌
```
Total AAPL : 50M + 50M = 100M actions (FAUX - double comptage)
```

### Avec Déduplication ✅
```
Total AAPL : 50M actions (utilise uniquement le CIK Primary)
```

## ⚙️ Détection Automatique du Filing "Parent"

Le système détecte automatiquement le filing Parent en :
1. Utilisant le CIK Primary en priorité
2. Vérifiant le `form_type` (13F-HR = généralement Parent)
3. Comparant les dates (le filing le plus récent du CIK Primary)

## 🔍 Vérification

### Vérifier les holdings par CIK

```sql
-- Holdings du CIK Primary
SELECT ticker, shares, market_value 
FROM fund_holdings fh
JOIN fund_filings ff ON ff.id = fh.filing_id
JOIN funds f ON f.id = fh.fund_id
WHERE f.id = 1 
  AND fh.cik = f.cik  -- CIK Primary
  AND fh.ticker = 'AAPL';

-- Holdings des CIK secondaires
SELECT ticker, shares, market_value, fh.cik
FROM fund_holdings fh
JOIN fund_filings ff ON ff.id = fh.filing_id
JOIN fund_ciks fc ON fc.cik = fh.cik
WHERE fc.fund_id = 1
  AND fc.is_primary = false
  AND fh.ticker = 'AAPL';
```

### Vérifier la déduplication

```sql
-- Portefeuille dédupliqué (vue)
SELECT * FROM fund_portfolio_deduplicated 
WHERE fund_id = 1 
ORDER BY market_value DESC;
```

## ⚠️ Notes Importantes

1. **Le CIK Primary est la source de vérité** pour le portefeuille total
2. **Les CIK secondaires** sont utilisés uniquement pour les tickers absents du Primary
3. **Ne jamais additionner** les positions du même ticker entre CIK
4. **Le parser est déjà prêt** : Il extrait correctement les `InformationTable` du XML 13F

## 🎯 Feature "Transparency Mode"

Cette feature permet à l'utilisateur de voir :
- Tous les CIK agrégés pour un fund
- Le nombre de filings par CIK
- Le dernier filing de chaque CIK
- Quelle entité légale a déclaré quelle position

**Cela donne une image de professionnalisme et de précision énorme** pour votre SaaS.
