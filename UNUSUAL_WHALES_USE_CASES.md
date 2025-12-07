# Unusual Whales API - Cas d'usage et fonctionnalités

## 🎯 Qu'est-ce que l'API Unusual Whales ?

L'API Unusual Whales est une source de données **en temps réel** sur l'activité des marchés financiers, spécialement conçue pour identifier les **mouvements inhabituels** et les **opportunités de trading** basées sur l'activité des institutions, des insiders, et du flow d'options.

---

## 💡 Intérêt principal

### 1. **Détection précoce des mouvements de prix**

L'API permet d'identifier **avant le grand public** :
- ✅ **Options flow inhabituel** : Gros volumes de calls/puts qui précèdent souvent des mouvements de prix
- ✅ **Dark pool trades** : Transactions institutionnelles cachées qui indiquent des intentions
- ✅ **Activité des insiders** : Transactions des dirigeants qui peuvent prédire des événements
- ✅ **Activité du Congrès** : Trading des membres du Congrès américain (souvent bien informés)

### 2. **Analyse institutionnelle avancée**

- **Tracking des hedge funds** : Voir où investissent les meilleurs gestionnaires
- **13F filings en temps réel** : Holdings institutionnels actualisés
- **Activité sectorielle** : Comprendre les rotations sectorielles

### 3. **Intelligence sur les options**

- **Greeks en temps réel** : Delta, Gamma, Theta, Vega
- **Max Pain** : Niveau de prix où le maximum d'options expire sans valeur
- **Flow par strike/expiry** : Identifier les niveaux de prix ciblés
- **GEX (Gamma Exposure)** : Impact des options sur le prix du sous-jacent

---

## 🚀 Fonctionnalités que vous pouvez mettre en place

### 1. **Dashboard de surveillance en temps réel**

#### Alertes personnalisées
```typescript
// Exemple : Alertes sur gros volumes d'options
GET /unusual-whales/alerts?config_ids[]=123&noti_types[]=unusual_volume

// Cas d'usage :
- Alertes sur volumes d'options > 10x la moyenne
- Alertes sur dark pool trades > $10M
- Alertes sur transactions insiders > $1M
```

#### Flow d'options en direct
```typescript
// Flow récent pour un ticker
GET /unusual-whales/stock/{ticker}/flow-recent?min_premium=100000

// Cas d'usage :
- Identifier les "smart money" qui achètent des calls/puts
- Détecter les "sweeps" (achats multiples de contrats)
- Surveiller les "unusual activity" (volumes anormaux)
```

### 2. **Analyse prédictive de prix**

#### Max Pain Analysis
```typescript
GET /unusual-whales/stock/{ticker}/max-pain

// Cas d'usage :
- Prédire où le prix va se stabiliser à l'expiration
- Identifier les niveaux de support/résistance basés sur les options
- Anticiper les "pinning" (prix collé à un strike)
```

#### Greeks Analysis
```typescript
GET /unusual-whales/stock/{ticker}/greeks?expiry=2025-12-20

// Cas d'usage :
- Calculer la sensibilité du prix aux mouvements (Delta)
- Identifier les niveaux de volatilité implicite élevée
- Prédire l'impact des options sur le prix (Gamma squeeze)
```

### 3. **Tracking des "Smart Money"**

#### Suivi des institutions
```typescript
// Holdings d'une institution spécifique
GET /unusual-whales/institution/{name}/holdings?order=value&order_direction=desc

// Cas d'usage :
- Suivre les top 10 institutions par performance
- Identifier les nouvelles positions des hedge funds
- Détecter les rotations de portefeuille
```

#### Activité des insiders
```typescript
// Transactions récentes des dirigeants
GET /unusual-whales/insider/transactions?ticker=NVDA&transaction_codes[]=P

// Cas d'usage :
- Alertes sur achats massifs d'insiders (signe bullish)
- Détecter les ventes avant mauvaises nouvelles
- Suivre les patterns de trading des CEO/CFO
```

### 4. **Analyse de marché globale**

#### Market Tide
```typescript
GET /unusual-whales/market/market-tide

// Cas d'usage :
- Identifier si le marché est en mode "risk-on" ou "risk-off"
- Détecter les rotations sectorielles
- Comprendre le sentiment global du marché
```

#### Sector Analysis
```typescript
// Flow par secteur
GET /unusual-whales/market/{sector}/sector-tide

// Cas d'usage :
- Identifier les secteurs en forte demande
- Détecter les rotations sectorielles avant qu'elles ne soient visibles
- Construire des stratégies sectorielles
```

### 5. **Système d'alertes intelligent**

#### Configuration d'alertes
```typescript
// Créer des alertes personnalisées
GET /unusual-whales/alerts/configuration

// Cas d'usage :
- Alertes sur "unusual options activity" pour vos tickers favoris
- Notifications sur dark pool trades > seuil
- Alertes sur transactions du Congrès
- Alertes sur earnings surprises
```

### 6. **Analyse de short interest**

