/**
 * Script pour tester les routes Insiders API
 * 
 * Usage:
 *   ACCESS_TOKEN="your_token" npx tsx scripts/test_insiders_routes.ts
 */

// Charger les variables d'environnement
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.local' });
} catch (e) {
  // dotenv n'est pas disponible
}

const API_BASE_URL = process.env.API_BASE_URL || 'https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || '';

if (!ACCESS_TOKEN) {
  console.error('❌ Erreur: ACCESS_TOKEN est requis');
  console.error('Usage: ACCESS_TOKEN="your_token" npx tsx scripts/test_insiders_routes.ts');
  process.exit(1);
}

interface TestResult {
  endpoint: string;
  status: number;
  success: boolean;
  data?: any;
  error?: string;
}

async function testEndpoint(method: string, path: string, queryParams?: Record<string, string>): Promise<TestResult> {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json().catch(() => ({ error: 'Invalid JSON response' }));

    return {
      endpoint: path,
      status: response.status,
      success: response.ok,
      data: data,
      error: response.ok ? undefined : (data.error || data.message || `HTTP ${response.status}`),
    };
  } catch (error: any) {
    return {
      endpoint: path,
      status: 0,
      success: false,
      error: error.message || 'Network error',
    };
  }
}

async function testAllRoutes() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TEST DES ROUTES INSIDERS API');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`📍 API URL: ${API_BASE_URL}\n`);

  const results: TestResult[] = [];

  // 1. GET /insiders/trending
  console.log('1️⃣  GET /insiders/trending');
  const trendingResult = await testEndpoint('GET', '/insiders/trending', { days: '7', limit: '20' });
  results.push(trendingResult);
  if (trendingResult.success) {
    const data = trendingResult.data as any[];
    console.log(`   ✅ Status: ${trendingResult.status}`);
    console.log(`   📊 Résultats: ${Array.isArray(data) ? data.length : 0} entreprises`);
    if (Array.isArray(data) && data.length > 0) {
      console.log(`   🏆 Top 3:`);
      data.slice(0, 3).forEach((item, i) => {
        console.log(`      ${i + 1}. ${item.ticker || 'N/A'} - Net: $${(item.net_value || 0).toLocaleString()}`);
      });
    } else {
      console.log(`   ⚠️  Aucune donnée récente (normal si pas d'achats récents)`);
    }
  } else {
    console.log(`   ❌ Status: ${trendingResult.status}`);
    console.log(`   ⚠️  Erreur: ${trendingResult.error}`);
  }
  console.log('');

  // 2. GET /insiders/company/AAPL
  console.log('2️⃣  GET /insiders/company/AAPL');
  const aaplResult = await testEndpoint('GET', '/insiders/company/AAPL', { limit: '10' });
  results.push(aaplResult);
  if (aaplResult.success) {
    const data = aaplResult.data as any[];
    console.log(`   ✅ Status: ${aaplResult.status}`);
    console.log(`   📊 Résultats: ${Array.isArray(data) ? data.length : 0} transactions`);
    if (Array.isArray(data) && data.length > 0) {
      console.log(`   📋 Exemples:`);
      data.slice(0, 3).forEach((item, i) => {
        console.log(`      ${i + 1}. ${item.insider_name || 'N/A'} - ${item.transaction_type || 'N/A'} - ${item.shares || 0} shares`);
      });
    } else {
      console.log(`   ⚠️  Aucune transaction pour AAPL (normal si pas de Form 4 récents)`);
    }
  } else {
    console.log(`   ❌ Status: ${aaplResult.status}`);
    console.log(`   ⚠️  Erreur: ${aaplResult.error}`);
  }
  console.log('');

  // 3. GET /insiders/person/{cik} - Test avec un CIK invalide
  console.log('3️⃣  GET /insiders/person/0000000000 (CIK invalide - test erreur)');
  const invalidCikResult = await testEndpoint('GET', '/insiders/person/0000000000');
  results.push(invalidCikResult);
  if (invalidCikResult.status === 200) {
    const data = invalidCikResult.data as any;
    if (data.error) {
      console.log(`   ✅ Status: ${invalidCikResult.status}`);
      console.log(`   ✅ Erreur gérée correctement: ${data.error}`);
    } else {
      console.log(`   ⚠️  Status: ${invalidCikResult.status}`);
      console.log(`   ⚠️  Pas d'erreur retournée (peut être normal si CIK existe)`);
    }
  } else {
    console.log(`   ⚠️  Status: ${invalidCikResult.status}`);
    console.log(`   ⚠️  ${invalidCikResult.error || 'Erreur HTTP'}`);
  }
  console.log('');

  // 4. GET /insiders/person/{cik} - Test avec un CIK valide (depuis les données)
  console.log('4️⃣  GET /insiders/person/{cik} (CIK valide)');
  // Récupérer un CIK valide depuis les données
  const testCikQuery = `
    SELECT DISTINCT insider_cik
    FROM insider_trades
    WHERE insider_cik IS NOT NULL
    LIMIT 1
  `;
  try {
    const { executeAthenaQuery } = require('./services/api/src/athena/query');
    const cikResults = await executeAthenaQuery(testCikQuery);
    if (cikResults && cikResults.length > 0) {
      const testCik = cikResults[0].insider_cik || cikResults[0][0] || '0002067990'; // Fallback
      const validCikResult = await testEndpoint('GET', `/insiders/person/${testCik}`);
      results.push(validCikResult);
      if (validCikResult.success) {
        const data = validCikResult.data as any;
        console.log(`   ✅ Status: ${validCikResult.status}`);
        console.log(`   👤 Insider: ${data.insider_name || 'N/A'}`);
        console.log(`   📊 Companies: ${data.total_companies || 0}`);
        console.log(`   💵 Net Value: $${(data.net_value || 0).toLocaleString()}`);
        console.log(`   📈 Transactions: ${data.transaction_count || 0}`);
      } else {
        console.log(`   ❌ Status: ${validCikResult.status}`);
        console.log(`   ⚠️  Erreur: ${validCikResult.error}`);
      }
    } else {
      console.log(`   ⚠️  Aucun CIK trouvé dans les données`);
    }
  } catch (error: any) {
    console.log(`   ⚠️  Impossible de récupérer un CIK valide: ${error.message}`);
  }
  console.log('');

  // 5. GET /insiders/signals/hot
  console.log('5️⃣  GET /insiders/signals/hot');
  const hotSignalsResult = await testEndpoint('GET', '/insiders/signals/hot', { limit: '10', min_score: '5' });
  results.push(hotSignalsResult);
  if (hotSignalsResult.success) {
    const data = hotSignalsResult.data as any[];
    console.log(`   ✅ Status: ${hotSignalsResult.status}`);
    console.log(`   📊 Résultats: ${Array.isArray(data) ? data.length : 0} signals`);
    if (Array.isArray(data) && data.length > 0) {
      console.log(`   🔥 Top Signals:`);
      data.slice(0, 5).forEach((item, i) => {
        const ticker = item.ticker || 'N/A';
        const score = item.signal_score !== undefined && item.signal_score !== null ? item.signal_score : 0;
        const name = item.insider_name || 'N/A';
        const value = item.total_value ? `$${parseFloat(item.total_value).toLocaleString()}` : 'N/A';
        const date = item.transaction_date || 'N/A';
        console.log(`      ${i + 1}. ${ticker} - ${name} - Score: ${score} - ${value} - ${date}`);
      });
    } else {
      console.log(`   ⚠️  Aucun signal détecté (normal si pas d'achats significatifs récents)`);
    }
  } else {
    console.log(`   ❌ Status: ${hotSignalsResult.status}`);
    console.log(`   ⚠️  Erreur: ${hotSignalsResult.error}`);
  }
  console.log('');

  // Résumé
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 RÉSUMÉ DES TESTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`✅ Succès: ${successCount}/${results.length}`);
  console.log(`❌ Échecs: ${failCount}/${results.length}`);
  console.log('');

  results.forEach((result, i) => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${i + 1}. ${result.endpoint} - Status: ${result.status}`);
    if (!result.success && result.error) {
      console.log(`   ⚠️  ${result.error}`);
    }
  });

  console.log('');
  console.log('💡 NOTES:');
  console.log('   - "Aucune donnée récente" est normal si pas d\'achats récents');
  console.log('   - "Aucune transaction pour AAPL" est normal si pas de Form 4 récents');
  console.log('   - "Aucun signal détecté" est normal si pas d\'achats significatifs');
  console.log('');
}

testAllRoutes().catch(console.error);
