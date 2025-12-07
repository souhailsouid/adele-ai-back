/**
 * Service pour agréger toutes les informations d'un ticker
 * Combine les données de FMP et Unusual Whales
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import {
  getTickerQuote,
  getTickerOwnership,
  getTickerActivity,
  getTickerInsiders,
  getTickerOptions,
  getTickerDarkPool,
} from '../ticker-activity';
import * as fmp from '../fmp';
import * as uw from '../unusual-whales';
import type {
  TickerInsights,
  TickerInsightsResponse,
  CompanyInfo,
  QuoteInfo,
  OptionsFlowInsights,
  InstitutionalInsights,
  InsiderInsights,
  DarkPoolInsights,
  EarningsInsights,
  NewsInsights,
  EconomicEvent,
  ShortInterestInfo,
  FinancialMetrics,
  SECFiling,
  AlertSignal,
} from '../types/ticker-insights';

export class TickerInsightsService {
  /**
   * Récupère toutes les informations agrégées pour un ticker
   */
  async getTickerInsights(ticker: string): Promise<TickerInsightsResponse> {
    return handleError(async () => {
      const upperTicker = ticker.toUpperCase();
      logger.info(`Fetching insights for ticker: ${upperTicker}`);

      // Récupération parallèle des données de base
      const [
        quoteData,
        ownershipData,
        activityData,
        insidersData,
        optionsData,
        darkPoolData,
      ] = await Promise.allSettled([
        getTickerQuote(upperTicker),
        getTickerOwnership(upperTicker, 50), // Top 50 institutions
        getTickerActivity(upperTicker, 100), // 100 dernières activités
        getTickerInsiders(upperTicker, 50), // 50 dernières transactions
        getTickerOptions(upperTicker, 100), // 100 dernières options
        getTickerDarkPool(upperTicker, 50), // 50 derniers trades
      ]);

      // Récupération des données FMP
      const [
        fmpQuote,
        fmpCompanyInfo,
        fmpEarnings,
        fmpEarningsCalendar,
        fmpNews,
        fmpKeyMetrics,
        fmpRatios,
        fmpSECFilings,
        fmpShortInterest,
      ] = await Promise.allSettled([
        fmp.getFMPStockQuote(upperTicker),
        fmp.getFMPSECCompanyFullProfile({ symbol: upperTicker }),
        fmp.getFMPEarningsReport(upperTicker),
        fmp.getFMPEarningsCalendar({ from: new Date().toISOString().split('T')[0] }),
        fmp.getFMPStockNews({ page: 0, limit: 10 }),
        fmp.getFMPKeyMetrics({ symbol: upperTicker, limit: 1 }),
        fmp.getFMPFinancialRatios({ symbol: upperTicker, limit: 1 }),
        fmp.getFMPSECFilingsBySymbol({
          symbol: upperTicker,
          from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          to: new Date().toISOString().split('T')[0],
          limit: 10,
        }),
        uw.getUWShortInterestAndFloat(upperTicker),
      ]);

      // Récupération des données Unusual Whales supplémentaires
      const [
        uwRecentFlows,
        uwFlowPerExpiry,
        uwGreeks,
        uwEconomicCalendar,
        uwMaxPain,
        uwOIChange,
        uwOptionsVolume,
        uwVolatilityStats,
        uwSpotExposures,
      ] = await Promise.allSettled([
        uw.getUWRecentFlows(upperTicker, {}),
        uw.getUWFlowPerExpiry(upperTicker, {}),
        uw.getUWGreeks(upperTicker, { expiry: '' }), // Expiry requis, on utilisera le premier disponible
        uw.getUWEconomicCalendar({}),
        uw.getUWMaxPain(upperTicker, {}),
        uw.getUWStockOIChange(upperTicker, {}),
        uw.getUWOptionsVolume(upperTicker, {}),
        uw.getUWVolatilityStats(upperTicker, {}),
        uw.getUWSpotExposures(upperTicker, {}),
      ]);

      // Construction de la réponse
      const insights: TickerInsights = {
        ticker: upperTicker,
        companyInfo: this.extractCompanyInfo(fmpCompanyInfo, fmpQuote),
        quote: this.extractQuoteInfo(quoteData, fmpQuote),
        optionsFlow: this.extractOptionsFlow(
          optionsData,
          uwRecentFlows,
          uwFlowPerExpiry,
          uwGreeks,
          uwMaxPain,
          uwOIChange,
          uwOptionsVolume,
          uwSpotExposures
        ),
        institutionalActivity: this.extractInstitutionalActivity(ownershipData, activityData),
        insiderActivity: this.extractInsiderActivity(insidersData),
        darkPool: this.extractDarkPool(darkPoolData),
        earnings: this.extractEarnings(fmpEarnings, fmpEarningsCalendar, upperTicker),
        news: this.extractNews(fmpNews),
        economicEvents: this.extractEconomicEvents(uwEconomicCalendar),
        shortInterest: this.extractShortInterest(fmpShortInterest),
        financialMetrics: this.extractFinancialMetrics(fmpKeyMetrics, fmpRatios),
        recentFilings: this.extractSECFilings(fmpSECFilings),
        alerts: this.generateAlerts(
          optionsData,
          activityData,
          insidersData,
          fmpEarningsCalendar,
          fmpNews,
          upperTicker
        ),
      };

      // Déterminer si les données sont en cache
      const cached =
        (quoteData.status === 'fulfilled' && quoteData.value.cached) ||
        (ownershipData.status === 'fulfilled' && ownershipData.value.cached);

      return {
        success: true,
        data: insights,
        cached: cached || false,
        timestamp: new Date().toISOString(),
      };
    }, `Get ticker insights for ${ticker}`);
  }

  private extractCompanyInfo(
    companyInfo: PromiseSettledResult<any>,
    quote: PromiseSettledResult<any>
  ): CompanyInfo {
    if (companyInfo.status === 'fulfilled' && companyInfo.value?.data) {
      const data = Array.isArray(companyInfo.value.data)
        ? companyInfo.value.data[0]
        : companyInfo.value.data;
      return {
        name: data.name || data.companyName || '',
        sector: data.sector,
        industry: data.industry,
        exchange: data.exchange || '',
        marketCap: data.marketCap,
        description: data.description,
        website: data.website,
        ceo: data.ceo,
      };
    }
    return { name: '', exchange: '' };
  }

  private extractQuoteInfo(
    quote: PromiseSettledResult<any>,
    fmpQuote: PromiseSettledResult<any>
  ): QuoteInfo {
    // Priorité à FMP quote si disponible
    if (fmpQuote.status === 'fulfilled' && fmpQuote.value?.data) {
      const data = Array.isArray(fmpQuote.value.data)
        ? fmpQuote.value.data[0]
        : fmpQuote.value.data;
      return {
        price: data.price || 0,
        change: data.change || 0,
        changePercent: data.changePercentage || 0,
        volume: data.volume || 0,
        avgVolume: data.avgVolume,
        dayLow: data.dayLow || 0,
        dayHigh: data.dayHigh || 0,
        yearLow: data.yearLow || 0,
        yearHigh: data.yearHigh || 0,
        previousClose: data.previousClose || 0,
        open: data.open || 0,
        timestamp: new Date().toISOString(),
      };
    }

    // Fallback sur Unusual Whales quote
    if (quote.status === 'fulfilled' && quote.value?.data) {
      const data = quote.value.data;
      return {
        price: data.price || 0,
        change: data.change || 0,
        changePercent: data.changePercent || 0,
        volume: data.volume || 0,
        dayLow: data.dayLow || 0,
        dayHigh: data.dayHigh || 0,
        yearLow: data.yearLow || 0,
        yearHigh: data.yearHigh || 0,
        previousClose: data.previousClose || 0,
        open: data.open || 0,
        timestamp: data.timestamp || new Date().toISOString(),
      };
    }

    return {
      price: 0,
      change: 0,
      changePercent: 0,
      volume: 0,
      dayLow: 0,
      dayHigh: 0,
      yearLow: 0,
      yearHigh: 0,
      previousClose: 0,
      open: 0,
      timestamp: new Date().toISOString(),
    };
  }

  private extractOptionsFlow(
    options: PromiseSettledResult<any>,
    recentFlows: PromiseSettledResult<any>,
    flowPerExpiry: PromiseSettledResult<any>,
    greeks: PromiseSettledResult<any>,
    maxPain: PromiseSettledResult<any>,
    oiChange: PromiseSettledResult<any>,
    optionsVolume: PromiseSettledResult<any>,
    spotExposures: PromiseSettledResult<any>
  ): OptionsFlowInsights {
    const optionsData = options.status === 'fulfilled' ? options.value?.data || [] : [];
    const calls = optionsData.filter((o: any) => o.type === 'call');
    const puts = optionsData.filter((o: any) => o.type === 'put');

    const callVolume = calls.reduce((sum: number, o: any) => sum + (o.volume || 0), 0);
    const putVolume = puts.reduce((sum: number, o: any) => sum + (o.volume || 0), 0);
    const callPremium = calls.reduce((sum: number, o: any) => sum + (o.premium || 0), 0);
    const putPremium = puts.reduce((sum: number, o: any) => sum + (o.premium || 0), 0);

    // Flow per expiry
    const flowByExpiry: OptionsFlowInsights['flowByExpiry'] = [];
    if (flowPerExpiry.status === 'fulfilled' && flowPerExpiry.value?.data) {
      const expiryData = Array.isArray(flowPerExpiry.value.data)
        ? flowPerExpiry.value.data
        : [];
      expiryData.forEach((item: any) => {
        flowByExpiry.push({
          expiry: item.expiry || item.expiration || '',
          callVolume: item.call_volume || item.callVolume || 0,
          putVolume: item.put_volume || item.putVolume || 0,
          openInterest: item.open_interest || item.openInterest || 0,
          maxPain: item.max_pain || item.maxPain,
        });
      });
    }

    // Unusual activity
    const unusualActivity: OptionsFlowInsights['unusualActivity'] = [];
    if (recentFlows.status === 'fulfilled' && recentFlows.value?.data) {
      const flows = Array.isArray(recentFlows.value.data)
        ? recentFlows.value.data
        : [];
      flows.slice(0, 10).forEach((flow: any) => {
        if (flow.is_sweep || flow.is_block || flow.is_large || flow.is_unusual) {
          unusualActivity.push({
            timestamp: flow.created_at || flow.timestamp || new Date().toISOString(),
            type: flow.is_sweep ? 'sweep' : flow.is_block ? 'block' : flow.is_large ? 'large' : 'unusual',
            strike: flow.strike || 0,
            expiry: flow.expiry || flow.expiration || '',
            premium: flow.premium || flow.total_premium || 0,
            volume: flow.volume || 0,
            description: `${flow.type || 'option'} ${flow.strike || ''} ${flow.expiry || ''}`,
          });
        }
      });
    }

    // Greeks
    let greeksData: OptionsFlowInsights['greeks'];
    if (greeks.status === 'fulfilled' && greeks.value?.data) {
      const g = Array.isArray(greeks.value.data) ? greeks.value.data[0] : greeks.value.data;
      if (g) {
        greeksData = {
          delta: g.delta || 0,
          gamma: g.gamma || 0,
          theta: g.theta || 0,
          vega: g.vega || 0,
          iv: g.iv || g.implied_volatility || 0,
        };
      }
    }

    // Max Pain
    let maxPainData: OptionsFlowInsights['maxPain'];
    if (maxPain.status === 'fulfilled' && maxPain.value?.data) {
      const mp = Array.isArray(maxPain.value.data) ? maxPain.value.data[0] : maxPain.value.data;
      if (mp) {
        maxPainData = {
          price: mp.max_pain || mp.maxPain || 0,
          expiry: mp.expiry || mp.expiration,
        };
      }
    }

    // OI Change
    let oiChangeData: OptionsFlowInsights['oiChange'];
    if (oiChange.status === 'fulfilled' && oiChange.value?.data) {
      const oi = Array.isArray(oiChange.value.data) ? oiChange.value.data[0] : oiChange.value.data;
      if (oi) {
        oiChangeData = {
          totalChange: oi.total_change || oi.totalChange || 0,
          callChange: oi.call_change || oi.callChange || 0,
          putChange: oi.put_change || oi.putChange || 0,
          netChange: (oi.call_change || oi.callChange || 0) - (oi.put_change || oi.putChange || 0),
        };
      }
    }

    // Options Volume
    let optionsVolumeData: OptionsFlowInsights['optionsVolume'];
    if (optionsVolume.status === 'fulfilled' && optionsVolume.value?.data) {
      const ov = Array.isArray(optionsVolume.value.data) ? optionsVolume.value.data[0] : optionsVolume.value.data;
      if (ov) {
        const callVol = ov.call_volume || ov.callVolume || 0;
        const putVol = ov.put_volume || ov.putVolume || 0;
        optionsVolumeData = {
          totalVolume: (callVol + putVol),
          callVolume: callVol,
          putVolume: putVol,
          volumeRatio: callVol > 0 ? putVol / callVol : 0,
        };
      }
    }

    // Spot GEX Exposures
    let spotGEXData: OptionsFlowInsights['spotGEX'];
    if (spotExposures.status === 'fulfilled' && spotExposures.value?.data) {
      const gex = Array.isArray(spotExposures.value.data) ? spotExposures.value.data[0] : spotExposures.value.data;
      if (gex) {
        const callGEX = gex.call_gex || gex.callGEX || 0;
        const putGEX = gex.put_gex || gex.putGEX || 0;
        spotGEXData = {
          totalGEX: Math.abs(callGEX) + Math.abs(putGEX),
          callGEX,
          putGEX,
          netGEX: callGEX + putGEX,
        };
      }
    }

    return {
      recentFlow: {
        totalAlerts: optionsData.length,
        callVolume,
        putVolume,
        callPremium,
        putPremium,
        putCallRatio: callVolume > 0 ? putVolume / callVolume : 0,
        unusualActivity: unusualActivity.length,
      },
      flowByExpiry,
      unusualActivity,
      greeks: greeksData,
      maxPain: maxPainData,
      oiChange: oiChangeData,
      optionsVolume: optionsVolumeData,
      spotGEX: spotGEXData,
    };
  }

  private extractInstitutionalActivity(
    ownership: PromiseSettledResult<any>,
    activity: PromiseSettledResult<any>
  ): InstitutionalInsights {
    try {
      // Extraire les données avec gestion d'erreur
      let ownershipData: any[] = [];
      let activityData: any[] = [];

      // Debug: Log le statut des promesses
      logger.info('Extracting institutional activity', {
        ownershipStatus: ownership.status,
        activityStatus: activity.status,
        ownershipValue: ownership.status === 'fulfilled' ? {
          success: ownership.value?.success,
          hasData: !!ownership.value?.data,
          dataType: Array.isArray(ownership.value?.data) ? 'array' : typeof ownership.value?.data,
          dataLength: Array.isArray(ownership.value?.data) ? ownership.value.data.length : 0,
        } : { reason: ownership.reason },
        activityValue: activity.status === 'fulfilled' ? {
          success: activity.value?.success,
          hasData: !!activity.value?.data,
          dataType: Array.isArray(activity.value?.data) ? 'array' : typeof activity.value?.data,
          dataLength: Array.isArray(activity.value?.data) ? activity.value.data.length : 0,
        } : { reason: activity.reason },
      });

      if (ownership.status === 'fulfilled' && ownership.value?.success) {
        ownershipData = Array.isArray(ownership.value.data) ? ownership.value.data : [];
        logger.info('Ownership data extracted', { count: ownershipData.length });
      } else if (ownership.status === 'rejected') {
        logger.warn('Failed to fetch ownership data', { error: ownership.reason });
      } else if (ownership.status === 'fulfilled' && !ownership.value?.success) {
        logger.warn('Ownership request failed', { value: ownership.value });
      }

      if (activity.status === 'fulfilled' && activity.value?.success) {
        activityData = Array.isArray(activity.value.data) ? activity.value.data : [];
        logger.info('Activity data extracted', { count: activityData.length });
      } else if (activity.status === 'rejected') {
        logger.warn('Failed to fetch activity data', { error: activity.reason });
      } else if (activity.status === 'fulfilled' && !activity.value?.success) {
        logger.warn('Activity request failed', { value: activity.value });
      }

      const topHolders = ownershipData.slice(0, 10).map((item: any) => ({
      name: item.name || item.institution_name || '',
      shares: item.shares || item.total_shares || 0,
      value: item.value || item.total_value || (item.shares || 0) * (item.price || 0),
      percentage: item.percentage || item.percent_of_portfolio || 0,
      isHedgeFund: item.is_hedge_fund || false,
      change: item.change || item.shares_change || 0,
    }));

      const buys = activityData.filter((a: any) => 
        a.transaction_type === 'BUY' || 
        a.transaction_type === 'P' || 
        (a.units_change && a.units_change > 0) ||
        (a.change && a.change > 0)
      );
      const sells = activityData.filter((a: any) => 
        a.transaction_type === 'SELL' || 
        a.transaction_type === 'S' || 
        (a.units_change && a.units_change < 0) ||
        (a.change && a.change < 0)
      );

      // Extraire les transactions récentes avec plus de détails
      const recentActivity = activityData.slice(0, 50).map((item: any) => {
      const unitsChange = item.units_change || item.change || item.shares_change || 0;
      const price = item.avg_price || item.close || item.price || item.avgPrice || 0;
      const shares = Math.abs(unitsChange);
      const value = shares * price;

        return {
          institutionName: item.institution_name || item.name || item.reporting_name || '',
          transactionType: (unitsChange >= 0 ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
          shares,
          value,
          date: item.filing_date || item.report_date || item.date || item.transaction_date || '',
          price,
          // Informations supplémentaires
          volume: item.volume || shares,
          cik: item.cik || item.reporting_cik || '',
        };
      });

      const hedgeFunds = ownershipData.filter((o: any) => o.is_hedge_fund);

      // Calculer les statistiques détaillées
      const totalBuyVolume = buys.reduce((sum: number, b: any) => 
        sum + Math.abs(b.units_change || b.change || b.shares_change || 0), 0
      );
      const totalSellVolume = sells.reduce((sum: number, s: any) => 
        sum + Math.abs(s.units_change || s.change || s.shares_change || 0), 0
      );
      const totalBuyValue = buys.reduce((sum: number, b: any) => {
        const shares = Math.abs(b.units_change || b.change || b.shares_change || 0);
        const price = b.avg_price || b.close || b.price || 0;
        return sum + (shares * price);
      }, 0);
      const totalSellValue = sells.reduce((sum: number, s: any) => {
        const shares = Math.abs(s.units_change || s.change || s.shares_change || 0);
        const price = s.avg_price || s.close || s.price || 0;
        return sum + (shares * price);
      }, 0);

      return {
        topHolders,
        recentActivity,
        stats: {
          totalInstitutions: ownershipData.length,
          totalHedgeFunds: hedgeFunds.length,
          totalShares: ownershipData.reduce((sum: number, o: any) => sum + (o.shares || o.total_shares || 0), 0),
          totalValue: ownershipData.reduce((sum: number, o: any) => sum + (o.value || o.total_value || 0), 0),
          netActivity: buys.length - sells.length,
          // Statistiques supplémentaires
          totalBuyVolume,
          totalSellVolume,
          totalBuyValue,
          totalSellValue,
          netVolume: totalBuyVolume - totalSellVolume,
          netValue: totalBuyValue - totalSellValue,
        },
      };
    } catch (error) {
      logger.error('Error extracting institutional activity', { error });
      // Retourner un objet vide plutôt que null
      return {
        topHolders: [],
        recentActivity: [],
        stats: {
          totalInstitutions: 0,
          totalHedgeFunds: 0,
          totalShares: 0,
          totalValue: 0,
          netActivity: 0,
          totalBuyVolume: 0,
          totalSellVolume: 0,
          totalBuyValue: 0,
          totalSellValue: 0,
          netVolume: 0,
          netValue: 0,
        },
      };
    }
  }

  private extractInsiderActivity(insiders: PromiseSettledResult<any>): InsiderInsights {
    const insidersData = insiders.status === 'fulfilled' ? insiders.value?.data || [] : [];

    const recentTransactions = insidersData.slice(0, 20).map((item: any) => ({
      ownerName: item.owner_name || '',
      title: item.officer_title || '',
      transactionType: item.transaction_code || item.acquisitionOrDisposition || '',
      shares: item.shares || 0,
      price: item.price || 0,
      value: (item.shares || 0) * (item.price || 0) || item.amount || 0,
      date: item.transaction_date || '',
    }));

    const buys = insidersData.filter((i: any) =>
      ['P', 'A'].includes(i.transaction_code?.toUpperCase() || '')
    );
    const sells = insidersData.filter((i: any) =>
      ['S', 'D'].includes(i.transaction_code?.toUpperCase() || '')
    );

    return {
      recentTransactions,
      stats: {
        totalTransactions: insidersData.length,
        buys: buys.length,
        sells: sells.length,
        netActivity: buys.length - sells.length,
        totalValue: recentTransactions.reduce((sum: number, t: any) => sum + t.value, 0),
      },
    };
  }

  private extractDarkPool(darkPool: PromiseSettledResult<any>): DarkPoolInsights {
    const darkPoolData = darkPool.status === 'fulfilled' ? darkPool.value?.data || [] : [];

    const recentTrades = darkPoolData.slice(0, 20).map((item: any) => ({
      date: item.date || item.executed_at || '',
      volume: item.volume || 0,
      price: item.price || 0,
      value: (item.volume || 0) * (item.price || 0),
    }));

    const totalVolume = darkPoolData.reduce((sum: number, item: any) => sum + (item.volume || 0), 0);
    const totalValue = darkPoolData.reduce(
      (sum: number, item: any) => sum + (item.volume || 0) * (item.price || 0),
      0
    );
    const largestTrade = Math.max(
      ...darkPoolData.map((item: any) => (item.volume || 0) * (item.price || 0)),
      0
    );

    return {
      recentTrades,
      stats: {
        totalTrades: darkPoolData.length,
        totalVolume,
        avgPrice: totalVolume > 0 ? totalValue / totalVolume : 0,
        largestTrade,
      },
    };
  }

  private extractEarnings(
    earnings: PromiseSettledResult<any>,
    earningsCalendar: PromiseSettledResult<any>,
    ticker: string
  ): EarningsInsights {
    const earningsData = earnings.status === 'fulfilled' ? earnings.value?.data || [] : [];
    const calendarData = earningsCalendar.status === 'fulfilled' ? earningsCalendar.value?.data || [] : [];

    const lastEarnings = Array.isArray(earningsData) ? earningsData[0] : null;
    const upcomingEarnings = Array.isArray(calendarData)
      ? calendarData.find((e: any) => e.symbol === ticker && new Date(e.date) >= new Date())
      : null;

    const history = (Array.isArray(earningsData) ? earningsData : []).slice(0, 8).map((e: any) => ({
      date: e.date || '',
      eps: e.eps || 0,
      revenue: e.revenue || 0,
      surprise: e.surprise,
    }));

    return {
      upcoming: upcomingEarnings
        ? {
            date: upcomingEarnings.date || '',
            estimatedEPS: upcomingEarnings.epsEstimated,
            estimatedRevenue: upcomingEarnings.revenueEstimated,
            time: upcomingEarnings.time === 'bmo' ? 'before_market' : 'after_market',
          }
        : undefined,
      last: lastEarnings
        ? {
            date: lastEarnings.date || '',
            eps: lastEarnings.eps || 0,
            estimatedEPS: lastEarnings.epsEstimated,
            revenue: lastEarnings.revenue || 0,
            estimatedRevenue: lastEarnings.revenueEstimated,
            surprise: lastEarnings.surprise,
            surprisePercent: lastEarnings.surprisePercentage,
          }
        : undefined,
      history,
    };
  }

  private extractNews(news: PromiseSettledResult<any>): NewsInsights {
    const newsData = news.status === 'fulfilled' ? news.value?.data || [] : [];
    const newsArray = Array.isArray(newsData) ? newsData : [];

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recent = newsArray.slice(0, 10).map((item: any) => ({
      title: item.title || '',
      publishedDate: item.publishedDate || item.date || '',
      url: item.url || '',
      source: item.site || item.source || '',
      summary: item.text || item.summary,
    }));

    const newsLast24h = newsArray.filter(
      (n: any) => new Date(n.publishedDate || n.date || 0) >= last24h
    ).length;
    const newsLast7d = newsArray.filter(
      (n: any) => new Date(n.publishedDate || n.date || 0) >= last7d
    ).length;

    return {
      recent,
      stats: {
        totalNews: newsArray.length,
        last24h: newsLast24h,
        last7d: newsLast7d,
      },
    };
  }

  private extractEconomicEvents(calendar: PromiseSettledResult<any>): EconomicEvent[] {
    if (calendar.status === 'fulfilled' && calendar.value?.data) {
      const events = Array.isArray(calendar.value.data) ? calendar.value.data : [];
      return events.slice(0, 10).map((event: any) => ({
        date: event.date || '',
        event: event.event || event.name || '',
        country: event.country || 'US',
        currency: event.currency || 'USD',
        impact: this.mapImpactLevel(event.impact),
        previous: event.previous,
        estimate: event.estimate,
        actual: event.actual,
      }));
    }
    return [];
  }

  private mapImpactLevel(impact?: string): 'low' | 'medium' | 'high' {
    if (!impact) return 'low';
    const lower = impact.toLowerCase();
    if (lower.includes('high') || lower === 'h') return 'high';
    if (lower.includes('medium') || lower === 'm') return 'medium';
    return 'low';
  }

  private extractShortInterest(shortInterest: PromiseSettledResult<any>): ShortInterestInfo {
    try {
      if (shortInterest.status === 'fulfilled' && shortInterest.value?.success && shortInterest.value?.data) {
        const data = Array.isArray(shortInterest.value.data)
          ? shortInterest.value.data[0]
          : shortInterest.value.data;
        
        // Vérifier que data existe et n'est pas null/undefined
        if (!data || typeof data !== 'object') {
          logger.warn('Short interest data is invalid', { data });
          return { lastUpdated: new Date().toISOString() };
        }

        // Mapper les champs selon le format Unusual Whales
        return {
          shortInterest: data.si_float_returned || data.short_interest || data.shortInterest || 0,
          shortRatio: data.short_ratio || data.shortRatio || 0,
          daysToCover: data.days_to_cover_returned 
            ? parseFloat(String(data.days_to_cover_returned)) 
            : (data.days_to_cover || data.daysToCover || 0),
          shortPercentOfFloat: data.percent_returned 
            ? parseFloat(String(data.percent_returned)) 
            : (data.short_percent_of_float || data.shortPercentOfFloat || 0),
          lastUpdated: data.market_date || data.created_at || data.date || data.lastUpdated || new Date().toISOString(),
        };
      } else if (shortInterest.status === 'rejected') {
        logger.warn('Failed to fetch short interest data', { error: shortInterest.reason });
      } else if (shortInterest.status === 'fulfilled' && !shortInterest.value?.success) {
        logger.warn('Short interest request failed', { value: shortInterest.value });
      }
    } catch (error) {
      logger.error('Error extracting short interest', { error });
    }
    return { lastUpdated: new Date().toISOString() };
  }

  private extractFinancialMetrics(
    keyMetrics: PromiseSettledResult<any>,
    ratios: PromiseSettledResult<any>
  ): FinancialMetrics {
    const metricsData = keyMetrics.status === 'fulfilled' ? keyMetrics.value?.data || [] : [];
    const ratiosData = ratios.status === 'fulfilled' ? ratios.value?.data || [] : [];

    const metrics = Array.isArray(metricsData) ? metricsData[0] : metricsData;
    const ratio = Array.isArray(ratiosData) ? ratiosData[0] : ratiosData;

    return {
      keyMetrics: metrics
        ? {
            peRatio: metrics.peRatio || metrics.priceEarningsRatio,
            priceToBook: metrics.priceToBookRatio,
            evToRevenue: metrics.enterpriseValueMultiple,
            evToEbitda: metrics.evToEbitda,
            debtToEquity: metrics.debtToEquity,
            currentRatio: metrics.currentRatio,
            returnOnEquity: metrics.roe || metrics.returnOnEquity,
            returnOnAssets: metrics.roa || metrics.returnOnAssets,
          }
        : undefined,
      ratios: ratio
        ? {
            currentRatio: ratio.currentRatio,
            quickRatio: ratio.quickRatio,
            debtToEquity: ratio.debtToEquityRatio,
            debtToAssets: ratio.debtRatio,
            interestCoverage: ratio.interestCoverage,
            grossProfitMargin: ratio.grossProfitMargin,
            operatingProfitMargin: ratio.operatingProfitMargin,
            netProfitMargin: ratio.netProfitMargin,
          }
        : undefined,
    };
  }

  private extractSECFilings(filings: PromiseSettledResult<any>): SECFiling[] {
    if (filings.status === 'fulfilled' && filings.value?.data) {
      const filingsArray = Array.isArray(filings.value.data) ? filings.value.data : [];
      
      // Filtrer et prioriser les filings importants (8-K, 13F, 10-K, 10-Q, 4)
      const importantFormTypes = ['8-K', '13F-HR', '13F-HR/A', '10-K', '10-Q', '4', 'DEF 14A'];
      
      // Séparer les filings importants des autres
      const importantFilings = filingsArray.filter((f: any) => {
        const formType = (f.formType || f.form || '').toUpperCase();
        return importantFormTypes.some(important => formType.includes(important));
      });
      
      const otherFilings = filingsArray.filter((f: any) => {
        const formType = (f.formType || f.form || '').toUpperCase();
        return !importantFormTypes.some(important => formType.includes(important));
      });
      
      // Combiner : d'abord les filings importants, puis les autres
      const sortedFilings = [...importantFilings, ...otherFilings].slice(0, 20);
      
      return sortedFilings.map((filing: any) => ({
        date: filing.filingDate || filing.date || '',
        formType: filing.formType || filing.form || '',
        title: `${filing.formType || filing.form || ''} - ${filing.symbol || ''}`,
        url: filing.link || filing.finalLink || filing.url || '',
        hasFinancials: filing.hasFinancials || false,
        // Informations supplémentaires
        cik: filing.cik || '',
        accessionNumber: filing.accessionNumber || filing.accession_number || '',
        description: filing.description || '',
      }));
    }
    return [];
  }

  private generateAlerts(
    options: PromiseSettledResult<any>,
    activity: PromiseSettledResult<any>,
    insiders: PromiseSettledResult<any>,
    earningsCalendar: PromiseSettledResult<any>,
    news: PromiseSettledResult<any>,
    ticker: string
  ): AlertSignal[] {
    const alerts: AlertSignal[] = [];

    // Alerte sur volume d'options inhabituel
    if (options.status === 'fulfilled' && options.value?.data) {
      const optionsData = options.value.data || [];
      if (optionsData.length > 50) {
        alerts.push({
          type: 'options_flow',
          severity: 'medium',
          message: `High options activity detected: ${optionsData.length} alerts`,
          timestamp: new Date().toISOString(),
          data: { count: optionsData.length },
        });
      }
    }

    // Alerte sur activité institutionnelle
    if (activity.status === 'fulfilled' && activity.value?.data) {
      const activityData = activity.value.data || [];
      const recentBuys = activityData.filter((a: any) => a.transaction_type === 'BUY').length;
      const recentSells = activityData.filter((a: any) => a.transaction_type === 'SELL').length;
      if (recentBuys > 10 || recentSells > 10) {
        alerts.push({
          type: 'institutional_activity',
          severity: recentBuys > recentSells ? 'high' : 'medium',
          message: `Significant institutional activity: ${recentBuys} buys, ${recentSells} sells`,
          timestamp: new Date().toISOString(),
          data: { buys: recentBuys, sells: recentSells },
        });
      }
    }

    // Alerte sur transactions d'insiders
    if (insiders.status === 'fulfilled' && insiders.value?.data) {
      const insidersData = insiders.value.data || [];
      if (insidersData.length > 5) {
        alerts.push({
          type: 'insider_trade',
          severity: 'medium',
          message: `${insidersData.length} recent insider transactions`,
          timestamp: new Date().toISOString(),
          data: { count: insidersData.length },
        });
      }
    }

    // Alerte sur prochains earnings
    if (earningsCalendar.status === 'fulfilled' && earningsCalendar.value?.data) {
      const calendarData = earningsCalendar.value.data || [];
      const upcoming = calendarData.find(
        (e: any) => e.symbol === ticker && new Date(e.date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );
      if (upcoming) {
        alerts.push({
          type: 'earnings_soon',
          severity: 'high',
          message: `Earnings scheduled for ${upcoming.date}`,
          timestamp: new Date().toISOString(),
          data: { date: upcoming.date },
        });
      }
    }

    // Alerte sur actualités récentes
    if (news.status === 'fulfilled' && news.value?.data) {
      const newsData = news.value.data || [];
      const recentNews = newsData.filter(
        (n: any) => new Date(n.publishedDate || n.date || 0) >= new Date(Date.now() - 24 * 60 * 60 * 1000)
      );
      if (recentNews.length > 5) {
        alerts.push({
          type: 'news_event',
          severity: 'medium',
          message: `${recentNews.length} news articles in last 24h`,
          timestamp: new Date().toISOString(),
          data: { count: recentNews.length },
        });
      }
    }

    return alerts;
  }
}

