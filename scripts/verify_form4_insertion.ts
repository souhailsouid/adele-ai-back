/**
 * Script pour vérifier que les Form 4 parsés sont bien insérés dans Athena
 * 
 * Usage:
 *   npx tsx scripts/verify_form4_insertion.ts
 */

// Charger les variables d'environnement si disponibles
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.local' });
} catch (e) {
  // dotenv n'est pas disponible, utiliser les variables d'environnement système
}

import { executeAthenaQuery } from '../services/api/src/athena/query';

async function verifyForm4Insertion() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 VÉRIFICATION DES INSERTIONS FORM 4 DANS ATHENA');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Compter le total de transactions
    console.log('📊 1. COMPTAGE TOTAL DES TRANSACTIONS\n');
    const totalQuery = `
      SELECT COUNT(*) as total
      FROM insider_trades
    `;
    const totalResult = await executeAthenaQuery(totalQuery);
    const total = totalResult[0]?.total || totalResult[0]?.[0] || 0;
    console.log(`   Total transactions dans insider_trades: ${total}\n`);

    // 2. Vérifier les transactions récentes (dernières 24h)
    console.log('📊 2. TRANSACTIONS DES DERNIÈRES 24 HEURES\n');
    const recentQuery = `
      SELECT 
        COUNT(*) as count,
        COUNT(DISTINCT company_id) as unique_companies,
        COUNT(DISTINCT insider_cik) as unique_insiders,
        MIN(transaction_date) as earliest_date,
        MAX(transaction_date) as latest_date
      FROM insider_trades
      WHERE created_at >= date_add('hour', -24, now())
    `;
    const recentResult = await executeAthenaQuery(recentQuery);
    const recent = recentResult[0];
    console.log(`   Transactions (24h): ${recent?.count || recent?.[0] || 0}`);
    console.log(`   Companies uniques: ${recent?.unique_companies || recent?.[1] || 0}`);
    console.log(`   Insiders uniques: ${recent?.unique_insiders || recent?.[2] || 0}`);
    console.log(`   Date la plus ancienne: ${recent?.earliest_date || recent?.[3] || 'N/A'}`);
    console.log(`   Date la plus récente: ${recent?.latest_date || recent?.[4] || 'N/A'}\n`);

    // 3. Vérifier les transactions avec company_id = 9999 (nos tests)
    console.log('📊 3. TRANSACTIONS DE TEST (company_id = 9999)\n');
    const testQuery = `
      SELECT 
        id,
        insider_name,
        insider_cik,
        transaction_type,
        shares,
        price_per_share,
        total_value,
        transaction_date,
        relation,
        created_at
      FROM insider_trades
      WHERE company_id = 9999
      ORDER BY created_at DESC
      LIMIT 20
    `;
    const testResult = await executeAthenaQuery(testQuery);
    console.log(`   Nombre de transactions de test trouvées: ${testResult.length}\n`);
    
    if (testResult.length > 0) {
      console.log('   Détails des transactions de test:\n');
      testResult.forEach((row: any, i: number) => {
        const id = row.id || row[0];
        const name = row.insider_name || row[1];
        const cik = row.insider_cik || row[2];
        const type = row.transaction_type || row[3];
        const shares = row.shares || row[4];
        const price = row.price_per_share || row[5];
        const total = row.total_value || row[6];
        const date = row.transaction_date || row[7];
        const relation = row.relation || row[8];
        const created = row.created_at || row[9];
        
        console.log(`   Transaction ${i + 1}:`);
        console.log(`     - ID: ${id}`);
        console.log(`     - Insider: ${name} (CIK: ${cik || 'N/A'})`);
        console.log(`     - Type: ${type}`);
        console.log(`     - Shares: ${shares}, Price: $${price}`);
        console.log(`     - Total: $${total}`);
        console.log(`     - Date: ${date}`);
        console.log(`     - Relation: ${relation || 'N/A'}`);
        console.log(`     - Created: ${created}`);
        
        // Vérifier la date
        if (date && date.toString().startsWith('1975')) {
          console.log(`     ❌ DATE 1975 DÉTECTÉE - BUG`);
        } else if (date && !date.toString().startsWith('1975')) {
          console.log(`     ✅ Date valide`);
        }
        console.log('');
      });
    } else {
      console.log('   ⚠️  Aucune transaction de test trouvée');
      console.log('   💡 Les transactions ont peut-être été insérées avec un autre company_id\n');
    }

    // 4. Vérifier la distribution par type de transaction
    console.log('📊 4. DISTRIBUTION PAR TYPE DE TRANSACTION\n');
    const typeQuery = `
      SELECT 
        transaction_type,
        COUNT(*) as count,
        SUM(total_value) as total_value_sum
      FROM insider_trades
      GROUP BY transaction_type
      ORDER BY count DESC
    `;
    const typeResult = await executeAthenaQuery(typeQuery);
    typeResult.forEach((row: any) => {
      const type = row.transaction_type || row[0];
      const count = row.count || row[1];
      const total = row.total_value_sum || row[2];
      console.log(`   ${type}: ${count} transaction(s), Total: $${total || 0}`);
    });
    console.log('');

    // 5. Vérifier les dates invalides (bug 1975)
    console.log('📊 5. VÉRIFICATION DES DATES INVALIDES (BUG 1975)\n');
    const invalidDateQuery = `
      SELECT COUNT(*) as count
      FROM insider_trades
      WHERE CAST(transaction_date AS VARCHAR) LIKE '1975-%'
    `;
    const invalidDateResult = await executeAthenaQuery(invalidDateQuery);
    const invalidCount = invalidDateResult[0]?.count || invalidDateResult[0]?.[0] || 0;
    
    if (invalidCount > 0) {
      console.log(`   ⚠️  ${invalidCount} transaction(s) avec date 1975 (BUG DÉTECTÉ)\n`);
    } else {
      console.log(`   ✅ Aucune transaction avec date 1975 (BUG CORRIGÉ)\n`);
    }

    // 6. Vérifier les partitions (année/mois)
    console.log('📊 6. DISTRIBUTION PAR PARTITION (ANNÉE/MOIS)\n');
    const partitionQuery = `
      SELECT 
        year,
        month,
        COUNT(*) as count
      FROM insider_trades
      GROUP BY year, month
      ORDER BY year DESC, month DESC
      LIMIT 10
    `;
    const partitionResult = await executeAthenaQuery(partitionQuery);
    partitionResult.forEach((row: any) => {
      const year = row.year || row[0];
      const month = row.month || row[1];
      const count = row.count || row[2];
      console.log(`   ${year}-${String(month).padStart(2, '0')}: ${count} transaction(s)`);
    });
    console.log('');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ VÉRIFICATION TERMINÉE');
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification:', error.message);
    console.error(error);
    process.exit(1);
  }
}

verifyForm4Insertion();
