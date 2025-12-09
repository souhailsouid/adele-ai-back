import { APIGatewayProxyEventV2 } from "aws-lambda";
import { getSignals, createSignal, getSignal, searchSignals } from "./signals";
import { chatWithData } from "./chat";
import { createFund, getFunds, getFund, getFundHoldings, getFundFilings } from "./funds";
import {
  createCompany,
  getCompanies,
  getCompany,
  getCompanyByTicker,
  getCompanyFilings,
  getCompanyEvents,
  getCompanyInsiderTrades,
} from "./companies";
import {
  getTickerQuote,
  getTickerOwnership,
  getTickerActivity,
  getTickerHedgeFunds,
  getTickerInsiders,
  getTickerCongress,
  getTickerOptions,
  getTickerDarkPool,
  getTickerStats,
} from "./ticker-activity";
import { getTickerInsights } from "./ticker-insights";
import * as fmp from "./fmp";
import * as uw from "./unusual-whales";
import { fmpRoutes } from "./routes/fmp.routes";
import { combinedAnalysisRoutes } from "./routes/combined-analysis.routes";
import { scoringRoutes } from "./routes/scoring.routes";
import { gammaSqueezeRoutes } from "./routes/gamma-squeeze.routes";
import { surveillanceRoutes } from "./routes/surveillance.routes";
import { alertRoutes } from "./routes/alert.routes";
import { smartMoneyRoutes } from "./routes/smart-money.routes";
import { attributionRoutes } from "./routes/attribution.routes";
import { aiAnalystRoutes } from "./routes/ai-analyst.routes";
import { getCombinedEconomicCalendar } from "./economic-calendar";
import { getLatest13FFilings } from "./13f-filings";
import type { NotificationType } from "./types/unusual-whales/alerts";
import type {
  InstitutionalHoldingsQueryParams,
  InstitutionalOwnershipQueryParams,
  InstitutionsQueryParams,
  LatestFilingsQueryParams,
} from "./types/unusual-whales/institutions";
import type {
  CorrelationsQueryParams,
  EconomicCalendarQueryParams,
  FDACalendarQueryParams,
  InsiderBuySellsQueryParams,
  MarketTideQueryParams,
  OIChangeQueryParams,
  SectorETFsQueryParams,
  SpikeQueryParams,
  TopNetImpactQueryParams,
  TotalOptionsVolumeQueryParams,
  SectorTideQueryParams,
  ETFTideQueryParams,
  NetFlowExpiryQueryParams,
} from "./types/unusual-whales/market";
import type {
  ATMChainsQueryParams,
  FlowAlertsQueryParams,
  FlowPerExpiryQueryParams,
  FlowPerStrikeQueryParams,
  FlowPerStrikeIntradayQueryParams,
  RecentFlowsQueryParams,
  GreekExposureQueryParams,
  GreekExposureByExpiryQueryParams,
  GreekExposureByStrikeQueryParams,
  GreekExposureByStrikeAndExpiryQueryParams,
  GreekFlowQueryParams,
  GreekFlowByExpiryQueryParams,
  GreeksQueryParams,
  HistoricalRiskReversalSkewQueryParams,
  StockInfoQueryParams,
  InsiderBuySellsQueryParams as StockInsiderBuySellsQueryParams,
  InterpolatedIVQueryParams,
  IVRankQueryParams,
  MaxPainQueryParams,
  NetPremiumTicksQueryParams,
  NOPEQueryParams,
  OHLCQueryParams,
  OIChangeQueryParams as StockOIChangeQueryParams,
  OIPerExpiryQueryParams,
  OIPerStrikeQueryParams,
  OptionChainsQueryParams,
  OptionStockPriceLevelsQueryParams,
  VolumeOIPerExpiryQueryParams,
  OptionsVolumeQueryParams,
  SpotExposuresQueryParams,
  SpotExposureByStrikeAndExpiryQueryParams,
  SpotExposureByStrikeQueryParams,
  StockStateQueryParams,
  StockVolumePriceLevelsQueryParams,
  RealizedVolatilityQueryParams,
  VolatilityStatsQueryParams,
  VolatilityTermStructureQueryParams,
  FlowFilter,
} from "./types/unusual-whales/stock";
import type {
  ShortDataQueryParams,
  FailuresToDeliverQueryParams,
  ShortInterestAndFloatQueryParams,
  ShortVolumeAndRatioQueryParams,
  ShortVolumeByExchangeQueryParams,
} from "./types/unusual-whales/shorts";
import type {
  YearMonthPriceChangeQueryParams,
  MonthlyAverageReturnQueryParams,
  MonthPerformersQueryParams,
  MarketSeasonalityQueryParams,
} from "./types/unusual-whales/seasonality";
import type {
  AnalystRatingQueryParams,
  OptionContractsQueryParams,
  StockScreenerQueryParams,
} from "./types/unusual-whales/screener";
import type {
  OptionTradeFlowAlertsQueryParams,
  FullTapeQueryParams,
} from "./types/unusual-whales/option-trade";
import type {
  OptionContractFlowQueryParams,
  OptionContractHistoricQueryParams,
  OptionContractIntradayQueryParams,
  OptionContractVolumeProfileQueryParams,
  ExpiryBreakdownQueryParams,
  StockOptionContractsQueryParams,
} from "./types/unusual-whales/option-contract";
import type {
  NewsHeadlinesQueryParams,
} from "./types/unusual-whales/news";


import type { Route, RouteHandler } from "./routes/types";

// Helper pour parser le body
function parseBody(event: APIGatewayProxyEventV2): any {
  if (!event.body) return undefined;
  try {
    return JSON.parse(event.body);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper pour extraire les query params
function getQueryParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.queryStringParameters?.[key];
}

// Helper pour extraire les path params
function getPathParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.pathParameters?.[key];
}

