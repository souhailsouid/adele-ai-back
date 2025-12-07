/**
 * Service de prédiction d'earnings amélioré
 * Combine FMP earnings history + UW options flow + UW insiders + FMP analyst ratings
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import * as fmp from '../fmp';
import * as uw from '../unusual-whales';
import type {
  EarningsPrediction,
  EarningsPredictionResponse,
  EarningsSignals,
  OptionsSignal,
  InsiderSignal,
  DarkPoolSignal,
  AnalystSignal,
  HistoricalSignal,
} from '../types/combined-analysis';

export class EarningsPredictionService {
  /**
   * Prédit les surprises d'earnings en combinant plusieurs sources
   */
  async predictEarningsSurprise(
    ticker: string,
    earningsDate?: string
  ): Promise<EarningsPredictionResponse> {
    return handleError(async () => {
      const upperTicker = ticker.toUpperCase();
      const log = logger.child({ ticker: upperTicker, operation: 'predictEarningsSurprise' });
      log.info('Predicting earnings surprise', { earningsDate });

      // Récupération des données historiques (FMP)
      const [historicalEarnings, analystEstimates, ratings] = await Promise.allSettled([
        fmp.getFMPEarningsReport(upperTicker),
        fmp.getFMPFinancialEstimates({ symbol: upperTicker, period: 'quarter' }),
        fmp.getFMPRatingsSnapshot(upperTicker),
      ]);

      log.info('FMP earnings data fetched', {
        historicalEarnings: historicalEarnings.status,
        analystEstimates: analystEstimates.status,
        ratings: ratings.status,
      });

      // Récupération de l'activité pré-earnings (UW)
      const [optionsFlow, insiderTrades, darkPool] = await Promise.allSettled([
        uw.getUWRecentFlows(upperTicker, { min_premium: 50000 }),
        uw.getUWStockInsiderBuySells(upperTicker, {}),
        uw.getUWDarkPoolTrades(upperTicker, { limit: 100 }),
      ]);

      log.info('UW pre-earnings data fetched', {
        optionsFlow: optionsFlow.status,
        insiderTrades: insiderTrades.status,
        darkPool: darkPool.status,
      });

      // Analyser les signaux
      const signals: EarningsSignals = {
        options: this.analyzeOptionsFlow(optionsFlow),
        insiders: this.analyzeInsiderActivity(insiderTrades),
        darkPool: this.analyzeDarkPool(darkPool),
        analysts: this.analyzeAnalystRatings(ratings),
        historical: this.analyzeHistoricalPattern(historicalEarnings),
      };

      // Calculer la prédiction
      const predictedSurprise = this.calculatePredictedSurprise(signals);
      const confidence = this.calculateConfidence(signals);

      log.info('Earnings prediction calculated', {
        predictedSurprise,
        confidence,
        signalsAvailable: {
          options: signals.options.score !== 50,
          insiders: signals.insiders.score !== 50,
          darkPool: signals.darkPool.score !== 50,
          analysts: signals.analysts.score !== 50,
          historical: signals.historical.beatRate > 0,
        },
      });

      // Déterminer la date d'earnings
      let finalEarningsDate = earningsDate;
      if (!finalEarningsDate && historicalEarnings.status === 'fulfilled' && historicalEarnings.value?.success) {
        const earnings = historicalEarnings.value.data;
        if (Array.isArray(earnings) && earnings.length > 0) {
          // Prochaine date estimée basée sur le pattern historique
          finalEarningsDate = this.estimateNextEarningsDate(earnings);
        }
      }

      const prediction: EarningsPrediction = {
        ticker: upperTicker,
        earningsDate: finalEarningsDate || new Date().toISOString().split('T')[0],
        predictedSurprise,
        confidence,
        signals,
        recommendation: this.generateRecommendation(predictedSurprise, confidence),
        historicalContext: this.extractHistoricalContext(historicalEarnings),
      };

      return {
        success: true,
        data: prediction,
        cached: false,
        timestamp: new Date().toISOString(),
      };
    }, `Predict earnings surprise for ${ticker}`);
  }

  // ========== Méthodes privées d'analyse ==========

  private analyzeOptionsFlow(optionsFlow: PromiseSettledResult<any>): OptionsSignal {
    if (optionsFlow.status !== 'fulfilled' || !optionsFlow.value?.success || !optionsFlow.value.data) {
      return {
        score: 50,
        callVolume: 0,
        putVolume: 0,
        callPutRatio: 1,
        unusualActivity: 0,
        interpretation: 'Données d\'options non disponibles',
      };
    }

    const flows = Array.isArray(optionsFlow.value.data) ? optionsFlow.value.data : [];
    const calls = flows.filter((f: any) => f.is_call && (f.premium > 0 || f.volume > 0));
    const puts = flows.filter((f: any) => f.is_put && (f.premium > 0 || f.volume > 0));
    
    // Calculer le volume en utilisant plusieurs champs possibles
    const callVolume = calls.reduce((sum: number, c: any) => 
      sum + (c.volume || c.size || c.contracts || 0), 0
    );
    const putVolume = puts.reduce((sum: number, p: any) => 
      sum + (p.volume || p.size || p.contracts || 0), 0
    );
    
    // Calculer le ratio basé sur le nombre de trades si les volumes sont à 0
    const callPutRatio = putVolume > 0 
      ? callVolume / putVolume 
      : calls.length > 0 && puts.length > 0
      ? calls.length / puts.length
      : calls.length > 0 
      ? 2 
      : puts.length > 0
      ? 0.5
      : 1;
    
    // Détecter l'activité inhabituelle (sweeps, blocks, floors, ou premium élevé)
    const unusualActivity = flows.filter((f: any) => 
      f.is_sweep || 
      f.is_block || 
      f.is_floor || 
      (f.premium && f.premium > 100000) ||
      (f.size && f.size > 1000) ||
      (f.volume && f.volume > 1000)
    ).length;

    let score = 50;
    if (callPutRatio > 1.5) score += 20;
    else if (callPutRatio < 0.7) score -= 20;
    if (unusualActivity > 5) score += 15;
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      callVolume,
      putVolume,
      callPutRatio,
      unusualActivity,
      interpretation: callPutRatio > 1.5
        ? 'Flow d\'options très positif (beaucoup de calls) - Signe positif pour earnings'
        : callPutRatio < 0.7
        ? 'Flow d\'options négatif (beaucoup de puts) - Signe négatif pour earnings'
        : 'Flow d\'options neutre',
    };
  }

  private analyzeInsiderActivity(insiderTrades: PromiseSettledResult<any>): InsiderSignal {
    if (insiderTrades.status !== 'fulfilled' || !insiderTrades.value?.success || !insiderTrades.value.data) {
      return {
        score: 50,
        buys: 0,
        sells: 0,
        netActivity: 0,
        interpretation: 'Données d\'insiders non disponibles',
      };
    }

    const trades = Array.isArray(insiderTrades.value.data) ? insiderTrades.value.data : [];
    
    // L'API peut retourner soit un format avec transaction_code, soit un format avec purchases/sells
    // Format 1: transactions individuelles avec transaction_code
    // Format 2: agrégations par date avec purchases/sells
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
    
    // Si pas de transactions individuelles, utiliser les agrégations purchases/sells
    if (buys.length === 0 && sells.length === 0) {
      const totalPurchases = trades.reduce((sum: number, t: any) => sum + (t.purchases || 0), 0);
      const totalSells = trades.reduce((sum: number, t: any) => sum + (t.sells || 0), 0);
      buys = totalPurchases > 0 ? [{ count: totalPurchases }] : [];
      sells = totalSells > 0 ? [{ count: totalSells }] : [];
    }

    // Calculer l'activité nette
    let netActivity = 0;
    let buyCount = 0;
    let sellCount = 0;
    
    if (buys.length > 0 && buys[0].count !== undefined) {
      // Format agrégé
      buyCount = buys.reduce((sum: number, b: any) => sum + (b.count || 0), 0);
      sellCount = sells.reduce((sum: number, s: any) => sum + (s.count || 0), 0);
      netActivity = buyCount - sellCount;
    } else {
      // Format individuel
      buyCount = buys.length;
      sellCount = sells.length;
      netActivity = buyCount - sellCount;
    }
    
    let score = 50;
    if (netActivity > 3) score += 25;
    else if (netActivity > 0) score += 10;
    else if (netActivity < -3) score -= 25;
    else if (netActivity < 0) score -= 10;
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      buys: buyCount,
      sells: sellCount,
      netActivity,
      interpretation: netActivity > 0
        ? 'Insiders achètent - Signe très positif pour earnings'
        : netActivity < 0
        ? 'Insiders vendent - Signe négatif pour earnings'
        : 'Activité d\'insiders neutre',
    };
  }

  private analyzeDarkPool(darkPool: PromiseSettledResult<any>): DarkPoolSignal {
    if (darkPool.status !== 'fulfilled' || !darkPool.value?.success || !darkPool.value.data) {
      return {
        score: 50,
        trades: 0,
        volume: 0,
        interpretation: 'Données de dark pool non disponibles',
      };
    }

    const trades = Array.isArray(darkPool.value.data) ? darkPool.value.data : [];
    const totalVolume = trades.reduce((sum: number, t: any) => sum + (t.volume || 0), 0);

    let score = 50;
    if (trades.length > 20) score += 15;
    else if (trades.length > 10) score += 5;
    if (totalVolume > 1000000) score += 10;
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      trades: trades.length,
      volume: totalVolume,
      interpretation: trades.length > 20
        ? 'Activité dark pool élevée - Signe d\'intérêt institutionnel'
        : 'Activité dark pool normale',
    };
  }

  private analyzeAnalystRatings(ratings: PromiseSettledResult<any>): AnalystSignal {
    if (ratings.status !== 'fulfilled' || !ratings.value?.success || !ratings.value.data) {
      return {
        score: 50,
        upgrades: 0,
        downgrades: 0,
        consensus: 'N/A',
        interpretation: 'Données d\'analystes non disponibles',
      };
    }

    const rating = ratings.value.data;
    const overallScore = rating.overallScore || 50;
    const consensus = rating.rating || 'HOLD';

    let score = overallScore;
    let upgrades = 0;
    let downgrades = 0;

    // Simplifié - en réalité il faudrait analyser l'historique des ratings
    if (consensus.includes('Buy') || consensus.includes('Strong Buy')) {
      score += 10;
      upgrades = 1;
    } else if (consensus.includes('Sell') || consensus.includes('Strong Sell')) {
      score -= 10;
      downgrades = 1;
    }

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      upgrades,
      downgrades,
      consensus,
      interpretation: consensus.includes('Buy')
        ? 'Consensus analyste positif - Signe positif pour earnings'
        : consensus.includes('Sell')
        ? 'Consensus analyste négatif - Signe négatif pour earnings'
        : 'Consensus analyste neutre',
    };
  }

  private analyzeHistoricalPattern(historicalEarnings: PromiseSettledResult<any>): HistoricalSignal {
    if (historicalEarnings.status !== 'fulfilled' || !historicalEarnings.value?.success || !historicalEarnings.value.data) {
      return {
        score: 50,
        averageSurprise: 0,
        beatRate: 0.5,
        pattern: 'unknown',
        interpretation: 'Données historiques non disponibles',
      };
    }

    const earnings = Array.isArray(historicalEarnings.value.data) ? historicalEarnings.value.data : [];
    
    if (earnings.length === 0) {
      return {
        score: 50,
        averageSurprise: 0,
        beatRate: 0.5,
        pattern: 'unknown',
        interpretation: 'Pas d\'historique d\'earnings disponible',
      };
    }

    // Analyser les surprises historiques
    const surprises = earnings
      .filter((e: any) => e.surprise !== null && e.surprise !== undefined)
      .map((e: any) => e.surprise);
    
    const beats = surprises.filter((s: number) => s > 0);
    const beatRate = surprises.length > 0 ? beats.length / surprises.length : 0.5;
    const averageSurprise = surprises.length > 0
      ? surprises.reduce((sum: number, s: number) => sum + s, 0) / surprises.length
      : 0;

    let score = 50;
    if (beatRate > 0.7) score += 20;
    else if (beatRate > 0.5) score += 10;
    else if (beatRate < 0.3) score -= 20;
    
    if (averageSurprise > 5) score += 15;
    else if (averageSurprise < -5) score -= 15;

    score = Math.max(0, Math.min(100, score));

    const pattern = beatRate > 0.7 ? 'consistent_beater' : beatRate < 0.3 ? 'consistent_misser' : 'volatile';

    return {
      score,
      averageSurprise,
      beatRate,
      pattern,
      interpretation: beatRate > 0.7
        ? `Historique fort : ${(beatRate * 100).toFixed(0)}% de beats, surprise moyenne de ${averageSurprise.toFixed(1)}%`
        : beatRate < 0.3
        ? `Historique faible : ${(beatRate * 100).toFixed(0)}% de beats, surprise moyenne de ${averageSurprise.toFixed(1)}%`
        : `Historique mixte : ${(beatRate * 100).toFixed(0)}% de beats`,
    };
  }

  private calculatePredictedSurprise(signals: EarningsSignals): number {
    // Pondération des signaux
    const weights = {
      options: 0.3,
      insiders: 0.25,
      darkPool: 0.15,
      analysts: 0.15,
      historical: 0.15,
    };

    // Convertir les scores en prédiction de surprise
    const optionsSurprise = ((signals.options.score - 50) / 50) * 10; // -10% à +10%
    const insidersSurprise = ((signals.insiders.score - 50) / 50) * 15; // -15% à +15%
    const darkPoolSurprise = ((signals.darkPool.score - 50) / 50) * 5; // -5% à +5%
    const analystsSurprise = ((signals.analysts.score - 50) / 50) * 8; // -8% à +8%
    const historicalSurprise = signals.historical.averageSurprise || 0;

    const predictedSurprise =
      optionsSurprise * weights.options +
      insidersSurprise * weights.insiders +
      darkPoolSurprise * weights.darkPool +
      analystsSurprise * weights.analysts +
      historicalSurprise * weights.historical;

    return Math.round(predictedSurprise * 10) / 10; // Arrondir à 1 décimale
  }

  private calculateConfidence(signals: EarningsSignals): number {
    // Plus de signaux disponibles = plus de confiance
    let confidence = 50;
    
    if (signals.options.score !== 50) confidence += 10;
    if (signals.insiders.score !== 50) confidence += 10;
    if (signals.darkPool.score !== 50) confidence += 5;
    if (signals.analysts.score !== 50) confidence += 10;
    if (signals.historical.beatRate > 0) confidence += 15;

    return Math.min(100, confidence);
  }

  private generateRecommendation(predictedSurprise: number, confidence: number): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' {
    if (predictedSurprise > 10 && confidence > 70) return 'STRONG_BUY';
    if (predictedSurprise > 5) return 'BUY';
    if (predictedSurprise < -10 && confidence > 70) return 'STRONG_SELL';
    if (predictedSurprise < -5) return 'SELL';
    return 'HOLD';
  }

  private extractHistoricalContext(historicalEarnings: PromiseSettledResult<any>) {
    if (historicalEarnings.status !== 'fulfilled' || !historicalEarnings.value?.success || !historicalEarnings.value.data) {
      return undefined;
    }

    const earnings = Array.isArray(historicalEarnings.value.data) ? historicalEarnings.value.data : [];
    const surprises = earnings
      .filter((e: any) => e.surprise !== null && e.surprise !== undefined)
      .map((e: any) => e.surprise);
    
    if (surprises.length === 0) return undefined;

    const beats = surprises.filter((s: number) => s > 0);
    const averageSurprise = surprises.reduce((sum: number, s: number) => sum + s, 0) / surprises.length;

    return {
      averageSurprise: Math.round(averageSurprise * 10) / 10,
      beatRate: Math.round((beats.length / surprises.length) * 100) / 100,
    };
  }

  private estimateNextEarningsDate(earnings: any[]): string {
    // Simplifié - en réalité il faudrait analyser le pattern des dates
    // Pour l'instant, on retourne une date estimée dans 3 mois
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 3);
    return nextDate.toISOString().split('T')[0];
  }
}

