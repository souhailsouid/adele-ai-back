/**
 * Service métier FMP (Financial Modeling Prep)
 * Contient la logique métier, utilise le repository pour l'accès aux données
 */

import { FMPRepository } from '../repositories/fmp.repository';
import { CacheService } from './cache.service';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types/ticker.types';
import { handleError } from '../utils/errors';
import type {
  SymbolSearchQueryParams,
  SymbolSearchResponse,
  NameSearchQueryParams,
  NameSearchResponse,
  CIKSearchQueryParams,
  CIKSearchResponse,
  CUSIPSearchQueryParams,
  CUSIPSearchResponse,
  ISINSearchQueryParams,
  ISINSearchResponse,
  FMPStockScreenerQueryParams,
  FMPStockScreenerResponse,
  ExchangeVariantsQueryParams,
  ExchangeVariantsResponse,
} from '../types/fmp/company-search';

export class FMPService {
  private repository: FMPRepository;
  private cache: CacheService;

  constructor() {
    this.repository = new FMPRepository();
    this.cache = new CacheService({ tableName: 'fmp_cache', ttlHours: 24 });
  }

  // ========== Quote & Market Data ==========

  async getQuote(symbol: string, forceRefresh: boolean = false): Promise<ApiResponse<any>> {
    const log = logger.child({ symbol, operation: 'getQuote' });
    
    return handleError(async () => {
      // Vérifier le cache
      if (!forceRefresh) {
        const cached = await this.cache.get<any>(symbol, 'symbol');
        if (cached) {
          log.debug('Quote found in cache');
          return {
            success: true,
            data: cached,
            cached: true,
            timestamp: cached.timestamp || new Date().toISOString(),
          };
        }
      }

      // Récupérer depuis l'API
      log.info('Fetching quote from API');
      const quote = await this.repository.getQuote(symbol);
      const quoteWithTimestamp = { ...quote, timestamp: new Date().toISOString() };

      // Mettre en cache
      await this.cache.set(symbol, quoteWithTimestamp, 'symbol', 1);

      return {
        success: true,
        data: quoteWithTimestamp,
        cached: false,
        timestamp: quoteWithTimestamp.timestamp,
      };
    }, `Get quote for ${symbol}`);
  }

  // ========== Financial Statements ==========

