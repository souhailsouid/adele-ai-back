/**
 * Interface publique pour le service de scoring
 */

import { ScoringService } from './services/scoring.service';
import type { TickerScoreResponse } from './types/scoring';

const scoringService = new ScoringService();

/**
 * Calcule un score composite (0-100) pour un ticker
 * @param ticker Symbole du ticker
 * @returns Score composite avec breakdown détaillé
 */
export async function calculateTickerScore(ticker: string): Promise<TickerScoreResponse> {
  return await scoringService.calculateTickerScore(ticker);
}

