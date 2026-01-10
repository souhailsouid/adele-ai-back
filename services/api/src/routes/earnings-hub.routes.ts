/**
 * Routes pour le service Earnings Hub
 */

import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { logger } from '../utils/logger';
import { EarningsHubService } from '../services/earnings-hub.service';
import type { EarningsHubRequest } from '../types/earnings-hub';

function getQueryParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.queryStringParameters?.[key];
}

const earningsHubService = new EarningsHubService();

export const earningsHubRoutes = [
  /**
   * POST /analyze/earnings-hub?ticker=CCL
   * Analyser le Earnings Hub pour un ticker
   * 
   * Query params:
   * - ticker (requis): Symbole du ticker à analyser
   * - quartersLimit (optionnel): Nombre de trimestres à analyser (défaut: 16 = 4 ans)
   * 
   * Body (optionnel):
   * {
   *   "quartersLimit": 16
   * }
   */
  {
    method: 'POST',
    path: '/analyze/earnings-hub',
    handler: async (event: APIGatewayProxyEventV2) => {
      const ticker = getQueryParam(event, 'ticker');
      if (!ticker) {
        throw new Error('Missing required parameter: ticker');
      }

      const quartersLimit = getQueryParam(event, 'quartersLimit')
        ? parseInt(getQueryParam(event, 'quartersLimit')!, 10)
        : undefined;

      // Si body fourni, il peut override les query params
      let body: Partial<EarningsHubRequest> = {};
      try {
        if (event.body) {
          body = JSON.parse(event.body);
        }
      } catch (e) {
        // Ignore parsing errors
      }

      const request: EarningsHubRequest = {
        ticker,
        quartersLimit: body.quartersLimit || quartersLimit,
      };

      logger.info('Analyzing earnings hub', { ticker, request });

      const result = await earningsHubService.analyzeEarningsHub(request);

      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    },
  },
];

