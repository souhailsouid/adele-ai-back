/**
 * Service Earnings Hub
 * 
 * Reproduction de l'interface Earnings Hub (ex: Carnival CCL)
 * Combine earnings historiques + métriques de valorisation pour générer un score et des insights
 * 
 * ⚠️ IMPORTANT : Ce service fait UNIQUEMENT des calculs mathématiques (pas d'IA).
 * 
 * Sources de données : UNIQUEMENT Unusual Whales API
 * - Earnings Historical : pour l'historique EPS
 * - Stock Info : pour market cap et P/E ratio
 * - Stock State : pour le prix actuel
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import * as uw from '../unusual-whales';
import type {
  EarningsHubRequest,
  EarningsHubResponse,
  EarningsHubAnalysis,
  EarningsQuarter,
  EarningsStats,
} from '../types/earnings-hub';

export class EarningsHubService {
  /**
   * Analyser le Earnings Hub pour un ticker
   */
  async analyzeEarningsHub(
    request: EarningsHubRequest
  ): Promise<EarningsHubResponse> {
    return handleError(async () => {
      const log = logger.child({ operation: 'analyzeEarningsHub', ticker: request.ticker });
      const ticker = request.ticker.toUpperCase();

      log.info('Starting earnings hub analysis', { ticker });

      // 1. Récupérer les données en parallèle
      const [earningsHistorical, stockInfo, stockState] = await Promise.all([
        uw.getUWEarningsHistorical(ticker),
        uw.getUWStockInfo(ticker),
        uw.getUWStockState(ticker),
      ]);

      // 2. Extraire le prix actuel
      const currentPrice = this.extractCurrentPrice(stockState);
      if (currentPrice === 0) {
        throw new Error(`Unable to fetch current price for ${ticker}`);
      }

      // 3. Extraire les métriques de valorisation
      const marketCap = this.extractMarketCap(stockInfo);
      const peRatio = this.extractPERatio(stockInfo);

      // 4. Traiter l'historique des earnings
      const quartersLimit = request.quartersLimit || 16; // 4 ans par défaut
      const history = this.processEarningsHistory(
        earningsHistorical,
        quartersLimit
      );

      // 5. Calculer les statistiques agrégées
      const stats = this.calculateStats(history, marketCap, peRatio, currentPrice);

      // 6. Générer l'interprétation
      const interpretation = this.generateInterpretation({
        ticker,
        stats,
        history,
      });

      const analysis: EarningsHubAnalysis = {
        ticker,
        stats,
        latestQuarter: history.length > 0 ? history[0] : null,
        history,
        insights: interpretation.insights,
        interpretation: {
          summary: interpretation.summary,
          keyPoints: interpretation.keyPoints,
          trends: interpretation.trends,
        },
      };

      log.info('Earnings hub analysis complete', {
        ticker,
        totalQuarters: history.length,
        epsBeatRate: stats.epsBeatRate,
      });

      return {
        success: true,
        analysis,
        timestamp: new Date().toISOString(),
      };
    }, 'Analyze earnings hub');
  }

  /**
   * Extraire le prix actuel depuis Stock State
   */
  private extractCurrentPrice(stockState: any): number {
    if (!stockState.success || !stockState.data) {
      return 0;
    }

    const price = this.parseNumber(stockState.data.close || stockState.data.prev_close);
    return price || 0;
  }

  /**
   * Extraire la capitalisation boursière depuis Stock Info
   */
  private extractMarketCap(stockInfo: any): string {
    if (!stockInfo.success || !stockInfo.data || !stockInfo.data.marketcap) {
      return 'N/A';
    }

    const marketCap = this.parseNumber(stockInfo.data.marketcap);
    if (marketCap === null) {
      return 'N/A';
    }

    // Formater en B (milliards) ou M (millions)
    if (marketCap >= 1_000_000_000) {
      return `${(marketCap / 1_000_000_000).toFixed(1)}B`;
    } else if (marketCap >= 1_000_000) {
      return `${(marketCap / 1_000_000).toFixed(1)}M`;
    }
    return marketCap.toLocaleString();
  }

  /**
   * Extraire le ratio P/E depuis Stock Info
   * Note: L'API UW ne fournit pas directement le P/E.
   * On peut le calculer si on a le prix et les earnings annuels, mais pour l'instant on retourne null.
   * TODO: Calculer P/E = Price / (EPS annuel) si on a les données
   */
  private extractPERatio(stockInfo: any): number | null {
    // L'API UW Stock Info ne semble pas avoir de P/E ratio direct
    // Pour le calculer, il faudrait : P/E = Current Price / (EPS annuel)
    // Mais on n'a pas l'EPS annuel directement dans Stock Info
    return null;
  }

  /**
   * Traiter l'historique des earnings et créer les objets EarningsQuarter
   */
  private processEarningsHistory(
    earningsResponse: any,
    limit: number
  ): EarningsQuarter[] {
    if (!earningsResponse.success || !earningsResponse.data || !Array.isArray(earningsResponse.data)) {
      return [];
    }

    const earnings = earningsResponse.data.slice(0, limit);
    const quarters: EarningsQuarter[] = [];

    for (const earning of earnings) {
      const epsActual = this.parseNumber(earning.actual_eps);
      const epsEstimate = this.parseNumber(earning.street_mean_est);

      if (epsActual === null || epsEstimate === null || epsEstimate === 0) {
        continue; // Skip si données incomplètes
      }

      const epsSurprise = ((epsActual - epsEstimate) / epsEstimate) * 100;
      const epsBeat = epsSurprise > 0;

      // Formater la période (ex: "Q4 2025")
      const period = this.formatQuarterPeriod(earning.ending_fiscal_quarter);

      quarters.push({
        period,
        reportDate: earning.report_date,
        reportTime: earning.report_time || 'unknown',
        epsActual,
        epsEstimate,
        epsSurprise,
        epsBeat,
        priceMove1d: this.parseNumber(earning.post_earnings_move_1d),
        priceMove1w: this.parseNumber(earning.post_earnings_move_1w),
      });
    }

    // Trier par date décroissante (plus récent en premier)
    return quarters.sort((a, b) => 
      new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime()
    );
  }

  /**
   * Formater une date de fin de trimestre en "Q4 2025"
   */
  private formatQuarterPeriod(endingFiscalQuarter: string): string {
    try {
      const date = new Date(endingFiscalQuarter);
      const month = date.getMonth() + 1; // 1-12
      const year = date.getFullYear();

      // Déterminer le trimestre
      let quarter: number;
      if (month >= 1 && month <= 3) quarter = 1;
      else if (month >= 4 && month <= 6) quarter = 2;
      else if (month >= 7 && month <= 9) quarter = 3;
      else quarter = 4;

      return `Q${quarter} ${year}`;
    } catch (error) {
      return endingFiscalQuarter; // Retourner la date brute si erreur
    }
  }

  /**
   * Calculer les statistiques agrégées
   */
  private calculateStats(
    history: EarningsQuarter[],
    marketCap: string,
    peRatio: number | null,
    currentPrice: number
  ): EarningsStats {
    if (history.length === 0) {
      return {
        marketCap,
        peRatio,
        currentPrice,
        epsBeatsCount: 0,
        totalQuarters: 0,
        epsBeatRate: 0,
        avgEpsSurprise: 0,
      };
    }

    const epsBeatsCount = history.filter((q) => q.epsBeat).length;
    const totalQuarters = history.length;
    const epsBeatRate = (epsBeatsCount / totalQuarters) * 100;

    const surprises = history
      .map((q) => q.epsSurprise)
      .filter((s) => !isNaN(s));
    const avgEpsSurprise = surprises.length > 0
      ? surprises.reduce((sum, s) => sum + s, 0) / surprises.length
      : 0;

    return {
      marketCap,
      peRatio,
      currentPrice,
      epsBeatsCount,
      totalQuarters,
      epsBeatRate,
      avgEpsSurprise,
    };
  }

  /**
   * Calculer le score du hub (A, B, C, D, F)
   * Règles déterministes basées sur les beats et la performance
   */
  private calculateHubScore(
    stats: EarningsStats,
    history: EarningsQuarter[]
  ): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (history.length === 0) {
      return 'F'; // Pas de données
    }

    // Analyser les 4 derniers trimestres
    const last4Quarters = history.slice(0, 4);
    const beatsLast4 = last4Quarters.filter((q) => q.epsBeat).length;

    // Score A : Beat les 4 derniers trimestres OU beat rate > 75% avec surprise moyenne > 10%
    if (beatsLast4 === 4 || (stats.epsBeatRate >= 75 && stats.avgEpsSurprise > 10)) {
      return 'A';
    }

    // Score B : Beat 3/4 derniers trimestres OU beat rate > 60% avec surprise moyenne > 5%
    if (beatsLast4 >= 3 || (stats.epsBeatRate >= 60 && stats.avgEpsSurprise > 5)) {
      return 'B';
    }

    // Score C : Beat 2/4 derniers trimestres OU beat rate > 50%
    if (beatsLast4 >= 2 || stats.epsBeatRate >= 50) {
      return 'C';
    }

    // Score D : Beat 1/4 derniers trimestres OU beat rate > 30%
    if (beatsLast4 >= 1 || stats.epsBeatRate >= 30) {
      return 'D';
    }

    // Score F : Moins de 30% de beats
    return 'F';
  }

  /**
   * Générer l'interprétation dynamique (règles déterministes)
   */
  private generateInterpretation(params: {
    ticker: string;
    stats: EarningsStats;
    history: EarningsQuarter[];
  }): {
    summary: string;
    insights: string[];
    keyPoints: string[];
    trends: Array<{ label: string; direction: 'improving' | 'deteriorating' | 'stable'; evidence: string }>;
  } {
    const { ticker, stats, history } = params;

    const insights: string[] = [];
    const keyPoints: string[] = [];
    const trends: Array<{ label: string; direction: 'improving' | 'deteriorating' | 'stable'; evidence: string }> = [];
    const summaryParts: string[] = [];

    // Insight 1 : Beat rate
    if (stats.epsBeatsCount > 0 && stats.totalQuarters > 0) {
      insights.push(`EPS beats ${stats.epsBeatsCount} fois sur ${stats.totalQuarters} trimestres analysés`);
    }

    // Insight 2 : Surprise moyenne
    if (stats.avgEpsSurprise > 10) {
      insights.push(`Forte surprise positive moyenne sur l'EPS (+${stats.avgEpsSurprise.toFixed(1)}%)`);
      keyPoints.push(`Surprise EPS moyenne exceptionnelle : +${stats.avgEpsSurprise.toFixed(1)}%`);
    } else if (stats.avgEpsSurprise > 5) {
      insights.push(`Surprise positive moyenne sur l'EPS (+${stats.avgEpsSurprise.toFixed(1)}%)`);
    } else if (stats.avgEpsSurprise < -5) {
      insights.push(`Surprise négative moyenne sur l'EPS (${stats.avgEpsSurprise.toFixed(1)}%)`);
      keyPoints.push(`⚠️ Tendance à manquer les estimations d'EPS`);
    }

    // Insight 3 : Dernier trimestre
    if (history.length > 0) {
      const latest = history[0];
      if (latest.epsBeat) {
        const surprise = latest.epsSurprise.toFixed(1);
        insights.push(`Dernier trimestre (${latest.period}) : Beat EPS de ${surprise}%`);
        summaryParts.push(`Le dernier trimestre (${latest.period}) a battu les estimations d'EPS de ${surprise}%.`);
      } else {
        const miss = Math.abs(latest.epsSurprise).toFixed(1);
        insights.push(`Dernier trimestre (${latest.period}) : Miss EPS de ${miss}%`);
        summaryParts.push(`Le dernier trimestre (${latest.period}) a manqué les estimations d'EPS de ${miss}%.`);
      }
    }

    // Analyse des tendances (4 derniers trimestres)
    if (history.length >= 4) {
      const last4 = history.slice(0, 4);
      const recentBeats = last4.filter((q) => q.epsBeat).length;
      const older4 = history.slice(4, 8);
      const olderBeats = older4.length > 0 ? older4.filter((q) => q.epsBeat).length : 0;

      if (recentBeats > olderBeats) {
        trends.push({
          label: 'Amélioration de la performance EPS',
          direction: 'improving',
          evidence: `${recentBeats}/4 beats récents vs ${olderBeats}/4 précédents`,
        });
        keyPoints.push('✅ Tendance à l\'amélioration : plus de beats récemment');
      } else if (recentBeats < olderBeats) {
        trends.push({
          label: 'Détérioration de la performance EPS',
          direction: 'deteriorating',
          evidence: `${recentBeats}/4 beats récents vs ${olderBeats}/4 précédents`,
        });
        keyPoints.push('⚠️ Tendance à la détérioration : moins de beats récemment');
      } else {
        trends.push({
          label: 'Performance EPS stable',
          direction: 'stable',
          evidence: `${recentBeats}/4 beats récents, performance constante`,
        });
      }
    }

    // KeyPoint sur le P/E si disponible
    if (stats.peRatio !== null) {
      if (stats.peRatio < 15) {
        keyPoints.push(`Ratio P/E de ${stats.peRatio.toFixed(1)} : Valorisation attractive`);
      } else if (stats.peRatio > 30) {
        keyPoints.push(`Ratio P/E de ${stats.peRatio.toFixed(1)} : Valorisation élevée`);
      }
    }

    // Générer le résumé
    let summary = summaryParts.join(' ');
    if (summaryParts.length === 0) {
      summary = `Analyse Earnings Hub pour ${ticker}: ${stats.epsBeatsCount} beats sur ${stats.totalQuarters} trimestres analysés.`;
    } else {
      summary = `${ticker}: ${summary} Performance historique : ${stats.epsBeatsCount} beats sur ${stats.totalQuarters} trimestres (${stats.epsBeatRate.toFixed(1)}% de taux de beat).`;
    }

    return {
      summary,
      insights,
      keyPoints,
      trends,
    };
  }

  /**
   * Parser un nombre depuis une valeur potentiellement string
   */
  private parseNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? null : parsed;
  }
}

