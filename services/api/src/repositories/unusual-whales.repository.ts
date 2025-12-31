/**
 * Repository Unusual Whales
 * Accès aux données Unusual Whales uniquement - pas de logique métier
 */

import { ApiClientService, createUnusualWhalesClient } from '../services/api-client.service';
import { logger } from '../utils/logger';
import { ExternalApiError, handleError } from '../utils/errors';
import type {
  AlertConfigurationResponse,
  AlertsResponse,
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
  ShortVolumeAndRatio,
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

export class UnusualWhalesRepository {
  private client: ApiClientService;

  constructor(client?: ApiClientService) {
    this.client = client || createUnusualWhalesClient();
  }

  // ========== Institutional Data ==========

  async getInstitutionOwnership(ticker: string, options?: Record<string, any>): Promise<any[]> {
    return handleError(async () => {
      const params = new URLSearchParams();
      if (options) {
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
      }
      const queryString = params.toString();
      const endpoint = `/ownership/${ticker.toUpperCase()}${queryString ? `?${queryString}` : ''}`;
      const response = await this.client.get<any>(endpoint);
      return Array.isArray(response) ? response : (response?.data || []);
    }, `Get institution ownership for ${ticker}`);
  }

  async getInstitutionActivity(ticker: string, institutionName?: string, options?: Record<string, any>): Promise<any[]> {
    return handleError(async () => {
      if (institutionName) {
        const encodedName = encodeURIComponent(institutionName);
        const params = new URLSearchParams();
        params.append('ticker', ticker.toUpperCase());
        if (options) {
          Object.entries(options).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              params.append(key, String(value));
            }
          });
        }
        const response = await this.client.get<any>(`/institution/${encodedName}/activity?${params.toString()}`);
        return Array.isArray(response) ? response : (response?.data || []);
      } else {
        // Fallback to ownership if no institution name
        return this.getInstitutionOwnership(ticker, options);
      }
    }, `Get institution activity for ${ticker}`);
  }

  async getInstitutionHoldings(ticker: string, institutionName: string, options?: Record<string, any>): Promise<any[]> {
    return handleError(async () => {
      const encodedName = encodeURIComponent(institutionName);
      const params = new URLSearchParams();
      params.append('ticker', ticker.toUpperCase());
      if (options) {
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
      }
      const response = await this.client.get<any>(`/institution/${encodedName}/holdings?${params.toString()}`);
      return Array.isArray(response) ? response : (response?.data || []);
    }, `Get institution holdings for ${institutionName} - ${ticker}`);
  }

  // ========== Options Flow ==========

  async getOptionsFlow(ticker: string, options?: Record<string, any>): Promise<any[]> {
    return handleError(async () => {
      const params = new URLSearchParams();
      params.append('ticker_symbol', ticker.toUpperCase());
      if (options) {
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
      }
      const response = await this.client.get<any>(`/option-trades/flow-alerts?${params.toString()}`);
      return Array.isArray(response) ? response : (response?.data || []);
    }, `Get options flow for ${ticker}`);
  }


  // ========== Dark Pool ==========

  /**
   * Récupère les derniers dark pool trades
   * GET /darkpool/recent
   * 
   * @param params Paramètres de requête (date, limit, filtres premium/size/volume)
   * @returns Réponse avec les dark pool trades récents
   */
  async getDarkPoolRecent(params?: DarkPoolRecentQueryParams): Promise<DarkPoolRecentResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      
      if (params) {
        // date - String (YYYY-MM-DD)
        if (params.date) {
          queryParams.append('date', params.date);
        }
        
        // limit - Number (1-200, défaut: 100)
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 200)));
        }
        
        // max_premium - Number
        if (params.max_premium !== undefined) {
          queryParams.append('max_premium', String(params.max_premium));
        }
        
        // max_size - Number (entier positif)
        if (params.max_size !== undefined && params.max_size > 0) {
          queryParams.append('max_size', String(params.max_size));
        }
        
        // max_volume - Number (entier positif)
        if (params.max_volume !== undefined && params.max_volume > 0) {
          queryParams.append('max_volume', String(params.max_volume));
        }
        
        // min_premium - Number (>= 0, défaut: 0)
        if (params.min_premium !== undefined && params.min_premium >= 0) {
          queryParams.append('min_premium', String(params.min_premium));
        }
        
        // min_size - Number (entier positif, >= 0, défaut: 0)
        if (params.min_size !== undefined && params.min_size >= 0) {
          queryParams.append('min_size', String(params.min_size));
        }
        
        // min_volume - Number (entier positif, >= 0, défaut: 0)
        if (params.min_volume !== undefined && params.min_volume >= 0) {
          queryParams.append('min_volume', String(params.min_volume));
        }
      }
      
      const queryString = queryParams.toString();
      const endpoint = `/darkpool/recent${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.client.get<DarkPoolRecentResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /darkpool/recent endpoint');
      }
      
      return response;
    }, 'Get dark pool recent');
  }

  /**
   * Récupère les dark pool trades pour un ticker donné
   * GET /darkpool/{ticker}
   * 
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date, limit, filtres, pagination)
   * @returns Réponse avec les dark pool trades du ticker
   */
  async getDarkPoolTrades(ticker: string, params?: DarkPoolTickerQueryParams): Promise<DarkPoolTickerResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      
      if (params) {
        // date - String (YYYY-MM-DD)
        if (params.date) {
          queryParams.append('date', params.date);
        }
        
        // limit - Number (1-500, défaut: 500)
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        
        // max_premium - Number
        if (params.max_premium !== undefined) {
          queryParams.append('max_premium', String(params.max_premium));
        }
        
        // max_size - Number (entier positif)
        if (params.max_size !== undefined && params.max_size > 0) {
          queryParams.append('max_size', String(params.max_size));
        }
        
        // max_volume - Number (entier positif)
        if (params.max_volume !== undefined && params.max_volume > 0) {
          queryParams.append('max_volume', String(params.max_volume));
        }
        
        // min_premium - Number (>= 0, défaut: 0)
        if (params.min_premium !== undefined && params.min_premium >= 0) {
          queryParams.append('min_premium', String(params.min_premium));
        }
        
        // min_size - Number (entier positif, >= 0, défaut: 0)
        if (params.min_size !== undefined && params.min_size >= 0) {
          queryParams.append('min_size', String(params.min_size));
        }
        
        // min_volume - Number (entier positif, >= 0, défaut: 0)
        if (params.min_volume !== undefined && params.min_volume >= 0) {
          queryParams.append('min_volume', String(params.min_volume));
        }
        
        // newer_than - String (unix timestamp ou ISO date)
        if (params.newer_than) {
          queryParams.append('newer_than', params.newer_than);
        }
        
        // older_than - String (unix timestamp ou ISO date)
        if (params.older_than) {
          queryParams.append('older_than', params.older_than);
        }
      }
      
      const queryString = queryParams.toString();
      const endpoint = `/darkpool/${ticker.toUpperCase()}${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.client.get<DarkPoolTickerResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /darkpool/{ticker} endpoint');
      }
      
      return response;
    }, `Get dark pool trades for ${ticker}`);
  }

  // ========== Insider & Congress ==========

  async getInsiderTrades(ticker: string, options?: Record<string, any>): Promise<any[]> {
    return handleError(async () => {
      const params = new URLSearchParams();
      params.append('ticker', ticker.toUpperCase());
      if (options) {
        Object.entries(options).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
      }
      const response = await this.client.get<any>(`/insider/recent-trades?${params.toString()}`);
      return Array.isArray(response) ? response : (response?.data || []);
    }, `Get insider trades for ${ticker}`);
  }


  // ========== Congress ==========

  /**
   * Récupère les rapports récents par un membre du Congrès
   * GET /congress/congress-trader
   * 
   * @param params Paramètres de requête (date, limit, name, ticker)
   * @returns Réponse avec les trades du membre du Congrès
   */
  async getCongressTrader(params?: CongressTraderQueryParams): Promise<CongressTraderResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      
      if (params) {
        // date - String (YYYY-MM-DD)
        if (params.date) {
          queryParams.append('date', params.date);
        }
        
        // limit - Number (1-200, défaut: 100)
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 200)));
        }
        
        // name - String (URI encoded si nécessaire)
        if (params.name) {
          queryParams.append('name', params.name);
        }
        
        // ticker - String ou null
        if (params.ticker !== undefined && params.ticker !== null) {
          queryParams.append('ticker', params.ticker.toUpperCase());
        }
      }
      
      const queryString = queryParams.toString();
      const endpoint = `/congress/congress-trader${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.client.get<CongressTraderResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /congress/congress-trader endpoint');
      }
      
      return response;
    }, 'Get congress trader');
  }

  /**
   * Récupère les rapports tardifs récents par les membres du Congrès
   * GET /congress/late-reports
   * 
   * @param params Paramètres de requête (date, limit, ticker)
   * @returns Réponse avec les rapports tardifs
   */
  async getCongressLateReports(params?: CongressLateReportsQueryParams): Promise<CongressLateReportsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      
      if (params) {
        // date - String (YYYY-MM-DD)
        if (params.date) {
          queryParams.append('date', params.date);
        }
        
        // limit - Number (1-200, défaut: 100)
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 200)));
        }
        
        // ticker - String ou null
        if (params.ticker !== undefined && params.ticker !== null) {
          queryParams.append('ticker', params.ticker.toUpperCase());
        }
      }
      
      const queryString = queryParams.toString();
      const endpoint = `/congress/late-reports${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.client.get<CongressLateReportsResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /congress/late-reports endpoint');
      }
      
      return response;
    }, 'Get congress late reports');
  }

  /**
   * Récupère les trades récents du Congrès
   * GET /congress/recent-trades
   * 
   * @param params Paramètres de requête (date, limit, ticker)
   * @returns Réponse avec les trades récents
   */
  async getCongressRecentTrades(params?: CongressRecentTradesQueryParams): Promise<CongressRecentTradesResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      
      if (params) {
        // date - String (YYYY-MM-DD)
        if (params.date) {
          queryParams.append('date', params.date);
        }
        
        // limit - Number (1-200, défaut: 100)
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 200)));
        }
        
        // ticker - String ou null
        if (params.ticker !== undefined && params.ticker !== null) {
          queryParams.append('ticker', params.ticker.toUpperCase());
        }
      }
      
      const queryString = queryParams.toString();
      const endpoint = `/congress/recent-trades${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.client.get<CongressRecentTradesResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /congress/recent-trades endpoint');
      }
      
      return response;
    }, 'Get congress recent trades');
  }

  // Alias pour compatibilité (ancienne méthode)
  async getCongressTrades(ticker: string, options?: Record<string, any>): Promise<CongressRecentTradesResponse['data']> {
    const params: CongressRecentTradesQueryParams = {
      ticker: ticker.toUpperCase(),
      ...options,
    };
    const response = await this.getCongressRecentTrades(params);
    return response.data;
  }


  // ========== Alerts ==========

  /**
   * Récupère toutes les alertes déclenchées pour l'utilisateur
   * GET /alerts
   * 
   * @param params Paramètres de requête (filtres, pagination, etc.)
   * @returns Réponse avec les alertes déclenchées
   */
  async getAlerts(params?: AlertsQueryParams): Promise<AlertsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      
      if (params) {
        // config_ids[] - Array de strings
        if (params.config_ids && params.config_ids.length > 0) {
          params.config_ids.forEach(id => queryParams.append('config_ids[]', id));
        }
        
        // intraday_only - Boolean (défaut: true)
        if (params.intraday_only !== undefined) {
          queryParams.append('intraday_only', String(params.intraday_only));
        }
        
        // limit - Number (1-500, défaut: 50)
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        
        // newer_than - String (ISO ou unix timestamp)
        if (params.newer_than) {
          queryParams.append('newer_than', params.newer_than);
        }
        
        // noti_types[] - Array de NotificationType
        if (params.noti_types && params.noti_types.length > 0) {
          params.noti_types.forEach(type => queryParams.append('noti_types[]', type));
        }
        
        // older_than - String (ISO ou unix timestamp)
        if (params.older_than) {
          queryParams.append('older_than', params.older_than);
        }
        
        // ticker_symbols - String (comma-separated)
        if (params.ticker_symbols) {
          queryParams.append('ticker_symbols', params.ticker_symbols);
        }
      }
      
      const queryString = queryParams.toString();
      const endpoint = `/alerts${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.client.get<AlertsResponse>(endpoint);
      
      // Valider le format de réponse
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /alerts endpoint');
      }
      
      return response;
    }, 'Get alerts');
  }

  /**
   * Récupère toutes les configurations d'alertes de l'utilisateur
   * GET /alerts/configuration
   * 
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec les configurations d'alertes
   */
  async getAlertConfigurations(params?: AlertConfigurationQueryParams): Promise<AlertConfigurationResponse> {
    return handleError(async () => {
      const response = await this.client.get<AlertConfigurationResponse>(`/alerts/configuration`);
      
      // Valider le format de réponse
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /alerts/configuration endpoint');
      }
      
      return response;
    }, 'Get alert configurations');
  }

  // ========== Earnings ==========

  /**
   * Récupère les earnings afterhours pour une date donnée
   * GET /earnings/afterhours
   * 
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse avec les earnings afterhours
   */
  async getEarningsAfterhours(params?: EarningsAfterhoursQueryParams): Promise<EarningsAfterhoursResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      
      if (params) {
        // date - String (YYYY-MM-DD)
        if (params.date) {
          queryParams.append('date', params.date);
        }
        
        // limit - Number (1-100, défaut: 50)
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 100)));
        }
        
        // page - Number (commence à 0)
        if (params.page !== undefined && params.page >= 0) {
          queryParams.append('page', String(params.page));
        }
      }
      
      const queryString = queryParams.toString();
      const endpoint = `/earnings/afterhours${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.client.get<EarningsAfterhoursResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /earnings/afterhours endpoint');
      }
      
      return response;
    }, 'Get earnings afterhours');
  }

  /**
   * Récupère les earnings premarket pour une date donnée
   * GET /earnings/premarket
   * 
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse avec les earnings premarket
   */
  async getEarningsPremarket(params?: EarningsPremarketQueryParams): Promise<EarningsPremarketResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      
      if (params) {
        // date - String (YYYY-MM-DD)
        if (params.date) {
          queryParams.append('date', params.date);
        }
        
        // limit - Number (1-100, défaut: 50)
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 100)));
        }
        
        // page - Number (commence à 0)
        if (params.page !== undefined && params.page >= 0) {
          queryParams.append('page', String(params.page));
        }
      }
      
      const queryString = queryParams.toString();
      const endpoint = `/earnings/premarket${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.client.get<EarningsPremarketResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /earnings/premarket endpoint');
      }
      
      return response;
    }, 'Get earnings premarket');
  }

  /**
   * Récupère les earnings historiques pour un ticker donné
   * GET /earnings/{ticker}
   * 
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec les earnings historiques
   */
  async getEarningsHistorical(ticker: string, params?: EarningsHistoricalQueryParams): Promise<EarningsHistoricalResponse> {
    return handleError(async () => {
      const endpoint = `/earnings/${ticker.toUpperCase()}`;
      
      const response = await this.client.get<EarningsHistoricalResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /earnings/{ticker} endpoint');
      }
      
      return response;
    }, `Get earnings historical for ${ticker}`);
  }

  // ========== ETF ==========

  /**
   * Récupère tous les ETFs dans lesquels le ticker donné est un holding
   * GET /etfs/{ticker}/exposure
   * 
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec les ETFs contenant le ticker
   */
  async getETFExposure(ticker: string, params?: ETFExposureQueryParams): Promise<ETFExposureResponse> {
    return handleError(async () => {
      const endpoint = `/etfs/${ticker.toUpperCase()}/exposure`;
      
      const response = await this.client.get<ETFExposureResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /etfs/{ticker}/exposure endpoint');
      }
      
      return response;
    }, `Get ETF exposure for ${ticker}`);
  }

  /**
   * Récupère les holdings de l'ETF
   * GET /etfs/{ticker}/holdings
   * 
   * @param ticker Symbole du ticker ETF (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec les holdings de l'ETF
   */
  async getETFHoldings(ticker: string, params?: ETFHoldingsQueryParams): Promise<ETFHoldingsResponse> {
    return handleError(async () => {
      const endpoint = `/etfs/${ticker.toUpperCase()}/holdings`;
      
      const response = await this.client.get<ETFHoldingsResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /etfs/{ticker}/holdings endpoint');
      }
      
      return response;
    }, `Get ETF holdings for ${ticker}`);
  }

  /**
   * Récupère l'inflow et outflow d'un ETF
   * GET /etfs/{ticker}/in-outflow
   * 
   * @param ticker Symbole du ticker ETF (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec l'inflow/outflow de l'ETF
   */
  async getETFInOutflow(ticker: string, params?: ETFInOutflowQueryParams): Promise<ETFInOutflowResponse> {
    return handleError(async () => {
      const endpoint = `/etfs/${ticker.toUpperCase()}/in-outflow`;
      
      const response = await this.client.get<ETFInOutflowResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /etfs/{ticker}/in-outflow endpoint');
      }
      
      return response;
    }, `Get ETF in-outflow for ${ticker}`);
  }

  /**
   * Récupère les informations sur l'ETF
   * GET /etfs/{ticker}/info
   * 
   * @param ticker Symbole du ticker ETF (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec les informations de l'ETF
   */
  async getETFInfo(ticker: string, params?: ETFInfoQueryParams): Promise<ETFInfoResponse> {
    return handleError(async () => {
      const endpoint = `/etfs/${ticker.toUpperCase()}/info`;
      
      const response = await this.client.get<ETFInfoResponse>(endpoint);
      
      if (!response || !response.data) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /etfs/{ticker}/info endpoint');
      }
      
      return response;
    }, `Get ETF info for ${ticker}`);
  }

  /**
   * Récupère les poids sectoriels et par pays pour l'ETF
   * GET /etfs/{ticker}/weights
   * 
   * @param ticker Symbole du ticker ETF (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec les poids sectoriels et par pays
   */
  async getETFWeights(ticker: string, params?: ETFWeightsQueryParams): Promise<ETFWeightsResponse> {
    return handleError(async () => {
      const endpoint = `/etfs/${ticker.toUpperCase()}/weights`;
      
      const response = await this.client.get<ETFWeightsResponse>(endpoint);
      
      if (!response || !Array.isArray(response.country) || !Array.isArray(response.sector)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /etfs/{ticker}/weights endpoint');
      }
      
      return response;
    }, `Get ETF weights for ${ticker}`);
  }

  // ========== Group Flow ==========

  /**
   * Récupère le greek flow (delta & vega flow) d'un flow group pour un jour de marché donné, décomposé par minute
   * GET /group-flow/{flow_group}/greek-flow
   * 
   * @param flowGroup Flow group (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec le greek flow par minute
   */
  async getGroupGreekFlow(flowGroup: FlowGroup, params?: GroupGreekFlowQueryParams): Promise<GroupGreekFlowResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      
      if (params?.date) {
        queryParams.append('date', params.date);
      }
      
      const queryString = queryParams.toString();
      const endpoint = `/group-flow/${encodeURIComponent(flowGroup)}/greek-flow${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.client.get<GroupGreekFlowResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /group-flow/{flow_group}/greek-flow endpoint');
      }
      
      return response;
    }, `Get group greek flow for ${flowGroup}`);
  }

  /**
   * Récupère le greek flow (delta & vega flow) d'un flow group pour un jour de marché donné, décomposé par minute et expiry
   * GET /group-flow/{flow_group}/greek-flow/{expiry}
   * 
   * @param flowGroup Flow group (requis)
   * @param expiry Date d'expiration (format ISO, requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec le greek flow par minute et expiry
   */
  async getGroupGreekFlowByExpiry(
    flowGroup: FlowGroup,
    expiry: string,
    params?: GroupGreekFlowByExpiryQueryParams
  ): Promise<GroupGreekFlowByExpiryResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      
      if (params?.date) {
        queryParams.append('date', params.date);
      }
      
      const queryString = queryParams.toString();
      const endpoint = `/group-flow/${encodeURIComponent(flowGroup)}/greek-flow/${expiry}${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.client.get<GroupGreekFlowByExpiryResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /group-flow/{flow_group}/greek-flow/{expiry} endpoint');
      }
      
      return response;
    }, `Get group greek flow by expiry for ${flowGroup} - ${expiry}`);
  }

  // ========== Insider Transactions ==========

  /**
   * Récupère les dernières transactions d'insiders
   * GET /insider/transactions
   * 
   * @param params Paramètres de requête (filtres nombreux)
   * @returns Réponse avec les transactions d'insiders
   */
  async getInsiderTransactions(params?: InsiderTransactionsQueryParams): Promise<InsiderTransactionsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      
      if (params) {
        // common_stock_only - Boolean
        if (params.common_stock_only !== undefined) {
          queryParams.append('common_stock_only', String(params.common_stock_only));
        }
        
        // industries - String
        if (params.industries) {
          queryParams.append('industries', params.industries);
        }
        
        // is_director - Boolean
        if (params.is_director !== undefined) {
          queryParams.append('is_director', String(params.is_director));
        }
        
        // is_officer - Boolean
        if (params.is_officer !== undefined) {
          queryParams.append('is_officer', String(params.is_officer));
        }
        
        // is_s_p_500 - Boolean
        if (params.is_s_p_500 !== undefined) {
          queryParams.append('is_s_p_500', String(params.is_s_p_500));
        }
        
        // is_ten_percent_owner - Boolean
        if (params.is_ten_percent_owner !== undefined) {
          queryParams.append('is_ten_percent_owner', String(params.is_ten_percent_owner));
        }
        
        // limit - Number (1-500, défaut: 500)
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        
        // market_cap_size - String (small, mid, large)
        if (params.market_cap_size) {
          queryParams.append('market_cap_size', params.market_cap_size);
        }
        
        // max_amount - String
        if (params.max_amount) {
          queryParams.append('max_amount', params.max_amount);
        }
        
        // max_earnings_dte - String
        if (params.max_earnings_dte) {
          queryParams.append('max_earnings_dte', params.max_earnings_dte);
        }
        
        // max_marketcap - Number (>= 0)
        if (params.max_marketcap !== undefined && params.max_marketcap >= 0) {
          queryParams.append('max_marketcap', String(params.max_marketcap));
        }
        
        // max_price - String
        if (params.max_price) {
          queryParams.append('max_price', params.max_price);
        }
        
        // max_value - String
        if (params.max_value) {
          queryParams.append('max_value', params.max_value);
        }
        
        // min_amount - String
        if (params.min_amount) {
          queryParams.append('min_amount', params.min_amount);
        }
        
        // min_earnings_dte - String
        if (params.min_earnings_dte) {
          queryParams.append('min_earnings_dte', params.min_earnings_dte);
        }
        
        // min_marketcap - Number (>= 0)
        if (params.min_marketcap !== undefined && params.min_marketcap >= 0) {
          queryParams.append('min_marketcap', String(params.min_marketcap));
        }
        
        // min_price - String
        if (params.min_price) {
          queryParams.append('min_price', params.min_price);
        }
        
        // min_value - String
        if (params.min_value) {
          queryParams.append('min_value', params.min_value);
        }
        
        // owner_name - String
        if (params.owner_name) {
          queryParams.append('owner_name', params.owner_name);
        }
        
        // page - Number (>= 0)
        if (params.page !== undefined && params.page >= 0) {
          queryParams.append('page', String(params.page));
        }
        
        // sectors - String
        if (params.sectors) {
          queryParams.append('sectors', params.sectors);
        }
        
        // security_ad_codes - String (JSON array string)
        if (params.security_ad_codes) {
          queryParams.append('security_ad_codes', params.security_ad_codes);
        }
        
        // ticker_symbol - String (comma separated)
        if (params.ticker_symbol) {
          queryParams.append('ticker_symbol', params.ticker_symbol);
        }
        
        // transaction_codes - Array (sera sérialisé)
        if (params.transaction_codes && Array.isArray(params.transaction_codes)) {
          params.transaction_codes.forEach((code) => {
            queryParams.append('transaction_codes[]', code);
          });
        }
        
        // group - Boolean (default: true)
        if (params.group !== undefined) {
          queryParams.append('group', String(params.group));
        }
      }
      
      const queryString = queryParams.toString();
      const endpoint = `/insider/transactions${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.client.get<InsiderTransactionsResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /insider/transactions endpoint');
      }
      
      return response;
    }, 'Get insider transactions');
  }

  /**
   * Récupère une vue agrégée du flow d'insiders pour un secteur donné
   * GET /insider/{sector}/sector-flow
   * 
   * @param sector Secteur financier (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec le flow d'insiders par secteur
   */
  async getInsiderSectorFlow(sector: FinancialSector, params?: InsiderSectorFlowQueryParams): Promise<InsiderSectorFlowResponse> {
    return handleError(async () => {
      const endpoint = `/insider/${encodeURIComponent(sector)}/sector-flow`;
      
      const response = await this.client.get<InsiderSectorFlowResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /insider/{sector}/sector-flow endpoint');
      }
      
      return response;
    }, `Get insider sector flow for ${sector}`);
  }

  /**
   * Récupère tous les insiders pour un ticker donné
   * GET /insider/{ticker}
   * 
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec les insiders
   */
  async getInsiders(ticker: string, params?: InsidersQueryParams): Promise<InsidersResponse> {
    return handleError(async () => {
      const endpoint = `/insider/${ticker.toUpperCase()}`;
      
      const response = await this.client.get<InsidersResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /insider/{ticker} endpoint');
      }
      
      return response;
    }, `Get insiders for ${ticker}`);
  }

  /**
   * Récupère une vue agrégée du flow d'insiders pour un ticker donné
   * GET /insider/{ticker}/ticker-flow
   * 
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec le flow d'insiders par ticker
   */
  async getInsiderTickerFlow(ticker: string, params?: InsiderTickerFlowQueryParams): Promise<InsiderTickerFlowResponse> {
    return handleError(async () => {
      const endpoint = `/insider/${ticker.toUpperCase()}/ticker-flow`;
      
      const response = await this.client.get<InsiderTickerFlowResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /insider/{ticker}/ticker-flow endpoint');
      }
      
      return response;
    }, `Get insider ticker flow for ${ticker}`);
  }

  // ========== Institutions ==========

  /**
   * Récupère les activités de trading pour une institution donnée
   * GET /institution/{name}/activity
   * 
   * @param name Nom de l'institution ou CIK (requis)
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse avec les activités de trading
   */
  async getInstitutionalActivity(name: string, params?: InstitutionalActivityQueryParams): Promise<InstitutionalActivityResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      
      if (params) {
        // date - String (YYYY-MM-DD)
        if (params.date) {
          queryParams.append('date', params.date);
        }
        
        // limit - Number (1-500, défaut: 500)
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        
        // page - Number (>= 0)
        if (params.page !== undefined && params.page >= 0) {
          queryParams.append('page', String(params.page));
        }
      }
      
      const queryString = queryParams.toString();
      const endpoint = `/institution/${encodeURIComponent(name)}/activity${queryString ? `?${queryString}` : ''}`;
      console.log('endpoint', endpoint);
      const response = await this.client.get<InstitutionalActivityResponse>(endpoint);
      console.log('response_from_repository', response);
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /institution/{name}/activity endpoint');
      }
      
      return response;
    }, `Get institutional activity for ${name}`);
  }

  /**
   * Récupère les holdings pour une institution donnée
   * GET /institution/{name}/holdings
   * 
   * @param name Nom de l'institution ou CIK (requis)
   * @param params Paramètres de requête (date, limit, order, etc.)
   * @returns Réponse avec les holdings
   */
  async getInstitutionalHoldings(name: string, params?: InstitutionalHoldingsQueryParams): Promise<InstitutionalHoldingsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      
      if (params) {
        // date - String (YYYY-MM-DD)
        if (params.date) {
          queryParams.append('date', params.date);
        }
        
        // end_date - String (YYYY-MM-DD)
        if (params.end_date) {
          queryParams.append('end_date', params.end_date);
        }
        
        // limit - Number (1-500, défaut: 500)
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        
        // order - String
        if (params.order) {
          queryParams.append('order', params.order);
        }
        
        // order_direction - String (desc ou asc, défaut: desc)
        if (params.order_direction) {
          queryParams.append('order_direction', params.order_direction);
        }
        
        // page - Number (>= 0)
        if (params.page !== undefined && params.page >= 0) {
          queryParams.append('page', String(params.page));
        }
        
        // security_types - Array
        if (params.security_types && Array.isArray(params.security_types)) {
          params.security_types.forEach((type) => {
            queryParams.append('security_types[]', type);
          });
        }
        
        // start_date - String (YYYY-MM-DD)
        if (params.start_date) {
          queryParams.append('start_date', params.start_date);
        }
      }
      
      const queryString = queryParams.toString();
      const endpoint = `/institution/${encodeURIComponent(name)}/holdings${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.client.get<InstitutionalHoldingsResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /institution/{name}/holdings endpoint');
      }
      
      return response;
    }, `Get institutional holdings for ${name}`);
  }

  /**
   * Récupère l'exposition sectorielle pour une institution donnée
   * GET /institution/{name}/sectors
   * 
   * @param name Nom de l'institution ou CIK (requis)
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse avec l'exposition sectorielle
   */
  async getInstitutionSectorExposure(name: string, params?: SectorExposureQueryParams): Promise<SectorExposureResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      
      if (params) {
        // date - String (YYYY-MM-DD)
        if (params.date) {
          queryParams.append('date', params.date);
        }
        
        // limit - Number (1-500, défaut: 500)
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        
        // page - Number (>= 0)
        if (params.page !== undefined && params.page >= 0) {
          queryParams.append('page', String(params.page));
        }
      }
      
      const queryString = queryParams.toString();
      const endpoint = `/institution/${encodeURIComponent(name)}/sectors${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.client.get<SectorExposureResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /institution/{name}/sectors endpoint');
      }
      
      return response;
    }, `Get sector exposure for ${name}`);
  }

  /**
   * Récupère la propriété institutionnelle d'un ticker donné
   * GET /institution/{ticker}/ownership
   * 
   * @param ticker Liste de tickers séparés par des virgules (requis)
   * @param params Paramètres de requête (date, limit, order, etc.)
   * @returns Réponse avec la propriété institutionnelle
   */
  async getInstitutionalOwnership(ticker: string, params?: InstitutionalOwnershipQueryParams): Promise<InstitutionalOwnershipResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      
      if (params) {
        // date - String (YYYY-MM-DD)
        if (params.date) {
          queryParams.append('date', params.date);
        }
        
        // end_date - String (YYYY-MM-DD)
        if (params.end_date) {
          queryParams.append('end_date', params.end_date);
        }
        
        // limit - Number (1-500, défaut: 500)
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        
        // order - String
        if (params.order) {
          queryParams.append('order', params.order);
        }
        
        // order_direction - String (desc ou asc, défaut: desc)
        if (params.order_direction) {
          queryParams.append('order_direction', params.order_direction);
        }
        
        // page - Number (>= 0)
        if (params.page !== undefined && params.page >= 0) {
          queryParams.append('page', String(params.page));
        }
        
        // start_date - String (YYYY-MM-DD)
        if (params.start_date) {
          queryParams.append('start_date', params.start_date);
        }
        
        // tags - Array
        if (params.tags && Array.isArray(params.tags)) {
          params.tags.forEach((tag) => {
            queryParams.append('tags[]', tag);
          });
        }
      }
      
      const queryString = queryParams.toString();
      const endpoint = `/institution/${encodeURIComponent(ticker)}/ownership${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.client.get<InstitutionalOwnershipResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /institution/{ticker}/ownership endpoint');
      }
      
      return response;
    }, `Get institutional ownership for ${ticker}`);
  }

  /**
   * Récupère une liste d'institutions
   * GET /institutions
   * 
   * @param params Paramètres de requête (limit, name, order, tags, etc.)
   * @returns Réponse avec la liste des institutions
   */
  async getInstitutions(params?: InstitutionsQueryParams): Promise<InstitutionsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      
      if (params) {
        // limit - Number (1-1000, défaut: 500)
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 1000)));
        }
        
        // max_share_value - String
        if (params.max_share_value) {
          queryParams.append('max_share_value', params.max_share_value);
        }
        
        // max_total_value - String
        if (params.max_total_value) {
          queryParams.append('max_total_value', params.max_total_value);
        }
        
        // min_share_value - String
        if (params.min_share_value) {
          queryParams.append('min_share_value', params.min_share_value);
        }
        
        // min_total_value - String
        if (params.min_total_value) {
          queryParams.append('min_total_value', params.min_total_value);
        }
        
        // name - String
        if (params.name) {
          queryParams.append('name', params.name);
        }
        
        // order - String
        if (params.order) {
          queryParams.append('order', params.order);
        }
        
        // order_direction - String (desc ou asc, défaut: desc)
        if (params.order_direction) {
          queryParams.append('order_direction', params.order_direction);
        }
        
        // page - Number (>= 0)
        if (params.page !== undefined && params.page >= 0) {
          queryParams.append('page', String(params.page));
        }
        
        // tags - Array
        if (params.tags && Array.isArray(params.tags)) {
          params.tags.forEach((tag) => {
            queryParams.append('tags[]', tag);
          });
        }
      }
      
      const queryString = queryParams.toString();
      const endpoint = `/institutions${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.client.get<InstitutionsResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /institutions endpoint');
      }
      
      return response;
    }, 'Get institutions');
  }

  /**
   * Récupère les derniers dépôts institutionnels
   * GET /institutions/latest_filings
   * 
   * @param params Paramètres de requête (date, limit, name, order, etc.)
   * @returns Réponse avec les derniers dépôts
   */
  async getLatestFilings(params?: LatestFilingsQueryParams): Promise<LatestFilingsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      
      if (params) {
        // date - String (YYYY-MM-DD)
        if (params.date) {
          queryParams.append('date', params.date);
        }
        
        // limit - Number (1-500, défaut: 500)
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        
        // name - String
        if (params.name) {
          queryParams.append('name', params.name);
        }
        
        // order - String
        if (params.order) {
          queryParams.append('order', params.order);
        }
        
        // order_direction - String (desc ou asc, défaut: desc)
        if (params.order_direction) {
          queryParams.append('order_direction', params.order_direction);
        }
        
        // page - Number (>= 0)
        if (params.page !== undefined && params.page >= 0) {
          queryParams.append('page', String(params.page));
        }
      }
      
      const queryString = queryParams.toString();
      const endpoint = `/institutions/latest_filings${queryString ? `?${queryString}` : ''}`;
      
      const response = await this.client.get<LatestFilingsResponse>(endpoint);
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /institutions/latest_filings endpoint');
      }
      
      return response;
    }, 'Get latest filings');
  }

  // ========== Market ==========

  /**
   * Récupère les corrélations entre deux tickers
   * GET /market/correlations
   *
   * @param params Paramètres de requête (ticker1, ticker2, date)
   * @returns Réponse avec les corrélations
   */
  async getCorrelations(params: CorrelationsQueryParams): Promise<CorrelationsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      queryParams.append('tickers', params.tickers);
      if (params.interval) {
        queryParams.append('interval', params.interval);
      }
      if (params.start_date) {
        queryParams.append('start_date', params.start_date);
      }
      if (params.end_date) {
        queryParams.append('end_date', params.end_date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/market/correlations?${queryString}`;

      const response = await this.client.get<CorrelationsResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /market/correlations endpoint');
      }

      return response;
    }, 'Get correlations');
  }

  /**
   * Récupère le calendrier économique
   * GET /market/economic-calendar
   *
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse avec le calendrier économique
   */
  async getEconomicCalendar(params?: EconomicCalendarQueryParams): Promise<EconomicCalendarResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.date) {
          queryParams.append('date', params.date);
        }
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        if (params.page !== undefined) {
          queryParams.append('page', String(params.page));
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/market/economic-calendar${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<EconomicCalendarResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /market/economic-calendar endpoint');
      }

      return response;
    }, 'Get economic calendar');
  }

  /**
   * Récupère le calendrier FDA
   * GET /market/fda-calendar
   *
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse avec le calendrier FDA
   */
  async getFDACalendar(params?: FDACalendarQueryParams): Promise<FDACalendarResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.date) {
          queryParams.append('date', params.date);
        }
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        if (params.page !== undefined) {
          queryParams.append('page', String(params.page));
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/market/fda-calendar${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<FDACalendarResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /market/fda-calendar endpoint');
      }

      return response;
    }, 'Get FDA calendar');
  }

  /**
   * Récupère les totaux d'achats et ventes d'insiders
   * GET /market/insider-buy-sells
   *
   * @param params Paramètres de requête (start_date, end_date, limit, page)
   * @returns Réponse avec les totaux d'achats et ventes
   */
  async getInsiderBuySells(params?: InsiderBuySellsQueryParams): Promise<InsiderBuySellsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.start_date) {
          queryParams.append('start_date', params.start_date);
        }
        if (params.end_date) {
          queryParams.append('end_date', params.end_date);
        }
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        if (params.page !== undefined) {
          queryParams.append('page', String(params.page));
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/market/insider-buy-sells${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<InsiderBuySellsResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /market/insider-buy-sells endpoint');
      }

      return response;
    }, 'Get insider buy sells');
  }

  /**
   * Récupère le Market Tide
   * GET /market/market-tide
   *
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse avec le Market Tide
   */
  async getMarketTide(params?: MarketTideQueryParams): Promise<MarketTideResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.date) {
          queryParams.append('date', params.date);
        }
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        if (params.page !== undefined) {
          queryParams.append('page', String(params.page));
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/market/market-tide${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<MarketTideResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /market/market-tide endpoint');
      }

      return response;
    }, 'Get market tide');
  }

  /**
   * Récupère les changements d'Open Interest
   * GET /market/oi-change
   *
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse avec les changements d'OI
   */
  async getOIChange(params?: OIChangeQueryParams): Promise<OIChangeResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.date) {
          queryParams.append('date', params.date);
        }
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        if (params.page !== undefined) {
          queryParams.append('page', String(params.page));
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/market/oi-change${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<OIChangeResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /market/oi-change endpoint');
      }

      return response;
    }, 'Get OI change');
  }

  /**
   * Récupère les ETFs sectoriels
   * GET /market/sector-etfs
   *
   * @param params Paramètres de requête (aucun selon la documentation)
   * @returns Réponse avec les ETFs sectoriels
   */
  async getSectorETFs(params?: SectorETFsQueryParams): Promise<SectorETFsResponse> {
    return handleError(async () => {
      const endpoint = `/market/sector-etfs`;

      const response = await this.client.get<SectorETFsResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /market/sector-etfs endpoint');
      }

      return response;
    }, 'Get sector ETFs');
  }

  /**
   * Récupère les SPIKE
   * GET /market/spike
   *
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse avec les SPIKE
   */
  async getSpike(params?: SpikeQueryParams): Promise<SpikeResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.date) {
          queryParams.append('date', params.date);
        }
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        if (params.page !== undefined) {
          queryParams.append('page', String(params.page));
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/market/spike${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<SpikeResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /market/spike endpoint');
      }

      return response;
    }, 'Get spike');
  }

  /**
   * Récupère le Top Net Impact
   * GET /market/top-net-impact
   *
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse avec le Top Net Impact
   */
  async getTopNetImpact(params?: TopNetImpactQueryParams): Promise<TopNetImpactResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.date) {
          queryParams.append('date', params.date);
        }
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        if (params.page !== undefined) {
          queryParams.append('page', String(params.page));
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/market/top-net-impact${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<TopNetImpactResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /market/top-net-impact endpoint');
      }

      return response;
    }, 'Get top net impact');
  }

  /**
   * Récupère le volume total d'options
   * GET /market/total-options-volume
   *
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse avec le volume total d'options
   */
  async getTotalOptionsVolume(params?: TotalOptionsVolumeQueryParams): Promise<TotalOptionsVolumeResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.date) {
          queryParams.append('date', params.date);
        }
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        if (params.page !== undefined) {
          queryParams.append('page', String(params.page));
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/market/total-options-volume${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<TotalOptionsVolumeResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /market/total-options-volume endpoint');
      }

      return response;
    }, 'Get total options volume');
  }

  /**
   * Récupère le Sector Tide
   * GET /market/{sector}/sector-tide
   *
   * @param sector Secteur financier (requis)
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse avec le Sector Tide
   */
  async getSectorTide(sector: string, params?: SectorTideQueryParams): Promise<SectorTideResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.date) {
          queryParams.append('date', params.date);
        }
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        if (params.page !== undefined) {
          queryParams.append('page', String(params.page));
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/market/${encodeURIComponent(sector)}/sector-tide${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<SectorTideResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /market/{sector}/sector-tide endpoint');
      }

      return response;
    }, `Get sector tide for ${sector}`);
  }

  /**
   * Récupère l'ETF Tide
   * GET /market/{ticker}/etf-tide
   *
   * @param ticker Ticker de l'ETF (requis)
   * @param params Paramètres de requête (date, limit, page)
   * @returns Réponse avec l'ETF Tide
   */
  async getETFTide(ticker: string, params?: ETFTideQueryParams): Promise<ETFTideResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.date) {
          queryParams.append('date', params.date);
        }
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        if (params.page !== undefined) {
          queryParams.append('page', String(params.page));
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/market/${ticker.toUpperCase()}/etf-tide${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<ETFTideResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /market/{ticker}/etf-tide endpoint');
      }

      return response;
    }, `Get ETF tide for ${ticker}`);
  }

  /**
   * Récupère le Net Flow par expiry
   * GET /net-flow/expiry
   *
   * @param params Paramètres de requête (ticker, date, limit, page)
   * @returns Réponse avec le Net Flow par expiry
   */
  async getNetFlowExpiry(params: NetFlowExpiryQueryParams): Promise<NetFlowExpiryResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      queryParams.append('ticker', params.ticker);
      if (params.date) {
        queryParams.append('date', params.date);
      }
      if (params.limit !== undefined) {
        queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
      }
      if (params.page !== undefined) {
        queryParams.append('page', String(params.page));
      }

      const queryString = queryParams.toString();
      const endpoint = `/net-flow/expiry?${queryString}`;

      const response = await this.client.get<NetFlowExpiryResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /net-flow/expiry endpoint');
      }

      return response;
    }, 'Get net flow expiry');
  }

  // ========== Stock ==========

  /**
   * Récupère la liste des tickers dans un secteur donné
   * GET /stock/{sector}/tickers
   *
   * @param sector Secteur financier (requis)
   * @returns Réponse avec la liste des tickers
   */
  async getSectorTickers(sector: string): Promise<SectorTickersResponse> {
    return handleError(async () => {
      const endpoint = `/stock/${encodeURIComponent(sector)}/tickers`;

      const response = await this.client.get<SectorTickersResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{sector}/tickers endpoint');
      }

      return response;
    }, `Get sector tickers for ${sector}`);
  }

  /**
   * Récupère les chaînes ATM pour les expirations données
   * GET /stock/{ticker}/atm-chains
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (expirations)
   * @returns Réponse avec les chaînes ATM
   */
  async getATMChains(ticker: string, params: ATMChainsQueryParams): Promise<ATMChainsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      // L'API accepte expirations[]=date1&expirations[]=date2 (plusieurs paramètres avec [])
      params.expirations.forEach(exp => queryParams.append('expirations[]', exp));

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/atm-chains?${queryString}`;

      const response = await this.client.get<ATMChainsResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/atm-chains endpoint');
      }

      return response;
    }, `Get ATM chains for ${ticker}`);
  }

  /**
   * Récupère les flow alerts (déprécié)
   * GET /stock/{ticker}/flow-alerts
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (is_ask_side, is_bid_side, limit)
   * @returns Réponse avec les flow alerts
   */
  async getFlowAlerts(ticker: string, params?: FlowAlertsQueryParams): Promise<FlowAlertsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.is_ask_side !== undefined) {
          queryParams.append('is_ask_side', String(params.is_ask_side));
        }
        if (params.is_bid_side !== undefined) {
          queryParams.append('is_bid_side', String(params.is_bid_side));
        }
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 200)));
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/flow-alerts${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<FlowAlertsResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/flow-alerts endpoint');
      }

      return response;
    }, `Get flow alerts for ${ticker}`);
  }

  /**
   * Récupère le flow par expiration
   * GET /stock/{ticker}/flow-per-expiry
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec le flow par expiration
   */
  async getFlowPerExpiry(ticker: string, params?: FlowPerExpiryQueryParams): Promise<FlowPerExpiryResponse> {
    return handleError(async () => {
      const endpoint = `/stock/${ticker.toUpperCase()}/flow-per-expiry`;

      const response = await this.client.get<any>(endpoint);

      // L'API retourne directement un tableau, extraire la date du premier élément
      if (Array.isArray(response) && response.length > 0) {
        const date = response[0].date || new Date().toISOString().split('T')[0];
        return { data: response, date };
      } else if (response && Array.isArray(response.data)) {
        // Format alternatif: { data: [...], date: "..." }
        return response as FlowPerExpiryResponse;
      } else {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/flow-per-expiry endpoint');
      }
    }, `Get flow per expiry for ${ticker}`);
  }

  /**
   * Récupère le flow par strike
   * GET /stock/{ticker}/flow-per-strike
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec le flow par strike
   */
  async getFlowPerStrike(ticker: string, params?: FlowPerStrikeQueryParams): Promise<FlowPerStrikeResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/flow-per-strike${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<FlowPerStrikeResponse>(endpoint);

      if (!Array.isArray(response)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/flow-per-strike endpoint');
      }

      return response;
    }, `Get flow per strike for ${ticker}`);
  }

  /**
   * Récupère le flow par strike intraday
   * GET /stock/{ticker}/flow-per-strike-intraday
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date, filter)
   * @returns Réponse avec le flow par strike intraday
   */
  async getFlowPerStrikeIntraday(ticker: string, params?: FlowPerStrikeIntradayQueryParams): Promise<FlowPerStrikeIntradayResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.date) {
          queryParams.append('date', params.date);
        }
        if (params.filter) {
          queryParams.append('filter', params.filter);
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/flow-per-strike-intraday${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<any>(endpoint);

      // L'API retourne { data: [...] }, pas un array direct
      if (response && Array.isArray(response.data)) {
        return response.data as FlowPerStrikeIntradayResponse;
      } else if (Array.isArray(response)) {
        // Format alternatif: array direct
        return response as FlowPerStrikeIntradayResponse;
      } else {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/flow-per-strike-intraday endpoint');
      }
    }, `Get flow per strike intraday for ${ticker}`);
  }

  /**
   * Récupère les flows récents
   * GET /stock/{ticker}/flow-recent
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (min_premium, side)
   * @returns Réponse avec les flows récents
   */
  async getRecentFlows(ticker: string, params?: RecentFlowsQueryParams): Promise<RecentFlowsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.min_premium !== undefined) {
          queryParams.append('min_premium', String(Math.max(params.min_premium, 0)));
        }
        if (params.side) {
          queryParams.append('side', params.side);
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/flow-recent${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<any>(endpoint);

      // L'API retourne directement un tableau, extraire la date du premier élément
      if (Array.isArray(response) && response.length > 0) {
        const date = response[0].date || new Date().toISOString().split('T')[0];
        return { data: response, date };
      } else if (response && Array.isArray(response.data)) {
        // Format alternatif: { data: [...], date: "..." }
        return response as RecentFlowsResponse;
      } else {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/flow-recent endpoint');
      }
    }, `Get recent flows for ${ticker}`);
  }

  /**
   * Récupère l'exposition grecque
   * GET /stock/{ticker}/greek-exposure
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date, timeframe)
   * @returns Réponse avec l'exposition grecque
   */
  async getGreekExposure(ticker: string, params?: GreekExposureQueryParams): Promise<GreekExposureResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.date) {
          queryParams.append('date', params.date);
        }
        if (params.timeframe) {
          queryParams.append('timeframe', params.timeframe);
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/greek-exposure${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<GreekExposureResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/greek-exposure endpoint');
      }

      return response;
    }, `Get greek exposure for ${ticker}`);
  }

  /**
   * Récupère l'exposition grecque par expiration
   * GET /stock/{ticker}/greek-exposure/expiry
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec l'exposition grecque par expiration
   */
  async getGreekExposureByExpiry(ticker: string, params?: GreekExposureByExpiryQueryParams): Promise<GreekExposureByExpiryResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/greek-exposure/expiry${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<GreekExposureByExpiryResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/greek-exposure/expiry endpoint');
      }

      return response;
    }, `Get greek exposure by expiry for ${ticker}`);
  }

  /**
   * Récupère l'exposition grecque par strike
   * GET /stock/{ticker}/greek-exposure/strike
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec l'exposition grecque par strike
   */
  async getGreekExposureByStrike(ticker: string, params?: GreekExposureByStrikeQueryParams): Promise<GreekExposureByStrikeResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/greek-exposure/strike${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<GreekExposureByStrikeResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/greek-exposure/strike endpoint');
      }

      return response;
    }, `Get greek exposure by strike for ${ticker}`);
  }

  /**
   * Récupère l'exposition grecque par strike et expiration
   * GET /stock/{ticker}/greek-exposure/strike-expiry
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date, expiry)
   * @returns Réponse avec l'exposition grecque par strike et expiration
   */
  async getGreekExposureByStrikeAndExpiry(ticker: string, params: GreekExposureByStrikeAndExpiryQueryParams): Promise<GreekExposureByStrikeAndExpiryResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      queryParams.append('expiry', params.expiry);

      if (params.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/greek-exposure/strike-expiry?${queryString}`;

      const response = await this.client.get<GreekExposureByStrikeAndExpiryResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/greek-exposure/strike-expiry endpoint');
      }

      return response;
    }, `Get greek exposure by strike and expiry for ${ticker}`);
  }

  /**
   * Récupère le greek flow
   * GET /stock/{ticker}/greek-flow
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec le greek flow
   */
  async getGreekFlow(ticker: string, params?: GreekFlowQueryParams): Promise<GreekFlowResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/greek-flow${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<GreekFlowResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/greek-flow endpoint');
      }

      return response;
    }, `Get greek flow for ${ticker}`);
  }

  /**
   * Récupère le greek flow par expiration
   * GET /stock/{ticker}/greek-flow/{expiry}
   *
   * @param ticker Symbole du ticker (requis)
   * @param expiry Date d'expiration (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec le greek flow par expiration
   */
  async getGreekFlowByExpiry(ticker: string, expiry: string, params?: GreekFlowByExpiryQueryParams): Promise<GreekFlowByExpiryResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/greek-flow/${expiry}${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<GreekFlowByExpiryResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/greek-flow/{expiry} endpoint');
      }

      return response;
    }, `Get greek flow by expiry for ${ticker}`);
  }

  /**
   * Récupère les greeks pour chaque strike pour une date d'expiration unique
   * GET /stock/{ticker}/greeks
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date, expiry)
   * @returns Réponse avec les greeks
   */
  async getGreeks(ticker: string, params: GreeksQueryParams): Promise<GreeksResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      queryParams.append('expiry', params.expiry);

      if (params.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/greeks?${queryString}`;

      const response = await this.client.get<GreeksResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/greeks endpoint');
      }

      return response;
    }, `Get greeks for ${ticker}`);
  }

  /**
   * Récupère le historical risk reversal skew
   * GET /stock/{ticker}/historical-risk-reversal-skew
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date, timeframe, delta, expiry)
   * @returns Réponse avec le historical risk reversal skew
   */
  async getHistoricalRiskReversalSkew(ticker: string, params: HistoricalRiskReversalSkewQueryParams): Promise<HistoricalRiskReversalSkewResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      queryParams.append('delta', params.delta);
      queryParams.append('expiry', params.expiry);

      if (params.date) {
        queryParams.append('date', params.date);
      }
      if (params.timeframe) {
        queryParams.append('timeframe', params.timeframe);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/historical-risk-reversal-skew?${queryString}`;

      const response = await this.client.get<HistoricalRiskReversalSkewResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/historical-risk-reversal-skew endpoint');
      }

      return response;
    }, `Get historical risk reversal skew for ${ticker}`);
  }

  /**
   * Récupère les informations sur un ticker
   * GET /stock/{ticker}/info
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec les informations
   */
  async getStockInfo(ticker: string, params?: StockInfoQueryParams): Promise<StockInfoResponse> {
    return handleError(async () => {
      const endpoint = `/stock/${ticker.toUpperCase()}/info`;

      const response = await this.client.get<StockInfoResponse>(endpoint);

      if (!response || !response.data) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/info endpoint');
      }

      return response;
    }, `Get stock info for ${ticker}`);
  }

  /**
   * Récupère les insider buy & sells
   * GET /stock/{ticker}/insider-buy-sells
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec les insider buy & sells
   */
  async getStockInsiderBuySells(ticker: string, params?: StockInsiderBuySellsQueryParams): Promise<StockInsiderBuySellsResponse> {
    return handleError(async () => {
      const endpoint = `/stock/${ticker.toUpperCase()}/insider-buy-sells`;

      const response = await this.client.get<StockInsiderBuySellsResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/insider-buy-sells endpoint');
      }

      return response;
    }, `Get stock insider buy sells for ${ticker}`);
  }

  /**
   * Récupère l'IV interpolée
   * GET /stock/{ticker}/interpolated-iv
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec l'IV interpolée
   */
  async getInterpolatedIV(ticker: string, params?: InterpolatedIVQueryParams): Promise<InterpolatedIVResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/interpolated-iv${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<InterpolatedIVResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/interpolated-iv endpoint');
      }

      return response;
    }, `Get interpolated IV for ${ticker}`);
  }

  /**
   * Récupère l'IV rank
   * GET /stock/{ticker}/iv-rank
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date, timespan)
   * @returns Réponse avec l'IV rank
   */
  async getIVRank(ticker: string, params?: IVRankQueryParams): Promise<IVRankResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.date) {
          queryParams.append('date', params.date);
        }
        if (params.timespan) {
          queryParams.append('timespan', params.timespan);
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/iv-rank${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<IVRankResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/iv-rank endpoint');
      }

      return response;
    }, `Get IV rank for ${ticker}`);
  }

  /**
   * Récupère le max pain
   * GET /stock/{ticker}/max-pain
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec le max pain
   */
  async getMaxPain(ticker: string, params?: MaxPainQueryParams): Promise<MaxPainResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/max-pain${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<MaxPainResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/max-pain endpoint');
      }

      return response;
    }, `Get max pain for ${ticker}`);
  }

  /**
   * Récupère les net premium ticks
   * GET /stock/{ticker}/net-prem-ticks
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec les net premium ticks
   */
  async getNetPremiumTicks(ticker: string, params?: NetPremiumTicksQueryParams): Promise<NetPremiumTicksResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/net-prem-ticks${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<NetPremiumTicksResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/net-prem-ticks endpoint');
      }

      return response;
    }, `Get net premium ticks for ${ticker}`);
  }

  /**
   * Récupère le NOPE
   * GET /stock/{ticker}/nope
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec le NOPE
   */
  async getNOPE(ticker: string, params?: NOPEQueryParams): Promise<NOPEResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/nope${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<NOPEResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/nope endpoint');
      }

      return response;
    }, `Get NOPE for ${ticker}`);
  }

  /**
   * Récupère les données OHLC
   * GET /stock/{ticker}/ohlc/{candle_size}
   *
   * @param ticker Symbole du ticker (requis)
   * @param candleSize Taille de la bougie (requis)
   * @param params Paramètres de requête (date, end_date, limit, timeframe)
   * @returns Réponse avec les données OHLC
   */
  async getOHLC(ticker: string, candleSize: string, params?: OHLCQueryParams): Promise<OHLCResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.date) {
          queryParams.append('date', params.date);
        }
        if (params.end_date) {
          queryParams.append('end_date', params.end_date);
        }
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 2500)));
        }
        if (params.timeframe) {
          queryParams.append('timeframe', params.timeframe);
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/ohlc/${candleSize}${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<OHLCResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/ohlc/{candle_size} endpoint');
      }

      return response;
    }, `Get OHLC for ${ticker}`);
  }

  /**
   * Récupère les changements d'OI
   * GET /stock/{ticker}/oi-change
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date, limit, order, page)
   * @returns Réponse avec les changements d'OI
   */
  async getStockOIChange(ticker: string, params?: StockOIChangeQueryParams): Promise<StockOIChangeResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.date) {
          queryParams.append('date', params.date);
        }
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.max(params.limit, 1)));
        }
        if (params.order) {
          queryParams.append('order', params.order);
        }
        if (params.page !== undefined) {
          queryParams.append('page', String(params.page));
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/oi-change${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<StockOIChangeResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/oi-change endpoint');
      }

      return response;
    }, `Get OI change for ${ticker}`);
  }

  /**
   * Récupère l'OI par expiration
   * GET /stock/{ticker}/oi-per-expiry
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec l'OI par expiration
   */
  async getOIPerExpiry(ticker: string, params?: OIPerExpiryQueryParams): Promise<OIPerExpiryResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/oi-per-expiry${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<OIPerExpiryResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/oi-per-expiry endpoint');
      }

      return response;
    }, `Get OI per expiry for ${ticker}`);
  }

  /**
   * Récupère l'OI par strike
   * GET /stock/{ticker}/oi-per-strike
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec l'OI par strike
   */
  async getOIPerStrike(ticker: string, params?: OIPerStrikeQueryParams): Promise<OIPerStrikeResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/oi-per-strike${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<OIPerStrikeResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/oi-per-strike endpoint');
      }

      return response;
    }, `Get OI per strike for ${ticker}`);
  }

  /**
   * Récupère les option chains
   * GET /stock/{ticker}/option-chains
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec les option chains
   */
  async getOptionChains(ticker: string, params?: OptionChainsQueryParams): Promise<OptionChainsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/option-chains${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<OptionChainsResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/option-chains endpoint');
      }

      return response;
    }, `Get option chains for ${ticker}`);
  }

  /**
   * Récupère les niveaux de prix stock pour les options
   * GET /stock/{ticker}/option/stock-price-levels
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec les niveaux de prix
   */
  async getOptionStockPriceLevels(ticker: string, params?: OptionStockPriceLevelsQueryParams): Promise<OptionStockPriceLevelsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/option/stock-price-levels${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<OptionStockPriceLevelsResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/option/stock-price-levels endpoint');
      }

      return response;
    }, `Get option stock price levels for ${ticker}`);
  }

  /**
   * Récupère le volume et OI par expiration
   * GET /stock/{ticker}/option/volume-oi-expiry
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec le volume et OI par expiration
   */
  async getVolumeOIPerExpiry(ticker: string, params?: VolumeOIPerExpiryQueryParams): Promise<VolumeOIPerExpiryResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/option/volume-oi-expiry${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<VolumeOIPerExpiryResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/option/volume-oi-expiry endpoint');
      }

      return response;
    }, `Get volume OI per expiry for ${ticker}`);
  }

  /**
   * Récupère le volume d'options
   * GET /stock/{ticker}/options-volume
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (limit)
   * @returns Réponse avec le volume d'options
   */
  async getOptionsVolume(ticker: string, params?: OptionsVolumeQueryParams): Promise<OptionsVolumeResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.limit !== undefined) {
        queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/options-volume${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<OptionsVolumeResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/options-volume endpoint');
      }

      return response;
    }, `Get options volume for ${ticker}`);
  }

  /**
   * Récupère les spot exposures
   * GET /stock/{ticker}/spot-exposures
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec les spot exposures
   */
  async getSpotExposures(ticker: string, params?: SpotExposuresQueryParams): Promise<SpotExposuresResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/spot-exposures${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<SpotExposuresResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/spot-exposures endpoint');
      }

      return response;
    }, `Get spot exposures for ${ticker}`);
  }

  /**
   * Récupère les spot exposures par strike et expiration
   * GET /stock/{ticker}/spot-exposures/expiry-strike
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date, limit, max_dte, max_strike, min_dte, min_strike, page, expirations)
   * @returns Réponse avec les spot exposures par strike et expiration
   */
  async getSpotExposureByStrikeAndExpiry(ticker: string, params: SpotExposureByStrikeAndExpiryQueryParams): Promise<SpotExposureByStrikeAndExpiryResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      // L'API attend expirations[]=date1&expirations[]=date2 (plusieurs paramètres avec [])
      // Mais testons d'abord avec le format séparé par virgules
      params.expirations.forEach(exp => queryParams.append('expirations[]', exp));

      if (params.date) {
        queryParams.append('date', params.date);
      }
      if (params.limit !== undefined) {
        queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
      }
      if (params.max_dte !== undefined) {
        queryParams.append('max_dte', String(Math.max(params.max_dte, 0)));
      }
      if (params.max_strike !== undefined) {
        queryParams.append('max_strike', String(Math.max(params.max_strike, 0)));
      }
      if (params.min_dte !== undefined) {
        queryParams.append('min_dte', String(Math.max(params.min_dte, 0)));
      }
      if (params.min_strike !== undefined) {
        queryParams.append('min_strike', String(Math.max(params.min_strike, 0)));
      }
      if (params.page !== undefined) {
        queryParams.append('page', String(params.page));
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/spot-exposures/expiry-strike?${queryString}`;

      const response = await this.client.get<SpotExposureByStrikeAndExpiryResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/spot-exposures/expiry-strike endpoint');
      }

      return response;
    }, `Get spot exposure by strike and expiry for ${ticker}`);
  }

  /**
   * Récupère les spot exposures par strike
   * GET /stock/{ticker}/spot-exposures/strike
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date, limit, max_strike, min_strike, page)
   * @returns Réponse avec les spot exposures par strike
   */
  async getSpotExposureByStrike(ticker: string, params?: SpotExposureByStrikeQueryParams): Promise<SpotExposureByStrikeResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.date) {
          queryParams.append('date', params.date);
        }
        if (params.limit !== undefined) {
          queryParams.append('limit', String(Math.min(Math.max(params.limit, 1), 500)));
        }
        if (params.max_strike !== undefined) {
          queryParams.append('max_strike', String(Math.max(params.max_strike, 0)));
        }
        if (params.min_strike !== undefined) {
          queryParams.append('min_strike', String(Math.max(params.min_strike, 0)));
        }
        if (params.page !== undefined) {
          queryParams.append('page', String(params.page));
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/spot-exposures/strike${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<SpotExposureByStrikeResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/spot-exposures/strike endpoint');
      }

      return response;
    }, `Get spot exposure by strike for ${ticker}`);
  }

  /**
   * Récupère l'état du stock
   * GET /stock/{ticker}/stock-state
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec l'état du stock
   */
  async getStockState(ticker: string, params?: StockStateQueryParams): Promise<StockStateResponse> {
    return handleError(async () => {
      const endpoint = `/stock/${ticker.toUpperCase()}/stock-state`;

      const response = await this.client.get<StockStateResponse>(endpoint);

      if (!response || !response.data) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/stock-state endpoint');
      }

      return response;
    }, `Get stock state for ${ticker}`);
  }

  /**
   * Récupère les niveaux de prix volume stock
   * GET /stock/{ticker}/stock-volume-price-levels
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec les niveaux de prix volume
   */
  async getStockVolumePriceLevels(ticker: string, params?: StockVolumePriceLevelsQueryParams): Promise<StockVolumePriceLevelsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/stock-volume-price-levels${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<StockVolumePriceLevelsResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/stock-volume-price-levels endpoint');
      }

      return response;
    }, `Get stock volume price levels for ${ticker}`);
  }

  /**
   * Récupère la volatilité réalisée
   * GET /stock/{ticker}/volatility/realized
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date, timeframe)
   * @returns Réponse avec la volatilité réalisée
   */
  async getRealizedVolatility(ticker: string, params?: RealizedVolatilityQueryParams): Promise<RealizedVolatilityResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params) {
        if (params.date) {
          queryParams.append('date', params.date);
        }
        if (params.timeframe) {
          queryParams.append('timeframe', params.timeframe);
        }
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/volatility/realized${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<RealizedVolatilityResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/volatility/realized endpoint');
      }

      return response;
    }, `Get realized volatility for ${ticker}`);
  }

  /**
   * Récupère les statistiques de volatilité
   * GET /stock/{ticker}/volatility/stats
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec les statistiques de volatilité
   */
  async getVolatilityStats(ticker: string, params?: VolatilityStatsQueryParams): Promise<VolatilityStatsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/volatility/stats${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<VolatilityStatsResponse>(endpoint);

      if (!response || !response.data) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/volatility/stats endpoint');
      }

      return response;
    }, `Get volatility stats for ${ticker}`);
  }

  /**
   * Récupère la structure de terme de volatilité implicite
   * GET /stock/{ticker}/volatility/term-structure
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec la structure de terme
   */
  async getVolatilityTermStructure(ticker: string, params?: VolatilityTermStructureQueryParams): Promise<VolatilityTermStructureResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/volatility/term-structure${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<VolatilityTermStructureResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/volatility/term-structure endpoint');
      }

      return response;
    }, `Get volatility term structure for ${ticker}`);
  }

  // ========== Shorts ==========

  /**
   * Récupère les données de short
   * GET /shorts/{ticker}/data
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec les données de short
   */
  async getShortData(ticker: string, params?: ShortDataQueryParams): Promise<ShortDataResponse> {
    return handleError(async () => {
      const endpoint = `/shorts/${ticker.toUpperCase()}/data`;

      const response = await this.client.get<ShortDataResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /shorts/{ticker}/data endpoint');
      }

      return response;
    }, `Get short data for ${ticker}`);
  }

  /**
   * Récupère les failures to deliver
   * GET /shorts/{ticker}/ftds
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (date)
   * @returns Réponse avec les failures to deliver
   */
  async getFailuresToDeliver(ticker: string, params?: FailuresToDeliverQueryParams): Promise<FailuresToDeliverResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();

      if (params?.date) {
        queryParams.append('date', params.date);
      }

      const queryString = queryParams.toString();
      const endpoint = `/shorts/${ticker.toUpperCase()}/ftds${queryString ? `?${queryString}` : ''}`;

      const response = await this.client.get<FailuresToDeliverResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /shorts/{ticker}/ftds endpoint');
      }

      return response;
    }, `Get failures to deliver for ${ticker}`);
  }

  /**
   * Récupère le short interest et float
   * GET /shorts/{ticker}/interest-float
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec le short interest et float
   */
  async getShortInterestAndFloat(ticker: string, params?: ShortInterestAndFloatQueryParams): Promise<ShortInterestAndFloatResponse> {
    return handleError(async () => {
      const endpoint = `/shorts/${ticker.toUpperCase()}/interest-float`;

      const response = await this.client.get<any>(endpoint);

      // L'API retourne un tableau, prendre le premier élément (le plus récent)
      if (Array.isArray(response.data) && response.data.length > 0) {
        return {
          data: response.data[0],
        };
      }

      if (!response || !response.data) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /shorts/{ticker}/interest-float endpoint');
      }

      // Si c'est déjà un objet unique
      return {
        data: response.data,
      };
    }, `Get short interest and float for ${ticker}`);
  }

  /**
   * Récupère le volume de short et ratio
   * GET /shorts/{ticker}/volume-and-ratio
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec le volume de short et ratio
   */
  async getShortVolumeAndRatio(ticker: string, params?: ShortVolumeAndRatioQueryParams): Promise<ShortVolumeAndRatioResponse> {
    return handleError(async () => {
      const endpoint = `/shorts/${ticker.toUpperCase()}/volume-and-ratio`;

      const response = await this.client.get<any>(endpoint);

      // Gérer les différents formats de réponse
      let data: ShortVolumeAndRatio[];
      if (Array.isArray(response)) {
        // L'API retourne directement un tableau
        data = response;
      } else if (response && Array.isArray(response.data)) {
        // L'API retourne { data: [...] }
        data = response.data;
      } else if (response && Array.isArray(response.si)) {
        // L'API retourne { si: [...] } (format alternatif)
        data = response.si;
      } else {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /shorts/{ticker}/volume-and-ratio endpoint');
      }

      return { data };
    }, `Get short volume and ratio for ${ticker}`);
  }

  /**
   * Récupère le volume de short par échange
   * GET /shorts/{ticker}/volumes-by-exchange
   *
   * @param ticker Symbole du ticker (requis)
   * @param params Paramètres de requête (aucun selon la doc)
   * @returns Réponse avec le volume de short par échange
   */
  async getShortVolumeByExchange(ticker: string, params?: ShortVolumeByExchangeQueryParams): Promise<ShortVolumeByExchangeResponse> {
    return handleError(async () => {
      const endpoint = `/shorts/${ticker.toUpperCase()}/volumes-by-exchange`;

      const response = await this.client.get<ShortVolumeByExchangeResponse>(endpoint);

      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /shorts/{ticker}/volumes-by-exchange endpoint');
      }

      return response;
    }, `Get short volume by exchange for ${ticker}`);
  }

  // ========== Seasonality ==========

  /**
   * Récupère le changement de prix par mois par année
   * GET /seasonality/{ticker}/year-month
   */
  async getYearMonthPriceChange(ticker: string, params?: YearMonthPriceChangeQueryParams): Promise<YearMonthPriceChangeResponse> {
    return handleError(async () => {
      const endpoint = `/seasonality/${ticker.toUpperCase()}/year-month`;
      const response = await this.client.get<YearMonthPriceChangeResponse>(endpoint);
      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /seasonality/{ticker}/year-month endpoint');
      }
      return response;
    }, `Get year-month price change for ${ticker}`);
  }

  /**
   * Récupère le retour moyen par mois
   * GET /seasonality/{ticker}/monthly
   */
  async getMonthlyAverageReturn(ticker: string, params?: MonthlyAverageReturnQueryParams): Promise<MonthlyAverageReturnResponse> {
    return handleError(async () => {
      const endpoint = `/seasonality/${ticker.toUpperCase()}/monthly`;
      const response = await this.client.get<MonthlyAverageReturnResponse>(endpoint);
      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /seasonality/{ticker}/monthly endpoint');
      }
      return response;
    }, `Get monthly average return for ${ticker}`);
  }

  /**
   * Récupère les performeurs du mois
   * GET /seasonality/{month}/performers
   */
  async getMonthPerformers(month: number, params?: MonthPerformersQueryParams): Promise<MonthPerformersResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.min_oi !== undefined) queryParams.append('min_oi', params.min_oi.toString());
      if (params?.min_years) queryParams.append('min_years', params.min_years.toString());
      if (params?.order) queryParams.append('order', params.order);
      if (params?.order_direction) queryParams.append('order_direction', params.order_direction);
      if (params?.s_p_500_nasdaq_only) queryParams.append('s_p_500_nasdaq_only', params.s_p_500_nasdaq_only);
      if (params?.ticker_for_sector) queryParams.append('ticker_for_sector', params.ticker_for_sector);
      const queryString = queryParams.toString();
      const endpoint = `/seasonality/${month}/performers${queryString ? `?${queryString}` : ''}`;
      const response = await this.client.get<MonthPerformersResponse>(endpoint);
      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /seasonality/{month}/performers endpoint');
      }
      return response;
    }, `Get month performers for month ${month}`);
  }

  /**
   * Récupère la saisonnalité du marché
   * GET /seasonality/market
   */
  async getMarketSeasonality(params?: MarketSeasonalityQueryParams): Promise<MarketSeasonalityResponse> {
    return handleError(async () => {
      const endpoint = '/seasonality/market';
      const response = await this.client.get<MarketSeasonalityResponse>(endpoint);
      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /seasonality/market endpoint');
      }
      return response;
    }, 'Get market seasonality');
  }

  // ========== Screener ==========

  /**
   * Récupère les ratings d'analystes
   * GET /screener/analysts
   */
  async getAnalystRatings(params?: AnalystRatingQueryParams): Promise<AnalystRatingResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      if (params?.action) queryParams.append('action', params.action);
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.recommendation) queryParams.append('recommendation', params.recommendation);
      if (params?.ticker) queryParams.append('ticker', params.ticker);
      const queryString = queryParams.toString();
      const endpoint = `/screener/analysts${queryString ? `?${queryString}` : ''}`;
      const response = await this.client.get<AnalystRatingResponse>(endpoint);
      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /screener/analysts endpoint');
      }
      return response;
    }, 'Get analyst ratings');
  }

  /**
   * Récupère les contrats d'options (Hottest Chains)
   * GET /screener/option-contracts
   */
  async getOptionContracts(params?: OptionContractsQueryParams): Promise<OptionContractsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      if (params?.date) queryParams.append('date', params.date);
      if (params?.exclude_ex_div_ticker !== undefined) queryParams.append('exclude_ex_div_ticker', params.exclude_ex_div_ticker.toString());
      if (params?.expiry_dates) {
        params.expiry_dates.forEach(date => queryParams.append('expiry_dates[]', date));
      }
      if (params?.is_otm !== undefined) queryParams.append('is_otm', params.is_otm.toString());
      if (params?.issue_types) {
        params.issue_types.forEach(type => queryParams.append('issue_types[]', type));
      }
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.max_ask_perc) queryParams.append('max_ask_perc', params.max_ask_perc);
      if (params?.max_ask_side_perc_7_day) queryParams.append('max_ask_side_perc_7_day', params.max_ask_side_perc_7_day);
      if (params?.max_avg_price) queryParams.append('max_avg_price', params.max_avg_price);
      if (params?.max_bear_perc) queryParams.append('max_bear_perc', params.max_bear_perc);
      if (params?.max_bid_perc) queryParams.append('max_bid_perc', params.max_bid_perc);
      if (params?.max_bid_side_perc_7_day) queryParams.append('max_bid_side_perc_7_day', params.max_bid_side_perc_7_day);
      if (params?.max_bull_perc) queryParams.append('max_bull_perc', params.max_bull_perc);
      if (params?.max_close) queryParams.append('max_close', params.max_close);
      if (params?.max_contract_30_d_avg_volume) queryParams.append('max_contract_30_d_avg_volume', params.max_contract_30_d_avg_volume.toString());
      if (params?.max_daily_perc_change) queryParams.append('max_daily_perc_change', params.max_daily_perc_change);
      if (params?.max_days_of_oi_increases) queryParams.append('max_days_of_oi_increases', params.max_days_of_oi_increases.toString());
      if (params?.max_days_of_vol_greater_than_oi) queryParams.append('max_days_of_vol_greater_than_oi', params.max_days_of_vol_greater_than_oi.toString());
      if (params?.max_delta) queryParams.append('max_delta', params.max_delta);
      if (params?.max_diff) queryParams.append('max_diff', params.max_diff);
      if (params?.max_dte) queryParams.append('max_dte', params.max_dte.toString());
      if (params?.max_earnings_dte) queryParams.append('max_earnings_dte', params.max_earnings_dte.toString());
      if (params?.max_floor_volume) queryParams.append('max_floor_volume', params.max_floor_volume.toString());
      if (params?.max_floor_volume_ratio) queryParams.append('max_floor_volume_ratio', params.max_floor_volume_ratio);
      if (params?.max_from_high_perc) queryParams.append('max_from_high_perc', params.max_from_high_perc);
      if (params?.max_from_low_perc) queryParams.append('max_from_low_perc', params.max_from_low_perc);
      if (params?.max_gamma) queryParams.append('max_gamma', params.max_gamma);
      if (params?.max_iv_perc) queryParams.append('max_iv_perc', params.max_iv_perc);
      if (params?.max_marketcap) queryParams.append('max_marketcap', params.max_marketcap);
      if (params?.max_multileg_volume_ratio) queryParams.append('max_multileg_volume_ratio', params.max_multileg_volume_ratio);
      if (params?.max_oi_change) queryParams.append('max_oi_change', params.max_oi_change.toString());
      if (params?.max_oi_change_perc) queryParams.append('max_oi_change_perc', params.max_oi_change_perc);
      if (params?.max_open_interest) queryParams.append('max_open_interest', params.max_open_interest.toString());
      if (params?.max_perc_change) queryParams.append('max_perc_change', params.max_perc_change);
      if (params?.max_premium) queryParams.append('max_premium', params.max_premium);
      if (params?.max_return_on_capital_perc) queryParams.append('max_return_on_capital_perc', params.max_return_on_capital_perc);
      if (params?.max_skew_perc) queryParams.append('max_skew_perc', params.max_skew_perc);
      if (params?.max_strike) queryParams.append('max_strike', params.max_strike);
      if (params?.max_sweep_volume_ratio) queryParams.append('max_sweep_volume_ratio', params.max_sweep_volume_ratio);
      if (params?.max_theta) queryParams.append('max_theta', params.max_theta);
      if (params?.max_ticker_30_d_avg_volume) queryParams.append('max_ticker_30_d_avg_volume', params.max_ticker_30_d_avg_volume.toString());
      if (params?.max_transactions) queryParams.append('max_transactions', params.max_transactions.toString());
      if (params?.max_underlying_price) queryParams.append('max_underlying_price', params.max_underlying_price);
      if (params?.max_vega) queryParams.append('max_vega', params.max_vega);
      if (params?.max_volume) queryParams.append('max_volume', params.max_volume.toString());
      if (params?.max_volume_oi_ratio) queryParams.append('max_volume_oi_ratio', params.max_volume_oi_ratio);
      if (params?.max_volume_ticker_vol_ratio) queryParams.append('max_volume_ticker_vol_ratio', params.max_volume_ticker_vol_ratio);
      if (params?.min_ask_perc) queryParams.append('min_ask_perc', params.min_ask_perc);
      if (params?.min_ask_side_perc_7_day) queryParams.append('min_ask_side_perc_7_day', params.min_ask_side_perc_7_day);
      if (params?.min_avg_price) queryParams.append('min_avg_price', params.min_avg_price);
      if (params?.min_bear_perc) queryParams.append('min_bear_perc', params.min_bear_perc);
      if (params?.min_bid_perc) queryParams.append('min_bid_perc', params.min_bid_perc);
      if (params?.min_bid_side_perc_7_day) queryParams.append('min_bid_side_perc_7_day', params.min_bid_side_perc_7_day);
      if (params?.min_bull_perc) queryParams.append('min_bull_perc', params.min_bull_perc);
      if (params?.min_close) queryParams.append('min_close', params.min_close);
      if (params?.min_contract_30_d_avg_volume) queryParams.append('min_contract_30_d_avg_volume', params.min_contract_30_d_avg_volume.toString());
      if (params?.min_daily_perc_change) queryParams.append('min_daily_perc_change', params.min_daily_perc_change);
      if (params?.min_days_of_oi_increases) queryParams.append('min_days_of_oi_increases', params.min_days_of_oi_increases.toString());
      if (params?.min_days_of_vol_greater_than_oi) queryParams.append('min_days_of_vol_greater_than_oi', params.min_days_of_vol_greater_than_oi.toString());
      if (params?.min_delta) queryParams.append('min_delta', params.min_delta);
      if (params?.min_diff) queryParams.append('min_diff', params.min_diff);
      if (params?.min_dte) queryParams.append('min_dte', params.min_dte.toString());
      if (params?.min_earnings_dte) queryParams.append('min_earnings_dte', params.min_earnings_dte.toString());
      if (params?.min_floor_volume) queryParams.append('min_floor_volume', params.min_floor_volume.toString());
      if (params?.min_floor_volume_ratio) queryParams.append('min_floor_volume_ratio', params.min_floor_volume_ratio);
      if (params?.min_from_high_perc) queryParams.append('min_from_high_perc', params.min_from_high_perc);
      if (params?.min_from_low_perc) queryParams.append('min_from_low_perc', params.min_from_low_perc);
      if (params?.min_gamma) queryParams.append('min_gamma', params.min_gamma);
      if (params?.min_iv_perc) queryParams.append('min_iv_perc', params.min_iv_perc);
      if (params?.min_marketcap) queryParams.append('min_marketcap', params.min_marketcap);
      if (params?.min_multileg_volume_ratio) queryParams.append('min_multileg_volume_ratio', params.min_multileg_volume_ratio);
      if (params?.min_oi_change !== undefined) queryParams.append('min_oi_change', params.min_oi_change.toString());
      if (params?.min_oi_change_perc) queryParams.append('min_oi_change_perc', params.min_oi_change_perc);
      if (params?.min_open_interest) queryParams.append('min_open_interest', params.min_open_interest.toString());
      if (params?.min_perc_change) queryParams.append('min_perc_change', params.min_perc_change);
      if (params?.min_premium) queryParams.append('min_premium', params.min_premium);
      if (params?.min_return_on_capital_perc) queryParams.append('min_return_on_capital_perc', params.min_return_on_capital_perc);
      if (params?.min_skew_perc) queryParams.append('min_skew_perc', params.min_skew_perc);
      if (params?.min_strike) queryParams.append('min_strike', params.min_strike);
      if (params?.min_sweep_volume_ratio) queryParams.append('min_sweep_volume_ratio', params.min_sweep_volume_ratio);
      if (params?.min_theta) queryParams.append('min_theta', params.min_theta);
      if (params?.min_ticker_30_d_avg_volume) queryParams.append('min_ticker_30_d_avg_volume', params.min_ticker_30_d_avg_volume.toString());
      if (params?.min_transactions) queryParams.append('min_transactions', params.min_transactions.toString());
      if (params?.min_underlying_price) queryParams.append('min_underlying_price', params.min_underlying_price);
      if (params?.min_vega) queryParams.append('min_vega', params.min_vega);
      if (params?.min_volume) queryParams.append('min_volume', params.min_volume.toString());
      if (params?.min_volume_oi_ratio) queryParams.append('min_volume_oi_ratio', params.min_volume_oi_ratio);
      if (params?.min_volume_ticker_vol_ratio) queryParams.append('min_volume_ticker_vol_ratio', params.min_volume_ticker_vol_ratio);
      if (params?.order) queryParams.append('order', params.order);
      if (params?.order_direction) queryParams.append('order_direction', params.order_direction);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.sectors) {
        params.sectors.forEach(sector => queryParams.append('sectors[]', sector));
      }
      if (params?.ticker_symbol) queryParams.append('ticker_symbol', params.ticker_symbol);
      if (params?.type) queryParams.append('type', params.type);
      if (params?.vol_greater_oi !== undefined) queryParams.append('vol_greater_oi', params.vol_greater_oi.toString());
      const queryString = queryParams.toString();
      const endpoint = `/screener/option-contracts${queryString ? `?${queryString}` : ''}`;
      const response = await this.client.get<OptionContractsResponse>(endpoint);
      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /screener/option-contracts endpoint');
      }
      return response;
    }, 'Get option contracts');
  }

  /**
   * Récupère les stocks (Stock Screener)
   * GET /screener/stocks
   */
  async getStockScreener(params?: StockScreenerQueryParams): Promise<StockScreenerResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      if (params?.date) queryParams.append('date', params.date);
      if (params?.has_dividends !== undefined) queryParams.append('has_dividends', params.has_dividends.toString());
      if (params?.is_s_p_500 !== undefined) queryParams.append('is_s_p_500', params.is_s_p_500.toString());
      if (params?.issue_types) {
        params.issue_types.forEach(type => queryParams.append('issue_types[]', type));
      }
      // Ajouter tous les autres paramètres min/max pour le stock screener
      // (similaire à option-contracts mais avec les champs spécifiques au stock screener)
      if (params?.max_avg30_volume) queryParams.append('max_avg30_volume', params.max_avg30_volume);
      if (params?.max_call_oi_change_perc) queryParams.append('max_call_oi_change_perc', params.max_call_oi_change_perc);
      if (params?.max_call_premium) queryParams.append('max_call_premium', params.max_call_premium);
      if (params?.max_call_volume) queryParams.append('max_call_volume', params.max_call_volume.toString());
      if (params?.max_change) queryParams.append('max_change', params.max_change);
      if (params?.max_implied_move) queryParams.append('max_implied_move', params.max_implied_move);
      if (params?.max_implied_move_perc) queryParams.append('max_implied_move_perc', params.max_implied_move_perc);
      if (params?.max_iv_rank) queryParams.append('max_iv_rank', params.max_iv_rank);
      if (params?.max_marketcap) queryParams.append('max_marketcap', params.max_marketcap);
      if (params?.max_net_call_premium) queryParams.append('max_net_call_premium', params.max_net_call_premium);
      if (params?.max_net_premium) queryParams.append('max_net_premium', params.max_net_premium);
      if (params?.max_net_put_premium) queryParams.append('max_net_put_premium', params.max_net_put_premium);
      if (params?.max_oi) queryParams.append('max_oi', params.max_oi.toString());
      if (params?.max_oi_vs_vol) queryParams.append('max_oi_vs_vol', params.max_oi_vs_vol);
      if (params?.max_perc_30_day_call) queryParams.append('max_perc_30_day_call', params.max_perc_30_day_call);
      if (params?.max_perc_30_day_put) queryParams.append('max_perc_30_day_put', params.max_perc_30_day_put);
      if (params?.max_perc_30_day_total) queryParams.append('max_perc_30_day_total', params.max_perc_30_day_total);
      if (params?.max_perc_3_day_call) queryParams.append('max_perc_3_day_call', params.max_perc_3_day_call);
      if (params?.max_perc_3_day_put) queryParams.append('max_perc_3_day_put', params.max_perc_3_day_put);
      if (params?.max_perc_3_day_total) queryParams.append('max_perc_3_day_total', params.max_perc_3_day_total);
      if (params?.max_premium) queryParams.append('max_premium', params.max_premium);
      if (params?.max_put_call_ratio) queryParams.append('max_put_call_ratio', params.max_put_call_ratio);
      if (params?.max_put_oi_change_perc) queryParams.append('max_put_oi_change_perc', params.max_put_oi_change_perc);
      if (params?.max_put_premium) queryParams.append('max_put_premium', params.max_put_premium);
      if (params?.max_put_volume) queryParams.append('max_put_volume', params.max_put_volume.toString());
      if (params?.max_total_oi_change_perc) queryParams.append('max_total_oi_change_perc', params.max_total_oi_change_perc);
      if (params?.max_underlying_price) queryParams.append('max_underlying_price', params.max_underlying_price);
      if (params?.max_volatility) queryParams.append('max_volatility', params.max_volatility);
      if (params?.max_volume) queryParams.append('max_volume', params.max_volume.toString());
      if (params?.min_call_oi_change_perc) queryParams.append('min_call_oi_change_perc', params.min_call_oi_change_perc);
      if (params?.min_call_premium) queryParams.append('min_call_premium', params.min_call_premium);
      if (params?.min_call_volume) queryParams.append('min_call_volume', params.min_call_volume.toString());
      if (params?.min_change) queryParams.append('min_change', params.min_change);
      if (params?.min_implied_move) queryParams.append('min_implied_move', params.min_implied_move);
      if (params?.min_implied_move_perc) queryParams.append('min_implied_move_perc', params.min_implied_move_perc);
      if (params?.min_iv_rank) queryParams.append('min_iv_rank', params.min_iv_rank);
      if (params?.min_marketcap) queryParams.append('min_marketcap', params.min_marketcap);
      if (params?.min_net_call_premium) queryParams.append('min_net_call_premium', params.min_net_call_premium);
      if (params?.min_net_premium) queryParams.append('min_net_premium', params.min_net_premium);
      if (params?.min_net_put_premium) queryParams.append('min_net_put_premium', params.min_net_put_premium);
      if (params?.min_oi) queryParams.append('min_oi', params.min_oi.toString());
      if (params?.min_oi_vs_vol) queryParams.append('min_oi_vs_vol', params.min_oi_vs_vol);
      if (params?.min_perc_30_day_call) queryParams.append('min_perc_30_day_call', params.min_perc_30_day_call);
      if (params?.min_perc_30_day_put) queryParams.append('min_perc_30_day_put', params.min_perc_30_day_put);
      if (params?.min_perc_30_day_total) queryParams.append('min_perc_30_day_total', params.min_perc_30_day_total);
      if (params?.min_perc_3_day_call) queryParams.append('min_perc_3_day_call', params.min_perc_3_day_call);
      if (params?.min_perc_3_day_put) queryParams.append('min_perc_3_day_put', params.min_perc_3_day_put);
      if (params?.min_perc_3_day_total) queryParams.append('min_perc_3_day_total', params.min_perc_3_day_total);
      if (params?.min_premium) queryParams.append('min_premium', params.min_premium);
      if (params?.min_put_call_ratio) queryParams.append('min_put_call_ratio', params.min_put_call_ratio);
      if (params?.min_put_oi_change_perc) queryParams.append('min_put_oi_change_perc', params.min_put_oi_change_perc);
      if (params?.min_put_premium) queryParams.append('min_put_premium', params.min_put_premium);
      if (params?.min_put_volume) queryParams.append('min_put_volume', params.min_put_volume.toString());
      if (params?.min_stock_volume_vs_avg30_volume) queryParams.append('min_stock_volume_vs_avg30_volume', params.min_stock_volume_vs_avg30_volume);
      if (params?.min_total_oi_change_perc) queryParams.append('min_total_oi_change_perc', params.min_total_oi_change_perc);
      if (params?.min_underlying_price) queryParams.append('min_underlying_price', params.min_underlying_price);
      if (params?.min_volatility) queryParams.append('min_volatility', params.min_volatility);
      if (params?.min_volume) queryParams.append('min_volume', params.min_volume.toString());
      if (params?.order) queryParams.append('order', params.order);
      if (params?.order_direction) queryParams.append('order_direction', params.order_direction);
      if (params?.sectors) {
        params.sectors.forEach(sector => queryParams.append('sectors[]', sector));
      }
      if (params?.ticker) queryParams.append('ticker', params.ticker);
      const queryString = queryParams.toString();
      const endpoint = `/screener/stocks${queryString ? `?${queryString}` : ''}`;
      const response = await this.client.get<StockScreenerResponse>(endpoint);
      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /screener/stocks endpoint');
      }
      return response;
    }, 'Get stock screener');
  }

  // ========== Option Trade ==========

  /**
   * Récupère les flow alerts (option-trades)
   * GET /option-trades/flow-alerts
   */
  async getOptionTradeFlowAlerts(params?: OptionTradeFlowAlertsQueryParams): Promise<OptionTradeFlowAlertsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      if (params?.all_opening !== undefined) queryParams.append('all_opening', params.all_opening.toString());
      if (params?.is_ask_side !== undefined) queryParams.append('is_ask_side', params.is_ask_side.toString());
      if (params?.is_bid_side !== undefined) queryParams.append('is_bid_side', params.is_bid_side.toString());
      if (params?.is_call !== undefined) queryParams.append('is_call', params.is_call.toString());
      if (params?.is_floor !== undefined) queryParams.append('is_floor', params.is_floor.toString());
      if (params?.is_multi_leg !== undefined) queryParams.append('is_multi_leg', params.is_multi_leg.toString());
      if (params?.is_otm !== undefined) queryParams.append('is_otm', params.is_otm.toString());
      if (params?.is_put !== undefined) queryParams.append('is_put', params.is_put.toString());
      if (params?.is_sweep !== undefined) queryParams.append('is_sweep', params.is_sweep.toString());
      if (params?.issue_types) {
        params.issue_types.forEach(type => queryParams.append('issue_types[]', type));
      }
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.max_ask_perc !== undefined) queryParams.append('max_ask_perc', params.max_ask_perc.toString());
      if (params?.max_bear_perc !== undefined) queryParams.append('max_bear_perc', params.max_bear_perc.toString());
      if (params?.max_bid_perc !== undefined) queryParams.append('max_bid_perc', params.max_bid_perc.toString());
      if (params?.max_bull_perc !== undefined) queryParams.append('max_bull_perc', params.max_bull_perc.toString());
      if (params?.max_diff) queryParams.append('max_diff', params.max_diff);
      if (params?.max_dte !== undefined) queryParams.append('max_dte', params.max_dte.toString());
      if (params?.max_iv_change !== undefined) queryParams.append('max_iv_change', params.max_iv_change.toString());
      if (params?.max_marketcap !== undefined) queryParams.append('max_marketcap', params.max_marketcap.toString());
      if (params?.max_open_interest !== undefined) queryParams.append('max_open_interest', params.max_open_interest.toString());
      if (params?.max_premium !== undefined) queryParams.append('max_premium', params.max_premium.toString());
      if (params?.max_price !== undefined) queryParams.append('max_price', params.max_price.toString());
      if (params?.max_size !== undefined) queryParams.append('max_size', params.max_size.toString());
      if (params?.max_size_vol_ratio !== undefined) queryParams.append('max_size_vol_ratio', params.max_size_vol_ratio.toString());
      if (params?.max_skew !== undefined) queryParams.append('max_skew', params.max_skew.toString());
      if (params?.max_spread !== undefined) queryParams.append('max_spread', params.max_spread.toString());
      if (params?.max_volume !== undefined) queryParams.append('max_volume', params.max_volume.toString());
      if (params?.max_volume_oi_ratio !== undefined) queryParams.append('max_volume_oi_ratio', params.max_volume_oi_ratio.toString());
      if (params?.min_ask_perc !== undefined) queryParams.append('min_ask_perc', params.min_ask_perc.toString());
      if (params?.min_bear_perc !== undefined) queryParams.append('min_bear_perc', params.min_bear_perc.toString());
      if (params?.min_bid_perc !== undefined) queryParams.append('min_bid_perc', params.min_bid_perc.toString());
      if (params?.min_bull_perc !== undefined) queryParams.append('min_bull_perc', params.min_bull_perc.toString());
      if (params?.min_diff) queryParams.append('min_diff', params.min_diff);
      if (params?.min_dte !== undefined) queryParams.append('min_dte', params.min_dte.toString());
      if (params?.min_iv_change !== undefined) queryParams.append('min_iv_change', params.min_iv_change.toString());
      if (params?.min_marketcap !== undefined) queryParams.append('min_marketcap', params.min_marketcap.toString());
      if (params?.min_open_interest !== undefined) queryParams.append('min_open_interest', params.min_open_interest.toString());
      if (params?.min_premium !== undefined) queryParams.append('min_premium', params.min_premium.toString());
      if (params?.min_price !== undefined) queryParams.append('min_price', params.min_price.toString());
      if (params?.min_size !== undefined) queryParams.append('min_size', params.min_size.toString());
      if (params?.min_size_vol_ratio !== undefined) queryParams.append('min_size_vol_ratio', params.min_size_vol_ratio.toString());
      if (params?.min_skew !== undefined) queryParams.append('min_skew', params.min_skew.toString());
      if (params?.min_spread !== undefined) queryParams.append('min_spread', params.min_spread.toString());
      if (params?.min_volume !== undefined) queryParams.append('min_volume', params.min_volume.toString());
      if (params?.min_volume_oi_ratio !== undefined) queryParams.append('min_volume_oi_ratio', params.min_volume_oi_ratio.toString());
      if (params?.newer_than) queryParams.append('newer_than', params.newer_than);
      if (params?.older_than) queryParams.append('older_than', params.older_than);
      if (params?.rule_name) {
        params.rule_name.forEach(rule => queryParams.append('rule_name[]', rule));
      }
      if (params?.size_greater_oi !== undefined) queryParams.append('size_greater_oi', params.size_greater_oi.toString());
      if (params?.ticker_symbol) queryParams.append('ticker_symbol', params.ticker_symbol);
      if (params?.vol_greater_oi !== undefined) queryParams.append('vol_greater_oi', params.vol_greater_oi.toString());
      const queryString = queryParams.toString();
      const endpoint = `/option-trades/flow-alerts${queryString ? `?${queryString}` : ''}`;
      const response = await this.client.get<OptionTradeFlowAlertsResponse>(endpoint);
      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /option-trades/flow-alerts endpoint');
      }
      return response;
    }, 'Get option trade flow alerts');
  }

  /**
   * Récupère le full tape (retourne un fichier ZIP)
   * GET /option-trades/full-tape/{date}
   * NOTE: Cet endpoint retourne un fichier ZIP, pas du JSON
   * On retourne l'endpoint pour que le service puisse construire l'URL complète
   */
  async getFullTape(date: string, params?: FullTapeQueryParams): Promise<{ endpoint: string }> {
    return handleError(async () => {
      const endpoint = `/option-trades/full-tape/${date}`;
      // Pour les fichiers ZIP, on retourne l'endpoint
      // Le service construira l'URL complète avec l'API key
      return { endpoint };
    }, `Get full tape for ${date}`);
  }

  // ========== Option Contract ==========

  /**
   * Récupère les flow data d'un contrat d'option
   * GET /option-contract/{id}/flow
   */
  async getOptionContractFlow(id: string, params?: OptionContractFlowQueryParams): Promise<OptionContractFlowResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      if (params?.date) queryParams.append('date', params.date);
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.min_premium !== undefined) queryParams.append('min_premium', params.min_premium.toString());
      if (params?.side) queryParams.append('side', params.side);
      const queryString = queryParams.toString();
      const endpoint = `/option-contract/${id}/flow${queryString ? `?${queryString}` : ''}`;
      const response = await this.client.get<OptionContractFlowResponse>(endpoint);
      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /option-contract/{id}/flow endpoint');
      }
      return response;
    }, `Get option contract flow for ${id}`);
  }

  /**
   * Récupère les données historiques d'un contrat d'option
   * GET /option-contract/{id}/historic
   */
  async getOptionContractHistoric(id: string, params?: OptionContractHistoricQueryParams): Promise<OptionContractHistoricResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      const queryString = queryParams.toString();
      const endpoint = `/option-contract/${id}/historic${queryString ? `?${queryString}` : ''}`;
      const response = await this.client.get<OptionContractHistoricResponse>(endpoint);
      if (!response || !response.chains || !Array.isArray(response.chains)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /option-contract/{id}/historic endpoint');
      }
      return response;
    }, `Get option contract historic for ${id}`);
  }

  /**
   * Récupère les données intraday d'un contrat d'option
   * GET /option-contract/{id}/intraday
   */
  async getOptionContractIntraday(id: string, params?: OptionContractIntradayQueryParams): Promise<OptionContractIntradayResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      if (params?.date) queryParams.append('date', params.date);
      const queryString = queryParams.toString();
      const endpoint = `/option-contract/${id}/intraday${queryString ? `?${queryString}` : ''}`;
      const response = await this.client.get<OptionContractIntradayResponse>(endpoint);
      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /option-contract/{id}/intraday endpoint');
      }
      return response;
    }, `Get option contract intraday for ${id}`);
  }

  /**
   * Récupère le volume profile d'un contrat d'option
   * GET /option-contract/{id}/volume-profile
   */
  async getOptionContractVolumeProfile(id: string, params?: OptionContractVolumeProfileQueryParams): Promise<OptionContractVolumeProfileResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      if (params?.date) queryParams.append('date', params.date);
      const queryString = queryParams.toString();
      const endpoint = `/option-contract/${id}/volume-profile${queryString ? `?${queryString}` : ''}`;
      const response = await this.client.get<OptionContractVolumeProfileResponse>(endpoint);
      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /option-contract/{id}/volume-profile endpoint');
      }
      return response;
    }, `Get option contract volume profile for ${id}`);
  }

  /**
   * Récupère le breakdown d'expiration pour un ticker
   * GET /stock/{ticker}/expiry-breakdown
   */
  async getExpiryBreakdown(ticker: string, params?: ExpiryBreakdownQueryParams): Promise<ExpiryBreakdownResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      if (params?.date) queryParams.append('date', params.date);
      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/expiry-breakdown${queryString ? `?${queryString}` : ''}`;
      const response = await this.client.get<ExpiryBreakdownResponse>(endpoint);
      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/expiry-breakdown endpoint');
      }
      return response;
    }, `Get expiry breakdown for ${ticker}`);
  }

  /**
   * Récupère tous les contrats d'options pour un ticker
   * GET /stock/{ticker}/option-contracts
   */
  async getStockOptionContracts(ticker: string, params?: StockOptionContractsQueryParams): Promise<StockOptionContractsResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      if (params?.exclude_zero_dte !== undefined) queryParams.append('exclude_zero_dte', params.exclude_zero_dte.toString());
      if (params?.exclude_zero_oi_chains !== undefined) queryParams.append('exclude_zero_oi_chains', params.exclude_zero_oi_chains.toString());
      if (params?.exclude_zero_vol_chains !== undefined) queryParams.append('exclude_zero_vol_chains', params.exclude_zero_vol_chains.toString());
      if (params?.expiry) queryParams.append('expiry', params.expiry);
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.maybe_otm_only !== undefined) queryParams.append('maybe_otm_only', params.maybe_otm_only.toString());
      if (params?.option_symbol) {
        params.option_symbol.forEach(symbol => queryParams.append('option_symbol[]', symbol));
      }
      if (params?.option_type) queryParams.append('option_type', params.option_type);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.vol_greater_oi !== undefined) queryParams.append('vol_greater_oi', params.vol_greater_oi.toString());
      const queryString = queryParams.toString();
      const endpoint = `/stock/${ticker.toUpperCase()}/option-contracts${queryString ? `?${queryString}` : ''}`;
      const response = await this.client.get<StockOptionContractsResponse>(endpoint);
      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /stock/{ticker}/option-contracts endpoint');
      }
      return response;
    }, `Get stock option contracts for ${ticker}`);
  }

  // ========== News ==========

  /**
   * Récupère les titres d'actualités
   * GET /news/headlines
   */
  async getNewsHeadlines(params?: NewsHeadlinesQueryParams): Promise<NewsHeadlinesResponse> {
    return handleError(async () => {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.major_only !== undefined) queryParams.append('major_only', params.major_only.toString());
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.search_term) queryParams.append('search_term', params.search_term);
      if (params?.sources) queryParams.append('sources', params.sources);
      const queryString = queryParams.toString();
      const endpoint = `/news/headlines${queryString ? `?${queryString}` : ''}`;
      const response = await this.client.get<NewsHeadlinesResponse>(endpoint);
      if (!response || !Array.isArray(response.data)) {
        throw new ExternalApiError('Unusual Whales', 'Invalid response format from /news/headlines endpoint');
      }
      return response;
    }, 'Get news headlines');
  }
}