// Routes
const routes: Route[] = [
  // Signals
  {
    method: "GET",
    path: "/signals",
    handler: async (event) => {
      const source = getQueryParam(event, "source");
      const type = getQueryParam(event, "type");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 100;
      const offset = getQueryParam(event, "offset") ? parseInt(getQueryParam(event, "offset")!) : 0;
      const min_importance = getQueryParam(event, "min_importance") 
        ? parseInt(getQueryParam(event, "min_importance")!) 
        : undefined;
      
      return await getSignals({ source, type, limit, offset, min_importance });
    },
  },
  {
    method: "GET",
    path: "/signals/{id}",
    handler: async (event) => {
      const id = getPathParam(event, "id");
      if (!id) throw new Error("Missing id parameter");
      return await getSignal(id);
    },
  },
  {
    method: "POST",
    path: "/signals",
    handler: async (event) => {
      const body = parseBody(event);
      return await createSignal(body);
    },
  },
  {
    method: "POST",
    path: "/search",
    handler: async (event) => {
      const body = parseBody(event);
      const query = body?.query || getQueryParam(event, "q");
      if (!query) {
        throw new Error("query parameter required");
      }
      const limit = body?.limit || (getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 20);
      return await searchSignals(query, limit);
    },
  },
  {
    method: "POST",
    path: "/chat",
    handler: async (event) => {
      const body = parseBody(event);
      const userQuery = body?.query || body?.message;
      if (!userQuery) {
        throw new Error("query or message required");
      }
      return await chatWithData(userQuery);
    },
  },
  // Funds
  {
    method: "POST",
    path: "/funds",
      handler: async (event) => {
        const body = parseBody(event);
        return await createFund(body);
      },
  },
  {
    method: "GET",
    path: "/funds",
    handler: async (event) => {
      return await getFunds();
    },
  },
  {
    method: "GET",
    path: "/funds/{id}",
    handler: async (event) => {
      const id = getPathParam(event, "id");
      if (!id) throw new Error("Missing id parameter");
      return await getFund(parseInt(id));
    },
  },
  {
    method: "GET",
    path: "/funds/{id}/holdings",
    handler: async (event) => {
      const id = getPathParam(event, "id");
      if (!id) throw new Error("Missing id parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 100;
      return await getFundHoldings(parseInt(id), limit);
    },
  },
      {
        method: "GET",
        path: "/funds/{id}/filings",
        handler: async (event) => {
          const id = getPathParam(event, "id");
          if (!id) throw new Error("Missing id parameter");
          return await getFundFilings(parseInt(id));
        },
      },
      // Companies
      {
        method: "POST",
        path: "/companies",
        handler: async (event) => {
          const body = parseBody(event);
          return await createCompany(body);
        },
      },
      {
        method: "GET",
        path: "/companies",
        handler: async (event) => {
          return await getCompanies();
        },
      },
      {
        method: "GET",
        path: "/companies/{id}",
        handler: async (event) => {
          const id = getPathParam(event, "id");
          if (!id) throw new Error("Missing id parameter");
          return await getCompany(parseInt(id));
        },
      },
      {
        method: "GET",
        path: "/companies/ticker/{ticker}",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          return await getCompanyByTicker(ticker);
        },
      },
      {
        method: "GET",
        path: "/companies/{id}/filings",
        handler: async (event) => {
          const id = getPathParam(event, "id");
          if (!id) throw new Error("Missing id parameter");
          const formType = getQueryParam(event, "form_type");
          return await getCompanyFilings(parseInt(id), formType);
        },
      },
      {
        method: "GET",
        path: "/companies/{id}/events",
        handler: async (event) => {
          const id = getPathParam(event, "id");
          if (!id) throw new Error("Missing id parameter");
          const eventType = getQueryParam(event, "event_type");
          return await getCompanyEvents(parseInt(id), eventType);
        },
      },
      {
        method: "GET",
        path: "/companies/{id}/insider-trades",
        handler: async (event) => {
          const id = getPathParam(event, "id");
          if (!id) throw new Error("Missing id parameter");
          return await getCompanyInsiderTrades(parseInt(id));
        },
      },
      // Ticker Activity
      {
        method: "GET",
        path: "/ticker-activity/{ticker}/quote",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          return await getTickerQuote(ticker);
        },
      },
      {
        method: "GET",
        path: "/ticker-activity/{ticker}/ownership",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 100;
          return await getTickerOwnership(ticker, limit);
        },
      },
      {
        method: "GET",
        path: "/ticker-activity/{ticker}/activity",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 100;
          const forceRefresh = getQueryParam(event, "force_refresh") === "true";
          return await getTickerActivity(ticker, limit, forceRefresh);
        },
      },
      {
        method: "GET",
        path: "/ticker-activity/{ticker}/hedge-funds",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 100;
          return await getTickerHedgeFunds(ticker, limit);
        },
      },
      {
        method: "GET",
        path: "/ticker-activity/{ticker}/insiders",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 100;
          return await getTickerInsiders(ticker, limit);
        },
      },
      {
        method: "GET",
        path: "/ticker-activity/{ticker}/congress",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 100;
          return await getTickerCongress(ticker, limit);
        },
      },
      {
        method: "GET",
        path: "/ticker-activity/{ticker}/options",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 100;
          const minPremium = getQueryParam(event, "min_premium") ? parseInt(getQueryParam(event, "min_premium")!) : 10000;
          
          // Construire les filtres optionnels depuis les query params
          const filters: any = {};
          if (getQueryParam(event, "max_premium")) {
            filters.maxPremium = parseInt(getQueryParam(event, "max_premium")!);
          }
          if (getQueryParam(event, "is_call") !== undefined) {
            filters.isCall = getQueryParam(event, "is_call") === "true";
          }
          if (getQueryParam(event, "is_put") !== undefined) {
            filters.isPut = getQueryParam(event, "is_put") === "true";
          }
          if (getQueryParam(event, "is_sweep") !== undefined) {
            filters.isSweep = getQueryParam(event, "is_sweep") === "true";
          }
          if (getQueryParam(event, "is_floor") !== undefined) {
            filters.isFloor = getQueryParam(event, "is_floor") === "true";
          }
          if (getQueryParam(event, "is_otm") !== undefined) {
            filters.isOtm = getQueryParam(event, "is_otm") === "true";
          }
          if (getQueryParam(event, "min_size")) {
            filters.minSize = parseInt(getQueryParam(event, "min_size")!);
          }
          if (getQueryParam(event, "max_size")) {
            filters.maxSize = parseInt(getQueryParam(event, "max_size")!);
          }
          if (getQueryParam(event, "min_dte")) {
            filters.minDte = parseInt(getQueryParam(event, "min_dte")!);
          }
          if (getQueryParam(event, "max_dte")) {
            filters.maxDte = parseInt(getQueryParam(event, "max_dte")!);
          }
          if (getQueryParam(event, "min_volume")) {
            filters.minVolume = parseInt(getQueryParam(event, "min_volume")!);
          }
          if (getQueryParam(event, "max_volume")) {
            filters.maxVolume = parseInt(getQueryParam(event, "max_volume")!);
          }
          
          return await getTickerOptions(ticker, limit, minPremium, Object.keys(filters).length > 0 ? filters : undefined);
        },
      },
      {
        method: "GET",
        path: "/ticker-activity/{ticker}/dark-pool",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 100;
          return await getTickerDarkPool(ticker, limit);
        },
      },
      {
        method: "GET",
        path: "/ticker-activity/{ticker}/stats",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          return await getTickerStats(ticker);
        },
      },
      // ========== Ticker Insights (Agrégation complète) ==========
      {
        method: "GET",
        path: "/ticker-insights/{ticker}",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          return await getTickerInsights(ticker);
        },
      },
      // ========== FMP API Routes ==========
      // Routes FMP sont maintenant dans ./routes/fmp.routes.ts
      ...fmpRoutes,
      // ========== Aliases pour simplifier l'utilisation ==========
      {
        method: "GET",
        path: "/economic-calendar",
        handler: async (event) => {
          // Période par défaut : 30 jours
          const today = new Date();
          const defaultFrom = today.toISOString().split('T')[0];
          const defaultTo = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 jours par défaut
            .toISOString()
            .split('T')[0];
          
          const from = getQueryParam(event, "from") || defaultFrom;
          const to = getQueryParam(event, "to") || defaultTo;
          
          // Valider le format des dates (YYYY-MM-DD)
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(from) || !dateRegex.test(to)) {
            throw new Error('Invalid date format. Use YYYY-MM-DD format.');
          }
          
          // Valider que 'to' est après 'from'
          if (new Date(to) < new Date(from)) {
            throw new Error('End date (to) must be after start date (from).');
          }
          
          // Combine FMP + Unusual Whales economic calendars
          // Les paramètres from/to sont OBLIGATOIRES pour FMP
          return await getCombinedEconomicCalendar({ from, to });
        },
      },
      {
        method: "GET",
        path: "/13f-filings/latest",
        handler: async (event) => {
          const from = getQueryParam(event, "from");
          const to = getQueryParam(event, "to");
          const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 100;
          // Combine FMP + Unusual Whales 13F filings
          return await getLatest13FFilings({ from, to, limit });
        },
      },
      // ========== Combined Analysis Routes (FMP + UW) ==========
      ...combinedAnalysisRoutes,
      // ========== Scoring Routes ==========
      ...scoringRoutes,
      // ========== Gamma Squeeze Routes ==========
      ...gammaSqueezeRoutes,
      // ========== Surveillance Routes ==========
      ...surveillanceRoutes,
      // ========== Alert Routes ==========
      ...alertRoutes,
      // ========== Smart Money Routes ==========
      ...smartMoneyRoutes,
      // ========== Attribution Routes ==========
      ...attributionRoutes,
      // ========== AI Analyst Routes ==========
      ...aiAnalystRoutes,
      // ========== Unusual Whales API Routes ==========
      {
        method: "GET",
        path: "/unusual-whales/institution-ownership/{ticker}",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const forceRefresh = getQueryParam(event, "force_refresh") === "true";
          // Extraire les options depuis query params
          const options: Record<string, any> = {};
          if (event.queryStringParameters) {
            Object.entries(event.queryStringParameters).forEach(([key, value]) => {
              if (key !== "force_refresh" && value) {
                options[key] = value;
              }
            });
          }
          return await uw.getUWInstitutionOwnership(ticker, Object.keys(options).length > 0 ? options : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/institution-activity/{ticker}",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const institutionName = getQueryParam(event, "institution_name");
          const options: Record<string, any> = {};
          if (event.queryStringParameters) {
            Object.entries(event.queryStringParameters).forEach(([key, value]) => {
              if (key !== "institution_name" && value) {
                options[key] = value;
              }
            });
          }
          return await uw.getUWInstitutionActivity(institutionName || ticker, Object.keys(options).length > 0 ? options : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/options-flow/{ticker}",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const options: Record<string, any> = {};
          if (event.queryStringParameters) {
            Object.entries(event.queryStringParameters).forEach(([key, value]) => {
              if (value) {
                options[key] = value;
              }
            });
          }
          return await uw.getUWOptionsFlow(ticker, Object.keys(options).length > 0 ? options : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/flow-alerts/{ticker}",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const options: Record<string, any> = {};
          if (event.queryStringParameters) {
            Object.entries(event.queryStringParameters).forEach(([key, value]) => {
              if (value) {
                options[key] = value;
              }
            });
          }
          return await uw.getUWFlowAlerts(ticker, Object.keys(options).length > 0 ? options : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/greek-flow/{ticker}",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const options: Record<string, any> = {};
          if (event.queryStringParameters) {
            Object.entries(event.queryStringParameters).forEach(([key, value]) => {
              if (value) {
                options[key] = value;
              }
            });
          }
          return await uw.getUWGreekFlow(ticker, Object.keys(options).length > 0 ? options : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/dark-pool/recent",
        handler: async (event) => {
          const params: {
            date?: string;
            limit?: number;
            max_premium?: number;
            max_size?: number;
            max_volume?: number;
            min_premium?: number;
            min_size?: number;
            min_volume?: number;
          } = {};
          
          if (event.queryStringParameters) {
            // date - String (YYYY-MM-DD)
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            
            // limit - Number (1-200, défaut: 100)
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 200) {
                params.limit = limit;
              }
            }
            
            // max_premium - Number
            if (event.queryStringParameters.max_premium) {
              const maxPremium = parseInt(event.queryStringParameters.max_premium, 10);
              if (!isNaN(maxPremium)) {
                params.max_premium = maxPremium;
              }
            }
            
            // max_size - Number (entier positif)
            if (event.queryStringParameters.max_size) {
              const maxSize = parseInt(event.queryStringParameters.max_size, 10);
              if (!isNaN(maxSize) && maxSize > 0) {
                params.max_size = maxSize;
              }
            }
            
            // max_volume - Number (entier positif)
            if (event.queryStringParameters.max_volume) {
              const maxVolume = parseInt(event.queryStringParameters.max_volume, 10);
              if (!isNaN(maxVolume) && maxVolume > 0) {
                params.max_volume = maxVolume;
              }
            }
            
            // min_premium - Number (>= 0, défaut: 0)
            if (event.queryStringParameters.min_premium) {
              const minPremium = parseInt(event.queryStringParameters.min_premium, 10);
              if (!isNaN(minPremium) && minPremium >= 0) {
                params.min_premium = minPremium;
              }
            }
            
            // min_size - Number (entier positif, >= 0, défaut: 0)
            if (event.queryStringParameters.min_size) {
              const minSize = parseInt(event.queryStringParameters.min_size, 10);
              if (!isNaN(minSize) && minSize >= 0) {
                params.min_size = minSize;
              }
            }
            
            // min_volume - Number (entier positif, >= 0, défaut: 0)
            if (event.queryStringParameters.min_volume) {
              const minVolume = parseInt(event.queryStringParameters.min_volume, 10);
              if (!isNaN(minVolume) && minVolume >= 0) {
                params.min_volume = minVolume;
              }
            }
          }
          
          return await uw.getUWDarkPoolRecent(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/dark-pool/{ticker}",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: {
            date?: string;
            limit?: number;
            max_premium?: number;
            max_size?: number;
            max_volume?: number;
            min_premium?: number;
            min_size?: number;
            min_volume?: number;
            newer_than?: string;
            older_than?: string;
          } = {};
          
          if (event.queryStringParameters) {
            // date - String (YYYY-MM-DD)
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            
            // limit - Number (1-500, défaut: 500)
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            
            // max_premium - Number
            if (event.queryStringParameters.max_premium) {
              const maxPremium = parseInt(event.queryStringParameters.max_premium, 10);
              if (!isNaN(maxPremium)) {
                params.max_premium = maxPremium;
              }
            }
            
            // max_size - Number (entier positif)
            if (event.queryStringParameters.max_size) {
              const maxSize = parseInt(event.queryStringParameters.max_size, 10);
              if (!isNaN(maxSize) && maxSize > 0) {
                params.max_size = maxSize;
              }
            }
            
            // max_volume - Number (entier positif)
            if (event.queryStringParameters.max_volume) {
              const maxVolume = parseInt(event.queryStringParameters.max_volume, 10);
              if (!isNaN(maxVolume) && maxVolume > 0) {
                params.max_volume = maxVolume;
              }
            }
            
            // min_premium - Number (>= 0, défaut: 0)
            if (event.queryStringParameters.min_premium) {
              const minPremium = parseInt(event.queryStringParameters.min_premium, 10);
              if (!isNaN(minPremium) && minPremium >= 0) {
                params.min_premium = minPremium;
              }
            }
            
            // min_size - Number (entier positif, >= 0, défaut: 0)
            if (event.queryStringParameters.min_size) {
              const minSize = parseInt(event.queryStringParameters.min_size, 10);
              if (!isNaN(minSize) && minSize >= 0) {
                params.min_size = minSize;
              }
            }
            
            // min_volume - Number (entier positif, >= 0, défaut: 0)
            if (event.queryStringParameters.min_volume) {
              const minVolume = parseInt(event.queryStringParameters.min_volume, 10);
              if (!isNaN(minVolume) && minVolume >= 0) {
                params.min_volume = minVolume;
              }
            }
            
            // newer_than - String (unix timestamp ou ISO date)
            if (event.queryStringParameters.newer_than) {
              params.newer_than = event.queryStringParameters.newer_than;
            }
            
            // older_than - String (unix timestamp ou ISO date)
            if (event.queryStringParameters.older_than) {
              params.older_than = event.queryStringParameters.older_than;
            }
          }
          
          return await uw.getUWDarkPoolTrades(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/insider-trades/{ticker}",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          // Legacy endpoint - utiliser getUWInsiderTickerFlow à la place
          return await uw.getUWInsiderTickerFlow(ticker);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/congress-trader",
        handler: async (event) => {
          const params: {
            date?: string;
            limit?: number;
            name?: string;
            ticker?: string | null;
          } = {};
          
          if (event.queryStringParameters) {
            // date - String (YYYY-MM-DD)
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            
            // limit - Number (1-200, défaut: 100)
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 200) {
                params.limit = limit;
              }
            }
            
            // name - String (URI encoded si nécessaire)
            if (event.queryStringParameters.name) {
              params.name = event.queryStringParameters.name;
            }
            
            // ticker - String ou null
            if (event.queryStringParameters.ticker !== undefined) {
              params.ticker = event.queryStringParameters.ticker || null;
            }
          }
          
          return await uw.getUWCongressTrader(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/congress-late-reports",
        handler: async (event) => {
          const params: {
            date?: string;
            limit?: number;
            ticker?: string | null;
          } = {};
          
          if (event.queryStringParameters) {
            // date - String (YYYY-MM-DD)
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            
            // limit - Number (1-200, défaut: 100)
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 200) {
                params.limit = limit;
              }
            }
            
            // ticker - String ou null
            if (event.queryStringParameters.ticker !== undefined) {
              params.ticker = event.queryStringParameters.ticker || null;
            }
          }
          
          return await uw.getUWCongressLateReports(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/congress-recent-trades",
        handler: async (event) => {
          const params: {
            date?: string;
            limit?: number;
            ticker?: string | null;
          } = {};
          
          if (event.queryStringParameters) {
            // date - String (YYYY-MM-DD)
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            
            // limit - Number (1-200, défaut: 100)
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 200) {
                params.limit = limit;
              }
            }
            
            // ticker - String ou null
            if (event.queryStringParameters.ticker !== undefined) {
              params.ticker = event.queryStringParameters.ticker || null;
            }
          }
          
          return await uw.getUWCongressRecentTrades(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/congress-trades/{ticker}",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const options: Record<string, any> = {};
          if (event.queryStringParameters) {
            Object.entries(event.queryStringParameters).forEach(([key, value]) => {
              if (value) {
                options[key] = value;
              }
            });
          }
          // Alias pour compatibilité (ancienne route)
          return await uw.getUWCongressTrades(ticker, Object.keys(options).length > 0 ? options : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/option-chains/{ticker}",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const options: Record<string, any> = {};
          if (event.queryStringParameters) {
            Object.entries(event.queryStringParameters).forEach(([key, value]) => {
              if (value) {
                options[key] = value;
              }
            });
          }
          return await uw.getUWOptionChains(ticker, Object.keys(options).length > 0 ? options : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/alerts",
        handler: async (event) => {
          const params: {
            config_ids?: string[];
            intraday_only?: boolean;
            limit?: number;
            newer_than?: string;
            noti_types?: NotificationType[];
            older_than?: string;
            ticker_symbols?: string;
          } = {};
          
          if (event.queryStringParameters) {
            // config_ids[] - Array
            const configIds = event.queryStringParameters['config_ids[]'] 
              ? [event.queryStringParameters['config_ids[]']].flat()
              : Object.entries(event.queryStringParameters)
                  .filter(([key]) => key.startsWith('config_ids['))
                  .map(([, value]) => value!)
                  .filter(Boolean);
            if (configIds.length > 0) {
              params.config_ids = configIds;
            }
            
            // intraday_only - Boolean
            if (event.queryStringParameters.intraday_only !== undefined) {
              params.intraday_only = event.queryStringParameters.intraday_only === 'true';
            }
            
            // limit - Number (1-500, défaut: 50)
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            
            // newer_than - String
            if (event.queryStringParameters.newer_than) {
              params.newer_than = event.queryStringParameters.newer_than;
            }
            
            // noti_types[] - Array de NotificationType
            const notiTypes = event.queryStringParameters['noti_types[]']
              ? [event.queryStringParameters['noti_types[]']].flat()
              : Object.entries(event.queryStringParameters)
                  .filter(([key]) => key.startsWith('noti_types['))
                  .map(([, value]) => value!)
                  .filter(Boolean);
            if (notiTypes.length > 0) {
              // Valider que ce sont des NotificationType valides
              const validNotificationTypes: NotificationType[] = [
                'stock', 'news', 'earnings', 'dividends', 'splits', 'option_contract',
                'price_target', 'analyst_rating', 'option_contract_interval', 'insider_trades',
                'trading_state', 'fda', 'economic_release', 'politician_trades', 'market_tide',
                'sec_filings', 'flow_alerts', 'chain_oi_change', 'gex'
              ];
              params.noti_types = notiTypes.filter((type): type is NotificationType => 
                validNotificationTypes.includes(type as NotificationType)
              );
            }
            
            // older_than - String
            if (event.queryStringParameters.older_than) {
              params.older_than = event.queryStringParameters.older_than;
            }
            
            // ticker_symbols - String
            if (event.queryStringParameters.ticker_symbols) {
              params.ticker_symbols = event.queryStringParameters.ticker_symbols;
            }
          }
          
          return await uw.getUWAlerts(Object.keys(params).length > 0 ? params as any : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/alert-configurations",
        handler: async (event) => {
          // Aucun paramètre selon la documentation
          return await uw.getUWAlertConfigurations();
        },
      },
      // ========== Earnings ==========
      {
        method: "GET",
        path: "/unusual-whales/earnings/afterhours",
        handler: async (event) => {
          const params: {
            date?: string;
            limit?: number;
            page?: number;
          } = {};
          
          if (event.queryStringParameters) {
            // date - String (YYYY-MM-DD)
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            
            // limit - Number (1-100, défaut: 50)
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 100) {
                params.limit = limit;
              }
            }
            
            // page - Number (commence à 0)
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          
          return await uw.getUWEarningsAfterhours(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/earnings/premarket",
        handler: async (event) => {
          const params: {
            date?: string;
            limit?: number;
            page?: number;
          } = {};
          
          if (event.queryStringParameters) {
            // date - String (YYYY-MM-DD)
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            
            // limit - Number (1-100, défaut: 50)
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 100) {
                params.limit = limit;
              }
            }
            
            // page - Number (commence à 0)
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          
          return await uw.getUWEarningsPremarket(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/earnings/{ticker}",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          // Aucun paramètre selon la documentation
          return await uw.getUWEarningsHistorical(ticker);
        },
      },
      // ========== ETF ==========
      {
        method: "GET",
        path: "/unusual-whales/etfs/{ticker}/exposure",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          // Aucun paramètre selon la documentation
          return await uw.getUWETFExposure(ticker);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/etfs/{ticker}/holdings",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          // Aucun paramètre selon la documentation
          return await uw.getUWETFHoldings(ticker);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/etfs/{ticker}/in-outflow",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          // Aucun paramètre selon la documentation
          return await uw.getUWETFInOutflow(ticker);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/etfs/{ticker}/info",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          // Aucun paramètre selon la documentation
          return await uw.getUWETFInfo(ticker);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/etfs/{ticker}/weights",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          // Aucun paramètre selon la documentation
          return await uw.getUWETFWeights(ticker);
        },
      },
      // ========== Group Flow ==========
      {
        method: "GET",
        path: "/unusual-whales/group-flow/{flow_group}/greek-flow",
        handler: async (event) => {
          const flowGroup = getPathParam(event, "flow_group");
          if (!flowGroup) throw new Error("Missing flow_group parameter");
          
          const params: {
            date?: string;
          } = {};
          
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          
          return await uw.getUWGroupGreekFlow(flowGroup as any, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/group-flow/{flow_group}/greek-flow/{expiry}",
        handler: async (event) => {
          const flowGroup = getPathParam(event, "flow_group");
          const expiry = getPathParam(event, "expiry");
          if (!flowGroup) throw new Error("Missing flow_group parameter");
          if (!expiry) throw new Error("Missing expiry parameter");
          
          const params: {
            date?: string;
          } = {};
          
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          
          return await uw.getUWGroupGreekFlowByExpiry(flowGroup as any, expiry, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      // ========== Insider Transactions ==========
      {
        method: "GET",
        path: "/unusual-whales/insider/transactions",
        handler: async (event) => {
          const params: {
            common_stock_only?: boolean;
            industries?: string;
            is_director?: boolean;
            is_officer?: boolean;
            is_s_p_500?: boolean;
            is_ten_percent_owner?: boolean;
            limit?: number;
            market_cap_size?: 'small' | 'mid' | 'large';
            max_amount?: string;
            max_earnings_dte?: string;
            max_marketcap?: number;
            max_price?: string;
            max_value?: string;
            min_amount?: string;
            min_earnings_dte?: string;
            min_marketcap?: number;
            min_price?: string;
            min_value?: string;
            owner_name?: string;
            page?: number;
            sectors?: string;
            security_ad_codes?: string;
            ticker_symbol?: string;
            transaction_codes?: string[];
            group?: boolean;
          } = {};
          
          if (event.queryStringParameters) {
            // Parse all query parameters
            if (event.queryStringParameters.common_stock_only !== undefined) {
              params.common_stock_only = event.queryStringParameters.common_stock_only === 'true';
            }
            if (event.queryStringParameters.industries) {
              params.industries = event.queryStringParameters.industries;
            }
            if (event.queryStringParameters.is_director !== undefined) {
              params.is_director = event.queryStringParameters.is_director === 'true';
            }
            if (event.queryStringParameters.is_officer !== undefined) {
              params.is_officer = event.queryStringParameters.is_officer === 'true';
            }
            if (event.queryStringParameters.is_s_p_500 !== undefined) {
              params.is_s_p_500 = event.queryStringParameters.is_s_p_500 === 'true';
            }
            if (event.queryStringParameters.is_ten_percent_owner !== undefined) {
              params.is_ten_percent_owner = event.queryStringParameters.is_ten_percent_owner === 'true';
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.market_cap_size) {
              const marketCapSize = event.queryStringParameters.market_cap_size;
              if (marketCapSize === 'small' || marketCapSize === 'mid' || marketCapSize === 'large') {
                params.market_cap_size = marketCapSize;
              }
            }
            if (event.queryStringParameters.max_amount) {
              params.max_amount = event.queryStringParameters.max_amount;
            }
            if (event.queryStringParameters.max_earnings_dte) {
              params.max_earnings_dte = event.queryStringParameters.max_earnings_dte;
            }
            if (event.queryStringParameters.max_marketcap) {
              const maxMarketcap = parseInt(event.queryStringParameters.max_marketcap, 10);
              if (!isNaN(maxMarketcap) && maxMarketcap >= 0) {
                params.max_marketcap = maxMarketcap;
              }
            }
            if (event.queryStringParameters.max_price) {
              params.max_price = event.queryStringParameters.max_price;
            }
            if (event.queryStringParameters.max_value) {
              params.max_value = event.queryStringParameters.max_value;
            }
            if (event.queryStringParameters.min_amount) {
              params.min_amount = event.queryStringParameters.min_amount;
            }
            if (event.queryStringParameters.min_earnings_dte) {
              params.min_earnings_dte = event.queryStringParameters.min_earnings_dte;
            }
            if (event.queryStringParameters.min_marketcap) {
              const minMarketcap = parseInt(event.queryStringParameters.min_marketcap, 10);
              if (!isNaN(minMarketcap) && minMarketcap >= 0) {
                params.min_marketcap = minMarketcap;
              }
            }
            if (event.queryStringParameters.min_price) {
              params.min_price = event.queryStringParameters.min_price;
            }
            if (event.queryStringParameters.min_value) {
              params.min_value = event.queryStringParameters.min_value;
            }
            if (event.queryStringParameters.owner_name) {
              params.owner_name = event.queryStringParameters.owner_name;
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
            if (event.queryStringParameters.sectors) {
              params.sectors = event.queryStringParameters.sectors;
            }
            if (event.queryStringParameters.security_ad_codes) {
              params.security_ad_codes = event.queryStringParameters.security_ad_codes;
            }
            if (event.queryStringParameters.ticker_symbol) {
              params.ticker_symbol = event.queryStringParameters.ticker_symbol;
            }
            // Parse transaction_codes[] array
            const transactionCodes = event.queryStringParameters['transaction_codes[]']
              ? [event.queryStringParameters['transaction_codes[]']].flat()
              : Object.entries(event.queryStringParameters)
                  .filter(([key]) => key.startsWith('transaction_codes['))
                  .map(([, value]) => value!)
                  .filter(Boolean);
            if (transactionCodes.length > 0) {
              params.transaction_codes = transactionCodes;
            }
            if (event.queryStringParameters.group !== undefined) {
              params.group = event.queryStringParameters.group === 'true';
            }
          }
          
          return await uw.getUWInsiderTransactions(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/insider/{sector}/sector-flow",
        handler: async (event) => {
          const sector = getPathParam(event, "sector");
          if (!sector) throw new Error("Missing sector parameter");
          // Aucun paramètre selon la documentation
          return await uw.getUWInsiderSectorFlow(sector as any);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/insider/{ticker}",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          // Aucun paramètre selon la documentation
          return await uw.getUWInsiders(ticker);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/insider/{ticker}/ticker-flow",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          // Aucun paramètre selon la documentation
          return await uw.getUWInsiderTickerFlow(ticker);
        },
      },
      // ========== Institutions ==========
      {
        method: "GET",
        path: "/unusual-whales/institution/{name}/activity",
        handler: async (event) => {
          const name = getPathParam(event, "name");
          if (!name) throw new Error("Missing name parameter");
          
          const params: {
            date?: string;
            limit?: number;
            page?: number;
          } = {};
          
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          
          return await uw.getUWInstitutionActivity(name, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/institution/{name}/holdings",
        handler: async (event) => {
          const name = getPathParam(event, "name");
          if (!name) throw new Error("Missing name parameter");
          
          const params: InstitutionalHoldingsQueryParams = {};
          
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.end_date) {
              params.end_date = event.queryStringParameters.end_date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.order) {
              const validOrders: InstitutionalHoldingsQueryParams['order'][] = ['date', 'ticker', 'security_type', 'put_call', 'first_buy', 'price_first_buy', 'units', 'units_change', 'historical_units', 'value', 'avg_price', 'close', 'shares_outstanding'];
              if (validOrders.includes(event.queryStringParameters.order as any)) {
                params.order = event.queryStringParameters.order as InstitutionalHoldingsQueryParams['order'];
              }
            }
            if (event.queryStringParameters.order_direction === 'desc' || event.queryStringParameters.order_direction === 'asc') {
              params.order_direction = event.queryStringParameters.order_direction;
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
            // Parse security_types[] array
            const securityTypes = event.queryStringParameters['security_types[]']
              ? [event.queryStringParameters['security_types[]']].flat()
              : Object.entries(event.queryStringParameters)
                  .filter(([key]) => key.startsWith('security_types['))
                  .map(([, value]) => value!)
                  .filter(Boolean);
            if (securityTypes.length > 0) {
              params.security_types = securityTypes;
            }
            if (event.queryStringParameters.start_date) {
              params.start_date = event.queryStringParameters.start_date;
            }
          }
          
          return await uw.getUWInstitutionHoldings(name, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/institution/{name}/sectors",
        handler: async (event) => {
          const name = getPathParam(event, "name");
          if (!name) throw new Error("Missing name parameter");
          
          const params: {
            date?: string;
            limit?: number;
            page?: number;
          } = {};
          
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          
          return await uw.getUWInstitutionSectorExposure(name, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/institution/{ticker}/ownership",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          
          const params: InstitutionalOwnershipQueryParams = {};
          
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.end_date) {
              params.end_date = event.queryStringParameters.end_date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.order) {
              const validOrders: InstitutionalOwnershipQueryParams['order'][] = ['activity', 'value', 'name', 'first_buy', 'units', 'units_change', 'avg_price', 'short_name', 'units_changed', 'perc_outstanding', 'perc_units_changed', 'perc_inst_value', 'perc_share_value'];
              if (validOrders.includes(event.queryStringParameters.order as any)) {
                params.order = event.queryStringParameters.order as InstitutionalOwnershipQueryParams['order'];
              }
            }
            if (event.queryStringParameters.order_direction === 'desc' || event.queryStringParameters.order_direction === 'asc') {
              params.order_direction = event.queryStringParameters.order_direction;
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
            if (event.queryStringParameters.start_date) {
              params.start_date = event.queryStringParameters.start_date;
            }
            // Parse tags[] array
            const tags = event.queryStringParameters['tags[]']
              ? [event.queryStringParameters['tags[]']].flat()
              : Object.entries(event.queryStringParameters)
                  .filter(([key]) => key.startsWith('tags['))
                  .map(([, value]) => value!)
                  .filter(Boolean);
            if (tags.length > 0) {
              params.tags = tags;
            }
          }
          
          return await uw.getUWInstitutionOwnership(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/institutions",
        handler: async (event) => {
          const params: InstitutionsQueryParams = {};
          
          if (event.queryStringParameters) {
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.max_share_value) {
              params.max_share_value = event.queryStringParameters.max_share_value;
            }
            if (event.queryStringParameters.max_total_value) {
              params.max_total_value = event.queryStringParameters.max_total_value;
            }
            if (event.queryStringParameters.min_share_value) {
              params.min_share_value = event.queryStringParameters.min_share_value;
            }
            if (event.queryStringParameters.min_total_value) {
              params.min_total_value = event.queryStringParameters.min_total_value;
            }
            if (event.queryStringParameters.name) {
              params.name = event.queryStringParameters.name;
            }
            if (event.queryStringParameters.order) {
              const validOrders: InstitutionsQueryParams['order'][] = ['name', 'call_value', 'put_value', 'share_value', 'call_holdings', 'put_holdings', 'share_holdings', 'total_value', 'warrant_value', 'fund_value', 'pfd_value', 'debt_value', 'total_holdings', 'warrant_holdings', 'fund_holdings', 'pfd_holdings', 'debt_holdings', 'percent_of_total', 'date', 'buy_value', 'sell_value'];
              if (validOrders.includes(event.queryStringParameters.order as any)) {
                params.order = event.queryStringParameters.order as InstitutionsQueryParams['order'];
              }
            }
            if (event.queryStringParameters.order_direction === 'desc' || event.queryStringParameters.order_direction === 'asc') {
              params.order_direction = event.queryStringParameters.order_direction;
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
            // Parse tags[] array
            const tags = event.queryStringParameters['tags[]']
              ? [event.queryStringParameters['tags[]']].flat()
              : Object.entries(event.queryStringParameters)
                  .filter(([key]) => key.startsWith('tags['))
                  .map(([, value]) => value!)
                  .filter(Boolean);
            if (tags.length > 0) {
              params.tags = tags;
            }
          }
          
          return await uw.getUWInstitutions(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/institutions/latest-filings",
        handler: async (event) => {
          const params: LatestFilingsQueryParams = {};
          
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.name) {
              params.name = event.queryStringParameters.name;
            }
            if (event.queryStringParameters.order) {
              params.order = event.queryStringParameters.order as LatestFilingsQueryParams['order'];
            }
            if (event.queryStringParameters.order_direction === 'desc' || event.queryStringParameters.order_direction === 'asc') {
              params.order_direction = event.queryStringParameters.order_direction;
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          
          return await uw.getUWLatestFilings(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      // ========== Market ==========
      {
        method: "GET",
        path: "/unusual-whales/market/correlations",
        handler: async (event) => {
          const params: CorrelationsQueryParams = {
            tickers: event.queryStringParameters?.tickers || '',
          };
          if (!params.tickers) {
            throw new Error("Missing required parameter: tickers (comma-separated list)");
          }
          if (event.queryStringParameters?.interval) {
            params.interval = event.queryStringParameters.interval;
          }
          if (event.queryStringParameters?.start_date) {
            params.start_date = event.queryStringParameters.start_date;
          }
          if (event.queryStringParameters?.end_date) {
            params.end_date = event.queryStringParameters.end_date;
          }
          return await uw.getUWCorrelations(params);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/market/economic-calendar",
        handler: async (event) => {
          const params: EconomicCalendarQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          return await uw.getUWEconomicCalendar(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/market/fda-calendar",
        handler: async (event) => {
          const params: FDACalendarQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          return await uw.getUWFDACalendar(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/market/insider-buy-sells",
        handler: async (event) => {
          const params: InsiderBuySellsQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.start_date) {
              params.start_date = event.queryStringParameters.start_date;
            }
            if (event.queryStringParameters.end_date) {
              params.end_date = event.queryStringParameters.end_date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          return await uw.getUWInsiderBuySells(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/market/market-tide",
        handler: async (event) => {
          const params: MarketTideQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          return await uw.getUWMarketTide(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/market/oi-change",
        handler: async (event) => {
          const params: OIChangeQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          return await uw.getUWOIChange(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/market/sector-etfs",
        handler: async (event) => {
          return await uw.getUWSectorETFs();
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/market/spike",
        handler: async (event) => {
          const params: SpikeQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          return await uw.getUWSpike(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/market/top-net-impact",
        handler: async (event) => {
          const params: TopNetImpactQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          return await uw.getUWTopNetImpact(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/market/total-options-volume",
        handler: async (event) => {
          const params: TotalOptionsVolumeQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          return await uw.getUWTotalOptionsVolume(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/market/{sector}/sector-tide",
        handler: async (event) => {
          const sector = getPathParam(event, "sector");
          if (!sector) throw new Error("Missing sector parameter");
          const params: SectorTideQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          return await uw.getUWSectorTide(sector, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/market/{ticker}/etf-tide",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: ETFTideQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          return await uw.getUWETFTide(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/net-flow/expiry",
        handler: async (event) => {
          const params: NetFlowExpiryQueryParams = {
            ticker: event.queryStringParameters?.ticker || '',
          };
          if (!params.ticker) {
            throw new Error("Missing required parameter: ticker");
          }
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          if (event.queryStringParameters?.limit) {
            const limit = parseInt(event.queryStringParameters.limit, 10);
            if (!isNaN(limit) && limit >= 1 && limit <= 500) {
              params.limit = limit;
            }
          }
          if (event.queryStringParameters?.page) {
            const page = parseInt(event.queryStringParameters.page, 10);
            if (!isNaN(page) && page >= 0) {
              params.page = page;
            }
          }
          return await uw.getUWNetFlowExpiry(params);
        },
      },
      // ========== Stock ==========
      {
        method: "GET",
        path: "/unusual-whales/stock/{sector}/tickers",
        handler: async (event) => {
          const sector = getPathParam(event, "sector");
          if (!sector) throw new Error("Missing sector parameter");
          return await uw.getUWSectorTickers(sector);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/atm-chains",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          
          // Parser les expirations depuis les query parameters
          // API Gateway peut passer expirations[] de différentes façons
          let expirations: string[] = [];
          
          // Debug: logger les query parameters reçus
          console.log('[ATM Chains] Query params:', JSON.stringify(event.queryStringParameters));
          
          if (event.queryStringParameters) {
            // Méthode 1: expirations[]=value1&expirations[]=value2
            // API Gateway peut les passer comme un seul paramètre ou plusieurs
            const expParam = event.queryStringParameters['expirations[]'];
            console.log('[ATM Chains] expParam:', expParam, 'Type:', typeof expParam, 'IsArray:', Array.isArray(expParam));
            
            if (expParam) {
              // Si c'est une seule valeur avec virgules, la split
              if (typeof expParam === 'string' && expParam.includes(',')) {
                expirations = expParam.split(',').map(e => e.trim());
                console.log('[ATM Chains] Split comma-separated:', expirations);
              } else {
                // Sinon, convertir en array
                expirations = Array.isArray(expParam) ? expParam : [expParam];
                console.log('[ATM Chains] Direct array:', expirations);
              }
            } else {
              // Méthode 2: Chercher toutes les clés qui commencent par expirations[
              expirations = Object.entries(event.queryStringParameters)
                .filter(([key]) => key.startsWith('expirations[') || key === 'expirations')
                .map(([, value]) => value!)
                .filter(Boolean);
              console.log('[ATM Chains] Found via filter:', expirations);
            }
          }
          
          if (!expirations || expirations.length === 0) {
            throw new Error("Missing required parameter: expirations[] (e.g., expirations[]=2024-02-02&expirations[]=2024-01-26)");
          }
          
          console.log('[ATM Chains] Final expirations:', expirations);
          const params: ATMChainsQueryParams = { expirations };
          return await uw.getUWATMChains(ticker, params);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/flow-alerts",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: FlowAlertsQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.is_ask_side !== undefined) {
              params.is_ask_side = event.queryStringParameters.is_ask_side === 'true';
            }
            if (event.queryStringParameters.is_bid_side !== undefined) {
              params.is_bid_side = event.queryStringParameters.is_bid_side === 'true';
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 200) {
                params.limit = limit;
              }
            }
          }
          return await uw.getUWStockFlowAlerts(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/flow-per-expiry",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          return await uw.getUWFlowPerExpiry(ticker);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/flow-per-strike",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: FlowPerStrikeQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWFlowPerStrike(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/flow-per-strike-intraday",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: FlowPerStrikeIntradayQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.filter) {
              params.filter = event.queryStringParameters.filter as FlowPerStrikeIntradayQueryParams['filter'];
            }
          }
          return await uw.getUWFlowPerStrikeIntraday(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/flow-recent",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: RecentFlowsQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.min_premium) {
              const min_premium = parseInt(event.queryStringParameters.min_premium, 10);
              if (!isNaN(min_premium) && min_premium >= 0) {
                params.min_premium = min_premium;
              }
            }
            if (event.queryStringParameters.side) {
              params.side = event.queryStringParameters.side as RecentFlowsQueryParams['side'];
            }
          }
          return await uw.getUWRecentFlows(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/greek-exposure",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: GreekExposureQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.timeframe) {
              params.timeframe = event.queryStringParameters.timeframe;
            }
          }
          return await uw.getUWGreekExposure(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/greek-exposure/expiry",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: GreekExposureByExpiryQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWGreekExposureByExpiry(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/greek-exposure/strike",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: GreekExposureByStrikeQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWGreekExposureByStrike(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/greek-exposure/strike-expiry",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const expiry = event.queryStringParameters?.expiry;
          if (!expiry) {
            throw new Error("Missing required parameter: expiry");
          }
          const params: GreekExposureByStrikeAndExpiryQueryParams = { expiry };
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWGreekExposureByStrikeAndExpiry(ticker, params);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/greek-flow",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: GreekFlowQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWStockGreekFlow(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/greek-flow/{expiry}",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const expiry = getPathParam(event, "expiry");
          if (!expiry) throw new Error("Missing expiry parameter");
          const params: GreekFlowByExpiryQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWStockGreekFlowByExpiry(ticker, expiry, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/greeks",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const expiry = event.queryStringParameters?.expiry;
          if (!expiry) {
            throw new Error("Missing required parameter: expiry");
          }
          const params: GreeksQueryParams = { expiry };
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWGreeks(ticker, params);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/historical-risk-reversal-skew",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const delta = event.queryStringParameters?.delta;
          const expiry = event.queryStringParameters?.expiry;
          if (!delta || !expiry) {
            throw new Error("Missing required parameters: delta and expiry");
          }
          const params: HistoricalRiskReversalSkewQueryParams = { delta, expiry };
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          if (event.queryStringParameters?.timeframe) {
            params.timeframe = event.queryStringParameters.timeframe;
          }
          return await uw.getUWHistoricalRiskReversalSkew(ticker, params);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/info",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          return await uw.getUWStockInfo(ticker);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/insider-buy-sells",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          return await uw.getUWStockInsiderBuySells(ticker);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/interpolated-iv",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: InterpolatedIVQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWInterpolatedIV(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/iv-rank",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: IVRankQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.timespan) {
              params.timespan = event.queryStringParameters.timespan;
            }
          }
          return await uw.getUWIVRank(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/max-pain",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: MaxPainQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWMaxPain(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/net-prem-ticks",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: NetPremiumTicksQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWNetPremiumTicks(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/nope",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: NOPEQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWNOPE(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/ohlc/{candle_size}",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const candleSize = getPathParam(event, "candle_size");
          if (!candleSize) throw new Error("Missing candle_size parameter");
          const params: OHLCQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.end_date) {
              params.end_date = event.queryStringParameters.end_date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 2500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.timeframe) {
              params.timeframe = event.queryStringParameters.timeframe;
            }
          }
          return await uw.getUWOHLC(ticker, candleSize, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/oi-change",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: StockOIChangeQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.order) {
              params.order = event.queryStringParameters.order as StockOIChangeQueryParams['order'];
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          return await uw.getUWStockOIChange(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/oi-per-expiry",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: OIPerExpiryQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWOIPerExpiry(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/oi-per-strike",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: OIPerStrikeQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWOIPerStrike(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/option-chains",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: OptionChainsQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWOptionChains(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/option/stock-price-levels",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: OptionStockPriceLevelsQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWOptionStockPriceLevels(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/option/volume-oi-expiry",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: VolumeOIPerExpiryQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWVolumeOIPerExpiry(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/options-volume",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: OptionsVolumeQueryParams = {};
          if (event.queryStringParameters?.limit) {
            const limit = parseInt(event.queryStringParameters.limit, 10);
            if (!isNaN(limit) && limit >= 1 && limit <= 500) {
              params.limit = limit;
            }
          }
          return await uw.getUWOptionsVolume(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/spot-exposures",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: SpotExposuresQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWSpotExposures(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/spot-exposures/expiry-strike",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          
          // Parser les expirations depuis les query parameters
          // API Gateway peut passer expirations[] de différentes façons
          let expirations: string[] = [];
          
          // Debug: logger les query parameters reçus
          console.log('[Spot Exposures] Query params:', JSON.stringify(event.queryStringParameters));
          
          if (event.queryStringParameters) {
            // Méthode 1: expirations[]=value1&expirations[]=value2
            // API Gateway peut les passer comme un seul paramètre ou plusieurs
            const expParam = event.queryStringParameters['expirations[]'];
            console.log('[Spot Exposures] expParam:', expParam, 'Type:', typeof expParam, 'IsArray:', Array.isArray(expParam));
            
            if (expParam) {
              // Si c'est une seule valeur avec virgules, la split
              if (typeof expParam === 'string' && expParam.includes(',')) {
                expirations = expParam.split(',').map(e => e.trim());
                console.log('[Spot Exposures] Split comma-separated:', expirations);
              } else {
                // Sinon, convertir en array
                expirations = Array.isArray(expParam) ? expParam : [expParam];
                console.log('[Spot Exposures] Direct array:', expirations);
              }
            } else {
              // Méthode 2: Chercher toutes les clés qui commencent par expirations[
              expirations = Object.entries(event.queryStringParameters)
                .filter(([key]) => key.startsWith('expirations[') || key === 'expirations')
                .map(([, value]) => value!)
                .filter(Boolean);
              console.log('[Spot Exposures] Found via filter:', expirations);
            }
          }
          
          if (!expirations || expirations.length === 0) {
            throw new Error("Missing required parameter: expirations[] (e.g., expirations[]=2024-02-02&expirations[]=2024-01-26)");
          }
          
          console.log('[Spot Exposures] Final expirations:', expirations);
          const params: SpotExposureByStrikeAndExpiryQueryParams = { expirations };
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.max_dte) {
              const max_dte = parseInt(event.queryStringParameters.max_dte, 10);
              if (!isNaN(max_dte) && max_dte >= 0) {
                params.max_dte = max_dte;
              }
            }
            if (event.queryStringParameters.max_strike) {
              const max_strike = parseInt(event.queryStringParameters.max_strike, 10);
              if (!isNaN(max_strike) && max_strike >= 0) {
                params.max_strike = max_strike;
              }
            }
            if (event.queryStringParameters.min_dte) {
              const min_dte = parseInt(event.queryStringParameters.min_dte, 10);
              if (!isNaN(min_dte) && min_dte >= 0) {
                params.min_dte = min_dte;
              }
            }
            if (event.queryStringParameters.min_strike) {
              const min_strike = parseInt(event.queryStringParameters.min_strike, 10);
              if (!isNaN(min_strike) && min_strike >= 0) {
                params.min_strike = min_strike;
              }
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          return await uw.getUWSpotExposureByStrikeAndExpiry(ticker, params);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/spot-exposures/strike",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: SpotExposureByStrikeQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.max_strike) {
              const max_strike = parseInt(event.queryStringParameters.max_strike, 10);
              if (!isNaN(max_strike) && max_strike >= 0) {
                params.max_strike = max_strike;
              }
            }
            if (event.queryStringParameters.min_strike) {
              const min_strike = parseInt(event.queryStringParameters.min_strike, 10);
              if (!isNaN(min_strike) && min_strike >= 0) {
                params.min_strike = min_strike;
              }
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
          }
          return await uw.getUWSpotExposureByStrike(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/stock-state",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          return await uw.getUWStockState(ticker);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/stock-volume-price-levels",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: StockVolumePriceLevelsQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWStockVolumePriceLevels(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/volatility/realized",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: RealizedVolatilityQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) {
              params.date = event.queryStringParameters.date;
            }
            if (event.queryStringParameters.timeframe) {
              params.timeframe = event.queryStringParameters.timeframe;
            }
          }
          return await uw.getUWRealizedVolatility(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/volatility/stats",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: VolatilityStatsQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWVolatilityStats(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/volatility/term-structure",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: VolatilityTermStructureQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWVolatilityTermStructure(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      // ========== Shorts ==========
      {
        method: "GET",
        path: "/unusual-whales/shorts/{ticker}/data",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          return await uw.getUWShortData(ticker);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/shorts/{ticker}/ftds",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: FailuresToDeliverQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWFailuresToDeliver(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/shorts/{ticker}/interest-float",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          return await uw.getUWShortInterestAndFloat(ticker);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/shorts/{ticker}/volume-and-ratio",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          return await uw.getUWShortVolumeAndRatio(ticker);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/shorts/{ticker}/volumes-by-exchange",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          return await uw.getUWShortVolumeByExchange(ticker);
        },
      },
      // ========== Seasonality ==========
      {
        method: "GET",
        path: "/unusual-whales/seasonality/{ticker}/year-month",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          return await uw.getUWYearMonthPriceChange(ticker);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/seasonality/{ticker}/monthly",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          return await uw.getUWMonthlyAverageReturn(ticker);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/seasonality/{month}/performers",
        handler: async (event) => {
          const month = getPathParam(event, "month");
          if (!month) throw new Error("Missing month parameter");
          const monthNum = parseInt(month, 10);
          if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
            throw new Error("Invalid month parameter. Must be between 1 and 12");
          }
          const params: MonthPerformersQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.min_oi) {
              const min_oi = parseInt(event.queryStringParameters.min_oi, 10);
              if (!isNaN(min_oi) && min_oi >= 0) {
                params.min_oi = min_oi;
              }
            }
            if (event.queryStringParameters.min_years) {
              const min_years = parseInt(event.queryStringParameters.min_years, 10);
              if (!isNaN(min_years) && min_years >= 1) {
                params.min_years = min_years;
              }
            }
            if (event.queryStringParameters.order) {
              params.order = event.queryStringParameters.order as MonthPerformersQueryParams['order'];
            }
            if (event.queryStringParameters.order_direction) {
              params.order_direction = event.queryStringParameters.order_direction as 'desc' | 'asc';
            }
            if (event.queryStringParameters.s_p_500_nasdaq_only) {
              params.s_p_500_nasdaq_only = event.queryStringParameters.s_p_500_nasdaq_only as MonthPerformersQueryParams['s_p_500_nasdaq_only'];
            }
            if (event.queryStringParameters.ticker_for_sector) {
              params.ticker_for_sector = event.queryStringParameters.ticker_for_sector;
            }
          }
          return await uw.getUWMonthPerformers(monthNum, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/seasonality/market",
        handler: async (event) => {
          return await uw.getUWMarketSeasonality();
        },
      },
      // ========== Screener ==========
      {
        method: "GET",
        path: "/unusual-whales/screener/analysts",
        handler: async (event) => {
          const params: AnalystRatingQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.action) {
              params.action = event.queryStringParameters.action as AnalystRatingQueryParams['action'];
            }
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.recommendation) {
              params.recommendation = event.queryStringParameters.recommendation as AnalystRatingQueryParams['recommendation'];
            }
            if (event.queryStringParameters.ticker) {
              params.ticker = event.queryStringParameters.ticker;
            }
          }
          return await uw.getUWAnalystRatings(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/screener/option-contracts",
        handler: async (event) => {
          // Ce endpoint a beaucoup de paramètres optionnels
          // On les passe directement au service qui les gère
          const params: OptionContractsQueryParams = {};
          // Parser tous les paramètres possibles (simplifié pour l'exemple)
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) params.date = event.queryStringParameters.date;
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 250) {
                params.limit = limit;
              }
            }
            // Ajouter d'autres paramètres selon les besoins...
          }
          return await uw.getUWOptionContracts(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/screener/stocks",
        handler: async (event) => {
          // Ce endpoint a beaucoup de paramètres optionnels
          const params: StockScreenerQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) params.date = event.queryStringParameters.date;
            // Ajouter d'autres paramètres selon les besoins...
            // Note: Ce endpoint n'a pas de paramètre 'limit' selon la documentation
          }
          return await uw.getUWStockScreener(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      // ========== Option Trade ==========
      {
        method: "GET",
        path: "/unusual-whales/option-trades/flow-alerts",
        handler: async (event) => {
          const params: OptionTradeFlowAlertsQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 200) {
                params.limit = limit;
              }
            }
            // Ajouter d'autres paramètres selon les besoins...
          }
          return await uw.getUWOptionTradeFlowAlerts(Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/option-trades/full-tape/{date}",
        handler: async (event) => {
          const date = getPathParam(event, "date");
          if (!date) throw new Error("Missing date parameter");
          return await uw.getUWFullTape(date);
        },
      },
      // ========== Option Contract ==========
      {
        method: "GET",
        path: "/unusual-whales/option-contract/{id}/flow",
        handler: async (event) => {
          const id = getPathParam(event, "id");
          if (!id) throw new Error("Missing id parameter");
          const params: OptionContractFlowQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.date) params.date = event.queryStringParameters.date;
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.min_premium) {
              const min_premium = parseInt(event.queryStringParameters.min_premium, 10);
              if (!isNaN(min_premium) && min_premium >= 0) {
                params.min_premium = min_premium;
              }
            }
            if (event.queryStringParameters.side) {
              params.side = event.queryStringParameters.side as OptionContractFlowQueryParams['side'];
            }
          }
          return await uw.getUWOptionContractFlow(id, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/option-contract/{id}/historic",
        handler: async (event) => {
          const id = getPathParam(event, "id");
          if (!id) throw new Error("Missing id parameter");
          const params: OptionContractHistoricQueryParams = {};
          if (event.queryStringParameters?.limit) {
            const limit = parseInt(event.queryStringParameters.limit, 10);
            if (!isNaN(limit) && limit >= 1) {
              params.limit = limit;
            }
          }
          return await uw.getUWOptionContractHistoric(id, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/option-contract/{id}/intraday",
        handler: async (event) => {
          const id = getPathParam(event, "id");
          if (!id) throw new Error("Missing id parameter");
          const params: OptionContractIntradayQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWOptionContractIntraday(id, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/option-contract/{id}/volume-profile",
        handler: async (event) => {
          const id = getPathParam(event, "id");
          if (!id) throw new Error("Missing id parameter");
          const params: OptionContractVolumeProfileQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWOptionContractVolumeProfile(id, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/expiry-breakdown",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: ExpiryBreakdownQueryParams = {};
          if (event.queryStringParameters?.date) {
            params.date = event.queryStringParameters.date;
          }
          return await uw.getUWExpiryBreakdown(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      {
        method: "GET",
        path: "/unusual-whales/stock/{ticker}/option-contracts",
        handler: async (event) => {
          const ticker = getPathParam(event, "ticker");
          if (!ticker) throw new Error("Missing ticker parameter");
          const params: StockOptionContractsQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.exclude_zero_dte !== undefined) {
              params.exclude_zero_dte = event.queryStringParameters.exclude_zero_dte === 'true';
            }
            if (event.queryStringParameters.exclude_zero_oi_chains !== undefined) {
              params.exclude_zero_oi_chains = event.queryStringParameters.exclude_zero_oi_chains === 'true';
            }
            if (event.queryStringParameters.exclude_zero_vol_chains !== undefined) {
              params.exclude_zero_vol_chains = event.queryStringParameters.exclude_zero_vol_chains === 'true';
            }
            if (event.queryStringParameters.expiry) params.expiry = event.queryStringParameters.expiry;
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 500) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.maybe_otm_only !== undefined) {
              params.maybe_otm_only = event.queryStringParameters.maybe_otm_only === 'true';
            }
            if (event.queryStringParameters.option_type) {
              params.option_type = event.queryStringParameters.option_type as StockOptionContractsQueryParams['option_type'];
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
            if (event.queryStringParameters.vol_greater_oi !== undefined) {
              params.vol_greater_oi = event.queryStringParameters.vol_greater_oi === 'true';
            }
          }
          return await uw.getUWStockOptionContracts(ticker, Object.keys(params).length > 0 ? params : undefined);
        },
      },
      // ========== News ==========
      {
        method: "GET",
        path: "/unusual-whales/news/headlines",
        handler: async (event) => {
          const params: NewsHeadlinesQueryParams = {};
          if (event.queryStringParameters) {
            if (event.queryStringParameters.limit) {
              const limit = parseInt(event.queryStringParameters.limit, 10);
              if (!isNaN(limit) && limit >= 1 && limit <= 100) {
                params.limit = limit;
              }
            }
            if (event.queryStringParameters.major_only !== undefined) {
              params.major_only = event.queryStringParameters.major_only === 'true';
            }
            if (event.queryStringParameters.page) {
              const page = parseInt(event.queryStringParameters.page, 10);
              if (!isNaN(page) && page >= 0) {
                params.page = page;
              }
            }
            if (event.queryStringParameters.search_term) {
              params.search_term = event.queryStringParameters.search_term;
            }
            if (event.queryStringParameters.sources) {
              params.sources = event.queryStringParameters.sources;
            }
          }
          return await uw.getUWNewsHeadlines(Object.keys(params).length > 0 ? params : undefined);
        },
      },
    ];

// Log au chargement du module (INIT_START)
console.log(`[ROUTER INIT] Routes array initialized with ${routes.length} routes`);
console.log(`[ROUTER INIT] Routes:`, routes.map(r => `${r.method} ${r.path}`).join(", "));

// Router principal
export function findRoute(event: APIGatewayProxyEventV2): RouteHandler | null {
  const routeKey = event.routeKey; // Format: "POST /funds" ou "POST /funds/{id}/discover"
  
  console.log(`[ROUTER] Looking for route: ${routeKey}`);
  console.log(`[ROUTER] Total routes available: ${routes.length}`);
  
  // Chercher la route correspondante
  for (const route of routes) {
    // Construire le pattern de route: "METHOD /path"
    const routePattern = `${route.method} ${route.path}`;
    
    // Debug: log les premières routes pour vérifier
    if (routes.indexOf(route) < 3) {
      console.log(`[ROUTER] Checking route ${routes.indexOf(route)}: "${routePattern}" vs "${routeKey}"`);
    }
    
    if (routeKey === routePattern) {
      console.log(`[ROUTER] Route matched: ${routePattern}`);
      return route.handler;
    }
  }
  
  // Log toutes les routes disponibles pour debug
  console.log(`[ROUTER] Available routes:`, routes.map(r => `${r.method} ${r.path}`).join(", "));
  console.log(`[ROUTER] No route found for: ${routeKey}`);
  return null;
}

