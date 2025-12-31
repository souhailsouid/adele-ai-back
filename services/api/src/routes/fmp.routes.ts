/**
 * Routes FMP (Financial Modeling Prep)
 */

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { Route } from "./types";
import * as fmp from "../fmp";
import type {
  SymbolSearchQueryParams,
  NameSearchQueryParams,
  CIKSearchQueryParams,
  CUSIPSearchQueryParams,
  ISINSearchQueryParams,
  FMPStockScreenerQueryParams,
  ExchangeVariantsQueryParams,
} from "../types/fmp/company-search";

// Helper functions
function getPathParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.pathParameters?.[key];
}

function getQueryParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.queryStringParameters?.[key];
}

export const fmpRoutes: Route[] = [
  // ========== Quote & Market Data ==========
  {
    method: "GET",
    path: "/fmp/quote/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const forceRefresh = getQueryParam(event, "force_refresh") === "true";
      return await fmp.getFMPQuote(symbol, forceRefresh);
    },
  },
  // ========== Financial Statements ==========
  // Income Statement
  {
    method: "GET",
    path: "/fmp/income-statement/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      const period = getQueryParam(event, "period") as 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter' | undefined;
      return await fmp.getFMPIncomeStatement({ symbol, limit, period });
    },
  },
    // Income Statement TTM
  //  need subscription to see this
  {
    method: "GET",
    path: "/fmp/income-statement-ttm/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      return await fmp.getFMPIncomeStatementTTM({ symbol, limit });
    },
  },
  // Balance Sheet Statement
  {
    method: "GET",
    path: "/fmp/balance-sheet-statement/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      const period = getQueryParam(event, "period") as 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter' | undefined;
      return await fmp.getFMPBalanceSheetStatement({ symbol, limit, period });
    },
  },
    // Balance Sheet Statement TTM
  //  need subscription to see this
  {
    method: "GET",
    path: "/fmp/balance-sheet-statement-ttm/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      return await fmp.getFMPBalanceSheetStatementTTM({ symbol, limit });
    },
    },

  // Cash Flow Statement
  {
    method: "GET",
    path: "/fmp/cash-flow-statement/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      const period = getQueryParam(event, "period") as 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter' | undefined;
      return await fmp.getFMPCashFlowStatement({ symbol, limit, period });
    },
    },
    //  need subscription to see this
  // Cash Flow Statement TTM
  {
    method: "GET",
    path: "/fmp/cash-flow-statement-ttm/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      return await fmp.getFMPCashFlowStatementTTM({ symbol, limit });
    },
  },
    // Latest Financial Statements
   //   need subscription to see this
  // need subscription
  // {
  //   method: "GET",
  //   path: "/fmp/latest-financial-statements",
  //   handler: async (event) => {
  //     const page = getQueryParam(event, "page") ? parseInt(getQueryParam(event, "page")!) : 0;
  //     const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 250;
  //     return await fmp.getFMPLatestFinancialStatements({ page, limit });
  //   },
  // },
  // Key Metrics
  {
    method: "GET",
    path: "/fmp/key-metrics/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      const period = getQueryParam(event, "period") as 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter' | undefined;
      return await fmp.getFMPKeyMetrics({ symbol, limit, period });
    },
  },
  // Key Metrics TTM
  {
    method: "GET",
    path: "/fmp/key-metrics-ttm/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPKeyMetricsTTM(symbol);
    },
  },
  // Financial Ratios
  {
    method: "GET",
    path: "/fmp/financial-ratios/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      const period = getQueryParam(event, "period") as 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter' | undefined;
      return await fmp.getFMPFinancialRatios({ symbol, limit, period });
    },
  },
  // Financial Scores
  {
    method: "GET",
    path: "/fmp/financial-scores/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPFinancialScores(symbol);
    },
  },
  // Owner Earnings
  {
    method: "GET",
    path: "/fmp/owner-earnings/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      return await fmp.getFMPOwnerEarnings({ symbol, limit });
    },
  },
  // Enterprise Values
  {
    method: "GET",
    path: "/fmp/enterprise-values/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      const period = getQueryParam(event, "period");
      return await fmp.getFMPEnterpriseValues({ symbol, limit, period });
    },
  },
  // Income Statement Growth
  {
    method: "GET",
    path: "/fmp/income-statement-growth/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      const period = getQueryParam(event, "period");
      return await fmp.getFMPIncomeStatementGrowth({ symbol, limit, period });
    },
  },
  // Balance Sheet Statement Growth
  {
    method: "GET",
    path: "/fmp/balance-sheet-statement-growth/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      const period = getQueryParam(event, "period");
      return await fmp.getFMPBalanceSheetStatementGrowth({ symbol, limit, period });
    },
  },
  // Cashflow Statement Growth
  {
    method: "GET",
    path: "/fmp/cash-flow-statement-growth/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      const period = getQueryParam(event, "period");
      return await fmp.getFMPCashflowStatementGrowth({ symbol, limit, period });
    },
  },
  // Financial Statement Growth
  {
    method: "GET",
    path: "/fmp/financial-growth/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      const period = getQueryParam(event, "period");
      return await fmp.getFMPFinancialStatementGrowth({ symbol, limit, period });
    },
  },
  // Financial Reports Dates
  {
    method: "GET",
    path: "/fmp/financial-reports-dates/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPFinancialReportsDates(symbol);
    },
  },
  // Financial Reports Form 10-K JSON
  {
    method: "GET",
    path: "/fmp/financial-reports-json/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const year = getQueryParam(event, "year");
      const period = getQueryParam(event, "period");
      if (!symbol || !year || !period) throw new Error("Missing required parameters: symbol, year, and period");
      return await fmp.getFMPFinancialReportsJSON({ symbol, year: parseInt(year), period });
    },
  },
  // Financial Reports Form 10-K XLSX
  {
    method: "GET",
    path: "/fmp/financial-reports-xlsx/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const year = getQueryParam(event, "year");
      const period = getQueryParam(event, "period");
      if (!symbol || !year || !period) throw new Error("Missing required parameters: symbol, year, and period");
      return await fmp.getFMPFinancialReportsXLSX({ symbol, year: parseInt(year), period });
    },
  },
  // Revenue Product Segmentation
  {
    method: "GET",
    path: "/fmp/revenue-product-segmentation/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const period = getQueryParam(event, "period");
      const structure = getQueryParam(event, "structure");
      return await fmp.getFMPRevenueProductSegmentation({ symbol, period, structure });
    },
  },
  // Revenue Geographic Segments
  {
    method: "GET",
    path: "/fmp/revenue-geographic-segmentation/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const period = getQueryParam(event, "period");
      const structure = getQueryParam(event, "structure");
      return await fmp.getFMPRevenueGeographicSegments({ symbol, period, structure });
    },
  },
  // As Reported Income Statements
  {
    method: "GET",
    path: "/fmp/income-statement-as-reported/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      const period = getQueryParam(event, "period");
      return await fmp.getFMPAsReportedIncomeStatements({ symbol, limit, period });
    },
  },
  // As Reported Balance Statements
  {
    method: "GET",
    path: "/fmp/balance-sheet-statement-as-reported/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      const period = getQueryParam(event, "period");
      return await fmp.getFMPAsReportedBalanceStatements({ symbol, limit, period });
    },
  },
  // As Reported Cashflow Statements
  {
    method: "GET",
    path: "/fmp/cash-flow-statement-as-reported/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      const period = getQueryParam(event, "period");
      return await fmp.getFMPAsReportedCashflowStatements({ symbol, limit, period });
    },
  },
  // As Reported Financial Statements
  {
    method: "GET",
    path: "/fmp/financial-statement-full-as-reported/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 5;
      const period = getQueryParam(event, "period");
      return await fmp.getFMPAsReportedFinancialStatements({ symbol, limit, period });
    },
  },
  // ========== SEC Filings ==========
  // Latest 8-K SEC Filings
  {
    method: "GET",
    path: "/fmp/sec-filings/8k",
    handler: async (event) => {
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!from || !to) throw new Error("Missing required parameters: from and to");
      const page = getQueryParam(event, "page") ? parseInt(getQueryParam(event, "page")!) : 0;
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 100;
      return await fmp.getFMPLatest8KFilings({ from, to, page, limit });
    },
  },
  // Latest SEC Filings (Financials)
  {
    method: "GET",
    path: "/fmp/sec-filings/latest",
    handler: async (event) => {
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!from || !to) throw new Error("Missing required parameters: from and to");
      const page = getQueryParam(event, "page") ? parseInt(getQueryParam(event, "page")!) : 0;
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 100;
      return await fmp.getFMPLatestSECFilings({ from, to, page, limit });
    },
  },
  // SEC Filings By Form Type
  {
    method: "GET",
    path: "/fmp/sec-filings/form-type",
    handler: async (event) => {
      const formType = getQueryParam(event, "formType");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!formType || !from || !to) throw new Error("Missing required parameters: formType, from, and to");
      const page = getQueryParam(event, "page") ? parseInt(getQueryParam(event, "page")!) : 0;
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 100;
      return await fmp.getFMPSECFilingsByFormType({ formType, from, to, page, limit });
    },
  },
  // SEC Filings By Symbol
  {
    method: "GET",
    path: "/fmp/sec-filings/symbol/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !from || !to) throw new Error("Missing required parameters: symbol, from, and to");
      const page = getQueryParam(event, "page") ? parseInt(getQueryParam(event, "page")!) : 0;
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 100;
      return await fmp.getFMPSECFilingsBySymbol({ symbol, from, to, page, limit });
    },
  },
  // SEC Filings By CIK
  {
    method: "GET",
    path: "/fmp/sec-filings/cik/{cik}",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!cik || !from || !to) throw new Error("Missing required parameters: cik, from, and to");
      const page = getQueryParam(event, "page") ? parseInt(getQueryParam(event, "page")!) : 0;
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 100;
      return await fmp.getFMPSECFilingsByCIK({ cik, from, to, page, limit });
    },
  },
  // SEC Filings Company Search By Name
  {
    method: "GET",
    path: "/fmp/sec-filings/company-search/name",
    handler: async (event) => {
      const company = getQueryParam(event, "company");
      if (!company) throw new Error("Missing required parameter: company");
      return await fmp.searchFMPSECFilingsByName(company);
    },
  },
  // SEC Filings Company Search By Symbol
  {
    method: "GET",
    path: "/fmp/sec-filings/company-search/symbol/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.searchFMPSECCompanyBySymbol(symbol);
    },
  },
  // SEC Filings Company Search By CIK
  {
    method: "GET",
    path: "/fmp/sec-filings/company-search/cik/{cik}",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      if (!cik) throw new Error("Missing cik parameter");
      return await fmp.searchFMPSECCompanyByCIK(cik);
    },
  },
  // SEC Company Full Profile
  {
    method: "GET",
    path: "/fmp/sec-filings/profile/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const cik = getQueryParam(event, "cik");
      return await fmp.getFMPSECCompanyFullProfile({ symbol, cik });
    },
  },
  // Industry Classification List
  {
    method: "GET",
    path: "/fmp/industry-classification/list",
    handler: async (event) => {
      const industryTitle = getQueryParam(event, "industryTitle");
      const sicCode = getQueryParam(event, "sicCode");
      return await fmp.getFMPIndustryClassificationList({ industryTitle, sicCode });
    },
  },
  // Industry Classification Search
  {
    method: "GET",
    path: "/fmp/industry-classification/search",
    handler: async (event) => {
      const symbol = getQueryParam(event, "symbol");
      const cik = getQueryParam(event, "cik");
      const sicCode = getQueryParam(event, "sicCode");
      return await fmp.searchFMPIndustryClassification({ symbol, cik, sicCode });
    },
  },
  // All Industry Classification
  {
    method: "GET",
    path: "/fmp/industry-classification/all",
    handler: async (event) => {
      const page = getQueryParam(event, "page") ? parseInt(getQueryParam(event, "page")!) : 0;
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 100;
      return await fmp.getFMPAllIndustryClassification({ page, limit });
    },
  },
  // ========== Company Search ==========
  {
    method: "GET",
    path: "/fmp/search-symbol",
    handler: async (event) => {
      const query = getQueryParam(event, "query");
      if (!query) throw new Error("Missing required parameter: query");
      
      const params: SymbolSearchQueryParams = { query };
      if (event.queryStringParameters?.limit) {
        const limit = parseInt(event.queryStringParameters.limit, 10);
        if (!isNaN(limit) && limit > 0) {
          params.limit = limit;
        }
      }
      if (event.queryStringParameters?.exchange) {
        params.exchange = event.queryStringParameters.exchange;
      }
      
      return await fmp.getFMPSearchSymbol(params);
    },
  },
  {
    method: "GET",
    path: "/fmp/search-name",
    handler: async (event) => {
      const query = getQueryParam(event, "query");
      if (!query) throw new Error("Missing required parameter: query");
      
      const params: NameSearchQueryParams = { query };
      if (event.queryStringParameters?.limit) {
        const limit = parseInt(event.queryStringParameters.limit, 10);
        if (!isNaN(limit) && limit > 0) {
          params.limit = limit;
        }
      }
      if (event.queryStringParameters?.exchange) {
        params.exchange = event.queryStringParameters.exchange;
      }
      
      return await fmp.getFMPSearchName(params);
    },
  },
  {
    method: "GET",
    path: "/fmp/search-cik",
    handler: async (event) => {
      const cik = getQueryParam(event, "cik");
      if (!cik) throw new Error("Missing required parameter: cik");
      
      const params: CIKSearchQueryParams = { cik };
      if (event.queryStringParameters?.limit) {
        const limit = parseInt(event.queryStringParameters.limit, 10);
        if (!isNaN(limit) && limit > 0) {
          params.limit = limit;
        }
      }
      
      return await fmp.getFMPSearchCIK(params);
    },
  },
  {
    method: "GET",
    path: "/fmp/search-cusip",
    handler: async (event) => {
      const cusip = getQueryParam(event, "cusip");
      if (!cusip) throw new Error("Missing required parameter: cusip");
      
      const params: CUSIPSearchQueryParams = { cusip };
      return await fmp.getFMPSearchCUSIP(params);
    },
  },
  {
    method: "GET",
    path: "/fmp/search-isin",
    handler: async (event) => {
      const isin = getQueryParam(event, "isin");
      if (!isin) throw new Error("Missing required parameter: isin");
      
      const params: ISINSearchQueryParams = { isin };
      return await fmp.getFMPSearchISIN(params);
    },
  },
  {
    method: "GET",
    path: "/fmp/company-screener",
    handler: async (event) => {
      const params: FMPStockScreenerQueryParams = {};
      
      if (event.queryStringParameters) {
        if (event.queryStringParameters.marketCapMoreThan) {
          const value = parseFloat(event.queryStringParameters.marketCapMoreThan);
          if (!isNaN(value)) params.marketCapMoreThan = value;
        }
        if (event.queryStringParameters.marketCapLowerThan) {
          const value = parseFloat(event.queryStringParameters.marketCapLowerThan);
          if (!isNaN(value)) params.marketCapLowerThan = value;
        }
        if (event.queryStringParameters.sector) {
          params.sector = event.queryStringParameters.sector;
        }
        if (event.queryStringParameters.industry) {
          params.industry = event.queryStringParameters.industry;
        }
        if (event.queryStringParameters.betaMoreThan) {
          const value = parseFloat(event.queryStringParameters.betaMoreThan);
          if (!isNaN(value)) params.betaMoreThan = value;
        }
        if (event.queryStringParameters.betaLowerThan) {
          const value = parseFloat(event.queryStringParameters.betaLowerThan);
          if (!isNaN(value)) params.betaLowerThan = value;
        }
        if (event.queryStringParameters.priceMoreThan) {
          const value = parseFloat(event.queryStringParameters.priceMoreThan);
          if (!isNaN(value)) params.priceMoreThan = value;
        }
        if (event.queryStringParameters.priceLowerThan) {
          const value = parseFloat(event.queryStringParameters.priceLowerThan);
          if (!isNaN(value)) params.priceLowerThan = value;
        }
        if (event.queryStringParameters.dividendMoreThan) {
          const value = parseFloat(event.queryStringParameters.dividendMoreThan);
          if (!isNaN(value)) params.dividendMoreThan = value;
        }
        if (event.queryStringParameters.dividendLowerThan) {
          const value = parseFloat(event.queryStringParameters.dividendLowerThan);
          if (!isNaN(value)) params.dividendLowerThan = value;
        }
        if (event.queryStringParameters.volumeMoreThan) {
          const value = parseInt(event.queryStringParameters.volumeMoreThan, 10);
          if (!isNaN(value)) params.volumeMoreThan = value;
        }
        if (event.queryStringParameters.volumeLowerThan) {
          const value = parseInt(event.queryStringParameters.volumeLowerThan, 10);
          if (!isNaN(value)) params.volumeLowerThan = value;
        }
        if (event.queryStringParameters.exchange) {
          params.exchange = event.queryStringParameters.exchange;
        }
        if (event.queryStringParameters.country) {
          params.country = event.queryStringParameters.country;
        }
        if (event.queryStringParameters.isEtf !== undefined) {
          params.isEtf = event.queryStringParameters.isEtf === 'true';
        }
        if (event.queryStringParameters.isFund !== undefined) {
          params.isFund = event.queryStringParameters.isFund === 'true';
        }
        if (event.queryStringParameters.isActivelyTrading !== undefined) {
          params.isActivelyTrading = event.queryStringParameters.isActivelyTrading === 'true';
        }
        if (event.queryStringParameters.limit) {
          const limit = parseInt(event.queryStringParameters.limit, 10);
          if (!isNaN(limit) && limit > 0) {
            params.limit = limit;
          }
        }
        if (event.queryStringParameters.includeAllShareClasses !== undefined) {
          params.includeAllShareClasses = event.queryStringParameters.includeAllShareClasses === 'true';
        }
      }
      
      return await fmp.getFMPStockScreener(Object.keys(params).length > 0 ? params : undefined);
    },
  },
  {
    method: "GET",
    path: "/fmp/search-exchange-variants",
    handler: async (event) => {
      const symbol = getQueryParam(event, "symbol");
      if (!symbol) throw new Error("Missing required parameter: symbol");
      
      const params: ExchangeVariantsQueryParams = { symbol };
      return await fmp.getFMPSearchExchangeVariants(params);
    },
  },
  // ========== Market Hours ==========
  // Exchange Market Hours
  {
    method: "GET",
    path: "/fmp/exchange-market-hours",
    handler: async (event) => {
      const exchange = getQueryParam(event, "exchange");
      if (!exchange) throw new Error("Missing required parameter: exchange");
      return await fmp.getFMPExchangeMarketHours(exchange);
    },
  },
  // Holidays By Exchange
  {
    method: "GET",
    path: "/fmp/holidays-by-exchange",
    handler: async (event) => {
      const exchange = getQueryParam(event, "exchange");
      if (!exchange) throw new Error("Missing required parameter: exchange");
      return await fmp.getFMPHolidaysByExchange(exchange);
    },
  },
  // All Exchange Market Hours
  {
    method: "GET",
    path: "/fmp/all-exchange-market-hours",
    handler: async (event) => {
      return await fmp.getFMPAllExchangeMarketHours();
    },
  },
  // ========== Commodity ==========
  {
    method: "GET",
    path: "/fmp/commodities-list",
    handler: async (event) => {
      return await fmp.getFMPCommoditiesList();
    },
  },
  {
    method: "GET",
    path: "/fmp/commodities-quote",
    handler: async (event) => {
      const symbol = getQueryParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPCommoditiesQuote(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/commodities-quote-short",
    handler: async (event) => {
      const symbol = getQueryParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPCommoditiesQuoteShort(symbol);
    },
    },
  // need subscription
  {
    method: "GET",
    path: "/fmp/batch-commodity-quotes",
    handler: async (event) => {
      const short = getQueryParam(event, "short") === "true";
      return await fmp.getFMPBatchCommodityQuotes(short);
    },
  },
  {
    method: "GET",
    path: "/fmp/commodities/light-chart/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      return await fmp.getFMPHistoricalPriceEODLightCommodity({ symbol, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/commodities/full-chart/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      return await fmp.getFMPHistoricalPriceEODFullCommodity({ symbol, from, to });
    },
    },
  // need subscription
  // need subscription
  // {
  //   method: "GET",
  //   path: "/fmp/commodities/chart/1min/{symbol}",
  //   handler: async (event) => {
  //     const symbol = getPathParam(event, "symbol");
  //     const from = getQueryParam(event, "from");
  //     const to = getQueryParam(event, "to");
  //     if (!symbol || !from || !to) throw new Error("Missing required parameters: symbol, from, and to");
  //     return await fmp.getFMPHistoricalChart1MinCommodity({ symbol, from, to });
  //   },
  // },
  {
    method: "GET",
    path: "/fmp/commodities/chart/5min/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !from || !to) throw new Error("Missing required parameters: symbol, from, and to");
      return await fmp.getFMPHistoricalChart5MinCommodity({ symbol, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/commodities/chart/1hour/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !from || !to) throw new Error("Missing required parameters: symbol, from, and to");
      return await fmp.getFMPHistoricalChart1HourCommodity({ symbol, from, to });
    },
  },
  // ========== Market Hours ==========
  {
    method: "GET",
    path: "/fmp/exchange-market-hours",
    handler: async (event) => {
      const exchange = getQueryParam(event, "exchange");
      if (!exchange) throw new Error("Missing exchange parameter");
      return await fmp.getFMPExchangeMarketHours(exchange);
    },
  },
  {
    method: "GET",
    path: "/fmp/holidays-by-exchange",
    handler: async (event) => {
      const exchange = getQueryParam(event, "exchange");
      if (!exchange) throw new Error("Missing exchange parameter");
      return await fmp.getFMPHolidaysByExchange(exchange);
    },
  },
  {
    method: "GET",
    path: "/fmp/all-exchange-market-hours",
    handler: async (event) => {
      return await fmp.getFMPAllExchangeMarketHours();
    },
  },
  // ========== Commodity ==========
  {
    method: "GET",
    path: "/fmp/commodities-list",
    handler: async (event) => {
      return await fmp.getFMPCommoditiesList();
    },
  },
  {
    method: "GET",
    path: "/fmp/commodities-quote",
    handler: async (event) => {
      const symbol = getQueryParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPCommoditiesQuote(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/commodities-quote-short",
    handler: async (event) => {
      const symbol = getQueryParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPCommoditiesQuoteShort(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/commodities/light-chart/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      return await fmp.getFMPHistoricalPriceEODLightCommodity({ symbol, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/commodities/full-chart/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      return await fmp.getFMPHistoricalPriceEODFullCommodity({ symbol, from, to });
    },
  },
  // need subscription
  // {
  //   method: "GET",
  //   path: "/fmp/commodities/chart/1min/{symbol}",
  //   handler: async (event) => {
  //     const symbol = getPathParam(event, "symbol");
  //     const from = getQueryParam(event, "from");
  //     const to = getQueryParam(event, "to");
  //     if (!symbol || !from || !to) throw new Error("Missing required parameters: symbol, from, and to");
  //     return await fmp.getFMPHistoricalChart1MinCommodity({ symbol, from, to });
  //   },
  // },
  {
    method: "GET",
    path: "/fmp/commodities/chart/5min/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !from || !to) throw new Error("Missing required parameters: symbol, from, and to");
      return await fmp.getFMPHistoricalChart5MinCommodity({ symbol, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/commodities/chart/1hour/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !from || !to) throw new Error("Missing required parameters: symbol, from, and to");
      return await fmp.getFMPHistoricalChart1HourCommodity({ symbol, from, to });
    },
  },
  // ========== DCF (Discounted Cash Flow) ==========
  {
    method: "GET",
    path: "/fmp/dcf/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPDCFValuation(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/dcf/levered/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPLeveredDCF(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/dcf/custom/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const params: any = { symbol };
      if (event.queryStringParameters?.revenueGrowthPct) params.revenueGrowthPct = parseFloat(event.queryStringParameters.revenueGrowthPct);
      if (event.queryStringParameters?.ebitdaPct) params.ebitdaPct = parseFloat(event.queryStringParameters.ebitdaPct);
      if (event.queryStringParameters?.depreciationAndAmortizationPct) params.depreciationAndAmortizationPct = parseFloat(event.queryStringParameters.depreciationAndAmortizationPct);
      if (event.queryStringParameters?.cashAndShortTermInvestmentsPct) params.cashAndShortTermInvestmentsPct = parseFloat(event.queryStringParameters.cashAndShortTermInvestmentsPct);
      if (event.queryStringParameters?.receivablesPct) params.receivablesPct = parseFloat(event.queryStringParameters.receivablesPct);
      if (event.queryStringParameters?.inventoriesPct) params.inventoriesPct = parseFloat(event.queryStringParameters.inventoriesPct);
      if (event.queryStringParameters?.payablePct) params.payablePct = parseFloat(event.queryStringParameters.payablePct);
      if (event.queryStringParameters?.ebitPct) params.ebitPct = parseFloat(event.queryStringParameters.ebitPct);
      if (event.queryStringParameters?.capitalExpenditurePct) params.capitalExpenditurePct = parseFloat(event.queryStringParameters.capitalExpenditurePct);
      if (event.queryStringParameters?.operatingCashFlowPct) params.operatingCashFlowPct = parseFloat(event.queryStringParameters.operatingCashFlowPct);
      if (event.queryStringParameters?.sellingGeneralAndAdministrativeExpensesPct) params.sellingGeneralAndAdministrativeExpensesPct = parseFloat(event.queryStringParameters.sellingGeneralAndAdministrativeExpensesPct);
      if (event.queryStringParameters?.taxRate) params.taxRate = parseFloat(event.queryStringParameters.taxRate);
      if (event.queryStringParameters?.longTermGrowthRate) params.longTermGrowthRate = parseFloat(event.queryStringParameters.longTermGrowthRate);
      if (event.queryStringParameters?.costOfDebt) params.costOfDebt = parseFloat(event.queryStringParameters.costOfDebt);
      if (event.queryStringParameters?.costOfEquity) params.costOfEquity = parseFloat(event.queryStringParameters.costOfEquity);
      if (event.queryStringParameters?.marketRiskPremium) params.marketRiskPremium = parseFloat(event.queryStringParameters.marketRiskPremium);
      if (event.queryStringParameters?.beta) params.beta = parseFloat(event.queryStringParameters.beta);
      if (event.queryStringParameters?.riskFreeRate) params.riskFreeRate = parseFloat(event.queryStringParameters.riskFreeRate);
      return await fmp.getFMPCustomDCFAdvanced(params);
    },
  },
  {
    method: "GET",
    path: "/fmp/dcf/custom-levered/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const params: any = { symbol };
      if (event.queryStringParameters?.revenueGrowthPct) params.revenueGrowthPct = parseFloat(event.queryStringParameters.revenueGrowthPct);
      if (event.queryStringParameters?.ebitdaPct) params.ebitdaPct = parseFloat(event.queryStringParameters.ebitdaPct);
      if (event.queryStringParameters?.depreciationAndAmortizationPct) params.depreciationAndAmortizationPct = parseFloat(event.queryStringParameters.depreciationAndAmortizationPct);
      if (event.queryStringParameters?.cashAndShortTermInvestmentsPct) params.cashAndShortTermInvestmentsPct = parseFloat(event.queryStringParameters.cashAndShortTermInvestmentsPct);
      if (event.queryStringParameters?.receivablesPct) params.receivablesPct = parseFloat(event.queryStringParameters.receivablesPct);
      if (event.queryStringParameters?.inventoriesPct) params.inventoriesPct = parseFloat(event.queryStringParameters.inventoriesPct);
      if (event.queryStringParameters?.payablePct) params.payablePct = parseFloat(event.queryStringParameters.payablePct);
      if (event.queryStringParameters?.ebitPct) params.ebitPct = parseFloat(event.queryStringParameters.ebitPct);
      if (event.queryStringParameters?.capitalExpenditurePct) params.capitalExpenditurePct = parseFloat(event.queryStringParameters.capitalExpenditurePct);
      if (event.queryStringParameters?.operatingCashFlowPct) params.operatingCashFlowPct = parseFloat(event.queryStringParameters.operatingCashFlowPct);
      if (event.queryStringParameters?.sellingGeneralAndAdministrativeExpensesPct) params.sellingGeneralAndAdministrativeExpensesPct = parseFloat(event.queryStringParameters.sellingGeneralAndAdministrativeExpensesPct);
      if (event.queryStringParameters?.taxRate) params.taxRate = parseFloat(event.queryStringParameters.taxRate);
      if (event.queryStringParameters?.longTermGrowthRate) params.longTermGrowthRate = parseFloat(event.queryStringParameters.longTermGrowthRate);
      if (event.queryStringParameters?.costOfDebt) params.costOfDebt = parseFloat(event.queryStringParameters.costOfDebt);
      if (event.queryStringParameters?.costOfEquity) params.costOfEquity = parseFloat(event.queryStringParameters.costOfEquity);
      if (event.queryStringParameters?.marketRiskPremium) params.marketRiskPremium = parseFloat(event.queryStringParameters.marketRiskPremium);
      if (event.queryStringParameters?.beta) params.beta = parseFloat(event.queryStringParameters.beta);
      if (event.queryStringParameters?.riskFreeRate) params.riskFreeRate = parseFloat(event.queryStringParameters.riskFreeRate);
      return await fmp.getFMPCustomDCFLevered(params);
    },
  },
  // ========== Crypto ==========
  {
    method: "GET",
    path: "/fmp/crypto/list",
    handler: async (event) => {
      return await fmp.getFMPCryptocurrencyList();
    },
  },
  {
    method: "GET",
    path: "/fmp/crypto/quote",
    handler: async (event) => {
      const symbol = getQueryParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPCryptocurrencyQuote(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/crypto/quote-short",
    handler: async (event) => {
      const symbol = getQueryParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPCryptocurrencyQuoteShort(symbol);
    },
    },
  // need subscription
  {
    method: "GET",
    path: "/fmp/crypto/batch-quotes",
    handler: async (event) => {
      const short = getQueryParam(event, "short") === "true";
      return await fmp.getFMPBatchCryptocurrencyQuotes(short);
    },
  },
  {
    method: "GET",
    path: "/fmp/crypto/light-chart/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      return await fmp.getFMPHistoricalCryptocurrencyPriceLight({ symbol, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/crypto/full-chart/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      return await fmp.getFMPHistoricalCryptocurrencyPriceFull({ symbol, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/crypto/chart/5min/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !from || !to) throw new Error("Missing required parameters: symbol, from, and to");
      return await fmp.getFMPHistoricalCryptocurrencyChart5Min({ symbol, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/crypto/chart/1hour/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !from || !to) throw new Error("Missing required parameters: symbol, from, and to");
      return await fmp.getFMPHistoricalCryptocurrencyChart1Hour({ symbol, from, to });
    },
  },
  // ========== Technical Indicators ==========
  {
    method: "GET",
    path: "/fmp/technical-indicators/sma/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const periodLength = getQueryParam(event, "periodLength");
      const timeframe = getQueryParam(event, "timeframe");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !periodLength || !timeframe) throw new Error("Missing required parameters: symbol, periodLength, and timeframe");
      return await fmp.getFMPSMA({ symbol, periodLength: parseInt(periodLength, 10), timeframe, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/technical-indicators/ema/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const periodLength = getQueryParam(event, "periodLength");
      const timeframe = getQueryParam(event, "timeframe");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !periodLength || !timeframe) throw new Error("Missing required parameters: symbol, periodLength, and timeframe");
      return await fmp.getFMPEMA({ symbol, periodLength: parseInt(periodLength, 10), timeframe, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/technical-indicators/wma/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const periodLength = getQueryParam(event, "periodLength");
      const timeframe = getQueryParam(event, "timeframe");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !periodLength || !timeframe) throw new Error("Missing required parameters: symbol, periodLength, and timeframe");
      return await fmp.getFMPWMA({ symbol, periodLength: parseInt(periodLength, 10), timeframe, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/technical-indicators/dema/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const periodLength = getQueryParam(event, "periodLength");
      const timeframe = getQueryParam(event, "timeframe");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !periodLength || !timeframe) throw new Error("Missing required parameters: symbol, periodLength, and timeframe");
      return await fmp.getFMPDEMA({ symbol, periodLength: parseInt(periodLength, 10), timeframe, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/technical-indicators/tema/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const periodLength = getQueryParam(event, "periodLength");
      const timeframe = getQueryParam(event, "timeframe");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !periodLength || !timeframe) throw new Error("Missing required parameters: symbol, periodLength, and timeframe");
      return await fmp.getFMPTEMA({ symbol, periodLength: parseInt(periodLength, 10), timeframe, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/technical-indicators/rsi/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const periodLength = getQueryParam(event, "periodLength");
      const timeframe = getQueryParam(event, "timeframe");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !periodLength || !timeframe) throw new Error("Missing required parameters: symbol, periodLength, and timeframe");
      return await fmp.getFMPRSI({ symbol, periodLength: parseInt(periodLength, 10), timeframe, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/technical-indicators/standard-deviation/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const periodLength = getQueryParam(event, "periodLength");
      const timeframe = getQueryParam(event, "timeframe");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !periodLength || !timeframe) throw new Error("Missing required parameters: symbol, periodLength, and timeframe");
      return await fmp.getFMPStandardDeviation({ symbol, periodLength: parseInt(periodLength, 10), timeframe, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/technical-indicators/williams/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const periodLength = getQueryParam(event, "periodLength");
      const timeframe = getQueryParam(event, "timeframe");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !periodLength || !timeframe) throw new Error("Missing required parameters: symbol, periodLength, and timeframe");
      return await fmp.getFMPWilliams({ symbol, periodLength: parseInt(periodLength, 10), timeframe, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/technical-indicators/adx/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const periodLength = getQueryParam(event, "periodLength");
      const timeframe = getQueryParam(event, "timeframe");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !periodLength || !timeframe) throw new Error("Missing required parameters: symbol, periodLength, and timeframe");
      return await fmp.getFMPADX({ symbol, periodLength: parseInt(periodLength, 10), timeframe, from, to });
    },
  },
    // ========== ETF & Mutual Funds ==========
  // need subscription
  {
    method: "GET",
    path: "/fmp/etf/holdings/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPETFFundHoldings(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/etf/info/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPETFMutualFundInfo(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/etf/country-allocation/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPETFFundCountryAllocation(symbol);
    },
  },
//   need subscription
  {
    method: "GET",
    path: "/fmp/etf/asset-exposure/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPETFAssetExposure(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/etf/sector-weighting/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPETFSectorWeighting(symbol);
    },
  },
  // ========== Economics ==========
  {
    method: "GET",
    path: "/fmp/economics/treasury-rates",
    handler: async (event) => {
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      return await fmp.getFMPTreasuryRates({ from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/economics/indicators",
    handler: async (event) => {
      const name = getQueryParam(event, "name");
      if (!name) throw new Error("Missing name parameter");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      return await fmp.getFMPEconomicIndicators({ name, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/economics/calendar",
    handler: async (event) => {
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      return await fmp.getFMPEconomicCalendar({ from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/economics/market-risk-premium",
    handler: async (event) => {
      return await fmp.getFMPMarketRiskPremium();
    },
  },
  // ========== Earnings, Dividends, Splits ==========
  {
    method: "GET",
    path: "/fmp/dividends/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPDividendsCompany(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/dividends-calendar",
    handler: async (event) => {
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      return await fmp.getFMPDividendsCalendar({ from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/earnings/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPEarningsReport(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/earnings-calendar",
    handler: async (event) => {
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      return await fmp.getFMPEarningsCalendar({ from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/ipos-calendar",
    handler: async (event) => {
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      return await fmp.getFMPIPOsCalendar({ from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/ipos-disclosure",
    handler: async (event) => {
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      return await fmp.getFMPIPOsDisclosure({ from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/ipos-prospectus",
    handler: async (event) => {
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      return await fmp.getFMPIPOsProspectus({ from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/splits/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPStockSplitDetails(symbol);
    },
    },
  {
    method: "GET",
    path: "/fmp/splits-calendar",
    handler: async (event) => {
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      return await fmp.getFMPStockSplitsCalendar({ from, to });
    },
    },
  // need subscription
  // ========== Earnings Transcript ==========
  {
    method: "GET",
    path: "/fmp/earnings-transcript/latest",
    handler: async (event) => {
      return await fmp.getFMPLatestEarningTranscripts();
    },
  },
  {
    method: "GET",
    path: "/fmp/earnings-transcript/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const year = getQueryParam(event, "year");
      const quarter = getQueryParam(event, "quarter");
      if (!symbol || !year || !quarter) throw new Error("Missing required parameters: symbol, year, and quarter");
      return await fmp.getFMPEarningsTranscript({
        symbol,
        year: parseInt(year, 10),
        quarter: parseInt(quarter, 10),
      });
    },
  },
  {
    method: "GET",
    path: "/fmp/earnings-transcript/dates/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPTranscriptsDatesBySymbol(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/earnings-transcript/list",
    handler: async (event) => {
      return await fmp.getFMPAvailableTranscriptSymbols();
    },
  },
  // ========== News ==========
  {
    method: "GET",
    path: "/fmp/news/fmp-articles",
    handler: async (event) => {
      const page = getQueryParam(event, "page") ? parseInt(getQueryParam(event, "page")!, 10) : 0;
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!, 10) : 20;
      return await fmp.getFMPFMPArticles({ page, limit });
    },
  },
  {
    method: "GET",
    path: "/fmp/news/general",
    handler: async (event) => {
      const page = getQueryParam(event, "page") ? parseInt(getQueryParam(event, "page")!, 10) : 0;
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!, 10) : 20;
      return await fmp.getFMPGeneralNews({ page, limit });
    },
    },
//  need subscription
  // need subscription
  // {
  //   method: "GET",
  //   path: "/fmp/news/press-releases",
  //   handler: async (event) => {
  //     const page = getQueryParam(event, "page") ? parseInt(getQueryParam(event, "page")!, 10) : 0;
  //     const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!, 10) : 20;
  //     return await fmp.getFMPPressReleases({ page, limit });
  //   },
  // },
  {
    method: "GET",
    path: "/fmp/news/stock",
    handler: async (event) => {
      const page = getQueryParam(event, "page") ? parseInt(getQueryParam(event, "page")!, 10) : 0;
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!, 10) : 20;
      return await fmp.getFMPStockNews({ page, limit });
    },
  },
  {
    method: "GET",
    path: "/fmp/news/crypto",
    handler: async (event) => {
      const page = getQueryParam(event, "page") ? parseInt(getQueryParam(event, "page")!, 10) : 0;
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!, 10) : 20;
      return await fmp.getFMPCryptoNews({ page, limit });
    },
  },
  // ========== Financial Estimates ==========
  {
    method: "GET",
    path: "/fmp/financial-estimates/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const period = getQueryParam(event, "period");
      if (!symbol || !period) throw new Error("Missing required parameters: symbol and period");
      if (period !== 'annual' && period !== 'quarter') throw new Error("Period must be 'annual' or 'quarter'");
      const page = getQueryParam(event, "page") ? parseInt(getQueryParam(event, "page")!, 10) : 0;
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!, 10) : 10;
      return await fmp.getFMPFinancialEstimates({ symbol, period: period as 'annual' | 'quarter', page, limit });
    },
  },
  {
    method: "GET",
    path: "/fmp/ratings-snapshot/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPRatingsSnapshot(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/ratings-historical/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!, 10) : 1;
      return await fmp.getFMPHistoricalRatings({ symbol, limit });
    },
  },
  {
    method: "GET",
    path: "/fmp/price-target-summary/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPPriceTargetSummary(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/price-target-consensus/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPPriceTargetConsensus(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/grades/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPStockGrades(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/grades-historical/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!, 10) : 100;
      return await fmp.getFMPHistoricalStockGrades({ symbol, limit });
    },
  },
  {
    method: "GET",
    path: "/fmp/grades-consensus/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPStockGradesSummary(symbol);
    },
  },
  // ========== Market Performance ==========
  {
    method: "GET",
    path: "/fmp/market/sector-performance-snapshot",
    handler: async (event) => {
      const date = getQueryParam(event, "date");
      if (!date) throw new Error("Missing date parameter");
      const exchange = getQueryParam(event, "exchange");
      const sector = getQueryParam(event, "sector");
      return await fmp.getFMPMarketSectorPerformanceSnapshot({ date, exchange, sector });
    },
  },
  {
    method: "GET",
    path: "/fmp/market/industry-performance-snapshot",
    handler: async (event) => {
      const date = getQueryParam(event, "date");
      if (!date) throw new Error("Missing date parameter");
      const exchange = getQueryParam(event, "exchange");
      const industry = getQueryParam(event, "industry");
      return await fmp.getFMPIndustryPerformanceSnapshot({ date, exchange, industry });
    },
  },
  {
    method: "GET",
    path: "/fmp/market/historical-sector-performance",
    handler: async (event) => {
      const sector = getQueryParam(event, "sector");
      if (!sector) throw new Error("Missing sector parameter");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      const exchange = getQueryParam(event, "exchange");
      return await fmp.getFMPHistoricalMarketSectorPerformance({ sector, from, to, exchange });
    },
  },
  {
    method: "GET",
    path: "/fmp/market/historical-industry-performance",
    handler: async (event) => {
      const industry = getQueryParam(event, "industry");
      if (!industry) throw new Error("Missing industry parameter");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      const exchange = getQueryParam(event, "exchange");
      return await fmp.getFMPHistoricalIndustryPerformance({ industry, from, to, exchange });
    },
  },
  {
    method: "GET",
    path: "/fmp/market/sector-pe-snapshot",
    handler: async (event) => {
      const date = getQueryParam(event, "date");
      if (!date) throw new Error("Missing date parameter");
      const exchange = getQueryParam(event, "exchange");
      const sector = getQueryParam(event, "sector");
      return await fmp.getFMPSectorPESnapshot({ date, exchange, sector });
    },
  },
  {
    method: "GET",
    path: "/fmp/market/industry-pe-snapshot",
    handler: async (event) => {
      const date = getQueryParam(event, "date");
      if (!date) throw new Error("Missing date parameter");
      const exchange = getQueryParam(event, "exchange");
      const industry = getQueryParam(event, "industry");
      return await fmp.getFMPIndustryPESnapshot({ date, exchange, industry });
    },
  },
  {
    method: "GET",
    path: "/fmp/market/historical-sector-pe",
    handler: async (event) => {
      const sector = getQueryParam(event, "sector");
      if (!sector) throw new Error("Missing sector parameter");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      const exchange = getQueryParam(event, "exchange");
      return await fmp.getFMPHistoricalSectorPE({ sector, from, to, exchange });
    },
  },
  {
    method: "GET",
    path: "/fmp/market/historical-industry-pe",
    handler: async (event) => {
      const industry = getQueryParam(event, "industry");
      if (!industry) throw new Error("Missing industry parameter");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      const exchange = getQueryParam(event, "exchange");
      return await fmp.getFMPHistoricalIndustryPE({ industry, from, to, exchange });
    },
  },
  {
    method: "GET",
    path: "/fmp/market/biggest-gainers",
    handler: async (event) => {
      return await fmp.getFMPBiggestStockGainers();
    },
  },
  {
    method: "GET",
    path: "/fmp/market/biggest-losers",
    handler: async (event) => {
      return await fmp.getFMPBiggestStockLosers();
    },
  },
  {
    method: "GET",
    path: "/fmp/market/most-actives",
    handler: async (event) => {
      return await fmp.getFMPTopTradedStocks();
    },
  },
  // ========== Insider Trades ==========
  {
    method: "GET",
    path: "/fmp/insider-trading/latest",
    handler: async (event) => {
      const date = getQueryParam(event, "date");
      const page = getQueryParam(event, "page") ? parseInt(getQueryParam(event, "page")!, 10) : 0;
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!, 10) : 100;
      return await fmp.getFMPLatestInsiderTrading({ date, page, limit });
    },
  },
  {
    method: "GET",
    path: "/fmp/insider-trading/search",
    handler: async (event) => {
      const symbol = getQueryParam(event, "symbol");
      const page = getQueryParam(event, "page") ? parseInt(getQueryParam(event, "page")!, 10) : 0;
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!, 10) : 100;
      const reportingCik = getQueryParam(event, "reportingCik");
      const companyCik = getQueryParam(event, "companyCik");
      const transactionType = getQueryParam(event, "transactionType");
      return await fmp.getFMPSearchInsiderTrades({ symbol, page, limit, reportingCik, companyCik, transactionType });
    },
  },
  {
    method: "GET",
    path: "/fmp/insider-trading/reporting-name",
    handler: async (event) => {
      const name = getQueryParam(event, "name");
      if (!name) throw new Error("Missing name parameter");
      return await fmp.getFMPSearchInsiderTradesByReportingName(name);
    },
  },
  {
    method: "GET",
    path: "/fmp/insider-trading/transaction-types",
    handler: async (event) => {
      return await fmp.getFMPAllInsiderTransactionTypes();
    },
  },
  {
    method: "GET",
    path: "/fmp/insider-trading/statistics/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPInsiderTradeStatistics(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/acquisition-ownership/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!, 10) : 2000;
      return await fmp.getFMPAcquisitionOwnership({ symbol, limit });
    },
  },
  // ========== Indexes ==========
  {
    method: "GET",
    path: "/fmp/indexes/list",
    handler: async (event) => {
      return await fmp.getFMPStockMarketIndexesList();
    },
  },
  {
    method: "GET",
    path: "/fmp/indexes/quote",
    handler: async (event) => {
      const symbol = getQueryParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPIndexQuote(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/indexes/quote-short",
    handler: async (event) => {
      const symbol = getQueryParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPIndexShortQuote(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/indexes/batch-quotes",
    handler: async (event) => {
      const short = getQueryParam(event, "short") === "true";
      return await fmp.getFMPAllIndexQuotes(short);
    },
  },
  {
    method: "GET",
    path: "/fmp/indexes/light-chart/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      return await fmp.getFMPHistoricalIndexPriceLight({ symbol, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/indexes/full-chart/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      return await fmp.getFMPHistoricalIndexPriceFull({ symbol, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/indexes/chart/5min/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !from || !to) throw new Error("Missing required parameters: symbol, from, and to");
      return await fmp.getFMPHistoricalIndexChart5Min({ symbol, from, to });
    },
  },
  {
    method: "GET",
    path: "/fmp/indexes/chart/1hour/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      const from = getQueryParam(event, "from");
      const to = getQueryParam(event, "to");
      if (!symbol || !from || !to) throw new Error("Missing required parameters: symbol, from, and to");
      return await fmp.getFMPHistoricalIndexChart1Hour({ symbol, from, to });
    },
    },
//   need subscription
  {
    method: "GET",
    path: "/fmp/indexes/sp500-constituent",
    handler: async (event) => {
      return await fmp.getFMPSP500Constituent();
    },
  },
  {
    method: "GET",
    path: "/fmp/indexes/nasdaq-constituent",
    handler: async (event) => {
      return await fmp.getFMPNasdaqConstituent();
    },
  },
  {
    method: "GET",
    path: "/fmp/indexes/dowjones-constituent",
    handler: async (event) => {
      return await fmp.getFMPDowJonesConstituent();
    },
  },
  {
    method: "GET",
    path: "/fmp/indexes/historical-sp500-constituent",
    handler: async (event) => {
      return await fmp.getFMPHistoricalSP500Constituent();
    },
  },
  {
    method: "GET",
    path: "/fmp/indexes/historical-nasdaq-constituent",
    handler: async (event) => {
      return await fmp.getFMPHistoricalNasdaqConstituent();
    },
  },
  {
    method: "GET",
    path: "/fmp/indexes/historical-dowjones-constituent",
    handler: async (event) => {
      return await fmp.getFMPHistoricalDowJonesConstituent();
    },
  },
  // ========== Senate ==========
  {
    method: "GET",
    path: "/fmp/senate/latest",
    handler: async (event) => {
      const page = getQueryParam(event, "page") ? parseInt(getQueryParam(event, "page")!, 10) : 0;
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!, 10) : 100;
      return await fmp.getFMPLatestSenateFinancialDisclosures({ page, limit });
    },
  },
  {
    method: "GET",
    path: "/fmp/house/latest",
    handler: async (event) => {
      const page = getQueryParam(event, "page") ? parseInt(getQueryParam(event, "page")!, 10) : 0;
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!, 10) : 100;
      return await fmp.getFMPLatestHouseFinancialDisclosures({ page, limit });
    },
  },
  {
    method: "GET",
    path: "/fmp/senate/trades/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPSenateTradingActivity(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/senate/trades-by-name",
    handler: async (event) => {
      const name = getQueryParam(event, "name");
      if (!name) throw new Error("Missing name parameter");
      return await fmp.getFMPSenateTradesByName(name);
    },
  },
  {
    method: "GET",
    path: "/fmp/house/trades/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPUSHouseTrades(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/house/trades-by-name",
    handler: async (event) => {
      const name = getQueryParam(event, "name");
      if (!name) throw new Error("Missing name parameter");
      return await fmp.getFMPHouseTradesByName(name);
    },
  },
  // ========== Quote ==========
  {
    method: "GET",
    path: "/fmp/quote/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPStockQuote(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/quote-short/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPStockQuoteShort(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/aftermarket-trade/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPAftermarketTrade(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/aftermarket-quote/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPAftermarketQuote(symbol);
    },
  },
  {
    method: "GET",
    path: "/fmp/stock-price-change/{symbol}",
    handler: async (event) => {
      const symbol = getPathParam(event, "symbol");
      if (!symbol) throw new Error("Missing symbol parameter");
      return await fmp.getFMPStockPriceChange(symbol);
    },
  },
];

