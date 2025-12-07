/**
 * Routes pour le service de détection de Gamma Squeeze
 */

import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { Route } from "./types";
import * as gammaSqueeze from "../gamma-squeeze";

// Helper functions
function getPathParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.pathParameters?.[key];
}

export const gammaSqueezeRoutes: Route[] = [
  // ========== Gamma Squeeze Analysis ==========
  {
    method: "GET",
    path: "/ticker-analysis/{ticker}/gamma-squeeze",
    handler: async (event) => {
      const ticker = getPathParam(event, "ticker");
      if (!ticker) throw new Error("Missing ticker parameter");
      return await gammaSqueeze.detectGammaSqueeze(ticker);
    },
  },
];

