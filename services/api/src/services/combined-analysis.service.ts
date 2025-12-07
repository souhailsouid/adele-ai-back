/**
 * Service pour analyses combinées FMP + Unusual Whales
 * Combine les données fondamentales (FMP) et le sentiment de marché (UW)
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import * as fmp from '../fmp';
import * as uw from '../unusual-whales';
import type {
  CompleteAnalysis,
  CompleteAnalysisResponse,
  FundamentalAnalysis,
  SentimentAnalysis,
  ConvergenceAnalysis,
  Recommendation,
  DivergenceAnalysis,
  DivergenceAnalysisResponse,
  DivergenceType,
  OpportunityAnalysis,
  ComprehensiveValuation,
  ComprehensiveValuationResponse,
} from '../types/combined-analysis';

export class CombinedAnalysisService {
  /**
   * Analyse complète : Combine fundamentals (FMP) + sentiment (UW)
   */
  async getCompleteAnalysis(ticker: string): Promise<CompleteAnalysisResponse> {
    return handleError(async () => {
      const upperTicker = ticker.toUpperCase();
      const log = logger.child({ ticker: upperTicker, operation: 'getCompleteAnalysis' });
      log.info('Getting complete analysis');

      // Récupération parallèle des données FMP (fundamentals)
      const [
        fmpQuote,
        fmpIncomeStatement,
        fmpRatios,
        fmpKeyMetrics,
        fmpBalanceSheet,
        fmpCashFlow,
      ] = await Promise.allSettled([
        fmp.getFMPStockQuote(upperTicker),
        fmp.getFMPIncomeStatement({ symbol: upperTicker, limit: 5 }),
        fmp.getFMPFinancialRatios({ symbol: upperTicker, limit: 5 }),
        fmp.getFMPKeyMetrics({ symbol: upperTicker, limit: 5 }),
        fmp.getFMPBalanceSheetStatement({ symbol: upperTicker, limit: 1 }),
        fmp.getFMPCashFlowStatement({ symbol: upperTicker, limit: 1 }),
      ]);

      log.info('FMP fundamentals data fetched', {
        quote: fmpQuote.status,
        incomeStatement: fmpIncomeStatement.status,
        ratios: fmpRatios.status,
        keyMetrics: fmpKeyMetrics.status,
        balanceSheet: fmpBalanceSheet.status,
        cashFlow: fmpCashFlow.status,
      });

      // Récupération parallèle des données UW (sentiment)
      const [
        uwOptionsFlow,
        uwDarkPool,
        uwShortInterest,
        uwInstitutionalOwnership,
        uwInsiderTrades,
      ] = await Promise.allSettled([
        uw.getUWRecentFlows(upperTicker, { min_premium: 50000 }),
        uw.getUWDarkPoolTrades(upperTicker, { limit: 50 }),
        uw.getUWShortInterestAndFloat(upperTicker),
        uw.getUWInstitutionOwnership(upperTicker),
        uw.getUWStockInsiderBuySells(upperTicker, {}),
      ]);

      log.info('UW sentiment data fetched', {
        optionsFlow: uwOptionsFlow.status,
        darkPool: uwDarkPool.status,
        shortInterest: uwShortInterest.status,
        institutionalOwnership: uwInstitutionalOwnership.status,
        insiderTrades: uwInsiderTrades.status,
      });

      // Analyser les fundamentals
      const fundamental = this.analyzeFundamentals(
        fmpQuote,
        fmpIncomeStatement,
        fmpRatios,
        fmpKeyMetrics,
        fmpBalanceSheet,
        fmpCashFlow
      );

      log.info('Fundamental analysis complete', {
        score: fundamental.score,
        hasData: !!fundamental.details,
      });

      // Analyser le sentiment
      const sentiment = this.analyzeSentiment(
        uwOptionsFlow,
        uwDarkPool,
        uwShortInterest,
        uwInstitutionalOwnership,
        uwInsiderTrades
      );

      log.info('Sentiment analysis complete', {
        score: sentiment.score,
        bullishOptions: sentiment.bullishOptions,
        darkPoolActivity: sentiment.darkPoolActivity,
      });

      // Analyser la convergence
      const convergence = this.analyzeConvergence(fundamental, sentiment);

      log.info('Convergence analysis complete', {
        aligned: convergence.aligned,
        divergence: convergence.divergence,
        type: convergence.type,
        opportunity: convergence.opportunity,
      });

      // Générer la recommandation
      const recommendation = this.generateRecommendation(fundamental, sentiment, convergence);

      // Calculer la confiance
      const confidence = this.calculateConfidence(fundamental, sentiment);

      log.info('Complete analysis finished', {
        recommendation,
        confidence,
        fundamentalScore: fundamental.score,
        sentimentScore: sentiment.score,
      });

      const analysis: CompleteAnalysis = {
        ticker: upperTicker,
        fundamental,
        sentiment,
        convergence,
        recommendation,
        confidence,
      };

      return {
        success: true,
        data: analysis,
        cached: false,
        timestamp: new Date().toISOString(),
      };
    }, `Get complete analysis for ${ticker}`);
  }

  /**
   * Détecte les divergences entre fundamentals et sentiment
   */
  async getDivergenceAnalysis(ticker: string): Promise<DivergenceAnalysisResponse> {
    return handleError(async () => {
      const upperTicker = ticker.toUpperCase();
      const log = logger.child({ ticker: upperTicker, operation: 'getDivergenceAnalysis' });
      log.info('Getting divergence analysis');

      // Récupérer l'analyse complète
      const completeAnalysis = await this.getCompleteAnalysis(upperTicker);

      if (!completeAnalysis.success || !completeAnalysis.data) {
        log.error('Failed to get complete analysis for divergence');
        throw new Error('Failed to get complete analysis');
      }

      const fundamentalScore = completeAnalysis.data.fundamental.score;
      const sentimentScore = completeAnalysis.data.sentiment.score;
      const divergence = fundamentalScore - sentimentScore;

      // Déterminer le type de divergence
      const type = this.determineDivergenceType(fundamentalScore, sentimentScore);

      // Analyser l'opportunité
      const opportunity = this.analyzeOpportunity(divergence, type);

      const analysis: DivergenceAnalysis = {
        ticker: upperTicker,
        fundamentalScore,
        sentimentScore,
        divergence,
        type,
        opportunity,
        signals: {
          fundamental: this.extractFundamentalSignals(completeAnalysis.data.fundamental),
          sentiment: this.extractSentimentSignals(completeAnalysis.data.sentiment),
        },
      };

      return {
        success: true,
        data: analysis,
        cached: false,
        timestamp: new Date().toISOString(),
      };
    }, `Get divergence analysis for ${ticker}`);
  }

  /**
   * Valuation complète : DCF + Sentiment Multiplier
   */
  async getComprehensiveValuation(ticker: string): Promise<ComprehensiveValuationResponse> {
    return handleError(async () => {
      const upperTicker = ticker.toUpperCase();
      const log = logger.child({ ticker: upperTicker, operation: 'getComprehensiveValuation' });
      log.info('Getting comprehensive valuation');

      // Récupération des valuations FMP
      const [dcf, leveredDcf, quote] = await Promise.allSettled([
        fmp.getFMPDCFValuation(upperTicker),
        fmp.getFMPLeveredDCF(upperTicker),
        fmp.getFMPStockQuote(upperTicker),
      ]);

      log.info('FMP data fetched', {
        dcfStatus: dcf.status,
        leveredDcfStatus: leveredDcf.status,
        quoteStatus: quote.status,
      });

      // Récupération du sentiment pour le multiplier
      const [optionsFlow, institutionalOwnership, shortInterest] = await Promise.allSettled([
        uw.getUWRecentFlows(upperTicker, { min_premium: 100000 }),
        uw.getUWInstitutionOwnership(upperTicker),
        uw.getUWShortInterestAndFloat(upperTicker),
      ]);

      log.info('UW sentiment data fetched', {
        optionsFlowStatus: optionsFlow.status,
        institutionalOwnershipStatus: institutionalOwnership.status,
        shortInterestStatus: shortInterest.status,
      });

      // Extraire les valeurs DCF
      const dcfData = dcf.status === 'fulfilled' && dcf.value?.success
        ? (Array.isArray(dcf.value.data) ? dcf.value.data[0] : dcf.value.data)
        : null;
      const leveredDcfData = leveredDcf.status === 'fulfilled' && leveredDcf.value?.success
        ? (Array.isArray(leveredDcf.value.data) ? leveredDcf.value.data[0] : leveredDcf.value.data)
        : null;
      
      const dcfValue = dcfData?.dcf || dcfData?.['Stock Price'] || 0;
      const leveredDcfValue = leveredDcfData?.dcf || leveredDcfData?.['Stock Price'] || 0;

      log.info('DCF values extracted', {
        dcfValue,
        leveredDcfValue,
        dcfDataExists: !!dcfData,
        leveredDcfDataExists: !!leveredDcfData,
      });

      // Extraire le prix actuel - getStockQuote retourne un tableau
      let currentPrice = 0;
      if (quote.status === 'fulfilled' && quote.value?.success && quote.value.data) {
        const quoteData = Array.isArray(quote.value.data) ? quote.value.data[0] : quote.value.data;
        currentPrice = quoteData?.price || 0;
        
        if (currentPrice === 0) {
          log.warn('Current price is 0, trying alternative sources', {
            quoteData,
            hasPrice: !!quoteData?.price,
            hasClose: !!quoteData?.close,
            hasLastPrice: !!quoteData?.lastPrice,
          });
          // Essayer d'autres champs possibles
          currentPrice = quoteData?.close || quoteData?.lastPrice || quoteData?.currentPrice || 0;
        }
      } else {
        log.warn('Failed to fetch quote or quote data is missing', {
          quoteStatus: quote.status,
          quoteValue: quote.status === 'fulfilled' ? {
            success: quote.value?.success,
            hasData: !!quote.value?.data,
          } : { reason: quote.reason },
        });
      }

      log.info('Current price extracted', { currentPrice });

      // Calculer le sentiment multiplier (0.8 - 1.2)
      const sentimentMultiplier = this.calculateSentimentMultiplier(
        optionsFlow,
        institutionalOwnership,
        shortInterest
      );

      log.info('Sentiment multiplier calculated', { sentimentMultiplier });

      // Valeur fondamentale moyenne
      const fundamentalValue = dcfValue > 0 && leveredDcfValue > 0
        ? (dcfValue + leveredDcfValue) / 2
        : dcfValue || leveredDcfValue;

      if (fundamentalValue === 0) {
        log.warn('Fundamental value is 0, cannot calculate valuation', {
          dcfValue,
          leveredDcfValue,
        });
      }

      // Valeur ajustée par sentiment
      const adjustedValue = fundamentalValue * sentimentMultiplier;

      // Calculer l'upside
      let upside = 0;
      if (currentPrice > 0 && adjustedValue > 0) {
        upside = ((adjustedValue - currentPrice) / currentPrice) * 100;
      } else {
        log.warn('Cannot calculate upside', {
          currentPrice,
          adjustedValue,
          reason: currentPrice === 0 ? 'currentPrice is 0' : 'adjustedValue is 0',
        });
      }

      log.info('Valuation calculated', {
        fundamentalValue,
        adjustedValue,
        currentPrice,
        upside,
      });

      // Générer la recommandation
      const recommendation = this.generateValuationRecommendation(upside, adjustedValue, currentPrice);

      // Calculer la confiance
      const confidence = this.calculateValuationConfidence(dcf, leveredDcf, optionsFlow);

      log.info('Valuation complete', {
        recommendation,
        confidence,
        upside,
      });

      const valuation: ComprehensiveValuation = {
        ticker: upperTicker,
        currentPrice,
        fundamentalValue,
        leveredValue: leveredDcfValue,
        sentimentMultiplier,
        adjustedValue,
        upside,
        recommendation,
        confidence,
        breakdown: {
          dcf: dcfValue,
          leveredDcf: leveredDcfValue,
          sentimentAdjustment: (sentimentMultiplier - 1) * 100, // En %
        },
      };

      return {
        success: true,
        data: valuation,
        cached: false,
        timestamp: new Date().toISOString(),
      };
    }, `Get comprehensive valuation for ${ticker}`);
  }

  // ========== Méthodes privées d'analyse ==========

  private analyzeFundamentals(
    quote: PromiseSettledResult<any>,
    incomeStatement: PromiseSettledResult<any>,
    ratios: PromiseSettledResult<any>,
    keyMetrics: PromiseSettledResult<any>,
    balanceSheet: PromiseSettledResult<any>,
    cashFlow: PromiseSettledResult<any>
  ): FundamentalAnalysis {
    const log = logger.child({ operation: 'analyzeFundamentals' });
    let score = 50; // Score de base
    const details: FundamentalAnalysis['details'] = {};
    let dataAvailable = false;

    // Analyser les ratios
    if (ratios.status === 'fulfilled' && ratios.value?.success && ratios.value.data?.length > 0) {
      dataAvailable = true;
      const ratio = ratios.value.data[0];
      details.peRatio = ratio.priceEarningsRatio;
      details.debtToEquity = ratio.debtEquityRatio;
      details.currentRatio = ratio.currentRatio;
      details.returnOnEquity = ratio.returnOnEquity;

      // Score basé sur les ratios
      if (ratio.priceEarningsRatio && ratio.priceEarningsRatio < 20) score += 10;
      if (ratio.debtEquityRatio && ratio.debtEquityRatio < 0.5) score += 10;
      if (ratio.currentRatio && ratio.currentRatio > 1.5) score += 10;
      if (ratio.returnOnEquity && ratio.returnOnEquity > 0.15) score += 10;
    } else {
      log.warn('Ratios data not available for fundamental analysis', {
        status: ratios.status,
        hasValue: ratios.status === 'fulfilled' && !!ratios.value,
        hasSuccess: ratios.status === 'fulfilled' && ratios.value?.success,
        hasData: ratios.status === 'fulfilled' && ratios.value?.success && ratios.value.data?.length > 0,
      });
    }

    // Analyser les états financiers
    if (incomeStatement.status === 'fulfilled' && incomeStatement.value?.success && incomeStatement.value.data?.length > 0) {
      dataAvailable = true;
      const current = incomeStatement.value.data[0];
      const previous = incomeStatement.value.data[1];

      if (current && previous) {
        details.revenueGrowth = ((current.revenue - previous.revenue) / previous.revenue) * 100;
        details.earningsGrowth = current.netIncome && previous.netIncome
          ? ((current.netIncome - previous.netIncome) / Math.abs(previous.netIncome)) * 100
          : undefined;

        if (details.revenueGrowth && details.revenueGrowth > 0) score += 10;
        if (details.earningsGrowth && details.earningsGrowth > 0) score += 10;
      } else {
        log.warn('Income statement data incomplete', {
          hasCurrent: !!current,
          hasPrevious: !!previous,
        });
      }
    } else {
      log.warn('Income statement data not available', {
        status: incomeStatement.status,
        hasValue: incomeStatement.status === 'fulfilled' && !!incomeStatement.value,
        hasSuccess: incomeStatement.status === 'fulfilled' && incomeStatement.value?.success,
        hasData: incomeStatement.status === 'fulfilled' && incomeStatement.value?.success && incomeStatement.value.data?.length > 0,
      });
    }

    // Analyser le cash flow
    if (cashFlow.status === 'fulfilled' && cashFlow.value?.success && cashFlow.value.data?.length > 0) {
      dataAvailable = true;
      const cf = cashFlow.value.data[0];
      if (cf.operatingCashFlow && cf.operatingCashFlow > 0) score += 10;
    } else {
      log.warn('Cash flow data not available', {
        status: cashFlow.status,
        hasValue: cashFlow.status === 'fulfilled' && !!cashFlow.value,
        hasSuccess: cashFlow.status === 'fulfilled' && cashFlow.value?.success,
        hasData: cashFlow.status === 'fulfilled' && cashFlow.value?.success && cashFlow.value.data?.length > 0,
      });
    }

    // Normaliser le score (0-100)
    score = Math.max(0, Math.min(100, score));

    if (!dataAvailable) {
      log.warn('No financial data available for fundamental analysis, using default score', { score });
    }

    log.info('Fundamental analysis complete', {
      score,
      dataAvailable,
      hasRatios: !!details.peRatio,
      hasGrowth: !!details.revenueGrowth,
    });

    return {
      score,
      undervalued: details.peRatio ? details.peRatio < 15 : false,
      strongRatios: (details.debtToEquity || 0) < 0.5 && (details.currentRatio || 0) > 1.5,
      growingRevenue: (details.revenueGrowth || 0) > 0,
      strongBalanceSheet: (details.debtToEquity || 0) < 0.5,
      positiveCashFlow: true, // Simplifié
      details,
    };
  }

  private analyzeSentiment(
    optionsFlow: PromiseSettledResult<any>,
    darkPool: PromiseSettledResult<any>,
    shortInterest: PromiseSettledResult<any>,
    institutionalOwnership: PromiseSettledResult<any>,
    insiderTrades: PromiseSettledResult<any>
  ): SentimentAnalysis {
    const log = logger.child({ operation: 'analyzeSentiment' });
    let score = 50; // Score de base
    const details: SentimentAnalysis['details'] = {};
    let dataAvailable = false;

    // Analyser le flow d'options
    if (optionsFlow.status === 'fulfilled' && optionsFlow.value?.success && optionsFlow.value.data) {
      dataAvailable = true;
      const flows = Array.isArray(optionsFlow.value.data) ? optionsFlow.value.data : [];
      const calls = flows.filter((f: any) => f.is_call && f.premium > 0);
      const puts = flows.filter((f: any) => f.is_put && f.premium > 0);
      
      details.callPutRatio = calls.length > 0 && puts.length > 0
        ? calls.length / puts.length
        : calls.length > 0 ? 2 : 0.5;

      if (details.callPutRatio > 1.2) score += 15;
      else if (details.callPutRatio < 0.8) score -= 15;
    } else {
      log.warn('Options flow data not available', {
        status: optionsFlow.status,
        hasValue: optionsFlow.status === 'fulfilled' && !!optionsFlow.value,
        hasSuccess: optionsFlow.status === 'fulfilled' && optionsFlow.value?.success,
        hasData: optionsFlow.status === 'fulfilled' && optionsFlow.value?.success && !!optionsFlow.value.data,
      });
    }

    // Analyser le dark pool
    if (darkPool.status === 'fulfilled' && darkPool.value?.success && darkPool.value.data) {
      const trades = Array.isArray(darkPool.value.data) ? darkPool.value.data : [];
      details.darkPoolTrades = trades.length;
      if (trades.length > 10) score += 10;
    }

    // Analyser le short interest
    if (shortInterest.status === 'fulfilled' && shortInterest.value?.success && shortInterest.value.data) {
      dataAvailable = true;
      // L'API peut retourner un tableau ou un objet unique
      const si = Array.isArray(shortInterest.value.data) 
        ? shortInterest.value.data[0] // Prendre le plus récent
        : shortInterest.value.data;
      
      if (si && typeof si === 'object') {
        details.shortPercentOfFloat = si.percent_returned 
          ? parseFloat(String(si.percent_returned)) 
          : undefined;
        if (details.shortPercentOfFloat && details.shortPercentOfFloat < 5) score += 10;
        else if (details.shortPercentOfFloat && details.shortPercentOfFloat > 20) score -= 15;
      }
    } else {
      log.warn('Short interest data not available', {
        status: shortInterest.status,
        hasValue: shortInterest.status === 'fulfilled' && !!shortInterest.value,
        hasSuccess: shortInterest.status === 'fulfilled' && shortInterest.value?.success,
        hasData: shortInterest.status === 'fulfilled' && shortInterest.value?.success && !!shortInterest.value.data,
      });
    }

    // Analyser l'activité institutionnelle
    if (institutionalOwnership.status === 'fulfilled' && institutionalOwnership.value?.success && institutionalOwnership.value.data) {
      const ownership = Array.isArray(institutionalOwnership.value.data) ? institutionalOwnership.value.data : [];
      details.institutionalNetActivity = ownership.length; // Simplifié
      if (ownership.length > 20) score += 10;
    }

    // Analyser l'activité des insiders
    if (insiderTrades.status === 'fulfilled' && insiderTrades.value?.success && insiderTrades.value.data) {
      dataAvailable = true;
      const trades = Array.isArray(insiderTrades.value.data) ? insiderTrades.value.data : [];
      
      // L'API peut retourner soit des transactions individuelles, soit des agrégations
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
      
      // Si format agrégé (purchases/sells)
      if (buys.length === 0 && sells.length === 0) {
        const totalPurchases = trades.reduce((sum: number, t: any) => sum + (t.purchases || 0), 0);
        const totalSells = trades.reduce((sum: number, t: any) => sum + (t.sells || 0), 0);
        details.insiderNetActivity = totalPurchases - totalSells;
      } else {
        details.insiderNetActivity = buys.length - sells.length;
      }
      
      if (details.insiderNetActivity > 0) score += 10;
      else if (details.insiderNetActivity < -5) score -= 10;
    } else {
      log.warn('Insider trades data not available', {
        status: insiderTrades.status,
        hasValue: insiderTrades.status === 'fulfilled' && !!insiderTrades.value,
        hasSuccess: insiderTrades.status === 'fulfilled' && insiderTrades.value?.success,
        hasData: insiderTrades.status === 'fulfilled' && insiderTrades.value?.success && !!insiderTrades.value.data,
      });
    }

    // Normaliser le score (0-100)
    score = Math.max(0, Math.min(100, score));

    if (!dataAvailable) {
      log.warn('No sentiment data available, using default score', { score });
    }

    log.info('Sentiment analysis complete', {
      score,
      dataAvailable,
      callPutRatio: details.callPutRatio,
      darkPoolTrades: details.darkPoolTrades,
      shortPercentOfFloat: details.shortPercentOfFloat,
    });

    return {
      score,
      bullishOptions: (details.callPutRatio || 0) > 1.2,
      darkPoolActivity: (details.darkPoolTrades || 0) > 10,
      lowShortInterest: (details.shortPercentOfFloat || 0) < 5,
      institutionalBuying: (details.institutionalNetActivity || 0) > 0,
      insiderBuying: (details.insiderNetActivity || 0) > 0,
      details,
    };
  }

  private analyzeConvergence(fundamental: FundamentalAnalysis, sentiment: SentimentAnalysis): ConvergenceAnalysis {
    const divergence = fundamental.score - sentiment.score;
    const aligned = Math.abs(divergence) < 20;

    let type: ConvergenceAnalysis['type'];
    if (fundamental.score > 70 && sentiment.score > 70) {
      type = 'bullish_aligned';
    } else if (fundamental.score < 30 && sentiment.score < 30) {
      type = 'bearish_aligned';
    } else if (fundamental.score > 70 && sentiment.score < 30) {
      type = 'bullish_divergence';
    } else {
      type = 'bearish_divergence';
    }

    const opportunity = type === 'bullish_divergence' && Math.abs(divergence) > 30;

    return {
      aligned,
      divergence,
      type,
      opportunity,
    };
  }

  private generateRecommendation(
    fundamental: FundamentalAnalysis,
    sentiment: SentimentAnalysis,
    convergence: ConvergenceAnalysis
  ): Recommendation {
    const avgScore = (fundamental.score + sentiment.score) / 2;

    if (avgScore > 80 && convergence.aligned) return 'STRONG_BUY';
    if (avgScore > 65) return 'BUY';
    if (avgScore < 35 && convergence.aligned) return 'STRONG_SELL';
    if (avgScore < 50) return 'SELL';
    return 'HOLD';
  }

  private calculateConfidence(fundamental: FundamentalAnalysis, sentiment: SentimentAnalysis): number {
    // Plus les deux scores sont proches, plus la confiance est élevée
    const divergence = Math.abs(fundamental.score - sentiment.score);
    const baseConfidence = 100 - divergence;
    return Math.max(50, Math.min(100, baseConfidence));
  }

  private determineDivergenceType(fundamentalScore: number, sentimentScore: number): DivergenceType {
    if (fundamentalScore > 70 && sentimentScore < 30) {
      return 'fundamental_bullish_sentiment_bearish';
    }
    if (fundamentalScore < 30 && sentimentScore > 70) {
      return 'fundamental_bearish_sentiment_bullish';
    }
    if (fundamentalScore > 70 && sentimentScore > 70) {
      return 'aligned_bullish';
    }
    return 'aligned_bearish';
  }

  private analyzeOpportunity(divergence: number, type: DivergenceType): OpportunityAnalysis {
    const isOpportunity = type === 'fundamental_bullish_sentiment_bearish' && Math.abs(divergence) > 30;
    
    return {
      isOpportunity,
      type: isOpportunity ? 'buy' : type === 'fundamental_bearish_sentiment_bullish' ? 'sell' : 'hold',
      confidence: Math.min(100, Math.abs(divergence)),
      reasoning: this.generateOpportunityReasoning(divergence, type),
      timeframe: isOpportunity ? 'medium-term' : undefined,
    };
  }

  private generateOpportunityReasoning(divergence: number, type: DivergenceType): string {
    if (type === 'fundamental_bullish_sentiment_bearish') {
      return `Fundamentals forts (score élevé) mais sentiment négatif. Opportunité d'achat si le sentiment s'améliore.`;
    }
    if (type === 'fundamental_bearish_sentiment_bullish') {
      return `Fundamentals faibles mais sentiment positif. Risque de correction si les fundamentals ne s'améliorent pas.`;
    }
    if (type === 'aligned_bullish') {
      return `Fundamentals et sentiment alignés positivement. Signal fort d'achat.`;
    }
    return `Fundamentals et sentiment alignés négativement. Signal de vente.`;
  }

  private extractFundamentalSignals(fundamental: FundamentalAnalysis) {
    return {
      revenueGrowth: fundamental.details.revenueGrowth || 0,
      earningsGrowth: fundamental.details.earningsGrowth || 0,
      peRatio: fundamental.details.peRatio || 0,
      debtToEquity: fundamental.details.debtToEquity || 0,
      returnOnEquity: fundamental.details.returnOnEquity || 0,
      currentRatio: fundamental.details.currentRatio || 0,
    };
  }

  private extractSentimentSignals(sentiment: SentimentAnalysis) {
    return {
      optionsFlow: (sentiment.details.callPutRatio || 1) - 1, // Net flow
      darkPoolActivity: sentiment.details.darkPoolTrades || 0,
      shortInterest: sentiment.details.shortPercentOfFloat || 0,
      institutionalActivity: sentiment.details.institutionalNetActivity || 0,
      insiderActivity: sentiment.details.insiderNetActivity || 0,
    };
  }

  private calculateSentimentMultiplier(
    optionsFlow: PromiseSettledResult<any>,
    institutionalOwnership: PromiseSettledResult<any>,
    shortInterest: PromiseSettledResult<any>
  ): number {
    let multiplier = 1.0; // Base

    // Options flow positif = multiplier plus élevé
    if (optionsFlow.status === 'fulfilled' && optionsFlow.value?.success && optionsFlow.value.data) {
      const flows = Array.isArray(optionsFlow.value.data) ? optionsFlow.value.data : [];
      const calls = flows.filter((f: any) => f.is_call && f.premium > 0);
      const puts = flows.filter((f: any) => f.is_put && f.premium > 0);
      const ratio = calls.length > 0 && puts.length > 0 ? calls.length / puts.length : 1;
      if (ratio > 1.5) multiplier += 0.1;
      else if (ratio < 0.7) multiplier -= 0.1;
    }

    // Short interest faible = multiplier plus élevé
    if (shortInterest.status === 'fulfilled' && shortInterest.value?.success && shortInterest.value.data) {
      const si = shortInterest.value.data;
      const percent = si.percent_returned ? parseFloat(si.percent_returned) : 0;
      if (percent < 5) multiplier += 0.05;
      else if (percent > 20) multiplier -= 0.1;
    }

    // Ownership institutionnelle élevée = multiplier plus élevé
    if (institutionalOwnership.status === 'fulfilled' && institutionalOwnership.value?.success && institutionalOwnership.value.data) {
      const ownership = Array.isArray(institutionalOwnership.value.data) ? institutionalOwnership.value.data : [];
      if (ownership.length > 30) multiplier += 0.05;
    }

    // Limiter entre 0.8 et 1.2
    return Math.max(0.8, Math.min(1.2, multiplier));
  }

  private generateValuationRecommendation(upside: number, adjustedValue: number, currentPrice: number): Recommendation {
    if (upside > 30) return 'STRONG_BUY';
    if (upside > 15) return 'BUY';
    if (upside < -30) return 'STRONG_SELL';
    if (upside < -15) return 'SELL';
    return 'HOLD';
  }

  private calculateValuationConfidence(
    dcf: PromiseSettledResult<any>,
    leveredDcf: PromiseSettledResult<any>,
    optionsFlow: PromiseSettledResult<any>
  ): number {
    let confidence = 50;

    if (dcf.status === 'fulfilled' && dcf.value?.success) confidence += 20;
    if (leveredDcf.status === 'fulfilled' && leveredDcf.value?.success) confidence += 20;
    if (optionsFlow.status === 'fulfilled' && optionsFlow.value?.success) confidence += 10;

    return Math.min(100, confidence);
  }
}

