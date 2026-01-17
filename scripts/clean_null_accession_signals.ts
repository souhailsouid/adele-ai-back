/**
 * Script pour supprimer les signals avec accession_number=NULL de S3
 * 
 * ATTENTION: Ce script supprime les fichiers Parquet contenant des signals avec accession_number=NULL.
 * Les fichiers Parquet ne peuvent pas être modifiés ligne par ligne, donc on supprime
 * tout le fichier et on laisse les nouvelles insertions (avec accession_number) remplacer.
 * 
 * Usage:
 *   npx tsx scripts/clean_null_accession_signals.ts
 */

// Charger les variables d'environnement si disponibles
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.local' });
} catch (e) {
  // dotenv n'est pas disponible, utiliser les variables d'environnement système
}

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { executeAthenaQuery } from '../services/api/src/athena/query';

const S3_BUCKET = process.env.S3_DATA_LAKE_BUCKET || 'adel-ai-dev-data-lake';
const AWS_REGION = process.env.AWS_REGION || 'eu-west-3';

const s3Client = new S3Client({ region: AWS_REGION });

async function findFilesWithNullAccession(): Promise<string[]> {
  console.log('🔍 Recherche des fichiers Parquet contenant des signals avec accession_number=NULL...\n');

  // Requête pour trouver les fichiers qui contiennent des signals sans accession_number
  // On utilise une requête Athena pour identifier les partitions concernées
  const query = `
    SELECT DISTINCT
      CAST(year(transaction_date) AS INT) as year,
      CAST(month(transaction_date) AS INT) as month
    FROM top_insider_signals
    WHERE accession_number IS NULL
       OR (accession_number IS NULL AND filing_id IS NOT NULL)
  `;

  try {
    const results = await executeAthenaQuery(query);
    
    if (results.length === 0) {
      console.log('✅ Aucun signal avec accession_number=NULL trouvé\n');
      return [];
    }

    console.log(`📊 Partitions concernées: ${results.length}\n`);
    const filesToDelete: string[] = [];

    // Pour chaque partition, lister tous les fichiers
    for (const row of results) {
      const year = row.year || row[0];
      const month = String(row.month || row[1]).padStart(2, '0');
      const prefix = `data/top_insider_signals/year=${year}/month=${month}/`;

      console.log(`   📁 Partition: year=${year}, month=${month}`);

      // Lister tous les fichiers dans cette partition
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
              filesToDelete.push(obj.Key);
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      console.log(`      → ${filesToDelete.filter(f => f.startsWith(prefix)).length} fichier(s) trouvé(s)`);
    }

    console.log(`\n📦 Total: ${filesToDelete.length} fichier(s) à supprimer\n`);
    return filesToDelete;

  } catch (error: any) {
    if (error.message?.includes('COLUMN_NOT_FOUND') || error.message?.includes('accession_number')) {
      console.log('⚠️  La colonne accession_number n\'existe pas encore dans la table.');
      console.log('   → Il faut d\'abord mettre à jour le DDL de la table');
      console.log('   → Puis redéployer form4-parser pour que les nouveaux signals aient accession_number');
      return [];
    }
    throw error;
  }
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

async function cleanNullAccessionSignals() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧹 Nettoyage des signals avec accession_number=NULL');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('⚠️  ATTENTION:');
  console.log('   Ce script va supprimer TOUS les fichiers Parquet contenant');
  console.log('   des signals avec accession_number=NULL.');
  console.log('   Les nouvelles insertions (avec accession_number) remplaceront ces données.\n');

  try {
    // Étape 1: Trouver les fichiers à supprimer
    const filesToDelete = await findFilesWithNullAccession();

    if (filesToDelete.length === 0) {
      console.log('✅ Aucune action nécessaire\n');
      return;
    }

    // Étape 2: Demander confirmation
    console.log('⚠️  Confirmation requise:');
    console.log(`   ${filesToDelete.length} fichier(s) seront supprimés.`);
    console.log('   Appuyez sur Ctrl+C pour annuler, ou Entrée pour continuer...\n');
    
    // En mode non-interactif, on continue automatiquement
    // await new Promise(resolve => process.stdin.once('data', resolve));

    // Étape 3: Supprimer les fichiers
    await deleteFilesFromS3(filesToDelete);

    // Étape 4: Réparer la table Athena
    await repairAthenaTable();

    console.log('✅ Nettoyage terminé avec succès!\n');

  } catch (error: any) {
    console.error('\n❌ Erreur lors du nettoyage:', error.message);
    console.error(error);
    process.exit(1);
  }
}

cleanNullAccessionSignals().catch(console.error);
