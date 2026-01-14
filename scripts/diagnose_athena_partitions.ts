/**
 * Script pour diagnostiquer les partitions Athena
 * 
 * Usage:
 *   npx tsx scripts/diagnose_athena_partitions.ts
 */

import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from '@aws-sdk/client-athena';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

// Charger les variables d'environnement
let dotenvLoaded = false;
try {
  const dotenv = require('dotenv');
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    dotenvLoaded = true;
  }
} catch (e) {
  // dotenv n'est pas installé, parser manuellement
}

if (!dotenvLoaded) {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const lines = envContent.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    } catch (e) {
      // Ignorer les erreurs de parsing
    }
  }
}

const athenaClient = new AthenaClient({
  region: process.env.AWS_REGION || 'eu-west-3',
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-3',
});

const ATHENA_DATABASE = process.env.ATHENA_DATABASE || 'adel_ai_dev';
const ATHENA_WORK_GROUP = process.env.ATHENA_WORK_GROUP || 'adel-ai-dev-workgroup';
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET || 'adel-ai-dev-athena-results';
const S3_DATA_LAKE_BUCKET = process.env.S3_DATA_LAKE_BUCKET || 'adel-ai-dev-data-lake';

async function executeAthenaQuery(query: string): Promise<any[]> {
  const startCommand = new StartQueryExecutionCommand({
    QueryString: query,
    QueryExecutionContext: {
      Database: ATHENA_DATABASE,
    },
    WorkGroup: ATHENA_WORK_GROUP,
    ResultConfiguration: {
      OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/queries/`,
    },
  });

  const startResponse = await athenaClient.send(startCommand);
  const queryExecutionId = startResponse.QueryExecutionId;

  if (!queryExecutionId) {
    throw new Error('Failed to start Athena query');
  }

  let status = 'RUNNING';
  let attempts = 0;
  const maxAttempts = 60;

  while (status === 'RUNNING' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000));

    const statusCommand = new GetQueryExecutionCommand({
      QueryExecutionId: queryExecutionId,
    });

    const statusResponse = await athenaClient.send(statusCommand);
    status = statusResponse.QueryExecution?.Status?.State || 'FAILED';

    if (status === 'FAILED') {
      const reason = statusResponse.QueryExecution?.Status?.StateChangeReason || 'Unknown error';
      throw new Error(`Athena query failed: ${reason}`);
    }

    attempts++;
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Athena query did not complete: ${status}`);
  }

  const results: any[] = [];
  let nextToken: string | undefined;

  do {
    const resultsCommand = new GetQueryResultsCommand({
      QueryExecutionId: queryExecutionId,
      NextToken: nextToken,
      MaxResults: 1000,
    });

    const resultsResponse = await athenaClient.send(resultsCommand);
    const rows = resultsResponse.ResultSet?.Rows || [];
    const columnInfo = resultsResponse.ResultSet?.ResultSetMetadata?.ColumnInfo || [];

    const dataRows = rows.slice(1);

    for (const row of dataRows) {
      const data = row.Data || [];
      const rowData: any = {};
      
      columnInfo.forEach((col, index) => {
        const cell = data[index];
        let value: any = null;
        
        if (cell?.VarCharValue) {
          value = cell.VarCharValue;
        } else if (cell?.BigIntValue !== undefined) {
          value = parseInt(cell.BigIntValue);
        } else if (cell?.DoubleValue !== undefined) {
          value = parseFloat(cell.DoubleValue);
        }
        
        rowData[col.Name || `col${index}`] = value;
      });
      
      results.push(rowData);
    }

    nextToken = resultsResponse.NextToken;
  } while (nextToken);

  return results;
}

async function listS3Partitions() {
  console.log('📦 Vérification des fichiers dans S3...\n');
  
  const prefix = 'data/companies/';
  const partitions: Set<string> = new Set();
  let continuationToken: string | undefined;
  let totalFiles = 0;

  do {
    const command = new ListObjectsV2Command({
      Bucket: S3_DATA_LAKE_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);
    const objects = response.Contents || [];

    for (const obj of objects) {
      if (obj.Key && obj.Key.endsWith('.parquet')) {
        totalFiles++;
        // Extraire la partition depuis le chemin
        // Ex: data/companies/year=2026/month=01/data_batch_1.parquet
        const match = obj.Key.match(/year=(\d+)\/month=(\d+)/);
        if (match) {
          partitions.add(`year=${match[1]}/month=${match[2]}`);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  console.log(`   ✅ Fichiers Parquet trouvés: ${totalFiles}`);
  console.log(`   ✅ Partitions détectées: ${partitions.size}`);
  console.log('   Partitions:');
  Array.from(partitions).sort().forEach(p => {
    console.log(`      - ${p}`);
  });
  console.log('');

  return { totalFiles, partitions: Array.from(partitions) };
}

async function checkAthenaPartitions() {
  console.log('🔍 Vérification des partitions dans Athena...\n');
  
  try {
    const partitions = await executeAthenaQuery('SHOW PARTITIONS companies;');
    
    console.log(`   ✅ Partitions détectées par Athena: ${partitions.length}`);
    if (partitions.length > 0) {
      console.log('   Partitions:');
      partitions.slice(0, 10).forEach((p: any, index: number) => {
        const partitionStr = Object.values(p).join('/');
        console.log(`      ${index + 1}. ${partitionStr}`);
      });
      if (partitions.length > 10) {
        console.log(`      ... et ${partitions.length - 10} autres`);
      }
    } else {
      console.log('   ⚠️  Aucune partition détectée!');
    }
    console.log('');
    
    return partitions;
  } catch (error: any) {
    console.log(`   ⚠️  Erreur: ${error.message}`);
    console.log('   (La table n\'a peut-être pas de partitions encore)\n');
    return [];
  }
}

async function diagnosePartitions() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Diagnostic des Partitions Athena');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Vérifier S3
  const { totalFiles, partitions: s3Partitions } = await listS3Partitions();

  // 2. Vérifier Athena
  const athenaPartitions = await checkAthenaPartitions();

  // 3. Compter les rows
  console.log('📊 Test: Compter les rows...\n');
  try {
    const countResults = await executeAthenaQuery('SELECT COUNT(*) as total FROM companies;');
    const total = countResults[0]?.total || 0;
    console.log(`   ✅ Total rows dans Athena: ${total.toLocaleString()}\n`);
  } catch (error: any) {
    console.log(`   ❌ Erreur: ${error.message}\n`);
  }

  // 4. Diagnostic
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 DIAGNOSTIC');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (totalFiles === 0) {
    console.log('❌ PROBLÈME: Aucun fichier Parquet trouvé dans S3!');
    console.log('   → Vérifier que la migration a bien fonctionné\n');
  } else if (athenaPartitions.length === 0) {
    console.log('⚠️  PROBLÈME: Athena ne détecte pas les partitions');
    console.log('   → Solution: Exécuter MSCK REPAIR TABLE companies;\n');
    console.log('   → Ou recréer la table sans projection.enabled\n');
  } else if (athenaPartitions.length < s3Partitions.length) {
    console.log('⚠️  PROBLÈME: Toutes les partitions ne sont pas détectées');
    console.log(`   → S3: ${s3Partitions.length} partitions`);
    console.log(`   → Athena: ${athenaPartitions.length} partitions`);
    console.log('   → Solution: Exécuter MSCK REPAIR TABLE companies;\n');
  } else {
    console.log('✅ Les partitions semblent correctes');
    console.log('   → Si le COUNT est toujours incorrect, vérifier les données Parquet\n');
  }

  console.log('💡 Solution recommandée:');
  console.log('   1. Recréer la table SANS projection.enabled');
  console.log('   2. Utiliser MSCK REPAIR TABLE pour détecter les partitions réelles');
  console.log('   3. Ou utiliser ALTER TABLE ADD PARTITION manuellement\n');
}

diagnosePartitions().catch(console.error);
