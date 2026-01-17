/**
 * Script pour supprimer TOUS les fichiers Parquet de top_insider_signals
 * 
 * ATTENTION: Ce script supprime TOUS les fichiers existants.
 * Les nouvelles insertions (avec accession_number) remplaceront ces données.
 * 
 * Usage:
 *   npx tsx scripts/delete_all_top_signals.ts
 */

// Charger les variables d'environnement si disponibles
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.local' });
} catch (e) {
  // dotenv n'est pas disponible
}

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { executeAthenaQuery } from '../services/api/src/athena/query';

const S3_BUCKET = process.env.S3_DATA_LAKE_BUCKET || 'adel-ai-dev-data-lake';
const AWS_REGION = process.env.AWS_REGION || 'eu-west-3';

const s3Client = new S3Client({ region: AWS_REGION });

async function findAllTopSignalsFiles(): Promise<string[]> {
  console.log('🔍 Recherche de tous les fichiers Parquet dans top_insider_signals...\n');

  const prefix = 'data/top_insider_signals/';
  const files: string[] = [];
  let continuationToken: string | undefined;

  do {
    const listCommand = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(listCommand);
    
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key && obj.Key.endsWith('.parquet')) {
          files.push(obj.Key);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log(`📦 Total: ${files.length} fichier(s) trouvé(s)\n`);
  return files;
}

async function deleteFilesFromS3(files: string[]): Promise<void> {
  if (files.length === 0) {
    console.log('✅ Aucun fichier à supprimer\n');
    return;
  }

  console.log('🗑️  Suppression des fichiers Parquet de S3...\n');

  // S3 DeleteObjects limite à 1000 objets par requête
  const batchSize = 1000;
  let deletedCount = 0;

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: S3_BUCKET,
      Delete: {
        Objects: batch.map(key => ({ Key: key })),
        Quiet: false,
      },
    });

    try {
      const response = await s3Client.send(deleteCommand);
      
      if (response.Deleted) {
        deletedCount += response.Deleted.length;
        console.log(`   ✅ ${response.Deleted.length} fichier(s) supprimé(s) (${deletedCount}/${files.length})`);
      }
      
      if (response.Errors && response.Errors.length > 0) {
        console.error(`   ⚠️  ${response.Errors.length} erreur(s) lors de la suppression:`);
        response.Errors.forEach(err => {
          console.error(`      - ${err.Key}: ${err.Message}`);
        });
      }
      
    } catch (error: any) {
      console.error(`   ❌ Erreur lors de la suppression du batch ${i / batchSize + 1}:`, error.message);
    }
  }

  console.log(`\n✅ ${deletedCount} fichier(s) supprimé(s) au total\n`);
}

async function repairAthenaTable(): Promise<void> {
  console.log('🔧 Réparation de la table Athena (MSCK REPAIR TABLE)...\n');

  try {
    await executeAthenaQuery('MSCK REPAIR TABLE top_insider_signals;');
    console.log('✅ Table réparée avec succès\n');
  } catch (error: any) {
    console.error('⚠️  Erreur lors de la réparation:', error.message);
    console.log('   → Vous pouvez exécuter manuellement: MSCK REPAIR TABLE top_insider_signals;\n');
  }
}

async function deleteAllTopSignals() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🗑️  Suppression de TOUS les fichiers top_insider_signals');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('⚠️  ATTENTION:');
  console.log('   Ce script va supprimer TOUS les fichiers Parquet de top_insider_signals.');
  console.log('   Les nouvelles insertions (avec accession_number) remplaceront ces données.\n');

  try {
    // Étape 1: Trouver tous les fichiers
    const filesToDelete = await findAllTopSignalsFiles();

    if (filesToDelete.length === 0) {
      console.log('✅ Aucune action nécessaire\n');
      return;
    }

    // Étape 2: Supprimer les fichiers
    await deleteFilesFromS3(filesToDelete);

    // Étape 3: Réparer la table Athena
    await repairAthenaTable();

    console.log('✅ Suppression terminée avec succès!');
    console.log('   → Les nouvelles insertions auront accession_number\n');

  } catch (error: any) {
    console.error('\n❌ Erreur lors de la suppression:', error.message);
    console.error(error);
    process.exit(1);
  }
}

deleteAllTopSignals().catch(console.error);
