/**
 * Script pour vérifier que les nouvelles transactions (dernières 3h) sont correctement parsées
 * 
 * Vérifie:
 * - Dates valides (pas de 1975)
 * - Types normalisés (buy/sell au lieu de purchase/sale)
 * - Prix correctement extraits
 * - Données complètes
 */

import { executeAthenaQuery } from '../services/api/src/athena/query';

async function checkNewTransactions() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 VÉRIFICATION DES NOUVELLES TRANSACTIONS (3 dernières heures)');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Compter les transactions des dernières 3 heures
    console.log('1️⃣ Transactions des dernières 3 heures...');
    const recentCountQuery = `
      SELECT COUNT(*) as count
      FROM insider_trades
      WHERE created_at >= date_add('hour', -3, now())
    `;
    const recentCountResult = await executeAthenaQuery(recentCountQuery);
    const recentCount = parseInt(recentCountResult[0]?.count || '0', 10);
    console.log(`   📊 Total: ${recentCount} transactions\n`);

    // Si pas de transactions récentes, vérifier les dernières 24h ou les 100 plus récentes
    let timeWindow = '3 heures';
    let timeFilter = `created_at >= date_add('hour', -3, now())`;
    
    if (recentCount === 0) {
      console.log('   ⚠️  Aucune transaction dans les 3 dernières heures.');
      console.log('   💡 Vérification des transactions des dernières 24h...\n');
      
      const last24hQuery = `
        SELECT COUNT(*) as count
        FROM insider_trades
        WHERE created_at >= date_add('hour', -24, now())
      `;
      const last24hResult = await executeAthenaQuery(last24hQuery);
      const last24hCount = parseInt(last24hResult[0]?.count || '0', 10);
      
      if (last24hCount > 0) {
        timeWindow = '24 heures';
        timeFilter = `created_at >= date_add('hour', -24, now())`;
        console.log(`   📊 Transactions des dernières 24h: ${last24hCount}`);
        console.log(`   ✅ Utilisation de la fenêtre 24h pour l'analyse\n`);
      } else {
        // Utiliser les 100 transactions les plus récentes
        timeWindow = '100 transactions les plus récentes';
        timeFilter = `id IN (SELECT id FROM insider_trades ORDER BY created_at DESC LIMIT 100)`;
        console.log(`   📊 Analyse des 100 transactions les plus récentes\n`);
      }
    }

    // Compter le total pour les calculs de pourcentage
    const totalCountQuery = `SELECT COUNT(*) as count FROM insider_trades WHERE ${timeFilter}`;
    const totalCountResult = await executeAthenaQuery(totalCountQuery);
    const totalCount = parseInt(totalCountResult[0]?.count || '0', 10);
    
    if (totalCount === 0) {
      console.log('   ⚠️  Aucune transaction trouvée dans la fenêtre sélectionnée.');
      return;
    }

    // 2. Vérifier les dates (pas de 1975)
    console.log(`2️⃣ Vérification des dates (bug 1975) - Fenêtre: ${timeWindow}...`);
    const dateBugQuery = `
      SELECT COUNT(*) as count
      FROM insider_trades
      WHERE ${timeFilter}
        AND CAST(transaction_date AS VARCHAR) LIKE '1975%'
    `;
    const dateBugResult = await executeAthenaQuery(dateBugQuery);
    const dateBugCount = parseInt(dateBugResult[0]?.count || '0', 10);
    const dateBugPercentage = totalCount > 0 ? ((dateBugCount / totalCount) * 100).toFixed(2) : '0.00';
    
    if (dateBugCount === 0) {
      console.log(`   ✅ Aucune date 1975 détectée (${dateBugCount}/${recentCount})`);
    } else {
      console.log(`   ❌ ${dateBugCount} transactions avec date 1975 (${dateBugPercentage}%)`);
    }
    console.log('');

    // 3. Vérifier les types normalisés
    console.log('3️⃣ Vérification des types de transaction (normalisation)...');
    const typeCheckQuery = `
      SELECT 
        transaction_type,
        COUNT(*) as count
      FROM insider_trades
      WHERE ${timeFilter}
        AND transaction_type IS NOT NULL
      GROUP BY transaction_type
      ORDER BY count DESC
    `;
    const typeCheckResult = await executeAthenaQuery(typeCheckQuery);
    
    const normalizedTypes = ['buy', 'sell', 'exercise', 'grant', 'conversion', 'payment', 'gift', 'disposition', 'other'];
    const problematicTypes: string[] = [];
    
    typeCheckResult.forEach((row: any) => {
      const type = row.transaction_type?.toLowerCase() || '';
      const count = parseInt(row.count || '0', 10);
      
      if (!normalizedTypes.includes(type) && !type.includes('other')) {
        problematicTypes.push(type);
        console.log(`   ⚠️  Type non normalisé: "${row.transaction_type}" (${count} transactions)`);
      } else {
        console.log(`   ✅ Type normalisé: "${row.transaction_type}" (${count} transactions)`);
      }
    });
    
    if (problematicTypes.length === 0) {
      console.log(`   ✅ Tous les types sont normalisés`);
    }
    console.log('');

    // 4. Vérifier les prix (pas tous à 0)
    console.log('4️⃣ Vérification des prix (extraction)...');
    const priceCheckQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN price_per_share > 0 THEN 1 END) as with_price,
        COUNT(CASE WHEN price_per_share = 0 THEN 1 END) as zero_price,
        AVG(price_per_share) as avg_price
      FROM insider_trades
      WHERE ${timeFilter}
    `;
    const priceCheckResult = await executeAthenaQuery(priceCheckQuery);
    const total = parseInt(priceCheckResult[0]?.total || '0', 10);
    const withPrice = parseInt(priceCheckResult[0]?.with_price || '0', 10);
    const zeroPrice = parseInt(priceCheckResult[0]?.zero_price || '0', 10);
    const avgPrice = parseFloat(priceCheckResult[0]?.avg_price || '0');
    
    console.log(`   📊 Transactions avec prix > 0: ${withPrice}/${total} (${((withPrice / total) * 100).toFixed(2)}%)`);
    console.log(`   📊 Transactions avec prix = 0: ${zeroPrice}/${total} (${((zeroPrice / total) * 100).toFixed(2)}%)`);
    console.log(`   📊 Prix moyen: $${avgPrice.toFixed(2)}`);
    
    // Note: Les prix à 0 sont normaux pour grants, conversions, etc.
    if (withPrice > 0) {
      console.log(`   ✅ Prix correctement extraits pour les transactions monétaires`);
    } else {
      console.log(`   ⚠️  Tous les prix sont à 0 (peut être normal pour certains types)`);
    }
    console.log('');

    // 5. Exemples de transactions récentes
    console.log('5️⃣ Exemples de transactions récentes (10 dernières)...');
    const examplesQuery = `
      SELECT 
        id,
        insider_name,
        insider_cik,
        transaction_type,
        shares,
        price_per_share,
        total_value,
        transaction_date,
        created_at,
        company_id
      FROM insider_trades
      WHERE ${timeFilter}
      ORDER BY created_at DESC
      LIMIT 10
    `;
    const examples = await executeAthenaQuery(examplesQuery);
    
    examples.forEach((row: any, index: number) => {
      console.log(`\n   Transaction ${index + 1}:`);
      console.log(`   - ID: ${row.id}`);
      console.log(`   - Insider: ${row.insider_name || 'NULL'} (CIK: ${row.insider_cik || 'NULL'})`);
      console.log(`   - Type: ${row.transaction_type || 'NULL'}`);
      console.log(`   - Shares: ${row.shares || 'NULL'}`);
      console.log(`   - Price: $${row.price_per_share || 'NULL'}`);
      console.log(`   - Total: $${row.total_value || 'NULL'}`);
      console.log(`   - Date transaction: ${row.transaction_date || 'NULL'}`);
      console.log(`   - Date création: ${row.created_at || 'NULL'}`);
      console.log(`   - Company ID: ${row.company_id || 'NULL'}`);
      
      // Vérifications spécifiques
      const issues: string[] = [];
      if (row.transaction_date?.startsWith('1975')) {
        issues.push('❌ Date 1975');
      }
      if (row.transaction_type && !normalizedTypes.includes(row.transaction_type.toLowerCase())) {
        issues.push(`⚠️  Type non normalisé: ${row.transaction_type}`);
      }
      if (issues.length > 0) {
        console.log(`   ${issues.join(', ')}`);
      } else {
        console.log(`   ✅ Parsing correct`);
      }
    });
    console.log('');

    // 6. Résumé
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 RÉSUMÉ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   📊 Fenêtre analysée: ${timeWindow}`);
    console.log(`   📊 Transactions analysées: ${totalCount}`);
    console.log(`   ${dateBugCount === 0 ? '✅' : '❌'} Dates 1975: ${dateBugCount} (${dateBugPercentage}%)`);
    console.log(`   ${problematicTypes.length === 0 ? '✅' : '⚠️'} Types normalisés: ${problematicTypes.length === 0 ? 'Oui' : `Non (${problematicTypes.length} types problématiques)`}`);
    console.log(`   ${withPrice > 0 ? '✅' : '⚠️'} Prix extraits: ${withPrice}/${total} (${((withPrice / total) * 100).toFixed(2)}%)`);
    console.log('');
    
    if (dateBugCount === 0 && problematicTypes.length === 0) {
      console.log('   ✅ Les transactions analysées sont correctement parsées !');
    } else {
      console.log('   ⚠️  Certains problèmes détectés dans les transactions analysées.');
      if (dateBugCount > 0) {
        console.log(`      - ${dateBugCount} transactions avec dates 1975 (bug de parsing)`);
      }
      if (problematicTypes.length > 0) {
        console.log(`      - Types non normalisés: ${problematicTypes.join(', ')}`);
      }
    }
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkNewTransactions();
