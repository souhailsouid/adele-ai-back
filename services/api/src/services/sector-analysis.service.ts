/**
 * Service d'analyse de secteur
 * Combine FMP fundamentals + UW sentiment par secteur
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import * as fmp from '../fmp';
import * as uw from '../unusual-whales';
import type {
  SectorAnalysis,
  SectorAnalysisResponse,
  SectorSentiment,
  ETFFlow,
  SectorTicker,
  SectorRecommendation,
} from '../types/combined-analysis';

export class SectorAnalysisService {
  /**
   * Analyse un secteur : combine FMP fundamentals + UW sentiment
   */
  async analyzeSector(sector: string): Promise<SectorAnalysisResponse> {
    return handleError(async () => {
      const log = logger.child({ sector, operation: 'analyzeSector' });
      log.info('Analyzing sector');

      // Récupération des données UW
      const [sectorTide, sectorTickers] = await Promise.allSettled([
        uw.getUWSectorTide(sector, {}),
        uw.getUWSectorTickers(sector),
      ]);

      log.info('UW sector data fetched', {
        sectorTide: sectorTide.status,
        sectorTickers: sectorTickers.status,
      });

      // Extraire les tickers du secteur
      const tickers: string[] = [];
      if (sectorTickers.status === 'fulfilled' && sectorTickers.value?.success && sectorTickers.value.data) {
        const t = Array.isArray(sectorTickers.value.data) ? sectorTickers.value.data : [];
        // Les tickers sont directement dans un tableau de strings
        tickers.push(...t.slice(0, 20).map((ticker: string) => ticker));
        log.info('Sector tickers extracted', { count: tickers.length });
      } else {
        log.warn('Sector tickers data not available', {
          status: sectorTickers.status,
          hasValue: sectorTickers.status === 'fulfilled' && !!sectorTickers.value,
          hasSuccess: sectorTickers.status === 'fulfilled' && sectorTickers.value?.success,
          hasData: sectorTickers.status === 'fulfilled' && sectorTickers.value?.success && !!sectorTickers.value.data,
        });
      }

      // Récupérer les fundamentals pour chaque ticker
      const fundamentals = await Promise.allSettled(
        tickers.map(ticker => 
          Promise.allSettled([
            fmp.getFMPFinancialRatios({ symbol: ticker, limit: 1 }),
            fmp.getFMPIncomeStatement({ symbol: ticker, limit: 2 }),
            fmp.getFMPStockQuote(ticker),
          ])
        )
      );

      // Calculer les moyennes et stocker les données par ticker
      const peRatios: number[] = [];
      const revenueGrowths: number[] = [];
      const tickerData: Map<string, { pe?: number; price?: number; growth?: number }> = new Map();

      for (let i = 0; i < fundamentals.length && i < tickers.length; i++) {
        const ticker = tickers[i];
        const result = fundamentals[i];
        
        if (result.status === 'fulfilled') {
          const [ratios, income, quote] = result.value;
          const tickerInfo: { pe?: number; price?: number; growth?: number } = {};
          
          if (ratios.status === 'fulfilled' && ratios.value?.success && ratios.value.data?.length > 0) {
            const pe = ratios.value.data[0].priceEarningsRatio;
            if (pe && pe > 0) {
              peRatios.push(pe);
              tickerInfo.pe = pe;
            }
          }

          if (income.status === 'fulfilled' && income.value?.success && income.value.data?.length >= 2) {
            const current = income.value.data[0];
            const previous = income.value.data[1];
            if (current.revenue && previous.revenue) {
              const growth = ((current.revenue - previous.revenue) / previous.revenue) * 100;
              revenueGrowths.push(growth);
              tickerInfo.growth = growth;
            }
          }

          // Extraire le prix depuis la quote
          if (quote.status === 'fulfilled' && quote.value?.success && quote.value.data) {
            const quoteData = Array.isArray(quote.value.data) ? quote.value.data[0] : quote.value.data;
            const price = quoteData?.price || quoteData?.close || quoteData?.lastPrice || quoteData?.currentPrice || 0;
            if (price > 0) {
              tickerInfo.price = price;
            }
          }

          if (Object.keys(tickerInfo).length > 0) {
            tickerData.set(ticker, tickerInfo);
          }
        }
      }

      const averagePE = peRatios.length > 0
        ? peRatios.reduce((sum, pe) => sum + pe, 0) / peRatios.length
        : 0;
      const averageGrowth = revenueGrowths.length > 0
        ? revenueGrowths.reduce((sum, g) => sum + g, 0) / revenueGrowths.length
        : 0;

      // Analyser le sentiment
      const sentiment: SectorSentiment = {
        score: 50,
        tide: 'neutral',
        optionsFlow: 0,
        institutionalActivity: 0,
      };

      if (sectorTide.status === 'fulfilled' && sectorTide.value?.success && sectorTide.value.data) {
        const tide = sectorTide.value.data;
        sentiment.tide = tide.tide || 'neutral';
        sentiment.score = tide.score || 50;
        sentiment.optionsFlow = tide.options_flow || 0;
        sentiment.institutionalActivity = tide.institutional_activity || 0;
      }

      // ETF Flows (simplifié - en réalité il faudrait récupérer les ETFs du secteur)
      const etfFlows: ETFFlow[] = [];

      // Top performers - utiliser les données réelles extraites
      const topPerformers: SectorTicker[] = Array.from(tickerData.entries())
        .map(([ticker, data]) => ({
          ticker,
          name: ticker,
          price: data.price || 0,
          change: 0, // Non disponible sans données historiques
          changePercent: data.growth || 0,
        }))
        .filter(p => p.price > 0 || p.changePercent !== 0) // Filtrer les entrées vides
        .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0)) // Trier par croissance
        .slice(0, 10);
      
      // Si pas assez de données, ajouter les tickers restants
      if (topPerformers.length < 10) {
        const remainingTickers = tickers
          .filter(t => !tickerData.has(t))
          .slice(0, 10 - topPerformers.length)
          .map(ticker => ({
            ticker,
            name: ticker,
            price: 0,
            change: 0,
            changePercent: 0,
          }));
        topPerformers.push(...remainingTickers);
      }

      // Recommandations
      const recommendations: SectorRecommendation[] = [];
      if (sentiment.score > 70 && averageGrowth > 5) {
        recommendations.push({
          type: 'overweight',
          reasoning: `Secteur ${sector} : Sentiment positif et croissance solide`,
          topPicks: topPerformers.slice(0, 3).map(p => p.ticker),
        });
      } else if (sentiment.score < 30 || averageGrowth < 0) {
        recommendations.push({
          type: 'underweight',
          reasoning: `Secteur ${sector} : Sentiment négatif ou croissance faible`,
          topPicks: [],
        });
      } else {
        recommendations.push({
          type: 'neutral',
          reasoning: `Secteur ${sector} : Sentiment et croissance neutres`,
          topPicks: topPerformers.slice(0, 2).map(p => p.ticker),
        });
      }

      const analysis: SectorAnalysis = {
        sector,
        averagePE: Math.round(averagePE * 10) / 10,
        averageGrowth: Math.round(averageGrowth * 10) / 10,
        sentiment,
        etfFlows,
        topPerformers,
        recommendations,
      };

      return {
        success: true,
        data: analysis,
        cached: false,
        timestamp: new Date().toISOString(),
      };
    }, `Analyze sector ${sector}`);
  }
}

