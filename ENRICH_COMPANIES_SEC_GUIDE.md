# Guide d'enrichissement des entreprises depuis SEC EDGAR

Ce guide explique comment utiliser le script `enrich_companies_from_sec.ts` pour enrichir automatiquement les entreprises de la base de données avec les données de l'API SEC EDGAR.

## 📋 Prérequis

### 1. Migration de la base de données

Avant d'utiliser le script, vous devez appliquer la migration qui ajoute les colonnes nécessaires :

```bash
# Appliquer la migration dans Supabase
# Via Supabase Dashboard > SQL Editor > Run la migration 028_add_sec_enrichment_columns.sql
```

Cette migration ajoute les colonnes suivantes à la table `companies` :
- `ein` : Employer Identification Number (ID fiscal)
- `fiscal_year_end` : Date de fin d'exercice fiscal (format: MM-DD)
- `filer_category` : Catégorie de filer SEC (ex: "Large accelerated filer")
- `exchanges` : Bourses où l'entreprise est cotée (ex: "NYSE, NASDAQ")
- `former_names` : Historique des noms de l'entreprise (format JSONB)

### 2. Configuration

Le script utilise les variables d'environnement suivantes (déjà configurées dans `.env`) :
- `SUPABASE_URL` : URL de votre instance Supabase
- `SUPABASE_SERVICE_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` : Clé de service pour bypass RLS

## 🚀 Utilisation

### Mode Dry-Run (test sans modification)

```bash
# Tester avec 5 entreprises
npx tsx scripts/enrich_companies_from_sec.ts --dry-run --limit=5
```

### Mode Production

```bash
# Enrichir toutes les entreprises
npx tsx scripts/enrich_companies_from_sec.ts

# Enrichir seulement 100 entreprises
npx tsx scripts/enrich_companies_from_sec.ts --limit=100

# Reprendre à partir d'un CIK spécifique
npx tsx scripts/enrich_companies_from_sec.ts --start-from=0001045810
```

## 📊 Fonctionnalités

### 1. Enrichissement des métadonnées

Pour chaque entreprise, le script extrait et met à jour :

- **EIN** : ID fiscal de l'entreprise
- **SIC Code & Description** : Secteur industriel précis
- **Fiscal Year End** : Date de fin d'exercice (pour anticiper les rapports)
- **Filer Category** : Catégorie SEC (Large accelerated filer, etc.)
- **Exchanges** : Bourses de cotation (NYSE, NASDAQ, etc.)
- **Former Names** : Historique des noms de l'entreprise

### 2. Extraction des filings

Le script extrait automatiquement les filings suivants :
- **8-K** : Événements importants (earnings, acquisitions, etc.)
- **10-Q** : Rapports trimestriels
- **10-K** : Rapports annuels
- **DEF 14A** : Proxy statements
- **Form 4** : Transactions des dirigeants

### 3. Génération des URLs

Pour chaque filing, le script génère automatiquement l'URL d'accès directe au document SEC selon cette logique :

```
https://www.sec.gov/Archives/edgar/data/{cikNettoye}/{accessionNettoye}/{primaryDocument}
```

Exemple :
- CIK : `0001045810` → `1045810`
- Accession : `0001045810-24-000001` → `000104581024000001`
- URL : `https://www.sec.gov/Archives/edgar/data/1045810/000104581024000001/nvda-20240101.htm`

### 4. Prévention des doublons

Le script utilise l'`accession_number` comme clé unique pour éviter les doublons. Si un filing existe déjà, il est ignoré.

## ⚙️ Configuration API SEC

### Rate Limiting

Le script respecte les limites de l'API SEC :
- **200ms de pause** entre chaque requête
- Gestion automatique des erreurs 429 (Too Many Requests)
- Retry automatique en cas de rate limit

### User-Agent

Le script utilise le header User-Agent requis par la SEC :
```
User-Agent: Personamy contact@personamy.com
```

**⚠️ Important** : Modifiez l'email dans le script (`USER_AGENT` constant) avec votre email de contact.

## 📈 Résultats

Le script affiche un résumé à la fin de l'exécution :

```
═══════════════════════════════════════════════════════════
📊 RÉSUMÉ
═══════════════════════════════════════════════════════════
✅ Entreprises traitées: 100
📝 Entreprises mises à jour: 95
📋 Filings insérés: 1250
❌ Erreurs: 5
═══════════════════════════════════════════════════════════
```

## 🔍 Vérification

Pour vérifier les données enrichies :

```sql
-- Voir les entreprises enrichies
SELECT ticker, name, ein, fiscal_year_end, filer_category, exchanges
FROM companies
WHERE ein IS NOT NULL
LIMIT 10;

-- Voir les filings récents
SELECT cf.form_type, cf.filing_date, cf.accession_number, c.ticker
FROM company_filings cf
JOIN companies c ON c.id = cf.company_id
ORDER BY cf.filing_date DESC
LIMIT 20;
```

## 🐛 Dépannage

### Erreur "column companies.ein does not exist"

**Solution** : Appliquez d'abord la migration `028_add_sec_enrichment_columns.sql`.

### Erreur 429 (Rate Limit)

Le script gère automatiquement les rate limits avec une pause de 2 secondes et un retry. Si le problème persiste, augmentez `RATE_LIMIT_MS` dans le script.

### Erreur 404 (CIK non trouvé)

Certains CIKs peuvent ne pas être disponibles sur SEC EDGAR. Le script continue avec les autres entreprises.

## 📝 Notes

- Le script traite les entreprises par ordre de CIK croissant
- Les données sont mises à jour uniquement si elles sont présentes dans la réponse SEC
- Les anciennes données ne sont pas écrasées si les nouvelles sont vides
- Le script peut être interrompu et repris avec `--start-from`
