/**
 * Router pour routes rapides (< 10s)
 */

import { APIGatewayProxyEventV2 } from "aws-lambda";
import { aiAnalystRoutes } from "./routes/ai-analyst.routes";
import { combinedAnalysisRoutes } from "./routes/combined-analysis.routes";
import { smartMoneyRoutes } from "./routes/smart-money.routes";
import { surveillanceRoutes } from "./routes/surveillance.routes";
import { alertRoutes } from "./routes/alert.routes";
import { scoringRoutes } from "./routes/scoring.routes";
import { gammaSqueezeRoutes } from "./routes/gamma-squeeze.routes";
import { attributionRoutes } from "./routes/attribution.routes";
import { fmpRoutes } from "./routes/fmp.routes";
import type { Route, RouteHandler } from "./routes/types";

// Routes rapides uniquement
const fastRoutes: Route[] = [
  // Routes IA simples
  ...aiAnalystRoutes.filter((r) => 
    r.path === "/ai/ticker-institutional-analysis" ||
    r.path === "/ai/ticker-news-events-analysis"
  ),
  // Routes non-IA (toutes rapides)
  ...combinedAnalysisRoutes,
  ...smartMoneyRoutes,
  ...surveillanceRoutes,
  ...alertRoutes,
  ...scoringRoutes,
  ...gammaSqueezeRoutes,
  ...attributionRoutes,
  ...fmpRoutes,
];

export function findRoute(event: APIGatewayProxyEventV2): RouteHandler | null {
  const routeKey = event.routeKey;
  
  for (const route of fastRoutes) {
    const routePattern = `${route.method} ${route.path}`;
    if (routeKey === routePattern) {
      return route.handler;
    }
  }
  
  return null;
}