#### Short Data
```typescript
GET /unusual-whales/shorts/{ticker}/interest-float

// Cas d'usage :
- Identifier les actions avec short interest élevé (potentiel squeeze)
- Calculer les "days to cover" (combien de jours pour couvrir les shorts)
- Détecter les "short squeezes" en formation
```

### 7. **Analyse de saisonnalité**

#### Seasonality Analysis
```typescript
GET /unusual-whales/seasonality/{ticker}/monthly

// Cas d'usage :
- Identifier les patterns saisonniers (ex: tech en fin d'année)
- Prédire les meilleurs mois pour acheter/vendre
- Construire des stratégies basées sur l'historique
```

### 8. **Screening avancé**

#### Stock Screener
```typescript
GET /unusual-whales/screener/stocks?min_volume=1000000&min_premium=50000

// Cas d'usage :
- Trouver les actions avec activité d'options inhabituelle
- Identifier les "hot stocks" du moment
- Détecter les opportunités avant qu'elles ne soient mainstream
```

#### Analyst Ratings Screener
```typescript
GET /unusual-whales/screener/analysts?rating=strong_buy

// Cas d'usage :
- Trouver les actions avec upgrades récents
- Identifier les consensus de marché
- Détecter les changements d'opinion des analystes
```

---

## 📊 Cas d'usage concrets

### Cas d'usage 1 : Détection de "Gamma Squeeze"

**Problème** : Identifier quand une action peut subir un "gamma squeeze" (hausse rapide due aux options)

**Solution** :
```typescript
// 1. Vérifier le GEX (Gamma Exposure)
GET /unusual-whales/stock/{ticker}/spot-exposures

// 2. Vérifier le flow d'options (beaucoup de calls achetés)
GET /unusual-whales/stock/{ticker}/flow-recent?min_premium=100000

// 3. Vérifier le short interest (combustible pour le squeeze)
GET /unusual-whales/shorts/{ticker}/interest-float

// Si :
// - GEX élevé (beaucoup de gamma)
// - Flow de calls très positif
// - Short interest élevé
// → Potentiel gamma squeeze !
```

### Cas d'usage 2 : Suivi des "Smart Money"

**Problème** : Suivre les meilleurs hedge funds pour copier leurs trades

**Solution** :
```typescript
// 1. Identifier les top hedge funds
GET /unusual-whales/institutions?order=value&order_direction=desc

// 2. Voir leurs dernières activités
GET /unusual-whales/institution/{name}/activity?limit=50

// 3. Filtrer par ticker d'intérêt
// → Voir quels hedge funds achètent/vendent vos tickers
```

### Cas d'usage 3 : Prédiction d'earnings

**Problème** : Anticiper les surprises d'earnings avant l'annonce

**Solution** :
```typescript
// 1. Vérifier l'activité d'options avant earnings
GET /unusual-whales/stock/{ticker}/flow-recent?min_premium=50000

// 2. Vérifier les transactions d'insiders
GET /unusual-whales/insider/{ticker}?transaction_codes[]=P

// 3. Vérifier le sentiment via les analystes
GET /unusual-whales/screener/analysts?ticker={ticker}

// Si :
// - Beaucoup de calls achetés avant earnings → Potentiel beat
// - Insiders achètent → Signe positif
// - Upgrades récents → Sentiment positif
```

### Cas d'usage 4 : Détection de manipulation

**Problème** : Identifier les manipulations de marché

**Solution** :
```typescript
// 1. Vérifier les dark pool trades (transactions cachées)
GET /unusual-whales/dark-pool/{ticker}?limit=100

// 2. Vérifier l'activité d'options (sweeps suspects)
GET /unusual-whales/stock/{ticker}/flow-recent?min_premium=100000

// 3. Vérifier les transactions du Congrès (information privilégiée)
GET /unusual-whales/congress-trades/{ticker}

// Si :
// - Dark pool trades massifs avant un mouvement
// - Options flow suspect
// - Transactions du Congrès suspectes
// → Potentielle manipulation
```

### Cas d'usage 5 : Trading basé sur les ETF flows

**Problème** : Identifier les rotations sectorielles via les ETF

**Solution** :
```typescript
// 1. Voir quels ETFs contiennent un ticker
GET /unusual-whales/etfs/{ticker}/exposure

// 2. Vérifier les inflows/outflows des ETFs
GET /unusual-whales/etfs/{ticker}/in-outflow

// 3. Vérifier le sector tide
GET /unusual-whales/market/{sector}/sector-tide

// Si :
// - Fort inflow dans les ETFs tech → Secteur en hausse
// - Outflow massif → Rotation sectorielle
```

---

## 🎨 Fonctionnalités avancées possibles

### 1. **Système de scoring automatique**

Créer un score composite basé sur :
- Flow d'options (positif = bullish)
- Activité des insiders (achats = bullish)
- Dark pool trades (volumes élevés = institutionnel)
- Short interest (élevé = potentiel squeeze)
- Greeks (gamma élevé = volatilité)

**Score final** : 0-100 (0 = très bearish, 100 = très bullish)

### 2. **Prédiction de prix basée sur Max Pain**

