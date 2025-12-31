/**
 * Routes pour les signaux de marché (Market Signals)
 * Détection d'alertes basée sur FMP (≥2 signaux concordants)
 */

import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { MarketSignalsService } from '../services/market-signals.service';

// Helper functions (comme dans fmp.routes.ts)
function getPathParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.pathParameters?.[key];
}

function getQueryParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.queryStringParameters?.[key];
}

const marketSignalsService = new MarketSignalsService();

export const marketSignalsRoutes = [
  {
    method: 'GET',
    path: '/market-signals/{ticker}',
    handler: async (event) => {
      const ticker = getPathParam(event, 'ticker');
      if (!ticker) {
        throw new Error('Missing ticker parameter');
      }

      // currentPrice est optionnel - sera récupéré depuis FMP si non fourni
      const currentPriceParam = getQueryParam(event, 'currentPrice');
      let currentPrice: number | undefined;

      if (currentPriceParam) {
        currentPrice = parseFloat(currentPriceParam);
        if (isNaN(currentPrice) || currentPrice <= 0) {
          throw new Error('Invalid currentPrice parameter (must be a positive number)');
        }
      }

      // includeCompany : optionnel, par défaut false (pour performance)
      const includeCompanyParam = getQueryParam(event, 'includeCompany');
      const includeCompany = includeCompanyParam === 'true' || includeCompanyParam === '1';

      // Version enrichie si demandée
      if (includeCompany) {
        const enriched = await marketSignalsService.detectSignalsEnriched(
          ticker.toUpperCase(),
          currentPrice,
          true
        );

        if (!enriched) {
          return {
            ticker,
            hasAlert: false,
            message: 'No alert detected (insufficient signals)',
            company: null,
          };
        }

        const alert = enriched.signals.length >= 2
          ? marketSignalsService.createAlert(enriched)
          : null;

        return {
          ticker,
          hasAlert: alert !== null,
          alert,
          company: enriched.company,
        };
      }

      // Version simple (signaux uniquement)
      const signal = await marketSignalsService.detectSignals(ticker.toUpperCase(), currentPrice);
      
      if (!signal) {
        return {
          ticker,
          hasAlert: false,
          message: 'No alert detected (insufficient signals)',
        };
      }

      const alert = marketSignalsService.createAlert(signal);
      return {
        ticker,
        hasAlert: true,
        alert,
      };
    },
  },
];

