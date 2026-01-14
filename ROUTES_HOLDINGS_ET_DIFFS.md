# 📊 Routes : Holdings et Différences entre Filings

## 🎯 Réponse à votre question

Pour répondre à vos 3 besoins :
1. ✅ **Récupérer la liste des actions détenues** (ex: Scion possède 100,000 actions de $LULU)
2. ✅ **Calculer la valeur totale** (Prix × Quantité = `market_value`)
3. ✅ **Déterminer si nouvelle/renforcée/réduite/fermée** par rapport au trimestre précédent

### Route principale : **`GET /funds/{id}/diffs`**

Cette route fait **TOUT** ce que vous demandez :

```typescript
GET /funds/{id}/diffs?limit=50
```

**Retourne** :
```json
[
  {
    "ticker": "LULU",
    "action": "increase",  // 'new' | 'exit' | 'increase' | 'decrease'
    "shares_old": 50000,
    "shares_new": 100000,  // ✅ 1. Liste des actions détenues
    "diff_shares": 50000,
    "diff_shares_pct": 100.0,
    "value_old": 5000000,  // ✅ 2. Valeur totale (Prix × Quantité)
    "value_new": 10000000,
    "diff_value": 5000000,
    "diff_value_pct": 100.0,
    "filing_id_new": 123,
    "filing_id_old": 122,
    "filing_date_new": "2024-09-30",
    "filing_date_old": "2024-06-30"
  }
]
```

---

## 📋 Toutes les routes disponibles

### 1. **GET /funds/{id}/holdings**
**Rôle** : Récupère les holdings du dernier filing parsé

**Fait** :
- ✅ Liste des actions détenues
- ✅ Valeur totale (`market_value` = Prix × Quantité)
- ❌ **Ne calcule PAS** les différences avec le trimestre précédent

**Exemple** :
```bash
GET /funds/32/holdings?limit=100
```

**Retourne** :
```json
[
  {
    "id": 1234,
    "ticker": "LULU",
    "shares": 100000,        // ✅ Quantité d'actions
    "market_value": 10000000, // ✅ Valeur totale (Prix × Quantité)
    "filing_id": 123,
    "fund_id": 32
  }
]
```

**Code** : ```579:589:services/api/src/funds.ts
export async function getFundHoldings(fundId: number, limit = 100) {
  const { data, error } = await supabase
    .from("fund_holdings")
    .select("*, fund_filings(filing_date)")
    .eq("fund_id", fundId)
    .order("market_value", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
```

---

### 2. **GET /funds/{id}/filings/{filingId}/holdings**
**Rôle** : Récupère les holdings d'un filing spécifique

**Fait** :
- ✅ Liste des actions détenues pour un filing donné
- ✅ Valeur totale (`market_value`)
- ✅ Total du portefeuille
- ❌ **Ne calcule PAS** les différences

**Exemple** :
```bash
GET /funds/32/filings/123/holdings?limit=1000
```

**Retourne** :
```json
{
  "filing": {
    "id": 123,
    "filing_date": "2024-09-30",
    "form_type": "13F-HR",
    "status": "PARSED"
  },
  "holdings": [
    {
      "ticker": "LULU",
      "shares": 100000,
      "market_value": 10000000
    }
  ],
  "total_holdings": 150,
  "total_market_value": 500000000
}
```

**Code** : ```623:658:services/api/src/funds.ts
export async function getFilingHoldings(fundId: number, filingId: number, limit = 1000) {
  // Vérifier que le filing appartient au fund
  const { data: filing, error: filingError } = await supabase
    .from("fund_filings")
    .select("id, status, filing_date, form_type")
    .eq("id", filingId)
    .eq("fund_id", fundId)
    .single();

  if (filingError || !filing) {
    throw new Error(`Filing ${filingId} not found for fund ${fundId}`);
  }

  // Récupérer les holdings
  const { data: holdings, error: holdingsError } = await supabase
    .from("fund_holdings")
    .select("*")
    .eq("filing_id", filingId)
    .eq("fund_id", fundId)
    .order("market_value", { ascending: false })
    .limit(limit);

  if (holdingsError) throw holdingsError;

  return {
    filing: {
      id: filing.id,
      filing_date: filing.filing_date,
      form_type: filing.form_type,
      status: filing.status,
    },
    holdings: holdings || [],
    total_holdings: holdings?.length || 0,
    total_market_value: holdings?.reduce((sum, h) => sum + (h.market_value || 0), 0) || 0,
  };
}
```

