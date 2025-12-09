# 🧠 Attribution Engine - Guide Complet

## 🎯 Qu'est-ce que l'Attribution Engine ?

L'**Attribution Engine** est le **cœur d'Arkham** : il répond à la question **"QUI est derrière cette action observable ?"**

C'est ce qui transforme des données brutes en **intelligence actionnable**.

---

## ❓ À quoi ça sert ?

### Le Problème
Tu vois :
- Un énorme flow de CALLs sur NVDA
- Un mouvement de prix anormal
- Une activité options suspecte

### La Question
**QUI est derrière ça ?**

### La Réponse (Attribution Engine)
- BlackRock a augmenté sa position récemment
- Un insider a acheté des options 2 jours avant
- Citadel a un short intérêt élevé

**→ Attribution : Le mouvement est probablement initié par BlackRock + insiders, avec Citadel en opposition.**

---

## 🧩 Ce que ça fait concrètement

1. **Trouve quelle institution influence un ticker**
   - Analyse les positions 13F
   - Corrèle avec les flows options
   - Calcule l'influence

2. **Identifie quel hedge fund a initié un mouvement**
   - Détecte les changements de positions récents
   - Corrèle avec les flows options
   - Identifie les patterns historiques

3. **Repère quels insiders ont joué un rôle**
   - Analyse les transactions insiders
   - Corrèle avec les options flows
   - Détecte les patterns suspects

4. **Détecte les entités dominantes sur une action**
   - Calcule la centralité dans le graphe
   - Mesure l'influence sur les flows
   - Identifie les hubs

5. **Associe un flow options à des acteurs spécifiques**
   - Match les flows avec les positions institutionnelles
   - Analyse les patterns comportementaux
   - Calcule la probabilité d'attribution

6. **Détecte le rôle caché d'une entité dans un mouvement de marché**
   - Analyse les relations indirectes
   - Détecte les corrélations cachées
   - Identifie les stratégies coordonnées

---

## 🏗️ Architecture de l'Attribution Engine

```
┌─────────────────────────────────────────────────────────┐
│              Attribution Engine                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Flow         │  │ Institution  │  │ Insider      │ │
│  │ Attribution  │  │ Attribution  │  │ Attribution  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │          │
│         └─────────────────┼─────────────────┘          │
│                           │                            │
│                  ┌────────▼────────┐                   │
│                  │  Graph Service  │                   │
│                  │    (Neo4j)      │                   │
│                  └────────┬────────┘                   │
│                           │                            │
│         ┌──────────────────┼──────────────────┐        │
│         │                  │                  │        │
│  ┌──────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐ │
│  │  13F Data   │  │ Options Flow │  │ Insider Data│ │
│  │  (FMP/UW)  │  │    (UW)      │  │    (UW)     │ │
│  └────────────┘  └──────────────┘  └─────────────┘ │
└───────────────────────────────────────────────────────┘
```

---

## 📊 Cas d'Usage Concrets

### Cas 1 : Flow de CALLs sur NVDA

**Données observées** :
- 2M$ de CALLs achetés hors de la monnaie sur NVDA
- Strike : $500, Expiry : 1 mois

**Attribution Engine analyse** :
1. **Positions institutionnelles** (13F)
   - BlackRock : +500K shares NVDA (dernière déclaration)
   - Vanguard : Position stable
   - Citadel : Short intérêt élevé

2. **Options flows historiques**
   - BlackRock a historiquement acheté des CALLs avant earnings
   - Pattern similaire détecté 3 mois avant

3. **Insider activity**
   - CFO a acheté des options 2 jours avant
   - Pattern : Insider achète → Earnings beat → Prix monte

4. **Corrélations**
   - Flow coïncide avec augmentation position BlackRock
   - Flow coïncide avec insider activity

