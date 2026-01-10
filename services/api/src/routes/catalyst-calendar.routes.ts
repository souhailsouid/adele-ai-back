/**
 * Routes pour le service Catalyst Calendar
 */

import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { logger } from '../utils/logger';
import { CatalystAggregatorService } from '../services/catalyst-aggregator.service';
import type { CatalystCalendarRequest } from '../types/catalyst-calendar';

function getQueryParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.queryStringParameters?.[key];
}

const catalystAggregatorService = new CatalystAggregatorService();

export const catalystCalendarRoutes = [
  /**
   * POST /analyze/catalyst-calendar
   * Récupérer le calendrier catalyst agrégé (Macro, FDA, Earnings, Whale Risk)
   * 
   * Query params:
   * - startDate (optionnel): Date de début (YYYY-MM-DD), défaut: aujourd'hui
   * - endDate (optionnel): Date de fin (YYYY-MM-DD), défaut: aujourd'hui + 30 jours
   * - watchlist (optionnel): Liste de tickers séparés par virgules (ex: "NVDA,AAPL,TSLA")
   * - limit (optionnel): Nombre maximum d'événements à retourner
   * 
   * Body (optionnel):
   * {
   *   "startDate": "2026-01-01",
   *   "endDate": "2026-01-31",
   *   "watchlist": ["NVDA", "AAPL", "TSLA"],
   *   "limit": 100
   * }
   */
  {
    method: 'POST',
    path: '/analyze/catalyst-calendar',
    handler: async (event: APIGatewayProxyEventV2) => {
      // Parser les query params
      const startDate = getQueryParam(event, 'startDate');
      const endDate = getQueryParam(event, 'endDate');
      const watchlistParam = getQueryParam(event, 'watchlist');
      const limitParam = getQueryParam(event, 'limit');
      const debugParam = getQueryParam(event, 'debug');

      // Parser le body si fourni
      let body: Partial<CatalystCalendarRequest> = {};
      try {
        if (event.body) {
          body = JSON.parse(event.body);
        }
      } catch (e) {
        // Ignore parsing errors
      }

      // Parser la watchlist (peut être dans query ou body)
      let watchlist: string[] = [];
      if (watchlistParam) {
        watchlist = watchlistParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
      } else if (body.watchlist) {
        watchlist = Array.isArray(body.watchlist) 
          ? body.watchlist.map(t => String(t).toUpperCase())
          : [];
      }

      // Parser la limite
      const limit = body.limit || (limitParam ? parseInt(limitParam, 10) : undefined);
      
      // Parser le mode debug
      const debug = body.debug !== undefined 
        ? Boolean(body.debug)
        : (debugParam === 'true' || debugParam === '1');

      const request: CatalystCalendarRequest = {
        startDate: body.startDate || startDate,
        endDate: body.endDate || endDate,
        watchlist: watchlist.length > 0 ? watchlist : undefined,
        limit: limit && !isNaN(limit) ? limit : undefined,
        debug,
      };

      logger.info('Aggregating catalyst calendar', { request });

      const result = await catalystAggregatorService.getCatalystCalendar(request);

      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    },
  },
];

