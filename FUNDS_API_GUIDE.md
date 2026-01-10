# 📊 Guide API Funds - Remplacement des APIs Externes

## 🎯 Vue d'ensemble

Ce guide documente les nouvelles routes API pour les funds, conçues pour remplacer progressivement les APIs externes comme Unusual Whales.

## 📋 Routes Disponibles

### Routes de Base

#### `GET /funds`
Liste tous les funds suivis.

#### `GET /funds/{id}`
Détails d'un fund spécifique.

#### `GET /funds/{id}/holdings`
Holdings d'un fund (limite par défaut: 100).

**Query params:**
- `limit`: Nombre de résultats (défaut: 100)

#### `GET /funds/{id}/filings`
Liste tous les filings d'un fund.

**Query params:**
- `form_type`: Filtrer par type (ex: `13F-HR`, `SC 13G`, `SC 13D`)

**Exemple:**
```bash
GET /funds/1/filings?form_type=13F-HR
```

### Routes Avancées (Nouvelles)

#### `GET /funds/{id}/portfolio`
Retourne le portefeuille actuel (dernier filing parsé).

**Réponse:**
```json
{
  "holdings": [
    {
      "ticker": "AAPL",
      "shares": 1200000,
      "market_value": 240000000,
      "fund_filings": {
        "filing_date": "2025-11-12",
        "form_type": "13F-HR"
      }
    }
  ],
  "filing": {
    "id": 123,
    "filing_date": "2025-11-12"
  }
}
```

#### `GET /funds/{id}/diffs`
Retourne toutes les différences entre filings.

**Query params:**
- `limit`: Nombre de résultats (défaut: 50)

**Réponse:**
```json
[
  {
    "ticker": "AAPL",
    "action": "increase",
    "shares_old": 1000000,
    "shares_new": 1200000,
    "diff_shares": 200000,
    "diff_shares_pct": 20.0,
    "filing_new": {
      "filing_date": "2025-11-12",
      "form_type": "13F-HR"
    },
    "filing_old": {
      "filing_date": "2025-08-14",
      "form_type": "13F-HR"
    }
  }
]
```

#### `GET /funds/{id}/diffs/{ticker}`
Retourne l'historique des changements pour un ticker spécifique.

**Exemple:**
```bash
GET /funds/1/diffs/AAPL
```

#### `GET /funds/{id}/changes`
Retourne les changements récents (nouveautés, sorties, changements >10%).

**Query params:**
- `min_change_pct`: Pourcentage minimum de changement (défaut: 10)

**Réponse:**
```json
[
  {
    "ticker": "AAPL",
    "action": "new",
    "shares_new": 500000,
    "diff_shares": 500000,
    "filing_new": {
      "filing_date": "2025-11-12"
    }
  },
  {
    "ticker": "TSLA",
    "action": "exit",
    "shares_old": 100000,
    "diff_shares": -100000
  }
]
```

#### `POST /funds/{id}/filings/{filingId}/calculate-diff`
Calcule les différences pour un filing spécifique (déclenche le calcul).

**Réponse:**
```json
{
  "fund_id": 1,
  "fund_name": "BlackRock",
  "filing_id_new": 123,
  "filing_id_old": 122,
  "filing_date_new": "2025-11-12",
  "filing_date_old": "2025-08-14",
  "total_changes": 45,
  "new_positions": 5,
  "exits": 3,
  "increases": 20,
  "decreases": 17,
  "diffs": [
    {
      "ticker": "AAPL",
      "action": "increase",
      "shares_old": 1000000,
      "shares_new": 1200000,
      "diff_shares": 200000,
      "diff_shares_pct": 20.0
    }
  ]
}
```

### Route Calendrier SEC

#### `GET /sec/calendar`
Retourne les informations du calendrier SEC (trimestres, périodes de pic).

**Query params:**
- `year`: Année (défaut: année actuelle)

**Réponse:**
```json
{
  "current_quarter": {
    "quarter": "Q4",
    "endDate": "2025-12-31",
    "deadlineDate": "2026-02-14",
    "peakStartDate": "2026-02-01",
    "peakEndDate": "2026-02-14",
    "year": 2025
  },
  "is_peak_period": false,
  "recommended_polling_interval_minutes": 5,
  "days_until_deadline": 45,
  "year_calendar": [
    {
      "quarter": "Q1",
      "endDate": "2025-03-31",
      "deadlineDate": "2025-05-15",
      "peakStartDate": "2025-05-01",
      "peakEndDate": "2025-05-15"
    }
  ]
}
```

## 🔄 Types de Formulaires Supportés

### Formulaires Pertinents

