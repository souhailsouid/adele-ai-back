# 📥 Guide d'Import des Données SEC

## 🎯 Objectif

Ce script importe les données SEC depuis les fichiers JSON dans Supabase :
1. **Table `companies`** : Informations des entreprises avec mapping SIC → category
2. **Table `earnings_calendar`** : Détection automatique des annonces de résultats (8-K avec item 2.02)

---

## 📋 Prérequis

### 1. Migration SQL

Appliquez d'abord la migration pour créer la table `earnings_calendar` et ajouter la colonne `category` :

```bash
# Dans Supabase Dashboard → SQL Editor
# Ou via psql
psql $DATABASE_URL -f infra/supabase/migrations/027_add_earnings_calendar_and_company_category.sql
```

### 2. Variables d'environnement

Assurez-vous d'avoir dans votre `.env` :

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

---

## 🚀 Utilisation

### Mode test (dry-run)

```bash
# Tester avec 3 fichiers
npx tsx scripts/import_sec_data.ts --dry-run --limit=3

# Tester avec un dossier spécifique
npx tsx scripts/import_sec_data.ts --dry-run --limit=10 --path=./data_sec
```

### Import réel

```bash
# Import de 50 fichiers (défaut)
npx tsx scripts/import_sec_data.ts

# Import avec limite personnalisée
npx tsx scripts/import_sec_data.ts --limit=100

# Import depuis un dossier spécifique
npx tsx scripts/import_sec_data.ts --path=/path/to/submissions --limit=50
```

---

## 📊 Fonctionnalités

### 1. Import Companies

Le script extrait et importe :
- **cik** : CIK de l'entreprise (normalisé à 10 caractères)
- **ticker** : Premier ticker valide du tableau `tickers`
- **name** : Nom de l'entreprise
- **sic_code** : Code SIC (Standard Industrial Classification)
- **industry** : Description SIC (`sicDescription`)
- **category** : Catégorie automatique basée sur le code SIC

#### Mapping SIC → Category

| Code SIC | Category |
|----------|----------|
| 100-999 | Agriculture & Pêche |
| 1000-1499 | Mines & Pétrole |
| 2000-3999 | Industrie / Manufacturier |
| 4000-4999 | Transports & Services publics |
| 5000-5999 | Commerce / Retail |
| 6000-6799 | Finance, Banque & Assurance |
| 7000-8999 | Services & Tech |

**Exemples** :
- SIC `3720` (Aircraft & Parts) → `Industrie / Manufacturier`
- SIC `6021` (National Commercial Banks) → `Finance, Banque & Assurance`
- SIC `7370` (Computer Programming) → `Services & Tech`

### 2. Détection Earnings Calendar

Le script détecte automatiquement les **annonces de résultats** en cherchant :
- **Form** : `8-K`
- **Item** : Contient `2.02` (Results of Operations and Financial Condition)

Pour chaque détection, il enregistre :
- **cik** : CIK de l'entreprise
- **ticker** : Ticker (si disponible)
- **filing_date** : Date du filing 8-K
- **accession_number** : Numéro d'accession SEC
- **form_type** : `8-K`
- **item** : `2.02`

---

## 🔍 Exemple de Sortie

```
📄 CIK0000001750.json (CIK: 0000001750)
   📊 Ticker: AIR
   🏢 Nom: AAR CORP
   📋 SIC Code: 3720
   🏭 Industry: Aircraft & Parts
   📂 Category: Industrie / Manufacturier
   📅 40 événement(s) earnings détecté(s)
      - 2023-09-21 (8-K, item 2.02)
      - 2023-07-20 (8-K, item 2.02)
      ...
   ✅ Entreprise créée
```

---

## 🛡️ Gestion des Doublons

### Companies

Le script utilise un **upsert** intelligent :
- Cherche d'abord par **CIK**
- Si non trouvé, cherche par **ticker**
- Si existant : met à jour les champs manquants
- Si nouveau : crée l'entreprise

**Note** : La colonne `category` n'est mise à jour que si elle n'existe pas déjà (pour préserver les catégories manuelles).

### Earnings Calendar

Unicité garantie par la contrainte :
- `(cik, filing_date, form_type, item)`

Si un événement existe déjà, seul le `ticker` et `accession_number` sont mis à jour.

---

## 📁 Structure des Fichiers JSON

Le script attend des fichiers JSON avec cette structure :

```json
{
  "cik": "0000001750",
  "name": "AAR CORP",
  "tickers": ["AIR"],
  "sic": "3720",
  "sicDescription": "Aircraft & Parts",
  "filings": {
    "recent": {
      "form": ["8-K", "10-K", ...],
      "filingDate": ["2023-09-21", ...],
      "items": ["2.02", "", ...],
      "accessionNumber": ["000...", ...]
    }
  }
}
```

**Fichiers ignorés** : Les fichiers contenant `-submissions-` dans le nom sont automatiquement ignorés.

---

## ⚙️ Options

| Option | Description | Défaut |
|--------|-------------|--------|
| `--limit=N` | Nombre maximum de fichiers à traiter | `50` |
| `--dry-run` | Mode test (affiche sans insérer) | `false` |
| `--path=PATH` | Chemin vers le dossier JSON | `./data_sec` |

---

## 🐛 Dépannage

### Erreur : "Table earnings_calendar does not exist"

**Solution** : Appliquez la migration SQL `027_add_earnings_calendar_and_company_category.sql`

### Erreur : "SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis"

**Solution** : Vérifiez que votre fichier `.env` contient ces variables, ou passez-les en ligne de commande :

```bash
SUPABASE_URL="..." SUPABASE_SERVICE_KEY="..." npx tsx scripts/import_sec_data.ts --dry-run
```

### Aucun événement earnings détecté

**Vérifications** :
1. Le fichier JSON contient bien `filings.recent`
2. Il y a des `form: "8-K"` dans le tableau
3. Les `items` correspondants contiennent `"2.02"`

---

## 📈 Statistiques

Le script affiche un résumé à la fin :

```
📊 RÉSUMÉ
✅ Fichiers traités: 50

📦 Companies:
   🆕 Créés: 35
   🔄 Mis à jour: 15

📅 Earnings Calendar:
   🆕 Événements créés: 120
   🔄 Événements mis à jour: 5

⏭️  Ignorés: 0
❌ Erreurs: 0
```

---

## 🔗 Fichiers Associés

- **Script** : `scripts/import_sec_data.ts`
- **Migration SQL** : `infra/supabase/migrations/027_add_earnings_calendar_and_company_category.sql`
- **Script simple (sans earnings)** : `scripts/import-submissions.ts`

---

## 💡 Pourquoi l'Item 2.02 ?

L'item **2.02** du formulaire **8-K** signifie officiellement :
> **"Results of Operations and Financial Condition"**

C'est l'indicateur universel à la SEC qu'une entreprise vient de publier ou d'annoncer la date de ses bénéfices (earnings).

**Référence SEC** : [Form 8-K Item 2.02](https://www.sec.gov/files/form8-k.pdf)

---

## ✅ Checklist d'Import

- [ ] Migration SQL appliquée
- [ ] Variables d'environnement configurées
- [ ] Test en mode `--dry-run` réussi
- [ ] Fichiers JSON dans le bon format
- [ ] Import réel lancé
- [ ] Vérification des données dans Supabase

---

**Créé le** : 2026-01-10  
**Dernière mise à jour** : 2026-01-10
