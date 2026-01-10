/**
 * Service métier Unusual Whales
 * Contient la logique métier, utilise le repository pour l'accès aux données
 */

import { UnusualWhalesRepository } from '../repositories/unusual-whales.repository';
import { CacheService } from './cache.service';
import { TickerDataPersistenceService } from './ticker-data-persistence.service';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types/ticker.types';
import { handleError } from '../utils/errors';
import type {
  AlertsResponse,
  AlertConfigurationResponse,
  AlertsQueryParams,
  AlertConfigurationQueryParams,
} from '../types/unusual-whales/alerts';
import type {
  CongressTraderResponse,
  CongressLateReportsResponse,
  CongressRecentTradesResponse,
  CongressTraderQueryParams,
  CongressLateReportsQueryParams,
  CongressRecentTradesQueryParams,
} from '../types/unusual-whales/congress';
import type {
  DarkPoolRecentResponse,
  DarkPoolTickerResponse,
  DarkPoolRecentQueryParams,
  DarkPoolTickerQueryParams,
} from '../types/unusual-whales/darkpool';
import type {
  EarningsAfterhoursResponse,
  EarningsPremarketResponse,
  EarningsHistoricalResponse,
  EarningsAfterhoursQueryParams,
  EarningsPremarketQueryParams,
  EarningsHistoricalQueryParams,
} from '../types/unusual-whales/earnings';
import type {
  ETFExposureResponse,
  ETFHoldingsResponse,
  ETFInOutflowResponse,
  ETFInfoResponse,
  ETFWeightsResponse,
  ETFExposureQueryParams,
  ETFHoldingsQueryParams,
  ETFInOutflowQueryParams,
  ETFInfoQueryParams,
  ETFWeightsQueryParams,
} from '../types/unusual-whales/etf';
import type {
  GroupGreekFlowResponse,
  GroupGreekFlowByExpiryResponse,
  GroupGreekFlowQueryParams,
  GroupGreekFlowByExpiryQueryParams,
  FlowGroup,
} from '../types/unusual-whales/group-flow';
import type {
  InsiderTransactionsResponse,
  InsiderSectorFlowResponse,
  InsiderTickerFlowResponse,
  InsidersResponse,
  InsiderTransactionsQueryParams,
  InsiderSectorFlowQueryParams,
  InsidersQueryParams,
  InsiderTickerFlowQueryParams,
  FinancialSector,
} from '../types/unusual-whales/insiders';
import type {
  InstitutionalActivityResponse,
  InstitutionalHoldingsResponse,
  SectorExposureResponse,
  InstitutionalOwnershipResponse,
  InstitutionsResponse,
  LatestFilingsResponse,
  InstitutionalActivityQueryParams,
  InstitutionalHoldingsQueryParams,
  SectorExposureQueryParams,
  InstitutionalOwnershipQueryParams,
  InstitutionsQueryParams,
  LatestFilingsQueryParams,
} from '../types/unusual-whales/institutions';
import type {
  CorrelationsResponse,
  CorrelationsQueryParams,
  EconomicCalendarResponse,
  EconomicCalendarQueryParams,
  FDACalendarResponse,
  FDACalendarQueryParams,
  InsiderBuySellsResponse,
  InsiderBuySellsQueryParams,
  MarketTideResponse,
  MarketTideQueryParams,
  OIChangeResponse,
  OIChangeQueryParams,
  SectorETFsResponse,
  SectorETFsQueryParams,
  SpikeResponse,
  SpikeQueryParams,
  TopNetImpactResponse,
  TopNetImpactQueryParams,
  TotalOptionsVolumeResponse,
  TotalOptionsVolumeQueryParams,
  SectorTideResponse,
  SectorTideQueryParams,
  ETFTideResponse,
  ETFTideQueryParams,
  NetFlowExpiryResponse,
  NetFlowExpiryQueryParams,
} from '../types/unusual-whales/market';
import type {
  SectorTickersResponse,
  SectorTickersQueryParams,
  ATMChainsResponse,
  ATMChainsQueryParams,
  FlowAlertsResponse,
  FlowAlertsQueryParams,
  FlowPerExpiryResponse,
  FlowPerExpiryQueryParams,
  FlowPerStrikeResponse,
  FlowPerStrikeQueryParams,
  FlowPerStrikeIntradayResponse,
  FlowPerStrikeIntradayQueryParams,
  RecentFlowsResponse,
  RecentFlowsQueryParams,
  GreekExposureResponse,
  GreekExposureQueryParams,
  GreekExposureByExpiryResponse,
  GreekExposureByExpiryQueryParams,
  GreekExposureByStrikeResponse,
  GreekExposureByStrikeQueryParams,
  GreekExposureByStrikeAndExpiryResponse,
  GreekExposureByStrikeAndExpiryQueryParams,
  GreekFlowResponse,
  GreekFlowQueryParams,
  GreekFlowByExpiryResponse,
  GreekFlowByExpiryQueryParams,
  GreeksResponse,
  GreeksQueryParams,
  HistoricalRiskReversalSkewResponse,
  HistoricalRiskReversalSkewQueryParams,
  StockInfoResponse,
  StockInfoQueryParams,
  InsiderBuySellsResponse as StockInsiderBuySellsResponse,
  InsiderBuySellsQueryParams as StockInsiderBuySellsQueryParams,
  InterpolatedIVResponse,
  InterpolatedIVQueryParams,
  IVRankResponse,
  IVRankQueryParams,
  MaxPainResponse,
  MaxPainQueryParams,
  NetPremiumTicksResponse,
  NetPremiumTicksQueryParams,
  NOPEResponse,
  NOPEQueryParams,
  OHLCResponse,
  OHLCQueryParams,
  OIChangeResponse as StockOIChangeResponse,
  OIChangeQueryParams as StockOIChangeQueryParams,
  OIPerExpiryResponse,
  OIPerExpiryQueryParams,
  OIPerStrikeResponse,
  OIPerStrikeQueryParams,
  OptionChainsResponse,
  OptionChainsQueryParams,
  OptionStockPriceLevelsResponse,
  OptionStockPriceLevelsQueryParams,
  VolumeOIPerExpiryResponse,
  VolumeOIPerExpiryQueryParams,
  OptionsVolumeResponse,
  OptionsVolumeQueryParams,
  SpotExposuresResponse,
  SpotExposuresQueryParams,
  SpotExposureByStrikeAndExpiryResponse,
  SpotExposureByStrikeAndExpiryQueryParams,
  SpotExposureByStrikeResponse,
  SpotExposureByStrikeQueryParams,
  StockStateResponse,
  StockStateQueryParams,
  StockVolumePriceLevelsResponse,
  StockVolumePriceLevelsQueryParams,
  RealizedVolatilityResponse,
  RealizedVolatilityQueryParams,
  VolatilityStatsResponse,
  VolatilityStatsQueryParams,
  VolatilityTermStructureResponse,
  VolatilityTermStructureQueryParams,
} from '../types/unusual-whales/stock';
import type {
  ShortDataResponse,
  ShortDataQueryParams,
  FailuresToDeliverResponse,
  FailuresToDeliverQueryParams,
  ShortInterestAndFloatResponse,
  ShortInterestAndFloatQueryParams,
  ShortVolumeAndRatioResponse,
  ShortVolumeAndRatioQueryParams,
  ShortVolumeByExchangeResponse,
  ShortVolumeByExchangeQueryParams,
} from '../types/unusual-whales/shorts';
import type {
  YearMonthPriceChangeQueryParams,
  YearMonthPriceChangeResponse,
  MonthlyAverageReturnQueryParams,
  MonthlyAverageReturnResponse,
  MonthPerformersQueryParams,
  MonthPerformersResponse,
  MarketSeasonalityQueryParams,
  MarketSeasonalityResponse,
} from '../types/unusual-whales/seasonality';
import type {
  AnalystRatingQueryParams,
  AnalystRatingResponse,
  OptionContractsQueryParams,
  OptionContractsResponse,
  StockScreenerQueryParams,
  StockScreenerResponse,
} from '../types/unusual-whales/screener';
import type {
  OptionTradeFlowAlertsQueryParams,
  OptionTradeFlowAlertsResponse,
  FullTapeQueryParams,
} from '../types/unusual-whales/option-trade';
import type {
  OptionContractFlowQueryParams,
  OptionContractFlowResponse,
  OptionContractHistoricQueryParams,
  OptionContractHistoricResponse,
  OptionContractIntradayQueryParams,
  OptionContractIntradayResponse,
  OptionContractVolumeProfileQueryParams,
  OptionContractVolumeProfileResponse,
  ExpiryBreakdownQueryParams,
  ExpiryBreakdownResponse,
  StockOptionContractsQueryParams,
  StockOptionContractsResponse,
} from '../types/unusual-whales/option-contract';
import type {
  NewsHeadlinesQueryParams,
  NewsHeadlinesResponse,
} from '../types/unusual-whales/news';