**Résultat d'attribution** :
```json
{
  "flowId": "nvda-calls-2025-12-07",
  "ticker": "NVDA",
  "attributions": [
    {
      "entityId": "blackrock",
      "entityType": "Institution",
      "confidence": 85,
      "reasoning": "Position récente + pattern historique + timing",
      "evidence": [
        {
          "type": "POSITION_CHANGE",
          "score": 90,
          "description": "BlackRock a augmenté sa position de 500K shares"
        },
        {
          "type": "HISTORICAL_PATTERN",
          "score": 80,
          "description": "Pattern similaire détecté 3 mois avant earnings"
        },
        {
          "type": "TIMING_CORRELATION",
          "score": 85,
          "description": "Flow coïncide avec changement de position"
        }
      ]
    },
    {
      "entityId": "nvda-cfo",
      "entityType": "Insider",
      "confidence": 70,
      "reasoning": "Achat d'options 2 jours avant + pattern historique",
      "evidence": [
        {
          "type": "INSIDER_TRANSACTION",
          "score": 75,
          "description": "CFO a acheté des options 2 jours avant"
        },
        {
          "type": "HISTORICAL_PATTERN",
          "score": 65,
          "description": "Pattern : Insider achète → Earnings beat"
        }
      ]
    }
  ],
  "conflictingEntities": [
    {
      "entityId": "citadel",
      "entityType": "Institution",
      "reasoning": "Short intérêt élevé + Options PUT",
      "impact": "OPPOSITION"
    }
  ]
}
```

---

### Cas 2 : Détection d'une Stratégie Coordonnée

**Données observées** :
- Plusieurs institutions augmentent leurs positions sur TSLA
- Flows options agressifs
- Insiders actifs

**Attribution Engine analyse** :
1. **Clustering institutionnel**
   - Vanguard, BlackRock, Fidelity agissent simultanément
   - Pattern de coordination détecté

2. **Analyse du graphe**
   - Ces institutions sont connectées (même secteur, corrélations)
   - Hubs détectés

3. **Timing**
   - Toutes les actions se produisent dans une fenêtre de 48h
   - Probabilité de coordination : élevée

**Résultat d'attribution** :
```json
{
  "eventType": "COORDINATED_STRATEGY",
  "ticker": "TSLA",
  "cluster": {
    "institutions": ["vanguard", "blackrock", "fidelity"],
    "confidence": 90,
    "reasoning": "Actions simultanées + corrélations fortes"
  },
  "attributions": [
    {
      "entityId": "vanguard",
      "role": "LEADER",
      "confidence": 85
    },
    {
      "entityId": "blackrock",
      "role": "FOLLOWER",
      "confidence": 80
    },
    {
      "entityId": "fidelity",
      "role": "FOLLOWER",
      "confidence": 75
    }
  ]
}
```

---

## 🛠️ Implémentation

### 1. Types TypeScript

**`services/api/src/types/attribution.ts`**
```typescript
export type EntityType = 'Institution' | 'Insider' | 'Unknown';

export type AttributionEvidenceType =
  | 'POSITION_CHANGE'
  | 'HISTORICAL_PATTERN'
  | 'TIMING_CORRELATION'
  | 'FLOW_MATCH'
  | 'INSIDER_TRANSACTION'
  | 'BEHAVIORAL_PATTERN'
  | 'GRAPH_CENTRALITY'
  | 'CORRELATION';

export interface AttributionEvidence {
  type: AttributionEvidenceType;
  score: number; // 0-100
  description: string;
  timestamp?: string;
  source?: string;
}

export interface AttributionResult {
  entityId: string;
  entityType: EntityType;
  entityName?: string;
  confidence: number; // 0-100
  reasoning: string;
  evidence: AttributionEvidence[];
  role?: 'LEADER' | 'FOLLOWER' | 'OPPOSITION' | 'NEUTRAL';
}

export interface FlowAttributionRequest {
  ticker: string;
  flowType: 'CALL' | 'PUT';
  premium: number;
  strike?: number;
  expiry?: string;
  timestamp: string;
}

export interface FlowAttributionResponse {
  success: boolean;
  flowId: string;
  ticker: string;
  attributions: AttributionResult[];
  conflictingEntities?: AttributionResult[];
  overallConfidence: number;
  timestamp: string;
}

export interface InstitutionAttributionRequest {
  institutionId: string;
  ticker: string;
  period?: string; // '1M', '3M', '6M', '1Y'
}

export interface InstitutionAttributionResponse {
  success: boolean;
  institutionId: string;
  ticker: string;
  influenceScore: number; // 0-100
  attribution: AttributionResult;
  historicalPatterns: HistoricalPattern[];
  correlations: Correlation[];
  timestamp: string;
}

export interface HistoricalPattern {
  type: string;
  frequency: number;
  averageImpact: number;
  lastOccurrence: string;
  description: string;
}

export interface Correlation {
  entityId: string;
  entityType: EntityType;
  correlationScore: number; // -100 to 100
  description: string;
}
```

