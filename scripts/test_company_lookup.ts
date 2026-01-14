/**
 * Test de getCompanyByTicker avec optimisations Athena
 * 
 * Usage:
 *   npx tsx scripts/test_company_lookup.ts
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
  console.log('Usage: npx tsx scripts/test_company_lookup.ts <ACCESS_TOKEN>');
  process.exit(1);
}

interface TestResult {
  ticker: string;
  success: boolean;
  latency: number;
  method: string;
  error?: string;
  data?: any;
}

async function testCompanyLookup(ticker: string): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_BASE_URL}/companies/ticker/${ticker}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const latency = Date.now() - startTime;
    const data = await response.json();

    if (!response.ok) {
      return {
        ticker,
        success: false,
        latency,
        method: response.status === 404 ? 'Not Found' : 'Error',
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return {
      ticker,
      success: true,
      latency,
      method: 'Success',
      data: {
        id: data.id,
        name: data.name,
        sector: data.sector,
        industry: data.industry,
      },
    };
  } catch (error: any) {
    const latency = Date.now() - startTime;
    return {
      ticker,
      success: false,
      latency,
      method: 'Exception',
      error: error.message,
    };
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 Test: getCompanyByTicker avec Optimisations Athena');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 Configuration:');
  console.log(`   - API URL: ${API_BASE_URL}`);
  console.log(`   - USE_ATHENA: ${process.env.USE_ATHENA || 'false'}`);
  console.log(`   - USE_S3_WRITES: ${process.env.USE_S3_WRITES || 'false'}\n`);

  // Test avec plusieurs tickers connus
  const testTickers = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMZN', 'META', 'INVALID_TICKER'];

  console.log('🔄 Exécution des tests...\n');

  const results: TestResult[] = [];

  for (const ticker of testTickers) {
    const result = await testCompanyLookup(ticker);
    results.push(result);

    const status = result.success ? '✅' : '❌';
    const latencyColor = result.latency < 1000 ? '🟢' : result.latency < 5000 ? '🟡' : '🔴';
    
    console.log(`${status} ${ticker.padEnd(15)} ${latencyColor} ${result.latency}ms - ${result.method}`);
    
    if (result.success && result.data) {
      console.log(`      → ${result.data.name} | ${result.data.sector || 'N/A'}`);
    } else if (result.error) {
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

  // Analyse des latences
  const fastQueries = results.filter(r => r.latency < 1000).length;
  const mediumQueries = results.filter(r => r.latency >= 1000 && r.latency < 5000).length;
  const slowQueries = results.filter(r => r.latency >= 5000).length;

  console.log(`\n📈 Répartition:`);
  console.log(`   - Rapide (< 1s): ${fastQueries} requêtes`);
  console.log(`   - Moyen (1-5s): ${mediumQueries} requêtes`);
  console.log(`   - Lent (> 5s): ${slowQueries} requêtes`);

  // Recommandations
  console.log(`\n💡 Recommandations:`);
  if (avgLatency < 1000) {
    console.log(`   ✅ Excellente performance! Le cache fonctionne probablement.`);
  } else if (avgLatency < 5000) {
    console.log(`   ⚠️  Performance acceptable. Vérifier si le cache est activé.`);
  } else {
    console.log(`   ❌ Performance lente. Vérifier:`);
    console.log(`      - Le cache est-il activé?`);
    console.log(`      - USE_ATHENA=true est-il défini?`);
    console.log(`      - Les tables Athena sont-elles correctement configurées?`);
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

runTests().catch(console.error);
