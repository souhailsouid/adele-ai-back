/**
 * Script pour peupler la table top_insider_signals à partir des transactions existantes
 * 
 * Usage:
 *   npx tsx scripts/populate_top_insider_signals.ts
 */

import { executeAthenaQuery } from '../services/api/src/athena/query';
import { filterTopSignals, insertTopSignals } from '../services/api/src/services/top-signals.service';

async function populateTopSignals() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 PEUPLEMENT DE LA TABLE top_insider_signals');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Récupérer toutes les transactions Purchase/Buy avec valeur > 50K
  console.log('1️⃣  Récupération des transactions éligibles...');
  const query = `
    SELECT 
      it.id,
      it.company_id,
      it.filing_id,
      it.insider_name,
      it.insider_cik,
      it.insider_title,
      it.relation,
      it.transaction_type,
      it.shares,
      it.price_per_share,
      it.total_value,
      CAST(it.transaction_date AS VARCHAR) as transaction_date
    FROM insider_trades it
    WHERE LOWER(it.transaction_type) IN ('purchase', 'buy')
      AND it.total_value IS NOT NULL
      AND it.total_value > 50000
    ORDER BY it.transaction_date DESC
  `;

  const transactions = await executeAthenaQuery(query);
  console.log(`   ✅ ${transactions.length} transactions éligibles trouvées\n`);

  if (transactions.length === 0) {
    console.log('⚠️  Aucune transaction éligible trouvée');
    console.log('💡 Les transactions doivent être de type Purchase/Buy avec valeur > $50K');
    return;
  }

  // 2. Filtrer selon les critères Golden Filter
  console.log('2️⃣  Filtrage selon les critères Golden Filter...');
  const transactionsToFilter = transactions.map((row: any) => ({
    company_id: parseInt(row.company_id || row[1] || '0', 10),
    filing_id: parseInt(row.filing_id || row[2] || '0', 10),
    insider_name: row.insider_name || row[3] || '',
    insider_cik: row.insider_cik || row[4] || undefined,
    insider_title: row.insider_title || row[5] || undefined,
    relation: row.relation || row[6] || undefined,
    transaction_type: row.transaction_type || row[7] || '',
    shares: parseInt(row.shares || row[8] || '0', 10),
    price_per_share: parseFloat(row.price_per_share || row[9] || '0'),
    total_value: parseFloat(row.total_value || row[10] || '0'),
    transaction_date: row.transaction_date || row[11] || '',
  }));

  const topSignals = filterTopSignals(transactionsToFilter);
  console.log(`   ✅ ${topSignals.length} top signals générés\n`);

  if (topSignals.length === 0) {
    console.log('⚠️  Aucun signal généré après filtrage');
    console.log('💡 Vérifiez les critères Golden Filter');
    return;
  }

  // 3. Afficher un aperçu
  console.log('3️⃣  Aperçu des signals générés:');
  topSignals.slice(0, 5).forEach((signal, i) => {
    console.log(`   ${i + 1}. ${signal.insider_name} - Score: ${signal.signal_score} - $${signal.total_value.toLocaleString()}`);
  });
  if (topSignals.length > 5) {
    console.log(`   ... et ${topSignals.length - 5} autres\n`);
  } else {
    console.log('');
  }

  // 4. Insérer dans S3
  console.log('4️⃣  Insertion dans S3...');
  try {
    await insertTopSignals(topSignals);
    console.log(`   ✅ ${topSignals.length} signals insérés avec succès\n`);
  } catch (error: any) {
    console.error(`   ❌ Erreur lors de l'insertion: ${error.message}`);
    throw error;
  }

  // 5. Vérifier l'insertion
  console.log('5️⃣  Vérification de l\'insertion...');
  try {
    // Attendre quelques secondes pour que les données soient disponibles
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const checkQuery = `SELECT COUNT(*) as total FROM top_insider_signals`;
    const checkResult = await executeAthenaQuery(checkQuery);
    const total = checkResult[0]?.total || checkResult[0]?.[0] || 0;
    
    console.log(`   ✅ Total signals dans la table: ${total}\n`);
    
    if (total === 0) {
      console.log('⚠️  La table est toujours vide');
      console.log('💡 Il peut falloir quelques minutes pour que les données soient disponibles');
      console.log('💡 Essayez de lancer: MSCK REPAIR TABLE top_insider_signals;');
    }
  } catch (error: any) {
    console.log(`   ⚠️  Impossible de vérifier: ${error.message}`);
    console.log('💡 Les données peuvent prendre quelques minutes pour être disponibles');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ TERMINÉ');
  console.log('═══════════════════════════════════════════════════════════');
}

populateTopSignals().catch(console.error);
