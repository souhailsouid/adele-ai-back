/**
 * Script pour recréer la table top_insider_signals avec les nouvelles colonnes
 * (accession_number et source_type)
 * 
 * Usage:
 *   npx tsx scripts/recreate_top_insider_signals_table.ts
 */

// Charger les variables d'environnement si disponibles
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.local' });
} catch (e) {
  // dotenv n'est pas disponible
}

import { executeAthenaQuery } from '../services/api/src/athena/query';
import { readFileSync } from 'fs';
import { join } from 'path';

const ATHENA_DATABASE = process.env.ATHENA_DATABASE || 'adel_ai_dev';
const S3_BUCKET = process.env.S3_DATA_LAKE_BUCKET || 'adel-ai-dev-data-lake';

async function recreateTable() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔧 Recréation de la table top_insider_signals');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Étape 1: Supprimer l'ancienne table
    console.log('🗑️  Étape 1: Suppression de l\'ancienne table...');
    await executeAthenaQuery('DROP TABLE IF EXISTS top_insider_signals;');
    console.log('   ✅ Table supprimée\n');

    // Étape 2: Lire le nouveau DDL
    console.log('📝 Étape 2: Lecture du nouveau DDL...');
    const ddlPath = join(__dirname, '../infra/athena/ddl/create_top_insider_signals_table.sql');
    const ddl = readFileSync(ddlPath, 'utf-8');
    console.log('   ✅ DDL lu\n');

    // Étape 3: Créer la nouvelle table
    console.log('🔨 Étape 3: Création de la nouvelle table...');
    await executeAthenaQuery(ddl);
    console.log('   ✅ Table créée\n');

    // Étape 4: Vérifier la structure
    console.log('🔍 Étape 4: Vérification de la structure...');
    const describeResult = await executeAthenaQuery('DESCRIBE top_insider_signals;');
    const hasAccessionNumber = describeResult.some((row: any) => 
      (row.col_name || row[0] || '').toLowerCase().includes('accession')
    );
    const hasSourceType = describeResult.some((row: any) => 
      (row.col_name || row[0] || '').toLowerCase().includes('source_type')
    );

    if (hasAccessionNumber) {
      console.log('   ✅ Colonne accession_number trouvée');
    } else {
      console.log('   ❌ Colonne accession_number NON trouvée');
    }

    if (hasSourceType) {
      console.log('   ✅ Colonne source_type trouvée');
    } else {
      console.log('   ❌ Colonne source_type NON trouvée');
    }

    console.log('\n✅ Table recréée avec succès!');
    console.log('   → Prête pour les nouvelles insertions avec accession_number\n');

  } catch (error: any) {
    console.error('\n❌ Erreur lors de la recréation:', error.message);
    console.error(error);
    process.exit(1);
  }
}

recreateTable().catch(console.error);
