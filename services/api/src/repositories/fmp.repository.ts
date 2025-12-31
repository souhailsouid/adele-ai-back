/**
 * Repository FMP (Financial Modeling Prep)
 * Accès aux données FMP uniquement - pas de logique métier
 */

import { ApiClientService, createFMPClient } from '../services/api-client.service';
import { logger } from '../utils/logger';
import { ExternalApiError, handleError } from '../utils/errors';
import type {
  SymbolSearchResponse,
  SymbolSearchQueryParams,
  NameSearchResponse,
  NameSearchQueryParams,
  CIKSearchResponse,
  CIKSearchQueryParams,
  CUSIPSearchResponse,
  CUSIPSearchQueryParams,
  ISINSearchResponse,
  ISINSearchQueryParams,
  FMPStockScreenerResponse,
  FMPStockScreenerQueryParams,
  ExchangeVariantsResponse,
  ExchangeVariantsQueryParams,
} from '../types/fmp/company-search';

export class FMPRepository {
  private client: ApiClientService;

  constructor() {
    this.client = createFMPClient();
  }

  // ========== Quote & Market Data ==========

  async getQuote(symbol: string): Promise<any> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/quote`, { symbol: symbol.toUpperCase() });
      if (!Array.isArray(response) || response.length === 0) {
        throw new ExternalApiError('FMP', `Quote not found for symbol: ${symbol}`);
      }
      return response[0];
    }, `Get quote for ${symbol}`);
  }

  async getMarketCap(symbol: string): Promise<number> {
    return handleError(async () => {
      const quote = await this.getQuote(symbol);
      return quote.marketCap || 0;
    }, `Get market cap for ${symbol}`);
  }

  // ========== Financial Statements ==========

  async getIncomeStatement(params: {
    symbol: string;
    limit?: number;
    period?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter';
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      if (params.period) queryParams.period = params.period;
      
      const response = await this.client.get<any[]>(`/income-statement`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get income statement for ${params.symbol}`);
  }

  async getIncomeStatementTTM(params: {
    symbol: string;
    limit?: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      
      const response = await this.client.get<any[]>(`/income-statement-ttm`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get income statement TTM for ${params.symbol}`);
  }

  async getBalanceSheetStatement(params: {
    symbol: string;
    limit?: number;
    period?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter';
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      if (params.period) queryParams.period = params.period;
      
      const response = await this.client.get<any[]>(`/balance-sheet-statement`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get balance sheet statement for ${params.symbol}`);
  }

  async getBalanceSheetStatementTTM(params: {
    symbol: string;
    limit?: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      
      const response = await this.client.get<any[]>(`/balance-sheet-statement-ttm`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get balance sheet statement TTM for ${params.symbol}`);
  }

  async getCashFlowStatement(params: {
    symbol: string;
    limit?: number;
    period?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter';
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      if (params.period) queryParams.period = params.period;
      
      const response = await this.client.get<any[]>(`/cash-flow-statement`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get cash flow statement for ${params.symbol}`);
  }
 // need subscription to see this
  async getCashFlowStatementTTM(params: {
    symbol: string;
    limit?: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      
      const response = await this.client.get<any[]>(`/cash-flow-statement-ttm`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get cash flow statement TTM for ${params.symbol}`);
  }

  // need subscription to see this
  async getLatestFinancialStatements(params?: {
    page?: number;
    limit?: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params?.page !== undefined) queryParams.page = String(params.page);
      if (params?.limit !== undefined) queryParams.limit = String(params.limit);
      
      const response = await this.client.get<any[]>(`/latest-financial-statements`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get latest financial statements`);
  }

  async getKeyMetrics(params: {
    symbol: string;
    limit?: number;
    period?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter';
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      if (params.period) queryParams.period = params.period;
      
      const response = await this.client.get<any[]>(`/key-metrics`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get key metrics for ${params.symbol}`);
  }

  async getKeyMetricsTTM(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/key-metrics-ttm`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get key metrics TTM for ${symbol}`);
  }

  async getFinancialRatios(params: {
    symbol: string;
    limit?: number;
    period?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter';
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      if (params.period) queryParams.period = params.period;
      
      const response = await this.client.get<any[]>(`/ratios`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get financial ratios for ${params.symbol}`);
  }

  // ========== Financial Scores ==========

  async getFinancialScores(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/financial-scores`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get financial scores for ${symbol}`);
  }

  // ========== Owner Earnings ==========

  async getOwnerEarnings(params: { symbol: string; limit?: number }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      
      const response = await this.client.get<any[]>(`/owner-earnings`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get owner earnings for ${params.symbol}`);
  }

  // ========== Enterprise Values ==========

  async getEnterpriseValues(params: { symbol: string; limit?: number; period?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      if (params.period) queryParams.period = params.period;
      
      const response = await this.client.get<any[]>(`/enterprise-values`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get enterprise values for ${params.symbol}`);
  }

  // ========== Income Statement Growth ==========

  async getIncomeStatementGrowth(params: { symbol: string; limit?: number; period?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      if (params.period) queryParams.period = params.period;
      
      const response = await this.client.get<any[]>(`/income-statement-growth`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get income statement growth for ${params.symbol}`);
  }

  // ========== Balance Sheet Statement Growth ==========

  async getBalanceSheetStatementGrowth(params: { symbol: string; limit?: number; period?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      if (params.period) queryParams.period = params.period;
      
      const response = await this.client.get<any[]>(`/balance-sheet-statement-growth`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get balance sheet statement growth for ${params.symbol}`);
  }

  // ========== Cashflow Statement Growth ==========

  async getCashflowStatementGrowth(params: { symbol: string; limit?: number; period?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      if (params.period) queryParams.period = params.period;
      
      const response = await this.client.get<any[]>(`/cash-flow-statement-growth`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get cashflow statement growth for ${params.symbol}`);
  }

  // ========== Financial Statement Growth ==========

  async getFinancialStatementGrowth(params: { symbol: string; limit?: number; period?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      if (params.period) queryParams.period = params.period;
      
      const response = await this.client.get<any[]>(`/financial-growth`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get financial statement growth for ${params.symbol}`);
  }

  // ========== Financial Reports Dates ==========

  async getFinancialReportsDates(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/financial-reports-dates`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get financial reports dates for ${symbol}`);
  }

  // ========== Financial Reports Form 10-K JSON ==========

  async getFinancialReportsJSON(params: { symbol: string; year: number; period: string }): Promise<any> {
    return handleError(async () => {
      const response = await this.client.get<any>(`/financial-reports-json`, {
        symbol: params.symbol.toUpperCase(),
        year: String(params.year),
        period: params.period,
      });
      // L'API FMP renvoie un objet JSON complexe, pas un tableau
      return response || {};
    }, `Get financial reports JSON for ${params.symbol} ${params.year} ${params.period}`);
  }

  // ========== Financial Reports Form 10-K XLSX ==========

  async getFinancialReportsXLSX(params: { symbol: string; year: number; period: string }): Promise<any> {
    return handleError(async () => {
      // L'API client détecte automatiquement les fichiers binaires et retourne { data: base64, contentType, format: 'base64' }
      const response = await this.client.get<any>(`/financial-reports-xlsx`, {
        symbol: params.symbol.toUpperCase(),
        year: String(params.year),
        period: params.period,
      });
      // La réponse est déjà formatée par api-client.service.ts comme un objet binaire
      return response || { data: '', contentType: '', format: 'base64' };
    }, `Get financial reports XLSX for ${params.symbol} ${params.year} ${params.period}`);
  }

  // ========== Revenue Product Segmentation ==========

  async getRevenueProductSegmentation(params: { symbol: string; period?: string; structure?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.period) queryParams.period = params.period;
      if (params.structure) queryParams.structure = params.structure;
      
      const response = await this.client.get<any[]>(`/revenue-product-segmentation`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get revenue product segmentation for ${params.symbol}`);
  }

  // ========== Revenue Geographic Segments ==========

  async getRevenueGeographicSegments(params: { symbol: string; period?: string; structure?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.period) queryParams.period = params.period;
      if (params.structure) queryParams.structure = params.structure;
      
      const response = await this.client.get<any[]>(`/revenue-geographic-segmentation`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get revenue geographic segments for ${params.symbol}`);
  }

  // ========== As Reported Income Statements ==========

  async getAsReportedIncomeStatements(params: { symbol: string; limit?: number; period?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      if (params.period) queryParams.period = params.period;
      
      const response = await this.client.get<any[]>(`/income-statement-as-reported`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get as reported income statements for ${params.symbol}`);
  }

  // ========== As Reported Balance Statements ==========

  async getAsReportedBalanceStatements(params: { symbol: string; limit?: number; period?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      if (params.period) queryParams.period = params.period;
      
      const response = await this.client.get<any[]>(`/balance-sheet-statement-as-reported`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get as reported balance statements for ${params.symbol}`);
  }

  // ========== As Reported Cashflow Statements ==========

  async getAsReportedCashflowStatements(params: { symbol: string; limit?: number; period?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      if (params.period) queryParams.period = params.period;
      
      const response = await this.client.get<any[]>(`/cash-flow-statement-as-reported`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get as reported cashflow statements for ${params.symbol}`);
  }

  // ========== As Reported Financial Statements ==========

  async getAsReportedFinancialStatements(params: { symbol: string; limit?: number; period?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      if (params.period) queryParams.period = params.period;
      
      const response = await this.client.get<any[]>(`/financial-statement-full-as-reported`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get as reported financial statements for ${params.symbol}`);
  }

  // ========== SEC Filings ==========

  async getLatest8KFilings(params: {
    from: string;
    to: string;
    page?: number;
    limit?: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        from: params.from,
        to: params.to,
      };
      if (params.page !== undefined) queryParams.page = String(params.page);
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      
      const response = await this.client.get<any[]>(`/sec-filings-8k`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get latest 8-K SEC filings`);
  }

  async getLatestSECFilings(params: {
    from: string;
    to: string;
    page?: number;
    limit?: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        from: params.from,
        to: params.to,
      };
      if (params.page !== undefined) queryParams.page = String(params.page);
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      
      const response = await this.client.get<any[]>(`/sec-filings-financials`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get latest SEC filings with financials`);
  }

  async getSECFilingsByFormType(params: {
    formType: string;
    from: string;
    to: string;
    page?: number;
    limit?: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        formType: params.formType,
        from: params.from,
        to: params.to,
      };
      if (params.page !== undefined) queryParams.page = String(params.page);
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      
      const response = await this.client.get<any[]>(`/sec-filings-search/form-type`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get SEC filings by form type: ${params.formType}`);
  }

  async getSECFilingsBySymbol(params: {
    symbol: string;
    from: string;
    to: string;
    page?: number;
    limit?: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
        from: params.from,
        to: params.to,
      };
      if (params.page !== undefined) queryParams.page = String(params.page);
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      
      const response = await this.client.get<any[]>(`/sec-filings-search/symbol`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get SEC filings for symbol: ${params.symbol}`);
  }

  async getSECFilingsByCIK(params: {
    cik: string;
    from: string;
    to: string;
    page?: number;
    limit?: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        cik: params.cik,
        from: params.from,
        to: params.to,
      };
      if (params.page !== undefined) queryParams.page = String(params.page);
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      
      const response = await this.client.get<any[]>(`/sec-filings-search/cik`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get SEC filings for CIK: ${params.cik}`);
  }

  async searchSECFilingsByName(company: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/sec-filings-company-search/name`, {
        company,
      });
      return Array.isArray(response) ? response : [];
    }, `Search SEC filings by company name: ${company}`);
  }

  async searchSECCompanyBySymbol(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/sec-filings-company-search/symbol`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Search SEC company by symbol: ${symbol}`);
  }

  async searchSECCompanyByCIK(cik: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/sec-filings-company-search/cik`, {
        cik,
      });
      return Array.isArray(response) ? response : [];
    }, `Search SEC company by CIK: ${cik}`);
  }

  async getSECCompanyFullProfile(params: {
    symbol: string;
    cik?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.cik) queryParams.cik = params.cik;
      
      const response = await this.client.get<any[]>(`/sec-profile`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get SEC company full profile for: ${params.symbol}`);
  }

  async getIndustryClassificationList(params?: {
    industryTitle?: string;
    sicCode?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params?.industryTitle) queryParams.industryTitle = params.industryTitle;
      if (params?.sicCode) queryParams.sicCode = params.sicCode;
      
      const response = await this.client.get<any[]>(`/standard-industrial-classification-list`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get industry classification list`);
  }

  async searchIndustryClassification(params?: {
    symbol?: string;
    cik?: string;
    sicCode?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params?.symbol) queryParams.symbol = params.symbol.toUpperCase();
      if (params?.cik) queryParams.cik = params.cik;
      if (params?.sicCode) queryParams.sicCode = params.sicCode;
      
      const response = await this.client.get<any[]>(`/industry-classification-search`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Search industry classification`);
  }

  async getAllIndustryClassification(params?: {
    page?: number;
    limit?: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params?.page !== undefined) queryParams.page = String(params.page);
      if (params?.limit !== undefined) queryParams.limit = String(params.limit);
      
      const response = await this.client.get<any[]>(`/all-industry-classification`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get all industry classification`);
  }

  // ========== Company Search ==========

  async searchSymbol(params: SymbolSearchQueryParams): Promise<SymbolSearchResponse> {
    return handleError(async () => {
      const response = await this.client.get<SymbolSearchResponse>('/search-symbol', {
        query: params.query,
        ...(params.limit && { limit: String(params.limit) }),
        ...(params.exchange && { exchange: params.exchange }),
      });
      return Array.isArray(response) ? response : [];
    }, `Search symbol: ${params.query}`);
  }

  async searchName(params: NameSearchQueryParams): Promise<NameSearchResponse> {
    return handleError(async () => {
      const response = await this.client.get<NameSearchResponse>('/search-name', {
        query: params.query,
        ...(params.limit && { limit: String(params.limit) }),
        ...(params.exchange && { exchange: params.exchange }),
      });
      return Array.isArray(response) ? response : [];
    }, `Search name: ${params.query}`);
  }

  async searchCIK(params: CIKSearchQueryParams): Promise<CIKSearchResponse> {
    return handleError(async () => {
      const response = await this.client.get<CIKSearchResponse>('/search-cik', {
        cik: params.cik,
        ...(params.limit && { limit: String(params.limit) }),
      });
      return Array.isArray(response) ? response : [];
    }, `Search CIK: ${params.cik}`);
  }

  async searchCUSIP(params: CUSIPSearchQueryParams): Promise<CUSIPSearchResponse> {
    return handleError(async () => {
      const response = await this.client.get<CUSIPSearchResponse>('/search-cusip', {
        cusip: params.cusip,
      });
      return Array.isArray(response) ? response : [];
    }, `Search CUSIP: ${params.cusip}`);
  }

  async searchISIN(params: ISINSearchQueryParams): Promise<ISINSearchResponse> {
    return handleError(async () => {
      const response = await this.client.get<ISINSearchResponse>('/search-isin', {
        isin: params.isin,
      });
      return Array.isArray(response) ? response : [];
    }, `Search ISIN: ${params.isin}`);
  }

  async stockScreener(params?: FMPStockScreenerQueryParams): Promise<FMPStockScreenerResponse> {
    return handleError(async () => {
      const queryParams: Record<string, string | number> = {};
      
      if (params) {
        if (params.marketCapMoreThan !== undefined) queryParams.marketCapMoreThan = params.marketCapMoreThan;
        if (params.marketCapLowerThan !== undefined) queryParams.marketCapLowerThan = params.marketCapLowerThan;
        if (params.sector) queryParams.sector = params.sector;
        if (params.industry) queryParams.industry = params.industry;
        if (params.betaMoreThan !== undefined) queryParams.betaMoreThan = params.betaMoreThan;
        if (params.betaLowerThan !== undefined) queryParams.betaLowerThan = params.betaLowerThan;
        if (params.priceMoreThan !== undefined) queryParams.priceMoreThan = params.priceMoreThan;
        if (params.priceLowerThan !== undefined) queryParams.priceLowerThan = params.priceLowerThan;
        if (params.dividendMoreThan !== undefined) queryParams.dividendMoreThan = params.dividendMoreThan;
        if (params.dividendLowerThan !== undefined) queryParams.dividendLowerThan = params.dividendLowerThan;
        if (params.volumeMoreThan !== undefined) queryParams.volumeMoreThan = params.volumeMoreThan;
        if (params.volumeLowerThan !== undefined) queryParams.volumeLowerThan = params.volumeLowerThan;
        if (params.exchange) queryParams.exchange = params.exchange;
        if (params.country) queryParams.country = params.country;
        if (params.isEtf !== undefined) queryParams.isEtf = String(params.isEtf);
        if (params.isFund !== undefined) queryParams.isFund = String(params.isFund);
        if (params.isActivelyTrading !== undefined) queryParams.isActivelyTrading = String(params.isActivelyTrading);
        if (params.limit !== undefined) queryParams.limit = params.limit;
        if (params.includeAllShareClasses !== undefined) queryParams.includeAllShareClasses = String(params.includeAllShareClasses);
      }

      const response = await this.client.get<FMPStockScreenerResponse>('/company-screener', queryParams);
      return Array.isArray(response) ? response : [];
    }, 'Stock screener');
  }

  async searchExchangeVariants(params: ExchangeVariantsQueryParams): Promise<ExchangeVariantsResponse> {
    return handleError(async () => {
      const response = await this.client.get<ExchangeVariantsResponse>('/search-exchange-variants', {
        symbol: params.symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Search exchange variants for ${params.symbol}`);
  }

  // ========== Market Hours ==========

  async getExchangeMarketHours(exchange: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/exchange-market-hours`, {
        exchange: exchange.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get exchange market hours for ${exchange}`);
  }

  async getHolidaysByExchange(exchange: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/holidays-by-exchange`, {
        exchange: exchange.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get holidays by exchange for ${exchange}`);
  }

  async getAllExchangeMarketHours(): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/all-exchange-market-hours`);
      return Array.isArray(response) ? response : [];
    }, `Get all exchange market hours`);
  }

  // ========== Commodity ==========

  async getCommoditiesList(): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/commodities-list`);
      return Array.isArray(response) ? response : [];
    }, `Get commodities list`);
  }

  async getCommoditiesQuote(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/quote`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get commodities quote for ${symbol}`);
  }

  async getCommoditiesQuoteShort(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/quote-short`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get commodities quote short for ${symbol}`);
  }

  // need
  async getBatchCommodityQuotes(short: boolean = false): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (short) queryParams.short = 'true';
      const response = await this.client.get<any[]>(`/batch-commodity-quotes`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get batch commodity quotes`);
  }

  async getHistoricalPriceEODLightCommodity(params: {
    symbol: string;
    from?: string;
    to?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/historical-price-eod/light`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get light chart for commodity ${params.symbol}`);
  }

  async getHistoricalPriceEODFullCommodity(params: {
    symbol: string;
    from?: string;
    to?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/historical-price-eod/full`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get full chart for commodity ${params.symbol}`);
  }
// need subscription
  async getHistoricalChart1MinCommodity(params: {
    symbol: string;
    from: string;
    to: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/historical-chart/1min`, {
        symbol: params.symbol.toUpperCase(),
        from: params.from,
        to: params.to,
      });
      return Array.isArray(response) ? response : [];
    }, `Get 1-minute chart for commodity ${params.symbol}`);
  }

  async getHistoricalChart5MinCommodity(params: {
    symbol: string;
    from: string;
    to: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/historical-chart/5min`, {
        symbol: params.symbol.toUpperCase(),
        from: params.from,
        to: params.to,
      });
      return Array.isArray(response) ? response : [];
    }, `Get 5-minute chart for commodity ${params.symbol}`);
  }

  async getHistoricalChart1HourCommodity(params: {
    symbol: string;
    from: string;
    to: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/historical-chart/1hour`, {
        symbol: params.symbol.toUpperCase(),
        from: params.from,
        to: params.to,
      });
      return Array.isArray(response) ? response : [];
    }, `Get 1-hour chart for commodity ${params.symbol}`);
  }

  async getLightChart(params: { symbol: string; from?: string; to?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      
      const response: any = await this.client.get<any>(`/historical-price-eod/light`, queryParams);
      if (Array.isArray(response)) return response;
      if (response && typeof response === 'object' && Array.isArray(response.historical)) return response.historical;
      return [];
    }, `Get light chart for ${params.symbol}`);
  }

  async getFullChart(params: { symbol: string; from?: string; to?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      
      const response: any = await this.client.get<any>(`/historical-price-eod/full`, queryParams);
      if (Array.isArray(response)) return response;
      if (response && typeof response === 'object' && Array.isArray(response.historical)) return response.historical;
      return [];
    }, `Get full chart for ${params.symbol}`);
  }

  async getOneMinuteChart(params: { symbol: string; from: string; to: string }): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/historical-chart/1min`, {
        symbol: params.symbol.toUpperCase(),
        from: params.from,
        to: params.to,
      });
      return Array.isArray(response) ? response : [];
    }, `Get 1-minute chart for ${params.symbol}`);
  }

  async getFiveMinuteChart(params: { symbol: string; from: string; to: string }): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/historical-chart/5min`, {
        symbol: params.symbol.toUpperCase(),
        from: params.from,
        to: params.to,
      });
      return Array.isArray(response) ? response : [];
    }, `Get 5-minute chart for ${params.symbol}`);
  }

  async getOneHourChart(params: { symbol: string; from: string; to: string }): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/historical-chart/1hour`, {
        symbol: params.symbol.toUpperCase(),
        from: params.from,
        to: params.to,
      });
      return Array.isArray(response) ? response : [];
    }, `Get 1-hour chart for ${params.symbol}`);
  }

  // ========== DCF (Discounted Cash Flow) ==========

  async getDCFValuation(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/discounted-cash-flow`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get DCF valuation for ${symbol}`);
  }

  async getLeveredDCF(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/levered-discounted-cash-flow`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
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
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.revenueGrowthPct !== undefined) queryParams.revenueGrowthPct = String(params.revenueGrowthPct);
      if (params.ebitdaPct !== undefined) queryParams.ebitdaPct = String(params.ebitdaPct);
      if (params.depreciationAndAmortizationPct !== undefined) queryParams.depreciationAndAmortizationPct = String(params.depreciationAndAmortizationPct);
      if (params.cashAndShortTermInvestmentsPct !== undefined) queryParams.cashAndShortTermInvestmentsPct = String(params.cashAndShortTermInvestmentsPct);
      if (params.receivablesPct !== undefined) queryParams.receivablesPct = String(params.receivablesPct);
      if (params.inventoriesPct !== undefined) queryParams.inventoriesPct = String(params.inventoriesPct);
      if (params.payablePct !== undefined) queryParams.payablePct = String(params.payablePct);
      if (params.ebitPct !== undefined) queryParams.ebitPct = String(params.ebitPct);
      if (params.capitalExpenditurePct !== undefined) queryParams.capitalExpenditurePct = String(params.capitalExpenditurePct);
      if (params.operatingCashFlowPct !== undefined) queryParams.operatingCashFlowPct = String(params.operatingCashFlowPct);
      if (params.sellingGeneralAndAdministrativeExpensesPct !== undefined) queryParams.sellingGeneralAndAdministrativeExpensesPct = String(params.sellingGeneralAndAdministrativeExpensesPct);
      if (params.taxRate !== undefined) queryParams.taxRate = String(params.taxRate);
      if (params.longTermGrowthRate !== undefined) queryParams.longTermGrowthRate = String(params.longTermGrowthRate);
      if (params.costOfDebt !== undefined) queryParams.costOfDebt = String(params.costOfDebt);
      if (params.costOfEquity !== undefined) queryParams.costOfEquity = String(params.costOfEquity);
      if (params.marketRiskPremium !== undefined) queryParams.marketRiskPremium = String(params.marketRiskPremium);
      if (params.beta !== undefined) queryParams.beta = String(params.beta);
      if (params.riskFreeRate !== undefined) queryParams.riskFreeRate = String(params.riskFreeRate);
      const response = await this.client.get<any[]>(`/custom-discounted-cash-flow`, queryParams);
      return Array.isArray(response) ? response : [];
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
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.revenueGrowthPct !== undefined) queryParams.revenueGrowthPct = String(params.revenueGrowthPct);
      if (params.ebitdaPct !== undefined) queryParams.ebitdaPct = String(params.ebitdaPct);
      if (params.depreciationAndAmortizationPct !== undefined) queryParams.depreciationAndAmortizationPct = String(params.depreciationAndAmortizationPct);
      if (params.cashAndShortTermInvestmentsPct !== undefined) queryParams.cashAndShortTermInvestmentsPct = String(params.cashAndShortTermInvestmentsPct);
      if (params.receivablesPct !== undefined) queryParams.receivablesPct = String(params.receivablesPct);
      if (params.inventoriesPct !== undefined) queryParams.inventoriesPct = String(params.inventoriesPct);
      if (params.payablePct !== undefined) queryParams.payablePct = String(params.payablePct);
      if (params.ebitPct !== undefined) queryParams.ebitPct = String(params.ebitPct);
      if (params.capitalExpenditurePct !== undefined) queryParams.capitalExpenditurePct = String(params.capitalExpenditurePct);
      if (params.operatingCashFlowPct !== undefined) queryParams.operatingCashFlowPct = String(params.operatingCashFlowPct);
      if (params.sellingGeneralAndAdministrativeExpensesPct !== undefined) queryParams.sellingGeneralAndAdministrativeExpensesPct = String(params.sellingGeneralAndAdministrativeExpensesPct);
      if (params.taxRate !== undefined) queryParams.taxRate = String(params.taxRate);
      if (params.longTermGrowthRate !== undefined) queryParams.longTermGrowthRate = String(params.longTermGrowthRate);
      if (params.costOfDebt !== undefined) queryParams.costOfDebt = String(params.costOfDebt);
      if (params.costOfEquity !== undefined) queryParams.costOfEquity = String(params.costOfEquity);
      if (params.marketRiskPremium !== undefined) queryParams.marketRiskPremium = String(params.marketRiskPremium);
      if (params.beta !== undefined) queryParams.beta = String(params.beta);
      if (params.riskFreeRate !== undefined) queryParams.riskFreeRate = String(params.riskFreeRate);
      const response = await this.client.get<any[]>(`/custom-levered-discounted-cash-flow`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get custom DCF levered for ${params.symbol}`);
  }

  // ========== Crypto ==========

  async getCryptocurrencyList(): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/cryptocurrency-list`);
      return Array.isArray(response) ? response : [];
    }, `Get cryptocurrency list`);
  }

  async getCryptocurrencyQuote(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/quote`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get cryptocurrency quote for ${symbol}`);
  }

  async getCryptocurrencyQuoteShort(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/quote-short`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get cryptocurrency quote short for ${symbol}`);
  }

  async getBatchCryptocurrencyQuotes(short: boolean = false): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (short) queryParams.short = 'true';
      const response = await this.client.get<any[]>(`/batch-crypto-quotes`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get batch cryptocurrency quotes`);
  }

  async getHistoricalCryptocurrencyPriceLight(params: {
    symbol: string;
    from?: string;
    to?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/historical-price-eod/light`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get light chart for cryptocurrency ${params.symbol}`);
  }

  async getHistoricalCryptocurrencyPriceFull(params: {
    symbol: string;
    from?: string;
    to?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/historical-price-eod/full`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get full chart for cryptocurrency ${params.symbol}`);
  }

  async getHistoricalCryptocurrencyChart5Min(params: {
    symbol: string;
    from: string;
    to: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/historical-chart/5min`, {
        symbol: params.symbol.toUpperCase(),
        from: params.from,
        to: params.to,
      });
      return Array.isArray(response) ? response : [];
    }, `Get 5-minute chart for cryptocurrency ${params.symbol}`);
  }

  async getHistoricalCryptocurrencyChart1Hour(params: {
    symbol: string;
    from: string;
    to: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/historical-chart/1hour`, {
        symbol: params.symbol.toUpperCase(),
        from: params.from,
        to: params.to,
      });
      return Array.isArray(response) ? response : [];
    }, `Get 1-hour chart for cryptocurrency ${params.symbol}`);
  }

  // ========== Technical Indicators ==========

  async getSMA(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
        periodLength: String(params.periodLength),
        timeframe: params.timeframe,
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/technical-indicators/sma`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get SMA for ${params.symbol}`);
  }

  async getEMA(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
        periodLength: String(params.periodLength),
        timeframe: params.timeframe,
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/technical-indicators/ema`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get EMA for ${params.symbol}`);
  }

  async getWMA(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
        periodLength: String(params.periodLength),
        timeframe: params.timeframe,
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/technical-indicators/wma`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get WMA for ${params.symbol}`);
  }

  async getDEMA(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
        periodLength: String(params.periodLength),
        timeframe: params.timeframe,
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/technical-indicators/dema`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get DEMA for ${params.symbol}`);
  }

  async getTEMA(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
        periodLength: String(params.periodLength),
        timeframe: params.timeframe,
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/technical-indicators/tema`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get TEMA for ${params.symbol}`);
  }

  async getRSI(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
        periodLength: String(params.periodLength),
        timeframe: params.timeframe,
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/technical-indicators/rsi`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get RSI for ${params.symbol}`);
  }

  async getStandardDeviation(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
        periodLength: String(params.periodLength),
        timeframe: params.timeframe,
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/technical-indicators/standarddeviation`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Standard Deviation for ${params.symbol}`);
  }

  async getWilliams(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
        periodLength: String(params.periodLength),
        timeframe: params.timeframe,
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/technical-indicators/williams`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Williams for ${params.symbol}`);
  }

  async getADX(params: {
    symbol: string;
    periodLength: number;
    timeframe: string;
    from?: string;
    to?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
        periodLength: String(params.periodLength),
        timeframe: params.timeframe,
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/technical-indicators/adx`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get ADX for ${params.symbol}`);
  }

  // ========== ETF & Mutual Funds ==========

  async getETFFundHoldings(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/etf/holdings`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get ETF & Fund Holdings for ${symbol}`);
  }

  async getETFMutualFundInfo(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/etf/info`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get ETF & Mutual Fund Information for ${symbol}`);
  }

  async getETFFundCountryAllocation(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/etf/country-weightings`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get ETF & Fund Country Allocation for ${symbol}`);
  }

  async getETFAssetExposure(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/etf/asset-exposure`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get ETF Asset Exposure for ${symbol}`);
  }

  async getETFSectorWeighting(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/etf/sector-weightings`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get ETF Sector Weighting for ${symbol}`);
  }

  // ========== Economics ==========

  async getTreasuryRates(params: { from?: string; to?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/treasury-rates`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Treasury Rates`);
  }

  async getEconomicIndicators(params: {
    name: string;
    from?: string;
    to?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        name: params.name,
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/economic-indicators`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Economic Indicators for ${params.name}`);
  }

  async getEconomicCalendar(params: { from?: string; to?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/economic-calendar`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Economic Calendar`);
  }

  async getMarketRiskPremium(): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/market-risk-premium`);
      return Array.isArray(response) ? response : [];
    }, `Get Market Risk Premium`);
  }

  // ========== Earnings, Dividends, Splits ==========

  async getDividendsCompany(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/dividends`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Dividends for ${symbol}`);
  }

  async getDividendsCalendar(params: { from?: string; to?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/dividends-calendar`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Dividends Calendar`);
  }

  async getEarningsReport(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/earnings`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Earnings Report for ${symbol}`);
  }

  async getEarningsCalendar(params: { from?: string; to?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/earnings-calendar`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Earnings Calendar`);
  }

  async getIPOsCalendar(params: { from?: string; to?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/ipos-calendar`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get IPOs Calendar`);
  }

  async getIPOsDisclosure(params: { from?: string; to?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/ipos-disclosure`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get IPOs Disclosure`);
  }

  async getIPOsProspectus(params: { from?: string; to?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/ipos-prospectus`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get IPOs Prospectus`);
  }

  async getStockSplitDetails(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/splits`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Stock Split Details for ${symbol}`);
  }

  async getStockSplitsCalendar(params: { from?: string; to?: string }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/splits-calendar`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Stock Splits Calendar`);
  }

  // ========== Earnings Transcript ==========

  async getLatestEarningTranscripts(): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/earning-call-transcript-latest`);
      return Array.isArray(response) ? response : [];
    }, `Get Latest Earning Transcripts`);
  }

  async getEarningsTranscript(params: {
    symbol: string;
    year: number;
    quarter: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/earning-call-transcript`, {
        symbol: params.symbol.toUpperCase(),
        year: String(params.year),
        quarter: String(params.quarter),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Earnings Transcript for ${params.symbol} ${params.year} Q${params.quarter}`);
  }

  async getTranscriptsDatesBySymbol(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/earning-call-transcript-dates`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Transcripts Dates for ${symbol}`);
  }

  async getAvailableTranscriptSymbols(): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/earnings-transcript-list`);
      return Array.isArray(response) ? response : [];
    }, `Get Available Transcript Symbols`);
  }

  // ========== News ==========

  async getFMPArticles(params: { page?: number; limit?: number }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params.page !== undefined) queryParams.page = String(params.page);
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      const response = await this.client.get<any[]>(`/fmp-articles`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get FMP Articles`);
  }

  async getGeneralNews(params: { page?: number; limit?: number }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params.page !== undefined) queryParams.page = String(params.page);
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      const response = await this.client.get<any[]>(`/news/general-latest`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get General News`);
  }

  async getPressReleases(params: { page?: number; limit?: number }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params.page !== undefined) queryParams.page = String(params.page);
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      const response = await this.client.get<any[]>(`/news/press-releases-latest`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Press Releases`);
  }

  async getStockNews(params: { page?: number; limit?: number }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params.page !== undefined) queryParams.page = String(params.page);
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      const response = await this.client.get<any[]>(`/news/stock-latest`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Stock News`);
  }

  async getCryptoNews(params: { page?: number; limit?: number }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params.page !== undefined) queryParams.page = String(params.page);
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      const response = await this.client.get<any[]>(`/news/crypto-latest`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Crypto News`);
  }

  // ========== Financial Estimates ==========

  async getFinancialEstimates(params: {
    symbol: string;
    period: 'annual' | 'quarter';
    page?: number;
    limit?: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
        period: params.period,
      };
      if (params.page !== undefined) queryParams.page = String(params.page);
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      const response = await this.client.get<any[]>(`/analyst-estimates`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Financial Estimates for ${params.symbol}`);
  }

  async getRatingsSnapshot(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/ratings-snapshot`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Ratings Snapshot for ${symbol}`);
  }

  async getHistoricalRatings(params: {
    symbol: string;
    limit?: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      const response = await this.client.get<any[]>(`/ratings-historical`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Historical Ratings for ${params.symbol}`);
  }

  async getPriceTargetSummary(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/price-target-summary`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Price Target Summary for ${symbol}`);
  }

  async getPriceTargetConsensus(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/price-target-consensus`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Price Target Consensus for ${symbol}`);
  }

  async getStockGrades(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/grades`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Stock Grades for ${symbol}`);
  }

  async getHistoricalStockGrades(params: {
    symbol: string;
    limit?: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      const response = await this.client.get<any[]>(`/grades-historical`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Historical Stock Grades for ${params.symbol}`);
  }

  async getStockGradesSummary(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/grades-consensus`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Stock Grades Summary for ${symbol}`);
  }

  // ========== Market Performance ==========

  async getMarketSectorPerformanceSnapshot(params: {
    date: string;
    exchange?: string;
    sector?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        date: params.date,
      };
      if (params.exchange) queryParams.exchange = params.exchange;
      if (params.sector) queryParams.sector = params.sector;
      const response = await this.client.get<any[]>(`/sector-performance-snapshot`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Market Sector Performance Snapshot`);
  }

  async getIndustryPerformanceSnapshot(params: {
    date: string;
    exchange?: string;
    industry?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        date: params.date,
      };
      if (params.exchange) queryParams.exchange = params.exchange;
      if (params.industry) queryParams.industry = params.industry;
      const response = await this.client.get<any[]>(`/industry-performance-snapshot`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Industry Performance Snapshot`);
  }

  async getHistoricalMarketSectorPerformance(params: {
    sector: string;
    from?: string;
    to?: string;
    exchange?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        sector: params.sector,
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      if (params.exchange) queryParams.exchange = params.exchange;
      const response = await this.client.get<any[]>(`/historical-sector-performance`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Historical Market Sector Performance`);
  }

  async getHistoricalIndustryPerformance(params: {
    industry: string;
    from?: string;
    to?: string;
    exchange?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        industry: params.industry,
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      if (params.exchange) queryParams.exchange = params.exchange;
      const response = await this.client.get<any[]>(`/historical-industry-performance`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Historical Industry Performance`);
  }

  async getSectorPESnapshot(params: {
    date: string;
    exchange?: string;
    sector?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        date: params.date,
      };
      if (params.exchange) queryParams.exchange = params.exchange;
      if (params.sector) queryParams.sector = params.sector;
      const response = await this.client.get<any[]>(`/sector-pe-snapshot`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Sector PE Snapshot`);
  }

  async getIndustryPESnapshot(params: {
    date: string;
    exchange?: string;
    industry?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        date: params.date,
      };
      if (params.exchange) queryParams.exchange = params.exchange;
      if (params.industry) queryParams.industry = params.industry;
      const response = await this.client.get<any[]>(`/industry-pe-snapshot`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Industry PE Snapshot`);
  }

  async getHistoricalSectorPE(params: {
    sector: string;
    from?: string;
    to?: string;
    exchange?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        sector: params.sector,
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      if (params.exchange) queryParams.exchange = params.exchange;
      const response = await this.client.get<any[]>(`/historical-sector-pe`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Historical Sector PE`);
  }

  async getHistoricalIndustryPE(params: {
    industry: string;
    from?: string;
    to?: string;
    exchange?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        industry: params.industry,
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      if (params.exchange) queryParams.exchange = params.exchange;
      const response = await this.client.get<any[]>(`/historical-industry-pe`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Historical Industry PE`);
  }

  async getBiggestStockGainers(): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/biggest-gainers`);
      return Array.isArray(response) ? response : [];
    }, `Get Biggest Stock Gainers`);
  }

  async getBiggestStockLosers(): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/biggest-losers`);
      return Array.isArray(response) ? response : [];
    }, `Get Biggest Stock Losers`);
  }

  async getTopTradedStocks(): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/most-actives`);
      return Array.isArray(response) ? response : [];
    }, `Get Top Traded Stocks`);
  }

  // ========== Insider Trades ==========

  async getLatestInsiderTrading(params: {
    date?: string;
    page?: number;
    limit?: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params.date) queryParams.date = params.date;
      if (params.page !== undefined) queryParams.page = String(params.page);
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      const response = await this.client.get<any[]>(`/insider-trading/latest`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Latest Insider Trading`);
  }

  async searchInsiderTrades(params: {
    symbol?: string;
    page?: number;
    limit?: number;
    reportingCik?: string;
    companyCik?: string;
    transactionType?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params.symbol) queryParams.symbol = params.symbol.toUpperCase();
      if (params.page !== undefined) queryParams.page = String(params.page);
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      if (params.reportingCik) queryParams.reportingCik = params.reportingCik;
      if (params.companyCik) queryParams.companyCik = params.companyCik;
      if (params.transactionType) queryParams.transactionType = params.transactionType;
      const response = await this.client.get<any[]>(`/insider-trading/search`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Search Insider Trades`);
  }

  async searchInsiderTradesByReportingName(name: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/insider-trading/reporting-name`, {
        name,
      });
      return Array.isArray(response) ? response : [];
    }, `Search Insider Trades by Reporting Name: ${name}`);
  }

  async getAllInsiderTransactionTypes(): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/insider-trading-transaction-type`);
      return Array.isArray(response) ? response : [];
    }, `Get All Insider Transaction Types`);
  }

  async getInsiderTradeStatistics(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/insider-trading/statistics`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Insider Trade Statistics for ${symbol}`);
  }

  async getAcquisitionOwnership(params: {
    symbol: string;
    limit?: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      const response = await this.client.get<any[]>(`/acquisition-of-beneficial-ownership`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Acquisition Ownership for ${params.symbol}`);
  }

  // ========== Indexes ==========

  async getStockMarketIndexesList(): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/index-list`);
      return Array.isArray(response) ? response : [];
    }, `Get Stock Market Indexes List`);
  }

  async getIndexQuote(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/quote`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Index Quote for ${symbol}`);
  }

  async getIndexShortQuote(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/quote-short`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Index Short Quote for ${symbol}`);
  }

  async getAllIndexQuotes(short: boolean = false): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (short) queryParams.short = 'true';
      const response = await this.client.get<any[]>(`/batch-index-quotes`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get All Index Quotes`);
  }

  async getHistoricalIndexPriceLight(params: {
    symbol: string;
    from?: string;
    to?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/historical-price-eod/light`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Light chart for index ${params.symbol}`);
  }

  async getHistoricalIndexPriceFull(params: {
    symbol: string;
    from?: string;
    to?: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {
        symbol: params.symbol.toUpperCase(),
      };
      if (params.from) queryParams.from = params.from;
      if (params.to) queryParams.to = params.to;
      const response = await this.client.get<any[]>(`/historical-price-eod/full`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Full chart for index ${params.symbol}`);
  }

  async getHistoricalIndexChart1Min(params: {
    symbol: string;
    from: string;
    to: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/historical-chart/1min`, {
        symbol: params.symbol.toUpperCase(),
        from: params.from,
        to: params.to,
      });
      return Array.isArray(response) ? response : [];
    }, `Get 1-minute chart for index ${params.symbol}`);
  }

  async getHistoricalIndexChart5Min(params: {
    symbol: string;
    from: string;
    to: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/historical-chart/5min`, {
        symbol: params.symbol.toUpperCase(),
        from: params.from,
        to: params.to,
      });
      return Array.isArray(response) ? response : [];
    }, `Get 5-minute chart for index ${params.symbol}`);
  }

  async getHistoricalIndexChart1Hour(params: {
    symbol: string;
    from: string;
    to: string;
  }): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/historical-chart/1hour`, {
        symbol: params.symbol.toUpperCase(),
        from: params.from,
        to: params.to,
      });
      return Array.isArray(response) ? response : [];
    }, `Get 1-hour chart for index ${params.symbol}`);
  }
  // need subscription
  async getSP500Constituent(): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/sp500-constituent`);
      return Array.isArray(response) ? response : [];
    }, `Get S&P 500 Constituent`);
  }

  async getNasdaqConstituent(): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/nasdaq-constituent`);
      return Array.isArray(response) ? response : [];
    }, `Get Nasdaq Constituent`);
  }

  async getDowJonesConstituent(): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/dowjones-constituent`);
      return Array.isArray(response) ? response : [];
    }, `Get Dow Jones Constituent`);
  }

  // need subscription
  async getHistoricalSP500Constituent(): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/historical-sp500-constituent`);
      return Array.isArray(response) ? response : [];
    }, `Get Historical S&P 500 Constituent`);
  }

  async getHistoricalNasdaqConstituent(): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/historical-nasdaq-constituent`);
      return Array.isArray(response) ? response : [];
    }, `Get Historical Nasdaq Constituent`);
  }

  async getHistoricalDowJonesConstituent(): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/historical-dowjones-constituent`);
      return Array.isArray(response) ? response : [];
    }, `Get Historical Dow Jones Constituent`);
  }

  // ========== Senate ==========

  async getLatestSenateFinancialDisclosures(params: {
    page?: number;
    limit?: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params.page !== undefined) queryParams.page = String(params.page);
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      const response = await this.client.get<any[]>(`/senate-latest`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Latest Senate Financial Disclosures`);
  }

  async getLatestHouseFinancialDisclosures(params: {
    page?: number;
    limit?: number;
  }): Promise<any[]> {
    return handleError(async () => {
      const queryParams: Record<string, string> = {};
      if (params.page !== undefined) queryParams.page = String(params.page);
      if (params.limit !== undefined) queryParams.limit = String(params.limit);
      const response = await this.client.get<any[]>(`/house-latest`, queryParams);
      return Array.isArray(response) ? response : [];
    }, `Get Latest House Financial Disclosures`);
  }

  async getSenateTradingActivity(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/senate-trades`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Senate Trading Activity for ${symbol}`);
  }

  async getSenateTradesByName(name: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/senate-trades-by-name`, {
        name,
      });
      return Array.isArray(response) ? response : [];
    }, `Get Senate Trades by Name: ${name}`);
  }

  async getUSHouseTrades(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/house-trades`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get U.S. House Trades for ${symbol}`);
  }

  async getHouseTradesByName(name: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/house-trades-by-name`, {
        name,
      });
      return Array.isArray(response) ? response : [];
    }, `Get House Trades by Name: ${name}`);
  }

  // ========== Quote ==========

  async getStockQuote(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/quote`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Stock Quote for ${symbol}`);
  }

  async getStockQuoteShort(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/quote-short`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Stock Quote Short for ${symbol}`);
  }

  async getAftermarketTrade(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/aftermarket-trade`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Aftermarket Trade for ${symbol}`);
  }

  async getAftermarketQuote(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/aftermarket-quote`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Aftermarket Quote for ${symbol}`);
  }

  async getStockPriceChange(symbol: string): Promise<any[]> {
    return handleError(async () => {
      const response = await this.client.get<any[]>(`/stock-price-change`, {
        symbol: symbol.toUpperCase(),
      });
      return Array.isArray(response) ? response : [];
    }, `Get Stock Price Change for ${symbol}`);
  }
}

