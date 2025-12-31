/**
 * Handler Lambda pour routes rapides (< 10s)
 * Routes : ticker-institutional-analysis, ticker-news-events-analysis, routes non-IA
 */

import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { findRoute } from "../router-fast";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization,Content-Type,Accept",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const { requestContext } = event;

    // CORS preflight (Swagger UI / browser fetch)
    if (requestContext?.http?.method === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    // Auth - API Gateway valide déjà le JWT
    const jwtClaims = (requestContext as any)?.authorizer?.jwt?.claims;
    if (!jwtClaims) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: "unauthorized" }) };
    }

    // Trouver la route
    const routeHandler = findRoute(event);

    if (!routeHandler) {
      return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: "not_found" }) };
    }

    // Exécuter le handler
    const result = await routeHandler(event);
    // Normalize response + always attach CORS headers
    if (result && typeof result === "object" && "statusCode" in result) {
      return { ...(result as any), headers: { ...corsHeaders, ...((result as any).headers || {}) } };
    }
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) };
  } catch (error: any) {
    console.error("Handler error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.message || "Internal server error",
        requestId: event.requestContext?.requestId,
      }),
    };
  }
};


