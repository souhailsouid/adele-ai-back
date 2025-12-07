/**
 * Service de screening multi-critères
 * Combine FMP screener + UW sentiment filter
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import * as fmp from '../fmp';
import * as uw from '../unusual-whales';
import type {
  ScreeningCriteria,
  MultiCriteriaScreenerResponse,
  ScreenedTicker,
} from '../types/combined-analysis';

export class MultiCriteriaScreenerService {
  /**
   * Screen les tickers selon plusieurs critères (FMP + UW)
   */
  async screenTickers(criteria: ScreeningCriteria): Promise<MultiCriteriaScreenerResponse> {
    return handleError(async () => {
      const log = logger.child({ operation: 'screenTickers' });
      log.info('Screening tickers with multi-criteria', { criteria });

      // 1. Screening fondamental (FMP)
      const fmpCriteria: Record<string, any> = {};
      if (criteria.minMarketCap) fmpCriteria.marketCapMoreThan = criteria.minMarketCap;
      if (criteria.maxMarketCap) fmpCriteria.marketCapLowerThan = criteria.maxMarketCap;
      if (criteria.maxPERatio) fmpCriteria.peRatioLowerThan = criteria.maxPERatio;
      if (criteria.minPERatio) fmpCriteria.peRatioMoreThan = criteria.minPERatio;
      if (criteria.minDividend) fmpCriteria.dividendMoreThan = criteria.minDividend;
      if (criteria.minRevenueGrowth) fmpCriteria.revenueGrowthMoreThan = criteria.minRevenueGrowth;
      if (criteria.maxDebtToEquity) fmpCriteria.debtToEquityLowerThan = criteria.maxDebtToEquity;
      if (criteria.minReturnOnEquity) fmpCriteria.returnOnEquityMoreThan = criteria.minReturnOnEquity;
      if (criteria.sector) fmpCriteria.sector = criteria.sector;
      if (criteria.exchange) fmpCriteria.exchange = criteria.exchange;

      // Appel au screener FMP
      const fmpResults = await fmp.getFMPStockScreener(fmpCriteria);

      log.info('FMP screener results', {
        success: fmpResults.success,
        count: fmpResults.data?.length || 0,
      });

      if (!fmpResults.success || !fmpResults.data || fmpResults.data.length === 0) {
        log.warn('No tickers found from FMP screener');
        return {
          success: true,
          data: [],
          cached: false,
          count: 0,
          timestamp: new Date().toISOString(),
        };
      }

      // 2. Filtrer par sentiment (UW) et calculer les scores
      const screenedTickers: ScreenedTicker[] = [];
      const limit = criteria.limit || 50;
      const tickersToProcess = fmpResults.data.slice(0, limit);

      log.info('Processing tickers for sentiment analysis', {
        total: fmpResults.data.length,
        toProcess: tickersToProcess.length,
      });

      for (const ticker of tickersToProcess) {
        const symbol = ticker.symbol || ticker.Symbol || '';
        if (!symbol) {
          log.warn('Ticker without symbol, skipping', { ticker });
          continue;
        }

        try {
          // Récupérer les données de sentiment
          const [optionsFlow, shortInterest, institutionalOwnership, darkPool] = await Promise.allSettled([
            uw.getUWRecentFlows(symbol, { min_premium: criteria.minOptionsPremium || 50000 }),
            uw.getUWShortInterestAndFloat(symbol),
            uw.getUWInstitutionOwnership(symbol),
            uw.getUWDarkPoolTrades(symbol, { limit: 10 }),
          ]);

          // Calculer les scores
          const fundamentalScore = this.calculateFundamentalScore(ticker);
          const sentimentScore = this.calculateSentimentScore(
            optionsFlow,
            shortInterest,
            institutionalOwnership,
            darkPool,
            criteria
          );

          // Vérifier les filtres de sentiment
          if (criteria.minSentimentScore && sentimentScore < criteria.minSentimentScore) {
            continue;
          }
          if (criteria.maxShortInterest) {
            const si = shortInterest.status === 'fulfilled' && shortInterest.value?.success && shortInterest.value.data
              ? (shortInterest.value.data.percent_returned ? parseFloat(shortInterest.value.data.percent_returned) : 0)
              : 0;
            if (si > criteria.maxShortInterest) continue;
          }

          const combinedScore = (fundamentalScore * 0.6 + sentimentScore * 0.4);

          // Vérifier les filtres de sentiment
          if (criteria.minSentimentScore && sentimentScore < criteria.minSentimentScore) {
            log.debug('Ticker filtered out by sentiment score', { symbol, sentimentScore, minRequired: criteria.minSentimentScore });
            continue;
          }
          if (criteria.maxShortInterest) {
            const si = shortInterest.status === 'fulfilled' && shortInterest.value?.success && shortInterest.value.data
              ? (shortInterest.value.data.percent_returned ? parseFloat(shortInterest.value.data.percent_returned) : 0)
              : 0;
            if (si > criteria.maxShortInterest) {
              log.debug('Ticker filtered out by short interest', { symbol, shortInterest: si, maxAllowed: criteria.maxShortInterest });
              continue;
            }
          }

          screenedTickers.push({
            symbol,
            name: ticker.name || ticker.Name || symbol,
            fundamentalScore,
            sentimentScore,
            combinedScore,
            currentPrice: ticker.price || ticker.Price || 0,
            marketCap: ticker.marketCap || ticker.MarketCap || 0,
            peRatio: ticker.peRatio || ticker.PERatio,
            details: {
              revenueGrowth: ticker.revenueGrowth || ticker.RevenueGrowth,
              debtToEquity: ticker.debtToEquity || ticker.DebtToEquity,
              optionsFlow: this.extractOptionsFlow(optionsFlow),
              shortInterest: this.extractShortInterest(shortInterest),
              institutionalOwnership: this.extractInstitutionalOwnership(institutionalOwnership),
            },
          });
        } catch (error) {
          log.warn(`Failed to analyze sentiment for ${symbol}`, { error, symbol });
          // Continue avec le ticker suivant
        }
      }

      log.info('Screening complete', {
        initialCount: fmpResults.data.length,
        screenedCount: screenedTickers.length,
      });

      // Trier par score combiné
      screenedTickers.sort((a, b) => b.combinedScore - a.combinedScore);

      return {
        success: true,
        data: screenedTickers,
        cached: false,
        count: screenedTickers.length,
        timestamp: new Date().toISOString(),
      };
    }, 'Screen tickers with multi-criteria');
  }

  // ========== Méthodes privées ==========

  private calculateFundamentalScore(ticker: any): number {
    let score = 50;

    // PE Ratio
    const peRatio = ticker.peRatio || ticker.PERatio;
    if (peRatio && peRatio > 0 && peRatio < 20) score += 10;
    else if (peRatio && peRatio > 0 && peRatio < 30) score += 5;

    // Revenue Growth
    const revenueGrowth = ticker.revenueGrowth || ticker.RevenueGrowth;
    if (revenueGrowth && revenueGrowth > 10) score += 15;
    else if (revenueGrowth && revenueGrowth > 5) score += 10;
    else if (revenueGrowth && revenueGrowth > 0) score += 5;

    // Debt to Equity
    const debtToEquity = ticker.debtToEquity || ticker.DebtToEquity;
    if (debtToEquity !== undefined && debtToEquity < 0.5) score += 10;
    else if (debtToEquity !== undefined && debtToEquity < 1.0) score += 5;

    // Return on Equity
    const roe = ticker.returnOnEquity || ticker.ReturnOnEquity;
    if (roe && roe > 0.15) score += 10;
    else if (roe && roe > 0.10) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  private calculateSentimentScore(
    optionsFlow: PromiseSettledResult<any>,
    shortInterest: PromiseSettledResult<any>,
    institutionalOwnership: PromiseSettledResult<any>,
    darkPool: PromiseSettledResult<any>,
    criteria: ScreeningCriteria
  ): number {
    let score = 50;

    // Options Flow
    if (optionsFlow.status === 'fulfilled' && optionsFlow.value?.success && optionsFlow.value.data) {
      const flows = Array.isArray(optionsFlow.value.data) ? optionsFlow.value.data : [];
      const calls = flows.filter((f: any) => f.is_call && f.premium > 0);
      const puts = flows.filter((f: any) => f.is_put && f.premium > 0);
      const ratio = calls.length > 0 && puts.length > 0 ? calls.length / puts.length : 1;
      
      if (ratio > 1.5) score += 15;
      else if (ratio < 0.7) score -= 15;
    }

    // Short Interest
    if (shortInterest.status === 'fulfilled' && shortInterest.value?.success && shortInterest.value.data) {
      const si = shortInterest.value.data;
      const percent = si.percent_returned ? parseFloat(si.percent_returned) : 0;
      
      if (percent < 5) score += 10;
      else if (percent > 20) score -= 15;
    }

    // Institutional Ownership
    if (institutionalOwnership.status === 'fulfilled' && institutionalOwnership.value?.success && institutionalOwnership.value.data) {
      const ownership = Array.isArray(institutionalOwnership.value.data) ? institutionalOwnership.value.data : [];
      if (ownership.length > 20) score += 10;
    }

    // Dark Pool
    if (darkPool.status === 'fulfilled' && darkPool.value?.success && darkPool.value.data) {
      const trades = Array.isArray(darkPool.value.data) ? darkPool.value.data : [];
      if (trades.length > 10) score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private extractOptionsFlow(optionsFlow: PromiseSettledResult<any>): number {
    if (optionsFlow.status === 'fulfilled' && optionsFlow.value?.success && optionsFlow.value.data) {
      const flows = Array.isArray(optionsFlow.value.data) ? optionsFlow.value.data : [];
      const calls = flows.filter((f: any) => f.is_call && f.premium > 0);
      const puts = flows.filter((f: any) => f.is_put && f.premium > 0);
      return calls.length - puts.length;
    }
    return 0;
  }

  private extractShortInterest(shortInterest: PromiseSettledResult<any>): number {
    if (shortInterest.status === 'fulfilled' && shortInterest.value?.success && shortInterest.value.data) {
      const si = shortInterest.value.data;
      return si.percent_returned ? parseFloat(si.percent_returned) : 0;
    }
    return 0;
  }

  private extractInstitutionalOwnership(institutionalOwnership: PromiseSettledResult<any>): number {
    if (institutionalOwnership.status === 'fulfilled' && institutionalOwnership.value?.success && institutionalOwnership.value.data) {
      const ownership = Array.isArray(institutionalOwnership.value.data) ? institutionalOwnership.value.data : [];
      return ownership.length;
    }
    return 0;
  }
}

