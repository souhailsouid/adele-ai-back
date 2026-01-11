# 🎨 Guide Frontend : Intégration des Secteurs Enrichis

## 📋 Vue d'Ensemble

Maintenant que le système d'enrichissement des secteurs fonctionne, voici comment les intégrer dans votre frontend pour améliorer l'affichage de l'analyse stratégique.

---

## ✅ Ce qui fonctionne déjà

1. **Enrichissement automatique** : Les entreprises sont enrichies via FMP
2. **Secteurs dans l'analyse stratégique** : Les secteurs apparaissent dans `/funds/{id}/diffs/strategic`
3. **Correspondance intelligente** : Les tickers "LULULEMON " correspondent à "LULU" automatiquement

---

## 🔧 Mise à jour du Frontend

### 1. Utiliser `sector_flows_filtered` au lieu de `sector_flows`

**Avant** :
```typescript
// ❌ Affiche aussi les "Unknown"
{analysis.sector_flows.map((flow) => (
  <SectorFlowCard key={flow.sector} flow={flow} />
))}
```

**Après** :
```typescript
// ✅ Exclut automatiquement les "Unknown"
{analysis.sector_flows_filtered.map((flow) => (
  <SectorFlowCard key={flow.sector} flow={flow} />
))}
```

### 2. Vérifier `has_only_unknown_sectors` avant d'afficher le graphique

```typescript
// components/funds/SectorFlowsChart.tsx
'use client';

import { SectorFlow } from '@/types/strategic-analysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

interface SectorFlowsChartProps {
  sectorFlows: SectorFlow[];
  sectorFlowsFiltered: SectorFlow[];
  hasOnlyUnknownSectors: boolean;
}

export function SectorFlowsChart({
  sectorFlows,
  sectorFlowsFiltered,
  hasOnlyUnknownSectors,
}: SectorFlowsChartProps) {
  // Si tous les secteurs sont "Unknown", afficher un message
  if (hasOnlyUnknownSectors) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Flux Sectoriel</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Les secteurs ne sont pas encore disponibles pour ce fond.
              <br />
              <button
                onClick={() => enrichMissingSectors()}
                className="text-primary hover:underline mt-2"
              >
                Enrichir les secteurs manuellement
              </button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Afficher le graphique avec les secteurs filtrés
  return (
    <Card>
      <CardHeader>
        <CardTitle>Flux Sectoriel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sectorFlowsFiltered.map((flow) => (
            <SectorFlowCard key={flow.sector} flow={flow} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3. Afficher les secteurs dans le tableau des mouvements

```typescript
// components/funds/StrategicDiffsTable.tsx
'use client';

import { StrategicDiff } from '@/types/strategic-analysis';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StrategicDiffsTableProps {
  diffs: StrategicDiff[];
}

export function StrategicDiffsTable({ diffs }: StrategicDiffsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Ticker</th>
            <th className="text-left p-2">Action</th>
            <th className="text-left p-2">Impact</th>
            <th className="text-left p-2">Secteur</th>
            <th className="text-left p-2">Valeur</th>
          </tr>
        </thead>
        <tbody>
          {diffs.map((diff) => (
            <tr key={diff.id} className="border-b">
              <td className="p-2 font-medium">{diff.ticker}</td>
              <td className="p-2">
                <Badge variant={getActionVariant(diff.action)}>
                  {diff.action}
                </Badge>
              </td>
              <td className="p-2">
                <Badge variant={getConvictionVariant(diff.conviction_level)}>
                  {diff.portfolio_impact_pct.toFixed(2)}%
                </Badge>
              </td>
              <td className="p-2">
                {/* Afficher le secteur avec un badge */}
                {diff.sector ? (
                  <Badge variant="outline" className="text-xs">
                    {diff.sector}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">Unknown</span>
                )}
              </td>
              <td className="p-2">
                ${((diff.diff_value || 0) / 1000).toFixed(0)}K
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getActionVariant(action: string) {
  switch (action) {
    case 'new':
      return 'success';
    case 'exit':
      return 'destructive';
    case 'increase':
      return 'default';
    case 'decrease':
      return 'secondary';
    default:
      return 'outline';
  }
}

function getConvictionVariant(level: string) {
  switch (level) {
    case 'high':
      return 'destructive';
    case 'medium':
      return 'default';
    case 'low':
      return 'secondary';
    default:
      return 'outline';
  }
}
```

### 4. Fonction pour enrichir les secteurs manquants

```typescript
// hooks/useCompanyEnrichment.ts
'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod';

interface EnrichCompanyResponse {
  ticker: string;
  created: boolean;
  updated: boolean;
  sector: string | null;
  industry: string | null;
  error?: string;
}

export function useCompanyEnrichment() {
  const [isEnriching, setIsEnriching] = useState(false);

  const enrichCompany = async (ticker: string, cik?: string): Promise<EnrichCompanyResponse> => {
    const token = localStorage.getItem('access_token'); // Ou utiliser votre système d'auth
    
    const response = await fetch(`${API_BASE}/companies/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ ticker, cik }),
    });

    if (!response.ok) {
      throw new Error('Failed to enrich company');
    }

    return response.json();
  };

  const enrichCompaniesBatch = async (
    tickers: string[],
    cikMap?: Record<string, string>
  ): Promise<EnrichCompanyResponse[]> => {
    const token = localStorage.getItem('access_token');
    
    setIsEnriching(true);
    try {
      const response = await fetch(`${API_BASE}/companies/enrich/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ tickers, cikMap, delayMs: 200 }),
      });

      if (!response.ok) {
        throw new Error('Failed to enrich companies');
      }

      return response.json();
    } finally {
      setIsEnriching(false);
    }
  };

  return {
    enrichCompany,
    enrichCompaniesBatch,
    isEnriching,
  };
}
```

### 5. Bouton pour enrichir automatiquement les secteurs manquants

```typescript
// components/funds/EnrichSectorsButton.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useCompanyEnrichment } from '@/hooks/useCompanyEnrichment';
import { StrategicDiff } from '@/types/strategic-analysis';

