/**
 * Router dédié aux routes Funds (/funds/*, /notifications/funds, /sec/calendar)
 * Isolé de l'API principale pour éviter de surcharger lors des pics de parsing
 */

import { APIGatewayProxyEventV2 } from "aws-lambda";
import { supabase } from "./supabase";
import { createFund, getFunds, getFund, getFundByCik, resolveFundId, getFundHoldings, getFundFilings, getFundFiling, getFilingHoldings, getFundDiffs, getFundTickerDiffs, getFundRecentChanges, getAllFundsRecentChanges, discoverAllFundFilings, retryFilingParsing, retryAllFundFilings, getTickerFundsChanges, getMarketPulse, getPulseFeed, analyzeFundDiffsStrategically } from "./funds";
import { getAccumulationNotifications, getGlobalAccumulationNotifications } from "./services/fund-notifications.service";
import { getFundCiks, addFundCik, removeFundCik } from "./services/fund-ciks.service";
import {
  upsertNotificationPreferences,
  getNotificationPreferences,
  getPendingNotifications,
  createDailyDigest,
  getDigests,
  getDigestNotifications,
} from "./services/fund-notifications.service";
import {
  getFundPortfolioDeduplicated,
  getFundTransparencyInfo,
} from "./services/fund-deduplication.service";
import { getCurrentQuarter, isPeakPeriod, getRecommendedPollingInterval, getDaysUntilDeadline, getYearCalendar } from "./services/sec-calendar.service";
import { calculateFundDiff } from "./services/fund-diff.service";
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

