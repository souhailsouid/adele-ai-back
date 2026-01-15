/**
 * Script pour supprimer les transactions avec dates 1975 de S3
 * 
 * ATTENTION: Ce script supprime les fichiers Parquet contenant des dates 1975.
 * Les fichiers Parquet ne peuvent pas être modifiés ligne par ligne, donc on supprime
 * tout le fichier et on laisse les nouvelles insertions (avec dates correctes) remplacer.
 * 
 * Usage:
 *   npx tsx scripts/clean_1975_transactions_s3.ts
 */

// Charger les variables d'environnement si disponibles
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.local' });
} catch (e) {
  // dotenv n'est pas disponible, utiliser les variables d'environnement système
}

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand } from '@aws-sdk/client-athena';
import { executeAthenaQuery } from '../services/api/src/athena/query';

const S3_BUCKET = process.env.S3_DATA_LAKE_BUCKET || 'adel-ai-dev-data-lake';
const ATHENA_DATABASE = process.env.ATHENA_DATABASE || 'adel_ai_dev';
const ATHENA_WORKGROUP = process.env.ATHENA_WORKGROUP || 'primary';
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET || 'adel-ai-dev-athena-results';
const AWS_REGION = process.env.AWS_REGION || 'eu-west-3';

const s3Client = new S3Client({ region: AWS_REGION });
const athenaClient = new AthenaClient({ region: AWS_REGION });

