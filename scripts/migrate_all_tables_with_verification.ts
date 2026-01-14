/**
 * Script automatisé pour migrer toutes les tables vers S3 + créer tables Athena
 * Avec vérifications à chaque étape
 * 
 * Usage:
 *   npx tsx scripts/migrate_all_tables_with_verification.ts
 */

import { execSync } from 'child_process';
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

interface TableConfig {
  name: string;
  batchSize: number;
  skipMigration?: boolean; // Si déjà migré
  skipAthena?: boolean; // Si table Athena déjà créée
}

const TABLES_TO_MIGRATE: TableConfig[] = [
  { name: 'companies', batchSize: 10000, skipMigration: true, skipAthena: true }, // Déjà fait
  { name: 'funds', batchSize: 10000 },
  { name: 'fund_filings', batchSize: 10000 },
  { name: 'company_filings', batchSize: 50000 },
  { name: 'fund_holdings_diff', batchSize: 50000 },
  // { name: 'fund_holdings', batchSize: 100000 }, // Très long, à faire en dernier
];

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

async function checkS3Files(tableName: string): Promise<number> {
  const prefix = `data/${tableName}/`;
  let totalFiles = 0;
  let continuationToken: string | undefined;

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
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return totalFiles;
}

async function checkAthenaTable(tableName: string): Promise<number> {
  try {
    const results = await executeAthenaQuery(`SELECT COUNT(*) as total FROM ${tableName};`);
    return parseInt(results[0]?.total || '0');
  } catch (error: any) {
    if (error.message.includes('does not exist') || error.message.includes('Table not found')) {
      return -1; // Table n'existe pas
    }
    throw error;
  }
}

function getTableDDL(tableName: string): string {
  const ddlMap: Record<string, string> = {
    funds: `
CREATE EXTERNAL TABLE IF NOT EXISTS funds (
  id BIGINT,
  name STRING,
  cik STRING,
  tier_influence INT,
  category STRING,
  created_at TIMESTAMP
)
STORED AS PARQUET
LOCATION 's3://${S3_DATA_LAKE_BUCKET}/data/funds/'
TBLPROPERTIES (
  'parquet.compress'='SNAPPY'
);
`.trim(),

    fund_filings: `
CREATE EXTERNAL TABLE IF NOT EXISTS fund_filings (
  id BIGINT,
  fund_id BIGINT,
  accession_number STRING,
  form_type STRING,
  filing_date DATE,
  period_of_report DATE,
  raw_storage_path STRING,
  status STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
PARTITIONED BY (year INT, month INT)
STORED AS PARQUET
LOCATION 's3://${S3_DATA_LAKE_BUCKET}/data/fund_filings/'
TBLPROPERTIES (
  'parquet.compress'='SNAPPY'
);
`.trim(),

    company_filings: `
CREATE EXTERNAL TABLE IF NOT EXISTS company_filings (
  id BIGINT,
  company_id BIGINT,
  cik STRING,
  form_type STRING,
  accession_number STRING,
  filing_date DATE,
  period_of_report DATE,
  document_url STRING,
  status STRING,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
PARTITIONED BY (year INT, month INT)
STORED AS PARQUET
LOCATION 's3://${S3_DATA_LAKE_BUCKET}/data/company_filings/'
TBLPROPERTIES (
  'parquet.compress'='SNAPPY'
);
`.trim(),

    fund_holdings_diff: `
CREATE EXTERNAL TABLE IF NOT EXISTS fund_holdings_diff (
  id BIGINT,
  fund_id BIGINT,
  ticker STRING,
  filing_id_new BIGINT,
  filing_id_old BIGINT,
  diff_shares BIGINT,
  diff_value BIGINT,
  diff_pct_shares DOUBLE,
  action STRING,
  created_at TIMESTAMP
)
PARTITIONED BY (year INT, month INT)
STORED AS PARQUET
LOCATION 's3://${S3_DATA_LAKE_BUCKET}/data/fund_holdings_diff/'
TBLPROPERTIES (
  'parquet.compress'='SNAPPY'
);
`.trim(),
  };

  return ddlMap[tableName] || '';
}