---

### 2. Service d'Attribution Principal

**`services/api/src/services/attribution.service.ts`**
```typescript
import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import * as fmp from '../fmp';
import * as uw from '../unusual-whales';
import { GraphService } from './graph.service';
import type {
  FlowAttributionRequest,
  FlowAttributionResponse,
  AttributionResult,
  AttributionEvidence,
  InstitutionAttributionRequest,
  InstitutionAttributionResponse,
} from '../types/attribution';

export class AttributionService {
  private graphService: GraphService;

  constructor() {
    this.graphService = new GraphService();
  }

  /**
   * Attribuer un flow options à des entités spécifiques
   * C'est la fonction principale de l'Attribution Engine
   */
  async attributeFlowToEntities(
    request: FlowAttributionRequest
  ): Promise<FlowAttributionResponse> {
    return handleError(async () => {
      const log = logger.child({
        operation: 'attributeFlowToEntities',
        ticker: request.ticker,
        flowType: request.flowType,
      });

      log.info('Starting flow attribution');

      // 1. Récupérer les positions institutionnelles récentes
      const institutions = await this.getRecentInstitutionalPositions(
        request.ticker
      );

      // 2. Récupérer les transactions insiders récentes
      const insiders = await this.getRecentInsiderTransactions(
        request.ticker
      );

      // 3. Analyser les patterns historiques
      const historicalPatterns = await this.analyzeHistoricalPatterns(
        request.ticker,
        request.flowType
      );

      // 4. Calculer les attributions
      const attributions = await this.calculateAttributions(
        request,
        institutions,
        insiders,
        historicalPatterns
      );

      // 5. Détecter les entités en opposition
      const conflictingEntities = await this.detectConflictingEntities(
        request.ticker,
        request.flowType
      );

      // 6. Calculer la confiance globale
      const overallConfidence = this.calculateOverallConfidence(attributions);

      // 7. Intégrer dans le graphe
      await this.integrateAttributionInGraph(request, attributions);

      log.info('Flow attribution completed', {
        attributionsCount: attributions.length,
        overallConfidence,
      });

      return {
        success: true,
        flowId: this.generateFlowId(request),
        ticker: request.ticker,
        attributions,
        conflictingEntities,
        overallConfidence,
        timestamp: new Date().toISOString(),
      };
    }, 'Attribute flow to entities');
  }

  /**
   * Récupérer les positions institutionnelles récentes
   */
  private async getRecentInstitutionalPositions(
    ticker: string
  ): Promise<InstitutionalPosition[]> {
    const log = logger.child({ operation: 'getRecentInstitutionalPositions' });

    // Récupérer depuis le graphe (si disponible) ou depuis UW/FMP
    const [graphResult, uwResult] = await Promise.allSettled([
      this.graphService.getInstitutionalPositions(ticker),
      uw.getUWInstitutionHoldings({ ticker, limit: 50 }),
    ]);

    const positions: InstitutionalPosition[] = [];

    if (graphResult.status === 'fulfilled') {
      positions.push(...graphResult.value);
    }

    if (uwResult.status === 'fulfilled' && uwResult.value.success) {
      // Convertir les données UW en positions
      uwResult.value.data.forEach((holding: any) => {
        positions.push({
          institutionId: holding.cik || holding.name,
          institutionName: holding.name,
          shares: holding.shares || 0,
          value: holding.value || 0,
          change: holding.change || 0,
          changePercent: holding.change_percent || 0,
          filingDate: holding.filing_date,
        });
      });
    }

    log.info('Institutional positions retrieved', { count: positions.length });

    return positions;
  }

  /**
   * Récupérer les transactions insiders récentes
   */
  private async getRecentInsiderTransactions(
    ticker: string
  ): Promise<InsiderTransaction[]> {
    const log = logger.child({ operation: 'getRecentInsiderTransactions' });

    const [graphResult, uwResult] = await Promise.allSettled([
      this.graphService.getInsiderTransactions(ticker),
      uw.getUWInsiderTransactions({ ticker, limit: 50 }),
    ]);

    const transactions: InsiderTransaction[] = [];

    if (graphResult.status === 'fulfilled') {
      transactions.push(...graphResult.value);
    }

    if (uwResult.status === 'fulfilled' && uwResult.value.success) {
      uwResult.value.data.forEach((transaction: any) => {
        transactions.push({
          insiderId: transaction.owner_name,
          insiderName: transaction.owner_name,
          ticker: transaction.ticker,
          transactionType: transaction.transaction_code,
          amount: transaction.amount || 0,
          price: transaction.price || 0,
          date: transaction.transaction_date,
        });
      });
    }

    log.info('Insider transactions retrieved', { count: transactions.length });

    return transactions;
  }

  /**
   * Analyser les patterns historiques
   */
  private async analyzeHistoricalPatterns(
    ticker: string,
    flowType: 'CALL' | 'PUT'
  ): Promise<HistoricalPattern[]> {
    const log = logger.child({ operation: 'analyzeHistoricalPatterns' });

    // Récupérer les flows historiques depuis le graphe ou UW
    const [graphResult, uwResult] = await Promise.allSettled([
      this.graphService.getHistoricalFlows(ticker, flowType),
      uw.getUWRecentFlows({ ticker, limit: 100 }),
    ]);

    const patterns: HistoricalPattern[] = [];

    // Analyser les patterns (exemple simplifié)
    // En production, utiliser du machine learning ou des heuristiques avancées

    log.info('Historical patterns analyzed', { count: patterns.length });

    return patterns;
  }

  /**
   * Calculer les attributions
   * C'est le cœur de l'algorithme d'attribution
   */
  private async calculateAttributions(
    request: FlowAttributionRequest,
    institutions: InstitutionalPosition[],
    insiders: InsiderTransaction[],
    historicalPatterns: HistoricalPattern[]
  ): Promise<AttributionResult[]> {
    const log = logger.child({ operation: 'calculateAttributions' });

    const attributions: AttributionResult[] = [];

    // 1. Attribuer aux institutions
    for (const institution of institutions) {
      const attribution = await this.attributeToInstitution(
        request,
        institution,
        historicalPatterns
      );

      if (attribution.confidence > 50) {
        attributions.push(attribution);
      }
    }

    // 2. Attribuer aux insiders
    for (const insider of insiders) {
      const attribution = await this.attributeToInsider(
        request,
        insider,
        historicalPatterns
      );

      if (attribution.confidence > 50) {
        attributions.push(attribution);
      }
    }

    // 3. Trier par confiance
    attributions.sort((a, b) => b.confidence - a.confidence);

    log.info('Attributions calculated', { count: attributions.length });

    return attributions;
  }

  /**
   * Attribuer un flow à une institution
   */
  private async attributeToInstitution(
    request: FlowAttributionRequest,
    institution: InstitutionalPosition,
    historicalPatterns: HistoricalPattern[]
  ): Promise<AttributionResult> {
    const evidence: AttributionEvidence[] = [];
    let confidence = 0;

    // 1. Vérifier le changement de position récent
    if (institution.change > 0 && institution.changePercent > 5) {
      const score = Math.min(90, institution.changePercent * 2);
      evidence.push({
        type: 'POSITION_CHANGE',
        score,
        description: `${institution.institutionName} a augmenté sa position de ${institution.changePercent}%`,
      });
      confidence += score * 0.4; // 40% du poids
    }

    // 2. Vérifier le timing (position récente vs flow récent)
    if (institution.filingDate) {
      const daysDiff = this.calculateDaysDifference(
        institution.filingDate,
        request.timestamp
      );

      if (daysDiff <= 30) {
        const score = Math.max(0, 100 - daysDiff * 3);
        evidence.push({
          type: 'TIMING_CORRELATION',
          score,
          description: `Changement de position il y a ${daysDiff} jours`,
        });
        confidence += score * 0.3; // 30% du poids
      }
    }

    // 3. Vérifier les patterns historiques
    const matchingPattern = historicalPatterns.find(
      (p) => p.type === institution.institutionId
    );

    if (matchingPattern && matchingPattern.frequency > 2) {
      const score = Math.min(80, matchingPattern.frequency * 15);
      evidence.push({
        type: 'HISTORICAL_PATTERN',
        score,
        description: `Pattern historique détecté (${matchingPattern.frequency} occurrences)`,
      });
      confidence += score * 0.3; // 30% du poids
    }

    // 4. Vérifier la centralité dans le graphe
    const centrality = await this.graphService.getEntityCentrality(
      institution.institutionId,
      'Institution'
    );

    if (centrality > 0.5) {
      evidence.push({
        type: 'GRAPH_CENTRALITY',
        score: centrality * 100,
        description: `Institution hautement connectée (centralité: ${centrality.toFixed(2)})`,
      });
      confidence += centrality * 100 * 0.1; // 10% du poids
    }

    // Normaliser la confiance
    confidence = Math.min(100, confidence);

    return {
      entityId: institution.institutionId,
      entityType: 'Institution',
      entityName: institution.institutionName,
      confidence: Math.round(confidence),
      reasoning: this.generateReasoning(evidence, confidence),
      evidence,
    };
  }

  /**
   * Attribuer un flow à un insider
   */
  private async attributeToInsider(
    request: FlowAttributionRequest,
    insider: InsiderTransaction,
    historicalPatterns: HistoricalPattern[]
  ): Promise<AttributionResult> {
    const evidence: AttributionEvidence[] = [];
    let confidence = 0;

    // 1. Vérifier le type de transaction
    if (insider.transactionType === 'P' || insider.transactionType === 'A') {
      // Purchase ou Acquisition
      const score = 75;
      evidence.push({
        type: 'INSIDER_TRANSACTION',
        score,
        description: `${insider.insiderName} a acheté ${Math.abs(insider.amount)} shares`,
      });
      confidence += score * 0.5; // 50% du poids
    }

    // 2. Vérifier le timing
    const daysDiff = this.calculateDaysDifference(insider.date, request.timestamp);

    if (daysDiff <= 7) {
      const score = Math.max(0, 100 - daysDiff * 10);
      evidence.push({
        type: 'TIMING_CORRELATION',
        score,
        description: `Transaction insider il y a ${daysDiff} jours`,
      });
      confidence += score * 0.3; // 30% du poids
    }

    // 3. Vérifier les patterns historiques
    const matchingPattern = historicalPatterns.find(
      (p) => p.type === insider.insiderId
    );

    if (matchingPattern) {
      const score = Math.min(70, matchingPattern.frequency * 20);
      evidence.push({
        type: 'HISTORICAL_PATTERN',
        score,
        description: `Pattern historique détecté`,
      });
      confidence += score * 0.2; // 20% du poids
    }

    confidence = Math.min(100, confidence);

    return {
      entityId: insider.insiderId,
      entityType: 'Insider',
      entityName: insider.insiderName,
      confidence: Math.round(confidence),
      reasoning: this.generateReasoning(evidence, confidence),
      evidence,
    };
  }

  /**
   * Détecter les entités en opposition
   */
  private async detectConflictingEntities(
    ticker: string,
    flowType: 'CALL' | 'PUT'
  ): Promise<AttributionResult[]> {
    const conflicting: AttributionResult[] = [];

    // Si c'est un flow de CALLs, chercher les entités avec PUTs ou short intérêt
    if (flowType === 'CALL') {
      // Récupérer les entités avec short intérêt élevé
      const shortInterest = await uw.getUWShortInterest({ ticker });

      if (shortInterest.success && shortInterest.data.length > 0) {
        const si = shortInterest.data[0];
        if (si.percent_returned > 20) {
          // Short intérêt élevé
          conflicting.push({
            entityId: 'market-shorts',
            entityType: 'Unknown',
            confidence: 70,
            reasoning: `Short intérêt élevé (${si.percent_returned}%)`,
            evidence: [
              {
                type: 'BEHAVIORAL_PATTERN',
                score: 70,
                description: `Short intérêt de ${si.percent_returned}%`,
              },
            ],
            role: 'OPPOSITION',
          });
        }
      }
    }

    return conflicting;
  }

  /**
   * Calculer la confiance globale
   */
  private calculateOverallConfidence(
    attributions: AttributionResult[]
  ): number {
    if (attributions.length === 0) return 0;

    // Moyenne pondérée par la confiance
    const totalConfidence = attributions.reduce(
      (sum, attr) => sum + attr.confidence,
      0
    );

    return Math.round(totalConfidence / attributions.length);
  }

  /**
   * Intégrer l'attribution dans le graphe
   */
  private async integrateAttributionInGraph(
    request: FlowAttributionRequest,
    attributions: AttributionResult[]
  ): Promise<void> {
    // Créer un nœud Flow dans le graphe
    const flowId = this.generateFlowId(request);

    await this.graphService.createOrUpdateNode('Flow', {
      id: flowId,
      ticker: request.ticker,
      flowType: request.flowType,
      premium: request.premium,
      strike: request.strike,
      expiry: request.expiry,
      timestamp: request.timestamp,
    });

    // Créer les relations Flow -> ATTRIBUTED_TO -> Entity
    for (const attribution of attributions) {
      await this.graphService.createOrUpdateRelationship(
        { type: 'Flow', id: flowId },
        { type: attribution.entityType, id: attribution.entityId },
        'ATTRIBUTED_TO',
        {
          confidence: attribution.confidence,
          reasoning: attribution.reasoning,
        }
      );
    }
  }

  // Helpers
  private generateFlowId(request: FlowAttributionRequest): string {
    return `${request.ticker}-${request.flowType}-${request.timestamp}`;
  }

  private calculateDaysDifference(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.abs(Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
  }

  private generateReasoning(
    evidence: AttributionEvidence[],
    confidence: number
  ): string {
    if (evidence.length === 0) return 'Aucune preuve trouvée';

    const topEvidence = evidence
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((e) => e.description)
      .join('; ');

    return `Confiance ${confidence}%: ${topEvidence}`;
  }
}

// Types internes
interface InstitutionalPosition {
  institutionId: string;
  institutionName: string;
  shares: number;
  value: number;
  change: number;
  changePercent: number;
  filingDate?: string;
}

interface InsiderTransaction {
  insiderId: string;
  insiderName: string;
  ticker: string;
  transactionType: string;
  amount: number;
  price: number;
  date: string;
}
```

