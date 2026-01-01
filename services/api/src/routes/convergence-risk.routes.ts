/**
 * Routes pour le service de Convergence et Risque de Liquidation
 */

import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { logger } from '../utils/logger';
import { ConvergenceRiskService } from '../services/convergence-risk.service';
import type { WhaleAnalysisRequest } from '../types/convergence-risk';

function getQueryParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.queryStringParameters?.[key];
}

const convergenceRiskService = new ConvergenceRiskService();

export const convergenceRiskRoutes = [
  /**
   * POST /analyze/convergence-risk?ticker=NVDA
   * Analyser la convergence et le risque de liquidation pour un ticker
   * 
   * Query params:
   * - ticker (requis): Symbole du ticker à analyser
   * - darkPoolLimit (optionnel): Nombre de transactions Dark Pool (défaut: 100)
   * - optionsLimit (optionnel): Nombre d'alertes d'options (défaut: 200)
   * - minPremium (optionnel): Prime minimum pour filtrer (défaut: 50000)
   * - expiryFilter (optionnel): Filtre d'expiration ("YYYY-MM-DD", "tomorrow", "next_week")
   * - liquidationThreshold (optionnel): Seuil de risque (défaut: 0.005 = 0.5%)
   * 
   * Body (optionnel):
   * {
   *   "darkPoolLimit": 100,
   *   "optionsLimit": 200,
   *   "minPremium": 50000,
   *   "expiryFilter": "2026-01-16",
   *   "liquidationThreshold": 0.005
   * }
   */
  {
    method: 'POST',
    path: '/analyze/convergence-risk',
    handler: async (event: APIGatewayProxyEventV2) => {
      const ticker = getQueryParam(event, 'ticker');
      if (!ticker) {
        throw new Error('Missing required parameter: ticker');
      }

      // Parser les paramètres depuis query string ou body
      const darkPoolLimit = getQueryParam(event, 'darkPoolLimit')
        ? parseInt(getQueryParam(event, 'darkPoolLimit')!, 10)
        : undefined;
      const optionsLimit = getQueryParam(event, 'optionsLimit')
        ? parseInt(getQueryParam(event, 'optionsLimit')!, 10)
        : undefined;
      const minPremium = getQueryParam(event, 'minPremium')
        ? parseFloat(getQueryParam(event, 'minPremium')!)
        : undefined;
      const expiryFilter = getQueryParam(event, 'expiryFilter') || undefined;
      const liquidationThreshold = getQueryParam(event, 'liquidationThreshold')
        ? parseFloat(getQueryParam(event, 'liquidationThreshold')!)
        : undefined;

      // Si body fourni, il peut override les query params
      let body: Partial<WhaleAnalysisRequest> = {};
      try {
        if (event.body) {
          body = JSON.parse(event.body);
        }
      } catch (e) {
        // Ignore parsing errors, utilise query params uniquement
      }

      const request: WhaleAnalysisRequest = {
        ticker,
        darkPoolLimit: body.darkPoolLimit || darkPoolLimit,
        optionsLimit: body.optionsLimit || optionsLimit,
        minPremium: body.minPremium || minPremium,
        expiryFilter: body.expiryFilter || expiryFilter,
        liquidationThreshold: body.liquidationThreshold || liquidationThreshold,
      };

      logger.info('Analyzing convergence risk', { ticker, request });

      const result = await convergenceRiskService.analyzeWhaleConvergence(request);

      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    },
  },
];