interface EnrichSectorsButtonProps {
  diffs: StrategicDiff[];
  onEnriched?: () => void;
}

export function EnrichSectorsButton({ diffs, onEnriched }: EnrichSectorsButtonProps) {
  const { enrichCompaniesBatch, isEnriching } = useCompanyEnrichment();
  const [enrichedCount, setEnrichedCount] = useState(0);

  // Extraire les tickers sans secteur
  const tickersWithoutSector = diffs
    .filter(diff => !diff.sector)
    .map(diff => diff.ticker.trim().toUpperCase())
    .filter((ticker, index, self) => self.indexOf(ticker) === index); // Dédupliquer

  if (tickersWithoutSector.length === 0) {
    return null; // Pas de tickers à enrichir
  }

  const handleEnrich = async () => {
    try {
      const results = await enrichCompaniesBatch(tickersWithoutSector);
      const successCount = results.filter(r => r.sector || r.industry).length;
      setEnrichedCount(successCount);
      
      // Rafraîchir les données après enrichissement
      if (onEnriched) {
        setTimeout(() => {
          onEnriched();
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to enrich sectors:', error);
    }
  };

  return (
    <Button
      onClick={handleEnrich}
      disabled={isEnriching}
      variant="outline"
      size="sm"
    >
      {isEnriching ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Enrichissement en cours...
        </>
      ) : (
        <>
          Enrichir les secteurs manquants ({tickersWithoutSector.length} tickers)
        </>
      )}
    </Button>
  );
}
```

### 6. Utilisation complète dans un composant

```typescript
// app/funds/[id]/diffs/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { StrategicAnalysis } from '@/types/strategic-analysis';
import { StrategicDiffsTable } from '@/components/funds/StrategicDiffsTable';
import { SectorFlowsChart } from '@/components/funds/SectorFlowsChart';
import { EnrichSectorsButton } from '@/components/funds/EnrichSectorsButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function FundDiffsPage() {
  const params = useParams();
  const fundId = params.id as string;
  const [analysis, setAnalysis] = useState<StrategicAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalysis = async () => {
    const token = localStorage.getItem('access_token');
    
    setLoading(true);
    try {
      const response = await fetch(
        `https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/funds/${fundId}/diffs/strategic?limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch analysis');
      }

      const data = await response.json();
      setAnalysis(data);
    } catch (error) {
      console.error('Error fetching analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [fundId]);

  if (loading || !analysis) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec bouton d'enrichissement */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analyse Stratégique</h1>
        <EnrichSectorsButton
          diffs={analysis.all_movements}
          onEnriched={fetchAnalysis}
        />
      </div>

      {/* Résumé */}
      <Card>
        <CardHeader>
          <CardTitle>Résumé</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Portfolio Value</div>
              <div className="text-2xl font-bold">
                ${(analysis.summary.portfolio_value_latest_filing / 1000).toFixed(0)}M
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Net Inflow</div>
              <div className="text-2xl font-bold text-green-600">
                +${(analysis.summary.net_inflow / 1000).toFixed(0)}K
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Net Outflow</div>
              <div className="text-2xl font-bold text-red-600">
                -${(analysis.summary.net_outflow / 1000).toFixed(0)}K
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Strong Conviction</div>
              <div className="text-2xl font-bold">
                {analysis.summary.strong_conviction_count}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flux Sectoriel */}
      <SectorFlowsChart
        sectorFlows={analysis.sector_flows}
        sectorFlowsFiltered={analysis.sector_flows_filtered}
        hasOnlyUnknownSectors={analysis.has_only_unknown_sectors}
      />

      {/* Tableau des mouvements */}
      <Card>
        <CardHeader>
          <CardTitle>Mouvements Stratégiques</CardTitle>
        </CardHeader>
        <CardContent>
          <StrategicDiffsTable diffs={analysis.all_movements} />
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 📋 Checklist d'Intégration

- [ ] Mettre à jour les types TypeScript pour inclure `sector_flows_filtered` et `has_only_unknown_sectors`
- [ ] Utiliser `sector_flows_filtered` au lieu de `sector_flows` pour les graphiques
- [ ] Afficher un message si `has_only_unknown_sectors === true`
- [ ] Ajouter les secteurs dans le tableau des mouvements
- [ ] Créer un bouton pour enrichir les secteurs manquants
- [ ] Rafraîchir les données après enrichissement

---

## 🎨 Exemples Visuels

### Avant (sans secteurs enrichis)
- Tous les secteurs affichés comme "Unknown"
- Impossible de voir les flux sectoriels

### Après (avec secteurs enrichis)
- Secteurs réels affichés : "Technology", "Healthcare", "Consumer Cyclical", etc.
- Graphiques de flux sectoriel fonctionnels
- Possibilité d'enrichir les secteurs manquants manuellement

---

## 💡 Conseils

1. **Enrichissement automatique** : Envisagez d'enrichir automatiquement les secteurs lors du parsing 13F dans le backend
2. **Cache côté frontend** : Mettez en cache les secteurs enrichis pour éviter les requêtes répétées
3. **Feedback utilisateur** : Affichez un indicateur de progression lors de l'enrichissement batch

---

*Guide créé le : 2026-01-10*  
*Dernière mise à jour : Après déploiement du système d'enrichissement des secteurs*