export class UnusualWhalesService {
  private repository: UnusualWhalesRepository;
  private cache: CacheService;
  private persistenceService: TickerDataPersistenceService;

  constructor() {
    this.repository = new UnusualWhalesRepository();
    this.cache = new CacheService({ tableName: 'unusual_whales_cache', ttlHours: 24 });
    this.persistenceService = new TickerDataPersistenceService();
  }

  // ========== Institutions ==========

  // ========== Options Flow ==========

  async getOptionsFlow(ticker: string, options?: Record<string, any>): Promise<ApiResponse<any[]>> {
    return handleError(async () => {
      const data = await this.repository.getOptionsFlow(ticker, options);
      return {
        success: true,
        data,
        cached: false,
        count: data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get options flow for ${ticker}`);
  }

  /**
   * Récupère les dernières transactions d'insiders
   * GET /insider/transactions
   * 
   * @param params Paramètres de requête (filtres nombreux)
   * @returns Réponse standardisée avec les transactions d'insiders
   */
  async getInsiderTransactions(params?: InsiderTransactionsQueryParams): Promise<ApiResponse<InsiderTransactionsResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getInsiderTransactions', params });
      log.info('Fetching insider transactions from API');
      
      const response = await this.repository.getInsiderTransactions(params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, 'Get insider transactions');
  }

  /**
   * Récupère une vue agrégée du flow d'insiders pour un secteur donné
   * GET /insider/{sector}/sector-flow
   * 
   * @param sector Secteur financier (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse standardisée avec le flow d'insiders par secteur
   */
  async getInsiderSectorFlow(sector: FinancialSector, params?: InsiderSectorFlowQueryParams): Promise<ApiResponse<InsiderSectorFlowResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getInsiderSectorFlow', sector });
      log.info('Fetching insider sector flow from API');
      
      const response = await this.repository.getInsiderSectorFlow(sector, params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get insider sector flow for ${sector}`);
  }

  /**
   * Récupère tous les insiders pour un ticker donné
   * GET /insider/{ticker}
   * 
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse standardisée avec les insiders
   */
  async getInsiders(ticker: string, params?: InsidersQueryParams): Promise<ApiResponse<InsidersResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getInsiders', ticker });
      log.info('Fetching insiders from API');
      
      const response = await this.repository.getInsiders(ticker, params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get insiders for ${ticker}`);
  }

  /**
   * Récupère une vue agrégée du flow d'insiders pour un ticker donné
   * GET /insider/{ticker}/ticker-flow
   * 
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse standardisée avec le flow d'insiders par ticker
   */
  async getInsiderTickerFlow(ticker: string, params?: InsiderTickerFlowQueryParams): Promise<ApiResponse<InsiderTickerFlowResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getInsiderTickerFlow', ticker });
      log.info('Fetching insider ticker flow from API');
      
      const response = await this.repository.getInsiderTickerFlow(ticker, params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get insider ticker flow for ${ticker}`);
  }

  async getFlowAlerts(ticker: string, options?: Record<string, any>): Promise<ApiResponse<any[]>> {
    return this.getOptionsFlow(ticker, options);
  }

  async getGreekFlow(ticker: string, options?: Record<string, any>): Promise<ApiResponse<any>> {
    return handleError(async () => {
      const data = await this.repository.getGreekFlow(ticker, options);
      return {
        success: true,
        data,
        cached: false,
        timestamp: new Date().toISOString(),
      };
    }, `Get greek flow for ${ticker}`);
  }

  // ========== Dark Pool ==========

  /**
   * Récupère les derniers dark pool trades
   * GET /darkpool/recent
   * 
   * @param params Paramètres de requête (date, limit, filtres premium/size/volume)
   * @returns Réponse standardisée avec les dark pool trades récents
   */
  async getDarkPoolRecent(params?: DarkPoolRecentQueryParams): Promise<ApiResponse<DarkPoolRecentResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getDarkPoolRecent', params });
      log.info('Fetching dark pool recent from API');
      
      const response = await this.repository.getDarkPoolRecent(params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, 'Get dark pool recent');
  }

  /**
   * Récupère les dark pool trades pour un ticker donné
   * GET /darkpool/{ticker}
   * 
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date, limit, filtres, pagination)
   * @returns Réponse standardisée avec les dark pool trades du ticker
   */
  async getDarkPoolTrades(ticker: string, params?: DarkPoolTickerQueryParams): Promise<ApiResponse<DarkPoolTickerResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getDarkPoolTrades', ticker, params });
      
      // Utiliser le service de persistance qui vérifie la fraîcheur et stocke dans dark_pool_trades
      const result = await this.persistenceService.getOrFetchDarkPool(
        ticker,
        async () => {
          log.info('Fetching dark pool trades from UW API');
          const response = await this.repository.getDarkPoolTrades(ticker, params);
          return response.data || [];
        },
        24 // maxAgeHours: 24h pour dark pool
      );
      
