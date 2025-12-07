/**
 * API publique pour les insights agrégés d'un ticker
 * Expose le service TickerInsightsService
 */

import { TickerInsightsService } from './services/ticker-insights.service';
import { logger } from './utils/logger';

const tickerInsightsService = new TickerInsightsService();

/**
 * Récupère toutes les informations agrégées pour un ticker
 * Combine les données de FMP et Unusual Whales pour donner une vue complète
 * 
 * @param ticker - Le symbole du ticker (ex: NVDA, TSLA)
 * @returns Toutes les informations pertinentes qui pourraient influencer le cours
 */
export async function getTickerInsights(ticker: string) {
  try {
    logger.info(`Getting ticker insights for ${ticker}`);
    return await tickerInsightsService.getTickerInsights(ticker);
  } catch (error) {
    logger.error(`Error getting ticker insights for ${ticker}`, { error });
    throw error;
  }
}

