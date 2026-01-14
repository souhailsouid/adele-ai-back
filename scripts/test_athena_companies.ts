/**
 * Script pour tester la table Athena "companies"
 * 
 * Usage:
 *   npx tsx scripts/test_athena_companies.ts
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

    // Ignorer la première row (headers)
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

async function testCompaniesTable() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 Test de la table Athena: companies');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Test 1: Count total
    console.log('📊 Test 1: Compter le total de companies...');
    const countResults = await executeAthenaQuery('SELECT COUNT(*) as total FROM companies;');
    const total = countResults[0]?.total || 0;
    console.log(`   ✅ Total: ${total.toLocaleString()} companies\n`);

    // Test 2: Sample data
    console.log('📋 Test 2: Récupérer 10 exemples...');
    const sampleResults = await executeAthenaQuery(`
      SELECT ticker, name, sector, industry, market_cap
      FROM companies
      WHERE ticker IS NOT NULL
      ORDER BY market_cap DESC NULLS LAST
      LIMIT 10
    `);
    
    console.log('   ✅ Exemples:');
    sampleResults.forEach((row, index) => {
      console.log(`   ${String(index + 1).padStart(2)}. ${(row.ticker || 'N/A').padEnd(8)} - ${(row.name || 'N/A').substring(0, 40).padEnd(40)} | ${row.sector || 'N/A'}`);
    });
    console.log('');

    // Test 3: Par secteur
    console.log('📈 Test 3: Compter par secteur...');
    const sectorResults = await executeAthenaQuery(`
      SELECT sector, COUNT(*) as count
      FROM companies
      WHERE sector IS NOT NULL
      GROUP BY sector
      ORDER BY count DESC
      LIMIT 10
    `);
    
    console.log('   ✅ Top secteurs:');
    sectorResults.forEach((row, index) => {
      console.log(`   ${String(index + 1).padStart(2)}. ${(row.sector || 'N/A').padEnd(30)} : ${row.count.toLocaleString()}`);
    });
    console.log('');

    // Test 4: Recherche par ticker
    console.log('🔍 Test 4: Recherche par ticker (AAPL)...');
    const tickerResults = await executeAthenaQuery(`
      SELECT ticker, name, sector, industry, market_cap
      FROM companies
      WHERE ticker = 'AAPL'
      LIMIT 1
    `);
    
    if (tickerResults.length > 0) {
      const company = tickerResults[0];
      console.log(`   ✅ Trouvé: ${company.name}`);
      console.log(`      Sector: ${company.sector || 'N/A'}`);
      console.log(`      Industry: ${company.industry || 'N/A'}`);
      console.log(`      Market Cap: ${company.market_cap ? `$${company.market_cap.toLocaleString()}` : 'N/A'}\n`);
    } else {
      console.log('   ⚠️  AAPL non trouvé\n');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Tous les tests ont réussi!');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('💡 La table Athena est prête à être utilisée dans le code API!');
    console.log('   Exemple: import { executeAthenaQuery } from \'@/athena/correlation\';\n');

  } catch (error: any) {
    console.error('\n❌ Erreur lors des tests:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testCompaniesTable().catch(console.error);