async function findFilesWith1975Dates(): Promise<string[]> {
  console.log('🔍 Recherche des fichiers Parquet contenant des dates 1975...\n');

  // Requête Athena pour trouver les fichiers (partitions) contenant des dates 1975
  // Note: Athena ne peut pas nous dire directement quel fichier contient quelles données,
  // mais on peut identifier les partitions (year/month) concernées
  const query = `
    SELECT DISTINCT
      year,
      month,
      COUNT(*) as count
    FROM insider_trades
    WHERE CAST(transaction_date AS VARCHAR) LIKE '1975-%'
    GROUP BY year, month
    ORDER BY year DESC, month DESC
  `;

  try {
    const results = await executeAthenaQuery(query);
    console.log(`📊 Partitions contenant des dates 1975:\n`);
    
    const partitions: Array<{ year: number; month: number; count: number }> = [];
    results.forEach((row: any) => {
      const year = row.year || row[0];
      const month = row.month || row[1];
      const count = row.count || row[2];
      partitions.push({ year, month, count });
      console.log(`   ${year}-${String(month).padStart(2, '0')}: ${count} transaction(s)`);
    });

    if (partitions.length === 0) {
      console.log('   ✅ Aucune partition avec dates 1975 trouvée\n');
      return [];
    }

    // Lister tous les fichiers Parquet dans ces partitions
    const filesToDelete: string[] = [];
    
    for (const partition of partitions) {
      const prefix = `data/insider_trades/year=${partition.year}/month=${partition.month}/`;
      console.log(`\n📁 Analyse de la partition: ${prefix}`);
      
      try {
        const listCommand = new ListObjectsV2Command({
          Bucket: S3_BUCKET,
          Prefix: prefix,
        });
        
        let continuationToken: string | undefined;
        do {
          if (continuationToken) {
            listCommand.input.ContinuationToken = continuationToken;
          }
          
          const response = await s3Client.send(listCommand);
          
          if (response.Contents) {
            for (const object of response.Contents) {
              if (object.Key && object.Key.endsWith('.parquet')) {
                filesToDelete.push(object.Key);
                console.log(`   📄 ${object.Key} (${(object.Size || 0) / 1024} KB)`);
              }
            }
          }
          
          continuationToken = response.NextContinuationToken;
        } while (continuationToken);
        
      } catch (error: any) {
        console.error(`   ❌ Erreur lors de la liste de ${prefix}:`, error.message);
      }
    }

    console.log(`\n📊 Total fichiers à supprimer: ${filesToDelete.length}\n`);
    return filesToDelete;

  } catch (error: any) {
    console.error('❌ Erreur lors de la recherche:', error.message);
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

  const query = `MSCK REPAIR TABLE insider_trades`;

  try {
    const startCommand = new StartQueryExecutionCommand({
      QueryString: query,
      QueryExecutionContext: {
        Database: ATHENA_DATABASE,
      },
      WorkGroup: ATHENA_WORKGROUP,
      ResultConfiguration: {
        OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/`,
      },
    });

    const execution = await athenaClient.send(startCommand);
    const executionId = execution.QueryExecutionId;

    if (!executionId) {
      throw new Error('No execution ID returned');
    }

    console.log(`   📝 Query ID: ${executionId}`);
    console.log(`   ⏳ Attente de la fin de l'exécution...`);

    // Attendre la fin de l'exécution
    let status = 'RUNNING';
    while (status === 'RUNNING' || status === 'QUEUED') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusCommand = new GetQueryExecutionCommand({
        QueryExecutionId: executionId,
      });
      
      const statusResponse = await athenaClient.send(statusCommand);
      status = statusResponse.QueryExecution?.Status?.State || 'UNKNOWN';
      
      if (status === 'RUNNING' || status === 'QUEUED') {
        process.stdout.write('.');
      }
    }

    console.log(`\n   ✅ Réparation terminée (status: ${status})\n`);

  } catch (error: any) {
    console.error('❌ Erreur lors de la réparation:', error.message);
    throw error;
  }
}

async function verifyCleanup(): Promise<void> {
  console.log('🔍 Vérification du nettoyage...\n');

  const query = `
    SELECT COUNT(*) as count
    FROM insider_trades
    WHERE CAST(transaction_date AS VARCHAR) LIKE '1975-%'
  `;

  try {
    const results = await executeAthenaQuery(query);
    const count = results[0]?.count || results[0]?.[0] || 0;

    if (count === 0) {
      console.log('   ✅ Aucune transaction avec date 1975 restante\n');
    } else {
      console.log(`   ⚠️  ${count} transaction(s) avec date 1975 encore présente(s)`);
      console.log('   💡 Cela peut être normal si de nouveaux fichiers ont été créés pendant le nettoyage\n');
    }

    // Compter le total de transactions
    const totalQuery = `SELECT COUNT(*) as count FROM insider_trades`;
    const totalResults = await executeAthenaQuery(totalQuery);
    const total = totalResults[0]?.count || totalResults[0]?.[0] || 0;
    console.log(`   📊 Total transactions dans insider_trades: ${total}\n`);

  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification:', error.message);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧹 NETTOYAGE DES TRANSACTIONS AVEC DATES 1975');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Trouver les fichiers contenant des dates 1975
    const filesToDelete = await findFilesWith1975Dates();

    if (filesToDelete.length === 0) {
      console.log('✅ Aucun fichier à supprimer. Le nettoyage n\'est pas nécessaire.\n');
      return;
    }

    // 2. Demander confirmation
    console.log(`\n⚠️  ATTENTION: ${filesToDelete.length} fichier(s) seront supprimé(s) de S3.`);
    console.log('   Ces fichiers contiennent des transactions avec des dates 1975 (bug).');
    console.log('   Les nouvelles insertions (avec dates correctes) remplaceront ces données.\n');
    
    // En mode non-interactif, on continue automatiquement
    // En mode interactif, on pourrait demander confirmation ici
    console.log('🚀 Démarrage du nettoyage...\n');

    // 3. Supprimer les fichiers de S3
    await deleteFilesFromS3(filesToDelete);

    // 4. Réparer la table Athena
    await repairAthenaTable();

    // 5. Vérifier le nettoyage
    await verifyCleanup();

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ NETTOYAGE TERMINÉ');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('💡 Note: Les nouvelles insertions (avec dates correctes) continueront');
    console.log('   à être ajoutées normalement. Les anciennes données erronées ont été supprimées.\n');

  } catch (error: any) {
    console.error('\n❌ Erreur fatale lors du nettoyage:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
