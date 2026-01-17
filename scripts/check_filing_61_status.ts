/**
 * Script pour vérifier le statut du filing ID 61 après re-parsing
 * 
 * Usage:
 *   npx tsx scripts/check_filing_61_status.ts
 */

import { executeAthenaQuery } from '../services/api/src/athena/query.js';

async function checkFiling61Status() {
  console.log('🔍 Vérification du statut du filing ID 61...\n');

  // 1. Vérifier le filing
  const filingQuery = `
    SELECT 
      cf.id,
      cf.accession_number,
      cf.filing_date,
      cf.period_of_report,
      cf.status,
      c.ticker,
      c.name as company_name
    FROM company_filings cf
    LEFT JOIN companies c ON cf.company_id = c.id
    WHERE cf.id = 61
    LIMIT 1
  `;

  console.log('📋 Informations du filing:');
  const filingResults = await executeAthenaQuery(filingQuery);
  if (filingResults.length > 0) {
    const filing = filingResults[0];
    console.log(`   ID: ${filing.id}`);
    console.log(`   Accession Number: ${filing.accession_number}`);
    console.log(`   Filing Date: ${filing.filing_date}`);
    console.log(`   Period of Report: ${filing.period_of_report || 'NULL ⚠️'}`);
    console.log(`   Status: ${filing.status}`);
    console.log(`   Company: ${filing.company_name} (${filing.ticker})`);
  } else {
    console.log('   ❌ Filing ID 61 non trouvé');
    return;
  }

  // 2. Compter les transactions
  const transactionCountQuery = `
    SELECT COUNT(*) as count
    FROM insider_trades
    WHERE filing_id = 61
  `;

  console.log('\n📊 Transactions:');
  const countResults = await executeAthenaQuery(transactionCountQuery);
  const transactionCount = parseInt(countResults[0]?.count || '0', 10);
  console.log(`   Nombre de transactions: ${transactionCount}`);

  if (transactionCount > 0) {
    console.log(`   ✅ Transactions trouvées!`);
    
    // 3. Afficher un échantillon des transactions
    const sampleQuery = `
      SELECT 
        insider_name,
        transaction_type,
        shares,
        price_per_share,
        total_value,
        transaction_date
      FROM insider_trades
      WHERE filing_id = 61
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT 5
    `;

    console.log('\n📋 Échantillon des transactions (5 premières):');
    const sampleResults = await executeAthenaQuery(sampleQuery);
    sampleResults.forEach((tx: any, index: number) => {
      console.log(`   ${index + 1}. ${tx.insider_name || 'Unknown'}`);
      console.log(`      Type: ${tx.transaction_type || 'N/A'}`);
      console.log(`      Shares: ${tx.shares?.toLocaleString() || 'N/A'}`);
      console.log(`      Price: $${tx.price_per_share?.toFixed(2) || 'N/A'}`);
      console.log(`      Total: $${tx.total_value?.toLocaleString() || 'N/A'}`);
      console.log(`      Date: ${tx.transaction_date || 'N/A'}`);
      console.log('');
    });
  } else {
    console.log(`   ⚠️  Aucune transaction trouvée`);
    console.log(`   Le parsing n'a peut-être pas encore été traité ou a échoué.`);
    console.log(`   Vérifiez les logs CloudWatch: /aws/lambda/adel-ai-dev-form4-parser`);
  }

  // 4. Résumé
  console.log('\n📊 RÉSUMÉ:');
  const filing = filingResults[0];
  const hasPeriodOfReport = filing.period_of_report !== null && filing.period_of_report !== undefined;
  const hasTransactions = transactionCount > 0;
  const isParsed = filing.status === 'PARSED';

  console.log(`   Period of Report: ${hasPeriodOfReport ? '✅' : '❌'} ${filing.period_of_report || 'NULL'}`);
  console.log(`   Transactions: ${hasTransactions ? '✅' : '❌'} ${transactionCount} transaction(s)`);
  console.log(`   Status: ${isParsed ? '✅' : '❌'} ${filing.status}`);

  if (hasPeriodOfReport && hasTransactions && isParsed) {
    console.log('\n✅ SUCCÈS: Le filing a été correctement parsé!');
  } else {
    console.log('\n⚠️  ATTENTION: Le parsing n\'est pas complet.');
    if (!hasPeriodOfReport) {
      console.log('   - period_of_report est NULL');
    }
    if (!hasTransactions) {
      console.log('   - Aucune transaction trouvée');
    }
    if (!isParsed) {
      console.log(`   - Status est "${filing.status}" au lieu de "PARSED"`);
    }
    console.log('\n💡 Vérifiez les logs CloudWatch pour plus de détails.');
  }
}

checkFiling61Status()
  .then(() => {
    console.log('\n✅ Vérification terminée');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  });
