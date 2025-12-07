/**
 * Tests unitaires pour le Scoring Service
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ScoringService } from '../../services/scoring.service';
import * as uw from '../../unusual-whales';

// Mock du module unusual-whales
jest.mock('../../unusual-whales', () => ({
  getUWRecentFlows: jest.fn(),
  getUWStockInsiderBuySells: jest.fn(),
  getUWDarkPoolTrades: jest.fn(),
  getUWShortInterestAndFloat: jest.fn(),
  getUWGreeks: jest.fn(),
  getUWMaxPain: jest.fn(),
}));

describe('ScoringService', () => {
  let service: ScoringService;

  beforeEach(() => {
    service = new ScoringService();
    jest.clearAllMocks();
  });

  describe('calculateTickerScore', () => {
    it('devrait calculer un score composite avec toutes les données disponibles', async () => {
      // Mock des données
      const mockRecentFlows = {
        success: true,
        data: [
          { side: 'call', premium: 100000, volume: 1000 },
          { side: 'put', premium: 50000, volume: 500 },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockInsiderActivity = {
        success: true,
        data: [
          { filing_date: '2024-01-01', transaction_code: 'P', units_change: 1000 },
          { filing_date: '2024-01-02', transaction_code: 'S', units_change: -500 },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockDarkPool = {
        success: true,
        data: [
          { date: '2024-01-01', volume: 1000000, price: 100 },
          { date: '2024-01-02', volume: 2000000, price: 105 },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockShortInterest = {
        success: true,
        data: [
          {
            symbol: 'AAPL',
            percent_returned: 5.5,
            si_float_returned: 1000000000,
            total_float_returned: 15000000000,
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockGreeks = {
        success: true,
        data: [
          { expiry: '2024-12-20', gamma: 0.05, delta: 0.5 },
          { expiry: '2024-12-27', gamma: 0.06, delta: 0.6 },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockMaxPain = {
        success: true,
        data: [{ max_pain: 150 }],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      // Configurer les mocks
      jest.mocked(uw.getUWRecentFlows).mockResolvedValue(mockRecentFlows);
      jest.mocked(uw.getUWStockInsiderBuySells).mockResolvedValue(mockInsiderActivity);
      jest.mocked(uw.getUWDarkPoolTrades).mockResolvedValue(mockDarkPool);
      jest.mocked(uw.getUWShortInterestAndFloat).mockResolvedValue(mockShortInterest);
      jest.mocked(uw.getUWGreeks).mockResolvedValue(mockGreeks);
      jest.mocked(uw.getUWMaxPain).mockResolvedValue(mockMaxPain);

      // Appeler le service
      const result = await service.calculateTickerScore('AAPL');

      // Vérifications
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.ticker).toBe('AAPL');
      expect(result.data.overall).toBeGreaterThanOrEqual(0);
      expect(result.data.overall).toBeLessThanOrEqual(100);
      expect(result.data.breakdown).toBeDefined();
      expect(result.data.breakdown.options).toBeGreaterThanOrEqual(0);
      expect(result.data.breakdown.options).toBeLessThanOrEqual(100);
      expect(result.data.breakdown.insiders).toBeGreaterThanOrEqual(0);
      expect(result.data.breakdown.insiders).toBeLessThanOrEqual(100);
      expect(result.data.breakdown.darkPool).toBeGreaterThanOrEqual(0);
      expect(result.data.breakdown.darkPool).toBeLessThanOrEqual(100);
      expect(result.data.breakdown.shortInterest).toBeGreaterThanOrEqual(0);
      expect(result.data.breakdown.shortInterest).toBeLessThanOrEqual(100);
      expect(result.data.breakdown.greeks).toBeGreaterThanOrEqual(0);
      expect(result.data.breakdown.greeks).toBeLessThanOrEqual(100);
      expect(result.data.recommendation).toBeDefined();
      expect(['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL']).toContain(result.data.recommendation);
      expect(result.data.confidence).toBeGreaterThanOrEqual(0);
      expect(result.data.confidence).toBeLessThanOrEqual(100);
    });

    it('devrait gérer les données manquantes gracieusement', async () => {
      // Mock avec des données rejetées
      jest.mocked(uw.getUWRecentFlows).mockRejectedValue(new Error('API Error'));
      jest.mocked(uw.getUWStockInsiderBuySells).mockRejectedValue(new Error('API Error'));
      jest.mocked(uw.getUWDarkPoolTrades).mockRejectedValue(new Error('API Error'));
      jest.mocked(uw.getUWShortInterestAndFloat).mockRejectedValue(new Error('API Error'));
      jest.mocked(uw.getUWGreeks).mockRejectedValue(new Error('API Error'));
      jest.mocked(uw.getUWMaxPain).mockRejectedValue(new Error('API Error'));

      // Le service devrait quand même retourner un résultat (avec des scores par défaut)
      const result = await service.calculateTickerScore('AAPL');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.overall).toBeGreaterThanOrEqual(0);
      expect(result.data.overall).toBeLessThanOrEqual(100);
      // La confiance devrait être faible si toutes les données sont manquantes
      expect(result.data.confidence).toBeLessThan(50);
    });

    it('devrait normaliser le ticker en majuscules', async () => {
      // Mock minimal
      jest.mocked(uw.getUWRecentFlows).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      });
      jest.mocked(uw.getUWStockInsiderBuySells).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      });
      jest.mocked(uw.getUWDarkPoolTrades).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      });
      jest.mocked(uw.getUWShortInterestAndFloat).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      });
      jest.mocked(uw.getUWGreeks).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      });
      jest.mocked(uw.getUWMaxPain).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      });

      const result = await service.calculateTickerScore('aapl');

      expect(result.data.ticker).toBe('AAPL');
    });

    it('devrait utiliser des poids personnalisés si fournis', async () => {
      const customWeights = {
        options: 0.5,
        insiders: 0.3,
        darkPool: 0.1,
        shortInterest: 0.05,
        greeks: 0.05,
      };

      const customService = new ScoringService(customWeights);

      // Mock minimal avec des données valides
      jest.mocked(uw.getUWRecentFlows).mockResolvedValue({
        success: true,
        data: [{ side: 'call', premium: 100000, volume: 1000 }],
        cached: false,
        timestamp: new Date().toISOString(),
      });
      jest.mocked(uw.getUWStockInsiderBuySells).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      });
      jest.mocked(uw.getUWDarkPoolTrades).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      });
      jest.mocked(uw.getUWShortInterestAndFloat).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      });
      jest.mocked(uw.getUWGreeks).mockResolvedValue({
        success: true,
        data: [{ expiry: '2024-12-20', gamma: 0.05 }],
        cached: false,
        timestamp: new Date().toISOString(),
      });
      jest.mocked(uw.getUWMaxPain).mockResolvedValue({
        success: true,
        data: [{ max_pain: 150 }],
        cached: false,
        timestamp: new Date().toISOString(),
      });

      const result = await customService.calculateTickerScore('AAPL');

      expect(result.success).toBe(true);
      // Le score devrait être calculé avec les poids personnalisés
      // (options aura plus de poids, donc le score devrait être plus élevé si options est positif)
      expect(result.data.overall).toBeGreaterThanOrEqual(0);
      expect(result.data.overall).toBeLessThanOrEqual(100);
    });
  });
});

