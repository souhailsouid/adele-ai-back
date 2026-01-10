# 🎯 Market Pulse Features - API Plus Intuitive

## 📋 Nouvelles Fonctionnalités

### 1. ✅ Comparaison avec autres funds

**Endpoint**: `GET /ticker/{ticker}/funds/changes`

**Exemple**: "Bridgewater aussi a vendu AAPL?"

```bash
GET /ticker/AAPL/funds/changes?days=30&min_change_pct=10
```

**Réponse**:
```json
[
  {
    "ticker": "AAPL",
    "action": "decrease",
    "fund_id": 32,
    "fund_name": "Scion Asset Management",
    "shares_old": 100000,
    "shares_new": 50000,
    "diff_shares": -50000,
    "diff_shares_pct": -50,
    "filing_date": "2025-11-03",
    "filing_id": 273
  },
  {
    "ticker": "AAPL",
    "action": "exit",
    "fund_id": 25,
    "fund_name": "Bridgewater Associates",
    "shares_old": 200000,
    "shares_new": 0,
    "diff_shares": -200000,
    "diff_shares_pct": null,
    "filing_date": "2025-11-03",
    "filing_id": 251
  }
]
```

**Query Params**:
- `days` (optionnel): Nombre de jours à regarder (défaut: 30)
- `min_change_pct` (optionnel): Pourcentage minimum de changement (défaut: inclut tous)

**Utilité**: 
- ✅ Voir quels funds ont vendu/acheté un ticker spécifique
- ✅ Détecter des tendances ("Plusieurs funds vendent AAPL...")
- ✅ Comparer les actions d'un fund avec d'autres

---

### 2. ✅ Market Pulse Banner Global

**Endpoint**: `GET /market/pulse`

**Exemple**: Banner global avec tendances sectorielles

```bash
GET /market/pulse?days=30
```

**Réponse**:
```json
{
  "global_trends": {
    "total_new_positions": 45,
    "total_exits": 12,
    "total_increases": 89,
    "total_decreases": 67,
    "active_funds": 25
  },
  "sector_trends": [
    {
      "sector": "Technology",
      "net_buys": 23,
      "net_sells": 15,
      "total_funds": 12,
      "top_tickers": [
        {
          "ticker": "AAPL",
          "net_change": 500000,
          "funds_count": 5
        }
      ]
    }
  ],
  "top_changes": [
    {
      "ticker": "AAPL",
      "action": "exit",
      "fund_name": "Bridgewater Associates",
      "diff_shares_pct": null,
      "filing_date": "2025-11-03"
    },
    {
      "ticker": "NVDA",
      "action": "increase",
      "fund_name": "Scion Asset Management",
      "diff_shares_pct": 75.5,
      "filing_date": "2025-11-03"
    }
  ],
  "period_start": "2025-10-04",
  "period_end": "2025-11-03"
}
```

**Query Params**:
- `days` (optionnel): Nombre de jours à analyser (défaut: 30)

**Utilité**:
- ✅ Vue d'ensemble des tendances du marché
- ✅ Top changements les plus importants
- ✅ Tendances sectorielles (à venir : mapping ticker->sector)
- ✅ Perfect pour un banner en haut de page

---

### 3. ✅ Pulse Feed avec Filtres Interactifs

**Endpoint**: `GET /market/pulse-feed`

**Exemple**: Feed filtré par ticker, secteur, période

```bash
# Tous les changements récents
GET /market/pulse-feed?days=30&min_change_pct=10&limit=50

# Filtrer par ticker
GET /market/pulse-feed?ticker=AAPL&days=30

# Filtrer par secteur (à venir : nécessite mapping ticker->sector)
GET /market/pulse-feed?sector=Technology&days=30

# Changements significatifs seulement
GET /market/pulse-feed?min_change_pct=20&limit=20
```

**Réponse**:
```json
[
  {
    "id": "diff-123",
    "type": "ticker_change",
    "ticker": "AAPL",
    "fund_id": 32,
    "fund_name": "Scion Asset Management",
    "action": "exit",
    "diff_shares": -200000,
    "diff_shares_pct": null,
    "filing_date": "2025-11-03",
    "timestamp": "2025-11-03T17:00:00Z",
    "importance": "critical"
  },
  {
    "id": "diff-124",
    "type": "ticker_change",
    "ticker": "NVDA",
    "fund_id": 32,
    "fund_name": "Scion Asset Management",
    "action": "increase",
    "diff_shares": 150000,
    "diff_shares_pct": 75.5,
    "filing_date": "2025-11-03",
    "timestamp": "2025-11-03T17:00:00Z",
    "importance": "high"
  }
]
```

**Query Params**:
- `ticker` (optionnel): Filtrer par ticker spécifique
- `sector` (optionnel): Filtrer par secteur (à venir)
- `days` (optionnel): Nombre de jours à regarder (défaut: 30)
- `min_change_pct` (optionnel): Pourcentage minimum de changement (défaut: 10)
- `limit` (optionnel): Nombre de résultats (défaut: 100)

