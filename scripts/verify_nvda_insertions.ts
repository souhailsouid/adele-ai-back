/**
 * Vérifier les insertions NVIDIA dans Athena
 */

import { executeAthenaQuery } from '../services/api/src/athena/query.js';

async function verifyInsertions() {
  console.log('🔍 Vérification des insertions NVIDIA dans Athena...\n');

  try {
    // Vérifier les filings récents
    const filingsQuery = `
      SELECT 
        cf.id,
        cf.accession_number,
        CAST(cf.filing_date AS VARCHAR) as filing_date,
        CAST(cf.created_at AS VARCHAR) as created_at,
        cf.status,
        COUNT(it.id) as transaction_count,
        SUM(it.total_value) as total_value_sum
      FROM company_filings cf
      LEFT JOIN insider_trades it ON cf.id = it.filing_id
      WHERE cf.company_id = 1
        AND cf.form_type = '4'
        AND cf.created_at >= timestamp '2026-01-09 22:00:00'
      GROUP BY cf.id, cf.accession_number, cf.filing_date, cf.created_at, cf.status
      ORDER BY cf.created_at DESC
      LIMIT 15
    `;

    const filings = await executeAthenaQuery(filingsQuery);

    console.log(`📊 ${filings.length} filings récents trouvés:\n`);

    let totalTransactions = 0;
    let totalValue = 0;
    let parsedCount = 0;
    let failedCount = 0;

    for (const filing of filings) {
      const txCount = parseInt(filing.transaction_count || '0', 10);
      const txValue = parseFloat(filing.total_value_sum || '0');
      totalTransactions += txCount;
      totalValue += txValue;

      const statusIcon = filing.status === 'PARSED' ? '✅' : filing.status === 'FAILED' ? '❌' : '⏳';
      if (filing.status === 'PARSED' || txCount > 0) parsedCount++;
      if (filing.status === 'FAILED' && txCount === 0) failedCount++;

      console.log(`${statusIcon} ${filing.accession_number}`);
      console.log(`   Status: ${filing.status} | Transactions: ${txCount} | Value: $${txValue.toLocaleString()}`);
      console.log(`   Created: ${filing.created_at}\n`);
    }

    console.log('='.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(60));
    console.log(`Total filings: ${filings.length}`);
    console.log(`✅ Avec transactions: ${parsedCount}`);
    console.log(`❌ Sans transactions: ${failedCount}`);
    console.log(`📊 Transactions totales: ${totalTransactions}`);
    console.log(`💰 Valeur totale: $${totalValue.toLocaleString()}`);
    console.log('='.repeat(60));

    // Vérifier les transactions récentes
    const transactionsQuery = `
      SELECT 
        COUNT(*) as count,
        SUM(total_value) as total_value_sum,
        MAX(transaction_date) as last_transaction_date
      FROM insider_trades it
      INNER JOIN company_filings cf ON it.filing_id = cf.id
      WHERE cf.company_id = 1
        AND it.created_at >= timestamp '2026-01-09 22:00:00'
    `;

    const txResults = await executeAthenaQuery(transactionsQuery);
    
    if (txResults.length > 0) {
      const tx = txResults[0];
      console.log('\n💼 Transactions récentes (depuis 22h00):');
      console.log(`   • Nombre: ${tx.count}`);
      console.log(`   • Valeur totale: $${parseFloat(tx.total_value_sum || '0').toLocaleString()}`);
      console.log(`   • Dernière transaction: ${tx.last_transaction_date}`);
    }

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

verifyInsertions().catch(console.error);