      return {
        success: true,
        data: result.data,
        cached: result.fromCache,
        count: result.data.length,
        timestamp: result.dataDate || new Date().toISOString(),
      };
    }, `Get dark pool trades for ${ticker}`);
  }

  // ========== Insider & Congress ==========


  // ========== Congress ==========

  /**
   * Récupère les rapports récents par un membre du Congrès
   * GET /congress/congress-trader
   * 
   * @param params Paramètres de requête (date, limit, name, ticker)
   * @returns Réponse standardisée avec les trades
   */
  async getCongressTrader(params?: CongressTraderQueryParams): Promise<ApiResponse<CongressTraderResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getCongressTrader', params });
      log.info('Fetching congress trader from API');
      
      const response = await this.repository.getCongressTrader(params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, 'Get congress trader');
  }

  /**
   * Récupère les rapports tardifs récents par les membres du Congrès
   * GET /congress/late-reports
   * 
   * @param params Paramètres de requête (date, limit, ticker)
   * @returns Réponse standardisée avec les rapports tardifs
   */
  async getCongressLateReports(params?: CongressLateReportsQueryParams): Promise<ApiResponse<CongressLateReportsResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getCongressLateReports', params });
      log.info('Fetching congress late reports from API');
      
      const response = await this.repository.getCongressLateReports(params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, 'Get congress late reports');
  }

  /**
   * Récupère les trades récents du Congrès
   * GET /congress/recent-trades
   * 
   * @param params Paramètres de requête (date, limit, ticker)
   * @returns Réponse standardisée avec les trades récents
   */
  async getCongressRecentTrades(params?: CongressRecentTradesQueryParams): Promise<ApiResponse<CongressRecentTradesResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getCongressRecentTrades', params });
      log.info('Fetching congress recent trades from API');
      
      const response = await this.repository.getCongressRecentTrades(params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, 'Get congress recent trades');
  }

  // Alias pour compatibilité (ancienne méthode)
  async getCongressTrades(ticker: string, options?: Record<string, any>): Promise<ApiResponse<CongressRecentTradesResponse['data']>> {
    const params: CongressRecentTradesQueryParams = {
      ticker: ticker.toUpperCase(),
      ...options,
    };
    return this.getCongressRecentTrades(params);
  }


  // ========== Alerts ==========

  /**
   * Récupère toutes les alertes déclenchées pour l'utilisateur
   * GET /alerts
   * 
   * @param params Paramètres de requête (filtres, pagination, etc.)
   * @returns Réponse standardisée avec les alertes
   */
  async getAlerts(params?: AlertsQueryParams): Promise<ApiResponse<AlertsResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getAlerts', params });
      log.info('Fetching alerts from API');
      
      const response = await this.repository.getAlerts(params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, 'Get alerts');
  }

  /**
   * Récupère toutes les configurations d'alertes de l'utilisateur
   * GET /alerts/configuration
   * 
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse standardisée avec les configurations
   */
  async getAlertConfigurations(params?: AlertConfigurationQueryParams): Promise<ApiResponse<AlertConfigurationResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getAlertConfigurations' });
      log.info('Fetching alert configurations from API');
      
      const response = await this.repository.getAlertConfigurations(params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, 'Get alert configurations');
  }

  // ========== Earnings ==========

  /**
   * Récupère les earnings afterhours pour une date donnée
   * GET /earnings/afterhours
   * 
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse standardisée avec les earnings afterhours
   */
  async getEarningsAfterhours(params?: EarningsAfterhoursQueryParams): Promise<ApiResponse<EarningsAfterhoursResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getEarningsAfterhours', params });
      log.info('Fetching earnings afterhours from API');
      
      const response = await this.repository.getEarningsAfterhours(params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, 'Get earnings afterhours');
  }

  /**
   * Récupère les earnings premarket pour une date donnée
   * GET /earnings/premarket
   * 
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse standardisée avec les earnings premarket
   */
  async getEarningsPremarket(params?: EarningsPremarketQueryParams): Promise<ApiResponse<EarningsPremarketResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getEarningsPremarket', params });
      log.info('Fetching earnings premarket from API');
      
      const response = await this.repository.getEarningsPremarket(params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, 'Get earnings premarket');
  }

  /**
   * Récupère les earnings historiques pour un ticker donné
   * GET /earnings/{ticker}
   * 
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse standardisée avec les earnings historiques
   */
  async getEarningsHistorical(ticker: string, params?: EarningsHistoricalQueryParams): Promise<ApiResponse<EarningsHistoricalResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getEarningsHistorical', ticker });
      log.info('Fetching earnings historical from API');
      
      const response = await this.repository.getEarningsHistorical(ticker, params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get earnings historical for ${ticker}`);
  }

  // ========== ETF ==========

  /**
   * Récupère tous les ETFs dans lesquels le ticker donné est un holding
   * GET /etfs/{ticker}/exposure
   * 
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse standardisée avec les ETFs contenant le ticker
   */
  async getETFExposure(ticker: string, params?: ETFExposureQueryParams): Promise<ApiResponse<ETFExposureResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getETFExposure', ticker });
      log.info('Fetching ETF exposure from API');
      
      const response = await this.repository.getETFExposure(ticker, params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get ETF exposure for ${ticker}`);
  }

  /**
   * Récupère les holdings de l'ETF
   * GET /etfs/{ticker}/holdings
   * 
   * @param ticker Symbole du ticker ETF (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse standardisée avec les holdings de l'ETF
   */
  async getETFHoldings(ticker: string, params?: ETFHoldingsQueryParams): Promise<ApiResponse<ETFHoldingsResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getETFHoldings', ticker });
      log.info('Fetching ETF holdings from API');
      
      const response = await this.repository.getETFHoldings(ticker, params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get ETF holdings for ${ticker}`);
  }

  /**
   * Récupère l'inflow et outflow d'un ETF
   * GET /etfs/{ticker}/in-outflow
   * 
   * @param ticker Symbole du ticker ETF (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse standardisée avec l'inflow/outflow de l'ETF
   */
  async getETFInOutflow(ticker: string, params?: ETFInOutflowQueryParams): Promise<ApiResponse<ETFInOutflowResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getETFInOutflow', ticker });
      log.info('Fetching ETF in-outflow from API');
      
      const response = await this.repository.getETFInOutflow(ticker, params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get ETF in-outflow for ${ticker}`);
  }

  /**
   * Récupère les informations sur l'ETF
   * GET /etfs/{ticker}/info
   * 
   * @param ticker Symbole du ticker ETF (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse standardisée avec les informations de l'ETF
   */
  async getETFInfo(ticker: string, params?: ETFInfoQueryParams): Promise<ApiResponse<ETFInfoResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getETFInfo', ticker });
      log.info('Fetching ETF info from API');
      
      const response = await this.repository.getETFInfo(ticker, params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        timestamp: new Date().toISOString(),
      };
    }, `Get ETF info for ${ticker}`);
  }

  /**
   * Récupère les poids sectoriels et par pays pour l'ETF
   * GET /etfs/{ticker}/weights
   * 
   * @param ticker Symbole du ticker ETF (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse standardisée avec les poids sectoriels et par pays
   */
  async getETFWeights(ticker: string, params?: ETFWeightsQueryParams): Promise<ApiResponse<ETFWeightsResponse>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getETFWeights', ticker });
      log.info('Fetching ETF weights from API');
      
      const response = await this.repository.getETFWeights(ticker, params);
      
      return {
        success: true,
        data: response,
        cached: false,
        timestamp: new Date().toISOString(),
      };
    }, `Get ETF weights for ${ticker}`);
  }

  // ========== Group Flow ==========

  /**
   * Récupère le greek flow (delta & vega flow) d'un flow group pour un jour de marché donné, décomposé par minute
   * GET /group-flow/{flow_group}/greek-flow
   * 
   * @param flowGroup Flow group (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse standardisée avec le greek flow par minute
   */
  async getGroupGreekFlow(flowGroup: FlowGroup, params?: GroupGreekFlowQueryParams): Promise<ApiResponse<GroupGreekFlowResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getGroupGreekFlow', flowGroup, params });
      log.info('Fetching group greek flow from API');
      
      const response = await this.repository.getGroupGreekFlow(flowGroup, params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get group greek flow for ${flowGroup}`);
  }

  /**
   * Récupère le greek flow (delta & vega flow) d'un flow group pour un jour de marché donné, décomposé par minute et expiry
   * GET /group-flow/{flow_group}/greek-flow/{expiry}
   * 
   * @param flowGroup Flow group (requis)
   * @param expiry Date d'expiration (format ISO, requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse standardisée avec le greek flow par minute et expiry
   */
  async getGroupGreekFlowByExpiry(
    flowGroup: FlowGroup,
    expiry: string,
    params?: GroupGreekFlowByExpiryQueryParams
  ): Promise<ApiResponse<GroupGreekFlowByExpiryResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getGroupGreekFlowByExpiry', flowGroup, expiry, params });
      log.info('Fetching group greek flow by expiry from API');
      
      const response = await this.repository.getGroupGreekFlowByExpiry(flowGroup, expiry, params);
      
      return {
        success: true,
        data: response.data,
        cached: false,
        count: response.data.length,
        timestamp: new Date().toISOString(),
      };
    }, `Get group greek flow by expiry for ${flowGroup} - ${expiry}`);
  }

  // ========== Institutions ==========

  /**
   * Récupère les activités de trading pour une institution donnée.
   * GET /institution/{name}/activity
   *
   * @param name Nom ou CIK de l'institution (requis)
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse standardisée avec les activités de trading
   */
  async getInstitutionActivity(name: string, params?: InstitutionalActivityQueryParams): Promise<ApiResponse<InstitutionalActivityResponse['data']>> {
    return handleError(async () => {
      // const cacheKey = `uw_institution_activity_${name}_${JSON.stringify(params)}`;
      // const cached = await this.cache.get<InstitutionalActivityResponse['data']>(cacheKey, 'cache_key');
      // if (cached) {
      //   return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      // }
      const response = await this.repository.getInstitutionalActivity(name, params);
      console.log('response', response);
      
      // await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get institutional activity for ${name}`);
  }

  /**
   * Récupère les holdings pour une institution donnée.
   * GET /institution/{name}/holdings
   *
   * @param name Nom ou CIK de l'institution (requis)
   * @param params Paramètres de requête (date, end_date, limit, order, order_direction, page, security_types, start_date)
   * @returns Réponse standardisée avec les holdings
   */
  async getInstitutionHoldings(name: string, params?: InstitutionalHoldingsQueryParams): Promise<ApiResponse<InstitutionalHoldingsResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_institution_holdings_${name}_${JSON.stringify(params)}`;
      const cached = await this.cache.get<InstitutionalHoldingsResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getInstitutionalHoldings(name, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get institutional holdings for ${name}`);
  }

  /**
   * Récupère l'exposition sectorielle pour une institution donnée.
   * GET /institution/{name}/sectors
   *
   * @param name Nom ou CIK de l'institution (requis)
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse standardisée avec l'exposition sectorielle
   */
  async getInstitutionSectorExposure(name: string, params?: SectorExposureQueryParams): Promise<ApiResponse<SectorExposureResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_institution_sector_exposure_${name}_${JSON.stringify(params)}`;
      const cached = await this.cache.get<SectorExposureResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getInstitutionSectorExposure(name, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get institution sector exposure for ${name}`);
  }

  /**
   * Récupère la propriété institutionnelle d'un ticker donné.
   * GET /institution/{ticker}/ownership
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date, end_date, limit, order, order_direction, page, start_date, tags)
   * @returns Réponse standardisée avec la propriété institutionnelle
   */
  async getInstitutionOwnership(ticker: string, params?: InstitutionalOwnershipQueryParams): Promise<ApiResponse<InstitutionalOwnershipResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_institution_ownership_${ticker}_${JSON.stringify(params)}`;
      const cached = await this.cache.get<InstitutionalOwnershipResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getInstitutionalOwnership(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get institutional ownership for ${ticker}`);
  }

  /**
   * Récupère une liste d'institutions.
   * GET /institutions
   *
   * @param params Paramètres de requête (limit, max_share_value, max_total_value, min_share_value, min_total_value, name, order, order_direction, page, tags)
   * @returns Réponse standardisée avec la liste des institutions
   */
  async getInstitutions(params?: InstitutionsQueryParams): Promise<ApiResponse<InstitutionsResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_institutions_list_${JSON.stringify(params)}`;
      const cached = await this.cache.get<InstitutionsResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getInstitutions(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get institutions list');
  }

  /**
   * Récupère les derniers dépôts institutionnels.
   * GET /institutions/latest_filings
   *
   * @param params Paramètres de requête (date, limit, name, order, order_direction, page)
   * @returns Réponse standardisée avec les derniers dépôts
   */
  async getLatestFilings(params?: LatestFilingsQueryParams): Promise<ApiResponse<LatestFilingsResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_latest_filings_${JSON.stringify(params)}`;
      const cached = await this.cache.get<LatestFilingsResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getLatestFilings(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get latest institutional filings');
  }

  // ========== Market ==========

  /**
   * Récupère les corrélations entre deux tickers
   * GET /market/correlations
   *
   * @param params Paramètres de requête (ticker1, ticker2, date)
   * @returns Réponse standardisée avec les corrélations
   */
  async getCorrelations(params: CorrelationsQueryParams): Promise<ApiResponse<CorrelationsResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_correlations_${params.tickers || 'latest'}`;
      const cached = await this.cache.get<CorrelationsResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getCorrelations(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get correlations');
  }

  /**
   * Récupère le calendrier économique
   * GET /market/economic-calendar
   *
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse standardisée avec le calendrier économique
   */
  async getEconomicCalendar(params?: EconomicCalendarQueryParams): Promise<ApiResponse<EconomicCalendarResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_economic_calendar_${JSON.stringify(params)}`;
      const cached = await this.cache.get<any>(cacheKey, 'cache_key');
      if (cached) {
        // Le cache retourne un objet avec une propriété 'data' qui contient le tableau
        const data = Array.isArray(cached.data) ? cached.data : (Array.isArray(cached) ? cached : []);
        return { success: true, data, cached: true, count: data.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getEconomicCalendar(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get economic calendar');
  }

  /**
   * Récupère le calendrier FDA
   * GET /market/fda-calendar
   *
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse standardisée avec le calendrier FDA
   */
  async getFDACalendar(params?: FDACalendarQueryParams): Promise<ApiResponse<FDACalendarResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_fda_calendar_${JSON.stringify(params)}`;
      const cached = await this.cache.get<any>(cacheKey, 'cache_key');
      if (cached) {
        // Le cache retourne un objet avec une propriété 'data' qui contient le tableau
        const data = Array.isArray(cached.data) ? cached.data : (Array.isArray(cached) ? cached : []);
        return { success: true, data, cached: true, count: data.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getFDACalendar(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get FDA calendar');
  }

  /**
   * Récupère les totaux d'achats et ventes d'insiders
   * GET /market/insider-buy-sells
   *
   * @param params Paramètres de requête (start_date, end_date, limit, page)
   * @returns Réponse standardisée avec les totaux d'achats et ventes
   */
  async getInsiderBuySells(params?: InsiderBuySellsQueryParams): Promise<ApiResponse<InsiderBuySellsResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_insider_buy_sells_${JSON.stringify(params)}`;
      const cached = await this.cache.get<InsiderBuySellsResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getInsiderBuySells(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get insider buy sells');
  }

  /**
   * Récupère le Market Tide
   * GET /market/market-tide
   *
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse standardisée avec le Market Tide
   */
  async getMarketTide(params?: MarketTideQueryParams): Promise<ApiResponse<MarketTideResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_market_tide_${JSON.stringify(params)}`;
      const cached = await this.cache.get<MarketTideResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getMarketTide(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get market tide');
  }

  /**
   * Récupère les changements d'Open Interest
   * GET /market/oi-change
   *
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse standardisée avec les changements d'OI
   */
  async getOIChange(params?: OIChangeQueryParams): Promise<ApiResponse<OIChangeResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_oi_change_${JSON.stringify(params)}`;
      const cached = await this.cache.get<OIChangeResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getOIChange(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get OI change');
  }

  /**
   * Récupère les ETFs sectoriels
   * GET /market/sector-etfs
   *
   * @param params Paramètres de requête (aucun selon la documentation)
   * @returns Réponse standardisée avec les ETFs sectoriels
   */
  async getSectorETFs(params?: SectorETFsQueryParams): Promise<ApiResponse<SectorETFsResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_sector_etfs`;
      const cached = await this.cache.get<SectorETFsResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getSectorETFs(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get sector ETFs');
  }

  /**
   * Récupère les SPIKE
   * GET /market/spike
   *
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse standardisée avec les SPIKE
   */
  async getSpike(params?: SpikeQueryParams): Promise<ApiResponse<SpikeResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_spike_${JSON.stringify(params)}`;
      const cached = await this.cache.get<SpikeResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getSpike(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get spike');
  }

  /**
   * Récupère le Top Net Impact
   * GET /market/top-net-impact
   *
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse standardisée avec le Top Net Impact
   */
  async getTopNetImpact(params?: TopNetImpactQueryParams): Promise<ApiResponse<TopNetImpactResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_top_net_impact_${JSON.stringify(params)}`;
      const cached = await this.cache.get<TopNetImpactResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getTopNetImpact(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get top net impact');
  }

  /**
   * Récupère le volume total d'options
   * GET /market/total-options-volume
   *
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse standardisée avec le volume total d'options
   */
  async getTotalOptionsVolume(params?: TotalOptionsVolumeQueryParams): Promise<ApiResponse<TotalOptionsVolumeResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_total_options_volume_${JSON.stringify(params)}`;
      const cached = await this.cache.get<TotalOptionsVolumeResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getTotalOptionsVolume(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get total options volume');
  }

  /**
   * Récupère le Sector Tide
   * GET /market/{sector}/sector-tide
   *
   * @param sector Secteur financier (requis)
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse standardisée avec le Sector Tide
   */
  async getSectorTide(sector: string, params?: SectorTideQueryParams): Promise<ApiResponse<SectorTideResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_sector_tide_${sector}_${JSON.stringify(params)}`;
      const cached = await this.cache.get<SectorTideResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getSectorTide(sector, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get sector tide for ${sector}`);
  }

  /**
   * Récupère l'ETF Tide
   * GET /market/{ticker}/etf-tide
   *
   * @param ticker Ticker de l'ETF (requis)
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse standardisée avec l'ETF Tide
   */
  async getETFTide(ticker: string, params?: ETFTideQueryParams): Promise<ApiResponse<ETFTideResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_etf_tide_${ticker}_${JSON.stringify(params)}`;
      const cached = await this.cache.get<ETFTideResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getETFTide(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get ETF tide for ${ticker}`);
  }

  /**
   * Récupère le Net Flow par expiry
   * GET /net-flow/expiry
   *
   * @param params Paramètres de requête (ticker, date, limit, page)
   * @returns Réponse standardisée avec le Net Flow par expiry
   */
  async getNetFlowExpiry(params: NetFlowExpiryQueryParams): Promise<ApiResponse<NetFlowExpiryResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_net_flow_expiry_${params.ticker}_${params.date || 'latest'}_${JSON.stringify(params)}`;
      const cached = await this.cache.get<NetFlowExpiryResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getNetFlowExpiry(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24); // Cache for 24 hours
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get net flow expiry');
  }

  // ========== Stock ==========

  /**
   * Récupère la liste des tickers dans un secteur donné
   * GET /stock/{sector}/tickers
   */
  async getSectorTickers(sector: string): Promise<ApiResponse<SectorTickersResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_sector_tickers_${sector}`;
      const cached = await this.cache.get<SectorTickersResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getSectorTickers(sector);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get sector tickers for ${sector}`);
  }

  /**
   * Récupère les chaînes ATM pour les expirations données
   * GET /stock/{ticker}/atm-chains
   */
  async getATMChains(ticker: string, params: ATMChainsQueryParams): Promise<ApiResponse<ATMChainsResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_atm_chains_${ticker}_${JSON.stringify(params)}`;
      const cached = await this.cache.get<ATMChainsResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getATMChains(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get ATM chains for ${ticker}`);
  }

  /**
   * Récupère les flow alerts (déprécié)
   * GET /stock/{ticker}/flow-alerts
   */
  async getStockFlowAlerts(ticker: string, params?: FlowAlertsQueryParams): Promise<ApiResponse<FlowAlertsResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_flow_alerts_${ticker}_${JSON.stringify(params)}`;
      const cached = await this.cache.get<FlowAlertsResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getFlowAlerts(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get flow alerts for ${ticker}`);
  }

  /**
   * Récupère le flow par expiration
   * GET /stock/{ticker}/flow-per-expiry
   */
  async getFlowPerExpiry(ticker: string, params?: FlowPerExpiryQueryParams): Promise<ApiResponse<FlowPerExpiryResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_flow_per_expiry_${ticker}`;
      const cached = await this.cache.get<FlowPerExpiryResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getFlowPerExpiry(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get flow per expiry for ${ticker}`);
  }

  /**
   * Récupère le flow par strike
   * GET /stock/{ticker}/flow-per-strike
   */
  async getFlowPerStrike(ticker: string, params?: FlowPerStrikeQueryParams): Promise<ApiResponse<FlowPerStrikeResponse>> {
    return handleError(async () => {
      const cacheKey = `uw_flow_per_strike_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<FlowPerStrikeResponse>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getFlowPerStrike(ticker, params);
      await this.cache.set(cacheKey, response as any, 'cache_key', 24);
      return { success: true, data: response, cached: false, count: response.length, timestamp: new Date().toISOString() };
    }, `Get flow per strike for ${ticker}`);
  }

  /**
   * Récupère le flow par strike intraday
   * GET /stock/{ticker}/flow-per-strike-intraday
   */
  async getFlowPerStrikeIntraday(ticker: string, params?: FlowPerStrikeIntradayQueryParams): Promise<ApiResponse<FlowPerStrikeIntradayResponse>> {
    return handleError(async () => {
      const cacheKey = `uw_flow_per_strike_intraday_${ticker}_${params?.date || 'latest'}_${params?.filter || 'NetPremium'}`;
      const cached = await this.cache.get<FlowPerStrikeIntradayResponse>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getFlowPerStrikeIntraday(ticker, params);
      await this.cache.set(cacheKey, response as any, 'cache_key', 24);
      return { success: true, data: response, cached: false, count: response.length, timestamp: new Date().toISOString() };
    }, `Get flow per strike intraday for ${ticker}`);
  }

  /**
   * Récupère les flows récents
   * GET /stock/{ticker}/flow-recent
   */
  async getRecentFlows(ticker: string, params?: RecentFlowsQueryParams): Promise<ApiResponse<RecentFlowsResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getRecentFlows', ticker, params });
      
      // Utiliser le service de persistance qui vérifie la fraîcheur et stocke dans options_flow
      const result = await this.persistenceService.getOrFetchOptionsFlow(
        ticker,
        async () => {
          log.info('Fetching recent flows from UW API');
          const response = await this.repository.getRecentFlows(ticker, params);
          return response.data || [];
        },
        1 // maxAgeHours: 1h pour options flow (change rapidement)
      );
      
      return {
        success: true,
        data: result.data,
        cached: result.fromCache,
        count: result.data.length,
        timestamp: result.dataDate || new Date().toISOString(),
      };
    }, `Get recent flows for ${ticker}`);
  }

  /**
   * Récupère l'exposition grecque
   * GET /stock/{ticker}/greek-exposure
   */
  async getGreekExposure(ticker: string, params?: GreekExposureQueryParams): Promise<ApiResponse<GreekExposureResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_greek_exposure_${ticker}_${params?.date || 'latest'}_${params?.timeframe || '1Y'}`;
      const cached = await this.cache.get<GreekExposureResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getGreekExposure(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get greek exposure for ${ticker}`);
  }

  /**
   * Récupère l'exposition grecque par expiration
   * GET /stock/{ticker}/greek-exposure/expiry
   */
  async getGreekExposureByExpiry(ticker: string, params?: GreekExposureByExpiryQueryParams): Promise<ApiResponse<GreekExposureByExpiryResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_greek_exposure_expiry_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<GreekExposureByExpiryResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getGreekExposureByExpiry(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get greek exposure by expiry for ${ticker}`);
  }

  /**
   * Récupère l'exposition grecque par strike
   * GET /stock/{ticker}/greek-exposure/strike
   */
  async getGreekExposureByStrike(ticker: string, params?: GreekExposureByStrikeQueryParams): Promise<ApiResponse<GreekExposureByStrikeResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_greek_exposure_strike_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<GreekExposureByStrikeResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getGreekExposureByStrike(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get greek exposure by strike for ${ticker}`);
  }

  /**
   * Récupère l'exposition grecque par strike et expiration
   * GET /stock/{ticker}/greek-exposure/strike-expiry
   */
  async getGreekExposureByStrikeAndExpiry(ticker: string, params: GreekExposureByStrikeAndExpiryQueryParams): Promise<ApiResponse<GreekExposureByStrikeAndExpiryResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_greek_exposure_strike_expiry_${ticker}_${params.expiry}_${params.date || 'latest'}`;
      const cached = await this.cache.get<GreekExposureByStrikeAndExpiryResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getGreekExposureByStrikeAndExpiry(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get greek exposure by strike and expiry for ${ticker}`);
  }

  /**
   * Récupère le greek flow
   * GET /stock/{ticker}/greek-flow
   */
  async getStockGreekFlow(ticker: string, params?: GreekFlowQueryParams): Promise<ApiResponse<GreekFlowResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_greek_flow_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<GreekFlowResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getGreekFlow(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get greek flow for ${ticker}`);
  }

  /**
   * Récupère le greek flow par expiration
   * GET /stock/{ticker}/greek-flow/{expiry}
   */
  async getStockGreekFlowByExpiry(ticker: string, expiry: string, params?: GreekFlowByExpiryQueryParams): Promise<ApiResponse<GreekFlowByExpiryResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_greek_flow_expiry_${ticker}_${expiry}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<GreekFlowByExpiryResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getGreekFlowByExpiry(ticker, expiry, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get greek flow by expiry for ${ticker}`);
  }

  /**
   * Récupère les greeks pour chaque strike pour une date d'expiration unique
   * GET /stock/{ticker}/greeks
   */
  async getGreeks(ticker: string, params: GreeksQueryParams): Promise<ApiResponse<GreeksResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_greeks_${ticker}_${params.expiry}_${params.date || 'latest'}`;
      const cached = await this.cache.get<GreeksResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getGreeks(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get greeks for ${ticker}`);
  }

  /**
   * Récupère le historical risk reversal skew
   * GET /stock/{ticker}/historical-risk-reversal-skew
   */
  async getHistoricalRiskReversalSkew(ticker: string, params: HistoricalRiskReversalSkewQueryParams): Promise<ApiResponse<HistoricalRiskReversalSkewResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_historical_risk_reversal_skew_${ticker}_${params.delta}_${params.expiry}_${params.date || 'latest'}_${params.timeframe || '1Y'}`;
      const cached = await this.cache.get<HistoricalRiskReversalSkewResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getHistoricalRiskReversalSkew(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get historical risk reversal skew for ${ticker}`);
  }

  /**
   * Récupère les informations sur un ticker
   * GET /stock/{ticker}/info
   */
  async getStockInfo(ticker: string, params?: StockInfoQueryParams): Promise<ApiResponse<StockInfoResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_stock_info_${ticker}`;
      const cached = await this.cache.get<StockInfoResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: 1, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getStockInfo(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: 1, timestamp: new Date().toISOString() };
    }, `Get stock info for ${ticker}`);
  }

  /**
   * Récupère les insider buy & sells
   * GET /stock/{ticker}/insider-buy-sells
   */
  async getStockInsiderBuySells(ticker: string, params?: StockInsiderBuySellsQueryParams): Promise<ApiResponse<StockInsiderBuySellsResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_stock_insider_buy_sells_${ticker}`;
      const cached = await this.cache.get<StockInsiderBuySellsResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getStockInsiderBuySells(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get stock insider buy sells for ${ticker}`);
  }

  /**
   * Récupère l'IV interpolée
   * GET /stock/{ticker}/interpolated-iv
   */
  async getInterpolatedIV(ticker: string, params?: InterpolatedIVQueryParams): Promise<ApiResponse<InterpolatedIVResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_interpolated_iv_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<InterpolatedIVResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getInterpolatedIV(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get interpolated IV for ${ticker}`);
  }

  /**
   * Récupère l'IV rank
   * GET /stock/{ticker}/iv-rank
   */
  async getIVRank(ticker: string, params?: IVRankQueryParams): Promise<ApiResponse<IVRankResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_iv_rank_${ticker}_${params?.date || 'latest'}_${params?.timespan || '1y'}`;
      const cached = await this.cache.get<IVRankResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getIVRank(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get IV rank for ${ticker}`);
  }

  /**
   * Récupère le max pain
   * GET /stock/{ticker}/max-pain
   */
  async getMaxPain(ticker: string, params?: MaxPainQueryParams): Promise<ApiResponse<MaxPainResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_max_pain_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<MaxPainResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getMaxPain(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get max pain for ${ticker}`);
  }

  /**
   * Récupère les net premium ticks
   * GET /stock/{ticker}/net-prem-ticks
   */
  async getNetPremiumTicks(ticker: string, params?: NetPremiumTicksQueryParams): Promise<ApiResponse<NetPremiumTicksResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_net_premium_ticks_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<NetPremiumTicksResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getNetPremiumTicks(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get net premium ticks for ${ticker}`);
  }

  /**
   * Récupère le NOPE
   * GET /stock/{ticker}/nope
   */
  async getNOPE(ticker: string, params?: NOPEQueryParams): Promise<ApiResponse<NOPEResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_nope_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<NOPEResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getNOPE(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get NOPE for ${ticker}`);
  }

  /**
   * Récupère les données OHLC
   * GET /stock/{ticker}/ohlc/{candle_size}
   */
  async getOHLC(ticker: string, candleSize: string, params?: OHLCQueryParams): Promise<ApiResponse<OHLCResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_ohlc_${ticker}_${candleSize}_${params?.date || 'latest'}_${params?.end_date || ''}_${params?.timeframe || '1Y'}_${params?.limit || 2500}`;
      const cached = await this.cache.get<OHLCResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getOHLC(ticker, candleSize, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get OHLC for ${ticker}`);
  }

  /**
   * Récupère les changements d'OI
   * GET /stock/{ticker}/oi-change
   */
  async getStockOIChange(ticker: string, params?: StockOIChangeQueryParams): Promise<ApiResponse<StockOIChangeResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_stock_oi_change_${ticker}_${params?.date || 'latest'}_${params?.limit || 'all'}_${params?.order || 'desc'}_${params?.page || 0}`;
      const cached = await this.cache.get<StockOIChangeResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getStockOIChange(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get OI change for ${ticker}`);
  }

  /**
   * Récupère l'OI par expiration
   * GET /stock/{ticker}/oi-per-expiry
   */
  async getOIPerExpiry(ticker: string, params?: OIPerExpiryQueryParams): Promise<ApiResponse<OIPerExpiryResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_oi_per_expiry_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<OIPerExpiryResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getOIPerExpiry(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get OI per expiry for ${ticker}`);
  }

  /**
   * Récupère l'OI par strike
   * GET /stock/{ticker}/oi-per-strike
   */
  async getOIPerStrike(ticker: string, params?: OIPerStrikeQueryParams): Promise<ApiResponse<OIPerStrikeResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_oi_per_strike_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<OIPerStrikeResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getOIPerStrike(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get OI per strike for ${ticker}`);
  }

  /**
   * Récupère les option chains
   * GET /stock/{ticker}/option-chains
   */
  async getOptionChains(ticker: string, params?: OptionChainsQueryParams): Promise<ApiResponse<OptionChainsResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_option_chains_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<OptionChainsResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getOptionChains(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get option chains for ${ticker}`);
  }

  /**
   * Récupère les niveaux de prix stock pour les options
   * GET /stock/{ticker}/option/stock-price-levels
   */
  async getOptionStockPriceLevels(ticker: string, params?: OptionStockPriceLevelsQueryParams): Promise<ApiResponse<OptionStockPriceLevelsResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_option_stock_price_levels_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<OptionStockPriceLevelsResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getOptionStockPriceLevels(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get option stock price levels for ${ticker}`);
  }

  /**
   * Récupère le volume et OI par expiration
   * GET /stock/{ticker}/option/volume-oi-expiry
   */
  async getVolumeOIPerExpiry(ticker: string, params?: VolumeOIPerExpiryQueryParams): Promise<ApiResponse<VolumeOIPerExpiryResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_volume_oi_per_expiry_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<VolumeOIPerExpiryResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getVolumeOIPerExpiry(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get volume OI per expiry for ${ticker}`);
  }

  /**
   * Récupère le volume d'options
   * GET /stock/{ticker}/options-volume
   */
  async getOptionsVolume(ticker: string, params?: OptionsVolumeQueryParams): Promise<ApiResponse<OptionsVolumeResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_options_volume_${ticker}_${params?.limit || 1}`;
      const cached = await this.cache.get<OptionsVolumeResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getOptionsVolume(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get options volume for ${ticker}`);
  }

  /**
   * Récupère les spot exposures
   * GET /stock/{ticker}/spot-exposures
   */
  async getSpotExposures(ticker: string, params?: SpotExposuresQueryParams): Promise<ApiResponse<SpotExposuresResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_spot_exposures_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<SpotExposuresResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getSpotExposures(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get spot exposures for ${ticker}`);
  }

  /**
   * Récupère les spot exposures par strike et expiration
   * GET /stock/{ticker}/spot-exposures/expiry-strike
   */
  async getSpotExposureByStrikeAndExpiry(ticker: string, params: SpotExposureByStrikeAndExpiryQueryParams): Promise<ApiResponse<SpotExposureByStrikeAndExpiryResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_spot_exposure_strike_expiry_${ticker}_${params.expirations.join(',')}_${params.date || 'latest'}_${params.limit || 500}_${params.page || 0}`;
      const cached = await this.cache.get<SpotExposureByStrikeAndExpiryResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getSpotExposureByStrikeAndExpiry(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get spot exposure by strike and expiry for ${ticker}`);
  }

  /**
   * Récupère les spot exposures par strike
   * GET /stock/{ticker}/spot-exposures/strike
   */
  async getSpotExposureByStrike(ticker: string, params?: SpotExposureByStrikeQueryParams): Promise<ApiResponse<SpotExposureByStrikeResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_spot_exposure_strike_${ticker}_${params?.date || 'latest'}_${params?.limit || 500}_${params?.page || 0}`;
      const cached = await this.cache.get<SpotExposureByStrikeResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getSpotExposureByStrike(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get spot exposure by strike for ${ticker}`);
  }

  /**
   * Récupère l'état du stock
   * GET /stock/{ticker}/stock-state
   */
  async getStockState(ticker: string, params?: StockStateQueryParams): Promise<ApiResponse<StockStateResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_stock_state_${ticker}`;
      const cached = await this.cache.get<StockStateResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: 1, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getStockState(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: 1, timestamp: new Date().toISOString() };
    }, `Get stock state for ${ticker}`);
  }

  /**
   * Récupère les niveaux de prix volume stock
   * GET /stock/{ticker}/stock-volume-price-levels
   */
  async getStockVolumePriceLevels(ticker: string, params?: StockVolumePriceLevelsQueryParams): Promise<ApiResponse<StockVolumePriceLevelsResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_stock_volume_price_levels_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<StockVolumePriceLevelsResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getStockVolumePriceLevels(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get stock volume price levels for ${ticker}`);
  }

  /**
   * Récupère la volatilité réalisée
   * GET /stock/{ticker}/volatility/realized
   */
  async getRealizedVolatility(ticker: string, params?: RealizedVolatilityQueryParams): Promise<ApiResponse<RealizedVolatilityResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_realized_volatility_${ticker}_${params?.date || 'latest'}_${params?.timeframe || '1Y'}`;
      const cached = await this.cache.get<RealizedVolatilityResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getRealizedVolatility(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get realized volatility for ${ticker}`);
  }

  /**
   * Récupère les statistiques de volatilité
   * GET /stock/{ticker}/volatility/stats
   */
  async getVolatilityStats(ticker: string, params?: VolatilityStatsQueryParams): Promise<ApiResponse<VolatilityStatsResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_volatility_stats_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<VolatilityStatsResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: 1, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getVolatilityStats(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: 1, timestamp: new Date().toISOString() };
    }, `Get volatility stats for ${ticker}`);
  }

  /**
   * Récupère la structure de terme de volatilité implicite
   * GET /stock/{ticker}/volatility/term-structure
   */
  async getVolatilityTermStructure(ticker: string, params?: VolatilityTermStructureQueryParams): Promise<ApiResponse<VolatilityTermStructureResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_volatility_term_structure_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<VolatilityTermStructureResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getVolatilityTermStructure(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get volatility term structure for ${ticker}`);
  }

  // ========== Shorts ==========

  /**
   * Récupère les données de short
   * GET /shorts/{ticker}/data
   */
  async getShortData(ticker: string, params?: ShortDataQueryParams): Promise<ApiResponse<ShortDataResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_short_data_${ticker}`;
      const cached = await this.cache.get<ShortDataResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getShortData(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get short data for ${ticker}`);
  }

  /**
   * Récupère les failures to deliver
   * GET /shorts/{ticker}/ftds
   */
  async getFailuresToDeliver(ticker: string, params?: FailuresToDeliverQueryParams): Promise<ApiResponse<FailuresToDeliverResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_failures_to_deliver_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<FailuresToDeliverResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getFailuresToDeliver(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get failures to deliver for ${ticker}`);
  }

  /**
   * Récupère le short interest et float
   * GET /shorts/{ticker}/interest-float
   */
  async getShortInterestAndFloat(ticker: string, params?: ShortInterestAndFloatQueryParams): Promise<ApiResponse<ShortInterestAndFloatResponse['data']>> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getShortInterestAndFloat', ticker, params });
      
      // Utiliser le service de persistance qui vérifie la fraîcheur et stocke dans short_interest
      const result = await this.persistenceService.getOrFetchShortInterest(
        ticker,
        async () => {
          log.info('Fetching short interest from UW API');
          const response = await this.repository.getShortInterestAndFloat(ticker, params);
          return response.data || null;
        },
        24 // maxAgeHours: 24h pour short interest
      );
      
      return {
        success: true,
        data: result.data,
        cached: result.fromCache,
        count: result.data ? 1 : 0,
        timestamp: result.dataDate || new Date().toISOString(),
      };
    }, `Get short interest and float for ${ticker}`);
  }

  /**
   * Récupère le volume de short et ratio
   * GET /shorts/{ticker}/volume-and-ratio
   */
  async getShortVolumeAndRatio(ticker: string, params?: ShortVolumeAndRatioQueryParams): Promise<ApiResponse<ShortVolumeAndRatioResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_short_volume_ratio_${ticker}`;
      const cached = await this.cache.get<ShortVolumeAndRatioResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getShortVolumeAndRatio(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get short volume and ratio for ${ticker}`);
  }

  /**
   * Récupère le volume de short par échange
   * GET /shorts/{ticker}/volumes-by-exchange
   */
  async getShortVolumeByExchange(ticker: string, params?: ShortVolumeByExchangeQueryParams): Promise<ApiResponse<ShortVolumeByExchangeResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_short_volume_by_exchange_${ticker}`;
      const cached = await this.cache.get<ShortVolumeByExchangeResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getShortVolumeByExchange(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get short volume by exchange for ${ticker}`);
  }

  // ========== Seasonality ==========

  async getYearMonthPriceChange(ticker: string, params?: YearMonthPriceChangeQueryParams): Promise<ApiResponse<YearMonthPriceChangeResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_year_month_price_change_${ticker}`;
      const cached = await this.cache.get<YearMonthPriceChangeResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getYearMonthPriceChange(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get year-month price change for ${ticker}`);
  }

  async getMonthlyAverageReturn(ticker: string, params?: MonthlyAverageReturnQueryParams): Promise<ApiResponse<MonthlyAverageReturnResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_monthly_avg_return_${ticker}`;
      const cached = await this.cache.get<MonthlyAverageReturnResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getMonthlyAverageReturn(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get monthly average return for ${ticker}`);
  }

  async getMonthPerformers(month: number, params?: MonthPerformersQueryParams): Promise<ApiResponse<MonthPerformersResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_month_performers_${month}_${JSON.stringify(params || {})}`;
      const cached = await this.cache.get<MonthPerformersResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getMonthPerformers(month, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 6);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get month performers for month ${month}`);
  }

  async getMarketSeasonality(params?: MarketSeasonalityQueryParams): Promise<ApiResponse<MarketSeasonalityResponse['data']>> {
    return handleError(async () => {
      const cacheKey = 'uw_market_seasonality';
      const cached = await this.cache.get<MarketSeasonalityResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getMarketSeasonality(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 24);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get market seasonality');
  }

  // ========== Screener ==========

  async getAnalystRatings(params?: AnalystRatingQueryParams): Promise<ApiResponse<AnalystRatingResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_analyst_ratings_${JSON.stringify(params || {})}`;
      const cached = await this.cache.get<AnalystRatingResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getAnalystRatings(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 1);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get analyst ratings');
  }

  async getOptionContracts(params?: OptionContractsQueryParams): Promise<ApiResponse<OptionContractsResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_option_contracts_${JSON.stringify(params || {})}`;
      const cached = await this.cache.get<OptionContractsResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getOptionContracts(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 1);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get option contracts');
  }

  async getStockScreener(params?: StockScreenerQueryParams): Promise<ApiResponse<StockScreenerResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_stock_screener_${JSON.stringify(params || {})}`;
      const cached = await this.cache.get<StockScreenerResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getStockScreener(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 1);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get stock screener');
  }

  // ========== Option Trade ==========

  async getOptionTradeFlowAlerts(params?: OptionTradeFlowAlertsQueryParams): Promise<ApiResponse<OptionTradeFlowAlertsResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_option_trade_flow_alerts_${JSON.stringify(params || {})}`;
      const cached = await this.cache.get<any>(cacheKey, 'cache_key');
      if (cached) {
        // Le cache retourne l'objet entier de la table unusual_whales_cache
        // Structure: { id, cache_key, data (JSONB), data_date, cached_at, expires_at }
        // Extraire le champ 'data' qui contient le tableau
        const cachedData = cached.data;
        if (Array.isArray(cachedData)) {
          return { success: true, data: cachedData, cached: true, count: cachedData.length, timestamp: new Date().toISOString() };
        }
        // Si cached.data n'est pas un tableau, ignorer le cache et refetch
      }
      const response = await this.repository.getOptionTradeFlowAlerts(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 1);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get option trade flow alerts');
  }

  async getFullTape(date: string, params?: FullTapeQueryParams): Promise<ApiResponse<{ endpoint: string; url: string }>> {
    return handleError(async () => {
      const response = await this.repository.getFullTape(date, params);
      // Construire l'URL complète avec l'API key
      const baseUrl = 'https://api.unusualwhales.com/api';
      const apiKey = process.env.UNUSUAL_WHALES_API_KEY || '';
      const url = `${baseUrl}${response.endpoint}?Authorization=Bearer ${apiKey}`;
      return { success: true, data: { endpoint: response.endpoint, url }, cached: false, count: 1, timestamp: new Date().toISOString() };
    }, `Get full tape for ${date}`);
  }

  // ========== Option Contract ==========

  async getOptionContractFlow(id: string, params?: OptionContractFlowQueryParams): Promise<ApiResponse<OptionContractFlowResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_option_contract_flow_${id}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<OptionContractFlowResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getOptionContractFlow(id, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 1);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get option contract flow for ${id}`);
  }

  async getOptionContractHistoric(id: string, params?: OptionContractHistoricQueryParams): Promise<ApiResponse<OptionContractHistoricResponse['chains']>> {
    return handleError(async () => {
      const cacheKey = `uw_option_contract_historic_${id}_${params?.limit || 'all'}`;
      const cached = await this.cache.get<OptionContractHistoricResponse['chains']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getOptionContractHistoric(id, params);
      await this.cache.set(cacheKey, response.chains as any, 'cache_key', 24);
      return { success: true, data: response.chains, cached: false, count: response.chains.length, timestamp: new Date().toISOString() };
    }, `Get option contract historic for ${id}`);
  }

  async getOptionContractIntraday(id: string, params?: OptionContractIntradayQueryParams): Promise<ApiResponse<OptionContractIntradayResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_option_contract_intraday_${id}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<OptionContractIntradayResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getOptionContractIntraday(id, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 1);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get option contract intraday for ${id}`);
  }

  async getOptionContractVolumeProfile(id: string, params?: OptionContractVolumeProfileQueryParams): Promise<ApiResponse<OptionContractVolumeProfileResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_option_contract_volume_profile_${id}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<OptionContractVolumeProfileResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getOptionContractVolumeProfile(id, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 1);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get option contract volume profile for ${id}`);
  }

  async getExpiryBreakdown(ticker: string, params?: ExpiryBreakdownQueryParams): Promise<ApiResponse<ExpiryBreakdownResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_expiry_breakdown_${ticker}_${params?.date || 'latest'}`;
      const cached = await this.cache.get<ExpiryBreakdownResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getExpiryBreakdown(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 1);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get expiry breakdown for ${ticker}`);
  }

  async getStockOptionContracts(ticker: string, params?: StockOptionContractsQueryParams): Promise<ApiResponse<StockOptionContractsResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_stock_option_contracts_${ticker}_${JSON.stringify(params || {})}`;
      const cached = await this.cache.get<StockOptionContractsResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getStockOptionContracts(ticker, params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 1);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, `Get stock option contracts for ${ticker}`);
  }

  // ========== News ==========

  async getNewsHeadlines(params?: NewsHeadlinesQueryParams): Promise<ApiResponse<NewsHeadlinesResponse['data']>> {
    return handleError(async () => {
      const cacheKey = `uw_news_headlines_${JSON.stringify(params || {})}`;
      const cached = await this.cache.get<NewsHeadlinesResponse['data']>(cacheKey, 'cache_key');
      if (cached) {
        return { success: true, data: cached, cached: true, count: cached.length, timestamp: new Date().toISOString() };
      }
      const response = await this.repository.getNewsHeadlines(params);
      await this.cache.set(cacheKey, response.data as any, 'cache_key', 1);
      return { success: true, data: response.data, cached: false, count: response.data.length, timestamp: new Date().toISOString() };
    }, 'Get news headlines');
  }
}