---

### 3. **GET /funds/{id}/diffs** ⭐ **RECOMMANDÉE**
**Rôle** : Calcule les différences entre deux filings (Q vs Q-1)

**Fait** :
- ✅ Liste des actions détenues (nouveau filing)
- ✅ Valeur totale (`value_new` = Prix × Quantité)
- ✅ **Calcule les différences** avec le trimestre précédent
- ✅ **Détermine l'action** : `new` | `exit` | `increase` | `decrease`

**Exemple** :
```bash
# Comparaison automatique (2 derniers filings)
GET /funds/32/diffs?limit=50

# Comparaison par dates
GET /funds/32/diffs?from_date=2024-06-30&to_date=2024-09-30

# Comparaison par trimestre
GET /funds/32/diffs?quarter=Q3-2024
```

**Retourne** :
```json
[
  {
    "ticker": "LULU",
    "action": "increase",      // ✅ 3. Détermination de l'action
    "shares_old": 50000,        // ✅ 1. Actions au trimestre précédent
    "shares_new": 100000,       // ✅ 1. Actions au trimestre actuel
    "diff_shares": 50000,
    "diff_shares_pct": 100.0,
    "value_old": 5000000,       // ✅ 2. Valeur totale (ancien)
    "value_new": 10000000,     // ✅ 2. Valeur totale (nouveau)
    "diff_value": 5000000,
    "diff_value_pct": 100.0,
    "filing_id_new": 123,
    "filing_id_old": 122,
    "filing_date_new": "2024-09-30",
    "filing_date_old": "2024-06-30"
  },
  {
    "ticker": "AAPL",
    "action": "new",            // Nouvelle position
    "shares_old": null,
    "shares_new": 50000,
    "value_old": null,
    "value_new": 7500000
  },
  {
    "ticker": "TSLA",
    "action": "exit",           // Position fermée
    "shares_old": 10000,
    "shares_new": 0,
    "value_old": 2500000,
    "value_new": 0
  }
]
```

