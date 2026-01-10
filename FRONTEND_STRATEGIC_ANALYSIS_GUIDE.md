# 🎯 Guide Frontend : Analyse Stratégique des Diffs 13F

## 📋 Vue d'Ensemble

Ce guide explique comment utiliser la nouvelle route `/funds/{id}/diffs/strategic` qui transforme la liste brute de transactions en **insights exploitables** pour l'analyse de stratégie d'investissement.

---

## 🚀 Nouvelle Route API

**Endpoint** : `GET /funds/{id}/diffs/strategic`

**Paramètres** :
- `limit` (optionnel, défaut: 500) - Nombre maximum de diffs à analyser
- `noise_threshold` (optionnel, défaut: 0.5) - Seuil minimum d'impact en % pour filtrer le bruit
- `from_date`, `to_date`, `quarter`, `year` - Options de filtrage temporel (comme `/diffs`)

**Exemple** :
```typescript
const response = await fetch(
  'https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/funds/32/diffs/strategic?noise_threshold=0.5',
  {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  }
);
const analysis = await response.json();
```

---

## 📊 Structure de la Réponse

### StrategicAnalysis

```typescript
interface StrategicAnalysis {
  fund_id: number;
  fund_name: string;
  filing_date_new: string;
  filing_date_old: string | null;
  
  // Résumé stratégique
  summary: {
    total_portfolio_value: number;
    total_changes_value: number; // Valeur absolue de tous les changements
    strong_conviction_count: number; // Nombre de mouvements > 5% d'impact
    exits_count: number;
    new_positions_count: number;
    sector_rotation_detected: boolean; // Si > 20% du portefeuille change de secteur
  };
  
  // Mouvements par conviction (triés par impact décroissant)
  strong_conviction_movements: StrategicDiff[]; // > 5% d'impact ou nouveaux > 3%
  medium_conviction_movements: StrategicDiff[]; // 1-5% d'impact
  low_conviction_movements: StrategicDiff[]; // 0.5-1% d'impact
  noise_filtered_out: number; // Nombre de mouvements < 0.5% filtrés
  
  // Flux sectoriel (triés par net_flow_pct décroissant)
  sector_flows: SectorFlow[];
  
  // Exits distincts des trims
  exits: StrategicDiff[]; // Sorties totales (changement de thèse)
  trims: StrategicDiff[]; // Réductions partielles (rebalancing)
  
  // Nouveautés
  new_positions: StrategicDiff[]; // Nouvelles positions
  
  // Tendances multi-trimestres (nécessite plusieurs filings - à venir)
  trends?: {
    accumulating_positions: Array<{
      ticker: string;
      quarters: number;
      total_added: number;
      avg_impact_per_quarter: number;
    }>;
    distributing_positions: Array<{
      ticker: string;
      quarters: number;
      total_reduced: number;
      avg_impact_per_quarter: number;
    }>;
  };
}
```

### StrategicDiff

```typescript
interface StrategicDiff {
  id: number;
  ticker: string;
  action: 'new' | 'exit' | 'increase' | 'decrease';
  diff_shares: number;
  diff_value: number; // En USD
  diff_pct_shares: number | null; // % de variation des shares
  
  // Portfolio Impact (le poids réel dans le portefeuille)
  portfolio_impact_pct: number; // % du portefeuille total affecté (calculé: |diff_value| / total_portfolio_value * 100)
  portfolio_weight_old: number | null; // Poids avant (en % du portefeuille)
  portfolio_weight_new: number | null; // Poids après (en % du portefeuille)
  
  // Classification stratégique
  conviction_level: 'high' | 'medium' | 'low' | 'noise'; // Basé sur portfolio_impact_pct
  is_exit: boolean; // true si sortie totale (action === 'exit')
  is_strong_conviction: boolean; // true si nouvelle position > 5% ou achat massif
  
  // Contexte
  filing_id_new: number;
  filing_id_old: number | null;
  filing_date_new: string;
  filing_date_old: string | null;
  sector: string | null; // Secteur du ticker (depuis table companies)
  
  // Tendances multi-trimestres (signal fort pour un investisseur)
  trend_quarters?: number; // Nombre de trimestres consécutifs (pour accumulation/distribution)
  trend_direction?: 'accumulating' | 'distributing' | 'stable';
  is_accumulating?: boolean; // true si accumulation sur 3+ trimestres → Signal fort: "Le fonds construit patiemment une grosse ligne"
  is_distributing?: boolean; // true si distribution sur 3+ trimestres
}
```

### SectorFlow

