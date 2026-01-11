# Guide d'Enrichissement Automatique des Entreprises depuis FMP

Ce guide explique comment utiliser le système d'enrichissement automatique des secteurs d'entreprises depuis l'API FMP.

## 📊 Vue d'ensemble

Le système permet d'enrichir automatiquement les entreprises dans la table `companies` avec leurs secteurs et industries depuis l'API FMP. Cela résout le problème des secteurs "Unknown" dans l'analyse stratégique des 13F.

## 🔧 Architecture

### Service d'Enrichissement

**Fichier** : `services/api/src/services/company-enrichment.service.ts`

**Fonctions principales** :
- `enrichCompanyFromFMP(ticker, cik?)` : Enrichit une entreprise unique
- `enrichCompaniesBatch(tickers, cikMap?, delayMs?)` : Enrichit plusieurs entreprises en batch

### API FMP Utilisée

**Endpoint** : `GET /fmp/sec-filings/profile/{symbol}`

**Champs extraits** :
- `marketSector` → `companies.sector`
- `sicDescription` → `companies.industry`
- `registrantName` → `companies.name`
- `cik` → `companies.cik`
- `country` → `companies.headquarters_country`
- `state` → `companies.headquarters_state`

## 🚀 Utilisation

### 1. Enrichir une entreprise unique

**Route API** : `POST /companies/enrich`

**Exemple** :
```bash
curl -X POST https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/companies/enrich \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "AAPL",
    "cik": "0000320193"
  }'
```

**Réponse** :
```json
{
  "ticker": "AAPL",
  "created": true,
  "updated": false,
  "sector": "Technology",
  "industry": "Computer Hardware",
  "error": null
}
```

### 2. Enrichir plusieurs entreprises en batch

**Route API** : `POST /companies/enrich/batch`

**Exemple** :
```bash
curl -X POST https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/companies/enrich/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tickers": ["AAPL", "MSFT", "GOOGL"],
    "cikMap": {
      "AAPL": "0000320193",
      "MSFT": "0000789019",
      "GOOGL": "0001652044"
    },
    "delayMs": 200
  }'
```

**Réponse** :
```json
[
  {
    "ticker": "AAPL",
    "created": true,
    "updated": false,
    "sector": "Technology",
    "industry": "Computer Hardware"
  },
  {
    "ticker": "MSFT",
    "created": true,
    "updated": false,
    "sector": "Technology",
    "industry": "Software"
  },
  {
    "ticker": "GOOGL",
    "created": false,
    "updated": true,
    "sector": "Technology",
    "industry": "Internet Content & Information"
  }
]
```

### 3. Utilisation depuis le parser 13F (Python)

**Option A : Appel API après parsing**

Dans `workers/parser-13f/src/index.py`, après l'insertion des holdings :

```python
import requests
import json

# Après avoir inséré les holdings (ligne ~658)
# Collecter les tickers uniques
unique_tickers = list(set([h.get("ticker") for h in holdings if h.get("ticker")]))

if unique_tickers:
    # Appeler l'API d'enrichissement
    api_url = os.environ.get("API_ENRICHMENT_URL", "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/companies/enrich/batch")
    api_key = os.environ.get("API_KEY")  # Token JWT
    
    try:
        response = requests.post(
            f"{api_url}",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "tickers": unique_tickers,
                "delayMs": 200
            },
            timeout=60
        )
        response.raise_for_status()
        results = response.json()
        print(f"Enriched {len([r for r in results if r.get('created') or r.get('updated')])} companies")
    except Exception as e:
        print(f"Error enriching companies: {str(e)}")
        # Ne pas faire échouer le parsing si l'enrichissement échoue
```

**Option B : Lambda séparée (recommandé)**

Créer une Lambda séparée qui s'exécute après le parsing pour enrichir les entreprises. Cela évite de ralentir le parsing 13F.

## 📋 Comment récupérer les informations sectorielles

### Depuis l'API FMP directement

