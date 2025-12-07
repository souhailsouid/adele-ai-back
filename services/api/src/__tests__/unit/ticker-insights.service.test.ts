/**
 * Tests unitaires pour TickerInsightsService
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TickerInsightsService } from '../../services/ticker-insights.service';
import * as tickerActivity from '../../ticker-activity';
import * as fmp from '../../fmp';
import * as uw from '../../unusual-whales';
import type { TickerInsightsResponse } from '../../types/ticker-insights';

// Mock des dépendances
jest.mock('../../ticker-activity', () => ({
  getTickerQuote: jest.fn(),
  getTickerOwnership: jest.fn(),
  getTickerActivity: jest.fn(),
  getTickerInsiders: jest.fn(),
  getTickerOptions: jest.fn(),
  getTickerDarkPool: jest.fn(),
}));

jest.mock('../../fmp', () => ({
  getFMPStockQuote: jest.fn(),
  getFMPSECCompanyFullProfile: jest.fn(),
  getFMPEarningsReport: jest.fn(),
  getFMPEarningsCalendar: jest.fn(),
  getFMPStockNews: jest.fn(),
  getFMPKeyMetrics: jest.fn(),
  getFMPFinancialRatios: jest.fn(),
  getFMPSECFilingsBySymbol: jest.fn(),
}));

jest.mock('../../unusual-whales', () => ({
  getUWShortInterestAndFloat: jest.fn(),
  getUWRecentFlows: jest.fn(),
  getUWFlowPerExpiry: jest.fn(),
  getUWGreeks: jest.fn(),
  getUWEconomicCalendar: jest.fn(),
  getUWMaxPain: jest.fn(),
  getUWStockOIChange: jest.fn(),
  getUWOptionsVolume: jest.fn(),
  getUWVolatilityStats: jest.fn(),
  getUWSpotExposures: jest.fn(),
}));

describe('TickerInsightsService', () => {
  let service: TickerInsightsService;

  beforeEach(() => {
    service = new TickerInsightsService();
    jest.clearAllMocks();
  });

  describe('getTickerInsights', () => {
    it('should return complete insights for a valid ticker', async () => {
      // Mock des données de base
      const mockQuote = {
        success: true,
        data: {
          price: 150.50,
          change: 2.5,
          changePercent: 1.69,
          volume: 50000000,
          dayLow: 148.0,
          dayHigh: 152.0,
          yearLow: 100.0,
          yearHigh: 200.0,
          previousClose: 148.0,
          open: 149.0,
          timestamp: '2024-01-15T16:00:00Z',
        },
        timestamp: new Date().toISOString(),
      } as any);
      };

      const mockOwnership = {
        success: true,
        data: [
          {
            name: 'Vanguard Group',
            shares: 1000000,
            value: 150000000,
            percentage: 5.0,
            is_hedge_fund: false,
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockActivity = {
        success: true,
        data: [
          {
            institution_name: 'BlackRock',
            transaction_type: 'BUY',
            units_change: 50000,
            avg_price: 150.0,
            filing_date: '2024-01-10',
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockInsiders = {
        success: true,
        data: [
          {
            owner_name: 'John Doe',
            officer_title: 'CEO',
            transaction_code: 'P',
            shares: 10000,
            price: 150.0,
            transaction_date: '2024-01-12',
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockOptions = {
        success: true,
        data: [
          {
            type: 'call',
            strike: 155,
            expiry: '2024-01-19',
            volume: 1000,
            premium: 50000,
            is_sweep: true,
          },
          {
            type: 'put',
            strike: 145,
            expiry: '2024-01-19',
            volume: 500,
            premium: 25000,
            is_block: true,
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockDarkPool = {
        success: true,
        data: [
          {
            date: '2024-01-15',
            volume: 100000,
            price: 150.0,
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      // Mock FMP
      const mockFMPQuote = {
        success: true,
        data: [
          {
            symbol: 'NVDA',
            price: 150.50,
            change: 2.5,
            changePercentage: 1.69,
            volume: 50000000,
            dayLow: 148.0,
            dayHigh: 152.0,
            yearLow: 100.0,
            yearHigh: 200.0,
            previousClose: 148.0,
            open: 149.0,
            timestamp: 1705334400000,
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockFMPCompany = {
        success: true,
        data: {
          symbol: 'NVDA',
          companyName: 'NVIDIA Corporation',
          sector: 'Technology',
          industry: 'Semiconductors',
          exchange: 'NASDAQ',
          marketCap: 1500000000000,
          description: 'NVIDIA Corporation designs graphics processing units.',
          website: 'https://www.nvidia.com',
          ceo: 'Jensen Huang',
        },
        timestamp: new Date().toISOString(),
      } as any);
      };

      const mockFMPEarnings = {
        success: true,
        data: [
          {
            symbol: 'NVDA',
            date: '2024-01-10',
            eps: 4.50,
            epsEstimated: 4.30,
            revenue: 22000000000,
            revenueEstimated: 21000000000,
            surprise: 0.20,
            surprisePercentage: 4.65,
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockFMPEarningsCalendar = {
        success: true,
        data: [
          {
            symbol: 'NVDA',
            date: '2024-02-15',
            epsEstimated: 4.60,
            revenueEstimated: 23000000000,
            time: 'bmo',
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockFMPNews = {
        success: true,
        data: [
          {
            title: 'NVIDIA announces new AI chip',
            publishedDate: '2024-01-15T10:00:00Z',
            url: 'https://example.com/news1',
            site: 'TechNews',
            text: 'NVIDIA has announced...',
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockFMPKeyMetrics = {
        success: true,
        data: [
          {
            symbol: 'NVDA',
            peRatio: 60.0,
            priceToBookRatio: 25.0,
            enterpriseValueMultiple: 20.0,
            evToEbitda: 45.0,
            debtToEquity: 0.3,
            currentRatio: 3.5,
            roe: 0.35,
            roa: 0.25,
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockFMPRatios = {
        success: true,
        data: [
          {
            symbol: 'NVDA',
            currentRatio: 3.5,
            quickRatio: 3.0,
            debtToEquityRatio: 0.3,
            debtRatio: 0.15,
            interestCoverage: 50.0,
            grossProfitMargin: 0.70,
            operatingProfitMargin: 0.40,
            netProfitMargin: 0.35,
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockFMPSECFilings = {
        success: true,
        data: [
          {
            symbol: 'NVDA',
            filingDate: '2024-01-10',
            formType: '10-Q',
            link: 'https://sec.gov/filing1',
            hasFinancials: true,
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      // Mock Unusual Whales
      const mockUWShortInterest = {
        success: true,
        data: {
          short_interest: 50000000,
          short_ratio: 2.5,
          days_to_cover: 3,
          short_percent_of_float: 2.0,
          date: '2024-01-15',
        },
        timestamp: new Date().toISOString(),
      } as any);
      };

      const mockUWRecentFlows = {
        success: true,
        data: [
          {
            created_at: '2024-01-15T10:00:00Z',
            strike: 155,
            expiry: '2024-01-19',
            premium: 50000,
            volume: 1000,
            is_sweep: true,
            type: 'call',
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockUWFlowPerExpiry = {
        success: true,
        data: [
          {
            expiry: '2024-01-19',
            call_volume: 10000,
            put_volume: 5000,
            open_interest: 50000,
            max_pain: 150,
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockUWGreeks = {
        success: true,
        data: [
          {
            delta: 0.5,
            gamma: 0.02,
            theta: -0.05,
            vega: 0.1,
            iv: 0.35,
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockUWEconomicCalendar = {
        success: true,
        data: [
          {
            date: '2024-01-20',
            event: 'GDP Release',
            country: 'US',
            currency: 'USD',
            impact: 'high',
            previous: 3.5,
            estimate: 3.7,
            actual: null,
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockUWMaxPain = {
        success: true,
        data: [
          {
            max_pain: 150,
            expiry: '2024-01-19',
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockUWOIChange = {
        success: true,
        data: [
          {
            total_change: 100000,
            call_change: 60000,
            put_change: 40000,
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockUWOptionsVolume = {
        success: true,
        data: [
          {
            call_volume: 1000000,
            put_volume: 500000,
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockUWVolatilityStats = {
        success: true,
        data: [
          {
            iv: 0.35,
            hv: 0.30,
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      const mockUWSpotExposures = {
        success: true,
        data: [
          {
            call_gex: 1000000,
            put_gex: -500000,
          },
        ],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      // Setup mocks
      (tickerActivity.getTickerQuote as jest.MockedFunction<typeof tickerActivity.getTickerQuote>).mockResolvedValue(mockQuote as any);
      (tickerActivity.getTickerOwnership as jest.MockedFunction<typeof tickerActivity.getTickerOwnership>).mockResolvedValue(mockOwnership as any);
      (tickerActivity.getTickerActivity as jest.MockedFunction<typeof tickerActivity.getTickerActivity>).mockResolvedValue(mockActivity as any);
      (tickerActivity.getTickerInsiders as jest.MockedFunction<typeof tickerActivity.getTickerInsiders>).mockResolvedValue(mockInsiders as any);
      (tickerActivity.getTickerOptions as jest.MockedFunction<typeof tickerActivity.getTickerOptions>).mockResolvedValue(mockOptions as any);
      (tickerActivity.getTickerDarkPool as jest.MockedFunction<typeof tickerActivity.getTickerDarkPool>).mockResolvedValue(mockDarkPool as any);

      (fmp.getFMPStockQuote as jest.MockedFunction<typeof fmp.getFMPStockQuote>).mockResolvedValue(mockFMPQuote as any);
      (fmp.getFMPSECCompanyFullProfile as jest.MockedFunction<typeof fmp.getFMPSECCompanyFullProfile>).mockResolvedValue(mockFMPCompany as any);
      (fmp.getFMPEarningsReport as jest.MockedFunction<typeof fmp.getFMPEarningsReport>).mockResolvedValue(mockFMPEarnings as any);
      (fmp.getFMPEarningsCalendar as jest.MockedFunction<typeof fmp.getFMPEarningsCalendar>).mockResolvedValue(mockFMPEarningsCalendar as any);
      (fmp.getFMPStockNews as jest.MockedFunction<typeof fmp.getFMPStockNews>).mockResolvedValue(mockFMPNews as any);
      (fmp.getFMPKeyMetrics as jest.MockedFunction<typeof fmp.getFMPKeyMetrics>).mockResolvedValue(mockFMPKeyMetrics as any);
      (fmp.getFMPFinancialRatios as jest.MockedFunction<typeof fmp.getFMPFinancialRatios>).mockResolvedValue(mockFMPRatios as any);
      (fmp.getFMPSECFilingsBySymbol as jest.MockedFunction<typeof fmp.getFMPSECFilingsBySymbol>).mockResolvedValue(mockFMPSECFilings as any);

      (uw.getUWShortInterestAndFloat as jest.MockedFunction<typeof uw.getUWShortInterestAndFloat>).mockResolvedValue(mockUWShortInterest as any);
      (uw.getUWRecentFlows as jest.MockedFunction<typeof uw.getUWRecentFlows>).mockResolvedValue(mockUWRecentFlows as any);
      (uw.getUWFlowPerExpiry as jest.MockedFunction<typeof uw.getUWFlowPerExpiry>).mockResolvedValue(mockUWFlowPerExpiry as any);
      (uw.getUWGreeks as jest.MockedFunction<typeof uw.getUWGreeks>).mockResolvedValue(mockUWGreeks as any);
      (uw.getUWEconomicCalendar as jest.MockedFunction<typeof uw.getUWEconomicCalendar>).mockResolvedValue(mockUWEconomicCalendar as any);
      (uw.getUWMaxPain as jest.MockedFunction<typeof uw.getUWMaxPain>).mockResolvedValue(mockUWMaxPain as any);
      (uw.getUWStockOIChange as jest.MockedFunction<typeof uw.getUWStockOIChange>).mockResolvedValue(mockUWOIChange as any);
      (uw.getUWOptionsVolume as jest.MockedFunction<typeof uw.getUWOptionsVolume>).mockResolvedValue(mockUWOptionsVolume as any);
      (uw.getUWVolatilityStats as jest.MockedFunction<typeof uw.getUWVolatilityStats>).mockResolvedValue(mockUWVolatilityStats as any);
      (uw.getUWSpotExposures as jest.MockedFunction<typeof uw.getUWSpotExposures>).mockResolvedValue(mockUWSpotExposures as any);

      // Execute
      const result = await service.getTickerInsights('NVDA');

      // Assertions
      expect(result.success).toBe(true);
      expect(result.data.ticker).toBe('NVDA');
      expect(result.data.companyInfo.name).toBe('NVIDIA Corporation');
      expect(result.data.companyInfo.sector).toBe('Technology');
      expect(result.data.quote.price).toBe(150.50);
      expect(result.data.optionsFlow.recentFlow.totalAlerts).toBe(2);
      expect(result.data.optionsFlow.recentFlow.callVolume).toBeGreaterThan(0);
      expect(result.data.optionsFlow.recentFlow.putVolume).toBeGreaterThan(0);
      expect(result.data.institutionalActivity.topHolders.length).toBeGreaterThan(0);
      expect(result.data.insiderActivity.recentTransactions.length).toBeGreaterThan(0);
      expect(result.data.darkPool.recentTrades.length).toBeGreaterThan(0);
      expect(result.data.earnings.last).toBeDefined();
      expect(result.data.earnings.upcoming).toBeDefined();
      expect(result.data.news.recent.length).toBeGreaterThan(0);
      expect(result.data.economicEvents.length).toBeGreaterThan(0);
      expect(result.data.financialMetrics.keyMetrics).toBeDefined();
      expect(result.data.financialMetrics.ratios).toBeDefined();
      expect(result.data.recentFilings.length).toBeGreaterThan(0);
      expect(result.data.alerts.length).toBeGreaterThan(0);
    it('should handle missing data gracefully', async () => {
      // Mock avec des données vides ou rejetées
      (tickerActivity.getTickerQuote as jest.MockedFunction<typeof tickerActivity.getTickerQuote>).mockResolvedValue({
        success: true,
        data: {} as any,
        timestamp: new Date().toISOString(),
      } as any);
      } as any);

      (tickerActivity.getTickerOwnership as jest.MockedFunction<typeof tickerActivity.getTickerOwnership>).mockRejectedValue(
        new Error('API Error')
      );

      (fmp.getFMPStockQuote as jest.MockedFunction<typeof fmp.getFMPStockQuote>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPSECCompanyFullProfile as jest.MockedFunction<typeof fmp.getFMPSECCompanyFullProfile>).mockResolvedValue({
        success: true,
        data: null,
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      // Mock les autres avec des valeurs par défaut
      (tickerActivity.getTickerActivity as jest.MockedFunction<typeof tickerActivity.getTickerActivity>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (tickerActivity.getTickerInsiders as jest.MockedFunction<typeof tickerActivity.getTickerInsiders>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (tickerActivity.getTickerOptions as jest.MockedFunction<typeof tickerActivity.getTickerOptions>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (tickerActivity.getTickerDarkPool as jest.MockedFunction<typeof tickerActivity.getTickerDarkPool>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPEarningsReport as jest.MockedFunction<typeof fmp.getFMPEarningsReport>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPEarningsCalendar as jest.MockedFunction<typeof fmp.getFMPEarningsCalendar>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPStockNews as jest.MockedFunction<typeof fmp.getFMPStockNews>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPKeyMetrics as jest.MockedFunction<typeof fmp.getFMPKeyMetrics>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPFinancialRatios as jest.MockedFunction<typeof fmp.getFMPFinancialRatios>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPSECFilingsBySymbol as jest.MockedFunction<typeof fmp.getFMPSECFilingsBySymbol>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWShortInterestAndFloat as jest.MockedFunction<typeof uw.getUWShortInterestAndFloat>).mockResolvedValue({
        success: true,
        data: null,
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWRecentFlows as jest.MockedFunction<typeof uw.getUWRecentFlows>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWFlowPerExpiry as jest.MockedFunction<typeof uw.getUWFlowPerExpiry>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWGreeks as jest.MockedFunction<typeof uw.getUWGreeks>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWEconomicCalendar as jest.MockedFunction<typeof uw.getUWEconomicCalendar>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWMaxPain as jest.MockedFunction<typeof uw.getUWMaxPain>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWStockOIChange as jest.MockedFunction<typeof uw.getUWStockOIChange>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWOptionsVolume as jest.MockedFunction<typeof uw.getUWOptionsVolume>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWVolatilityStats as jest.MockedFunction<typeof uw.getUWVolatilityStats>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWSpotExposures as jest.MockedFunction<typeof uw.getUWSpotExposures>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
        timestamp: new Date().toISOString(),
      } as any);

      // Execute
      const result = await service.getTickerInsights('INVALID');

      // Should still return a valid response structure
      expect(result.success).toBe(true);
      expect(result.data.ticker).toBe('INVALID');
      expect(result.data.companyInfo.name).toBe('');
      expect(result.data.quote.price).toBe(0);
      expect(result.data.optionsFlow.recentFlow.totalAlerts).toBe(0);
      expect(result.data.institutionalActivity.topHolders).toEqual([]);
      expect(result.data.insiderActivity.recentTransactions).toEqual([]);
      expect(result.data.darkPool.recentTrades).toEqual([]);
    it('should convert ticker to uppercase', async () => {
      // Mock minimal pour que le test passe
      (tickerActivity.getTickerQuote as jest.MockedFunction<typeof tickerActivity.getTickerQuote>).mockResolvedValue({
        success: true,
        data: { price: 100 },
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (tickerActivity.getTickerOwnership as jest.MockedFunction<typeof tickerActivity.getTickerOwnership>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (tickerActivity.getTickerActivity as jest.MockedFunction<typeof tickerActivity.getTickerActivity>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (tickerActivity.getTickerInsiders as jest.MockedFunction<typeof tickerActivity.getTickerInsiders>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (tickerActivity.getTickerOptions as jest.MockedFunction<typeof tickerActivity.getTickerOptions>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (tickerActivity.getTickerDarkPool as jest.MockedFunction<typeof tickerActivity.getTickerDarkPool>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      // Mock FMP
      (fmp.getFMPStockQuote as jest.MockedFunction<typeof fmp.getFMPStockQuote>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPSECCompanyFullProfile as jest.MockedFunction<typeof fmp.getFMPSECCompanyFullProfile>).mockResolvedValue({
        success: true,
        data: null,
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPEarningsReport as jest.MockedFunction<typeof fmp.getFMPEarningsReport>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPEarningsCalendar as jest.MockedFunction<typeof fmp.getFMPEarningsCalendar>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPStockNews as jest.MockedFunction<typeof fmp.getFMPStockNews>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPKeyMetrics as jest.MockedFunction<typeof fmp.getFMPKeyMetrics>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPFinancialRatios as jest.MockedFunction<typeof fmp.getFMPFinancialRatios>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPSECFilingsBySymbol as jest.MockedFunction<typeof fmp.getFMPSECFilingsBySymbol>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      // Mock UW
      (uw.getUWShortInterestAndFloat as jest.MockedFunction<typeof uw.getUWShortInterestAndFloat>).mockResolvedValue({
        success: true,
        data: null,
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWRecentFlows as jest.MockedFunction<typeof uw.getUWRecentFlows>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWFlowPerExpiry as jest.MockedFunction<typeof uw.getUWFlowPerExpiry>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWGreeks as jest.MockedFunction<typeof uw.getUWGreeks>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWEconomicCalendar as jest.MockedFunction<typeof uw.getUWEconomicCalendar>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWMaxPain as jest.MockedFunction<typeof uw.getUWMaxPain>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWStockOIChange as jest.MockedFunction<typeof uw.getUWStockOIChange>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWOptionsVolume as jest.MockedFunction<typeof uw.getUWOptionsVolume>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWVolatilityStats as jest.MockedFunction<typeof uw.getUWVolatilityStats>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWSpotExposures as jest.MockedFunction<typeof uw.getUWSpotExposures>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
        timestamp: new Date().toISOString(),
      } as any);

      const result = await service.getTickerInsights('nvda');

      expect(result.data.ticker).toBe('NVDA');
      expect(tickerActivity.getTickerQuote).toHaveBeenCalledWith('NVDA');
    it('should generate alerts based on data', async () => {
      // Mock avec des données qui devraient générer des alertes
      (tickerActivity.getTickerQuote as jest.MockedFunction<typeof tickerActivity.getTickerQuote>).mockResolvedValue({
        success: true,
        data: { price: 100 },
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (tickerActivity.getTickerOwnership as jest.MockedFunction<typeof tickerActivity.getTickerOwnership>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (tickerActivity.getTickerActivity as jest.MockedFunction<typeof tickerActivity.getTickerActivity>).mockResolvedValue({
        success: true,
        data: Array(15).fill({ transaction_type: 'BUY' }), // 15 buys
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (tickerActivity.getTickerInsiders as jest.MockedFunction<typeof tickerActivity.getTickerInsiders>).mockResolvedValue({
        success: true,
        data: Array(10).fill({ transaction_code: 'P' }), // 10 insider transactions
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (tickerActivity.getTickerOptions as jest.MockedFunction<typeof tickerActivity.getTickerOptions>).mockResolvedValue({
        success: true,
        data: Array(60).fill({ type: 'call' }), // 60 options alerts
        timestamp: new Date().toISOString(),
      } as any);
      (tickerActivity.getTickerDarkPool as jest.MockedFunction<typeof tickerActivity.getTickerDarkPool>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      // Mock FMP
      (fmp.getFMPStockQuote as jest.MockedFunction<typeof fmp.getFMPStockQuote>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPSECCompanyFullProfile as jest.MockedFunction<typeof fmp.getFMPSECCompanyFullProfile>).mockResolvedValue({
        success: true,
        data: null,
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPEarningsReport as jest.MockedFunction<typeof fmp.getFMPEarningsReport>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPEarningsCalendar as jest.MockedFunction<typeof fmp.getFMPEarningsCalendar>).mockResolvedValue({
        success: true,
        data: [
          {
            symbol: 'NVDA',
            date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days from now
          },
        ],
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPStockNews as jest.MockedFunction<typeof fmp.getFMPStockNews>).mockResolvedValue({
        success: true,
        data: Array(10).fill({
          publishedDate: new Date().toISOString(), // Recent news
        }),
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPKeyMetrics as jest.MockedFunction<typeof fmp.getFMPKeyMetrics>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPFinancialRatios as jest.MockedFunction<typeof fmp.getFMPFinancialRatios>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (fmp.getFMPSECFilingsBySymbol as jest.MockedFunction<typeof fmp.getFMPSECFilingsBySymbol>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      // Mock UW
      (uw.getUWShortInterestAndFloat as jest.MockedFunction<typeof uw.getUWShortInterestAndFloat>).mockResolvedValue({
        success: true,
        data: null,
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWRecentFlows as jest.MockedFunction<typeof uw.getUWRecentFlows>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWFlowPerExpiry as jest.MockedFunction<typeof uw.getUWFlowPerExpiry>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWGreeks as jest.MockedFunction<typeof uw.getUWGreeks>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWEconomicCalendar as jest.MockedFunction<typeof uw.getUWEconomicCalendar>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWMaxPain as jest.MockedFunction<typeof uw.getUWMaxPain>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWStockOIChange as jest.MockedFunction<typeof uw.getUWStockOIChange>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWOptionsVolume as jest.MockedFunction<typeof uw.getUWOptionsVolume>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWVolatilityStats as jest.MockedFunction<typeof uw.getUWVolatilityStats>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
        timestamp: new Date().toISOString(),
      } as any);
      (uw.getUWSpotExposures as jest.MockedFunction<typeof uw.getUWSpotExposures>).mockResolvedValue({
        success: true,
        data: [],
        cached: false,
        timestamp: new Date().toISOString(),
      } as any);
        timestamp: new Date().toISOString(),
      } as any);

      const result = await service.getTickerInsights('NVDA');

      // Should have multiple alerts
      expect(result.data.alerts.length).toBeGreaterThan(0);
      
      // Check for specific alert types
      const alertTypes = result.data.alerts.map((a) => a.type);
      expect(alertTypes).toContain('options_flow');
      expect(alertTypes).toContain('institutional_activity');
      expect(alertTypes).toContain('insider_trade');
      expect(alertTypes).toContain('earnings_soon');
      expect(alertTypes).toContain('news_event');