---

### 3. Routes API

**`services/api/src/routes/attribution.routes.ts`**
```typescript
import type { Route } from '../types/router';
import { getPathParam, getQueryParam, getBody } from '../utils/router';
import { AttributionService } from '../services/attribution.service';

const attributionService = new AttributionService();

export const attributionRoutes: Route[] = [
  // Attribuer un flow options à des entités
  {
    method: "POST",
    path: "/attribution/flow",
    handler: async (event) => {
      const body = getBody(event);
      return await attributionService.attributeFlowToEntities(body);
    },
  },

  // Attribuer l'influence d'une institution sur un ticker
  {
    method: "GET",
    path: "/attribution/institution/{institutionId}/ticker/{ticker}",
    handler: async (event) => {
      const institutionId = getPathParam(event, "institutionId");
      const ticker = getPathParam(event, "ticker");
      const period = getQueryParam(event, "period") || "3M";
      
      return await attributionService.attributeInstitutionInfluence({
        institutionId,
        ticker,
        period,
      });
    },
  },

  // Trouver les entités dominantes pour un ticker
  {
    method: "GET",
    path: "/attribution/dominant-entities/{ticker}",
    handler: async (event) => {
      const ticker = getPathParam(event, "ticker");
      return await attributionService.findDominantEntities(ticker);
    },
  },

  // Clustering institutionnel
  {
    method: "GET",
    path: "/attribution/clusters",
    handler: async (event) => {
      const sector = getQueryParam(event, "sector");
      return await attributionService.clusterInstitutions(sector);
    },
  },
];
```

