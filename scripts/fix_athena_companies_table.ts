/**
 * Script pour corriger la table Athena companies
 * 
 * Le problème: projection.enabled peut causer des conflits avec les partitions réelles
 * Solution: Recréer la table sans projection, utiliser MSCK REPAIR TABLE
 * 
 * Usage:
 *   npx tsx scripts/fix_athena_companies_table.ts
 */

import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand } from '@aws-sdk/client-athena';
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

const ATHENA_DATABASE = process.env.ATHENA_DATABASE || 'adel_ai_dev';
const ATHENA_WORK_GROUP = process.env.ATHENA_WORK_GROUP || 'adel-ai-dev-workgroup';
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET || 'adel-ai-dev-athena-results';
const S3_DATA_LAKE_BUCKET = process.env.S3_DATA_LAKE_BUCKET || 'adel-ai-dev-data-lake';

async function executeAthenaQuery(query: string): Promise<void> {
  console.log('\n📝 Exécution:');
  console.log('─────────────────────────────────────────────────');
  console.log(query);
  console.log('─────────────────────────────────────────────────\n');

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

  console.log(`✅ Requête démarrée (Execution ID: ${queryExecutionId})`);
  console.log('⏳ Attente...\n');

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
    process.stdout.write(`   Tentative ${attempts}/${maxAttempts}...\r`);
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Athena query did not complete: ${status}`);
  }

  console.log('✅ Requête exécutée avec succès!\n');
}

async function fixCompaniesTable() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔧 Correction de la table Athena: companies');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 Configuration:');
  console.log(`   - Database: ${ATHENA_DATABASE}`);
  console.log(`   - Work Group: ${ATHENA_WORK_GROUP}`);
  console.log(`   - S3 Data Lake: s3://${S3_DATA_LAKE_BUCKET}/data/companies/\n`);

  try {
    // Étape 1: Supprimer l'ancienne table
    console.log('🗑️  Étape 1: Suppression de l\'ancienne table...');
    await executeAthenaQuery('DROP TABLE IF EXISTS companies;');

    // Étape 2: Recréer la table SANS projection.enabled
    console.log('📝 Étape 2: Création de la nouvelle table (sans projection)...');
    const createTableQuery = `
CREATE EXTERNAL TABLE companies (
  id BIGINT,
  ticker STRING,
  cik STRING,
  name STRING,
  sector STRING,
  industry STRING,
  market_cap BIGINT,
  headquarters_country STRING,
  headquarters_state STRING,
  sic_code STRING,
  category STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
PARTITIONED BY (year INT, month INT)
STORED AS PARQUET
LOCATION 's3://${S3_DATA_LAKE_BUCKET}/data/companies/'
TBLPROPERTIES (
  'parquet.compress'='SNAPPY'
);
`.trim();

    await executeAthenaQuery(createTableQuery);

    // Étape 3: Repartitionner (détecter les partitions réelles)
    console.log('🔄 Étape 3: Détection des partitions (MSCK REPAIR TABLE)...');
    await executeAthenaQuery('MSCK REPAIR TABLE companies;');

    // Étape 4: Vérifier les partitions
    console.log('🔍 Étape 4: Vérification des partitions...');
    await executeAthenaQuery('SHOW PARTITIONS companies;');

    // Étape 5: Tester avec COUNT
    console.log('🧪 Étape 5: Test COUNT...');
    await executeAthenaQuery('SELECT COUNT(*) as total FROM companies;');

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Table "companies" corrigée avec succès!');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('💡 Vérifier maintenant avec:');
    console.log('   npx tsx scripts/test_athena_companies.ts\n');

  } catch (error: any) {
    console.error('\n❌ Erreur lors de la correction:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

fixCompaniesTable().catch(console.error);
