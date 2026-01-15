/**
 * Script de test local pour le parser Form 4
 * Teste le parsing d'un Form 4 spécifique en local
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { parseForm4FromUrl } from '../services/api/src/services/form4-parser.service';

async function testForm4Parser() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TEST LOCAL DU PARSER FORM 4');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test avec le Form 4 qui échoue dans les logs
  const testCases = [
    {
      companyId: 2013,
      filingId: 1768422811013,
      accessionNumber: '0001127602-17-005429',
      cik: '0001127602',
      primaryDocument: undefined,
      description: 'Form 4 qui échoue dans les logs (CIK avec zéros)',
    },
    {
      companyId: 2013,
      filingId: 1768422811013,
      accessionNumber: '0001127602-17-005429',
      cik: '1127602',
      primaryDocument: undefined,
      description: 'Form 4 qui échoue dans les logs (CIK sans zéros)',
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.description}`);
    console.log(`   Accession Number: ${testCase.accessionNumber}`);
    console.log(`   CIK: ${testCase.cik}`);
    console.log(`   Primary Document: ${testCase.primaryDocument || 'N/A'}`);
    console.log('');

    try {
      const transactions = await parseForm4FromUrl(
        testCase.companyId,
        testCase.filingId,
        testCase.accessionNumber,
        testCase.cik,
        testCase.primaryDocument
      );

      if (transactions.length > 0) {
        console.log(`   ✅ SUCCESS: ${transactions.length} transactions trouvées`);
        console.log(`   📊 Première transaction:`);
        const first = transactions[0];
        console.log(`      - Insider: ${first.insider_name || 'N/A'}`);
        console.log(`      - Type: ${first.transaction_type || 'N/A'}`);
        console.log(`      - Shares: ${first.shares || 'N/A'}`);
        console.log(`      - Price: $${first.price_per_share || 'N/A'}`);
        console.log(`      - Total: $${first.total_value || 'N/A'}`);
        console.log(`      - Date: ${first.transaction_date || 'N/A'}`);
      } else {
        console.log(`   ⚠️  Aucune transaction trouvée`);
      }
    } catch (error: any) {
      console.error(`   ❌ ERROR: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    }

    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ TEST TERMINÉ');
  console.log('═══════════════════════════════════════════════════════════');
}

testForm4Parser().catch(console.error);
