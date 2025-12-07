/**
 * Service de détection de Gamma Squeeze
 * Détecte le potentiel de gamma squeeze basé sur GEX, flow d'options, short interest, et greeks
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import * as uw from '../unusual-whales';
import type {
  GammaSqueezeAnalysis,
  GammaSqueezeIndicators,
  GammaSqueezeResponse,
} from '../types/gamma-squeeze';

export class GammaSqueezeService {
  /**
   * Détecte le potentiel de gamma squeeze
   */
  async detectGammaSqueeze(ticker: string): Promise<GammaSqueezeResponse> {
    return handleError(async () => {
      const upperTicker = ticker.toUpperCase();
      const log = logger.child({ ticker: upperTicker, operation: 'detectGammaSqueeze' });
      log.info('Detecting gamma squeeze potential');

      // Récupérer toutes les données en parallèle
      const [
        spotExposures,
        flowRecent,
        shortInterest,
        greeks,
      ] = await Promise.allSettled([
        uw.getUWSpotExposures(upperTicker, {}),
        uw.getUWRecentFlows(upperTicker, { min_premium: 100000 }),
        uw.getUWShortInterestAndFloat(upperTicker),
        uw.getUWGreeks(upperTicker, {}),
      ]);

      log.info('Data fetched for gamma squeeze analysis', {
        spotExposures: spotExposures.status,
        flowRecent: flowRecent.status,
        shortInterest: shortInterest.status,
        greeks: greeks.status,
      });

      // Calculer les indicateurs
      const gex = this.calculateGEX(spotExposures);
      const callFlowRatio = this.calculateCallFlowRatio(flowRecent);
      const shortRatio = this.calculateShortRatio(shortInterest);
      const gammaLevel = this.calculateGammaLevel(greeks);

      log.info('Indicators calculated', {
        gex,
        callFlowRatio,
        shortRatio,
        gammaLevel,
      });

      // Score de probabilité
      const squeezeProbability = this.calculateSqueezeProbability({
        gex,
        callFlowRatio,
        shortRatio,
        gammaLevel,
      });

      const indicators: GammaSqueezeIndicators = {
        gex,
        callFlowRatio,
        shortRatio,
        gammaLevel,
      };

      const riskLevel = this.assessRiskLevel(squeezeProbability);
      const recommendation = this.generateRecommendation(squeezeProbability, indicators);
      const timeframe = this.estimateTimeframe(squeezeProbability, indicators);

      log.info('Gamma squeeze analysis completed', {
        squeezeProbability,
        riskLevel,
        recommendation: recommendation.action,
      });

      const analysis: GammaSqueezeAnalysis = {
        ticker: upperTicker,
        squeezeProbability,
        indicators,
        riskLevel,
        recommendation,
        timeframe,
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        data: analysis,
        cached: false,
        timestamp: new Date().toISOString(),
      };
    }, `Detect gamma squeeze for ${ticker}`);
  }

  /**
   * Calcule le GEX (Gamma Exposure) en millions de dollars
   */
  private calculateGEX(spotExposures: PromiseSettledResult<any>): number {
    if (spotExposures.status === 'rejected' || !spotExposures.value?.data) {
      return 0;
    }

    const data = Array.isArray(spotExposures.value.data)
      ? spotExposures.value.data
      : [spotExposures.value.data];

    // GEX = somme des (gamma * open_interest * 100 * spot_price^2) / 1e6
    let totalGEX = 0;
    for (const item of data) {
      const gamma = parseFloat(item.gamma || item.gamma_exposure || 0);
      const openInterest = parseFloat(item.open_interest || item.oi || 0);
      const spotPrice = parseFloat(item.spot_price || item.price || 0);

      if (gamma && openInterest && spotPrice) {
        // GEX approximatif : gamma * OI * 100 * spot^2
        const gex = (gamma * openInterest * 100 * spotPrice * spotPrice) / 1e6;
        totalGEX += gex;
      }
    }

    return Math.round(totalGEX * 100) / 100; // Arrondir à 2 décimales
  }

  /**
   * Calcule le ratio de flow de calls vs puts
   */
  private calculateCallFlowRatio(flowRecent: PromiseSettledResult<any>): number {
    if (flowRecent.status === 'rejected' || !flowRecent.value?.data) {
      return 0;
    }

    const data = Array.isArray(flowRecent.value.data)
      ? flowRecent.value.data
      : [flowRecent.value.data];

    let callVolume = 0;
    let putVolume = 0;

    for (const item of data) {
      const side = item.side?.toLowerCase();
      const volume = parseFloat(item.volume || item.size || item.contracts || 0);
      const premium = parseFloat(item.premium || item.notional || 0);

      if (side === 'call' || side === 'c') {
        callVolume += premium > 0 ? premium : volume;
      } else if (side === 'put' || side === 'p') {
        putVolume += premium > 0 ? premium : volume;
      }
    }

    if (putVolume === 0) {
      return callVolume > 0 ? 10 : 0; // Ratio max de 10 si pas de puts
    }

    return Math.round((callVolume / putVolume) * 100) / 100;
  }

  /**
   * Calcule le ratio de short interest vs float
   */
  private calculateShortRatio(shortInterest: PromiseSettledResult<any>): number {
    if (shortInterest.status === 'rejected' || !shortInterest.value?.data) {
      return 0;
    }

    const data = Array.isArray(shortInterest.value.data)
      ? shortInterest.value.data
      : shortInterest.value.data;

    // Prendre le premier élément (le plus récent)
    const latest = Array.isArray(data) ? data[0] : data;

    if (!latest) {
      return 0;
    }

    const shortFloat = parseFloat(latest.si_float_returned || latest.short_interest || 0);
    const totalFloat = parseFloat(latest.total_float_returned || latest.float || 0);

    if (totalFloat === 0) {
      return 0;
    }

    return Math.round((shortFloat / totalFloat) * 100) / 100;
  }

  /**
   * Calcule le niveau de gamma moyen (0-100)
   */
  private calculateGammaLevel(greeks: PromiseSettledResult<any>): number {
    if (greeks.status === 'rejected' || !greeks.value?.data) {
      return 0;
    }

    const data = Array.isArray(greeks.value.data)
      ? greeks.value.data
      : [greeks.value.data];

    let totalGamma = 0;
    let count = 0;

    for (const item of data) {
      const gamma = parseFloat(item.gamma || 0);
      if (gamma !== 0 && !isNaN(gamma)) {
        totalGamma += Math.abs(gamma);
        count++;
      }
    }

    if (count === 0) {
      return 0;
    }

    const avgGamma = totalGamma / count;
    // Normaliser entre 0 et 100 (gamma typique entre 0 et 0.1)
    const normalized = Math.min(100, (avgGamma / 0.1) * 100);
    return Math.round(normalized * 100) / 100;
  }

  /**
   * Calcule la probabilité de gamma squeeze (0-100)
   */
  private calculateSqueezeProbability(indicators: GammaSqueezeIndicators): number {
    let probability = 0;

    // GEX élevé = +30 points (si > 50M)
    if (indicators.gex > 50) {
      probability += 30;
    } else if (indicators.gex > 20) {
      probability += 15;
    } else if (indicators.gex > 10) {
      probability += 5;
    }

    // Call flow ratio élevé = +25 points (si > 2.0)
    if (indicators.callFlowRatio > 2.0) {
      probability += 25;
    } else if (indicators.callFlowRatio > 1.5) {
      probability += 15;
    } else if (indicators.callFlowRatio > 1.0) {
      probability += 5;
    }

    // Short ratio élevé = +25 points (si > 0.2 = 20%)
    if (indicators.shortRatio > 0.2) {
      probability += 25;
    } else if (indicators.shortRatio > 0.15) {
      probability += 15;
    } else if (indicators.shortRatio > 0.1) {
      probability += 5;
    }

    // Gamma level élevé = +20 points (si > 50)
    if (indicators.gammaLevel > 50) {
      probability += 20;
    } else if (indicators.gammaLevel > 30) {
      probability += 10;
    } else if (indicators.gammaLevel > 15) {
      probability += 5;
    }

    return Math.min(100, Math.max(0, Math.round(probability)));
  }

  /**
   * Évalue le niveau de risque
   */
  private assessRiskLevel(probability: number): 'low' | 'medium' | 'high' | 'extreme' {
    if (probability >= 70) {
      return 'extreme';
    } else if (probability >= 50) {
      return 'high';
    } else if (probability >= 30) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Génère une recommandation basée sur l'analyse
   */
  private generateRecommendation(
    probability: number,
    indicators: GammaSqueezeIndicators
  ): {
    action: 'buy' | 'hold' | 'sell' | 'avoid';
    confidence: number;
    reasoning: string;
  } {
    if (probability >= 70) {
      return {
        action: 'buy',
        confidence: probability,
        reasoning: `Forte probabilité de gamma squeeze (${probability}%). GEX élevé (${indicators.gex.toFixed(2)}M), ratio calls/puts élevé (${indicators.callFlowRatio.toFixed(2)}), short interest élevé (${(indicators.shortRatio * 100).toFixed(1)}%).`,
      };
    } else if (probability >= 50) {
      return {
        action: 'buy',
        confidence: probability,
        reasoning: `Probabilité modérée de gamma squeeze (${probability}%). Conditions favorables mais nécessite une surveillance étroite.`,
      };
    } else if (probability >= 30) {
      return {
        action: 'hold',
        confidence: 100 - probability,
        reasoning: `Probabilité faible de gamma squeeze (${probability}%). Conditions neutres, pas de signal fort.`,
      };
    } else {
      return {
        action: 'avoid',
        confidence: 100 - probability,
        reasoning: `Probabilité très faible de gamma squeeze (${probability}%). Conditions défavorables pour un squeeze.`,
      };
    }
  }

  /**
   * Estime le timeframe pour un potentiel squeeze
   */
  private estimateTimeframe(
    probability: number,
    indicators: GammaSqueezeIndicators
  ): {
    min: number;
    max: number;
    confidence: number;
  } {
    // Plus la probabilité est élevée, plus le timeframe est court
    let minDays = 30;
    let maxDays = 90;
    let confidence = 30;

    if (probability >= 70) {
      minDays = 1;
      maxDays = 14;
      confidence = 70;
    } else if (probability >= 50) {
      minDays = 7;
      maxDays = 30;
      confidence = 50;
    } else if (probability >= 30) {
      minDays = 14;
      maxDays = 60;
      confidence = 40;
    }

    // Ajuster selon le GEX (GEX élevé = timeframe plus court)
    if (indicators.gex > 50) {
      minDays = Math.max(1, minDays - 5);
      maxDays = Math.max(7, maxDays - 10);
      confidence = Math.min(80, confidence + 10);
    }

    return {
      min: minDays,
      max: maxDays,
      confidence,
    };
  }
}