// Routes Funds uniquement
const fundsRoutes: Route[] = [
  // Funds de base
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
    path: "/funds/changes",
    handler: async (event) => {
      const minChangePct = getQueryParam(event, "min_change_pct") 
        ? parseFloat(getQueryParam(event, "min_change_pct")!) 
        : 10;
      const limit = getQueryParam(event, "limit") 
        ? parseInt(getQueryParam(event, "limit")!) 
        : 200;
      const days = getQueryParam(event, "days") 
        ? parseInt(getQueryParam(event, "days")!) 
        : undefined;
      return await getAllFundsRecentChanges(minChangePct, limit, days);
    },
  },
  {
    method: "GET",
    path: "/funds/{cik}",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      if (!cik) throw new Error("Missing cik parameter");
      const fund = await getFundByCik(cik);
      if (!fund) {
        const error = new Error(`Fund with CIK ${cik} not found`);
        (error as any).statusCode = 404;
        throw error;
      }
      return fund;
    },
  },
  {
    method: "GET",
    path: "/funds/{cik}/holdings",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      if (!cik) throw new Error("Missing cik parameter");
      const fundId = await resolveFundId(cik);
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 100;
      return await getFundHoldings(fundId, limit);
    },
  },
  {
    method: "GET",
    path: "/funds/{cik}/filings/{filingId}/holdings",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      const filingId = getPathParam(event, "filingId");
      if (!cik || !filingId) throw new Error("Missing cik or filingId parameter");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 1000;
      return await getFilingHoldings(await resolveFundId(cik), parseInt(filingId), limit);
    },
  },
  {
    method: "GET",
    path: "/funds/{cik}/filings/{filingId}",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      const filingId = getPathParam(event, "filingId");
      if (!cik || !filingId) throw new Error("Missing cik or filingId parameter");
      return await getFundFiling(await resolveFundId(cik), parseInt(filingId));
    },
  },
  {
    method: "GET",
    path: "/funds/{cik}/filings",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      if (!cik) throw new Error("Missing cik parameter");
      const fundId = await resolveFundId(cik);
      const formType = getQueryParam(event, "form_type");
      const data = await getFundFilings(fundId);
      if (formType && data) {
        return data.filter((f: any) => f.form_type === formType);
      }
      return data;
    },
  },
  {
    method: "GET",
    path: "/funds/{cik}/diffs",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      if (!cik) throw new Error("Missing cik parameter");
      const fundId = await resolveFundId(cik);
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 50;
      
      const options: {
        from_date?: string;
        to_date?: string;
        quarter?: string;
        year?: number;
        compare_to?: string;
        ticker?: string;
      } = {};

      if (event.queryStringParameters?.from_date) {
        options.from_date = event.queryStringParameters.from_date;
      }
      if (event.queryStringParameters?.to_date) {
        options.to_date = event.queryStringParameters.to_date;
      }
      if (event.queryStringParameters?.quarter) {
        options.quarter = event.queryStringParameters.quarter;
      }
      if (event.queryStringParameters?.year) {
        options.year = parseInt(event.queryStringParameters.year);
      }
      if (event.queryStringParameters?.compare_to) {
        options.compare_to = event.queryStringParameters.compare_to;
      }
      if (event.queryStringParameters?.ticker) {
        options.ticker = event.queryStringParameters.ticker;
      }

      return await getFundDiffs(fundId, limit, Object.keys(options).length > 0 ? options : undefined);
    },
  },
  {
    method: "GET",
    path: "/funds/{cik}/diffs/{ticker}",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      const ticker = getPathParam(event, "ticker");
      if (!cik || !ticker) throw new Error("Missing cik or ticker parameter");
      return await getFundTickerDiffs(await resolveFundId(cik), ticker);
    },
  },
  {
    method: "GET",
    path: "/funds/{cik}/changes",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      if (!cik) throw new Error("Missing cik parameter");
      const minChangePct = getQueryParam(event, "min_change_pct") 
        ? parseFloat(getQueryParam(event, "min_change_pct")!) 
        : 10;
      const days = getQueryParam(event, "days") 
        ? parseInt(getQueryParam(event, "days")!) 
        : undefined;
      return await getFundRecentChanges(await resolveFundId(cik), minChangePct, days);
    },
  },
  {
    method: "GET",
    path: "/funds/{cik}/diffs/strategic",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      if (!cik) throw new Error("Missing cik parameter");
      
      // Récupérer les diffs bruts d'abord
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 500;
      const noiseThreshold = getQueryParam(event, "noise_threshold") 
        ? parseFloat(getQueryParam(event, "noise_threshold")!) 
        : 0.5;
      
      const options: {
        from_date?: string;
        to_date?: string;
        quarter?: string;
        year?: number;
        compare_to?: string;
        ticker?: string;
      } = {};

      if (event.queryStringParameters?.from_date) {
        options.from_date = event.queryStringParameters.from_date;
      }
      if (event.queryStringParameters?.to_date) {
        options.to_date = event.queryStringParameters.to_date;
      }
      if (event.queryStringParameters?.quarter) {
        options.quarter = event.queryStringParameters.quarter;
      }
      if (event.queryStringParameters?.year) {
        options.year = parseInt(event.queryStringParameters.year);
      }
      if (event.queryStringParameters?.compare_to) {
        options.compare_to = event.queryStringParameters.compare_to;
      }
      if (event.queryStringParameters?.ticker) {
        options.ticker = event.queryStringParameters.ticker;
      }

      // Récupérer les diffs bruts (sans options de filtrage temporel pour avoir tous les diffs)
      // Ne passer les options que si elles sont vraiment spécifiées (from_date/to_date/quarter/year)
      const hasTimeOptions = !!(options.from_date || options.to_date || options.quarter || options.year);
      const includeLowConviction = getQueryParam(event, "include_low_conviction") === 'true';
      const rawDiffs = await getFundDiffs(await resolveFundId(cik), limit, hasTimeOptions ? options : undefined);
      
      // Debug: logger le nombre de diffs récupérés
      const fundId = await resolveFundId(cik);
      console.log(`[Strategic Analysis] Fund ${fundId}: ${rawDiffs?.length || 0} raw diffs retrieved`);
      
      // Analyser stratégiquement
      const analysis = await analyzeFundDiffsStrategically(fundId, rawDiffs as any[], noiseThreshold, includeLowConviction);
      
      // Debug: logger le résultat
      console.log(`[Strategic Analysis] Fund ${fundId}: Analysis completed. Strong conviction: ${analysis.summary.strong_conviction_count}`);
      
      return analysis;
    },
  },
  {
    method: "GET",
    path: "/funds/{cik}/portfolio",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      if (!cik) throw new Error("Missing cik parameter");
      
      const useDeduplication = getQueryParam(event, "deduplicate") !== "false";
      
      if (useDeduplication) {
        return await getFundPortfolioDeduplicated(await resolveFundId(cik));
      }
      
      const { data: latestFiling, error: filingError } = await supabase
        .from("fund_filings")
        .select("id")
        .eq("fund_id", await resolveFundId(cik))
        .eq("status", "PARSED")
        .order("filing_date", { ascending: false })
        .limit(1)
        .single();
      
      if (filingError || !latestFiling) {
        return { holdings: [], filing: null };
      }
      
      const { data: holdings, error: holdingsError } = await supabase
        .from("fund_holdings")
        .select("*, fund_filings(filing_date, form_type)")
        .eq("filing_id", latestFiling.id)
        .eq("type", "stock")
        .order("market_value", { ascending: false });
      
      if (holdingsError) throw holdingsError;
      
      return {
        holdings: holdings || [],
        filing: latestFiling,
      };
    },
  },
  {
    method: "GET",
    path: "/funds/{cik}/transparency",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      if (!cik) throw new Error("Missing cik parameter");
      return await getFundTransparencyInfo(await resolveFundId(cik));
    },
  },
  {
    method: "POST",
    path: "/funds/{cik}/discover",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      if (!cik) throw new Error("Missing cik parameter");
      // Découvrir les filings pour TOUS les CIK (principal + secondaires)
      const result = await discoverAllFundFilings(await resolveFundId(cik));
      return {
        message: "Discovery started for all CIKs",
        fund_id: await resolveFundId(cik),
        ...result,
      };
    },
  },
  {
    method: "POST",
    path: "/funds/{cik}/filings/{filingId}/retry",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      const filingId = getPathParam(event, "filingId");
      if (!cik || !filingId) throw new Error("Missing cik or filingId parameter");
      return await retryFilingParsing(await resolveFundId(cik), parseInt(filingId));
    },
  },
  {
    method: "POST",
    path: "/funds/{cik}/filings/retry-all",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      if (!cik) throw new Error("Missing cik parameter");
      const body = parseBody(event);
      const status = body?.status; // "FAILED", "DISCOVERED", or "ALL"
      return await retryAllFundFilings(await resolveFundId(cik), status ? { status } : undefined);
    },
  },
  {
    method: "POST",
    path: "/funds/{cik}/filings/{filingId}/calculate-diff",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      const filingId = getPathParam(event, "filingId");
      if (!cik || !filingId) throw new Error("Missing cik or filingId parameter");
      return await calculateFundDiff(await resolveFundId(cik), parseInt(filingId));
    },
  },
  {
    method: "GET",
    path: "/sec/calendar",
    handler: async (event) => {
      const year = getQueryParam(event, "year") 
        ? parseInt(getQueryParam(event, "year")!) 
        : new Date().getFullYear();
      
      return {
        current_quarter: getCurrentQuarter(),
        is_peak_period: isPeakPeriod(),
        recommended_polling_interval_minutes: getRecommendedPollingInterval(),
        days_until_deadline: getDaysUntilDeadline(),
        year_calendar: getYearCalendar(year),
      };
    },
  },
  // Routes Fund CIKs
  {
    method: "GET",
    path: "/funds/{cik}/ciks",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      if (!cik) throw new Error("Missing cik parameter");
      return await getFundCiks(await resolveFundId(cik));
    },
  },
  {
    method: "POST",
    path: "/funds/{cik}/ciks",
    handler: async (event) => {
      const fundCik = getPathParam(event, "cik");
      if (!fundCik) throw new Error("Missing cik parameter");
      const body = parseBody(event);
      const cikToAdd = body?.cik;
      const entity_name = body?.entity_name;
      if (!cikToAdd) throw new Error("Missing cik in body");
      return await addFundCik(await resolveFundId(fundCik), cikToAdd, entity_name);
    },
  },
  {
    method: "DELETE",
    path: "/funds/{cik}/ciks/{cikToRemove}",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      const cikToRemove = getPathParam(event, "cikToRemove");
      if (!cik || !cikToRemove) throw new Error("Missing cik or cikToRemove parameter");
      await removeFundCik(await resolveFundId(cik), cikToRemove);
      return { message: "CIK removed successfully" };
    },
  },
  // Routes Notifications Funds
  {
    method: "GET",
    path: "/funds/{cik}/notifications/preferences",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      const jwtClaims = (event.requestContext as any)?.authorizer?.jwt?.claims;
      const userId = jwtClaims?.sub || event.headers['x-user-id'];
      if (!cik || !userId) throw new Error("Missing cik or user_id parameter");
      const prefs = await getNotificationPreferences(userId, await resolveFundId(cik));
      return prefs || { message: "No preferences set, using defaults" };
    },
  },
  {
    method: "PUT",
    path: "/funds/{cik}/notifications/preferences",
    handler: async (event) => {
      const cik = getPathParam(event, "cik");
      const jwtClaims = (event.requestContext as any)?.authorizer?.jwt?.claims;
      const userId = jwtClaims?.sub || event.headers['x-user-id'];
      if (!cik || !userId) throw new Error("Missing cik or user_id parameter");
      const body = parseBody(event);
      return await upsertNotificationPreferences(userId, await resolveFundId(cik), body);
    },
  },
  {
    method: "GET",
    path: "/notifications/funds",
    handler: async (event) => {
      const jwtClaims = (event.requestContext as any)?.authorizer?.jwt?.claims;
      const userId = jwtClaims?.sub || event.headers['x-user-id'];
      if (!userId) throw new Error("Missing user_id");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 50;
      return await getPendingNotifications(userId, limit);
    },
  },
  {
    method: "POST",
    path: "/notifications/digest",
    handler: async (event) => {
      const jwtClaims = (event.requestContext as any)?.authorizer?.jwt?.claims;
      const userId = jwtClaims?.sub || event.headers['x-user-id'];
      if (!userId) throw new Error("Missing user_id");
      const body = parseBody(event);
      const date = body?.date || new Date().toISOString().split('T')[0];
      return await createDailyDigest(userId, date);
    },
  },
  {
    method: "GET",
    path: "/notifications/digests",
    handler: async (event) => {
      const jwtClaims = (event.requestContext as any)?.authorizer?.jwt?.claims;
      const userId = jwtClaims?.sub || event.headers['x-user-id'];
      if (!userId) throw new Error("Missing user_id");
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 30;
      return await getDigests(userId, limit);
    },
  },
  {
    method: "GET",
    path: "/notifications/digests/{digestId}",
    handler: async (event) => {
      const digestId = getPathParam(event, "digestId");
      const jwtClaims = (event.requestContext as any)?.authorizer?.jwt?.claims;
      const userId = jwtClaims?.sub || event.headers['x-user-id'];
      if (!digestId || !userId) throw new Error("Missing digestId or user_id");
      
      // Vérifier que le digest appartient à l'utilisateur
      const { data: digest } = await supabase
        .from("notification_digests")
        .select("user_id")
        .eq("id", parseInt(digestId))
        .single();
      
      if (!digest || digest.user_id !== userId) {
        throw new Error("Digest not found or access denied");
      }
      
      // Récupérer les notifications du digest
      const notifications = await getDigestNotifications(parseInt(digestId));
      return notifications;
    },
  },
  // ========== Market Pulse - Comparaison avec autres funds ==========
  {
    method: "GET",
    path: "/ticker/{ticker}/funds/changes",
    handler: async (event) => {
      const ticker = getPathParam(event, "ticker");
      if (!ticker) throw new Error("Missing ticker parameter");
      const days = getQueryParam(event, "days") 
        ? parseInt(getQueryParam(event, "days")!) 
        : undefined;
      const minChangePct = getQueryParam(event, "min_change_pct") 
        ? parseFloat(getQueryParam(event, "min_change_pct")!) 
        : undefined;
      return await getTickerFundsChanges(ticker, days, minChangePct);
    },
  },
  // ========== Notifications d'Accumulation Globales ==========
  {
    method: "GET",
    path: "/notifications/accumulations",
    handler: async (event) => {
      const jwtClaims = (event.requestContext as any)?.authorizer?.jwt?.claims;
      const userId = jwtClaims?.sub || event.headers['x-user-id'];
      if (!userId) throw new Error("Missing user_id");
      
      const limit = getQueryParam(event, "limit") ? parseInt(getQueryParam(event, "limit")!) : 50;
      const includeSent = getQueryParam(event, "include_sent") === 'true';
      const minQuarters = getQueryParam(event, "min_quarters") ? parseInt(getQueryParam(event, "min_quarters")!) : 2;
      const onlyStrong = getQueryParam(event, "only_strong") === 'true';
      
      // Si only_global=true, retourner les notifications globales (tous utilisateurs)
      // Sinon, retourner uniquement les notifications de l'utilisateur
      const onlyGlobal = getQueryParam(event, "only_global") === 'true';
      
      if (onlyGlobal) {
        return await getGlobalAccumulationNotifications(limit, minQuarters, onlyStrong);
      } else {
        return await getAccumulationNotifications(userId, limit, includeSent);
      }
    },
  },
];

// Router principal pour Funds
export function findFundsRoute(event: APIGatewayProxyEventV2): RouteHandler | null {
  const routeKey = event.routeKey;
  
  for (const route of fundsRoutes) {
    const routePattern = `${route.method} ${route.path}`;
    if (routeKey === routePattern) {
      return route.handler;
    }
  }
  
  return null;
}