```typescript
interface SectorFlow {
  sector: string;
  inflow: number; // Valeur totale des entrées (new + increase)
  outflow: number; // Valeur totale des sorties (exit + decrease)
  net_flow: number; // inflow - outflow
  net_flow_pct: number; // % du portefeuille total (net_flow / total_portfolio_value * 100)
  ticker_count: number; // Nombre de tickers affectés dans ce secteur
  top_movements: Array<{
    ticker: string;
    action: string;
    value: number;
    impact_pct: number;
  }>; // Top 3 mouvements du secteur (triés par impact)
}
```

---

## 🎨 Exemple de Composant React

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Plus, X, ArrowUp, ArrowDown, TrendingUp as AccumulationIcon } from 'lucide-react';
import { StrategicAnalysis, StrategicDiff } from '@/types/admin';

export const FundStrategicAnalysis = ({ fundId }: { fundId: number }) => {
  const { data: analysis, isLoading, error } = useQuery<StrategicAnalysis>({
    queryKey: ['fund', fundId, 'strategic-analysis'],
    queryFn: async () => {
      const token = await getAccessToken();
      const response = await fetch(
        `${API_BASE_URL}/funds/${fundId}/diffs/strategic?noise_threshold=0.5`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch strategic analysis');
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) return <div>Loading strategic analysis...</div>;
  if (error) return <div>Error loading analysis: {error.message}</div>;
  if (!analysis) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Résumé Stratégique */}
      <Card>
        <CardHeader>
          <CardTitle>Résumé Stratégique</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Portefeuille Total"
              value={`$${(analysis.summary.total_portfolio_value / 1e6).toFixed(1)}M`}
              icon={TrendingUp}
            />
            <MetricCard
              title="High Conviction"
              value={analysis.summary.strong_conviction_count}
              icon={TrendingUp}
              variant="success"
            />
            <MetricCard
              title="Exits"
              value={analysis.summary.exits_count}
              icon={X}
              variant="destructive"
            />
            <MetricCard
              title="Nouvelles Positions"
              value={analysis.summary.new_positions_count}
              icon={Plus}
              variant="info"
            />
          </div>
          
          {analysis.summary.sector_rotation_detected && (
            <div className="mt-4 p-4 bg-yellow-100 border border-yellow-400 rounded">
              <p className="font-medium text-yellow-800">
                ⚠️ Rotation Sectorielle Détectée (> 20% du portefeuille)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flux Sectoriel */}
      <Card>
        <CardHeader>
          <CardTitle>Flux Sectoriel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.sector_flows.slice(0, 10).map((flow) => (
              <SectorFlowCard key={flow.sector} flow={flow} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mouvements High Conviction */}
      <Card>
        <CardHeader>
          <CardTitle>Mouvements High Conviction (> 5% d'impact)</CardTitle>
        </CardHeader>
        <CardContent>
          <StrategicDiffsTable diffs={analysis.strong_conviction_movements} />
        </CardContent>
      </Card>

      {/* Exits vs Trims */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Exits (Sorties Totales)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Changement de thèse d'investissement
            </p>
          </CardHeader>
          <CardContent>
            <StrategicDiffsTable diffs={analysis.exits.slice(0, 10)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trims (Réductions Partielles)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Rebalancing, position toujours maintenue
            </p>
          </CardHeader>
          <CardContent>
            <StrategicDiffsTable diffs={analysis.trims.slice(0, 10)} />
          </CardContent>
        </Card>
      </div>

      {/* Nouvelles Positions */}
      <Card>
        <CardHeader>
          <CardTitle>Nouvelles Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <StrategicDiffsTable diffs={analysis.new_positions.slice(0, 20)} />
        </CardContent>
      </Card>
    </div>
  );
};

const MetricCard = ({ title, value, icon: Icon, variant }: any) => (
  <div className="flex items-center justify-between p-4 border rounded">
    <div>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
    <Icon className="h-8 w-8 text-muted-foreground" />
  </div>
);

const SectorFlowCard = ({ flow }: { flow: SectorFlow }) => {
  const isPositive = flow.net_flow > 0;
  
  return (
    <div className="flex items-center justify-between p-4 border rounded">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium">{flow.sector || 'Unknown'}</h4>
          <Badge variant={isPositive ? 'success' : 'destructive'}>
            {isPositive ? '+' : ''}{flow.net_flow_pct.toFixed(2)}%
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          <span>Inflow: ${(flow.inflow / 1e6).toFixed(2)}M</span>
          <span className="mx-2">•</span>
          <span>Outflow: ${(flow.outflow / 1e6).toFixed(2)}M</span>
          <span className="mx-2">•</span>
          <span>{flow.ticker_count} tickers</span>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Top: {flow.top_movements.map(m => `${m.ticker} (${m.action})`).join(', ')}
        </div>
      </div>
      {isPositive ? (
        <TrendingUp className="h-6 w-6 text-green-600" />
      ) : (
        <TrendingDown className="h-6 w-6 text-red-600" />
      )}
    </div>
  );
};

const StrategicDiffsTable = ({ diffs }: { diffs: StrategicDiff[] }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Ticker</th>
            <th className="text-left p-2">Action</th>
            <th className="text-left p-2">Impact</th>
            <th className="text-left p-2">Valeur</th>
            <th className="text-left p-2">Poids</th>
            <th className="text-left p-2">Secteur</th>
          </tr>
        </thead>
        <tbody>
          {diffs.map((diff) => (
            <tr key={diff.id} className="border-b">
              <td className="p-2 font-medium">
                <div className="flex items-center gap-2">
                  <span>{diff.ticker}</span>
                  {diff.is_accumulating && diff.trend_quarters && diff.trend_quarters >= 3 && (
                    <Badge variant="success" className="bg-green-100 text-green-800 text-xs">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Accumulation ({diff.trend_quarters}Q)
                    </Badge>
                  )}
                  {diff.is_distributing && diff.trend_quarters && diff.trend_quarters >= 3 && (
                    <Badge variant="destructive" className="bg-red-100 text-red-800 text-xs">
                      <TrendingDown className="h-3 w-3 mr-1" />
                      Distribution ({diff.trend_quarters}Q)
                    </Badge>
                  )}
                </div>
              </td>
              <td className="p-2">
                <ActionBadge action={diff.action} isExit={diff.is_exit} />
              </td>
              <td className="p-2">
                <Badge variant={diff.conviction_level === 'high' ? 'destructive' : 'default'}>
                  {diff.portfolio_impact_pct.toFixed(2)}%
                </Badge>
              </td>
              <td className="p-2">
                <span className={diff.diff_value >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {diff.diff_value >= 0 ? '+' : ''}${(diff.diff_value / 1e6).toFixed(2)}M
                </span>
              </td>
              <td className="p-2 text-sm text-muted-foreground">
                {diff.portfolio_weight_old !== null && diff.portfolio_weight_new !== null ? (
                  <span>
                    {diff.portfolio_weight_old.toFixed(2)}% → {diff.portfolio_weight_new.toFixed(2)}%
                  </span>
                ) : (
                  <span>-</span>
                )}
              </td>
              <td className="p-2 text-sm text-muted-foreground">
                {diff.sector || 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ActionBadge = ({ action, isExit }: { action: string; isExit: boolean }) => {
  const variants: Record<string, { icon: any; className: string; label: string }> = {
    new: { icon: Plus, className: 'bg-green-100 text-green-800', label: 'NEW' },
    exit: { icon: X, className: 'bg-red-100 text-red-800', label: 'EXIT' },
    increase: { icon: ArrowUp, className: 'bg-blue-100 text-blue-800', label: '↑ INCREASE' },
    decrease: { icon: ArrowDown, className: 'bg-orange-100 text-orange-800', label: '↓ DECREASE' },
  };
  
  const variant = variants[action] || { icon: null, className: '', label: action };
  const Icon = variant.icon;
  
  return (
    <Badge className={variant.className}>
      {Icon && <Icon className="h-3 w-3 mr-1" />}
      {isExit ? 'EXIT (Full)' : variant.label}
    </Badge>
  );
};
```

---

## 💡 Fonction TypeScript pour Calculer le % Portfolio Impact

Si vous voulez calculer le % Portfolio Impact côté frontend pour d'autres usages :

```typescript
/**
 * Calcule le % Portfolio Impact d'un mouvement
 * Portfolio Impact = |diff_value| / total_portfolio_value * 100
 */
export function calculatePortfolioImpact(
  diffValue: number,
  totalPortfolioValue: number
): number {
  if (totalPortfolioValue === 0) return 0;
  return Math.abs(diffValue) / totalPortfolioValue * 100;
}

/**
 * Classifie le niveau de conviction d'un mouvement
 */
export function classifyConviction(
  portfolioImpactPct: number,
  action: 'new' | 'exit' | 'increase' | 'decrease',
  isNew: boolean
): 'high' | 'medium' | 'low' | 'noise' {
  // Les nouvelles positions > 3% sont toujours "high conviction"
  if (isNew && portfolioImpactPct >= 3) return 'high';
  
  // Exits sont toujours "high conviction" (changement de thèse)
  if (action === 'exit') return 'high';
  
  // Classification standard
  if (portfolioImpactPct >= 5) return 'high';
  if (portfolioImpactPct >= 1) return 'medium';
  if (portfolioImpactPct >= 0.5) return 'low';
  return 'noise';
}

/**
 * Filtre le bruit (mouvements < threshold)
 */
export function filterNoise(
  diffs: StrategicDiff[],
  threshold: number = 0.5
): {
  significant: StrategicDiff[];
  noise: StrategicDiff[];
} {
  const significant: StrategicDiff[] = [];
  const noise: StrategicDiff[] = [];
  
  for (const diff of diffs) {
    if (diff.portfolio_impact_pct >= threshold) {
      significant.push(diff);
    } else {
      noise.push(diff);
    }
  }
  
  return { significant, noise };
}
```

---

## 🎯 Exemple d'Usage

```typescript
// Hook React Query
export const useFundStrategicAnalysis = (fundId: number, noiseThreshold = 0.5) => {
  return useQuery<StrategicAnalysis>({
    queryKey: ['fund', fundId, 'strategic-analysis', noiseThreshold],
    queryFn: async () => {
      const token = await getAccessToken();
      const response = await fetch(
        `${API_BASE_URL}/funds/${fundId}/diffs/strategic?noise_threshold=${noiseThreshold}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch strategic analysis');
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });
};

// Utilisation dans un composant
export const FundDashboard = ({ fundId }: { fundId: number }) => {
  const { data: analysis } = useFundStrategicAnalysis(fundId, 0.5);
  
  if (!analysis) return null;
  
  return (
    <div>
      {/* Résumé */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">{analysis.fund_name}</h2>
        <p className="text-muted-foreground">
          Analyse stratégique : {analysis.summary.strong_conviction_count} mouvements high conviction
        </p>
      </div>
      
      {/* Flux Sectoriel */}
      {analysis.summary.sector_rotation_detected && (
        <Alert variant="warning">
          Rotation sectorielle détectée : Le fond a réalloué plus de 20% de son portefeuille entre secteurs.
        </Alert>
      )}
      
      {/* Top 5 Mouvements High Conviction */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Mouvements High Conviction</CardTitle>
        </CardHeader>
        <CardContent>
          {analysis.strong_conviction_movements.slice(0, 5).map((diff) => (
            <div key={diff.id} className="flex justify-between items-center py-2 border-b">
              <div>
                <span className="font-medium">{diff.ticker}</span>
                <ActionBadge action={diff.action} isExit={diff.is_exit} />
              </div>
              <div className="text-right">
                <div className="font-bold">{diff.portfolio_impact_pct.toFixed(2)}%</div>
                <div className="text-sm text-muted-foreground">
                  ${(Math.abs(diff.diff_value) / 1e6).toFixed(2)}M
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
```

---

## ✅ Avantages de cette Approche

1. **Filtrage du Bruit** : Seuls les mouvements significatifs (> 0.5% d'impact) sont affichés par défaut
2. **Hiérarchisation** : Les mouvements sont triés par impact réel sur le portefeuille
3. **Distinction Exits/Trims** : Séparation claire entre sorties totales (changement de thèse) et réductions partielles (rebalancing)
4. **Flux Sectoriel** : Visualisation des migrations d'argent entre secteurs
5. **Niveau de Conviction** : Classification automatique (high/medium/low/noise) basée sur l'impact réel
6. **Badge "Accumulation"** : Signal le plus fort pour un investisseur. Détecte les positions accumulées sur 3+ trimestres consécutifs, indiquant que "le fonds construit patiemment une grosse ligne". Ces positions sont automatiquement classées en "high conviction" même si l'impact individuel est faible, car elles révèlent une conviction stratégique à long terme.

---

## 🚀 Prochaines Étapes

Pour aller plus loin, vous pouvez :

1. **Ajouter les tendances multi-trimestres** : Détecter les accumulations/distributions sur plusieurs trimestres
2. **Prix d'achat estimé** : Calculer le VWAP (Volume Weighted Average Price) pour voir si le fond est "dans le vert"
3. **Graphiques Treemap** : Visualiser les flux sectoriels avec un graphique interactif
4. **Résumé AI** : Générer un résumé automatique de la stratégie ("Ce trimestre, Scion s'est massivement retiré de la santé...")

---

## 📝 Notes Techniques

- Le `portfolio_impact_pct` est calculé comme : `|diff_value| / total_portfolio_value * 100`
- Le seuil de bruit par défaut est 0.5% (configurable via `noise_threshold`)
- Les secteurs sont récupérés depuis la table `companies` (peut être `null` si le ticker n'existe pas)
- Les poids de portefeuille (old/new) sont calculés en batch pour optimiser les performances

Le service est optimisé pour charger tous les secteurs et poids de portefeuille en batch, réduisant les appels à la base de données de N requêtes à 2 requêtes seulement.