**Endpoint** : `GET /fmp/sec-filings/profile/{symbol}`

**Exemple** :
```bash
curl "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/fmp/sec-filings/profile/AAPL" \
  -H "Authorization: Bearer $TOKEN"
```

**Réponse** :
```json
[
  {
    "symbol": "AAPL",
    "cik": "0000320193",
    "registrantName": "Apple Inc.",
    "marketSector": "Technology",
    "sicDescription": "Computer Hardware",
    "sicCode": "3571",
    "country": "United States",
    "state": "CA",
    ...
  }
]
```

### Depuis la table `companies` (après enrichissement)

**Requête SQL** :
```sql
SELECT ticker, name, sector, industry 
FROM companies 
WHERE ticker = 'AAPL';
```

**Via Supabase Client** :
```typescript
const { data, error } = await supabase
  .from("companies")
  .select("ticker, name, sector, industry")
  .eq("ticker", "AAPL")
  .single();
```

### Dans l'analyse stratégique

Les secteurs sont automatiquement récupérés via `getTickersSectorsBatch()` dans `fund-strategic-analysis.service.ts` :

```typescript
// Récupère tous les secteurs en batch
const sectorMap = await getTickersSectorsBatch(tickers);

// Utilisation
const sector = sectorMap.get("AAPL"); // "Technology" ou null
```

## 🔄 Intégration dans le flux de parsing 13F

### Option recommandée : Lambda d'enrichissement séparée

1. **Créer une Lambda** `company-enrichment-worker` qui :
   - Écoute les événements EventBridge après le parsing 13F
   - Récupère les tickers du filing parsé
   - Appelle `enrichCompaniesBatch` pour enrichir les entreprises manquantes

2. **Déclencher après parsing** :
   - Dans `parser-13f`, après avoir marqué le filing comme `PARSED`
   - Publier un événement EventBridge avec les tickers
   - La Lambda d'enrichissement traite l'événement de manière asynchrone

### Option alternative : Appel direct depuis parser

Appeler l'API d'enrichissement directement depuis le parser Python (voir exemple ci-dessus).

## 📊 Statistiques et Monitoring

Le service retourne des statistiques après chaque batch :

```json
{
  "created": 5,
  "updated": 3,
  "skipped": 2,
  "failed": 1
}
```

**Logs** :
- `[INFO] Enriching company AAPL from FMP`
- `[INFO] Created company AAPL`
- `[INFO] Updated company MSFT`
- `[WARN] No FMP profile found for UNKNOWN`

## ⚠️ Rate Limiting

FMP a des limites de rate. Le service inclut un délai par défaut de 200ms entre chaque requête pour éviter le throttling.

**Ajuster le délai** :
```typescript
await enrichCompaniesBatch(tickers, cikMap, 500); // 500ms entre chaque requête
```

## 🎯 Résultat attendu

Après enrichissement, les flux sectoriels dans l'analyse stratégique (`/funds/{id}/diffs/strategic`) devraient montrer :
- ✅ Moins de secteurs "Unknown"
- ✅ Flux sectoriels plus précis
- ✅ `has_only_unknown_sectors = false` pour la plupart des funds

## 🔍 Vérification

**Vérifier les entreprises enrichies** :
```sql
SELECT 
  COUNT(*) as total,
  COUNT(sector) as with_sector,
  COUNT(industry) as with_industry,
  COUNT(*) FILTER (WHERE sector IS NULL) as missing_sector
FROM companies;
```

**Vérifier les secteurs dans les holdings** :
```sql
SELECT 
  fh.ticker,
  c.sector,
  c.industry,
  COUNT(*) as holdings_count
FROM fund_holdings fh
LEFT JOIN companies c ON c.ticker = fh.ticker
GROUP BY fh.ticker, c.sector, c.industry
ORDER BY holdings_count DESC
LIMIT 20;
```

---

*Dernière mise à jour : 2026-01-10*
