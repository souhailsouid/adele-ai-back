/**
 * Script pour ajouter la colonne insider_cik à la table insider_trades
 * 
 * Usage:
 *   npx tsx scripts/add_insider_cik_column.ts
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
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (key && value) {
          process.env[key.trim()] = value.trim();
        }
      }
    });
  }
}

const athenaClient = new AthenaClient({
  region: process.env.AWS_REGION || 'eu-west-3',
});

const ATHENA_DATABASE = process.env.ATHENA_DATABASE || 'adel_ai_dev';
const ATHENA_WORK_GROUP = process.env.ATHENA_WORK_GROUP || 'adel-ai-dev-workgroup';
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET || 'adel-ai-dev-athena-results';

/**
 * Exécuter une requête Athena et attendre le résultat
 */
async function executeAthenaQuery(query: string): Promise<void> {
  console.log(`\n📝 Exécution de la requête:`);
  console.log(query);
  console.log('');

  const startCommand = new StartQueryExecutionCommand({
    QueryString: query,
    QueryExecutionContext: {
      Database: ATHENA_DATABASE,
    },
    WorkGroup: ATHENA_WORK_GROUP,
    ResultConfiguration: {
      OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/`,
    },
  });

  const startResponse = await athenaClient.send(startCommand);
  const queryExecutionId = startResponse.QueryExecutionId;

  if (!queryExecutionId) {
    throw new Error('Failed to start query execution');
  }

  console.log(`⏳ Query Execution ID: ${queryExecutionId}`);
  console.log('⏳ En attente du résultat...');

  // Attendre que la requête soit terminée
  let status = 'RUNNING';
  while (status === 'RUNNING' || status === 'QUEUED') {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre 1 seconde

    const getCommand = new GetQueryExecutionCommand({
      QueryExecutionId: queryExecutionId,
    });

    const getResponse = await athenaClient.send(getCommand);
    status = getResponse.QueryExecution?.Status?.State || 'UNKNOWN';

    if (status === 'FAILED') {
      const reason = getResponse.QueryExecution?.Status?.StateChangeReason || 'Unknown error';
      throw new Error(`Query failed: ${reason}`);
    }

    if (status === 'CANCELLED') {
      throw new Error('Query was cancelled');
    }
  }

  console.log(`✅ Requête terminée avec succès (status: ${status})\n`);
}

/**
 * Vérifier si la colonne existe déjà
 */
async function checkColumnExists(): Promise<boolean> {
  try {
    const query = `
      DESCRIBE insider_trades
    `;
    
    const startCommand = new StartQueryExecutionCommand({
      QueryString: query,
      QueryExecutionContext: {
        Database: ATHENA_DATABASE,
      },
      WorkGroup: ATHENA_WORK_GROUP,
      ResultConfiguration: {
        OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/`,
      },
    });

    const startResponse = await athenaClient.send(startCommand);
    const queryExecutionId = startResponse.QueryExecutionId;

    if (!queryExecutionId) {
      return false;
    }

    // Attendre que la requête soit terminée
    let status = 'RUNNING';
    while (status === 'RUNNING' || status === 'QUEUED') {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const getCommand = new GetQueryExecutionCommand({
        QueryExecutionId: queryExecutionId,
      });

      const getResponse = await athenaClient.send(getCommand);
      status = getResponse.QueryExecution?.Status?.State || 'UNKNOWN';

      if (status === 'FAILED' || status === 'CANCELLED') {
        return false;
      }

      if (status === 'SUCCEEDED') {
        // Vérifier si la colonne existe dans les résultats
        // Note: Pour simplifier, on va juste essayer d'ajouter la colonne
        // Si elle existe déjà, Athena retournera une erreur qu'on gérera
        return false; // On ne peut pas facilement parser les résultats ici
      }
    }

    return false;
  } catch (error) {
    // Si la table n'existe pas, on retourne false
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔧 MIGRATION: Ajouter colonne insider_cik à insider_trades');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`📊 Database: ${ATHENA_DATABASE}`);
    console.log(`📊 Work Group: ${ATHENA_WORK_GROUP}\n`);

    // Vérifier si la table existe
    console.log('🔍 Vérification de l\'existence de la table...');
    try {
      await executeAthenaQuery('SHOW TABLES LIKE \'insider_trades\'');
      console.log('✅ La table insider_trades existe\n');
    } catch (error: any) {
      console.error('❌ La table insider_trades n\'existe pas encore.');
      console.error('   Veuillez d\'abord exécuter: npx tsx scripts/create_athena_smart_money_tables.ts\n');
      process.exit(1);
    }

    // Ajouter la colonne insider_cik
    console.log('📝 Ajout de la colonne insider_cik...');
    try {
      await executeAthenaQuery(`
        ALTER TABLE insider_trades ADD COLUMNS (
          insider_cik STRING COMMENT 'CIK du dirigeant (reporting owner)'
        )
      `);
      console.log('✅ Colonne insider_cik ajoutée avec succès\n');
    } catch (error: any) {
      if (error.message.includes('already exists') || error.message.includes('duplicate')) {
        console.log('⚠️  La colonne insider_cik existe déjà\n');
      } else {
        throw error;
      }
    }

    // Vérifier la structure de la table
    console.log('🔍 Vérification de la structure de la table...');
    await executeAthenaQuery('DESCRIBE insider_trades');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ MIGRATION TERMINÉE');
    console.log('═══════════════════════════════════════════════════════════');
  } catch (error: any) {
    console.error('\n❌ Erreur fatale:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
