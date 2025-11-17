import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { getSignals, createSignal, getSignal, searchSignals } from "./signals";
import { chatWithData } from "./chat";
import { createFund, getFunds, getFund, getFundHoldings, getFundFilings } from "./funds";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // Log IMMÉDIAT pour voir si le handler est appelé - utiliser JSON.stringify pour éviter les problèmes
  try {
    console.log('=== HANDLER CALLED ===');
    console.log('Event routeKey:', event?.routeKey || 'MISSING');
    console.log('Event rawPath:', event?.rawPath || 'MISSING');
    console.log('Event keys:', Object.keys(event || {}));
  } catch (logError) {
    // Si même les logs échouent, on continue
  }
  
  try {
    const { requestContext, routeKey, rawPath, pathParameters, body } = event;
    let json;
    try {
      json = body ? JSON.parse(body) : undefined;
      console.log('Body parsed successfully:', json);
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError);
      console.error('Body was:', body);
      throw new Error(`Invalid JSON: ${parseError.message}`);
    }

    // Log pour déboguer
    console.log('API Handler called:', {
      routeKey,
      rawPath,
      method: requestContext?.http?.method,
      path: requestContext?.http?.path,
      hasJWT: !!(requestContext as any)?.authorizer?.jwt,
    });

    // Auth - API Gateway valide déjà le JWT, extraire les claims
    const jwtClaims = (requestContext as any)?.authorizer?.jwt?.claims;
    console.log('JWT Claims:', jwtClaims ? 'present' : 'missing');
    
    if (!jwtClaims) {
      console.log('No JWT claims, returning 401');
      return { statusCode: 401, body: JSON.stringify({ error: "unauthorized" }) };
    }
    // jwtClaims contient: sub (userId), email, etc.
    const userId = jwtClaims.sub;
    console.log('User ID:', userId);

    // Routes ADEL AI
    if (routeKey === "GET /signals") {
      const source = event.queryStringParameters?.source;
      const type = event.queryStringParameters?.type;
      const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 100;
      const offset = event.queryStringParameters?.offset ? parseInt(event.queryStringParameters.offset) : 0;
      const min_importance = event.queryStringParameters?.min_importance ? parseInt(event.queryStringParameters.min_importance) : undefined;
      
      const signals = await getSignals({ source, type, limit, offset, min_importance });
      return ok(signals);
    }

    if (routeKey === "GET /signals/{id}") {
      const signal = await getSignal(pathParameters!.id!);
      return ok(signal);
    }

    if (routeKey === "POST /signals") {
      const signal = await createSignal(json);
      return ok(signal);
    }

    if (routeKey === "POST /search") {
      const query = json?.query || event.queryStringParameters?.q;
      if (!query) {
        return { statusCode: 400, body: JSON.stringify({ error: "query parameter required" }) };
      }
      const limit = json?.limit || event.queryStringParameters?.limit ? parseInt(event.queryStringParameters?.limit || "20") : 20;
      const results = await searchSignals(query, limit);
      return ok(results);
    }

    if (routeKey === "POST /chat") {
      const userQuery = json?.query || json?.message;
      if (!userQuery) {
        return { statusCode: 400, body: JSON.stringify({ error: "query or message required" }) };
      }
      const result = await chatWithData(userQuery);
      return ok(result);
    }

    // Routes Funds
    if (routeKey === "POST /funds") {
      const result = await createFund(json);
      return ok(result);
    }

    if (routeKey === "GET /funds") {
      const funds = await getFunds();
      return ok(funds);
    }

    if (routeKey === "GET /funds/{id}") {
      const fund = await getFund(parseInt(pathParameters!.id!));
      return ok(fund);
    }

    if (routeKey === "GET /funds/{id}/holdings") {
      const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 100;
      const holdings = await getFundHoldings(parseInt(pathParameters!.id!), limit);
      return ok(holdings);
    }

    if (routeKey === "GET /funds/{id}/filings") {
      const filings = await getFundFilings(parseInt(pathParameters!.id!));
      return ok(filings);
    }

    console.log('No matching route, returning 404. routeKey was:', routeKey);
    return notFound();
  } catch (e:any) {
    console.error('ERROR in handler:', e);
    console.error('Error name:', e?.name);
    console.error('Error message:', e?.message);
    console.error('Error stack:', e?.stack);
    // Retourner 500 pour les erreurs serveur, 400 pour les erreurs client
    const statusCode = e?.name === 'ZodError' || e?.message?.includes('validation') ? 400 : 500;
    return { 
      statusCode, 
      body: JSON.stringify({ 
        error: e.message || 'Internal server error',
        details: e?.issues || e?.stack 
      }) 
    };
  }
};

function ok(data:any){ return { statusCode: 200, body: JSON.stringify(data) }; }
function notFound(){ return { statusCode: 404, body: JSON.stringify({ error:"not_found" }) }; }
