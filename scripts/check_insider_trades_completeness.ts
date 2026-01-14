/**
 * Script pour vérifier la complétude des données insider_trades
 * 
 * Vérifie:
 * - Nombre total de transactions
 * - Champs manquants (NULL)
 * - Distribution par date
 * - Exemples de transactions récentes
 */

// Utiliser la fonction executeAthenaQuery existante
import { executeAthenaQuery } from '../services/api/src/athena/query';

async function checkCompleteness() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 VÉRIFICATION COMPLÉTUDE DES DONNÉES INSIDER_TRADES');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Nombre total de transactions
    console.log('1️⃣ Nombre total de transactions...');
    const totalQuery = `SELECT COUNT(*) as total FROM insider_trades`;
    const totalResult = await executeAthenaQuery(totalQuery);
    const total = totalResult[0]?.total || 0;
    console.log(`   ✅ Total: ${total} transactions\n`);

    if (total === 0) {
      console.log('   ⚠️  Aucune transaction trouvée. Vérifiez que les données sont bien écrites en S3.');
      return;
    }

    // 2. Vérifier les champs manquants
    console.log('2️⃣ Vérification des champs manquants (NULL)...');
    const nullChecks = [
      { field: 'insider_name', query: `SELECT COUNT(*) as count FROM insider_trades WHERE insider_name IS NULL` },
      { field: 'insider_cik', query: `SELECT COUNT(*) as count FROM insider_trades WHERE insider_cik IS NULL` },
      { field: 'transaction_type', query: `SELECT COUNT(*) as count FROM insider_trades WHERE transaction_type IS NULL` },
      { field: 'shares', query: `SELECT COUNT(*) as count FROM insider_trades WHERE shares IS NULL OR shares = 0` },
      { field: 'price_per_share', query: `SELECT COUNT(*) as count FROM insider_trades WHERE price_per_share IS NULL` },
      { field: 'total_value', query: `SELECT COUNT(*) as count FROM insider_trades WHERE total_value IS NULL` },
      { field: 'transaction_date', query: `SELECT COUNT(*) as count FROM insider_trades WHERE transaction_date IS NULL` },
    ];

    for (const check of nullChecks) {
      const result = await executeAthenaQuery(check.query);
      const count = parseInt(result[0]?.count || '0', 10);
      const percentage = total > 0 ? ((count / total) * 100).toFixed(2) : '0.00';
      const status = count === 0 ? '✅' : count < total * 0.1 ? '⚠️' : '❌';
      console.log(`   ${status} ${check.field}: ${count} NULL (${percentage}%)`);
    }
    console.log('');

    // 3. Distribution par date
    console.log('3️⃣ Distribution par date (10 dernières dates)...');
    const dateDistributionQuery = `
      SELECT 
        transaction_date,
        COUNT(*) as count
      FROM insider_trades
      WHERE transaction_date IS NOT NULL
      GROUP BY transaction_date
      ORDER BY transaction_date DESC
      LIMIT 10
    `;
    const dateDistribution = await executeAthenaQuery(dateDistributionQuery);
    dateDistribution.forEach((row: any) => {
      console.log(`   📅 ${row.transaction_date}: ${row.count} transactions`);
    });
    console.log('');

    // 4. Exemples de transactions récentes
    console.log('4️⃣ Exemples de transactions récentes (5 dernières)...');
    const recentQuery = `
      SELECT 
        id,
        insider_name,
        insider_cik,
        transaction_type,
        shares,
        price_per_share,
        total_value,
        transaction_date,
        company_id
      FROM insider_trades
      ORDER BY created_at DESC
      LIMIT 5
    `;
    const recent = await executeAthenaQuery(recentQuery);
    recent.forEach((row: any, index: number) => {
      console.log(`\n   Transaction ${index + 1}:`);
      console.log(`   - ID: ${row.id}`);
      console.log(`   - Insider: ${row.insider_name || 'NULL'} (CIK: ${row.insider_cik || 'NULL'})`);
      console.log(`   - Type: ${row.transaction_type || 'NULL'}`);
      console.log(`   - Shares: ${row.shares || 'NULL'}`);
      console.log(`   - Price: $${row.price_per_share || 'NULL'}`);
      console.log(`   - Total: $${row.total_value || 'NULL'}`);
      console.log(`   - Date: ${row.transaction_date || 'NULL'}`);
      console.log(`   - Company ID: ${row.company_id || 'NULL'}`);
    });
    console.log('');

    // 5. Statistiques par type de transaction
    console.log('5️⃣ Distribution par type de transaction...');
    const typeDistributionQuery = `
      SELECT 
        transaction_type,
        COUNT(*) as count,
        AVG(total_value) as avg_value,
        SUM(total_value) as total_value_sum
      FROM insider_trades
      WHERE transaction_type IS NOT NULL
      GROUP BY transaction_type
      ORDER BY count DESC
    `;
    const typeDistribution = await executeAthenaQuery(typeDistributionQuery);
    typeDistribution.forEach((row: any) => {
      console.log(`   📊 ${row.transaction_type}: ${row.count} transactions, avg: $${parseFloat(row.avg_value || '0').toFixed(2)}, total: $${parseFloat(row.total_value_sum || '0').toFixed(2)}`);
    });
    console.log('');

    // 6. Vérifier les partitions
    console.log('6️⃣ Vérification des partitions S3...');
    const partitionQuery = `
      SELECT DISTINCT 
        year,
        month,
        COUNT(*) as count
      FROM insider_trades
      GROUP BY year, month
      ORDER BY year DESC, month DESC
      LIMIT 10
    `;
    const partitions = await executeAthenaQuery(partitionQuery);
    partitions.forEach((row: any) => {
      console.log(`   📁 year=${row.year}/month=${row.month}: ${row.count} transactions`);
    });
    console.log('');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ VÉRIFICATION TERMINÉE');
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkCompleteness();
