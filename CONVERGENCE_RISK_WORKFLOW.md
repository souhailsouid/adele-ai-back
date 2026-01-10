# Workflow Convergence & Risque de Liquidation - Documentation Technique

## 🎯 Objectif

Transformer les données brutes (Dark Pools + Options Flow) en **indicateurs de prix uniques** pour analyser la convergence institutionnelle et le risque de liquidation.

---

## 📐 Architecture & Approche

### 1. **Philosophie : Calculs Déterministes (Pas d'IA)**

**Décision clé** : Aucun appel à OpenAI ou IA générative.

**Pourquoi ?**
- Fiabilité : Les calculs sont reproductibles et prévisibles
- Performance : Pas de latence IA, calculs instantanés
- Coût : Zéro coût d'API IA
- Transparence : Les règles sont explicites et auditable

**Ce qui est calculé** :
- Moyennes pondérées (mathématiques pures)
- Comparaisons de distances (pourcentages)
- Classification de risque (seuils fixes)

**Ce qui est généré** :
- Interprétations textuelles basées sur des règles IF/ELSE
- Scénarios probabilistes basés sur des seuils
- Recommandations basées sur des matrices de décision

---

## 🔄 Workflow Détaillé

### Étape 1 : Récupération du Prix Actuel

**Source** : Uniquement Unusual Whales (pas FMP)

**Ordre de priorité** :
1. **Stock State (UW)** → `close` ou `prev_close`
2. **Dark Pool Trades (UW)** → Dernier prix exécuté
3. **Options Flow (UW)** → `underlying_price` le plus récent

**Logique** :
```typescript
// Essayer Stock State en premier (source la plus fiable)
// Si échec → Fallback Dark Pool (prix réellement exécuté)
// Si échec → Fallback Options Flow (prix sous-jacent)
```

**Pourquoi cet ordre ?**
- Stock State = Prix officiel de marché
- Dark Pool = Prix réellement payé par les institutions
- Options Flow = Prix sous-jacent au moment du trade

---

### Étape 2 : Calcul du Support Dark Pool (Pondéré)

**Formule** : `Support = Σ(Prix × Volume) / Σ(Volume)`

**Source** : `GET /unusual-whales/dark-pool/{ticker}`

**Processus** :
1. Récupérer les N dernières transactions Dark Pool (défaut: 100)
2. Filtrer les trades annulés (`canceled: false`)
3. Calculer la moyenne pondérée par `size` (volume)

**Exemple** :
```
Trade 1: Prix $186.50, Volume 1000 → Contribution: $186,500
Trade 2: Prix $186.60, Volume 2000 → Contribution: $373,200
Trade 3: Prix $186.40, Volume 500  → Contribution: $93,200

Support = ($186,500 + $373,200 + $93,200) / (1000 + 2000 + 500)
        = $653,900 / 3,500
        = $186.54
```

**Interprétation** : Prix moyen où les institutions ont accumulé leurs positions.

---

### Étape 3 : Calcul de l'Objectif d'Expiration (Pondéré)

**Formule** : `Target = Σ(Strike × Premium) / Σ(Premium)`

**Source** : `GET /unusual-whales/option-trades/flow-alerts`

**Processus** :
1. Récupérer les flow alerts (défaut: 200, min_premium: $50k)
2. Filtrer par date d'expiration :
   - Si `expiryFilter` fourni → Utiliser cette date
   - Sinon → Utiliser la date d'expiration la plus proche
3. Calculer la moyenne pondérée par `total_premium`
4. Calculer le volume total (somme des premiums)

**Exemple** :
```
Alert 1: Strike $190, Premium $100k → Contribution: $19,000,000
Alert 2: Strike $185, Premium $200k → Contribution: $37,000,000
Alert 3: Strike $195, Premium $50k  → Contribution: $9,750,000

Target = ($19M + $37M + $9.75M) / ($100k + $200k + $50k)
       = $65.75M / $350k
       = $187.86

Volume total = $350k = $0.35 millions
```

**Interprétation** : Prix de règlement attendu basé sur où les baleines ont misé le plus d'argent.

---

### Étape 4 : Calcul du Risque de Liquidation

**Formule** : `Distance = |Prix Actuel - Support| / Support`