Utiliser le Max Pain pour prédire où le prix va se stabiliser :
- Si prix actuel < Max Pain → Tendance haussière
- Si prix actuel > Max Pain → Tendance baissière
- Si prix ≈ Max Pain → Consolidation

### 3. **Alertes intelligentes multi-signaux**

Créer des alertes qui se déclenchent seulement si **plusieurs signaux** sont alignés :
- Exemple : "Alerte si : Options flow positif + Insiders achètent + Dark pool trades élevés"

### 4. **Backtesting de stratégies**

Utiliser les données historiques pour tester des stratégies :
- "Si j'avais acheté quand le flow d'options était > X, quel aurait été le retour ?"
- "Les alertes d'insiders sont-elles prédictives ?"

### 5. **Dashboard de corrélations**

Identifier les corrélations entre :
- Flow d'options et mouvements de prix
- Dark pool trades et volatilité
- Activité des insiders et performance

### 6. **Système de recommandations**

Basé sur l'analyse de tous les signaux :
- "NVDA : Fort flow de calls + Insiders achètent → Recommandation : ACHAT"
- "TSLA : Short interest élevé + Flow de puts → Recommandation : ATTENTION"

---

## 🔥 Avantages compétitifs

### 1. **Données exclusives**
- Dark pool trades (non disponibles publiquement)
- Flow d'options en temps réel
- Transactions du Congrès

### 2. **Temps réel**
- Données mises à jour en continu
- Alertes instantanées
- Pas de délai

### 3. **Complémentarité avec FMP**
- FMP = Données fondamentales (financials, earnings)
- Unusual Whales = Données de marché (flow, sentiment)
- **Combinaison = Vision complète**

---

## 📈 Métriques clés à surveiller

### Pour chaque ticker :
1. **Options Flow Ratio** : Calls vs Puts (ratio > 1 = bullish)
2. **Put/Call Ratio** : Inverse (ratio < 1 = bullish)
3. **Max Pain** : Niveau de prix cible
4. **GEX** : Impact des options sur le prix
5. **Short Interest %** : Pourcentage du float shorté
6. **Days to Cover** : Combien de jours pour couvrir les shorts
7. **Insider Activity** : Net buys vs sells
8. **Dark Pool Volume** : Volume des transactions cachées

---

## 🛠️ Architecture recommandée

### 1. **Service de surveillance continue**
```typescript
// Service qui surveille en continu vos tickers favoris
class TickerSurveillanceService {
  async watchTicker(ticker: string) {
    // Vérifier toutes les 5 minutes :
    // - Flow d'options
    // - Dark pool trades
    // - Activité des insiders
    // - Short interest
    // → Générer des alertes si seuils dépassés
  }
}
```

### 2. **Système d'alertes multi-niveaux**
```typescript
// Alertes par niveau de criticité
enum AlertLevel {
  INFO = "info",      // Flow normal mais intéressant
  WARNING = "warning", // Activité inhabituelle
  CRITICAL = "critical" // Signal fort (ex: gros dark pool trade)
}
```

### 3. **Dashboard de visualisation**
- Graphiques de flow d'options en temps réel
- Heatmap des dark pool trades
- Timeline des transactions d'insiders
- Graphique de Max Pain vs Prix actuel

---

## 💼 Business Value

### Pour les traders :
- ✅ **Edge informationnel** : Voir ce que les institutions font avant le grand public
- ✅ **Meilleure timing** : Entrer/sortir au bon moment
- ✅ **Réduction des risques** : Éviter les pièges (ex: short squeezes)

### Pour les investisseurs :
- ✅ **Due diligence avancée** : Analyser l'activité institutionnelle avant d'investir
- ✅ **Suivi de portefeuille** : Surveiller les positions existantes
- ✅ **Découverte d'opportunités** : Trouver de nouvelles idées d'investissement

### Pour les analystes :
- ✅ **Données exclusives** : Accès à des données non publiques
- ✅ **Analyse quantitative** : Données structurées pour modèles
- ✅ **Backtesting** : Tester des hypothèses sur données historiques

---

## 🎯 Prochaines étapes recommandées

1. **Implémenter un système d'alertes personnalisées**
   - Permettre aux utilisateurs de créer leurs propres alertes
   - Notifications push/email/SMS

2. **Créer un dashboard de visualisation**
   - Graphiques de flow d'options
   - Heatmaps de dark pool trades
   - Timeline des événements

3. **Développer un système de scoring**
   - Score composite basé sur tous les signaux
   - Recommandations automatiques

4. **Backtesting engine**
   - Tester des stratégies sur données historiques
   - Mesurer la performance des signaux

5. **API de recommandations**
   - Endpoint qui retourne des recommandations basées sur l'analyse
   - Ex: `/recommendations/{ticker}` → "BUY", "SELL", "HOLD" avec justification

---

## 📚 Ressources

- **Documentation API** : https://api.unusualwhales.com/docs
- **Types TypeScript** : `services/api/src/types/unusual-whales/`
- **Endpoints disponibles** : 118+ endpoints implémentés

---

**Dernière mise à jour** : 2025-12-05

