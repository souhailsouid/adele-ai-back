/**
 * Script pour vérifier que les tables Athena Smart Money sont créées
 * 
 * Usage:
 *   npx tsx scripts/verify_athena_smart_money_tables.ts
 */

import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from '@aws-sdk/client-athena';
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

const athenaClient = new AthenaClient({
  region: process.env.AWS_REGION || 'eu-west-3',
});

const ATHENA_DATABASE = process.env.ATHENA_DATABASE || 'adel_ai_dev';
const ATHENA_WORK_GROUP = process.env.ATHENA_WORK_GROUP || 'adel-ai-dev-workgroup';
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET || 'adel-ai-dev-athena-results';

const EXPECTED_TABLES = [
  'insider_trades',
  'company_financials',
  'cusip_ticker_mapping',
  'transaction_alerts',
];

/**
 * Exécuter une requête Athena et retourner les résultats
 */
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

  // Attendre la fin de l'exécution
  let status = 'RUNNING';
  let attempts = 0;
  const maxAttempts = 60;

  while (status === 'RUNNING' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));

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
      break;
    }

    attempts++;
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Athena query did not complete: ${status}`);
  }

  // Récupérer les résultats
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

    // Ignorer la première ligne (headers)
    const dataRows = rows.slice(1);

    for (const row of dataRows) {
      const data = row.Data || [];
      const rowData: any = {};
      
      columnInfo.forEach((col, index) => {
        const cell = data[index];
        const value = cell?.VarCharValue || cell?.BigIntValue || cell?.DoubleValue || cell?.BooleanValue || null;
        rowData[col.Name || `col${index}`] = value;
      });

      results.push(rowData);
    }

    nextToken = resultsResponse.NextToken;
  } while (nextToken);

  return results;
}

/**
 * Fonction principale
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 VÉRIFICATION DES TABLES ATHENA SMART MONEY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Configuration:`);
  console.log(`   Database: ${ATHENA_DATABASE}`);
  console.log(`   WorkGroup: ${ATHENA_WORK_GROUP}`);
  console.log(`   Region: ${process.env.AWS_REGION || 'eu-west-3'}`);

  // 1. Lister toutes les tables
  console.log('\n📋 Vérification des tables...');
  try {
    const tables = await executeAthenaQuery('SHOW TABLES;');
    const tableNames = tables.map((row: any) => {
      const key = Object.keys(row)[0];
      return row[key] || '';
    }).filter(Boolean);

    console.log(`\n✅ ${tableNames.length} table(s) trouvée(s) dans la base de données`);

    // Vérifier que toutes les tables attendues existent
    const foundTables: string[] = [];
    const missingTables: string[] = [];

    for (const expectedTable of EXPECTED_TABLES) {
      if (tableNames.includes(expectedTable)) {
        foundTables.push(expectedTable);
        console.log(`   ✅ ${expectedTable}`);
      } else {
        missingTables.push(expectedTable);
        console.log(`   ❌ ${expectedTable} (manquante)`);
      }
    }

    if (missingTables.length > 0) {
      console.log(`\n⚠️  ${missingTables.length} table(s) manquante(s):`);
      missingTables.forEach(table => console.log(`   - ${table}`));
    }

    // 2. Vérifier le schéma de chaque table
    console.log('\n📊 Vérification des schémas...');
    for (const tableName of foundTables) {
      try {
        console.log(`\n🔍 Table: ${tableName}`);
        const schema = await executeAthenaQuery(`DESCRIBE ${tableName};`);
        console.log(`   ✅ Schéma valide (${schema.length} colonne(s))`);
        
        // Afficher quelques colonnes clés
        const columnNames = schema.map((row: any) => {
          const key = Object.keys(row)[0];
          return row[key] || '';
        }).filter(Boolean).slice(0, 5);
        
        if (columnNames.length > 0) {
          console.log(`   Colonnes: ${columnNames.join(', ')}${schema.length > 5 ? '...' : ''}`);
        }
      } catch (error: any) {
        console.error(`   ❌ Erreur lors de la vérification du schéma: ${error.message}`);
      }
    }

    // 3. Tester un COUNT(*) sur chaque table (pour vérifier qu'elles sont accessibles)
    console.log('\n🔢 Test des requêtes COUNT(*)...');
    for (const tableName of foundTables) {
      try {
        const countResult = await executeAthenaQuery(`SELECT COUNT(*) as count FROM ${tableName} LIMIT 1;`);
        const count = countResult[0]?.count || countResult[0]?.['count'] || '0';
        console.log(`   ✅ ${tableName}: ${count} ligne(s)`);
      } catch (error: any) {
        console.error(`   ❌ ${tableName}: Erreur - ${error.message}`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    if (missingTables.length === 0) {
      console.log('✅ TOUTES LES TABLES SONT CRÉÉES ET ACCESSIBLES');
    } else {
      console.log('⚠️  CERTAINES TABLES SONT MANQUANTES');
    }
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error: any) {
    console.error('\n❌ Erreur lors de la vérification:', error.message);
    process.exit(1);
  }
}

// Exécuter
main().catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});
