/**
 * Module FMP - Interface publique
 * Expose toutes les fonctions FMP pour le router
 * Utilise les services et repositories pour éviter la duplication
 */

import { FMPService } from './services/fmp.service';
import { logger } from './utils/logger';

// Instance singleton du service
const fmpService = new FMPService();

// ========== Quote & Market Data ==========

export async function getFMPQuote(symbol: string, forceRefresh: boolean = false) {
  const log = logger.child({ symbol, function: 'getFMPQuote' });
  log.info('Getting FMP quote');
  try {
    return await fmpService.getQuote(symbol, forceRefresh);
  } catch (error) {
    log.error('Failed to get FMP quote', error);
    throw error;
  }
}

export async function getFMPMarketCap(symbol: string) {
  const quote = await fmpService.getQuote(symbol);
  return {
    success: true,
    data: { symbol, marketCap: quote.data.marketCap || 0 },
    cached: quote.cached,
    timestamp: quote.timestamp,
  };
}

// ========== Financial Statements ==========

export async function getFMPIncomeStatement(params: {
  symbol: string;
  limit?: number;
  period?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter';
}) {
  return await fmpService.getIncomeStatement(params);
}

export async function getFMPIncomeStatementTTM(params: {
  symbol: string;
  limit?: number;
}) {
  return await fmpService.getIncomeStatementTTM(params);
}

export async function getFMPBalanceSheetStatement(params: {
  symbol: string;
  limit?: number;
  period?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter';
}) {
  return await fmpService.getBalanceSheetStatement(params);
}

export async function getFMPBalanceSheetStatementTTM(params: {
  symbol: string;
  limit?: number;
}) {
  return await fmpService.getBalanceSheetStatementTTM(params);
}

export async function getFMPCashFlowStatement(params: {
  symbol: string;
  limit?: number;
  period?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter';
}) {
  return await fmpService.getCashFlowStatement(params);
}

export async function getFMPCashFlowStatementTTM(params: {
  symbol: string;
  limit?: number;
}) {
  return await fmpService.getCashFlowStatementTTM(params);
}

export async function getFMPLatestFinancialStatements(params?: {
  page?: number;
  limit?: number;
}) {
  return await fmpService.getLatestFinancialStatements(params);
}

export async function getFMPKeyMetrics(params: {
  symbol: string;
  limit?: number;
  period?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter';
}) {
  return await fmpService.getKeyMetrics(params);
}

export async function getFMPKeyMetricsTTM(symbol: string) {
  return await fmpService.getKeyMetricsTTM(symbol);
}

export async function getFMPFinancialRatios(params: {
  symbol: string;
  limit?: number;
  period?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY' | 'annual' | 'quarter';
}) {
  return await fmpService.getFinancialRatios(params);
}

// ========== Financial Scores ==========

export async function getFMPFinancialScores(symbol: string) {
  return await fmpService.getFinancialScores(symbol);
}

// ========== Owner Earnings ==========

export async function getFMPOwnerEarnings(params: { symbol: string; limit?: number }) {
  return await fmpService.getOwnerEarnings(params);
}

// ========== Enterprise Values ==========

export async function getFMPEnterpriseValues(params: { symbol: string; limit?: number; period?: string }) {
  return await fmpService.getEnterpriseValues(params);
}

// ========== Income Statement Growth ==========

export async function getFMPIncomeStatementGrowth(params: { symbol: string; limit?: number; period?: string }) {
  return await fmpService.getIncomeStatementGrowth(params);
}

// ========== Balance Sheet Statement Growth ==========

export async function getFMPBalanceSheetStatementGrowth(params: { symbol: string; limit?: number; period?: string }) {
  return await fmpService.getBalanceSheetStatementGrowth(params);
}

// ========== Cashflow Statement Growth ==========

export async function getFMPCashflowStatementGrowth(params: { symbol: string; limit?: number; period?: string }) {
  return await fmpService.getCashflowStatementGrowth(params);
}

// ========== Financial Statement Growth ==========

export async function getFMPFinancialStatementGrowth(params: { symbol: string; limit?: number; period?: string }) {
  return await fmpService.getFinancialStatementGrowth(params);
}

// ========== Financial Reports Dates ==========

export async function getFMPFinancialReportsDates(symbol: string) {
  return await fmpService.getFinancialReportsDates(symbol);
}

// ========== Financial Reports Form 10-K JSON ==========

