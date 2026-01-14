/**
 * Script pour créer la table Athena "companies"
 * 
 * Usage:
 *   npx tsx scripts/create_athena_table_companies.ts
 * 
 * Prérequis:
 *   - Les données doivent être déjà migrées vers S3
 *   - Le bucket doit être: adel-ai-dev-data-lake
 *   - La database doit être: adel_ai_dev
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

/**
 * Exécuter une requête Athena et attendre le résultat
 */
async function executeAthenaQuery(query: string): Promise<void> {
  console.log('\n📝 Exécution de la requête Athena...');
  console.log('─────────────────────────────────────────────────');
  console.log(query);
  console.log('─────────────────────────────────────────────────\n');

  // Démarrer l'exécution
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
  console.log('⏳ Attente de la fin de l\'exécution...\n');

  // Attendre la fin de l'exécution
  let status = 'RUNNING';
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max (5s * 60)

  while (status === 'RUNNING' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Attendre 5 secondes

    const statusCommand = new GetQueryExecutionCommand({
      QueryExecutionId: queryExecutionId,
    });

    const statusResponse = await athenaClient.send(statusCommand);
    status = statusResponse.QueryExecution?.Status?.State || 'FAILED';

    if (status === 'FAILED') {
      const reason = statusResponse.QueryExecution?.Status?.StateChangeReason || 'Unknown error';
      throw new Error(`Athena query failed: ${reason}`);
    }

    if (status === 'SUCCEEDED') {
      console.log('✅ Requête exécutée avec succès!\n');
      return;
    }

    attempts++;
    process.stdout.write(`   Tentative ${attempts}/${maxAttempts}...\r`);
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Athena query did not complete: ${status}`);
  }
}

async function createCompaniesTable() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🗄️  Création de la table Athena: companies');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 Configuration:');
  console.log(`   - Database: ${ATHENA_DATABASE}`);
  console.log(`   - Work Group: ${ATHENA_WORK_GROUP}`);
  console.log(`   - S3 Data Lake: s3://${S3_DATA_LAKE_BUCKET}/data/companies/`);
  console.log(`   - Results Bucket: s3://${ATHENA_RESULTS_BUCKET}/queries/\n`);

  // DDL pour créer la table companies
  const createTableQuery = `
CREATE EXTERNAL TABLE IF NOT EXISTS companies (
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
  'parquet.compress'='SNAPPY',
  'projection.enabled'='true',
  'projection.year.type'='integer',
  'projection.year.range'='2020,2030',
  'projection.month.type'='integer',
  'projection.month.range'='1,12',
  'storage.location.template'='s3://${S3_DATA_LAKE_BUCKET}/data/companies/year=\${year}/month=\${month}/'
);
`.trim();

  try {
    // Étape 1: Créer la table
    await executeAthenaQuery(createTableQuery);

    // Étape 2: Repartitionner (MSCK REPAIR TABLE)
    console.log('🔄 Repartitionnement de la table (MSCK REPAIR TABLE)...\n');
    const repairQuery = 'MSCK REPAIR TABLE companies;';
    await executeAthenaQuery(repairQuery);

    // Étape 3: Tester avec une requête simple
    console.log('🧪 Test de la table avec une requête COUNT...\n');
    const testQuery = 'SELECT COUNT(*) as total FROM companies;';
    await executeAthenaQuery(testQuery);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Table "companies" créée avec succès!');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('💡 Prochaines étapes:');
    console.log('   1. Vérifier dans Athena Console que la table est visible');
    console.log('   2. Exécuter: SELECT * FROM companies LIMIT 10;');
    console.log('   3. Migrer les autres tables (fund_holdings, company_filings, etc.)');
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Erreur lors de la création de la table:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

createCompaniesTable().catch(console.error);
