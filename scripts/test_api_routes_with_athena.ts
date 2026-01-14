/**
 * Test complet des routes API avec Athena activé
 * 
 * Usage:
 *   npx tsx scripts/test_api_routes_with_athena.ts <ACCESS_TOKEN>
 */

import * as fs from 'fs';
import * as path from 'path';

// Charger les variables d'environnement
let dotenvLoaded = false;
try {
  const dotenv = require('dotenv');
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    dotenvLoaded = true;
  }
} catch (e) {
  // dotenv n'est pas installé, parser manuellement
}

if (!dotenvLoaded) {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const lines = envContent.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    } catch (e) {
      // Ignorer les erreurs de parsing
    }
  }
}

const API_BASE_URL = process.env.API_BASE_URL || 'https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod';
const ACCESS_TOKEN = process.argv[2] || process.env.ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('❌ Erreur: ACCESS_TOKEN requis');
  console.log('Usage: npx tsx scripts/test_api_routes_with_athena.ts <ACCESS_TOKEN>');
  process.exit(1);
}

interface RouteTest {
  name: string;
  method: string;
  path: string;
  expectedStatus: number;
}

const routesToTest: RouteTest[] = [
  // Companies
  { name: 'Get Company by Ticker (AAPL)', method: 'GET', path: '/companies/ticker/AAPL', expectedStatus: 200 },
  { name: 'Get Company by Ticker (MSFT)', method: 'GET', path: '/companies/ticker/MSFT', expectedStatus: 200 },
  { name: 'Get Company by Ticker (Invalid)', method: 'GET', path: '/companies/ticker/INVALID', expectedStatus: 404 },
  
  // Funds
  { name: 'Get Funds List', method: 'GET', path: '/funds', expectedStatus: 200 },
  { name: 'Get Fund by ID (1)', method: 'GET', path: '/funds/1', expectedStatus: 200 },
];

interface TestResult {
  route: RouteTest;
  success: boolean;
  latency: number;
  statusCode: number;
  error?: string;
}

async function testRoute(route: RouteTest): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_BASE_URL}${route.path}`, {
      method: route.method,
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const latency = Date.now() - startTime;
    const data = await response.json().catch(() => ({}));

    return {
      route,
      success: response.status === route.expectedStatus,
      latency,
      statusCode: response.status,
      error: response.status !== route.expectedStatus ? `Expected ${route.expectedStatus}, got ${response.status}` : undefined,
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;
    return {
      route,
      success: false,
      latency,
      statusCode: 0,
      error: error.message,
    };
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 Test Complet: Routes API avec Athena');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 Configuration:');
  console.log(`   - API URL: ${API_BASE_URL}`);
  console.log(`   - USE_ATHENA: ${process.env.USE_ATHENA || 'false'}`);
  console.log(`   - Routes à tester: ${routesToTest.length}\n`);

  console.log('🔄 Exécution des tests...\n');

  const results: TestResult[] = [];

  for (const route of routesToTest) {
    const result = await testRoute(route);
    results.push(result);

    const status = result.success ? '✅' : '❌';
    const latencyColor = result.latency < 1000 ? '🟢' : result.latency < 5000 ? '🟡' : '🔴';
    
    console.log(`${status} ${route.name.padEnd(40)} ${latencyColor} ${result.latency}ms (${result.statusCode})`);
    
    if (result.error) {
      console.log(`      → Erreur: ${result.error}`);
    }

    // Pause entre les requêtes
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Résumé
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📊 RÉSUMÉ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
  const minLatency = Math.min(...results.map(r => r.latency));
  const maxLatency = Math.max(...results.map(r => r.latency));

  console.log(`✅ Succès: ${successCount}/${results.length}`);
  console.log(`❌ Échecs: ${failCount}/${results.length}`);
  console.log(`\n⚡ Latence:`);
  console.log(`   - Moyenne: ${avgLatency.toFixed(0)}ms`);
  console.log(`   - Min: ${minLatency}ms`);
  console.log(`   - Max: ${maxLatency}ms`);

  const fastQueries = results.filter(r => r.latency < 1000).length;
  const mediumQueries = results.filter(r => r.latency >= 1000 && r.latency < 5000).length;
  const slowQueries = results.filter(r => r.latency >= 5000).length;

  console.log(`\n📈 Répartition:`);
  console.log(`   - Rapide (< 1s): ${fastQueries} requêtes`);
  console.log(`   - Moyen (1-5s): ${mediumQueries} requêtes`);
  console.log(`   - Lent (> 5s): ${slowQueries} requêtes`);

  if (failCount > 0) {
    console.log(`\n❌ Routes en échec:`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.route.name}: ${r.error}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

runTests().catch(console.error);