---

### 4. Interface Publique

**`services/api/src/attribution.ts`**
```typescript
import { AttributionService } from './services/attribution.service';

const attributionService = new AttributionService();

export async function attributeFlowToEntities(request: FlowAttributionRequest) {
  return await attributionService.attributeFlowToEntities(request);
}

export async function attributeInstitutionInfluence(request: InstitutionAttributionRequest) {
  return await attributionService.attributeInstitutionInfluence(request);
}

export async function findDominantEntities(ticker: string) {
  return await attributionService.findDominantEntities(ticker);
}

export async function clusterInstitutions(sector?: string) {
  return await attributionService.clusterInstitutions(sector);
}
```

---

## 🧪 Exemples d'Utilisation

### Exemple 1 : Attribuer un flow de CALLs

```bash
POST /attribution/flow
{
  "ticker": "NVDA",
  "flowType": "CALL",
  "premium": 2000000,
  "strike": 500,
  "expiry": "2026-01-15",
  "timestamp": "2025-12-07T10:00:00Z"
}
```

**Réponse** :
```json
{
  "success": true,
  "flowId": "nvda-call-2025-12-07T10:00:00Z",
  "ticker": "NVDA",
  "attributions": [
    {
      "entityId": "0001364742",
      "entityType": "Institution",
      "entityName": "BlackRock Inc",
      "confidence": 85,
      "reasoning": "Confiance 85%: BlackRock Inc a augmenté sa position de 12%; Changement de position il y a 5 jours",
      "evidence": [
        {
          "type": "POSITION_CHANGE",
          "score": 90,
          "description": "BlackRock Inc a augmenté sa position de 12%"
        },
        {
          "type": "TIMING_CORRELATION",
          "score": 85,
          "description": "Changement de position il y a 5 jours"
        }
      ]
    }
  ],
  "overallConfidence": 85,
  "timestamp": "2025-12-07T10:00:00Z"
}
```

