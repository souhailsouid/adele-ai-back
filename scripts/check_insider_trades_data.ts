/**
 * Script pour vérifier les données insider_trades dans Athena
 */

import { executeAthenaQuery } from '../services/api/src/athena/query';

async function checkData() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Vérification des données insider_trades');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Count total
    console.log('1️⃣  Count total:');
    const countResult = await executeAthenaQuery('SELECT COUNT(*) as total FROM insider_trades;');
    console.log(`   Résultat:`, countResult);
    console.log('');

    // 2. Sample data
    console.log('2️⃣  Échantillon (5 premières lignes):');
    const sampleResult = await executeAthenaQuery('SELECT * FROM insider_trades LIMIT 5;');
    console.log(`   Résultat:`, JSON.stringify(sampleResult, null, 2));
    console.log('');

    // 3. Check companies join
    console.log('3️⃣  Test jointure avec companies:');
    const joinResult = await executeAthenaQuery(`
      SELECT 
        it.id,
        it.company_id,
        it.insider_name,
        it.transaction_type,
        it.total_value,
        c.ticker,
        c.name as company_name
      FROM insider_trades it
      LEFT JOIN companies c ON it.company_id = c.id
      LIMIT 5
    `);
    console.log(`   Résultat:`, JSON.stringify(joinResult, null, 2));
    console.log('');

    // 4. Check by ticker
    console.log('4️⃣  Test par ticker (BLLN):');
    const tickerResult = await executeAthenaQuery(`
      SELECT 
        it.*,
        c.ticker,
        c.name as company_name
      FROM insider_trades it
      LEFT JOIN companies c ON it.company_id = c.id
      WHERE UPPER(TRIM(c.ticker)) = 'BLLN'
      LIMIT 5
    `);
    console.log(`   Résultat:`, JSON.stringify(tickerResult, null, 2));
    console.log('');

    // 5. Check transaction dates
    console.log('5️⃣  Dates des transactions:');
    const dateResult = await executeAthenaQuery(`
      SELECT 
        MIN(transaction_date) as min_date,
        MAX(transaction_date) as max_date,
        COUNT(*) as total
      FROM insider_trades
      WHERE transaction_date IS NOT NULL
    `);
    console.log(`   Résultat:`, JSON.stringify(dateResult, null, 2));
    console.log('');

  } catch (error: any) {
    console.error(`❌ Erreur: ${error.message}`);
    console.error(error);
  }
}

checkData().catch(console.error);
