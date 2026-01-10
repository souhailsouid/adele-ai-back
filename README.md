# ADEL AI - Backend

Système de collecte et d'analyse de signaux de trading basé sur les données SEC 13F, RSS, crypto et réseaux sociaux.

## 🏗️ Architecture

### Collectors (Lambda)
- **collector-sec-watcher** : Détecte les nouveaux 13F filings sur EDGAR (toutes les 5 min)
- **collector-rss** : Collecte les flux RSS (Reuters, AP, Yahoo Finance, CNBC, MarketWatch)
- **collector-coinglass** : Collecte les données CoinGlass (funding, OI, liquidations)
- **collector-scrapecreators** : Collecte les données ScrapeCreators (Trump, Twitter, Reddit)

### Processors (Lambda)
- **parser-13f** : Parse les fichiers 13F XML et extrait les holdings
- **processor-ia** : Enrichit les signaux avec GPT (résumé, score, tags, impact)

### API (Lambda)
- Endpoints : `/signals`, `/signals/{id}`, `/search`, `/chat`
- Authentification : AWS Cognito JWT

## 📊 Base de Données (Supabase)

### Tables Principales
- `signals` : Tous les signaux collectés
- `funds` : Fonds à surveiller (CIK, nom, tier)
- `fund_filings` : Documents 13F détectés
- `fund_holdings` : Positions extraites des 13F
- `fund_holdings_diff` : Différences entre filings
- `fund_signals` : Signaux générés à partir des changements

## 🚀 Déploiement

### Prérequis
- Terraform
- AWS CLI configuré
- Supabase projet créé

### Configuration

1. Copier `infra/terraform/terraform.tfvars.example` vers `terraform.tfvars`
2. Remplir les variables :
   - `supabase_url`
   - `supabase_service_key`
   - `openai_api_key`
   - `coinglass_api_key` (optionnel)
   - `scrapecreators_api_key` (optionnel)

### Build & Deploy

```bash
# Build tous les workers
cd workers/collector-sec-watcher && npm install && npm run bundle
cd workers/collector-rss && npm install && npm run bundle
cd workers/collector-coinglass && npm install && npm run bundle
cd workers/collector-scrapecreators && npm install && npm run bundle
cd workers/processor-ia && npm install && npm run bundle

# Build parser 13F (Python)
cd workers/parser-13f && bash scripts/build.sh

# Build API
cd services/api && npm install && npm run bundle

# Deploy avec Terraform
cd infra/terraform
terraform init
terraform plan
terraform apply
```

## 📝 Migration Supabase

Exécuter la migration dans Supabase SQL Editor :
```bash
infra/supabase/migrations/001_initial_schema.sql
```

## 🔧 Ajouter un Fund à Surveiller

Dans Supabase SQL Editor :
```sql
INSERT INTO funds (name, cik, tier_influence, category) VALUES
('Nom du Fund', '0001234567', 5, 'hedge_fund');
```

## 📚 Documentation

- **Architecture** : Voir `ARCHITECTURE.md`
- **API** : Voir `openapi/spec.yaml`
- **Tests et Validation** : Voir `TESTS_VALIDATION_GUIDE.md` (guide complet de tous les tests)
- **Index des Scripts de Test** : Voir `scripts/TEST_INDEX.md`

## 🧪 Tests et Validation

Tous les tests sont organisés dans le dossier `tests/` pour faciliter la maintenance.

### Tests d'Analyse Stratégique
```bash
# Test complet de validation de l'analyse stratégique
npx tsx tests/strategic-analysis/test-strategic-analysis.ts
```

**Fonctionnalités testées** :
- Structure de la réponse `StrategicAnalysis`
- Calculs de `portfolio_impact_pct` et `portfolio_weight`
- Classification par conviction (high/medium/low/noise)
- Détection des tendances multi-trimestres
- Validation de `all_movements`, `sector_flows_filtered`, `has_only_unknown_sectors`
- Test avec `include_low_conviction=true`

### Tests de Notifications d'Accumulation
```bash
# Test rapide de toutes les routes
./tests/routes/test-all-routes.sh <TOKEN>
```

**Routes testées** :
- `GET /funds/{id}/diffs/strategic` (avec/sans `include_low_conviction`)
- `GET /notifications/accumulations?only_global=true` (avec filtres)

### Scripts de Diagnostic
```bash
# Diagnostic automatisé des accumulations
npx tsx tests/accumulations/diagnose-accumulations.ts <fund_id>
```

**Documentation** :
- `tests/README.md` : Vue d'ensemble de tous les tests
- `tests/strategic-analysis/VALIDATION_GUIDE.md` : Guide complet
- `tests/strategic-analysis/QUICK_REFERENCE.md` : Référence rapide
- `tests/accumulations/diagnose-accumulations-summary.md` : Guide d'utilisation

## 🔍 Vérification

### Logs Lambda
```bash
aws logs tail /aws/lambda/adel-ai-dev-collector-sec-watcher --follow
aws logs tail /aws/lambda/adel-ai-dev-parser-13f --follow
```

### Supabase
```sql
-- Voir les filings détectés
SELECT * FROM fund_filings ORDER BY filing_date DESC;

-- Voir les holdings parsés
SELECT * FROM fund_holdings ORDER BY market_value DESC;
```
