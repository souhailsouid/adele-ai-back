/**
 * Service d'analyse de risque
 * Combine risques financiers (FMP) + risques de marché (UW)
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import * as fmp from '../fmp';
import * as uw from '../unusual-whales';
import type {
  RiskAnalysis,
  RiskAnalysisResponse,
  FinancialRisk,
  MarketRisk,
  LiquidityRisk,
  RiskRecommendation,
} from '../types/combined-analysis';

export class RiskAnalysisService {
  /**
   * Analyse complète des risques d'un ticker
   */
  async analyzeRisk(ticker: string): Promise<RiskAnalysisResponse> {
    return handleError(async () => {
      const upperTicker = ticker.toUpperCase();
      const log = logger.child({ ticker: upperTicker, operation: 'analyzeRisk' });
      log.info('Analyzing risk');

      // Récupération des données financières (FMP)
      const [ratios, balanceSheet, cashFlow, incomeStatement] = await Promise.allSettled([
        fmp.getFMPFinancialRatios({ symbol: upperTicker, limit: 1 }),
        fmp.getFMPBalanceSheetStatement({ symbol: upperTicker, limit: 1 }),
        fmp.getFMPCashFlowStatement({ symbol: upperTicker, limit: 1 }),
        fmp.getFMPIncomeStatement({ symbol: upperTicker, limit: 1 }),
      ]);

      log.info('FMP financial data fetched', {
        ratios: ratios.status,
        balanceSheet: balanceSheet.status,
        cashFlow: cashFlow.status,
        incomeStatement: incomeStatement.status,
      });

      // Récupération des données de marché (UW)
      const [shortInterest, optionsFlow, darkPool, volatility] = await Promise.allSettled([
        uw.getUWShortInterestAndFloat(upperTicker),
        uw.getUWRecentFlows(upperTicker, { min_premium: 50000 }),
        uw.getUWDarkPoolTrades(upperTicker, { limit: 50 }),
        uw.getUWVolatilityStats(upperTicker),
      ]);

      log.info('UW market data fetched', {
        shortInterest: shortInterest.status,
        optionsFlow: optionsFlow.status,
        darkPool: darkPool.status,
        volatility: volatility.status,
      });

      // Analyser les risques
      const financialRisk = this.analyzeFinancialRisk(ratios, balanceSheet, cashFlow, incomeStatement);
      const marketRisk = this.analyzeMarketRisk(shortInterest, optionsFlow, darkPool, volatility);
      const liquidityRisk = this.analyzeLiquidityRisk(optionsFlow, volatility);

      // Calculer le risque global
      const overallRisk = (financialRisk.score + marketRisk.score + liquidityRisk.score) / 3;
      const riskLevel = this.determineRiskLevel(overallRisk);

      log.info('Risk analysis complete', {
        overallRisk: Math.round(overallRisk),
        riskLevel,
        financialRisk: financialRisk.score,
        marketRisk: marketRisk.score,
        liquidityRisk: liquidityRisk.score,
      });

      // Générer les recommandations
      const recommendations = this.generateRiskRecommendations(
        financialRisk,
        marketRisk,
        liquidityRisk,
        overallRisk
      );

      log.info('Risk recommendations generated', {
        count: recommendations.length,
        types: recommendations.map(r => r.type),
      });

      const analysis: RiskAnalysis = {
        ticker: upperTicker,
        overallRisk: Math.round(overallRisk),
        breakdown: {
          financial: financialRisk,
          market: marketRisk,
          liquidity: liquidityRisk,
        },
        recommendations,
        riskLevel,
      };

      return {
        success: true,
        data: analysis,
        cached: false,
        timestamp: new Date().toISOString(),
      };
    }, `Analyze risk for ${ticker}`);
  }

  // ========== Méthodes privées d'analyse ==========

  private analyzeFinancialRisk(
    ratios: PromiseSettledResult<any>,
    balanceSheet: PromiseSettledResult<any>,
    cashFlow: PromiseSettledResult<any>,
    incomeStatement: PromiseSettledResult<any>
  ): FinancialRisk {
    let score = 50; // Score de base
    const factors: FinancialRisk['factors'] = {
      debtLevel: 'medium',
      cashFlow: 'positive',
      profitability: 'strong',
      leverage: 0,
    };

    // Analyser les ratios
    if (ratios.status === 'fulfilled' && ratios.value?.success && ratios.value.data?.length > 0) {
      const ratio = ratios.value.data[0];
      const debtToEquity = ratio.debtEquityRatio || 0;
      factors.leverage = debtToEquity;

      if (debtToEquity > 1.0) {
        factors.debtLevel = 'high';
        score += 30;
      } else if (debtToEquity > 0.5) {
        factors.debtLevel = 'medium';
        score += 15;
      } else {
        factors.debtLevel = 'low';
        score += 0;
      }
    }

    // Analyser le cash flow
    if (cashFlow.status === 'fulfilled' && cashFlow.value?.success && cashFlow.value.data?.length > 0) {
      const cf = cashFlow.value.data[0];
      const operatingCF = cf.operatingCashFlow || 0;
      
      if (operatingCF < 0) {
        factors.cashFlow = 'negative';
        score += 25;
      } else if (operatingCF > 0 && operatingCF < 1000000) {
        factors.cashFlow = 'volatile';
        score += 10;
      } else {
        factors.cashFlow = 'positive';
        score += 0;
      }
    }

    // Analyser la profitabilité
    if (incomeStatement.status === 'fulfilled' && incomeStatement.value?.success && incomeStatement.value.data?.length > 0) {
      const income = incomeStatement.value.data[0];
      const netIncome = income.netIncome || 0;
      
      if (netIncome < 0) {
        factors.profitability = 'negative';
        score += 20;
      } else if (netIncome > 0 && netIncome < 1000000) {
        factors.profitability = 'weak';
        score += 10;
      } else {
        factors.profitability = 'strong';
        score += 0;
      }
    }

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      factors,
    };
  }

  private analyzeMarketRisk(
    shortInterest: PromiseSettledResult<any>,
    optionsFlow: PromiseSettledResult<any>,
    darkPool: PromiseSettledResult<any>,
    volatility: PromiseSettledResult<any>
  ): MarketRisk {
    let score = 50;
    const factors: MarketRisk['factors'] = {
      shortInterest: 'medium',
      volatility: 'medium',
      optionsFlow: 'neutral',
      darkPoolActivity: 'medium',
    };

    // Analyser le short interest
    if (shortInterest.status === 'fulfilled' && shortInterest.value?.success && shortInterest.value.data) {
      const si = shortInterest.value.data;
      const percent = si.percent_returned ? parseFloat(si.percent_returned) : 0;
      
      if (percent > 20) {
        factors.shortInterest = 'high';
        score += 25;
      } else if (percent > 10) {
        factors.shortInterest = 'medium';
        score += 10;
      } else {
        factors.shortInterest = 'low';
        score += 0;
      }
    }

    // Analyser la volatilité
    if (volatility.status === 'fulfilled' && volatility.value?.success && volatility.value.data) {
      const vol = volatility.value.data;
      const iv = vol.implied_volatility || vol.iv || 0;
      
      if (iv > 50) {
        factors.volatility = 'high';
        score += 20;
      } else if (iv > 30) {
        factors.volatility = 'medium';
        score += 10;
      } else {
        factors.volatility = 'low';
        score += 0;
      }
    }

    // Analyser le flow d'options
    if (optionsFlow.status === 'fulfilled' && optionsFlow.value?.success && optionsFlow.value.data) {
      const flows = Array.isArray(optionsFlow.value.data) ? optionsFlow.value.data : [];
      const calls = flows.filter((f: any) => f.is_call && f.premium > 0);
      const puts = flows.filter((f: any) => f.is_put && f.premium > 0);
      const ratio = calls.length > 0 && puts.length > 0 ? calls.length / puts.length : 1;
      
      if (ratio < 0.7) {
        factors.optionsFlow = 'bearish';
        score += 15;
      } else if (ratio > 1.5) {
        factors.optionsFlow = 'bullish';
        score += 0;
      } else {
        factors.optionsFlow = 'neutral';
        score += 5;
      }
    }

    // Analyser le dark pool
    if (darkPool.status === 'fulfilled' && darkPool.value?.success && darkPool.value.data) {
      const trades = Array.isArray(darkPool.value.data) ? darkPool.value.data : [];
      
      if (trades.length > 30) {
        factors.darkPoolActivity = 'high';
        score += 5; // Activité élevée peut indiquer de l'incertitude
      } else if (trades.length > 10) {
        factors.darkPoolActivity = 'medium';
        score += 0;
      } else {
        factors.darkPoolActivity = 'low';
        score += 0;
      }
    }

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      factors,
    };
  }

  private analyzeLiquidityRisk(
    optionsFlow: PromiseSettledResult<any>,
    volatility: PromiseSettledResult<any>
  ): LiquidityRisk {
    let score = 50;
    const factors: LiquidityRisk['factors'] = {
      averageVolume: 'medium',
      bidAskSpread: 'medium',
      optionsLiquidity: 'medium',
    };

    // Analyser la liquidité des options
    if (optionsFlow.status === 'fulfilled' && optionsFlow.value?.success && optionsFlow.value.data) {
      const flows = Array.isArray(optionsFlow.value.data) ? optionsFlow.value.data : [];
      
      if (flows.length > 50) {
        factors.optionsLiquidity = 'high';
        score += 0;
      } else if (flows.length > 20) {
        factors.optionsLiquidity = 'medium';
        score += 5;
      } else {
        factors.optionsLiquidity = 'low';
        score += 15;
      }
    }

    // Analyser la volatilité (proxy pour le spread)
    if (volatility.status === 'fulfilled' && volatility.value?.success && volatility.value.data) {
      const vol = volatility.value.data;
      const iv = vol.implied_volatility || vol.iv || 0;
      
      if (iv > 50) {
        factors.bidAskSpread = 'wide';
        score += 15;
      } else if (iv > 30) {
        factors.bidAskSpread = 'medium';
        score += 5;
      } else {
        factors.bidAskSpread = 'tight';
        score += 0;
      }
    }

    // Volume moyen (simplifié - en réalité il faudrait les données de volume)
    factors.averageVolume = 'medium';
    score += 0;

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      factors,
    };
  }

  private determineRiskLevel(overallRisk: number): 'low' | 'medium' | 'high' | 'very_high' {
    if (overallRisk < 30) return 'low';
    if (overallRisk < 50) return 'medium';
    if (overallRisk < 70) return 'high';
    return 'very_high';
  }

  private generateRiskRecommendations(
    financialRisk: FinancialRisk,
    marketRisk: MarketRisk,
    liquidityRisk: LiquidityRisk,
    overallRisk: number
  ): RiskRecommendation[] {
    const recommendations: RiskRecommendation[] = [];

    if (financialRisk.score > 70) {
      recommendations.push({
        type: 'reduce_position',
        reasoning: `Risque financier élevé (score: ${financialRisk.score}). Dette élevée ou cash flow négatif.`,
        priority: 'high',
      });
    }

    if (marketRisk.score > 70) {
      recommendations.push({
        type: 'hedge',
        reasoning: `Risque de marché élevé (score: ${marketRisk.score}). Short interest élevé ou volatilité élevée.`,
        priority: 'high',
      });
    }

    if (liquidityRisk.score > 70) {
      recommendations.push({
        type: 'monitor',
        reasoning: `Risque de liquidité élevé (score: ${liquidityRisk.score}). Options peu liquides ou spread large.`,
        priority: 'medium',
      });
    }

    if (overallRisk < 30) {
      recommendations.push({
        type: 'safe',
        reasoning: `Risque global faible (score: ${Math.round(overallRisk)}). Position relativement sûre.`,
        priority: 'low',
      });
    }

    return recommendations;
  }
}

