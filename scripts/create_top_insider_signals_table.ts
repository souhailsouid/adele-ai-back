/**
 * Script pour créer la table Athena top_insider_signals
 */

import { executeAthenaQuery } from '../services/api/src/athena/query';
import * as fs from 'fs';
import * as path from 'path';

async function createTable() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 CRÉATION DE LA TABLE ATHENA: top_insider_signals');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Lire le fichier SQL
  const sqlPath = path.join(__dirname, '../infra/athena/ddl/create_top_insider_signals_table.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  // Nettoyer le SQL (enlever les commentaires et lignes vides)
  const cleanSql = sql
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('--');
    })
    .join('\n')
    .trim();

  console.log('📝 Requête SQL:');
  console.log(cleanSql);
  console.log('');

  try {
    console.log('⏳ Exécution de la requête...');
    const result = await executeAthenaQuery(cleanSql);
    console.log('✅ Table créée avec succès !');
    console.log('');

    // Vérifier que la table existe
    console.log('🔍 Vérification de la table...');
    const checkQuery = "SHOW TABLES LIKE 'top_insider_signals'";
    const checkResult = await executeAthenaQuery(checkQuery);
    
    if (checkResult.length > 0) {
      console.log('✅ Table trouvée dans la base de données');
    } else {
      console.log('⚠️ Table non trouvée (peut prendre quelques secondes)');
    }

    console.log('\n💡 Prochaine étape: Exécuter MSCK REPAIR TABLE après avoir écrit des données');
    console.log('   MSCK REPAIR TABLE top_insider_signals;');

  } catch (error: any) {
    console.error('❌ Erreur lors de la création:', error.message);
    console.error(error);
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ TERMINÉ');
  console.log('═══════════════════════════════════════════════════════════');
}

createTable().catch(console.error);