export async function getFMPFinancialReportsJSON(params: { symbol: string; year: number; period: string }) {
  return await fmpService.getFinancialReportsJSON(params);
}

// ========== Financial Reports Form 10-K XLSX ==========

export async function getFMPFinancialReportsXLSX(params: { symbol: string; year: number; period: string }) {
  return await fmpService.getFinancialReportsXLSX(params);
}

// ========== Revenue Product Segmentation ==========

export async function getFMPRevenueProductSegmentation(params: { symbol: string; period?: string; structure?: string }) {
  return await fmpService.getRevenueProductSegmentation(params);
}

// ========== Revenue Geographic Segments ==========

export async function getFMPRevenueGeographicSegments(params: { symbol: string; period?: string; structure?: string }) {
  return await fmpService.getRevenueGeographicSegments(params);
}

// ========== As Reported Income Statements ==========

export async function getFMPAsReportedIncomeStatements(params: { symbol: string; limit?: number; period?: string }) {
  return await fmpService.getAsReportedIncomeStatements(params);
}

// ========== As Reported Balance Statements ==========

export async function getFMPAsReportedBalanceStatements(params: { symbol: string; limit?: number; period?: string }) {
  return await fmpService.getAsReportedBalanceStatements(params);
}

// ========== As Reported Cashflow Statements ==========

export async function getFMPAsReportedCashflowStatements(params: { symbol: string; limit?: number; period?: string }) {
  return await fmpService.getAsReportedCashflowStatements(params);
}

// ========== As Reported Financial Statements ==========

export async function getFMPAsReportedFinancialStatements(params: { symbol: string; limit?: number; period?: string }) {
  return await fmpService.getAsReportedFinancialStatements(params);
}

// ========== SEC Filings ==========

export async function getFMPLatest8KFilings(params: {
  from: string;
  to: string;
  page?: number;
  limit?: number;
}) {
  return await fmpService.getLatest8KFilings(params);
}

export async function getFMPLatestSECFilings(params: {
  from: string;
  to: string;
  page?: number;
  limit?: number;
}) {
  return await fmpService.getLatestSECFilings(params);
}

export async function getFMPSECFilingsByFormType(params: {
  formType: string;
  from: string;
  to: string;
  page?: number;
  limit?: number;
}) {
  return await fmpService.getSECFilingsByFormType(params);
}

export async function getFMPSECFilingsBySymbol(params: {
  symbol: string;
  from: string;
  to: string;
  page?: number;
  limit?: number;
}) {
  return await fmpService.getSECFilingsBySymbol(params);
}

export async function getFMPSECFilingsByCIK(params: {
  cik: string;
  from: string;
  to: string;
  page?: number;
  limit?: number;
}) {
  return await fmpService.getSECFilingsByCIK(params);
}

export async function searchFMPSECFilingsByName(company: string) {
  return await fmpService.searchSECFilingsByName(company);
}

export async function searchFMPSECCompanyBySymbol(symbol: string) {
  return await fmpService.searchSECCompanyBySymbol(symbol);
}

export async function searchFMPSECCompanyByCIK(cik: string) {
  return await fmpService.searchSECCompanyByCIK(cik);
}

export async function getFMPSECCompanyFullProfile(params: {
  symbol: string;
  cik?: string;
}) {
  return await fmpService.getSECCompanyFullProfile(params);
}

export async function getFMPIndustryClassificationList(params?: {
  industryTitle?: string;
  sicCode?: string;
}) {
  return await fmpService.getIndustryClassificationList(params);
}

export async function searchFMPIndustryClassification(params?: {
  symbol?: string;
  cik?: string;
  sicCode?: string;
}) {
  return await fmpService.searchIndustryClassification(params);
}

export async function getFMPAllIndustryClassification(params?: {
  page?: number;
  limit?: number;
}) {
  return await fmpService.getAllIndustryClassification(params);
}

// ========== Company Search ==========

import type {
  SymbolSearchQueryParams,
  NameSearchQueryParams,
  CIKSearchQueryParams,
  CUSIPSearchQueryParams,
  ISINSearchQueryParams,
  FMPStockScreenerQueryParams,
  ExchangeVariantsQueryParams,
} from './types/fmp/company-search';

export async function getFMPSearchSymbol(params: SymbolSearchQueryParams) {
  return await fmpService.searchSymbol(params);
}

