# Flow Options Analysis - Architecture avec Ingestion

## 🎯 Vue d'ensemble

La fonctionnalité d'analyse de flow options a été adaptée pour utiliser l'architecture d'ingestion → lecture depuis la DB, évitant ainsi les cold starts et les latences API.

## 📊 Architecture

### 1. Ingestion (Couche A)

**Objectif** : Injecter les flow alerts depuis l'API Unusual Whales dans la base de données

**Table** : `flow_alerts`
- Stocke les flow alerts de l'endpoint `option-trades/flow-alerts`
- Structure optimisée pour les requêtes d'analyse
- Index sur `ticker`, `data_date`, `created_at`, `total_premium`

**Module** : `flow_alerts` (ajouté dans `analysis_catalog`)
- TTL : 0.5h (données très dynamiques)
- Freshness threshold : 0.1h (10 minutes)

### 2. Analyse (Couche B)

**Route** : `POST /ai/flow-options-analysis-pro`

**Deux modes d'utilisation** :

#### Mode 1 : Lecture depuis la DB (Recommandé) ✅

```json
POST /ai/flow-options-analysis-pro
{
  "ticker": "MSFT",
  "limit": 10,
  "min_premium": 50000,
  "context": {
    "days_to_earnings": 5,
    "price_trend": "up"
  }
}
```

**Avantages** :
- ✅ Pas de cold start API
- ✅ Latence réduite (lecture DB < 100ms)
- ✅ Données déjà normalisées
- ✅ Pas de limite de rate API

#### Mode 2 : Direct (Signals fournis)

```json
POST /ai/flow-options-analysis-pro
{
  "signals": [
    {
      "ticker": "MSFT",
      "type": "call",
      "strike": "375",
      "expiry": "2023-12-22",
      "total_premium": 186705,
      ...
    }
  ],
  "context": { ... }
}
```

**Utilisation** : Quand vous avez déjà les données en mémoire (ex: depuis un autre endpoint)

## 🔄 Flux de données

### Scénario 1 : Premier appel (données non ingérées)

1. **Client** : `POST /ai/flow-options-analysis-pro` avec `ticker=MSFT`
2. **Backend** : Vérifie la DB → Aucune donnée trouvée
3. **Backend** : Retourne un message suggérant l'ingestion
4. **Client** : `POST /ingest/flow-alerts?ticker=MSFT` (à créer)
5. **Backend** : Appelle l'API UW, stocke dans `flow_alerts`
6. **Client** : Relance `POST /ai/flow-options-analysis-pro` avec `ticker=MSFT`
7. **Backend** : Lit depuis la DB → Analyse → Retourne le résultat

### Scénario 2 : Données déjà ingérées (cas normal)

1. **Client** : `POST /ai/flow-options-analysis-pro` avec `ticker=MSFT`
2. **Backend** : Lit depuis `flow_alerts` (très rapide)
3. **Backend** : Analyse avec LLM
4. **Backend** : Retourne le résultat

## 🛠️ Route d'ingestion (À créer)

Pour compléter l'architecture, il faut créer la route d'ingestion :

```typescript
// POST /ingest/flow-alerts?ticker=MSFT&limit=50
{
  method: 'POST',
  path: '/ingest/flow-alerts',
  handler: async (event) => {
    const ticker = getQueryParam(event, 'ticker');
    const limit = parseInt(getQueryParam(event, 'limit') || '50', 10);
    
    // 1. Appeler l'API UW
    const flowAlerts = await uw.getUWOptionTradeFlowAlerts({
      ticker_symbol: ticker,
      limit,
      min_premium: 10000,
    });
    
    // 2. Transformer et stocker dans flow_alerts
    const records = flowAlerts.data.map(alert => ({
      ticker: alert.ticker,
      alert_rule: alert.alert_rule,
      type: alert.type,
      strike: alert.strike,
      expiry: alert.expiry,
      option_chain: alert.option_chain,
      total_premium: parseFloat(alert.total_premium) || null,
      total_size: parseInt(alert.total_size) || null,
      trade_count: parseInt(alert.trade_count) || null,
      volume: parseInt(alert.volume) || null,
      open_interest: parseInt(alert.open_interest) || null,
      volume_oi_ratio: parseFloat(alert.volume_oi_ratio) || null,
      underlying_price: parseFloat(alert.underlying_price) || null,
      total_ask_side_prem: parseFloat(alert.total_ask_side_prem) || null,
      total_bid_side_prem: parseFloat(alert.total_bid_side_prem) || null,
      price: parseFloat(alert.price) || null,
      all_opening_trades: alert.all_opening_trades,
      has_floor: alert.has_floor,
      has_sweep: alert.has_sweep,
      has_multileg: alert.has_multileg,
      has_singleleg: alert.has_singleleg,
      expiry_count: alert.expiry_count,
      issue_type: alert.issue_type,
      created_at: alert.created_at,
      data: alert, // Données brutes complètes
      data_date: new Date().toISOString().split('T')[0],
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
    }));
    
    // 3. Upsert dans flow_alerts
    const { error } = await supabase
      .from('flow_alerts')
      .upsert(records, { onConflict: 'ticker,strike,expiry,created_at' });
    
    if (error) {
      throw new Error(`Failed to store flow alerts: ${error.message}`);
    }
    
    // 4. Mettre à jour ticker_data_modules
    await supabase
      .from('ticker_data_modules')
      .upsert({
        ticker,
        module_id: 'flow_alerts',
        status: 'ready',
        fetched_at: new Date().toISOString(),
        data_date: new Date().toISOString().split('T')[0],
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      }, { onConflict: 'ticker,module_id' });
    
    return {
      success: true,
      ticker,
      count: records.length,
      timestamp: new Date().toISOString(),
    };
  },
}
```

## 📋 Migration SQL

La migration `016_flow_alerts_ingestion.sql` a été créée avec :
- Table `flow_alerts` avec tous les champs nécessaires
- Index optimisés pour les requêtes d'analyse
- Module `flow_alerts` ajouté au catalogue

## ✅ Terraform

La route a été ajoutée dans `api-ai-analyst-routes.tf` :
- `POST /ai/flow-options-analysis-pro` avec authentification JWT

## 🚀 Utilisation recommandée

### Workflow optimal

1. **Ingestion périodique** (cron job ou EventBridge) :
   ```bash
   POST /ingest/flow-alerts?ticker=MSFT&limit=50
   ```

2. **Analyse à la demande** (frontend) :
   ```bash
   POST /ai/flow-options-analysis-pro
   {
     "ticker": "MSFT",
     "limit": 10,
     "min_premium": 50000
   }
   ```

### Avantages

- ⚡ **Performance** : Lecture DB < 100ms vs API call 500-2000ms
- 🔄 **Fiabilité** : Pas de dépendance à l'API UW au moment de l'analyse
- 💰 **Coûts** : Moins d'appels API = moins de coûts
- 🎯 **Scalabilité** : La DB peut servir plusieurs requêtes simultanées

## 📝 Notes

- Les données sont mises en cache avec un TTL de 30 minutes
- La route d'analyse vérifie automatiquement si les données sont expirées
- Si aucune donnée n'est trouvée, un message suggère l'ingestion
- Le mode direct (signals fournis) reste disponible pour les cas spéciaux