| Formulaire | Nom Commun | Utilité | Fréquence |
|------------|------------|---------|-----------|
| **13F-HR** | Le Portefeuille | Liste toutes les actions détenues par le fonds. C'est le cœur du produit. | Trimestriel (4x / an) |
| **13F-HR/A** | Amendement Portefeuille | Correction d'un rapport 13F-HR précédent | Aléatoire |
| **SC 13G** | L'Alerte Baleine | Un fonds possède >5% d'une boîte. Signal d'achat massif. | Aléatoire (Temps réel) |
| **SC 13G/A** | Amendement Alerte | Modification d'une position >5% | Aléatoire |
| **SC 13D** | Intention Active | Déclaration d'intention active (>5%) | Aléatoire |
| **13D/A** | Amendement Intention | Modification d'intention active | Aléatoire |

### Formulaires Ignorés

- **Form 4**: Mouvements internes (insider trading) - Bruit
- **Form 3**: Déclaration initiale d'insider - Bruit
- **Form 5**: Transactions annuelles d'insider - Bruit

## 📅 Calendrier des Publications

### Délai des 45 jours

Les institutions ont **45 jours maximum** après la fin d'un trimestre pour publier leur 13F.

### Trimestres et Deadlines

| Trimestre | Fin | Deadline | Période de Pic |
|-----------|-----|----------|----------------|
| **Q1** | 31 mars | 15 mai | 1-15 mai |
| **Q2** | 30 juin | 14 août | 1-14 août |
| **Q3** | 30 septembre | 14 novembre | 1-14 novembre |
| **Q4** | 31 décembre | 14 février | 1-14 février |

### Fréquence de Polling Recommandée

- **Pendant les périodes de pic** (1er au 15 du mois): **1 minute**
- **En dehors**: **5 minutes** (comme actuellement)

## 🔧 Services Internes

### `fund-diff.service.ts`
Service de calcul de différences entre filings.

**Fonctions principales:**
- `calculateFundDiff()`: Calcule les différences entre deux filings
- `formatDiffMessage()`: Génère un message lisible pour l'utilisateur

### `sec-calendar.service.ts`
Service de gestion du calendrier SEC.

**Fonctions principales:**
- `getCurrentQuarter()`: Retourne les infos du trimestre actuel
- `isPeakPeriod()`: Vérifie si on est en période de pic
- `getRecommendedPollingInterval()`: Retourne l'intervalle recommandé

### `sec-filter.service.ts`
Service de filtrage des formulaires pertinents.

**Fonctions principales:**
- `isRelevantFormType()`: Vérifie si un formulaire est pertinent
- `determineFormType()`: Détermine le type depuis titre/URL
- `filterRelevantFilings()`: Filtre les filings pertinents

## 🚀 Workflow Technique

### 1. Surveillance (Daily Check)
Le `collector-sec-watcher` tourne toutes les 5 minutes (ou 1 minute en période de pic) et :
- Interroge le flux RSS "Latest Filings" de la SEC
- Filtre uniquement les formulaires pertinents (13F-HR, SC 13G, SC 13D)
- Vérifie si le CIK du dépôt est dans la liste de funds
- Insère les nouveaux filings en base

### 2. Extraction (Parsing)
Dès qu'un 13F est détecté :
- Le parser télécharge et parse le fichier XML
- Insère les holdings dans `fund_holdings`
- Met à jour le status à `PARSED`

### 3. Calcul de Différences
Quand un nouveau filing est parsé :
- Compare les shares avec le filing précédent
- Calcule les différences (new, exit, increase, decrease)
- Insère dans `fund_holdings_diff`
- Génère des messages lisibles

### 4. Notification (À venir)
- Envoie mail/push pour les changements importants
- Exemple: "🔔 Alerte : Michael Burry vient de vendre toutes ses actions Alibaba !"

## 📝 Exemples d'Utilisation

### Récupérer le portefeuille actuel de BlackRock
```bash
GET /funds/1/portfolio
```

### Voir tous les changements récents (>10%)
```bash
GET /funds/1/changes?min_change_pct=10
```

### Suivre l'historique d'un ticker
```bash
GET /funds/1/diffs/AAPL
```

### Vérifier le calendrier SEC
```bash
GET /sec/calendar
```

### Calculer les différences pour un nouveau filing
```bash
POST /funds/1/filings/123/calculate-diff
```

## 🔄 Migration depuis Unusual Whales

Ces nouvelles routes remplacent progressivement les endpoints Unusual Whales :

| Ancien (UW) | Nouveau (Internal) |
|-------------|-------------------|
| `/unusual-whales/institution/{name}/activity` | `/funds/{id}/changes` |
| `/unusual-whales/institution/{name}/holdings` | `/funds/{id}/portfolio` |
| `/unusual-whales/institution-activity/{ticker}` | `/funds/{id}/diffs/{ticker}` |

## ✅ Prochaines Étapes

1. ✅ Service de calcul de différences
2. ✅ Service de calendrier SEC
3. ✅ Nouvelles routes API
4. ⏳ Service de notification (mail/push)
5. ⏳ Intégration automatique du calcul de diff après parsing
6. ⏳ Dashboard avec visualisations