export async function getFMPSearchName(params: NameSearchQueryParams) {
  return await fmpService.searchName(params);
}

export async function getFMPSearchCIK(params: CIKSearchQueryParams) {
  return await fmpService.searchCIK(params);
}

export async function getFMPSearchCUSIP(params: CUSIPSearchQueryParams) {
  return await fmpService.searchCUSIP(params);
}

export async function getFMPSearchISIN(params: ISINSearchQueryParams) {
  return await fmpService.searchISIN(params);
}

export async function getFMPStockScreener(params?: FMPStockScreenerQueryParams) {
  return await fmpService.stockScreener(params);
}

export async function getFMPSearchExchangeVariants(params: ExchangeVariantsQueryParams) {
  return await fmpService.searchExchangeVariants(params);
}

// ========== Market Hours ==========

export async function getFMPExchangeMarketHours(exchange: string) {
  return await fmpService.getExchangeMarketHours(exchange);
}

export async function getFMPHolidaysByExchange(exchange: string) {
  return await fmpService.getHolidaysByExchange(exchange);
}

export async function getFMPAllExchangeMarketHours() {
  return await fmpService.getAllExchangeMarketHours();
}

// ========== Commodity ==========

export async function getFMPCommoditiesList() {
  return await fmpService.getCommoditiesList();
}

export async function getFMPCommoditiesQuote(symbol: string) {
  return await fmpService.getCommoditiesQuote(symbol);
}

export async function getFMPCommoditiesQuoteShort(symbol: string) {
  return await fmpService.getCommoditiesQuoteShort(symbol);
}

export async function getFMPBatchCommodityQuotes(short: boolean = false) {
  return await fmpService.getBatchCommodityQuotes(short);
}

