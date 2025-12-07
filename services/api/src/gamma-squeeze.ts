/**
 * Interface publique pour le service de détection de Gamma Squeeze
 */

import { GammaSqueezeService } from './services/gamma-squeeze.service';
import type { GammaSqueezeResponse } from './types/gamma-squeeze';

const gammaSqueezeService = new GammaSqueezeService();

/**
 * Détecte le potentiel de gamma squeeze pour un ticker
 * @param ticker Symbole du ticker
 * @returns Analyse de gamma squeeze avec probabilité et recommandations
 */
export async function detectGammaSqueeze(ticker: string): Promise<GammaSqueezeResponse> {
  return await gammaSqueezeService.detectGammaSqueeze(ticker);
}

