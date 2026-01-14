/**
 * Test du cache local Lambda pour Athena
 * 
 * Usage:
 *   npx tsx scripts/test_athena_cache.ts
 */

import { cache, withCache, CacheKeys } from '../services/api/src/athena/cache';
import { getCompanyByTickerAthena } from '../services/api/src/athena/companies';

async function testCache() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 Test: Cache Local Lambda pour Athena');
  console.log('═══════════════════════════════════════════════════════════\n');

  const ticker = 'AAPL';

  console.log('📊 Test 1: Premier appel (pas de cache)\n');
  const start1 = Date.now();
  const result1 = await withCache(
    CacheKeys.companyByTicker(ticker),
    () => getCompanyByTickerAthena(ticker),
    5 * 60 * 1000
  );
  const latency1 = Date.now() - start1;
  console.log(`   ✅ Résultat: ${result1?.name || 'null'}`);
  console.log(`   ⏱️  Latence: ${latency1}ms`);
  console.log(`   📦 Cache size: ${cache.size()}\n`);

  console.log('📊 Test 2: Deuxième appel (avec cache)\n');
  const start2 = Date.now();
  const result2 = await withCache(
    CacheKeys.companyByTicker(ticker),
    () => getCompanyByTickerAthena(ticker),
    5 * 60 * 1000
  );
  const latency2 = Date.now() - start2;
  console.log(`   ✅ Résultat: ${result2?.name || 'null'}`);
  console.log(`   ⏱️  Latence: ${latency2}ms`);
  console.log(`   📦 Cache size: ${cache.size()}\n`);

  const speedup = ((latency1 - latency2) / latency1 * 100).toFixed(0);
  console.log(`\n💡 Amélioration: ${speedup}% plus rapide avec le cache\n`);

  console.log('📊 Test 3: Nettoyage du cache\n');
  cache.clear();
  console.log(`   ✅ Cache vidé`);
  console.log(`   📦 Cache size: ${cache.size()}\n`);

  console.log('═══════════════════════════════════════════════════════════\n');
}

testCache().catch(console.error);
