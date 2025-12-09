/**
 * Service de Flow Signature Matching
 * Match les flows avec les patterns historiques des institutions
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import * as uw from '../unusual-whales';
import { GraphService } from './graph.service';
import type {
  FlowAttributionRequest,
  FlowSignature,
  FlowSignatureMatch,
} from '../types/attribution';

export class FlowSignatureService {
  private graphService: GraphService;

  constructor() {
    this.graphService = new GraphService();
  }

  /**
   * Matcher un flow avec les signatures historiques des institutions
   */
  async matchFlowSignature(
    request: FlowAttributionRequest,
    institutionId: string
  ): Promise<FlowSignatureMatch | null> {
    return handleError(async () => {
      const log = logger.child({
        operation: 'matchFlowSignature',
        ticker: request.ticker,
        institutionId,
        strike: request.strike,
        expiry: request.expiry,
      });

      log.info('Matching flow signature');

      // 1. Récupérer les flows historiques de cette institution pour ce ticker
      const historicalFlows = await this.getInstitutionHistoricalFlows(
        institutionId,
        request.ticker,
        request.flowType
      );

      if (historicalFlows.length === 0) {
        return null; // Pas de pattern historique
      }

      // 2. Analyser les patterns (strike range, expiry range)
      const signature = this.analyzeFlowPattern(
        historicalFlows,
        request.flowType
      );

      // 3. Matcher le flow actuel avec la signature
      const matchScore = this.calculateMatchScore(request, signature);

      if (matchScore < 30) {
        return null; // Match trop faible
      }

      log.info('Flow signature matched', {
        institutionId,
        matchScore,
        frequency: signature.frequency,
      });

      return {
        institutionId,
        institutionName: institutionId, // Sera rempli par l'appelant
        matchScore,
        signature,
        reasoning: this.generateSignatureReasoning(signature, matchScore),
      };
    }, 'Match flow signature');
  }

  /**
   * Récupérer les flows historiques d'une institution
   */
  private async getInstitutionHistoricalFlows(
    institutionId: string,
    ticker: string,
    flowType: 'CALL' | 'PUT'
  ): Promise<any[]> {
    // Récupérer depuis le graphe (si disponible)
    const graphFlows = await this.graphService.getHistoricalFlows(ticker, flowType);

    // Filtrer par institution (si l'info est disponible dans le graphe)
    // Pour l'instant, on récupère tous les flows et on les analyse
    // En production, le graphe devrait avoir des relations Flow -> ATTRIBUTED_TO -> Institution

    // Récupérer aussi depuis UW (flows récents)
    const uwResult = await Promise.allSettled([
      uw.getUWRecentFlows(ticker, {}),
    ]);

    const allFlows: any[] = [];

    // Ajouter les flows du graphe
    allFlows.push(...graphFlows);

    // Ajouter les flows UW
    if (uwResult[0].status === 'fulfilled' && uwResult[0].value.success) {
      const uwFlows = uwResult[0].value.data || [];
      allFlows.push(...uwFlows);
    }

    return allFlows;
  }

  /**
   * Analyser le pattern de flows historiques
   */
  private analyzeFlowPattern(
    flows: any[],
    flowType: 'CALL' | 'PUT'
  ): FlowSignature {
    if (flows.length === 0) {
      throw new Error('No flows to analyze');
    }

    // Filtrer par type
    const typedFlows = flows.filter((f: any) => 
      f.flowType === flowType || 
      f.type === flowType || 
      f.call_put === flowType
    );

    if (typedFlows.length === 0) {
      throw new Error('No flows of the specified type');
    }

    // Extraire strikes et expiries
    const strikes = typedFlows
      .map((f: any) => parseFloat(f.strike || f.strike_price || '0'))
      .filter((s: number) => s > 0);

    const expiries = typedFlows
      .map((f: any) => f.expiry || f.expiration_date || f.expiry_date)
      .filter((e: string) => e);

    const premiums = typedFlows
      .map((f: any) => parseFloat(f.premium || f.total_premium || '0'))
      .filter((p: number) => p > 0);

    // Calculer les ranges
    const strikeRange = {
      min: Math.min(...strikes),
      max: Math.max(...strikes),
    };

    const expiryRange = {
      min: expiries.length > 0 ? Math.min(...expiries.map((e: string) => new Date(e).getTime())).toString() : '',
      max: expiries.length > 0 ? Math.max(...expiries.map((e: string) => new Date(e).getTime())).toString() : '',
    };

    const averagePremium = premiums.length > 0
      ? premiums.reduce((sum, p) => sum + p, 0) / premiums.length
      : 0;

    const lastOccurrence = typedFlows.length > 0
      ? typedFlows[0].timestamp || typedFlows[0].date || new Date().toISOString()
      : new Date().toISOString();

    return {
      institutionId: '', // Sera rempli par l'appelant
      institutionName: '',
      strikeRange,
      expiryRange: {
        min: expiryRange.min ? new Date(parseInt(expiryRange.min)).toISOString() : '',
        max: expiryRange.max ? new Date(parseInt(expiryRange.max)).toISOString() : '',
      },
      flowType,
      frequency: typedFlows.length,
      averagePremium,
      lastOccurrence,
      matchScore: 0, // Sera calculé lors du matching
    };
  }

  /**
   * Calculer le score de match entre un flow et une signature
   */
  private calculateMatchScore(
    request: FlowAttributionRequest,
    signature: FlowSignature
  ): number {
    let score = 0;
    let factors = 0;

    // 1. Match du strike (40% du poids)
    if (request.strike && signature.strikeRange.min > 0) {
      const strikeMatch = this.matchStrike(
        request.strike,
        signature.strikeRange.min,
        signature.strikeRange.max
      );
      score += strikeMatch * 0.4;
      factors += 0.4;
    }

    // 2. Match de l'expiry (30% du poids)
    if (request.expiry && signature.expiryRange.min) {
      const expiryMatch = this.matchExpiry(
        request.expiry,
        signature.expiryRange.min,
        signature.expiryRange.max
      );
      score += expiryMatch * 0.3;
      factors += 0.3;
    }

    // 3. Match du premium (20% du poids)
    if (request.premium > 0 && signature.averagePremium > 0) {
      const premiumMatch = this.matchPremium(
        request.premium,
        signature.averagePremium
      );
      score += premiumMatch * 0.2;
      factors += 0.2;
    }

    // 4. Fréquence du pattern (10% du poids)
    const frequencyScore = Math.min(100, signature.frequency * 10);
    score += frequencyScore * 0.1;
    factors += 0.1;

    // Normaliser si certains facteurs manquent
    if (factors < 1) {
      score = score / factors;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Matcher un strike avec un range
   */
  private matchStrike(
    strike: number,
    minStrike: number,
    maxStrike: number
  ): number {
    if (strike >= minStrike && strike <= maxStrike) {
      // Dans le range : score basé sur la proximité du centre
      const center = (minStrike + maxStrike) / 2;
      const range = maxStrike - minStrike;
      const distanceFromCenter = Math.abs(strike - center);
      return Math.max(50, 100 - (distanceFromCenter / range) * 50);
    } else {
      // Hors range : pénalité basée sur la distance
      const distance = strike < minStrike 
        ? minStrike - strike 
        : strike - maxStrike;
      const range = maxStrike - minStrike;
      return Math.max(0, 50 - (distance / range) * 50);
    }
  }

  /**
   * Matcher un expiry avec un range
   */
  private matchExpiry(
    expiry: string,
    minExpiry: string,
    maxExpiry: string
  ): number {
    const expiryDate = new Date(expiry).getTime();
    const minDate = new Date(minExpiry).getTime();
    const maxDate = new Date(maxExpiry).getTime();

    if (expiryDate >= minDate && expiryDate <= maxDate) {
      const center = (minDate + maxDate) / 2;
      const range = maxDate - minDate;
      const distanceFromCenter = Math.abs(expiryDate - center);
      return Math.max(50, 100 - (distanceFromCenter / range) * 50);
    } else {
      const distance = expiryDate < minDate 
        ? minDate - expiryDate 
        : expiryDate - maxDate;
      const range = maxDate - minDate;
      return Math.max(0, 50 - (distance / range) * 50);
    }
  }

  /**
   * Matcher un premium avec la moyenne historique
   */
  private matchPremium(
    premium: number,
    averagePremium: number
  ): number {
    if (averagePremium === 0) return 50;

    const ratio = premium / averagePremium;
    
    // Ratio proche de 1 = meilleur match
    if (ratio >= 0.8 && ratio <= 1.2) {
      return 100; // Très proche
    } else if (ratio >= 0.5 && ratio <= 2.0) {
      return 75; // Proche
    } else if (ratio >= 0.3 && ratio <= 3.0) {
      return 50; // Modéré
    } else {
      return 25; // Loin
    }
  }

  /**
   * Générer le reasoning pour une signature matchée
   */
  private generateSignatureReasoning(
    signature: FlowSignature,
    matchScore: number
  ): string {
    const parts: string[] = [];

    if (matchScore >= 70) {
      parts.push('Pattern historique fortement reconnu');
    } else if (matchScore >= 50) {
      parts.push('Pattern historique partiellement reconnu');
    }

    parts.push(`${signature.frequency} occurrences historiques`);
    
    if (signature.strikeRange.min > 0) {
      parts.push(`Strike range: ${signature.strikeRange.min}-${signature.strikeRange.max}`);
    }

    return parts.join('; ');
  }
}








