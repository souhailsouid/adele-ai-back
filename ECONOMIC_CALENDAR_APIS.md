# 📅 APIs Utilisées pour le Calendrier Économique

## 🎯 Vue d'ensemble

Le calendrier économique combine **2 sources** pour avoir une couverture complète :

1. **FMP Economic Calendar** (Financial Modeling Prep)
2. **Unusual Whales Economic Calendar**

---

## 1️⃣ FMP Economic Calendar

### Endpoint
- **API** : `GET /economic-calendar`
- **Base URL** : `https://financialmodelingprep.com/api/v3`
- **Fonction** : `fmp.getFMPEconomicCalendar({ from, to })`

### Types d'événements inclus

#### 🇺🇸 États-Unis
- **Fed (Federal Reserve)** :
  - Réunions FOMC (Federal Open Market Committee)
  - Décisions de taux d'intérêt
  - Discours de la Fed (Powell, etc.)
  - Minutes de la Fed
- **SEC** :
  - Réunions SEC
  - Annonces réglementaires
- **Indicateurs économiques** :
  - Nonfarm Payrolls (emploi)
  - CPI (inflation)
  - PPI (prix à la production)
  - GDP (PIB)
  - Retail Sales
  - Consumer Confidence
  - ISM Manufacturing/Non-Manufacturing
  - Housing Starts
  - Building Permits
  - Initial Jobless Claims
  - Durable Goods Orders
  - Trade Balance
  - Etc.

#### 🌍 Autres pays
- **Japon** :
  - Taux d'intérêt BoJ (Bank of Japan)
  - CPI Japon
  - GDP Japon
  - Tankan Survey
- **Europe** :
  - Réunions ECB (European Central Bank)
  - Taux d'intérêt ECB
  - CPI Eurozone
  - GDP Eurozone
  - PMI Manufacturing/Services
- **UK** :
  - Réunions BoE (Bank of England)
  - Taux d'intérêt BoE
  - CPI UK
  - GDP UK
- **Chine** :
  - Taux d'intérêt PBoC
  - GDP Chine
  - PMI Chine
- **Et autres pays** (Canada, Australie, etc.)

### Structure des données
```typescript
{
  date: "2025-12-08 08:30:00",  // Date + heure
  country: "US",
  event: "Nonfarm Payrolls",
  currency: "USD",
  previous: 150000,
  estimate: 180000,
  actual: 175000,  // Si déjà publié
  change: 25000,
  impact: "High",  // "Low" | "Medium" | "High"
  changePercentage: 0.02
}
```

---

## 2️⃣ Unusual Whales Economic Calendar

### Endpoint
- **API** : `GET /market/economic-calendar`
- **Base URL** : `https://api.unusualwhales.com/api`
- **Fonction** : `uw.getUWEconomicCalendar({ limit: 500 })`

### Types d'événements inclus

#### Événements économiques globaux
- Réunions de banques centrales (Fed, ECB, BoJ, BoE, etc.)
- Annonces de taux d'intérêt
- Indicateurs économiques majeurs
- Événements politiques/économiques importants
- Fêtes et jours fériés (qui peuvent affecter les marchés)

### Structure des données
```typescript
{
  date: "2025-12-08",  // Date ISO
  description: "Nonfarm Payrolls",
  impact: "High",  // "Low" | "Medium" | "High"
  country: "US",
  time: "08:30"  // Heure de l'événement
}
```

---

## 🔄 Fusion des données

Le service `getCombinedEconomicCalendar` :

1. **Récupère en parallèle** les deux calendriers
2. **Fusionne** les événements par date
3. **Priorise FMP** si les deux sources ont le même événement (FMP a plus de détails)
4. **Filtre** par période `from/to` si fournie
5. **Trie** par date

### Résultat
```typescript
{
  date: "2025-12-08",
  source: "BOTH" | "FMP" | "UW",
  event: "Nonfarm Payrolls",
  country: "US",
  impact: "High",
  // Détails FMP (si disponible)
  previous: 150000,
  estimate: 180000,
  actual: 175000,
  // Détails UW (si disponible)
  time: "08:30"
}
```