**Code** : ```667:805:services/api/src/funds.ts
export async function getFundDiffs(
  fundId: number, 
  limit = 50,
  options?: {
    from_date?: string;  // Date du filing de référence (ancien) - format YYYY-MM-DD
    to_date?: string;     // Date du filing à comparer (nouveau) - format YYYY-MM-DD
    quarter?: string;     // Format: "Q1-2024" ou "2024-Q1"
    year?: number;        // Année pour comparaison annuelle
    compare_to?: string;  // Date de référence pour comparaison (si quarter ou year)
    ticker?: string;      // Filtrer par ticker spécifique
  }
) {
  // Si des dates ou périodes sont spécifiées, calculer le diff dynamiquement
  if (options?.from_date && options?.to_date) {
    // Calculer le diff entre deux dates spécifiques
    const { calculateFundDiff } = await import("./services/fund-diff.service");
    const result = await calculateFundDiff(fundId, undefined, {
      from_date: options.from_date,
      to_date: options.to_date,
    });
    return result.diffs;
  }

  // Si quarter/year est spécifié, convertir en dates
  if (options?.quarter || options?.year) {
    const { calculateFundDiff } = await import("./services/fund-diff.service");
    
    let fromDate: string | undefined;
    let toDate: string | undefined;

    if (options.quarter) {
      // Parser "Q1-2024" ou "2024-Q1"
      const match = options.quarter.match(/(?:Q(\d)-)?(\d{4})/);
      if (!match) throw new Error("Invalid quarter format. Use 'Q1-2024' or '2024-Q1'");
      
      const quarter = parseInt(match[1] || "1");
      const year = parseInt(match[2]);
      
      // Dates de début et fin du trimestre
      const quarterStartMonths = [0, 3, 6, 9]; // Jan, Apr, Jul, Oct
      const startMonth = quarterStartMonths[quarter - 1];
      const endMonth = startMonth + 2;
      
      // Date de fin du trimestre (dernier jour du trimestre)
      const endDate = new Date(year, endMonth + 1, 0); // Dernier jour du mois
      toDate = endDate.toISOString().split('T')[0];
      
      // Date de début du trimestre précédent (pour comparaison)
      const prevQuarter = quarter === 1 ? 4 : quarter - 1;
      const prevYear = quarter === 1 ? year - 1 : year;
      const prevStartMonth = quarterStartMonths[prevQuarter - 1];
      const prevEndMonth = prevStartMonth + 2;
      const prevEndDate = new Date(prevYear, prevEndMonth + 1, 0);
      fromDate = prevEndDate.toISOString().split('T')[0];
    } else if (options.year) {
      // Comparaison annuelle : fin de l'année vs fin de l'année précédente
      toDate = `${options.year}-12-31`;
      fromDate = `${options.year - 1}-12-31`;
    }

    if (fromDate && toDate) {
      const result = await calculateFundDiff(fundId, undefined, {
        from_date: fromDate,
        to_date: toDate,
      });
      // Filtrer par ticker si spécifié
      let diffs = result.diffs;
      if (options?.ticker) {
        diffs = diffs.filter(d => d.ticker?.toUpperCase() === options.ticker!.toUpperCase());
      }
      return diffs;
    }
  }

  // Par défaut : retourner les diffs calculés en base
  let query = supabase
    .from("fund_holdings_diff")
    .select(`
      *,
      filing_new:fund_filings!filing_id_new(filing_date, form_type),
      filing_old:fund_filings!filing_id_old(filing_date, form_type)
    `)
    .eq("fund_id", fundId);

  // Filtrer par ticker si spécifié
  if (options?.ticker) {
    query = query.eq("ticker", options.ticker.toUpperCase());
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  
  // Si aucun diff trouvé en base, calculer automatiquement entre les deux derniers filings
  if (!data || data.length === 0) {
    const { calculateFundDiff } = await import("./services/fund-diff.service");
    
    // Récupérer les deux derniers filings parsés
    const { data: filings, error: filingsError } = await supabase
      .from("fund_filings")
      .select("id, filing_date")
      .eq("fund_id", fundId)
      .eq("status", "PARSED")
      .order("filing_date", { ascending: false })
      .limit(2);
    
    if (filingsError) throw filingsError;
    
    // Si on a au moins 2 filings, calculer le diff entre les deux derniers
    if (filings && filings.length >= 2) {
      const latestFiling = filings[0];
      const previousFiling = filings[1];
      
      try {
        const result = await calculateFundDiff(fundId, latestFiling.id);
        
        // Filtrer par ticker si spécifié
        let diffs = result.diffs;
        if (options?.ticker) {
          diffs = diffs.filter(d => d.ticker?.toUpperCase() === options.ticker!.toUpperCase());
        }
        
        // Limiter les résultats
        return diffs.slice(0, limit);
      } catch (calcError: any) {
        // Si le calcul échoue, retourner un tableau vide plutôt que de throw
        console.error(`Error calculating diff for fund ${fundId}:`, calcError);
        return [];
      }
    }
    
    // Si moins de 2 filings, retourner un tableau vide
    return [];
  }
  
  return data;
}
```