  async getIncomeStatement(params: {
    symbol: string;
    limit?: number;
    period?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter';
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getIncomeStatement(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get income statement for ${params.symbol}`);
  }

  async getIncomeStatementTTM(params: {
    symbol: string;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getIncomeStatementTTM(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get income statement TTM for ${params.symbol}`);
  }

  async getBalanceSheetStatement(params: {
    symbol: string;
    limit?: number;
    period?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter';
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getBalanceSheetStatement(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get balance sheet statement for ${params.symbol}`);
  }

  async getBalanceSheetStatementTTM(params: {
    symbol: string;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getBalanceSheetStatementTTM(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get balance sheet statement TTM for ${params.symbol}`);
  }

  async getCashFlowStatement(params: {
    symbol: string;
    limit?: number;
    period?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter';
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getCashFlowStatement(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get cash flow statement for ${params.symbol}`);
  }

  async getCashFlowStatementTTM(params: {
    symbol: string;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getCashFlowStatementTTM(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get cash flow statement TTM for ${params.symbol}`);
  }

  async getLatestFinancialStatements(params?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getLatestFinancialStatements(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get latest financial statements`);
  }

  async getKeyMetrics(params: {
    symbol: string;
    limit?: number;
    period?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter';
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getKeyMetrics(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get key metrics for ${params.symbol}`);
  }

  async getKeyMetricsTTM(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getKeyMetricsTTM(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get key metrics TTM for ${symbol}`);
  }

  async getFinancialRatios(params: {
    symbol: string;
    limit?: number;
    period?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter';
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getFinancialRatios(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get financial ratios for ${params.symbol}`);
  }

  // ========== Financial Scores ==========

  async getFinancialScores(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getFinancialScores(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get financial scores for ${symbol}`);
  }

  // ========== Owner Earnings ==========

  async getOwnerEarnings(params: { symbol: string; limit?: number }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getOwnerEarnings(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get owner earnings for ${params.symbol}`);
  }

  // ========== Enterprise Values ==========

  async getEnterpriseValues(params: { symbol: string; limit?: number; period?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getEnterpriseValues(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get enterprise values for ${params.symbol}`);
  }

  // ========== Income Statement Growth ==========

  async getIncomeStatementGrowth(params: { symbol: string; limit?: number; period?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getIncomeStatementGrowth(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get income statement growth for ${params.symbol}`);
  }

  // ========== Balance Sheet Statement Growth ==========

  async getBalanceSheetStatementGrowth(params: { symbol: string; limit?: number; period?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getBalanceSheetStatementGrowth(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get balance sheet statement growth for ${params.symbol}`);
  }

  // ========== Cashflow Statement Growth ==========

  async getCashflowStatementGrowth(params: { symbol: string; limit?: number; period?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getCashflowStatementGrowth(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get cashflow statement growth for ${params.symbol}`);
  }

  // ========== Financial Statement Growth ==========

  async getFinancialStatementGrowth(params: { symbol: string; limit?: number; period?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getFinancialStatementGrowth(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get financial statement growth for ${params.symbol}`);
  }

  // ========== Financial Reports Dates ==========

  async getFinancialReportsDates(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getFinancialReportsDates(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get financial reports dates for ${symbol}`);
  }

  // ========== Financial Reports Form 10-K JSON ==========

  async getFinancialReportsJSON(params: { symbol: string; year: number; period: string }): Promise<ApiResponse<any>> {
    return handleError(async () => {
      const data = await this.repository.getFinancialReportsJSON(params);
      // L'API FMP renvoie un objet JSON complexe, pas un tableau
      return {
        success: true,
        data,
        cached: false,
        count: 1, // C'est un objet unique, pas un tableau
        timestamp: new Date().toISOString(),
      };
    }, `Get financial reports JSON for ${params.symbol} ${params.year} ${params.period}`);
  }

  // ========== Financial Reports Form 10-K XLSX ==========

  async getFinancialReportsXLSX(params: { symbol: string; year: number; period: string }): Promise<ApiResponse<any>> {
    return handleError(async () => {
      const data = await this.repository.getFinancialReportsXLSX(params);
      // Si c'est un fichier binaire (objet avec format: 'base64'), retourner tel quel
      if (data && typeof data === 'object' && 'format' in data && (data as any).format === 'base64') {
        return {
          success: true,
          data,
          cached: false,
          count: 1,
          timestamp: new Date().toISOString(),
        };
      }
      // Sinon, traiter comme un tableau
      return {
        success: true,
        data: Array.isArray(data) ? data : [data],
        cached: false,
        count: Array.isArray(data) ? data.length : 1,
        timestamp: new Date().toISOString(),
      };
    }, `Get financial reports XLSX for ${params.symbol} ${params.year} ${params.period}`);
  }

  // ========== Revenue Product Segmentation ==========

  async getRevenueProductSegmentation(params: { symbol: string; period?: string; structure?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getRevenueProductSegmentation(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get revenue product segmentation for ${params.symbol}`);
  }

  // ========== Revenue Geographic Segments ==========

  async getRevenueGeographicSegments(params: { symbol: string; period?: string; structure?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getRevenueGeographicSegments(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get revenue geographic segments for ${params.symbol}`);
  }

  // ========== As Reported Income Statements ==========

  async getAsReportedIncomeStatements(params: { symbol: string; limit?: number; period?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getAsReportedIncomeStatements(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get as reported income statements for ${params.symbol}`);
  }

  // ========== As Reported Balance Statements ==========

  async getAsReportedBalanceStatements(params: { symbol: string; limit?: number; period?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getAsReportedBalanceStatements(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get as reported balance statements for ${params.symbol}`);
  }

  // ========== As Reported Cashflow Statements ==========

  async getAsReportedCashflowStatements(params: { symbol: string; limit?: number; period?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getAsReportedCashflowStatements(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get as reported cashflow statements for ${params.symbol}`);
  }

  // ========== As Reported Financial Statements ==========

  async getAsReportedFinancialStatements(params: { symbol: string; limit?: number; period?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getAsReportedFinancialStatements(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get as reported financial statements for ${params.symbol}`);
  }

  // ========== SEC Filings ==========

  async getLatest8KFilings(params: {
    from: string;
    to: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getLatest8KFilings(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get latest 8-K SEC filings`);
  }

  async getLatestSECFilings(params: {
    from: string;
    to: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getLatestSECFilings(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get latest SEC filings with financials`);
  }

  async getSECFilingsByFormType(params: {
    formType: string;
    from: string;
    to: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getSECFilingsByFormType(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get SEC filings by form type: ${params.formType}`);
  }

  async getSECFilingsBySymbol(params: {
    symbol: string;
    from: string;
    to: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getSECFilingsBySymbol(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get SEC filings for symbol: ${params.symbol}`);
  }

  async getSECFilingsByCIK(params: {
    cik: string;
    from: string;
    to: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getSECFilingsByCIK(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get SEC filings for CIK: ${params.cik}`);
  }

  async searchSECFilingsByName(company: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.searchSECFilingsByName(company);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Search SEC filings by company name: ${company}`);
  }

  async searchSECCompanyBySymbol(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.searchSECCompanyBySymbol(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Search SEC company by symbol: ${symbol}`);
  }

  async searchSECCompanyByCIK(cik: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.searchSECCompanyByCIK(cik);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Search SEC company by CIK: ${cik}`);
  }

  async getSECCompanyFullProfile(params: {
    symbol: string;
    cik?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getSECCompanyFullProfile(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get SEC company full profile for: ${params.symbol}`);
  }

  async getIndustryClassificationList(params?: {
    industryTitle?: string;
    sicCode?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getIndustryClassificationList(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get industry classification list`);
  }

  async searchIndustryClassification(params?: {
    symbol?: string;
    cik?: string;
    sicCode?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.searchIndustryClassification(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Search industry classification`);
  }

  async getAllIndustryClassification(params?: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getAllIndustryClassification(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get all industry classification`);
  }

  // ========== Company Search ==========

  async searchSymbol(params: SymbolSearchQueryParams): Promise<ApiResponse<SymbolSearchResponse>> {
    return handleError(async () => {
      const data = await this.repository.searchSymbol(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Search symbol: ${params.query}`);
  }

  async searchName(params: NameSearchQueryParams): Promise<ApiResponse<NameSearchResponse>> {
    return handleError(async () => {
      const data = await this.repository.searchName(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Search name: ${params.query}`);
  }

  async searchCIK(params: CIKSearchQueryParams): Promise<ApiResponse<CIKSearchResponse>> {
    return handleError(async () => {
      const data = await this.repository.searchCIK(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Search CIK: ${params.cik}`);
  }

  async searchCUSIP(params: CUSIPSearchQueryParams): Promise<ApiResponse<CUSIPSearchResponse>> {
    return handleError(async () => {
      const data = await this.repository.searchCUSIP(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Search CUSIP: ${params.cusip}`);
  }

  async searchISIN(params: ISINSearchQueryParams): Promise<ApiResponse<ISINSearchResponse>> {
    return handleError(async () => {
      const data = await this.repository.searchISIN(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Search ISIN: ${params.isin}`);
  }

  async stockScreener(params?: FMPStockScreenerQueryParams): Promise<ApiResponse<FMPStockScreenerResponse>> {
    return handleError(async () => {
      const data = await this.repository.stockScreener(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, 'Stock screener');
  }

  async searchExchangeVariants(params: ExchangeVariantsQueryParams): Promise<ApiResponse<ExchangeVariantsResponse>> {
    return handleError(async () => {
      const data = await this.repository.searchExchangeVariants(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Search exchange variants for ${params.symbol}`);
  }

  // ========== Market Hours ==========

  async getExchangeMarketHours(exchange: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getExchangeMarketHours(exchange);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get market hours for ${exchange}`);
  }

  async getHolidaysByExchange(exchange: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHolidaysByExchange(exchange);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get holidays for ${exchange}`);
  }

  async getAllExchangeMarketHours(): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getAllExchangeMarketHours();
      return {
        success: true,
        data,
        cached: false,
        count: Array.isArray(data) ? data.length : 0,
        timestamp: new Date().toISOString(),
      };
    }, `Get all exchange market hours`);
  }

  // ========== Commodity ==========

  async getCommoditiesList(): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getCommoditiesList();
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get commodities list`);
  }

  async getCommoditiesQuote(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getCommoditiesQuote(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get commodity quote for ${symbol}`);
  }

  async getCommoditiesQuoteShort(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getCommoditiesQuoteShort(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get commodity quote short for ${symbol}`);
  }

  async getBatchCommodityQuotes(short: boolean = false): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getBatchCommodityQuotes(short);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get batch commodity quotes`);
  }

  async getHistoricalPriceEODLightCommodity(params: {
    symbol: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalPriceEODLightCommodity(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get light chart for commodity ${params.symbol}`);
  }

  async getHistoricalPriceEODFullCommodity(params: {
    symbol: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalPriceEODFullCommodity(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get full chart for commodity ${params.symbol}`);
  }

  // ========== Historical Price EOD (stocks / generic) ==========

  async getLightChart(params: { symbol: string; from?: string; to?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getLightChart(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get light chart for ${params.symbol}`);
  }

  async getFullChart(params: { symbol: string; from?: string; to?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getFullChart(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get full chart for ${params.symbol}`);
  }
// need subscription
  async getHistoricalChart1MinCommodity(params: {
    symbol: string;
    from: string;
    to: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalChart1MinCommodity(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get 1-minute chart for commodity ${params.symbol}`);
  }

  async getHistoricalChart5MinCommodity(params: {
    symbol: string;
    from: string;
    to: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalChart5MinCommodity(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get 5-minute chart for commodity ${params.symbol}`);
  }

  async getHistoricalChart1HourCommodity(params: {
    symbol: string;
    from: string;
    to: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalChart1HourCommodity(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get 1-hour chart for commodity ${params.symbol}`);
  }

  // ========== DCF (Discounted Cash Flow) ==========

  async getDCFValuation(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getDCFValuation(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get DCF valuation for ${symbol}`);
  }

  async getLeveredDCF(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getLeveredDCF(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get levered DCF for ${symbol}`);
  }

  async getCustomDCFAdvanced(params: {
    symbol: string;
    revenueGrowthPct?: number;
    ebitdaPct?: number;
    depreciationAndAmortizationPct?: number;
    cashAndShortTermInvestmentsPct?: number;
    receivablesPct?: number;
    inventoriesPct?: number;
    payablePct?: number;
    ebitPct?: number;
    capitalExpenditurePct?: number;
    operatingCashFlowPct?: number;
    sellingGeneralAndAdministrativeExpensesPct?: number;
    taxRate?: number;
    longTermGrowthRate?: number;
    costOfDebt?: number;
    costOfEquity?: number;
    marketRiskPremium?: number;
    beta?: number;
    riskFreeRate?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getCustomDCFAdvanced(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get custom DCF advanced for ${params.symbol}`);
  }

  async getCustomDCFLevered(params: {
    symbol: string;
    revenueGrowthPct?: number;
    ebitdaPct?: number;
    depreciationAndAmortizationPct?: number;
    cashAndShortTermInvestmentsPct?: number;
    receivablesPct?: number;
    inventoriesPct?: number;
    payablePct?: number;
    ebitPct?: number;
    capitalExpenditurePct?: number;
    operatingCashFlowPct?: number;
    sellingGeneralAndAdministrativeExpensesPct?: number;
    taxRate?: number;
    longTermGrowthRate?: number;
    costOfDebt?: number;
    costOfEquity?: number;
    marketRiskPremium?: number;
    beta?: number;
    riskFreeRate?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getCustomDCFLevered(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get custom DCF levered for ${params.symbol}`);
  }

  // ========== Crypto ==========

  async getCryptocurrencyList(): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getCryptocurrencyList();
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get cryptocurrency list`);
  }

  async getCryptocurrencyQuote(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getCryptocurrencyQuote(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get cryptocurrency quote for ${symbol}`);
  }

  async getCryptocurrencyQuoteShort(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getCryptocurrencyQuoteShort(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get cryptocurrency quote short for ${symbol}`);
  }
// need subscription
  async getBatchCryptocurrencyQuotes(short: boolean = false): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getBatchCryptocurrencyQuotes(short);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get batch cryptocurrency quotes`);
  }

  async getHistoricalCryptocurrencyPriceLight(params: {
    symbol: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalCryptocurrencyPriceLight(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get light chart for cryptocurrency ${params.symbol}`);
  }

  async getHistoricalCryptocurrencyPriceFull(params: {
    symbol: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalCryptocurrencyPriceFull(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get full chart for cryptocurrency ${params.symbol}`);
  }

  async getHistoricalCryptocurrencyChart5Min(params: {
    symbol: string;
    from: string;
    to: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalCryptocurrencyChart5Min(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get 5-minute chart for cryptocurrency ${params.symbol}`);
  }

  async getHistoricalCryptocurrencyChart1Hour(params: {
    symbol: string;
    from: string;
    to: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalCryptocurrencyChart1Hour(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get 1-hour chart for cryptocurrency ${params.symbol}`);
  }

  // ========== Technical Indicators ==========

  async getSMA(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getSMA(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get SMA for ${params.symbol}`);
  }

  async getEMA(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getEMA(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get EMA for ${params.symbol}`);
  }

  async getWMA(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getWMA(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get WMA for ${params.symbol}`);
  }

  async getDEMA(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getDEMA(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get DEMA for ${params.symbol}`);
  }

  async getTEMA(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getTEMA(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get TEMA for ${params.symbol}`);
  }

  async getRSI(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getRSI(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get RSI for ${params.symbol}`);
  }

  async getStandardDeviation(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getStandardDeviation(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Standard Deviation for ${params.symbol}`);
  }

  async getWilliams(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getWilliams(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Williams for ${params.symbol}`);
  }

  async getADX(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getADX(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get ADX for ${params.symbol}`);
  }

  // ========== ETF & Mutual Funds ==========

  async getETFFundHoldings(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getETFFundHoldings(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get ETF & Fund Holdings for ${symbol}`);
  }

  async getETFMutualFundInfo(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getETFMutualFundInfo(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get ETF & Mutual Fund Information for ${symbol}`);
  }

  async getETFFundCountryAllocation(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getETFFundCountryAllocation(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get ETF & Fund Country Allocation for ${symbol}`);
  }

  async getETFAssetExposure(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getETFAssetExposure(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get ETF Asset Exposure for ${symbol}`);
  }

  async getETFSectorWeighting(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getETFSectorWeighting(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get ETF Sector Weighting for ${symbol}`);
  }

  // ========== Economics ==========

  async getTreasuryRates(params: { from?: string; to?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getTreasuryRates(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Treasury Rates`);
  }

  async getEconomicIndicators(params: {
    name: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getEconomicIndicators(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Economic Indicators for ${params.name}`);
  }

  async getEconomicCalendar(params: { from?: string; to?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getEconomicCalendar(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Economic Calendar`);
  }

  async getMarketRiskPremium(): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getMarketRiskPremium();
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Market Risk Premium`);
  }

  // ========== Earnings, Dividends, Splits ==========

  async getDividendsCompany(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getDividendsCompany(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Dividends for ${symbol}`);
  }

  async getDividendsCalendar(params: { from?: string; to?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getDividendsCalendar(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Dividends Calendar`);
  }

  async getEarningsReport(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getEarningsReport(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Earnings Report for ${symbol}`);
  }

  async getEarningsCalendar(params: { from?: string; to?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getEarningsCalendar(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Earnings Calendar`);
  }

  async getIPOsCalendar(params: { from?: string; to?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getIPOsCalendar(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get IPOs Calendar`);
  }

  async getIPOsDisclosure(params: { from?: string; to?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getIPOsDisclosure(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get IPOs Disclosure`);
  }

  async getIPOsProspectus(params: { from?: string; to?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getIPOsProspectus(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get IPOs Prospectus`);
  }

  async getStockSplitDetails(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getStockSplitDetails(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Stock Split Details for ${symbol}`);
  }

  async getStockSplitsCalendar(params: { from?: string; to?: string }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getStockSplitsCalendar(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Stock Splits Calendar`);
  }

  // ========== Earnings Transcript ==========

  async getLatestEarningTranscripts(): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getLatestEarningTranscripts();
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Latest Earning Transcripts`);
  }

  async getEarningsTranscript(params: {
    symbol: string;
    year: number;
    quarter: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getEarningsTranscript(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Earnings Transcript for ${params.symbol} ${params.year} Q${params.quarter}`);
  }

  async getTranscriptsDatesBySymbol(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getTranscriptsDatesBySymbol(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Transcripts Dates for ${symbol}`);
  }

  async getAvailableTranscriptSymbols(): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getAvailableTranscriptSymbols();
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Available Transcript Symbols`);
  }

  // ========== News ==========

  async getFMPArticles(params: { page?: number; limit?: number }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getFMPArticles(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get FMP Articles`);
  }

  async getGeneralNews(params: { page?: number; limit?: number }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getGeneralNews(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get General News`);
  }
// need subscription
  async getPressReleases(params: { page?: number; limit?: number }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getPressReleases(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Press Releases`);
  }

  async getStockNews(params: { page?: number; limit?: number }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getStockNews(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Stock News`);
  }

  async getCryptoNews(params: { page?: number; limit?: number }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getCryptoNews(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Crypto News`);
  }

  // ========== Financial Estimates ==========

  async getFinancialEstimates(params: {
    symbol: string;
    period: 'annual' | 'quarter';
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getFinancialEstimates(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Financial Estimates for ${params.symbol}`);
  }

  async getRatingsSnapshot(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getRatingsSnapshot(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Ratings Snapshot for ${symbol}`);
  }

  async getHistoricalRatings(params: {
    symbol: string;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalRatings(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Historical Ratings for ${params.symbol}`);
  }

  async getPriceTargetSummary(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getPriceTargetSummary(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Price Target Summary for ${symbol}`);
  }

  async getPriceTargetConsensus(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getPriceTargetConsensus(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Price Target Consensus for ${symbol}`);
  }

  async getStockGrades(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getStockGrades(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Stock Grades for ${symbol}`);
  }

  async getHistoricalStockGrades(params: {
    symbol: string;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalStockGrades(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Historical Stock Grades for ${params.symbol}`);
  }

  async getStockGradesSummary(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getStockGradesSummary(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Stock Grades Summary for ${symbol}`);
  }

  // ========== Market Performance ==========

  async getMarketSectorPerformanceSnapshot(params: {
    date: string;
    exchange?: string;
    sector?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getMarketSectorPerformanceSnapshot(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Market Sector Performance Snapshot`);
  }

  async getIndustryPerformanceSnapshot(params: {
    date: string;
    exchange?: string;
    industry?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getIndustryPerformanceSnapshot(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Industry Performance Snapshot`);
  }

  async getHistoricalMarketSectorPerformance(params: {
    sector: string;
    from?: string;
    to?: string;
    exchange?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalMarketSectorPerformance(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Historical Market Sector Performance`);
  }

  async getHistoricalIndustryPerformance(params: {
    industry: string;
    from?: string;
    to?: string;
    exchange?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalIndustryPerformance(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Historical Industry Performance`);
  }

  async getSectorPESnapshot(params: {
    date: string;
    exchange?: string;
    sector?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getSectorPESnapshot(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Sector PE Snapshot`);
  }

  async getIndustryPESnapshot(params: {
    date: string;
    exchange?: string;
    industry?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getIndustryPESnapshot(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Industry PE Snapshot`);
  }

  async getHistoricalSectorPE(params: {
    sector: string;
    from?: string;
    to?: string;
    exchange?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalSectorPE(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Historical Sector PE`);
  }

  async getHistoricalIndustryPE(params: {
    industry: string;
    from?: string;
    to?: string;
    exchange?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalIndustryPE(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Historical Industry PE`);
  }

  async getBiggestStockGainers(): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getBiggestStockGainers();
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Biggest Stock Gainers`);
  }

  async getBiggestStockLosers(): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getBiggestStockLosers();
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Biggest Stock Losers`);
  }

  async getTopTradedStocks(): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getTopTradedStocks();
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Top Traded Stocks`);
  }

  // ========== Insider Trades ==========

  async getLatestInsiderTrading(params: {
    date?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getLatestInsiderTrading(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Latest Insider Trading`);
  }

  async searchInsiderTrades(params: {
    symbol?: string;
    page?: number;
    limit?: number;
    reportingCik?: string;
    companyCik?: string;
    transactionType?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.searchInsiderTrades(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Search Insider Trades`);
  }

  async searchInsiderTradesByReportingName(name: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.searchInsiderTradesByReportingName(name);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Search Insider Trades by Reporting Name: ${name}`);
  }

  async getAllInsiderTransactionTypes(): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getAllInsiderTransactionTypes();
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get All Insider Transaction Types`);
  }

  async getInsiderTradeStatistics(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getInsiderTradeStatistics(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Insider Trade Statistics for ${symbol}`);
  }

  async getAcquisitionOwnership(params: {
    symbol: string;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getAcquisitionOwnership(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Acquisition Ownership for ${params.symbol}`);
  }

  // ========== Indexes ==========

  async getStockMarketIndexesList(): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getStockMarketIndexesList();
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Stock Market Indexes List`);
  }

  async getIndexQuote(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getIndexQuote(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Index Quote for ${symbol}`);
  }

  async getIndexShortQuote(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getIndexShortQuote(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Index Short Quote for ${symbol}`);
  }

  async getAllIndexQuotes(short: boolean = false): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getAllIndexQuotes(short);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get All Index Quotes`);
  }

  async getHistoricalIndexPriceLight(params: {
    symbol: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalIndexPriceLight(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Light chart for index ${params.symbol}`);
  }

  async getHistoricalIndexPriceFull(params: {
    symbol: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalIndexPriceFull(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Full chart for index ${params.symbol}`);
  }

  async getHistoricalIndexChart1Min(params: {
    symbol: string;
    from: string;
    to: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalIndexChart1Min(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get 1-minute chart for index ${params.symbol}`);
  }

  async getHistoricalIndexChart5Min(params: {
    symbol: string;
    from: string;
    to: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalIndexChart5Min(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get 5-minute chart for index ${params.symbol}`);
  }

  async getHistoricalIndexChart1Hour(params: {
    symbol: string;
    from: string;
    to: string;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalIndexChart1Hour(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get 1-hour chart for index ${params.symbol}`);
  }

  async getSP500Constituent(): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getSP500Constituent();
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get S&P 500 Constituent`);
  }

  async getNasdaqConstituent(): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getNasdaqConstituent();
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Nasdaq Constituent`);
  }

  async getDowJonesConstituent(): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getDowJonesConstituent();
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Dow Jones Constituent`);
  }

  async getHistoricalSP500Constituent(): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalSP500Constituent();
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Historical S&P 500 Constituent`);
  }

  async getHistoricalNasdaqConstituent(): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalNasdaqConstituent();
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Historical Nasdaq Constituent`);
  }

  async getHistoricalDowJonesConstituent(): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHistoricalDowJonesConstituent();
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Historical Dow Jones Constituent`);
  }

  // ========== Senate ==========

  async getLatestSenateFinancialDisclosures(params: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getLatestSenateFinancialDisclosures(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Latest Senate Financial Disclosures`);
  }

  async getLatestHouseFinancialDisclosures(params: {
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getLatestHouseFinancialDisclosures(params);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Latest House Financial Disclosures`);
  }

  async getSenateTradingActivity(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getSenateTradingActivity(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Senate Trading Activity for ${symbol}`);
  }

  async getSenateTradesByName(name: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getSenateTradesByName(name);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Senate Trades by Name: ${name}`);
  }

  async getUSHouseTrades(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getUSHouseTrades(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get U.S. House Trades for ${symbol}`);
  }

  async getHouseTradesByName(name: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getHouseTradesByName(name);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get House Trades by Name: ${name}`);
  }

  // ========== Quote ==========

  async getStockQuote(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getStockQuote(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Stock Quote for ${symbol}`);
  }

  async getStockQuoteShort(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getStockQuoteShort(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Stock Quote Short for ${symbol}`);
  }

  async getAftermarketTrade(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getAftermarketTrade(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Aftermarket Trade for ${symbol}`);
  }

  async getAftermarketQuote(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getAftermarketQuote(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Aftermarket Quote for ${symbol}`);
  }

  async getStockPriceChange(symbol: string): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getStockPriceChange(symbol);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get Stock Price Change for ${symbol}`);
  }
}

