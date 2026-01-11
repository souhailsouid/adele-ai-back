# 📊 Explication : Répartition Sectorielle

## Qu'est-ce que la Répartition Sectorielle ?

La **Répartition Sectorielle** (ou **Sector Allocation**) montre comment un fonds répartit son portefeuille entre différents secteurs économiques (Technology, Healthcare, Financial Services, etc.).

---

## 📋 Exemple : Ce que vous voyez

```
Répartition Sectorielle
Voir détails
Financial Services    19.5%
Consumer Cyclical      8.7%
```

### Que signifient ces pourcentages ?

Ces pourcentages représentent **le poids de chaque secteur dans le portefeuille total du fonds**.

**Exemple concret** :
- Si le portefeuille vaut **100 millions USD** :
  - **Financial Services** (19.5%) = **19.5 millions USD** investis dans ce secteur
  - **Consumer Cyclical** (8.7%) = **8.7 millions USD** investis dans ce secteur

---

## 🔍 Comment est calculée la Répartition Sectorielle ?

### 1. Calcul à partir des holdings

Pour chaque holding, on :
1. Récupère le secteur du ticker (depuis la table `companies`)
2. Multiplie la valeur du holding par son poids dans le portefeuille
3. Agrège tous les holdings par secteur

**Formule** :
```
Poids Secteur (%) = (Somme des valeurs des holdings du secteur / Valeur totale du portefeuille) × 100
```

**Exemple** :
```
Portefeuille total : 100M USD

Holdings Financial Services :
- JPM : 5M USD
- BAC : 4M USD
- WFC : 3.5M USD
- C : 2M USD
- GS : 5M USD
Total : 19.5M USD

Poids Financial Services = (19.5M / 100M) × 100 = 19.5%
```

---

## 🎯 Types de Répartition Sectorielle

### 1. Répartition statique (Holdings actuels)

Affiche la répartition actuelle du portefeuille basée sur le dernier filing 13F.

**Exemple** :
```
Répartition Actuelle (Q3 2024)
Financial Services     19.5%
Technology             15.3%
Healthcare             12.8%
Consumer Cyclical       8.7%
...
```

### 2. Répartition dynamique (Flux Sectoriels)

Affiche **les changements** de répartition entre deux filings (achats/ventes par secteur).

**Exemple** :
```
Flux Sectoriels (Q2 → Q3 2024)
Financial Services    +19.5%  (Achat net)
Consumer Cyclical      +8.7%  (Achat net)
Technology             -5.2%  (Vente nette)
Healthcare             -2.1%  (Vente nette)
```

**Dans votre contexte** :
- Si vous voyez "Financial Services 19.5%" dans les **Flux Sectoriels**, cela signifie :
  - Le fonds a **acheté pour 19.5% du portefeuille** dans le secteur Financial Services
  - C'est un **inflow net** (argent injecté)

---

## 📊 Différence : Répartition vs Flux

### Répartition Sectorielle (Statique)
- **Ce que c'est** : Répartition actuelle du portefeuille
- **Calcul** : Valeur totale des holdings par secteur
- **Exemple** : "19.5% du portefeuille est en Financial Services"

### Flux Sectoriel (Dynamique)
- **Ce que c'est** : Changements de répartition entre deux périodes
- **Calcul** : Différence entre achats et ventes par secteur
- **Exemple** : "+19.5% d'achat net dans Financial Services"

---

## 🔍 Interpréter votre exemple

### Cas 1 : Répartition Statique

```
Financial Services    19.5%
Consumer Cyclical      8.7%
```

**Signification** :
- Le fonds a **19.5% de son portefeuille** investis dans Financial Services
- Le fonds a **8.7% de son portefeuille** investis dans Consumer Cyclical
- Ce sont les **holdings actuels** du fonds

### Cas 2 : Flux Sectoriel (Probable dans votre cas)

```
Financial Services    +19.5%
Consumer Cyclical      +8.7%
```

**Signification** :
- Le fonds a **acheté pour 19.5% du portefeuille** dans Financial Services
- Le fonds a **acheté pour 8.7% du portefeuille** dans Consumer Cyclical
- Ce sont les **changements** entre deux filings

