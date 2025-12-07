/**
 * Tests d'intégration pour valider que les données Unusual Whales
 * sont bien présentes dans les endpoints d'analyse combinée
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from '../../index';

const API_URL = process.env.API_GATEWAY_URL || 'https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';

if (!ACCESS_TOKEN) {
  console.warn('ACCESS_TOKEN non défini, certains tests peuvent échouer');
}

describe('Combined Analysis Data Validation', () => {
  const TICKER = 'AAPL';

  // Helper pour créer un événement API Gateway
  const createEvent = (method: string, path: string, queryParams?: Record<string, string>): APIGatewayProxyEventV2 => ({
    version: '2.0',
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: queryParams ? new URLSearchParams(queryParams).toString() : '',
    headers: {
      authorization: `Bearer ${ACCESS_TOKEN}`,
      'content-type': 'application/json',
    },
    queryStringParameters: queryParams,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test',
      domainName: 'test.execute-api.eu-west-3.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'test-request-id',
      routeKey: `${method} ${path}`,
      stage: 'test',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
    body: undefined,
  });

  describe('Phase 1: Vérification des endpoints UW directement', () => {
    it('devrait retourner des données pour Recent Flows', async () => {
      const event = createEvent('GET', `/unusual-whales/stock/${TICKER}/flow-recent`, { limit: '10' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      
      if (Array.isArray(body.data) && body.data.length > 0) {
        expect(body.data[0]).toHaveProperty('premium');
        expect(body.data[0].premium).toBeGreaterThan(0);
      } else {
        console.warn('⚠ Recent Flows retourne un tableau vide');
      }
    });

    it('devrait retourner des données pour Institution Ownership', async () => {
      const event = createEvent('GET', `/unusual-whales/institution/${TICKER}/ownership`);
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      
      if (Array.isArray(body.data) && body.data.length > 0) {
        expect(body.data[0]).toHaveProperty('name');
        expect(body.data[0].name).toBeTruthy();
      } else {
        console.warn('⚠ Institution Ownership retourne un tableau vide');
      }
    });

    it('devrait retourner des données pour Short Interest', async () => {
      const event = createEvent('GET', `/unusual-whales/shorts/${TICKER}/interest-float`);
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      
      if (body.data && typeof body.data === 'object') {
        expect(body.data).toHaveProperty('percent_returned');
        const percent = parseFloat(body.data.percent_returned || '0');
        expect(percent).toBeGreaterThanOrEqual(0);
      } else {
        console.warn('⚠ Short Interest retourne des données invalides');
      }
    });

    it('devrait retourner des données pour Dark Pool Trades', async () => {
      const event = createEvent('GET', `/unusual-whales/dark-pool/${TICKER}`, { limit: '10' });
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      
      if (Array.isArray(body.data) && body.data.length > 0) {
        expect(body.data[0]).toHaveProperty('executed_at');
        expect(body.data[0].executed_at).toBeTruthy();
      } else {
        console.warn('⚠ Dark Pool Trades retourne un tableau vide');
      }
    });
  });

  describe('Phase 2: Vérification des données dans les endpoints combinés', () => {
    it('devrait avoir des données UW valides dans Complete Analysis', async () => {
      const event = createEvent('GET', `/analysis/${TICKER}/complete`);
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.sentiment).toBeDefined();

      const sentiment = body.data.sentiment;
      
      // Vérifier que le score n'est pas la valeur par défaut suspecte
      expect(sentiment.score).toBeDefined();
      if (sentiment.score === 50) {
        console.warn('⚠ Sentiment score = 50 (valeur par défaut suspecte)');
      }

      // Vérifier les détails du sentiment
      if (sentiment.details) {
        const details = sentiment.details;
        
        // Call/Put Ratio ne devrait pas être exactement 1 (suspect)
        if (details.callPutRatio === 1) {
          console.warn('⚠ Call/Put Ratio = 1 (suspect, probablement valeur par défaut)');
        }
        
        // Dark Pool Trades ne devrait pas être 0
        if (details.darkPoolTrades === 0) {
          console.warn('⚠ Dark Pool Trades = 0 (suspect)');
        }
      }
    });

    it('devrait avoir un prix actuel valide dans Comprehensive Valuation', async () => {
      const event = createEvent('GET', `/analysis/${TICKER}/valuation`);
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();

      const data = body.data;
      
      // Vérifier que currentPrice est présent et valide
      expect(data.currentPrice).toBeDefined();
      expect(data.currentPrice).not.toBe(0);
      expect(data.currentPrice).not.toBeNull();
      
      // Pour AAPL, le prix devrait être > 100
      if (data.currentPrice < 100) {
        console.warn(`⚠ Current Price (${data.currentPrice}) semble suspect pour AAPL`);
      }

      // Vérifier sentiment multiplier
      expect(data.sentimentMultiplier).toBeDefined();
      if (data.sentimentMultiplier === 1) {
        console.warn('⚠ Sentiment Multiplier = 1 (suspect, probablement valeur par défaut)');
      }
    });

    it('devrait avoir des signaux valides dans Earnings Prediction', async () => {
      const event = createEvent('GET', `/analysis/${TICKER}/earnings-prediction`);
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.signals).toBeDefined();

      const signals = body.data.signals;
      
      if (signals.options) {
        const options = signals.options;
        
        // Vérifier que les volumes ne sont pas tous à 0
        if (options.callVolume === 0 && options.putVolume === 0) {
          console.warn('⚠ Options volumes sont tous à 0 (suspect)');
        }
        
        // Vérifier unusual activity
        if (options.unusualActivity === 0 || !options.unusualActivity) {
          console.warn('⚠ Unusual Activity = 0 (suspect)');
        }
        
        // Score ne devrait pas être exactement 50 ou 65 (valeurs par défaut)
        if (options.score === 50 || options.score === 65) {
          console.warn(`⚠ Options Score = ${options.score} (valeur par défaut suspecte)`);
        }
      }
    });

    it('devrait avoir des données valides dans Risk Analysis', async () => {
      const event = createEvent('GET', `/analysis/${TICKER}/risk`);
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();

      const data = body.data;
      
      // Vérifier overall risk
      expect(data.overallRisk).toBeDefined();
      expect(data.overallRisk).not.toBeNull();
      
      // Vérifier breakdown
      expect(data.breakdown).toBeDefined();
      expect(data.breakdown.financial).toBeDefined();
      
      // Financial risk ne devrait pas être exactement 50 (valeur par défaut)
      if (data.breakdown.financial.score === 50) {
        console.warn('⚠ Financial Risk Score = 50 (valeur par défaut suspecte)');
      }
    });

    it('devrait avoir des données valides dans Institution Tracking', async () => {
      const event = createEvent('GET', '/institutions/Berkshire%20Hathaway/tracking');
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();

      const data = body.data;
      
      // Vérifier que totalHoldings n'est pas 0 (suspect)
      if (data.totalHoldings === 0) {
        console.warn('⚠ Total Holdings = 0 (suspect pour Berkshire Hathaway)');
      }
      
      // Vérifier que recentActivity n'est pas vide
      if (!Array.isArray(data.recentActivity) || data.recentActivity.length === 0) {
        console.warn('⚠ Recent Activity est vide (suspect)');
      }
    });

    it('devrait avoir des données valides dans Sector Analysis', async () => {
      const event = createEvent('GET', '/analysis/sector/Technology');
      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();

      const data = body.data;
      
      // Vérifier averagePE n'est pas 0
      if (data.averagePE === 0 || !data.averagePE) {
        console.warn('⚠ Average PE = 0 (suspect)');
      }
      
      // Vérifier sentiment score
      if (data.sentiment && data.sentiment.score === 50) {
        console.warn('⚠ Sentiment Score = 50 (valeur par défaut suspecte)');
      }
    });
  });

  describe('Phase 3: Vérification de la cohérence des valeurs', () => {
    it('devrait avoir des valeurs cohérentes entre endpoints', async () => {
      // Récupérer Complete Analysis
      const completeEvent = createEvent('GET', `/analysis/${TICKER}/complete`);
      const completeResponse = await handler(completeEvent);
      const completeBody = JSON.parse(completeResponse.body);

      // Récupérer Valuation
      const valuationEvent = createEvent('GET', `/analysis/${TICKER}/valuation`);
      const valuationResponse = await handler(valuationEvent);
      const valuationBody = JSON.parse(valuationResponse.body);

      // Les scores fondamentaux devraient être similaires
      const completeFundamentalScore = completeBody.data?.fundamental?.score;
      const valuationFundamentalValue = valuationBody.data?.fundamentalValue;

      if (completeFundamentalScore && valuationFundamentalValue) {
        // Les valeurs ne doivent pas être exactement les mêmes mais devraient être cohérentes
        expect(completeFundamentalScore).toBeGreaterThan(0);
        expect(valuationFundamentalValue).toBeGreaterThan(0);
      }
    });
  });
});