**Logique de calcul** : ```44:220:services/api/src/services/fund-diff.service.ts
export async function calculateFundDiff(
  fundId: number,
  newFilingId?: number,
  options?: {
    from_date?: string;  // Date du filing de référence (ancien)
    to_date?: string;     // Date du filing à comparer (nouveau)
  }
): Promise<FundDiffSummary> {
  // 1. Récupérer le nouveau filing (soit par ID, soit par date)
  let newFiling: any = null;
  let actualNewFilingId: number | null = null;
  let actualNewFilingDate: string = '';

  if (options?.to_date) {
    // Trouver le filing le plus proche de to_date
    const { data: toFiling, error: toFilingError } = await supabase
      .from("fund_filings")
      .select("id, filing_date, fund_id, funds(name)")
      .eq("fund_id", fundId)
      .eq("status", "PARSED")
      .lte("filing_date", options.to_date)
      .order("filing_date", { ascending: false })
      .limit(1)
      .single();

    if (toFilingError || !toFiling) {
      throw new Error(`No filing found for date ${options.to_date}`);
    }

    newFiling = toFiling;
    actualNewFilingId = toFiling.id;
    actualNewFilingDate = toFiling.filing_date;
  } else if (newFilingId) {
    // Récupérer par ID
    const { data, error } = await supabase
      .from("fund_filings")
      .select("id, filing_date, fund_id, funds(name)")
      .eq("id", newFilingId)
      .single();

    if (error || !data) {
      throw new Error(`Filing ${newFilingId} not found`);
    }
    newFiling = data;
    actualNewFilingId = data.id;
    actualNewFilingDate = data.filing_date;
  } else {
    throw new Error("Either newFilingId or options.to_date must be provided");
  }

  const fundName = (newFiling?.funds as any)?.name || 'Unknown';

  // 3. Récupérer les holdings du nouveau filing
  const { data: newHoldings, error: newHoldingsError } = await supabase
    .from("fund_holdings")
    .select("ticker, shares, market_value")
    .eq("filing_id", actualNewFilingId)
    .eq("type", "stock"); // Seulement les actions, pas les options

  if (newHoldingsError) throw newHoldingsError;

  // 4. Trouver le filing précédent (le plus récent avant celui-ci)
  // Si from_date est fourni, utiliser cette date comme référence
  let previousFilingQuery = supabase
    .from("fund_filings")
    .select("id, filing_date")
    .eq("fund_id", fundId)
    .eq("status", "PARSED")
    .lt("filing_date", actualNewFilingDate)
    .order("filing_date", { ascending: false })
    .limit(1);

  if (options?.from_date) {
    // Trouver le filing le plus proche de from_date (mais avant to_date)
    previousFilingQuery = supabase
      .from("fund_filings")
      .select("id, filing_date")
      .eq("fund_id", fundId)
      .eq("status", "PARSED")
      .lte("filing_date", options.from_date)
      .lt("filing_date", actualNewFilingDate)
      .order("filing_date", { ascending: false })
      .limit(1);
  }

  const { data: previousFiling, error: prevFilingError } = await previousFilingQuery.single();

  let oldHoldings: Array<{ ticker: string; shares: number; market_value: number }> = [];
  let oldFilingId: number | null = null;
  let oldFilingDate: string | null = null;

  if (!prevFilingError && previousFiling) {
    oldFilingId = previousFiling.id;
    oldFilingDate = previousFiling.filing_date;

    const { data: holdings, error: holdingsError } = await supabase
      .from("fund_holdings")
      .select("ticker, shares, market_value")
      .eq("filing_id", oldFilingId)
      .eq("type", "stock");

    if (!holdingsError && holdings) {
      oldHoldings = holdings;
    }
  }

  // 4. Créer des maps pour faciliter la comparaison
  const oldHoldingsMap = new Map<string, { shares: number; market_value: number }>();
  for (const holding of oldHoldings) {
    if (holding.ticker) {
      oldHoldingsMap.set(holding.ticker, {
        shares: holding.shares || 0,
        market_value: holding.market_value || 0,
      });
    }
  }

  const newHoldingsMap = new Map<string, { shares: number; market_value: number }>();
  for (const holding of newHoldings) {
    if (holding.ticker) {
      newHoldingsMap.set(holding.ticker, {
        shares: holding.shares || 0,
        market_value: holding.market_value || 0,
      });
    }
  }

  // 5. Calculer les différences
  const diffs: HoldingDiff[] = [];
  const allTickers = new Set([
    ...oldHoldingsMap.keys(),
    ...newHoldingsMap.keys(),
  ]);

  for (const ticker of allTickers) {
    const oldHolding = oldHoldingsMap.get(ticker);
    const newHolding = newHoldingsMap.get(ticker);

    const sharesOld = oldHolding?.shares || null;
    const sharesNew = newHolding?.shares || 0;
    const valueOld = oldHolding?.market_value || null;
    const valueNew = newHolding?.market_value || 0;

    // Déterminer l'action
    let action: 'new' | 'exit' | 'increase' | 'decrease';
    if (!oldHolding && newHolding) {
      action = 'new';
    } else if (oldHolding && !newHolding) {
      action = 'exit';
    } else if (sharesNew > (sharesOld || 0)) {
      action = 'increase';
    } else {
      action = 'decrease';
    }

    const diffShares = sharesNew - (sharesOld || 0);
    const diffValue = valueNew - (valueOld || 0);
    const diffSharesPct = sharesOld ? ((diffShares / sharesOld) * 100) : null;
    const diffValuePct = valueOld ? ((diffValue / valueOld) * 100) : null;

    diffs.push({
      ticker,
      action,
      shares_old: sharesOld,
      shares_new: sharesNew,
      diff_shares: diffShares,
      diff_shares_pct: diffSharesPct,
      value_old: valueOld,
      value_new: valueNew,
      diff_value: diffValue,
      diff_value_pct: diffValuePct,
      filing_id_new: actualNewFilingId || 0,
      filing_id_old: oldFilingId,
      filing_date_new: actualNewFilingDate,
      filing_date_old: oldFilingDate,
    });
  }
```