**Dans le contexte de l'analyse stratégique** (`/funds/{id}/diffs/strategic`) :
- Ces pourcentages représentent le **net flow** (inflow - outflow) par secteur
- Un pourcentage positif = **achat net** (plus d'achats que de ventes)
- Un pourcentage négatif = **vente nette** (plus de ventes que d'achats)

---

## 🎨 Comment l'afficher dans le Frontend

### Option 1 : Graphique en barres horizontales

```typescript
// components/funds/SectorAllocationChart.tsx
'use client';

import { SectorFlow } from '@/types/strategic-analysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SectorAllocationChartProps {
  sectorFlows: SectorFlow[];
}

export function SectorAllocationChart({ sectorFlows }: SectorAllocationChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Répartition Sectorielle</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sectorFlows
            .sort((a, b) => Math.abs(b.net_flow_pct) - Math.abs(a.net_flow_pct))
            .map((flow) => (
              <div key={flow.sector}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{flow.sector}</span>
                  <span className={`text-sm font-semibold ${
                    flow.net_flow_pct >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {flow.net_flow_pct >= 0 ? '+' : ''}{flow.net_flow_pct.toFixed(1)}%
                  </span>
                </div>
                {/* Barre de progression */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      flow.net_flow_pct >= 0 ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.abs(flow.net_flow_pct)}%` }}
                  />
                </div>
                {/* Détails */}
                <div className="text-xs text-muted-foreground mt-1">
                  {flow.ticker_count} tickers • 
                  Inflow: ${(flow.inflow / 1000).toFixed(0)}K • 
                  Outflow: ${(flow.outflow / 1000).toFixed(0)}K
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### Option 2 : Liste avec badges

```typescript
// Affichage simple
{sectorFlows.map((flow) => (
  <div key={flow.sector} className="flex items-center justify-between p-2">
    <span className="font-medium">{flow.sector}</span>
    <Badge variant={flow.net_flow_pct >= 0 ? 'success' : 'destructive'}>
      {flow.net_flow_pct >= 0 ? '+' : ''}{flow.net_flow_pct.toFixed(1)}%
    </Badge>
  </div>
))}
```

### Option 3 : Graphique circulaire (Pie Chart)

Pour la répartition statique, vous pouvez utiliser un graphique circulaire :

```typescript
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function SectorPieChart({ sectorFlows }: SectorAllocationChartProps) {
  const data = sectorFlows.map((flow) => ({
    name: flow.sector,
    value: Math.abs(flow.net_flow_pct),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

---

## 💡 Questions Fréquentes

### Q1 : Pourquoi le total n'est pas 100% ?

**Réponse** : 
- Si c'est un **flux sectoriel** (changements), le total peut être > 100% car :
  - Le fonds peut acheter dans plusieurs secteurs en même temps
  - Le total représente la somme des **changements**, pas la répartition finale
- Si c'est une **répartition statique**, le total devrait être proche de 100%

### Q2 : Que signifie un pourcentage négatif ?

**Réponse** :
- Un pourcentage négatif = **vente nette** (plus de ventes que d'achats)
- Exemple : "-5.2% Technology" = Le fonds a **vendu** pour 5.2% du portefeuille dans Technology

### Q3 : Pourquoi certains secteurs sont "Unknown" ?

**Réponse** :
- Les tickers n'ont pas encore été enrichis avec leurs secteurs
- Solution : Utiliser le bouton "Enrichir les secteurs" ou attendre l'enrichissement automatique

---

## 🎯 Exemple Complet d'Interprétation

### Scénario : Fonds qui réalloue son portefeuille

```
Flux Sectoriels (Q2 → Q3 2024)
Financial Services    +19.5%  ← Achat massif (nouvelle stratégie)
Consumer Cyclical      +8.7%  ← Achat modéré
Technology             -5.2%  ← Vente (prise de bénéfices)
Healthcare             -2.1%  ← Légère vente
```

**Interprétation** :
- Le fonds a **fortement augmenté** sa position dans Financial Services (+19.5%)
- Il a aussi **augmenté** sa position dans Consumer Cyclical (+8.7%)
- Il a **réduit** sa position dans Technology (-5.2%)
- Il a **légèrement réduit** sa position dans Healthcare (-2.1%)

**Conclusion** :
- Le fonds semble se tourner vers les secteurs financiers et cycliques
- Il réduit sa dépendance à la technologie

---

## 📚 Ressources

- **Guide Frontend** : `FRONTEND_SECTORS_INTEGRATION.md`
- **Guide Analyse Stratégique** : `FRONTEND_STRATEGIC_ANALYSIS_GUIDE.md`
- **API** : `GET /funds/{id}/diffs/strategic`

---

*Guide créé le : 2026-01-10*  
*Dernière mise à jour : Après implémentation du système d'enrichissement des secteurs*
