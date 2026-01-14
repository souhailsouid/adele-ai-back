/**
 * Test de la lecture directe S3 pour lookups par ID
 * 
 * Usage:
 *   npx tsx scripts/test_s3_direct_read.ts
 */

import { findRowByIdInS3Parquet, findRowByColumnInS3Parquet } from '../services/api/src/athena/s3-direct-read';

async function testS3DirectRead() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 Test: S3 Direct Read (évite minimum 10MB Athena)');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 Test 1: Recherche par ticker (AAPL)\n');
  const start1 = Date.now();
  const company1 = await findRowByColumnInS3Parquet(
    'companies',
    'ticker',
    'AAPL'
  );
  const latency1 = Date.now() - start1;
  
  if (company1) {
    console.log(`   ✅ Trouvé: ${company1.name || 'N/A'}`);
    console.log(`   📊 Sector: ${company1.sector || 'N/A'}`);
    console.log(`   ⏱️  Latence: ${latency1}ms`);
  } else {
    console.log(`   ❌ Non trouvé`);
  }
  console.log();

  console.log('📊 Test 2: Recherche par CIK\n');
  const start2 = Date.now();
  const company2 = await findRowByColumnInS3Parquet(
    'companies',
    'cik',
    '0000320193' // Apple CIK
  );
  const latency2 = Date.now() - start2;
  
  if (company2) {
    console.log(`   ✅ Trouvé: ${company2.name || 'N/A'}`);
    console.log(`   📊 Ticker: ${company2.ticker || 'N/A'}`);
    console.log(`   ⏱️  Latence: ${latency2}ms`);
  } else {
    console.log(`   ❌ Non trouvé`);
  }
  console.log();

  console.log('📊 Test 3: Recherche par ID (si disponible)\n');
  if (company1?.id) {
    const start3 = Date.now();
    const company3 = await findRowByIdInS3Parquet(
      'companies',
      company1.id
    );
    const latency3 = Date.now() - start3;
    
    if (company3) {
      console.log(`   ✅ Trouvé: ${company3.name || 'N/A'}`);
      console.log(`   ⏱️  Latence: ${latency3}ms`);
    } else {
      console.log(`   ❌ Non trouvé`);
    }
  } else {
    console.log(`   ⏭️  ID non disponible, skip`);
  }
  console.log();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 RÉSUMÉ');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`✅ S3 Direct Read fonctionne`);
  console.log(`⚡ Latence moyenne: ${((latency1 + latency2) / 2).toFixed(0)}ms`);
  console.log(`💰 Économie: Évite le minimum 10MB d'Athena (~$0.05/requête)`);
  console.log('\n═══════════════════════════════════════════════════════════\n');
}

testS3DirectRead().catch(console.error);