---

## 📊 Exemples d'événements récupérés

### Fed Meetings
- **Source** : FMP + UW
- **Exemple** : "FOMC Meeting", "Fed Interest Rate Decision"
- **Impact** : Généralement "High"

### SEC Meetings
- **Source** : FMP + UW
- **Exemple** : "SEC Meeting", "SEC Announcement"
- **Impact** : Généralement "Medium" à "High"

### Taux d'intérêt
- **Source** : FMP + UW
- **Exemples** :
  - "Fed Interest Rate Decision" (US)
  - "ECB Interest Rate Decision" (Europe)
  - "BoJ Interest Rate Decision" (Japon)
  - "BoE Interest Rate Decision" (UK)
- **Impact** : Généralement "High"

### Indicateurs économiques
- **Source** : Principalement FMP (plus de détails)
- **Exemples** :
  - "Nonfarm Payrolls" (US)
  - "CPI" (inflation)
  - "GDP" (PIB)
  - "Retail Sales"
  - "Consumer Confidence"
- **Impact** : Variable ("Low" à "High")

### Événements japonais
- **Source** : FMP + UW
- **Exemples** :
  - "BoJ Interest Rate Decision"
  - "Tankan Survey"
  - "CPI Japan"
  - "GDP Japan"
- **Impact** : Généralement "Medium" à "High"

---

## 🎯 Pourquoi 2 sources ?

### FMP (Financial Modeling Prep)
- ✅ **Plus de détails** : previous, estimate, actual, change
- ✅ **Plus d'événements** : couverture mondiale complète
- ✅ **Données historiques** : permet de voir les tendances
- ✅ **Impact précis** : Low/Medium/High

### Unusual Whales
- ✅ **Heure précise** : time (ex: "08:30")
- ✅ **Événements spéciaux** : peut avoir des événements que FMP n'a pas
- ✅ **Complémentaire** : enrichit les données FMP

---

## 📝 Utilisation dans `/ai/calendar-summary`

Quand vous appelez `POST /ai/calendar-summary` :

1. **Récupère** `getCombinedEconomicCalendar({ from, to })`
   - → Combine FMP + UW Economic Calendar
   - → Retourne tous les événements économiques (Fed, SEC, taux, indicateurs, etc.)

2. **Récupère** `getUWFDACalendar({ date })` (3 dates)
   - → Événements FDA (décisions pharmaceutiques)

3. **Récupère** `getFMPEarningsCalendar({ from, to })`
   - → Dates d'earnings des entreprises

4. **Fusionne** tout et envoie à l'IA pour analyse

---

## 🔍 Comment vérifier les données brutes ?

### FMP Economic Calendar
```bash
GET {{baseUrlData}}/fmp/economics/calendar?from=2025-12-08&to=2025-12-29
```

### Unusual Whales Economic Calendar
```bash
GET {{baseUrlData}}/unusual-whales/market/economic-calendar?limit=500
```

### Combined (via votre API)
```bash
GET {{baseUrlMain}}/economic-calendar?from=2025-12-08&to=2025-12-29
```

---

## ✅ Résumé

| Type d'événement | Source principale | Exemples |
|------------------|-------------------|----------|
| **Fed Meetings** | FMP + UW | FOMC, Interest Rate Decision |
| **SEC Meetings** | FMP + UW | SEC Announcements |
| **Taux d'intérêt** | FMP + UW | Fed, ECB, BoJ, BoE rates |
| **Indicateurs US** | FMP (détails) | Nonfarm Payrolls, CPI, GDP |
| **Indicateurs Japon** | FMP + UW | BoJ rates, Tankan, CPI Japan |
| **Indicateurs Europe** | FMP + UW | ECB rates, CPI Eurozone |
| **Événements globaux** | FMP + UW | Tous les pays |

Les deux APIs se complètent pour donner une couverture complète des événements économiques mondiaux !

