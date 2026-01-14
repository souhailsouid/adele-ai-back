/**
 * Script pour réparer la table Athena et vérifier les données insider_trades
 * 
 * Utile après une synchronisation pour forcer l'indexation des nouvelles partitions
 */

import { executeAthenaQuery } from '../services/api/src/athena/query';

async function repairAndCheck() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔧 RÉPARATION ET VÉRIFICATION DE LA TABLE INSIDER_TRADES');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Réparer la table pour qu'Athena reconnaisse les nouvelles partitions
  console.log('1️⃣ Réparation de la table (MSCK REPAIR)...');
  try {
    await executeAthenaQuery('MSCK REPAIR TABLE insider_trades;');
    console.log('   ✅ Table réparée\n');
  } catch (error: any) {
    console.log(`   ⚠️ Erreur lors de la réparation: ${error.message}\n`);
    return;
  }

  // Attendre un peu pour qu'Athena indexe les nouvelles partitions
  console.log('2️⃣ Attente de 5 secondes pour l\'indexation...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('   ✅ Attente terminée\n');

  // Vérifier les données
  try {
    // Statistiques globales
    console.log('3️⃣ STATISTIQUES GLOBALES:');
    const statsQuery = `
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(DISTINCT company_id) as total_companies,
        COUNT(DISTINCT insider_cik) as total_insiders,
        SUM(CASE WHEN transaction_type = 'Purchase' THEN 1 ELSE 0 END) as purchases,
        SUM(CASE WHEN transaction_type = 'Sale' THEN 1 ELSE 0 END) as sales,
        SUM(CASE WHEN transaction_type = 'Exercise' THEN 1 ELSE 0 END) as exercises,
        SUM(CASE WHEN transaction_type = 'Grant' THEN 1 ELSE 0 END) as grants,
        SUM(total_value) as total_value,
        AVG(total_value) as avg_value,
        MAX(total_value) as max_value
      FROM insider_trades
    `;
    const statsResult = await executeAthenaQuery(statsQuery);
    if (statsResult.length > 0 && statsResult[0][0]) {
      const stats = statsResult[0];
      console.log(`   📈 Total transactions: ${stats[0]}`);
      console.log(`   🏢 Total companies: ${stats[1]}`);
      console.log(`   👤 Total insiders: ${stats[2]}`);
      console.log(`   📊 Répartition:`);
      console.log(`      - Purchases: ${stats[3]}`);
      console.log(`      - Sales: ${stats[4]}`);
      console.log(`      - Exercises: ${stats[5]}`);
      console.log(`      - Grants: ${stats[6]}`);
      console.log(`   💰 Valeurs:`);
      console.log(`      - Total: $${parseFloat(stats[7] || '0').toLocaleString()}`);
      console.log(`      - Moyenne: $${parseFloat(stats[8] || '0').toLocaleString()}`);
      console.log(`      - Maximum: $${parseFloat(stats[9] || '0').toLocaleString()}`);
    } else {
      console.log('   ⚠️ Aucune donnée trouvée (la table est peut-être vide ou les partitions ne sont pas encore indexées)');
    }
    console.log('');

    // Détails par company
    console.log('4️⃣ DÉTAILS PAR COMPANY:');
    const companiesQuery = `
      SELECT 
        c.ticker,
        c.name as company_name,
        COUNT(*) as transaction_count,
        SUM(CASE WHEN it.transaction_type = 'Purchase' THEN 1 ELSE 0 END) as purchases,
        SUM(CASE WHEN it.transaction_type = 'Sale' THEN 1 ELSE 0 END) as sales,
        SUM(it.total_value) as total_value,
        MAX(CAST(it.created_at AS VARCHAR)) as last_transaction
      FROM insider_trades it
      LEFT JOIN companies c ON it.company_id = c.id
      GROUP BY c.ticker, c.name
      ORDER BY transaction_count DESC
      LIMIT 20
    `;
    const companiesResult = await executeAthenaQuery(companiesQuery);
    if (companiesResult.length > 0 && companiesResult[0][0]) {
      companiesResult.forEach((row: any, index: number) => {
        console.log(`\n   ${index + 1}. ${row[0] || 'N/A'} - ${row[1] || 'Unknown Company'}`);
        console.log(`      📊 ${row[2]} transactions (${row[3]} purchases, ${row[4]} sales)`);
        console.log(`      💰 Total value: $${parseFloat(row[5] || '0').toLocaleString()}`);
        console.log(`      🕐 Last: ${row[6] || 'N/A'}`);
      });
    } else {
      console.log('   ⚠️ Aucune donnée trouvée');
    }
    console.log('');

    // Transactions récentes
    console.log('5️⃣ TRANSACTIONS RÉCENTES (top 30):');
    const recentQuery = `
      SELECT 
        it.id,
        c.ticker,
        c.name as company_name,
        it.insider_name,
        it.insider_cik,
        it.transaction_type,
        it.shares,
        it.price_per_share,
        it.total_value,
        CAST(it.transaction_date AS VARCHAR) as transaction_date,
        CAST(it.created_at AS VARCHAR) as created_at,
        it.filing_id
      FROM insider_trades it
      LEFT JOIN companies c ON it.company_id = c.id
      ORDER BY it.created_at DESC
      LIMIT 30
    `;
    const recentResult = await executeAthenaQuery(recentQuery);
    if (recentResult.length > 0 && recentResult[0][0]) {
      recentResult.forEach((row: any, index: number) => {
        console.log(`\n   Transaction ${index + 1}:`);
        console.log(`      🏢 Company: ${row[1] || 'N/A'} - ${row[2] || 'Unknown'}`);
        console.log(`      👤 Insider: ${row[3] || 'Unknown'} (CIK: ${row[4] || 'N/A'})`);
        console.log(`      📊 Type: ${row[5] || 'N/A'}`);
        console.log(`      📈 Shares: ${row[6] ? parseInt(row[6], 10).toLocaleString() : 'N/A'}`);
        console.log(`      💵 Price: $${row[7] ? parseFloat(row[7]).toFixed(2) : '0.00'}`);
        console.log(`      💰 Total: $${row[8] ? parseFloat(row[8]).toLocaleString() : '0'}`);
        console.log(`      📅 Transaction Date: ${row[9] || 'N/A'}`);
        console.log(`      🕐 Created At: ${row[10] || 'N/A'}`);
        console.log(`      📄 Filing ID: ${row[11] || 'N/A'}`);
      });
    } else {
      console.log('   ⚠️ Aucune transaction trouvée');
    }
    console.log('');

    // Filings
    console.log('6️⃣ FILINGS RÉCENTS (Form 4, top 20):');
    const filingsQuery = `
      SELECT 
        cf.accession_number,
        c.ticker,
        c.name as company_name,
        CAST(cf.filing_date AS VARCHAR) as filing_date,
        CAST(cf.created_at AS VARCHAR) as created_at,
        COUNT(it.id) as transaction_count
      FROM company_filings cf
      LEFT JOIN companies c ON cf.company_id = c.id
      LEFT JOIN insider_trades it ON it.filing_id = cf.id
      WHERE cf.form_type = '4'
      GROUP BY cf.accession_number, c.ticker, c.name, cf.filing_date, cf.created_at
      ORDER BY cf.created_at DESC
      LIMIT 20
    `;
    const filingsResult = await executeAthenaQuery(filingsQuery);
    if (filingsResult.length > 0 && filingsResult[0][0]) {
      filingsResult.forEach((row: any, index: number) => {
        console.log(`   ${index + 1}. ${row[0] || 'N/A'}`);
        console.log(`      🏢 ${row[1] || 'N/A'} - ${row[2] || 'Unknown'}`);
        console.log(`      📅 Filing Date: ${row[3] || 'N/A'}`);
        console.log(`      📊 ${row[5] || 0} transactions`);
        console.log(`      🕐 Created: ${row[4] || 'N/A'}`);
      });
    } else {
      console.log('   ⚠️ Aucun filing trouvé');
    }
    console.log('');

  } catch (error: any) {
    console.error(`❌ Erreur lors de la vérification: ${error.message}`);
    console.error(error);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ ANALYSE TERMINÉE');
  console.log('═══════════════════════════════════════════════════════════');
}

repairAndCheck().catch(console.error);
