import { executeAthenaQuery } from '../services/api/src/athena/query';

/**
 * Script pour nettoyer les transactions avec date 1975 (erreur de parsing)
 */
async function clean1975Transactions() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧹 NETTOYAGE DES TRANSACTIONS AVEC DATE 1975');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Compter les transactions avec date 1975
    console.log('1️⃣ Comptage des transactions avec date 1975...');
    const countQuery = `
      SELECT COUNT(*) as count
      FROM insider_trades
      WHERE CAST(transaction_date AS VARCHAR) LIKE '1975-%'
    `;
    const countResult = await executeAthenaQuery(countQuery);
    const count = countResult[0]?.count || countResult[0]?.[0] || 0;
    console.log(`   📊 Total: ${count} transactions avec date 1975\n`);

    if (count === 0) {
      console.log('✅ Aucune transaction avec date 1975 trouvée.');
      return;
    }

    // 2. Afficher quelques exemples
    console.log('2️⃣ Exemples de transactions à supprimer (5 premières):');
    const examplesQuery = `
      SELECT 
        id,
        insider_name,
        transaction_date,
        created_at,
        company_id
      FROM insider_trades
      WHERE CAST(transaction_date AS VARCHAR) LIKE '1975-%'
      ORDER BY created_at DESC
      LIMIT 5
    `;
    const examples = await executeAthenaQuery(examplesQuery);
    if (examples.length > 0) {
      examples.forEach((row: any, index: number) => {
        const id = row.id || row[0];
        const name = row.insider_name || row[1];
        const date = row.transaction_date || row[2];
        const created = row.created_at || row[3];
        const companyId = row.company_id || row[4];
        console.log(`\n   ${index + 1}. ID: ${id}`);
        console.log(`      Insider: ${name}`);
        console.log(`      Date: ${date}`);
        console.log(`      Créé: ${created}`);
        console.log(`      Company ID: ${companyId}`);
      });
    }
    console.log('');

    // 3. Note importante : Athena ne supporte pas DELETE directement
    console.log('⚠️  IMPORTANT: Athena ne supporte pas DELETE directement.');
    console.log('   Les données sont stockées dans S3 en format Parquet.');
    console.log('   Pour supprimer ces données, il faut:');
    console.log('   1. Identifier les fichiers Parquet concernés');
    console.log('   2. Les supprimer de S3');
    console.log('   3. Exécuter MSCK REPAIR TABLE pour mettre à jour les métadonnées\n');

    // 4. Lister les partitions concernées
    console.log('3️⃣ Partitions concernées (année/mois):');
    const partitionsQuery = `
      SELECT DISTINCT
        year,
        month,
        COUNT(*) as count
      FROM insider_trades
      WHERE CAST(transaction_date AS VARCHAR) LIKE '1975-%'
      GROUP BY year, month
      ORDER BY year, month
    `;
    const partitions = await executeAthenaQuery(partitionsQuery);
    if (partitions.length > 0) {
      partitions.forEach((row: any) => {
        const year = row.year || row[0];
        const month = row.month || row[1];
        const count = row.count || row[2];
        console.log(`   - year=${year}/month=${month}: ${count} transactions`);
      });
    } else {
      console.log('   ⚠️  Impossible de déterminer les partitions (peut-être que year/month sont NULL)');
    }
    console.log('');

    // 5. Alternative : Créer une vue qui exclut les dates 1975
    console.log('💡 SOLUTION RECOMMANDÉE:');
    console.log('   Créer une vue Athena qui filtre les dates 1975:');
    console.log('   CREATE OR REPLACE VIEW insider_trades_clean AS');
    console.log('   SELECT * FROM insider_trades');
    console.log('   WHERE CAST(transaction_date AS VARCHAR) NOT LIKE \'1975-%\';');
    console.log('');
    console.log('   Puis utiliser cette vue dans vos requêtes au lieu de la table.');
    console.log('');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ANALYSE TERMINÉE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('📝 PROCHAINES ÉTAPES:');
    console.log('   1. Vérifier les fichiers S3 concernés');
    console.log('   2. Supprimer les fichiers Parquet avec dates 1975');
    console.log('   3. Exécuter: MSCK REPAIR TABLE insider_trades;');
    console.log('   4. Ou créer une vue filtrée (recommandé)');

  } catch (error: any) {
    console.error('❌ Erreur lors du nettoyage:', error.message);
    console.error(error);
    process.exit(1);
  }
}

clean1975Transactions();
