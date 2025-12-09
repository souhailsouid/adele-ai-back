import { createServer } from 'http';
import { config } from 'dotenv';
import { resolve } from 'path';
import { handler } from '../services/api/src/index.js';

// Charger les variables d'environnement depuis .env
config({ path: resolve(__dirname, '../.env') });

// Afficher les variables chargées (masquer les valeurs sensibles)
console.log('\n📋 Variables d\'environnement chargées:');
console.log('  - OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Définie' : '❌ Manquante');
console.log('  - SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Définie' : '❌ Manquante');
console.log('  - UNUSUAL_WHALES_API_KEY:', process.env.UNUSUAL_WHALES_API_KEY ? '✅ Définie' : '❌ Manquante');
console.log('  - FMP_API_KEY:', process.env.FMP_API_KEY ? '✅ Définie' : '❌ Manquante');
console.log('  - NEO4J_URI:', process.env.NEO4J_URI ? '✅ Définie' : '❌ Manquante');
console.log('');

const PORT = 3001;

// Simuler un événement API Gateway V2
function createApiGatewayEvent(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  queryString: string = '',
  body: string | null = null
) {
  // Extraire le token JWT des headers pour simuler la validation
  const authHeader = headers.authorization || headers.Authorization || '';
  const token = authHeader.replace('Bearer ', '');

  // Décoder le token pour extraire les claims (simplifié)
  let jwtClaims: any = {
    sub: 'test-user-id',
    email: 'test@example.com',
  };

  if (token && token.includes('.')) {
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        jwtClaims = {
          sub: payload.sub || 'test-user-id',
          email: payload.email || 'test@example.com',
          ...payload,
        };
      }
    } catch (e) {
      console.warn('Could not decode JWT, using default claims');
    }
  }

  // Parser les query parameters
  const queryStringParameters: Record<string, string> = {};
  if (queryString) {
    queryString.split('&').forEach((param) => {
      const [key, value] = param.split('=');
      if (key) {
        queryStringParameters[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
    });
  }

  return {
    version: '2.0',
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: queryString,
    queryStringParameters: Object.keys(queryStringParameters).length > 0 ? queryStringParameters : undefined,
    headers: {
      'content-type': headers['content-type'] || headers['Content-Type'] || 'application/json',
      'authorization': authHeader,
      ...headers,
    },
    requestContext: {
      http: {
        method,
        path,
        protocol: 'HTTP/1.1',
      },
      authorizer: {
        jwt: {
          claims: jwtClaims,
        },
      },
    },
    body: body || null,
    isBase64Encoded: false,
  };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method || 'GET';
    const queryString = url.search.substring(1); // Enlever le '?'

    console.log(`\n[${new Date().toISOString()}] ${method} ${path}${queryString ? '?' + queryString : ''}`);

    // Gérer OPTIONS (CORS preflight)
    if (method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end();
      return;
    }

    // Lire le body pour les requêtes POST/PUT
    let body: string | null = null;
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks).toString('utf-8');
    }

    // Récupérer tous les headers
    const headers: Record<string, string> = {};
    Object.entries(req.headers).forEach(([key, value]) => {
      headers[key] = Array.isArray(value) ? value[0] : value || '';
    });

    // Créer l'événement API Gateway
    const event = createApiGatewayEvent(method, path, headers, queryString, body);

    // Appeler le handler Lambda
    const result = await handler(event as any);

    console.log(`✅ Response: ${result.statusCode}`);
    if (result.body && result.body.length > 200) {
      console.log(`   Body (preview): ${result.body.substring(0, 200)}...`);
    } else {
      console.log(`   Body: ${result.body}`);
    }

    // Envoyer la réponse
    res.writeHead(result.statusCode || 200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end(result.body || JSON.stringify({ error: 'No response' }));
  } catch (error: any) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: error.message, 
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }));
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Serveur local démarré sur http://localhost:${PORT}`);
  console.log(`📡 Testez avec:`);
  console.log(`   curl http://localhost:${PORT}/ticker-activity/TSLA/quote \\`);
  console.log(`     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"`);
  console.log(`\n💡 Appuyez sur Ctrl+C pour arrêter\n`);
});

