/**
 * Routes pour les analyses combinées FMP + Unusual Whales
 */

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { Route } from "./types";
import * as combinedAnalysis from "../combined-analysis";

// Helper functions
function getPathParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.pathParameters?.[key];
}

function getQueryParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.queryStringParameters?.[key];
}

export const combinedAnalysisRoutes: Route[] = [
  // ========== Analyse Complète ==========
  {
    method: "GET",
    path: "/analysis/{ticker}/complete",
    handler: async (event) => {
      const ticker = getPathParam(event, "ticker");
      if (!ticker) throw new Error("Missing ticker parameter");
      return await combinedAnalysis.getCompleteAnalysis(ticker);
    },
  },

  // ========== Détection de Divergences ==========
  {
    method: "GET",
    path: "/analysis/{ticker}/divergence",
    handler: async (event) => {
      const ticker = getPathParam(event, "ticker");
      if (!ticker) throw new Error("Missing ticker parameter");
      return await combinedAnalysis.getDivergenceAnalysis(ticker);
    },
  },

  // ========== Valuation Complète ==========
  {
    method: "GET",
    path: "/analysis/{ticker}/valuation",
    handler: async (event) => {
      const ticker = getPathParam(event, "ticker");
      if (!ticker) throw new Error("Missing ticker parameter");
      return await combinedAnalysis.getComprehensiveValuation(ticker);
    },
  },

  // ========== Prédiction d'Earnings ==========
  {
    method: "GET",
    path: "/analysis/{ticker}/earnings-prediction",
    handler: async (event) => {
      const ticker = getPathParam(event, "ticker");
      if (!ticker) throw new Error("Missing ticker parameter");
      const earningsDate = getQueryParam(event, "earningsDate");
      return await combinedAnalysis.getEarningsPrediction(ticker, earningsDate);
    },
  },

  // ========== Screening Multi-Critères ==========
  {
    method: "POST",
    path: "/screener/multi-criteria",
    handler: async (event) => {
      if (!event.body) throw new Error("Missing request body");
      const criteria = JSON.parse(event.body);
      return await combinedAnalysis.screenMultiCriteria(criteria);
    },
  },

  // ========== Analyse de Risque ==========
  {
    method: "GET",
    path: "/analysis/{ticker}/risk",
    handler: async (event) => {
      const ticker = getPathParam(event, "ticker");
      if (!ticker) throw new Error("Missing ticker parameter");
      return await combinedAnalysis.getRiskAnalysis(ticker);
    },
  },

  // ========== Tracking d'Institutions ==========
  {
    method: "GET",
    path: "/institutions/{name}/tracking",
    handler: async (event) => {
      const name = getPathParam(event, "name");
      if (!name) throw new Error("Missing institution name parameter");
      return await combinedAnalysis.trackInstitution(name);
    },
  },

  // ========== Analyse de Secteur ==========
  {
    method: "GET",
    path: "/analysis/sector/{sector}",
    handler: async (event) => {
      const sector = getPathParam(event, "sector");
      if (!sector) throw new Error("Missing sector parameter");
      return await combinedAnalysis.analyzeSector(sector);
    },
  },
];

