import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { logger } from '../utils/logger';
import { UpcomingEarningsService } from '../services/upcoming-earnings.service';
import type { UpcomingEarningsRequest } from '../services/upcoming-earnings.service';

function getQueryParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.queryStringParameters?.[key];
}

function parseBody(event: APIGatewayProxyEventV2): any {
  if (event.body) {
    try {
      return JSON.parse(event.body);
    } catch (e) {
      logger.warn('Failed to parse body', { error: e });
      return {};
    }
  }
  return {};
}

const upcomingEarningsService = new UpcomingEarningsService();

export const upcomingEarningsRoutes = [
  {
    method: 'GET',
    path: '/earnings/upcoming/{ticker}',
    handler: async (event: APIGatewayProxyEventV2) => {
      const ticker = event.pathParameters?.ticker;
      if (!ticker) {
        throw new Error('Missing required parameter: ticker');
      }

      const daysAheadParam = getQueryParam(event, 'daysAhead');
      const limitParam = getQueryParam(event, 'limit');

      const body = parseBody(event);

      const request: UpcomingEarningsRequest = {
        ticker,
        daysAhead: body.daysAhead || (daysAheadParam ? parseInt(daysAheadParam, 10) : undefined),
        limit: body.limit || (limitParam ? parseInt(limitParam, 10) : undefined),
      };

      logger.info('Fetching upcoming earnings', { ticker, request });

      const result = await upcomingEarningsService.getUpcomingEarnings(request);

      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    },
  },
];

