# Documentation API Personamy

Cette documentation OpenAPI/Swagger décrit toutes les routes de l'API Personamy.

## 📋 Fichiers

- `personamy-api.yaml` : Documentation OpenAPI 3.0 complète de toutes les routes

## 🚀 Utilisation

### Visualiser la documentation

1. **Swagger UI** (recommandé) :
   ```bash
   # Installer Swagger UI
   npm install -g swagger-ui-serve
   
   # Lancer le serveur
   swagger-ui-serve openapi/personamy-api.yaml
   ```
   
   Ou utilisez un service en ligne :
   - https://editor.swagger.io/ (copier-coller le contenu de `personamy-api.yaml`)
   - https://swagger.io/tools/swagger-ui/

2. **Redoc** (alternative) :
   ```bash
   npm install -g redoc-cli
   redoc-cli serve openapi/personamy-api.yaml
   ```

### Générer des clients SDK

```bash
# Installer openapi-generator
npm install -g @openapitools/openapi-generator-cli

# Générer un client TypeScript
openapi-generator-cli generate \
  -i openapi/personamy-api.yaml \
  -g typescript-axios \
  -o generated-client/typescript

# Générer un client Python
openapi-generator-cli generate \
  -i openapi/personamy-api.yaml \
  -g python \
  -o generated-client/python
```

## 📚 Structure de l'API

L'API est organisée en **3 couches modulaires** :

### Couche A : Ingestion (`/ingest/*`)
- **Objectif** : Collecte rapide et idempotente des données externes
- **Pas de LLM** : Juste appel API → normalisation → stockage Supabase
- **Routes** :
  - `POST /ingest/options-flow?ticker=NVDA`
  - `POST /ingest/options-volume?ticker=NVDA`
  - `POST /ingest/dark-pool?ticker=NVDA`
  - `POST /ingest/short-interest?ticker=NVDA`
  - `POST /ingest/price-action?ticker=NVDA`
  - `POST /ingest/all?ticker=NVDA&modules=...`
  - `GET /ingest/status?ticker=NVDA`

### Couche B : Analyse Unitaire (`/analyze/*`)
- **Objectif** : Analyses par module (règles simples + IA optionnelle)
- **Lit depuis Supabase** : Pas d'appel API externe
- **Routes** :
  - `POST /analyze/options-flow?ticker=NVDA`
  - `POST /analyze/dark-pool?ticker=NVDA`
  - `POST /analyze/all?ticker=NVDA&modules=...`
  - `GET /analyze/results?ticker=NVDA&modules=...`

### Couche C : Synthèse Globale (`/ai/*`, `/analysis/*`)
- **Objectif** : Analyses combinées multi-sources et insights avancés
- **Routes** :
  - `POST /ai/options-flow-analysis`
  - `POST /ai/institution-moves-analysis`
  - `POST /ai/ticker-activity-analysis`
  - `GET /analysis/{ticker}/complete`
  - `GET /analysis/{ticker}/divergence`
  - `GET /analysis/{ticker}/valuation`

## 🔐 Authentification

Toutes les routes nécessitent un **JWT token** dans le header :

```http
Authorization: Bearer <your-jwt-token>
```

Le token est obtenu via **AWS Cognito** (OAuth2).

## 📝 Exemples d'utilisation

### 1. Ingérer des données d'options flow

```bash
curl -X POST "https://api.personamy.com/ingest/options-flow?ticker=NVDA&limit=50" \
  -H "Authorization: Bearer <token>"
```

### 2. Analyser les données ingérées

```bash
curl -X POST "https://api.personamy.com/analyze/options-flow?ticker=NVDA" \
  -H "Authorization: Bearer <token>"
```

### 3. Analyse IA complète

```bash
curl -X POST "https://api.personamy.com/ai/options-flow-analysis" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "NVDA"
  }'
```

## 🔄 Workflow recommandé

1. **Ingérer** les données : `POST /ingest/options-flow?ticker=NVDA`
2. **Vérifier** l'état : `GET /ingest/status?ticker=NVDA`
3. **Analyser** les données : `POST /analyze/options-flow?ticker=NVDA`
4. **Synthèse globale** (optionnel) : `POST /ai/ticker-activity-analysis`

## 📊 Modules disponibles

- `options_flow` : Flux d'options récents
- `options_volume` : Volume d'options agrégé
- `dark_pool` : Trades dark pool
- `short_interest` : Short interest et float
- `price_action` : Quote et prix actuel
- `insiders` : Activité des insiders
- `institutional_ownership` : Ownership institutionnel

## 🛠️ Maintenance

Pour mettre à jour la documentation :

1. Modifier `openapi/personamy-api.yaml`
2. Valider avec Swagger Editor : https://editor.swagger.io/
3. Tester avec Swagger UI
4. Commiter les changements

## 📖 Références

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)
- [Redoc](https://github.com/Redocly/redoc)





