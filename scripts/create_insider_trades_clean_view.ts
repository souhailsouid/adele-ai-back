/**
 * Script pour créer la vue insider_trades_clean qui filtre les dates 1975
 */

import { executeAthenaQuery } from '../services/api/src/athena/query';
import * as fs from 'fs';
import * as path from 'path';

async function createCleanView() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔧 CRÉATION DE LA VUE insider_trades_clean');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Lire le fichier SQL
    const sqlFile = path.join(__dirname, '../infra/athena/ddl/create_insider_trades_clean_view.sql');
    const sql = fs.readFileSync(sqlFile, 'utf-8');

    console.log('📝 Exécution de la requête DDL...');
    console.log('   Fichier:', sqlFile);
    console.log('');

    // Nettoyer les commentaires et lignes vides
    const cleanedSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
      .join('\n')
      .trim();

    console.log('📋 Requête SQL:');
    console.log(cleanedSql);
    console.log('');

    // Exécuter la requête
    await executeAthenaQuery(cleanedSql);

    console.log('✅ Vue insider_trades_clean créée avec succès !');
    console.log('');
    console.log('💡 Utilisation:');
    console.log('   - Utilisez insider_trades_clean au lieu de insider_trades');
    console.log('   - Les dates 1975 seront automatiquement filtrées');
    console.log('   - Les dates invalides (< 1995 ou > 2030) sont aussi filtrées');
    console.log('');

    // Vérifier que la vue fonctionne
    console.log('🔍 Vérification de la vue...');
    const testQuery = `
      SELECT COUNT(*) as total_clean
      FROM insider_trades_clean
    `;
    const result = await executeAthenaQuery(testQuery);
    const totalClean = result[0]?.total_clean || result[0]?.[0] || 0;
    console.log(`   📊 Transactions dans la vue clean: ${totalClean}`);

    // Comparer avec la table originale
    const originalQuery = `
      SELECT COUNT(*) as total_original
      FROM insider_trades
    `;
    const originalResult = await executeAthenaQuery(originalQuery);
    const totalOriginal = originalResult[0]?.total_original || originalResult[0]?.[0] || 0;
    console.log(`   📊 Transactions dans la table originale: ${totalOriginal}`);
    console.log(`   📊 Transactions filtrées: ${totalOriginal - totalClean}`);

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ VUE CRÉÉE ET VÉRIFIÉE');
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error: any) {
    console.error('❌ Erreur lors de la création de la vue:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createCleanView();