export async function getFMPHistoricalPriceEODLightCommodity(params: {
  symbol: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getHistoricalPriceEODLightCommodity(params);
}

export async function getFMPHistoricalPriceEODFullCommodity(params: {
  symbol: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getHistoricalPriceEODFullCommodity(params);
}

// ========== Historical Price EOD (stocks / generic) ==========

export async function getFMPHistoricalPriceEODLight(params: {
  symbol: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getLightChart(params);
}

export async function getFMPHistoricalPriceEODFull(params: {
  symbol: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getFullChart(params);
}
// need subscription
export async function getFMPHistoricalChart1MinCommodity(params: {
  symbol: string;
  from: string;
  to: string;
}) {
  return await fmpService.getHistoricalChart1MinCommodity(params);
}

export async function getFMPHistoricalChart5MinCommodity(params: {
  symbol: string;
  from: string;
  to: string;
}) {
  return await fmpService.getHistoricalChart5MinCommodity(params);
}

export async function getFMPHistoricalChart1HourCommodity(params: {
  symbol: string;
  from: string;
  to: string;
}) {
  return await fmpService.getHistoricalChart1HourCommodity(params);
}

// ========== DCF (Discounted Cash Flow) ==========

export async function getFMPDCFValuation(symbol: string) {
  return await fmpService.getDCFValuation(symbol);
}

export async function getFMPLeveredDCF(symbol: string) {
  return await fmpService.getLeveredDCF(symbol);
}

export async function getFMPCustomDCFAdvanced(params: {
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
}) {
  return await fmpService.getCustomDCFAdvanced(params);
}

export async function getFMPCustomDCFLevered(params: {
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
}) {
  return await fmpService.getCustomDCFLevered(params);
}

// ========== Crypto ==========

export async function getFMPCryptocurrencyList() {
  return await fmpService.getCryptocurrencyList();
}

export async function getFMPCryptocurrencyQuote(symbol: string) {
  return await fmpService.getCryptocurrencyQuote(symbol);
}

export async function getFMPCryptocurrencyQuoteShort(symbol: string) {
  return await fmpService.getCryptocurrencyQuoteShort(symbol);
}
// need subscription
export async function getFMPBatchCryptocurrencyQuotes(short: boolean = false) {
  return await fmpService.getBatchCryptocurrencyQuotes(short);
}

export async function getFMPHistoricalCryptocurrencyPriceLight(params: {
  symbol: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getHistoricalCryptocurrencyPriceLight(params);
}

export async function getFMPHistoricalCryptocurrencyPriceFull(params: {
  symbol: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getHistoricalCryptocurrencyPriceFull(params);
}

export async function getFMPHistoricalCryptocurrencyChart5Min(params: {
  symbol: string;
  from: string;
  to: string;
}) {
  return await fmpService.getHistoricalCryptocurrencyChart5Min(params);
}

export async function getFMPHistoricalCryptocurrencyChart1Hour(params: {
  symbol: string;
  from: string;
  to: string;
}) {
  return await fmpService.getHistoricalCryptocurrencyChart1Hour(params);
}

// ========== Technical Indicators ==========

export async function getFMPSMA(params: {
  symbol: string;
  periodLength: number;
  timeframe: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getSMA(params);
}

export async function getFMPEMA(params: {
  symbol: string;
  periodLength: number;
  timeframe: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getEMA(params);
}

export async function getFMPWMA(params: {
  symbol: string;
  periodLength: number;
  timeframe: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getWMA(params);
}

export async function getFMPDEMA(params: {
  symbol: string;
  periodLength: number;
  timeframe: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getDEMA(params);
}

export async function getFMPTEMA(params: {
  symbol: string;
  periodLength: number;
  timeframe: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getTEMA(params);
}

export async function getFMPRSI(params: {
  symbol: string;
  periodLength: number;
  timeframe: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getRSI(params);
}

export async function getFMPStandardDeviation(params: {
  symbol: string;
  periodLength: number;
  timeframe: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getStandardDeviation(params);
}

export async function getFMPWilliams(params: {
  symbol: string;
  periodLength: number;
  timeframe: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getWilliams(params);
}

export async function getFMPADX(params: {
  symbol: string;
  periodLength: number;
  timeframe: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getADX(params);
}

// ========== ETF & Mutual Funds ==========

export async function getFMPETFFundHoldings(symbol: string) {
  return await fmpService.getETFFundHoldings(symbol);
}

export async function getFMPETFMutualFundInfo(symbol: string) {
  return await fmpService.getETFMutualFundInfo(symbol);
}

export async function getFMPETFFundCountryAllocation(symbol: string) {
  return await fmpService.getETFFundCountryAllocation(symbol);
}

export async function getFMPETFAssetExposure(symbol: string) {
  return await fmpService.getETFAssetExposure(symbol);
}

export async function getFMPETFSectorWeighting(symbol: string) {
  return await fmpService.getETFSectorWeighting(symbol);
}

// ========== Economics ==========

export async function getFMPTreasuryRates(params: { from?: string; to?: string }) {
  return await fmpService.getTreasuryRates(params);
}

export async function getFMPEconomicIndicators(params: {
  name: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getEconomicIndicators(params);
}

export async function getFMPEconomicCalendar(params: { from?: string; to?: string }) {
  return await fmpService.getEconomicCalendar(params);
}

export async function getFMPMarketRiskPremium() {
  return await fmpService.getMarketRiskPremium();
}

// ========== Earnings, Dividends, Splits ==========

export async function getFMPDividendsCompany(symbol: string) {
  return await fmpService.getDividendsCompany(symbol);
}

export async function getFMPDividendsCalendar(params: { from?: string; to?: string }) {
  return await fmpService.getDividendsCalendar(params);
}

export async function getFMPEarningsReport(symbol: string) {
  return await fmpService.getEarningsReport(symbol);
}

export async function getFMPEarningsCalendar(params: { from?: string; to?: string }) {
  return await fmpService.getEarningsCalendar(params);
}

export async function getFMPIPOsCalendar(params: { from?: string; to?: string }) {
  return await fmpService.getIPOsCalendar(params);
}

export async function getFMPIPOsDisclosure(params: { from?: string; to?: string }) {
  return await fmpService.getIPOsDisclosure(params);
}

export async function getFMPIPOsProspectus(params: { from?: string; to?: string }) {
  return await fmpService.getIPOsProspectus(params);
}

export async function getFMPStockSplitDetails(symbol: string) {
  return await fmpService.getStockSplitDetails(symbol);
}

export async function getFMPStockSplitsCalendar(params: { from?: string; to?: string }) {
  return await fmpService.getStockSplitsCalendar(params);
}

// ========== Earnings Transcript ==========

export async function getFMPLatestEarningTranscripts() {
  return await fmpService.getLatestEarningTranscripts();
}

export async function getFMPEarningsTranscript(params: {
  symbol: string;
  year: number;
  quarter: number;
}) {
  return await fmpService.getEarningsTranscript(params);
}

export async function getFMPTranscriptsDatesBySymbol(symbol: string) {
  return await fmpService.getTranscriptsDatesBySymbol(symbol);
}

export async function getFMPAvailableTranscriptSymbols() {
  return await fmpService.getAvailableTranscriptSymbols();
}

// ========== News ==========

export async function getFMPFMPArticles(params: { page?: number; limit?: number }) {
  return await fmpService.getFMPArticles(params);
}

export async function getFMPGeneralNews(params: { page?: number; limit?: number }) {
  return await fmpService.getGeneralNews(params);
}
// need subscription nedd
export async function getFMPPressReleases(params: { page?: number; limit?: number }) {
  return await fmpService.getPressReleases(params);
}

export async function getFMPStockNews(params: { page?: number; limit?: number }) {
  return await fmpService.getStockNews(params);
}

export async function getFMPCryptoNews(params: { page?: number; limit?: number }) {
  return await fmpService.getCryptoNews(params);
}

// ========== Financial Estimates ==========

export async function getFMPFinancialEstimates(params: {
  symbol: string;
  period: 'annual' | 'quarter';
  page?: number;
  limit?: number;
}) {
  return await fmpService.getFinancialEstimates(params);
}

export async function getFMPRatingsSnapshot(symbol: string) {
  return await fmpService.getRatingsSnapshot(symbol);
}

export async function getFMPHistoricalRatings(params: {
  symbol: string;
  limit?: number;
}) {
  return await fmpService.getHistoricalRatings(params);
}

export async function getFMPPriceTargetSummary(symbol: string) {
  return await fmpService.getPriceTargetSummary(symbol);
}

export async function getFMPPriceTargetConsensus(symbol: string) {
  return await fmpService.getPriceTargetConsensus(symbol);
}

export async function getFMPStockGrades(symbol: string) {
  return await fmpService.getStockGrades(symbol);
}

export async function getFMPHistoricalStockGrades(params: {
  symbol: string;
  limit?: number;
}) {
  return await fmpService.getHistoricalStockGrades(params);
}

export async function getFMPStockGradesSummary(symbol: string) {
  return await fmpService.getStockGradesSummary(symbol);
}

// ========== Market Performance ==========

export async function getFMPMarketSectorPerformanceSnapshot(params: {
  date: string;
  exchange?: string;
  sector?: string;
}) {
  return await fmpService.getMarketSectorPerformanceSnapshot(params);
}

export async function getFMPIndustryPerformanceSnapshot(params: {
  date: string;
  exchange?: string;
  industry?: string;
}) {
  return await fmpService.getIndustryPerformanceSnapshot(params);
}

export async function getFMPHistoricalMarketSectorPerformance(params: {
  sector: string;
  from?: string;
  to?: string;
  exchange?: string;
}) {
  return await fmpService.getHistoricalMarketSectorPerformance(params);
}

export async function getFMPHistoricalIndustryPerformance(params: {
  industry: string;
  from?: string;
  to?: string;
  exchange?: string;
}) {
  return await fmpService.getHistoricalIndustryPerformance(params);
}

export async function getFMPSectorPESnapshot(params: {
  date: string;
  exchange?: string;
  sector?: string;
}) {
  return await fmpService.getSectorPESnapshot(params);
}

export async function getFMPIndustryPESnapshot(params: {
  date: string;
  exchange?: string;
  industry?: string;
}) {
  return await fmpService.getIndustryPESnapshot(params);
}

export async function getFMPHistoricalSectorPE(params: {
  sector: string;
  from?: string;
  to?: string;
  exchange?: string;
}) {
  return await fmpService.getHistoricalSectorPE(params);
}

export async function getFMPHistoricalIndustryPE(params: {
  industry: string;
  from?: string;
  to?: string;
  exchange?: string;
}) {
  return await fmpService.getHistoricalIndustryPE(params);
}

export async function getFMPBiggestStockGainers() {
  return await fmpService.getBiggestStockGainers();
}

export async function getFMPBiggestStockLosers() {
  return await fmpService.getBiggestStockLosers();
}

export async function getFMPTopTradedStocks() {
  return await fmpService.getTopTradedStocks();
}

// ========== Insider Trades ==========

export async function getFMPLatestInsiderTrading(params: {
  date?: string;
  page?: number;
  limit?: number;
}) {
  return await fmpService.getLatestInsiderTrading(params);
}

export async function getFMPSearchInsiderTrades(params: {
  symbol?: string;
  page?: number;
  limit?: number;
  reportingCik?: string;
  companyCik?: string;
  transactionType?: string;
}) {
  return await fmpService.searchInsiderTrades(params);
}

export async function getFMPSearchInsiderTradesByReportingName(name: string) {
  return await fmpService.searchInsiderTradesByReportingName(name);
}

export async function getFMPAllInsiderTransactionTypes() {
  return await fmpService.getAllInsiderTransactionTypes();
}

export async function getFMPInsiderTradeStatistics(symbol: string) {
  return await fmpService.getInsiderTradeStatistics(symbol);
}

export async function getFMPAcquisitionOwnership(params: {
  symbol: string;
  limit?: number;
}) {
  return await fmpService.getAcquisitionOwnership(params);
}

// ========== Indexes ==========

export async function getFMPStockMarketIndexesList() {
  return await fmpService.getStockMarketIndexesList();
}

export async function getFMPIndexQuote(symbol: string) {
  return await fmpService.getIndexQuote(symbol);
}

export async function getFMPIndexShortQuote(symbol: string) {
  return await fmpService.getIndexShortQuote(symbol);
}

export async function getFMPAllIndexQuotes(short: boolean = false) {
  return await fmpService.getAllIndexQuotes(short);
}

export async function getFMPHistoricalIndexPriceLight(params: {
  symbol: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getHistoricalIndexPriceLight(params);
}

export async function getFMPHistoricalIndexPriceFull(params: {
  symbol: string;
  from?: string;
  to?: string;
}) {
  return await fmpService.getHistoricalIndexPriceFull(params);
}

export async function getFMPHistoricalIndexChart1Min(params: {
  symbol: string;
  from: string;
  to: string;
}) {
  return await fmpService.getHistoricalIndexChart1Min(params);
}

export async function getFMPHistoricalIndexChart5Min(params: {
  symbol: string;
  from: string;
  to: string;
}) {
  return await fmpService.getHistoricalIndexChart5Min(params);
}

export async function getFMPHistoricalIndexChart1Hour(params: {
  symbol: string;
  from: string;
  to: string;
}) {
  return await fmpService.getHistoricalIndexChart1Hour(params);
}

export async function getFMPSP500Constituent() {
  return await fmpService.getSP500Constituent();
}

export async function getFMPNasdaqConstituent() {
  return await fmpService.getNasdaqConstituent();
}

export async function getFMPDowJonesConstituent() {
  return await fmpService.getDowJonesConstituent();
}

export async function getFMPHistoricalSP500Constituent() {
  return await fmpService.getHistoricalSP500Constituent();
}

export async function getFMPHistoricalNasdaqConstituent() {
  return await fmpService.getHistoricalNasdaqConstituent();
}

export async function getFMPHistoricalDowJonesConstituent() {
  return await fmpService.getHistoricalDowJonesConstituent();
}

// ========== Senate ==========

export async function getFMPLatestSenateFinancialDisclosures(params: {
  page?: number;
  limit?: number;
}) {
  return await fmpService.getLatestSenateFinancialDisclosures(params);
}

export async function getFMPLatestHouseFinancialDisclosures(params: {
  page?: number;
  limit?: number;
}) {
  return await fmpService.getLatestHouseFinancialDisclosures(params);
}

export async function getFMPSenateTradingActivity(symbol: string) {
  return await fmpService.getSenateTradingActivity(symbol);
}

export async function getFMPSenateTradesByName(name: string) {
  return await fmpService.getSenateTradesByName(name);
}

export async function getFMPUSHouseTrades(symbol: string) {
  return await fmpService.getUSHouseTrades(symbol);
}

export async function getFMPHouseTradesByName(name: string) {
  return await fmpService.getHouseTradesByName(name);
}

// ========== Quote ==========

export async function getFMPStockQuote(symbol: string) {
  return await fmpService.getStockQuote(symbol);
}

export async function getFMPStockQuoteShort(symbol: string) {
  return await fmpService.getStockQuoteShort(symbol);
}

export async function getFMPAftermarketTrade(symbol: string) {
  return await fmpService.getAftermarketTrade(symbol);
}

export async function getFMPAftermarketQuote(symbol: string) {
  return await fmpService.getAftermarketQuote(symbol);
}

export async function getFMPStockPriceChange(symbol: string) {
  return await fmpService.getStockPriceChange(symbol);
}

