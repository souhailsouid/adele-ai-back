/**
 * Handler Lambda dédié aux routes Funds (/funds/*)
 * Isolé de l'API principale pour éviter de surcharger lors des pics de parsing
 */

import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { findFundsRoute } from "../router-funds";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization,Content-Type,Accept",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Content-Type": "application/json",
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const { requestContext } = event;

    // CORS preflight
    if (requestContext?.http?.method === "OPTIONS") {
      return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    // Auth - API Gateway valide déjà le JWT
    const jwtClaims = (requestContext as any)?.authorizer?.jwt?.claims;
    if (!jwtClaims) {
      return { 
        statusCode: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        body: JSON.stringify({ error: "unauthorized" }) 
      };
    }

    // Trouver la route Funds
    const routeHandler = findFundsRoute(event);

    if (!routeHandler) {
      return { 
        statusCode: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        body: JSON.stringify({ error: "not_found" }) 
      };
    }

    // Exécuter le handler
    const result = await routeHandler(event);
    
    // Normalize response + always attach CORS headers
    if (result && typeof result === "object" && "statusCode" in result) {
      return { 
        ...(result as any), 
        headers: { ...corsHeaders, "Content-Type": "application/json", ...((result as any).headers || {}) } 
      };
    }
    
    return { 
      statusCode: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }, 
      body: JSON.stringify(result) 
    };
  } catch (error: any) {
    console.error("Funds handler error:", error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error.message || "Internal server error",
        requestId: event.requestContext?.requestId,
      }),
    };
  }
};
