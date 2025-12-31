/**
 * Worker : Collector FMP Signals
 * Collecte les signaux de marché FMP pour les tickers surveillés
 * Déclenche des alertes quand ≥2 signaux concordants sont détectés
 */

import { EventBridgeEvent } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const FMP_API_KEY = process.env.FMP_API_KEY!;
const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';

interface MarketSignal {
  ticker: string;
  type: 'bullish' | 'bearish' | 'neutral';
  signals: string[];
  details: Record<string, any>;
  timestamp: string;
}

/**
 * Appel direct à l'API FMP
 */
async function callFMP(endpoint: string, params: Record<string, string> = {}): Promise<any> {
  const queryString = new URLSearchParams({ ...params, apikey: FMP_API_KEY }).toString();
  const url = `${FMP_BASE_URL}${endpoint}?${queryString}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`FMP API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Récupère le prix actuel d'un ticker via FMP
 */
async function getCurrentPrice(ticker: string): Promise<number> {
  try {
    const data = await callFMP('/quote', { symbol: ticker });
    return data[0]?.price || 0;
  } catch (error) {
    console.error(`Error getting current price for ${ticker}:`, error);
    return 0;
  }
}

/**
 * Détecte les signaux de marché pour un ticker donné
 */
async function detectSignals(ticker: string, currentPrice: number): Promise<MarketSignal | null> {
  try {
    const [grades, consensus, priceTarget, latestInsiders] = await Promise.all([
      callFMP('/grades', { symbol: ticker }),
      callFMP('/grades-consensus', { symbol: ticker }),
      callFMP('/price-target-consensus', { symbol: ticker }),
      callFMP('/insider-trading/latest', { limit: '50' }),
    ]);

    const detected: string[] = [];
    let isBullish = false;
    let isBearish = false;

    // 1. Grades récents
    const latestGrade = grades?.[0];
    if (latestGrade?.action === 'upgrade') {
      detected.push('Upgrade analyste récent');
      isBullish = true;
    } else if (latestGrade?.action === 'downgrade') {
      detected.push('Downgrade analyste récent');
      isBearish = true;
    }

    // 2. Consensus
    const cons = consensus?.[0];
    if (cons?.consensus === 'Buy' || cons?.consensus === 'Strong Buy') {
      detected.push('Consensus Buy / Strong Buy');
      isBullish = true;
    } else if (cons?.consensus === 'Sell' || cons?.consensus === 'Strong Sell') {
      detected.push('Consensus Sell');
      isBearish = true;
    }

    // 3. Price Target
    const target = priceTarget?.[0];
    if (target?.targetConsensus) {
      const upside = ((target.targetConsensus - currentPrice) / currentPrice) * 100;
      if (upside > 12) {
        detected.push(`Upside potentiel >${upside.toFixed(0)}%`);
        isBullish = true;
      } else if (upside < -12) {
        detected.push(`Downside potentiel >${Math.abs(upside).toFixed(0)}%`);
        isBearish = true;
      }
    }

    // 4. Insider Trading
    const tickerInsiders = latestInsiders?.filter((i: any) => i.symbol === ticker) || [];
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

    return null;
  } catch (error) {
    console.error(`Error detecting signals for ${ticker}:`, error);
    throw error;
  }
}

/**
 * Récupère les tickers surveillés depuis Supabase
 */
async function getWatchedTickers(): Promise<Array<{ ticker: string }>> {
  try {
    const { data, error } = await supabase
      .from('watched_tickers')
      .select('ticker')
      .eq('active', true);

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (data && data.length > 0) {
      return data;
    }

    // Fallback - liste par défaut
    console.log('No watched_tickers table found, using default list');
    return [
      { ticker: 'AAPL' },
      { ticker: 'TSLA' },
      { ticker: 'NVDA' },
      { ticker: 'MSFT' },
      { ticker: 'GOOGL' },
    ];
  } catch (error) {
    console.error('Error getting watched tickers:', error);
    return [
      { ticker: 'AAPL' },
      { ticker: 'TSLA' },
      { ticker: 'NVDA' },
    ];
  }
}

/**
 * Crée une alerte dans Supabase
 */
async function createAlert(signal: MarketSignal): Promise<void> {
  try {
    const severity = signal.signals.length >= 3 ? 'high' : 'medium';
    const message = `${signal.type.toUpperCase()} : ${signal.signals.join(' + ')}`;

    const { error } = await supabase.from('fmp_signals').insert({
      ticker: signal.ticker,
      type: signal.type,
      severity,
      signals: signal.signals,
      message,
      details: signal.details,
      created_at: signal.timestamp,
      timestamp: signal.timestamp, // Alias pour compatibilité frontend
    });

    if (error) {
      throw error;
    }

    console.log(`✅ Alert created for ${signal.ticker}: ${signal.type} (${severity})`);
  } catch (error) {
    console.error(`Error creating alert for ${signal.ticker}:`, error);
    throw error;
  }
}

export const handler = async (event: EventBridgeEvent<'Scheduled Event', any>) => {
  console.log('FMP Signals Collector triggered');

  if (!FMP_API_KEY) {
    throw new Error('FMP_API_KEY environment variable is required');
  }

  try {
    const watchedTickers = await getWatchedTickers();

    if (watchedTickers.length === 0) {
      console.log('No watched tickers found');
      return;
    }

    console.log(`Processing ${watchedTickers.length} tickers`);

    for (const { ticker } of watchedTickers) {
      try {
        const currentPrice = await getCurrentPrice(ticker);
        
        if (currentPrice === 0) {
          console.warn(`⚠️  Could not get price for ${ticker}, skipping`);
          continue;
        }

        const signal = await detectSignals(ticker, currentPrice);

        if (signal) {
          await createAlert(signal);
        } else {
          console.log(`No alert for ${ticker} (insufficient signals)`);
        }
      } catch (error) {
        console.error(`Error processing ticker ${ticker}:`, error);
      }
    }

    console.log('FMP Signals Collector completed');
  } catch (error) {
    console.error('Error in FMP Signals Collector:', error);
    throw error;
  }
};
