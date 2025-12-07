/**
 * Service de scoring automatique
 * Calcule un score composite (0-100) basé sur tous les signaux de marché
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import * as uw from '../unusual-whales';
import type {
  TickerScore,
  TickerScoreResponse,
  ScoreBreakdown,
  ScoreSignals,
  OptionsSignal,
  InsidersSignal,
  DarkPoolSignal,
  ShortInterestSignal,
  GreeksSignal,
  Recommendation,
  ScoreWeights,
} from '../types/scoring';

// Valeurs par défaut inline pour éviter les problèmes d'import au runtime
const DEFAULT_WEIGHTS: ScoreWeights = {
  options: 0.3,
  insiders: 0.2,
  darkPool: 0.2,
  shortInterest: 0.15,
  greeks: 0.15,
};

export class ScoringService {
  private weights: ScoreWeights;

  constructor(weights?: ScoreWeights) {
    this.weights = weights || DEFAULT_WEIGHTS;
  }

  /**
   * Calcule un score composite (0-100) basé sur tous les signaux
   */
  async calculateTickerScore(ticker: string): Promise<TickerScoreResponse> {
    return handleError(async () => {
      const upperTicker = ticker.toUpperCase();
      const log = logger.child({ ticker: upperTicker, operation: 'calculateTickerScore' });
      log.info('Calculating ticker score');

      // Récupérer toutes les données en parallèle
      const [
        optionsFlow,
        insiderActivity,
        darkPoolTrades,
        shortInterest,
        greeks,
        maxPain,
      ] = await Promise.allSettled([
        uw.getUWRecentFlows(upperTicker, { min_premium: 50000 }),
        uw.getUWStockInsiderBuySells(upperTicker, {}),
        uw.getUWDarkPoolTrades(upperTicker, { limit: 50 }),
        uw.getUWShortInterestAndFloat(upperTicker),
        this.getLatestGreeks(upperTicker),
        uw.getUWMaxPain(upperTicker, {}),
      ]);

      log.info('Data fetched for scoring', {
        optionsFlow: optionsFlow.status,
        insiderActivity: insiderActivity.status,
        darkPoolTrades: darkPoolTrades.status,
        shortInterest: shortInterest.status,
        greeks: greeks.status,
        maxPain: maxPain.status,
      });

      // Calculer les sous-scores
      const optionsSignal = this.scoreOptionsFlow(optionsFlow);
      const insidersSignal = this.scoreInsiderActivity(insiderActivity);
      const darkPoolSignal = this.scoreDarkPoolTrades(darkPoolTrades);
      const shortInterestSignal = this.scoreShortInterest(shortInterest);
      const greeksSignal = this.scoreGreeks(greeks, maxPain);

      // Score composite pondéré
      const overall = Math.round(
        optionsSignal.score * this.weights.options +
        insidersSignal.score * this.weights.insiders +
        darkPoolSignal.score * this.weights.darkPool +
        shortInterestSignal.score * this.weights.shortInterest +
        greeksSignal.score * this.weights.greeks
      );

      // Normaliser entre 0 et 100
      const normalizedOverall = Math.max(0, Math.min(100, overall));

      // Générer la recommandation
      const recommendation = this.generateRecommendation(normalizedOverall);

      // Calculer la confiance basée sur la disponibilité des données
      const confidence = this.calculateConfidence([
        optionsFlow,
        insiderActivity,
        darkPoolTrades,
        shortInterest,
        greeks,
        maxPain,
      ]);

      log.info('Score calculated', {
        overall: normalizedOverall,
        recommendation,
        confidence,
        breakdown: {
          options: optionsSignal.score,
          insiders: insidersSignal.score,
          darkPool: darkPoolSignal.score,
          shortInterest: shortInterestSignal.score,
          greeks: greeksSignal.score,
        },
      });

      const breakdown: ScoreBreakdown = {
        options: optionsSignal.score,
        insiders: insidersSignal.score,
        darkPool: darkPoolSignal.score,
        shortInterest: shortInterestSignal.score,
        greeks: greeksSignal.score,
      };

      const signals: ScoreSignals = {
        options: optionsSignal,
        insiders: insidersSignal,
        darkPool: darkPoolSignal,
        shortInterest: shortInterestSignal,
        greeks: greeksSignal,
      };

      const score: TickerScore = {
        ticker: upperTicker,
        overall: normalizedOverall,
        breakdown,
        recommendation,
        confidence,
        signals,
      };

      return {
        success: true,
        data: score,
        cached: false,
        timestamp: new Date().toISOString(),
      };
    }, `Calculate ticker score for ${ticker}`);
  }

  /**
   * Récupère les greeks les plus récents (première expiration disponible)
   */
  private async getLatestGreeks(ticker: string): Promise<any> {
    // Essayer de récupérer les greeks pour l'expiration la plus proche
    // Pour simplifier, on utilise une date d'expiration proche (ex: 7 jours)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const expiry = futureDate.toISOString().split('T')[0];

    // Si l'API échoue, Promise.allSettled capturera l'erreur automatiquement
    return await uw.getUWGreeks(ticker, { expiry });
  }

  /**
   * Score les options flow (0-100)
   */
  private scoreOptionsFlow(optionsFlow: PromiseSettledResult<any>): OptionsSignal {
    if (optionsFlow.status !== 'fulfilled' || !optionsFlow.value?.success || !optionsFlow.value.data) {
      return {
        score: 50,
        callPutRatio: 1,
        callVolume: 0,
        putVolume: 0,
        unusualActivity: 0,
        interpretation: 'Données d\'options non disponibles',
      };
    }

    const flows = Array.isArray(optionsFlow.value.data) ? optionsFlow.value.data : [];
    const calls = flows.filter((f: any) => f.is_call && (f.premium > 0 || f.volume > 0));
    const puts = flows.filter((f: any) => f.is_put && (f.premium > 0 || f.volume > 0));

    const callVolume = calls.reduce((sum: number, c: any) => sum + (c.volume || c.size || c.contracts || 0), 0);
    const putVolume = puts.reduce((sum: number, p: any) => sum + (p.volume || p.size || p.contracts || 0), 0);

    const callPutRatio = putVolume > 0
      ? callVolume / putVolume
      : calls.length > 0 && puts.length > 0
      ? calls.length / puts.length
      : calls.length > 0
      ? 2
      : puts.length > 0
      ? 0.5
      : 1;

    const unusualActivity = flows.filter((f: any) =>
      f.is_sweep || f.is_block || f.is_floor || (f.premium && f.premium > 100000) || (f.size && f.size > 1000)
    ).length;

    let score = 50;
    if (callPutRatio > 1.5) score += 25;
    else if (callPutRatio > 1.2) score += 15;
    else if (callPutRatio < 0.7) score -= 25;
    else if (callPutRatio < 0.8) score -= 15;

    if (unusualActivity > 10) score += 15;
    else if (unusualActivity > 5) score += 10;
    else if (unusualActivity === 0 && flows.length > 0) score -= 10;

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      callPutRatio: Math.round(callPutRatio * 100) / 100,
      callVolume,
      putVolume,
      unusualActivity,
      interpretation: callPutRatio > 1.5
        ? 'Flow d\'options très positif (beaucoup de calls)'
        : callPutRatio < 0.7
        ? 'Flow d\'options négatif (beaucoup de puts)'
        : 'Flow d\'options neutre',
    };
  }

  /**
   * Score l'activité des insiders (0-100)
   */
  private scoreInsiderActivity(insiderActivity: PromiseSettledResult<any>): InsidersSignal {
    if (insiderActivity.status !== 'fulfilled' || !insiderActivity.value?.success || !insiderActivity.value.data) {
      return {
        score: 50,
        buys: 0,
        sells: 0,
        netActivity: 0,
        interpretation: 'Données d\'insiders non disponibles',
      };
    }

    const trades = Array.isArray(insiderActivity.value.data) ? insiderActivity.value.data : [];

    let buys = trades.filter((t: any) =>
      t.transaction_code === 'P' ||
      t.transaction_type === 'BUY' ||
      (t.units_change && t.units_change > 0)
    );
    let sells = trades.filter((t: any) =>
      t.transaction_code === 'S' ||
      t.transaction_type === 'SELL' ||
      (t.units_change && t.units_change < 0)
    );

    if (buys.length === 0 && sells.length === 0) {
      const totalPurchases = trades.reduce((sum: number, t: any) => sum + (t.purchases || 0), 0);
      const totalSells = trades.reduce((sum: number, t: any) => sum + (t.sells || 0), 0);
      buys = totalPurchases > 0 ? [{ count: totalPurchases }] : [];
      sells = totalSells > 0 ? [{ count: totalSells }] : [];
    }

    const buyCount = buys.length > 0 && buys[0].count !== undefined
      ? buys.reduce((sum: number, b: any) => sum + (b.count || 0), 0)
      : buys.length;
    const sellCount = sells.length > 0 && sells[0].count !== undefined
      ? sells.reduce((sum: number, s: any) => sum + (s.count || 0), 0)
      : sells.length;

    const netActivity = buyCount - sellCount;

    let score = 50;
    if (netActivity > 5) score += 30;
    else if (netActivity > 3) score += 20;
    else if (netActivity > 0) score += 10;
    else if (netActivity < -5) score -= 30;
    else if (netActivity < -3) score -= 20;
    else if (netActivity < 0) score -= 10;

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      buys: buyCount,
      sells: sellCount,
      netActivity,
      interpretation: netActivity > 0
        ? 'Insiders achètent activement - Signe très positif'
        : netActivity < 0
        ? 'Insiders vendent activement - Signe négatif'
        : 'Activité d\'insiders neutre',
    };
  }

  /**
   * Score les dark pool trades (0-100)
   */
  private scoreDarkPoolTrades(darkPoolTrades: PromiseSettledResult<any>): DarkPoolSignal {
    if (darkPoolTrades.status !== 'fulfilled' || !darkPoolTrades.value?.success || !darkPoolTrades.value.data) {
      return {
        score: 50,
        trades: 0,
        volume: 0,
        interpretation: 'Données de dark pool non disponibles',
      };
    }

    const trades = Array.isArray(darkPoolTrades.value.data) ? darkPoolTrades.value.data : [];
    const totalVolume = trades.reduce((sum: number, t: any) => sum + (t.volume || t.size || 0), 0);

    let score = 50;
    if (trades.length > 30) score += 20;
    else if (trades.length > 20) score += 15;
    else if (trades.length > 10) score += 10;
    else if (trades.length === 0) score -= 10;

    if (totalVolume > 10000000) score += 10;
    else if (totalVolume > 1000000) score += 5;

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      trades: trades.length,
      volume: totalVolume,
      interpretation: trades.length > 20
        ? 'Activité dark pool élevée - Signe d\'intérêt institutionnel fort'
        : trades.length > 10
        ? 'Activité dark pool modérée'
        : 'Activité dark pool faible',
    };
  }

  /**
   * Score le short interest (0-100)
   */
  private scoreShortInterest(shortInterest: PromiseSettledResult<any>): ShortInterestSignal {
    if (shortInterest.status !== 'fulfilled' || !shortInterest.value?.success || !shortInterest.value.data) {
      return {
        score: 50,
        shortPercentOfFloat: 0,
        daysToCover: 0,
        interpretation: 'Données de short interest non disponibles',
      };
    }

    const si = Array.isArray(shortInterest.value.data)
      ? shortInterest.value.data[0]
      : shortInterest.value.data;

    if (!si || typeof si !== 'object') {
      return {
        score: 50,
        shortPercentOfFloat: 0,
        daysToCover: 0,
        interpretation: 'Données de short interest invalides',
      };
    }

    const shortPercentOfFloat = si.percent_returned
      ? parseFloat(String(si.percent_returned))
      : 0;
    const daysToCover = si.days_to_cover_returned
      ? parseFloat(String(si.days_to_cover_returned))
      : 0;

    let score = 50;
    // Short interest faible = positif (moins de pression à la baisse)
    if (shortPercentOfFloat < 3) score += 20;
    else if (shortPercentOfFloat < 5) score += 10;
    else if (shortPercentOfFloat > 20) score -= 20;
    else if (shortPercentOfFloat > 15) score -= 10;

    // Days to cover faible = moins de risque de squeeze
    if (daysToCover > 0 && daysToCover < 1) score += 5;
    else if (daysToCover > 5) score -= 5;

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      shortPercentOfFloat: Math.round(shortPercentOfFloat * 100) / 100,
      daysToCover: Math.round(daysToCover * 100) / 100,
      interpretation: shortPercentOfFloat < 5
        ? 'Short interest faible - Moins de pression à la baisse'
        : shortPercentOfFloat > 15
        ? 'Short interest élevé - Risque de squeeze ou pression à la baisse'
        : 'Short interest modéré',
    };
  }

  /**
   * Score les greeks (0-100)
   */
  private scoreGreeks(greeks: PromiseSettledResult<any>, maxPain: PromiseSettledResult<any>): GreeksSignal {
    let gamma = 0;
    let delta = 0;
    let theta = 0;
    let vega = 0;
    let maxPainValue = 0;

    // Extraire les greeks
    if (greeks.status === 'fulfilled' && greeks.value?.success && greeks.value.data) {
      const greeksData = Array.isArray(greeks.value.data) ? greeks.value.data : [];
      if (greeksData.length > 0) {
        const g = greeksData[0];
        gamma = parseFloat(g.call_gamma || g.put_gamma || '0');
        delta = parseFloat(g.call_delta || g.put_delta || '0');
        theta = parseFloat(g.call_theta || g.put_theta || '0');
        vega = parseFloat(g.call_vega || g.put_vega || '0');
      }
    }

    // Extraire max pain
    if (maxPain.status === 'fulfilled' && maxPain.value?.success && maxPain.value.data) {
      const mpData = Array.isArray(maxPain.value.data) ? maxPain.value.data[0] : maxPain.value.data;
      if (mpData) {
        maxPainValue = parseFloat(mpData.max_pain || '0');
      }
    }

    let score = 50;

    // Gamma élevé = potentiel de mouvement rapide (positif si bullish)
    if (gamma > 0.01) score += 10;
    else if (gamma < 0.001) score -= 5;

    // Delta proche de 0.5 = équilibré, > 0.5 = bullish
    if (delta > 0.6) score += 10;
    else if (delta < 0.4) score -= 10;

    // Theta négatif élevé = décroissance rapide (négatif)
    if (theta < -0.1) score -= 5;

    // Vega élevé = sensibilité à la volatilité (peut être positif ou négatif selon contexte)
    if (vega > 0.5) score += 5;

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      gamma: Math.round(gamma * 1000) / 1000,
      delta: Math.round(delta * 100) / 100,
      theta: Math.round(theta * 100) / 100,
      vega: Math.round(vega * 100) / 100,
      maxPain: maxPainValue,
      interpretation: delta > 0.6 && gamma > 0.01
        ? 'Greeks favorables - Potentiel de mouvement positif'
        : delta < 0.4
        ? 'Greeks défavorables - Potentiel de mouvement négatif'
        : 'Greeks neutres',
    };
  }

  /**
   * Génère une recommandation basée sur le score
   */
  private generateRecommendation(overall: number): Recommendation {
    if (overall >= 80) return 'STRONG_BUY';
    if (overall >= 65) return 'BUY';
    if (overall >= 45) return 'HOLD';
    if (overall >= 30) return 'SELL';
    return 'STRONG_SELL';
  }

  /**
   * Calcule la confiance basée sur la disponibilité des données
   */
  private calculateConfidence(results: PromiseSettledResult<any>[]): number {
    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    const total = results.length;
    const availability = successful / total;

    // Confiance basée sur la disponibilité des données
    let confidence = availability * 100;

    // Réduire la confiance si trop peu de données sont disponibles
    if (availability < 0.5) confidence *= 0.7;
    else if (availability < 0.7) confidence *= 0.85;

    return Math.max(0, Math.min(100, Math.round(confidence)));
  }
}