---

### Exemple 2 : Trouver les entités dominantes

```bash
GET /attribution/dominant-entities/NVDA
```

**Réponse** :
```json
{
  "success": true,
  "ticker": "NVDA",
  "dominantEntities": [
    {
      "entityId": "0001364742",
      "entityType": "Institution",
      "entityName": "BlackRock Inc",
      "influenceScore": 92,
      "reasoning": "Position majeure + flows actifs + centralité élevée"
    },
    {
      "entityId": "0000102909",
      "entityType": "Institution",
      "entityName": "Vanguard Group Inc",
      "influenceScore": 88,
      "reasoning": "Position majeure + corrélations fortes"
    }
  ],
  "timestamp": "2025-12-07T10:00:00Z"
}
```

---

## 📋 Checklist d'Implémentation

- [ ] **Types TypeScript**
  - [ ] Créer `types/attribution.ts`
  - [ ] Définir tous les types nécessaires

- [ ] **Service d'Attribution**
  - [ ] Créer `services/attribution.service.ts`
  - [ ] Implémenter `attributeFlowToEntities`
  - [ ] Implémenter `attributeToInstitution`
  - [ ] Implémenter `attributeToInsider`
  - [ ] Implémenter `detectConflictingEntities`
  - [ ] Implémenter `integrateAttributionInGraph`