---

### 4. **GET /funds/{id}/diffs/strategic**
**Rôle** : Analyse stratégique avancée des différences

**Fait** :
- ✅ Tout ce que fait `/diffs`
- ✅ **En plus** : Classification par conviction (high/medium/low)
- ✅ **En plus** : Détection des tendances multi-trimestres
- ✅ **En plus** : Flux sectoriels
- ✅ **En plus** : Tri intelligent par priorité

**Exemple** :
```bash
GET /funds/32/diffs/strategic
```

**Retourne** :
```json
{
  "fund_id": 32,
  "fund_name": "Scion Asset Management",
  "summary": {
    "portfolio_value_latest_filing": 500000000,
    "strong_conviction_count": 5,
    "exits_count": 3,
    "new_positions_count": 8
  },
  "strong_conviction_movements": [...],
  "all_movements": [...],  // Liste fusionnée et triée
  "sector_flows": [...]
}
```

---

## 🎯 Tableau récapitulatif

| Route | Holdings | Valeur | Différences | Action (new/exit/increase/decrease) |
|-------|----------|--------|-------------|-------------------------------------|
| `/funds/{id}/holdings` | ✅ | ✅ | ❌ | ❌ |
| `/funds/{id}/filings/{filingId}/holdings` | ✅ | ✅ | ❌ | ❌ |
| **`/funds/{id}/diffs`** ⭐ | ✅ | ✅ | ✅ | ✅ |
| `/funds/{id}/diffs/strategic` | ✅ | ✅ | ✅ | ✅ + Analyse avancée |

---

## 💡 Recommandation

**Pour votre cas d'usage** (3 besoins), utilisez :

```bash
GET /funds/{id}/diffs?limit=100
```

Cette route :
1. ✅ Récupère la liste des actions détenues (`shares_new`, `shares_old`)
2. ✅ Calcule la valeur totale (`value_new`, `value_old` = Prix × Quantité)
3. ✅ Détermine l'action (`action`: `new` | `exit` | `increase` | `decrease`)

**Exemple complet** :
```bash
# Scion Asset Management (fund_id = 32)
GET /funds/32/diffs?limit=100

# Résultat pour LULU :
{
  "ticker": "LULU",
  "action": "increase",      // ✅ 3. Position renforcée
  "shares_old": 50000,        // ✅ 1. Actions au Q-1
  "shares_new": 100000,       // ✅ 1. Actions au Q actuel
  "value_old": 5000000,       // ✅ 2. Valeur au Q-1
  "value_new": 10000000       // ✅ 2. Valeur au Q actuel
}
```

---

## 🔍 Options de filtrage

La route `/diffs` supporte plusieurs options :

```bash
# Comparaison par dates
GET /funds/32/diffs?from_date=2024-06-30&to_date=2024-09-30

# Comparaison par trimestre
GET /funds/32/diffs?quarter=Q3-2024

# Filtrer par ticker
GET /funds/32/diffs?ticker=LULU

# Limiter les résultats
GET /funds/32/diffs?limit=50
```

---

*Guide créé le : 2026-01-10*