**Niveaux d'importance**:
- `critical`: Exit (sortie complète)
- `high`: New position ou changement ≥50%
- `medium`: Changement ≥20%
- `low`: Autres changements

**Utilité**:
- ✅ Feed interactif pour afficher les changements en temps réel
- ✅ Filtres multiples pour personnaliser la vue
- ✅ Importance pour prioriser les alertes
- ✅ Perfect pour une timeline/liste de changements

---

## 🚀 Utilisation Frontend

### Exemple 1: Banner Market Pulse

```typescript
// Récupérer le pulse global
const pulse = await fetch('/market/pulse?days=30');
const data = await pulse.json();

// Afficher dans un banner
<MarketPulseBanner>
  <Stats>
    <Stat label="Nouvelles positions" value={data.global_trends.total_new_positions} />
    <Stat label="Sorties" value={data.global_trends.total_exits} />
    <Stat label="Funds actifs" value={data.global_trends.active_funds} />
  </Stats>
  <TopChanges items={data.top_changes} />
</MarketPulseBanner>
```

### Exemple 2: Comparaison Funds ("Bridgewater aussi a vendu AAPL?")

```typescript
// Quand un fund vend AAPL, afficher les autres funds qui ont aussi vendu
const changes = await fetch(`/ticker/AAPL/funds/changes?days=30&min_change_pct=10`);
const data = await changes.json();

// Filtrer les autres funds (exclure le fund courant)
const otherFunds = data.filter(change => change.fund_id !== currentFundId);

// Afficher
<ComparisonCard>
  <Title>Autres funds qui ont vendu AAPL</Title>
  {otherFunds.map(change => (
    <FundChange 
      fundName={change.fund_name}
      action={change.action}
      diffPct={change.diff_shares_pct}
    />
  ))}
</ComparisonCard>
```

### Exemple 3: Pulse Feed avec Filtres

```typescript
// Feed avec filtres interactifs
const [filters, setFilters] = useState({
  ticker: '',
  sector: '',
  days: 30,
  minChangePct: 10,
});

const feed = await fetch(`/market/pulse-feed?${new URLSearchParams(filters)}`);
const items = await feed.json();

// Afficher le feed
<PulseFeed>
  <Filters onChange={setFilters} />
  {items.map(item => (
    <FeedItem 
      key={item.id}
      importance={item.importance}
      ticker={item.ticker}
      fundName={item.fund_name}
      action={item.action}
      diffPct={item.diff_shares_pct}
      timestamp={item.timestamp}
    />
  ))}
</PulseFeed>
```

---

## 📊 Améliorations Futures

### 1. Mapping Ticker -> Secteur

Pour activer les filtres sectoriels dans `/market/pulse` et `/market/pulse-feed`, il faudrait :
- Ajouter une table `ticker_sectors` ou utiliser une API externe (FMP, Yahoo Finance)
- Mapper chaque ticker à son secteur
- Agréger les changements par secteur

### 2. Tendances Sectorielles Détaillées

Améliorer `/market/pulse` pour inclure :
- Net buys/sells par secteur
- Top tickers par secteur
- Rotation sectorielle (sortie d'un secteur, entrée dans un autre)

### 3. Alertes Intelligentes

Utiliser les niveaux d'importance pour :
- Notifications push pour les changements `critical`
- Daily digest avec les changements `high` et `medium`
- Dashboard avec filtres par importance

---

## ✅ État d'Implémentation

| Fonctionnalité | État | Endpoint |
|----------------|------|----------|
| Comparaison funds par ticker | ✅ Implémenté | `/ticker/{ticker}/funds/changes` |
| Market Pulse global | ✅ Implémenté | `/market/pulse` |
| Pulse Feed avec filtres | ✅ Implémenté | `/market/pulse-feed` |
| Filtres par ticker | ✅ Implémenté | Query param `ticker` |
| Filtres par secteur | ⚠️ Structure prête | Nécessite mapping ticker->sector |
| Filtres par période | ✅ Implémenté | Query param `days` |
| Niveaux d'importance | ✅ Implémenté | Champ `importance` |

---

## 🚀 Prochaines Étapes

1. **Bundler et déployer** :
   ```bash
   cd services/api && npm run bundle
   cd infra/terraform && terraform apply
   ```

2. **Tester les endpoints** :
   ```bash
   curl "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/ticker/AAPL/funds/changes?days=30"
   curl "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/market/pulse?days=30"
   curl "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/market/pulse-feed?days=30&limit=20"
   ```

3. **Intégrer dans le frontend** (exemples TypeScript ci-dessus)

4. **Améliorer les tendances sectorielles** (mapping ticker->sector)
