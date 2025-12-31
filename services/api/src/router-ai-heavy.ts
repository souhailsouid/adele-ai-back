/**
 * Router pour routes IA lourdes (15-30s)
 */

import { APIGatewayProxyEventV2 } from "aws-lambda";
import { aiAnalystRoutes } from "./routes/ai-analyst.routes";
import type { RouteHandler } from "./routes/types";

// Routes IA lourdes uniquement
const heavyRoutes = aiAnalystRoutes.filter((r) => 
  r.path === "/ai/institution-moves-analysis" ||
  r.path === "/ai/ticker-activity-analysis" ||
  r.path === "/ai/options-flow-analysis"
);

export function findRoute(event: APIGatewayProxyEventV2): RouteHandler | null {
  const routeKey = event.routeKey;
  
  for (const route of heavyRoutes) {
    const routePattern = `${route.method} ${route.path}`;
    if (routeKey === routePattern) {
      return route.handler;
    }
  }
  
  return null;
}





