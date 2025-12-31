/**
 * Service de détection de signaux de marché (FMP)
 * Règles simples sans scoring - détection d'alertes basée sur ≥2 signaux concordants
 */

import { FMPService } from './fmp.service';
import { logger } from '../utils/logger';

export interface MarketSignal {
  ticker: string;
  type: 'bullish' | 'bearish' | 'neutral';
  signals: string[]; // ex: ["upgrade récent", "cluster insider buys"]
  details: Record<string, any>;
  timestamp: string;
}

export interface MarketSignalEnriched extends MarketSignal {
  company?: {
    profile?: any;
    quote?: any;
    keyMetrics?: any;
    earnings?: any;
    recommendations?: any;
  };
}

export interface MarketAlert {
  id?: string;
  ticker: string;
  type: 'bullish' | 'bearish';
  severity: 'low' | 'medium' | 'high';
  signals: string[];
  message: string;
  timestamp: string;
  source: 'fmp' | 'rss' | 'combined';
  details?: Record<string, any>;
}

export class MarketSignalsService {
  private fmpService: FMPService;

  constructor() {
    this.fmpService = new FMPService();
  }

  /**
   * Détecte les signaux de marché pour un ticker donné
   * Retourne null si < 2 signaux concordants (pas d'alerte)
   * 
   * @param ticker - Ticker symbol (ex: AAPL)
   * @param currentPrice - Prix actuel (optionnel, sera récupéré depuis FMP si non fourni)
   */
  async detectSignals(ticker: string, currentPrice?: number): Promise<MarketSignal | null> {
    try {
      const [grades, consensus, priceTarget, latestInsiders] = await Promise.all([
        this.fmpService.getStockGrades(ticker),
        this.fmpService.getStockGradesSummary(ticker),
        this.fmpService.getPriceTargetConsensus(ticker),
        this.fmpService.getLatestInsiderTrading({ limit: 50 }),
      ]);

      const detected: string[] = [];
      let isBullish = false;
      let isBearish = false;

      // 1. Grades récents
      const latestGrade = grades.data?.[0];
      if (latestGrade?.action === 'upgrade') {
        detected.push('Upgrade analyste récent');
        isBullish = true;
      } else if (latestGrade?.action === 'downgrade') {
        detected.push('Downgrade analyste récent');
        isBearish = true;
      }

      // 2. Consensus
      const cons = consensus.data?.[0];
      if (cons?.consensus === 'Buy' || cons?.consensus === 'Strong Buy') {
        detected.push('Consensus Buy / Strong Buy');
        isBullish = true;
      } else if (cons?.consensus === 'Sell' || cons?.consensus === 'Strong Sell') {
        detected.push('Consensus Sell');
        isBearish = true;
      }

      // 3. Price Target (nécessite le prix actuel)
      let actualPrice = currentPrice;
      
      // Si le prix n'est pas fourni, le récupérer depuis FMP
      if (!actualPrice) {
        try {
          const quote = await this.fmpService.getQuote(ticker);
          actualPrice = quote.data?.price || 0;
        } catch (error) {
          logger.warn(`Could not fetch current price for ${ticker}, skipping price target analysis`);
        }
      }

      const target = priceTarget.data?.[0];
      if (target?.targetConsensus && actualPrice && actualPrice > 0) {
        const upside = ((target.targetConsensus - actualPrice) / actualPrice) * 100;
        if (upside > 12) {
          detected.push(`Upside potentiel >${upside.toFixed(0)}%`);
          isBullish = true;
        } else if (upside < -12) {
          detected.push(`Downside potentiel >${Math.abs(upside).toFixed(0)}%`);
          isBearish = true;
        }
      }

      // 4. Insider Trading (focus achats)
      const tickerInsiders = latestInsiders.data?.filter((i: any) => i.symbol === ticker) || [];
      const recentBuys = tickerInsiders.filter((i: any) => i.acquisitionOrDisposition === 'A').length;
      const recentSells = tickerInsiders.filter((i: any) => i.acquisitionOrDisposition === 'D').length;

      if (recentBuys >= 3 && recentBuys > recentSells) {
        detected.push(`Cluster insider buys (${recentBuys})`);
        isBullish = true;
      } else if (recentSells >= 8 && recentSells > recentBuys * 2) {
        detected.push(`Ventes insiders nettes importantes (${recentSells})`);
        isBearish = true;
      }

      // Décision finale : alerte seulement si ≥ 2 signaux concordants
      if ((isBullish && detected.length >= 2) || (isBearish && detected.length >= 2)) {
        return {
          ticker,
          type: isBullish ? 'bullish' : 'bearish',
          signals: detected,
          details: {
            grades: latestGrade,
            consensus: cons,
            priceTarget: target,
            insidersCount: { buys: recentBuys, sells: recentSells },
          },
          timestamp: new Date().toISOString(),
        };
      }

      return null; // Pas d'alerte
    } catch (error) {
      logger.error(`Error detecting signals for ${ticker}:`, error);
      throw error;
    }
  }

  /**
   * Version enrichie : Détecte les signaux + récupère les infos company
   * Combine : grades, consensus, price target, insider trading + profile, quote, key metrics, earnings
   */
  async detectSignalsEnriched(
    ticker: string,
    currentPrice?: number,
    includeCompany: boolean = true
  ): Promise<MarketSignalEnriched | null> {
    // 1. Détecter les signaux de base (grades, consensus, price target, insider trading)
    const signal = await this.detectSignals(ticker, currentPrice);
    
    if (!signal && !includeCompany) {
      return null;
    }

    // 2. Enrichir avec les infos company (si demandé)
    const companyData: any = {};
    
    if (includeCompany) {
      try {
        // Récupérer les infos company en parallèle
        const [profile, quote, keyMetrics, earnings] = await Promise.all([
          this.fmpService.getSECCompanyFullProfile({ symbol: ticker }).catch(() => null),
          this.fmpService.getQuote(ticker).catch(() => null),
          this.fmpService.getKeyMetrics({ symbol: ticker, limit: 1 }).catch(() => null),
          this.fmpService.getEarningsReport(ticker).catch(() => null),
        ]);

        if (profile?.data?.[0]) companyData.profile = profile.data[0];
        if (quote?.data?.[0]) companyData.quote = quote.data[0];
        if (keyMetrics?.data?.[0]) companyData.keyMetrics = keyMetrics.data[0];
        if (earnings?.data?.[0]) companyData.earnings = earnings.data[0];
      } catch (error) {
        logger.warn(`Error enriching company data for ${ticker}:`, error);
      }
    }

    return {
      ...(signal || {
        ticker,
        type: 'neutral' as const,
        signals: [],
        details: {},
        timestamp: new Date().toISOString(),
      }),
      company: Object.keys(companyData).length > 0 ? companyData : undefined,
    };
  }

  /**
   * Crée une alerte à partir d'un signal détecté
   */
  createAlert(signal: MarketSignal): MarketAlert {
    return {
      ticker: signal.ticker,
      type: signal.type,
      severity: signal.signals.length >= 3 ? 'high' : 'medium',
      signals: signal.signals,
      message: `${signal.type.toUpperCase()} : ${signal.signals.join(' + ')}`,
      timestamp: signal.timestamp,
      source: 'fmp',
      details: signal.details,
    };
  }
}