**Seuils** :
- `distance <= 0.5%` → **HIGH** (risque élevé)
- `distance <= 1.0%` → **MEDIUM** (risque modéré)
- `distance > 1.0%` → **LOW** (risque faible)

**Logique** :
```typescript
if (distance <= threshold) {
  return 'HIGH';  // Prix très proche du support → Risque de liquidation
} else if (distance <= threshold * 2) {
  return 'MEDIUM'; // Zone de vigilance
} else {
  return 'LOW';    // Prix éloigné → Pas de risque immédiat
}
```

**Interprétation** : Plus le prix est proche du support Dark Pool, plus le risque de liquidation forcée est élevé.

---

### Étape 5 : Génération de l'Interprétation Dynamique

**Approche** : Règles déterministes IF/ELSE (pas d'IA)

**Structure générée** :
```typescript
{
  summary: string;           // 2-3 phrases de synthèse
  keyPoints: string[];       // Points clés à surveiller
  scenarios: Array<{          // Scénarios possibles
    label: string;
    probability: 'low' | 'medium' | 'high';
    conditions: string;
  }>;
  recommendation: 'monitor' | 'caution' | 'opportunity' | 'neutral';
}
```

**Règles d'interprétation** :

#### A. Convergence Prix/Support
```typescript
if (distance < 0.5%) {
  → "Zone de convergence critique"
  → Risque HIGH → Scénario "Liquidation en cascade"
  → Recommendation: "caution"
} else if (distance < 2%) {
  → "Zone de convergence modérée"
  → Recommendation: "monitor"
} else {
  → "Pas de convergence immédiate"
}
```

#### B. Position vs Objectif
```typescript
if (priceDistanceFromTarget < -2%) {
  → "Prix sous l'objectif → Potentiel haussier"
  → Scénario "Rally vers l'objectif"
  → Recommendation: "opportunity"
} else if (priceDistanceFromTarget > 2%) {
  → "Prix au-dessus de l'objectif → Sur-extension"
  → Scénario "Correction vers l'objectif"
  → Recommendation: "caution"
} else {
  → "Prix aligné avec l'objectif"
}
```

#### C. Profit/Perte des Baleines
```typescript
if (isWhaleInProfit && liquidationRisk === 'HIGH') {
  → "Risque de prise de profit si prix baisse"
  → Scénario "Prise de profit institutionnelle"
} else if (!isWhaleInProfit && liquidationRisk === 'HIGH') {
  → "Risque de liquidation forcée"
  → Scénario "Liquidation forcée"
}
```

#### D. Volume Concentré
```typescript
if (expiryVolume > 0 && expiryDate) {
  → "Volume de $X millions concentré sur l'expiration du [date]"
  // Fait le lien direct avec l'expiration analysée
}
```

---

## 🏗️ Architecture Technique

### Structure des Fichiers

```
services/api/src/
├── services/
│   └── convergence-risk.service.ts    # Logique métier
├── routes/
│   └── convergence-risk.routes.ts      # Route API
└── types/
    └── convergence-risk.ts            # Types TypeScript
```

### Flux de Données

```
Client Request
    ↓
POST /analyze/convergence-risk?ticker=NVDA
    ↓
convergence-risk.routes.ts (handler)
    ↓
ConvergenceRiskService.analyzeWhaleConvergence()
    ↓
┌─────────────────────────────────────┐
│ 1. getCurrentPrice()               │
│    → Stock State (UW)               │
│    → Dark Pool (UW) [fallback]     │
│    → Options Flow (UW) [fallback]   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 2. calculateWhaleSupport()         │
│    → Dark Pool Trades (UW)         │
│    → Moyenne pondérée              │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 3. calculateTargetStrike()         │
│    → Options Flow Alerts (UW)      │
│    → Filtre par expiration         │
│    → Moyenne pondérée + Volume     │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 4. calculateLiquidationRisk()      │
│    → Comparaison distance          │
│    → Classification LOW/MED/HIGH   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 5. generateInterpretation()        │
│    → Règles IF/ELSE                │
│    → Génération textuelle          │
│    → Scénarios + Recommandations   │
└─────────────────────────────────────┘
    ↓
Response JSON
```

---

## 🔑 Points Clés de l'Approche

### 1. **Déterminisme Total**
- Aucune probabilité générée par IA
- Tous les calculs sont mathématiques
- Toutes les interprétations sont basées sur des seuils fixes

### 2. **Sources Uniques : Unusual Whales**
- Pas de dépendance à FMP (évite les limites de quota)
- Cohérence des données (même source pour tout)
- Fallbacks multiples pour la robustesse

### 3. **Interprétation Contextuelle**
- Les keyPoints sont générés dynamiquement selon les valeurs
- Les scénarios sont basés sur des conditions réelles
- Les recommandations suivent une matrice de décision

### 4. **Lien Direct avec les Expirations**
- Le volume est calculé par expiration
- La date d'expiration est explicitement mentionnée
- Fait le lien avec l'analyse des options flow

---

## 📊 Exemple de Calcul Complet

### Input
```json
{
  "ticker": "NVDA",
  "darkPoolLimit": 100,
  "optionsLimit": 200,
  "minPremium": 50000,
  "expiryFilter": "2026-01-16"
}
```

### Processus

1. **Prix Actuel** : $186.54 (depuis Stock State UW)

2. **Support Dark Pool** :
   - 100 transactions Dark Pool analysées
   - Moyenne pondérée : $186.53
   - Calcul : `Σ(Prix × Volume) / Σ(Volume)`

3. **Objectif d'Expiration** :
   - Flow alerts filtrées pour le 16 janvier 2026
   - Strike moyen pondéré : $187.80
   - Volume total : $2.45 millions
   - Calcul : `Σ(Strike × Premium) / Σ(Premium)`

4. **Risque de Liquidation** :
   - Distance : `|186.54 - 186.53| / 186.53 = 0.005%`
   - Classification : **HIGH** (distance < 0.5%)

5. **Interprétation** :
   - Summary : "Le prix de NVDA converge avec le support institutionnel..."
   - KeyPoints : ["Volume de $2.45 millions concentré sur l'expiration du 16 janvier 2026", ...]
   - Scenarios : [{"label": "Liquidation en cascade", "probability": "high", ...}]
   - Recommendation : "caution"

### Output
```json
{
  "success": true,
  "analysis": {
    "ticker": "NVDA",
    "currentPrice": 186.54,
    "whaleSupport": 186.53,
    "targetStrike": 187.80,
    "liquidationRisk": "HIGH",
    "isWhaleInProfit": true,
    "priceDistanceFromSupport": 0.0048,
    "priceDistanceFromTarget": -0.67,
    "interpretation": {
      "summary": "...",
      "keyPoints": [
        "Volume de $2.45 millions concentré sur l'expiration du 16 janvier 2026.",
        "..."
      ],
      "scenarios": [...],
      "recommendation": "caution"
    }
  }
}
```

---

## 🎨 Avantages de cette Approche

### 1. **Performance**
- Pas de latence IA (calculs instantanés)
- Pas de coût d'API OpenAI
- Réponses en < 1 seconde

### 2. **Fiabilité**
- Résultats reproductibles
- Pas de "hallucinations" IA
- Logique explicite et auditable

### 3. **Maintenabilité**
- Règles faciles à modifier
- Pas de prompt engineering
- Tests unitaires simples

### 4. **Transparence**
- L'utilisateur comprend d'où viennent les calculs
- Les seuils sont explicites
- Pas de boîte noire IA

---

## 🔄 Évolutions Possibles

### Court Terme
- Ajouter plus de scénarios selon les patterns détectés
- Enrichir les keyPoints avec des métriques supplémentaires
- Ajouter des alertes push si risque HIGH détecté

### Moyen Terme
- Historique des convergences (tendances)
- Comparaison avec d'autres tickers
- Intégration avec d'autres services (gamma squeeze, etc.)

### Long Terme
- Machine Learning pour optimiser les seuils (optionnel)
- Prédiction de probabilité de liquidation (basée sur historique)
- Alertes automatiques multi-tickers

---

## 📝 Résumé en 3 Points

1. **Calculs Mathématiques Purs** : Moyennes pondérées, distances, seuils fixes
2. **Sources Uniques** : Uniquement Unusual Whales (pas FMP, pas d'IA)
3. **Interprétation Déterministe** : Règles IF/ELSE pour générer du texte contextuel

**Résultat** : Un service rapide, fiable, et transparent qui transforme des données brutes en insights actionnables.

