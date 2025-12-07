# APIs utilisées pour Ticker Insights

## 📊 Données Institutionnelles

### 1. Ownership (Holdings institutionnels)
- **API Source**: Unusual Whales
- **Endpoint**: `/institution/{ticker}/ownership?limit={limit}`
- **Backend Route**: `GET /ticker-activity/{ticker}/ownership?limit={limit}`
- **Description**: Retourne la liste des institutions qui détiennent le ticker (13F filings)
- **Données retournées**:
  - Nom de l'institution
  - Nombre de shares
  - Valeur totale
  - Pourcentage de holdings
  - Si c'est un hedge fund
  - Date de report

### 2. Activity (Transactions institutionnelles)
- **API Source**: Unusual Whales
- **Endpoint**: `/institution/{name}/activity?ticker={ticker}&limit={limit}`
- **Backend Route**: `GET /ticker-activity/{ticker}/activity?limit={limit}`
- **Description**: Retourne les transactions récentes des institutions pour le ticker
- **Note**: Le backend récupère les top 5 institutions et pour chacune, appelle l'API avec le ticker en paramètre
- **Données retournées**:
  - Nom de l'institution
  - Type de transaction (BUY/SELL)
  - Nombre de shares
  - Prix moyen
  - Date de filing
  - Changement de position

## 📄 Filings SEC (8-K, 13F, etc.)

### 3. SEC Filings par Symbol
- **API Source**: FMP (Financial Modeling Prep)
- **Endpoint**: `/sec-filings-search/symbol?symbol={ticker}&from={date}&to={date}&limit={limit}`
- **Backend Route**: `GET /fmp/sec-filings-search/symbol/{symbol}?from={date}&to={date}&limit={limit}`
- **Description**: Retourne tous les filings SEC pour le ticker (filtrés par symbol)
- **Filtrage automatique**:
  - ✅ **Filtré par ticker/symbol** : Oui, via le paramètre `symbol`
  - ✅ **Priorisation** : Les filings importants sont prioritaires :
    - 8-K (événements importants)
    - 13F-HR / 13F-HR/A (holdings institutionnels)
    - 10-K (rapport annuel)
    - 10-Q (rapport trimestriel)
    - 4 (transactions d'insiders)
    - DEF 14A (proxy statement)
  - ⚠️ **Filtrage par type** : Non, tous les types sont retournés mais les importants sont en premier
- **Données retournées**:
  - Date de filing
  - Type de formulaire (formType)
  - URL du document
  - CIK
  - Numéro d'accession
  - Si contient des données financières

## 🔍 Comment tester les APIs

### Test Ownership
```bash
curl -X GET \
  "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/ticker-activity/NVDA/ownership?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Activity
```bash
curl -X GET \
  "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/ticker-activity/NVDA/activity?limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test SEC Filings
```bash
curl -X GET \
  "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/fmp/sec-filings-search/symbol/NVDA?from=2024-01-01&to=2024-12-31&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Ticker Insights (agrégation complète)
```bash
curl -X GET \
  "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/ticker-insights/NVDA" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📝 Notes importantes

1. **13F Filings** : Les données d'ownership proviennent des filings 13F via Unusual Whales, qui agrègent les données de la SEC
2. **8-K Filings** : Les 8-K sont inclus dans les SEC filings de FMP et sont priorisés dans la réponse
3. **Filtrage par ticker** : Toutes les APIs sont filtrées par ticker/symbol automatiquement
4. **Limites** : 
   - Ownership : limité à 50 institutions par défaut
   - Activity : limité aux top 5 institutions pour éviter timeout
   - SEC Filings : limité à 10-20 filings récents (90 derniers jours)