async function migrateTable(tableConfig: TableConfig): Promise<void> {
  const { name, batchSize, skipMigration, skipAthena } = tableConfig;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Table: ${name}`);
  console.log(`${'='.repeat(60)}\n`);

  // Étape 1: Migration vers S3
  if (!skipMigration) {
    console.log(`🔄 Étape 1: Migration vers S3...`);
    try {
      const command = `npx tsx scripts/migrate_to_s3_parquet.ts --table=${name} --s3-bucket=${S3_DATA_LAKE_BUCKET} --batch-size=${batchSize}`;
      execSync(command, { stdio: 'inherit', cwd: process.cwd() });
      console.log(`✅ Migration S3 terminée\n`);
    } catch (error: any) {
      console.error(`❌ Erreur lors de la migration S3: ${error.message}\n`);
      throw error;
    }
  } else {
    console.log(`⏭️  Étape 1: Migration S3 déjà effectuée (skip)\n`);
  }

  // Vérification S3
  console.log(`🔍 Vérification: Fichiers dans S3...`);
  const s3Files = await checkS3Files(name);
  console.log(`   ✅ ${s3Files} fichiers Parquet trouvés\n`);

  if (s3Files === 0 && !skipMigration) {
    throw new Error(`Aucun fichier Parquet trouvé dans S3 pour ${name}`);
  }

  // Étape 2: Créer table Athena
  if (!skipAthena) {
    console.log(`🗄️  Étape 2: Création table Athena...`);
    const ddl = getTableDDL(name);
    
    if (!ddl) {
      console.log(`   ⚠️  DDL non défini pour ${name}, skip\n`);
      return;
    }

    try {
      // Supprimer l'ancienne table si elle existe
      await executeAthenaQuery(`DROP TABLE IF EXISTS ${name};`);
      console.log(`   ✅ Ancienne table supprimée`);

      // Créer la nouvelle table
      await executeAthenaQuery(ddl);
      console.log(`   ✅ Table créée`);

      // Repartitionner si nécessaire
      if (ddl.includes('PARTITIONED BY')) {
        await executeAthenaQuery(`MSCK REPAIR TABLE ${name};`);
        console.log(`   ✅ Partitions détectées`);
      }

      console.log(`✅ Table Athena créée avec succès\n`);
    } catch (error: any) {
      console.error(`❌ Erreur lors de la création table Athena: ${error.message}\n`);
      throw error;
    }
  } else {
    console.log(`⏭️  Étape 2: Table Athena déjà créée (skip)\n`);
  }

  // Vérification Athena
  console.log(`🔍 Vérification: Table Athena...`);
  const athenaCount = await checkAthenaTable(name);
  
  if (athenaCount === -1) {
    console.log(`   ⚠️  Table n'existe pas encore\n`);
  } else {
    console.log(`   ✅ ${athenaCount.toLocaleString()} rows détectées dans Athena\n`);
  }
}

async function migrateAllTables() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 Migration Automatisée: Toutes les Tables');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 Configuration:');
  console.log(`   - S3 Bucket: ${S3_DATA_LAKE_BUCKET}`);
  console.log(`   - Athena Database: ${ATHENA_DATABASE}`);
  console.log(`   - Athena Work Group: ${ATHENA_WORK_GROUP}`);
  console.log(`   - Tables à migrer: ${TABLES_TO_MIGRATE.length}\n`);

  const results: Array<{ table: string; success: boolean; error?: string }> = [];

  for (const tableConfig of TABLES_TO_MIGRATE) {
    try {
      await migrateTable(tableConfig);
      results.push({ table: tableConfig.name, success: true });
    } catch (error: any) {
      console.error(`\n❌ Erreur pour ${tableConfig.name}: ${error.message}\n`);
      results.push({ table: tableConfig.name, success: false, error: error.message });
    }
  }

  // Résumé
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📊 RÉSUMÉ');
  console.log('═══════════════════════════════════════════════════════════\n');

  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${String(index + 1).padStart(2)}. ${result.table.padEnd(25)} ${result.success ? 'Succès' : `Erreur: ${result.error}`}`);
  });

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`\n✅ Succès: ${successCount}/${results.length}`);
  if (failCount > 0) {
    console.log(`❌ Échecs: ${failCount}/${results.length}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

migrateAllTables().catch(console.error);