- [ ] **Routes API**
  - [ ] Créer `routes/attribution.routes.ts`
  - [ ] Ajouter route `POST /attribution/flow`
  - [ ] Ajouter route `GET /attribution/institution/{id}/ticker/{ticker}`
  - [ ] Ajouter route `GET /attribution/dominant-entities/{ticker}`
  - [ ] Ajouter route `GET /attribution/clusters`

- [ ] **Intégration**
  - [ ] Intégrer dans `router.ts`
  - [ ] Ajouter routes Terraform
  - [ ] Tests unitaires
  - [ ] Tests d'intégration

- [ ] **Graph Service** (dépendance)
  - [ ] Créer `services/graph.service.ts` (Phase 1)
  - [ ] Implémenter méthodes nécessaires

---

## 🎯 Prochaines Étapes

1. **Implémenter les types** (`types/attribution.ts`)
2. **Créer le service de base** (`services/attribution.service.ts`)
3. **Tester avec un flow simple** (NVDA, AAPL)
4. **Intégrer avec le graphe** (une fois Phase 1 complétée)
5. **Améliorer l'algorithme** (machine learning, heuristiques avancées)

---

**Dernière mise à jour** : 2025-12-07  
**Version** : 1.0  
**Auteur** : Équipe Backend Personamy








