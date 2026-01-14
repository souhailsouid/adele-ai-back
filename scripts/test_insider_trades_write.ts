/**
 * Script de test pour vérifier l'écriture des insider_trades dans S3
 */

import { insertRowsS3 } from '../services/api/src/athena/write';

async function testWrite() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 Test écriture insider_trades dans S3');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Données de test
  const testData = [
    {
      company_id: 1,
      filing_id: 1,
      insider_name: 'Test Insider',
      insider_cik: '0000123456',
      insider_title: 'CEO',
      relation: 'CEO',
      transaction_type: 'buy',
      shares: 1000,
      price_per_share: 100.0,
      total_value: 100000,
      transaction_date: '2026-01-14', // Date au format YYYY-MM-DD
      alert_flag: false,
    },
  ];

  try {
    console.log('📝 Données de test:');
    console.log(JSON.stringify(testData, null, 2));
    console.log('');

    console.log('💾 Écriture dans S3...');
    const result = await insertRowsS3('insider_trades', testData);
    
    console.log('✅ Succès!');
    console.log(`   S3 Key: ${result.s3Key}`);
    console.log(`   IDs: ${result.ids.join(', ')}`);
    console.log('');

    console.log('🔍 Vérification dans S3...');
    const s3KeyParts = result.s3Key.split('/');
    const bucket = 'adel-ai-dev-data-lake';
    const key = result.s3Key;
    
    console.log(`   Bucket: ${bucket}`);
    console.log(`   Key: ${key}`);
    console.log(`   URL: https://${bucket}.s3.eu-west-3.amazonaws.com/${key.replace(/=/g, '%3D')}`);
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testWrite().catch(console.error);
