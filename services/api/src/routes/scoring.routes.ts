/**
 * Routes pour le service de scoring
 */

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { Route } from "./types";
import * as scoring from "../scoring";

// Helper functions
function getPathParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.pathParameters?.[key];
}

export const scoringRoutes: Route[] = [
  // ========== Score Composite ==========
  {
    method: "GET",
    path: "/ticker-analysis/{ticker}/score",
    handler: async (event) => {
      const ticker = getPathParam(event, "ticker");
      if (!ticker) throw new Error("Missing ticker parameter");
      return await scoring.calculateTickerScore(ticker);
    },
  },

  // ========== Breakdown Détaillé (même endpoint, mais on peut ajouter un paramètre ?breakdown=true) ==========
  {
    method: "GET",
    path: "/ticker-analysis/{ticker}/breakdown",
    handler: async (event) => {
      const ticker = getPathParam(event, "ticker");
      if (!ticker) throw new Error("Missing ticker parameter");
      // Le breakdown est inclus dans le score, on retourne le même résultat
      return await scoring.calculateTickerScore(ticker);
    },
  },
];

