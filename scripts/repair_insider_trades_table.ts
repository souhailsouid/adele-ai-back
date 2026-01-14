/**
 * Script pour réparer la table Athena insider_trades
 * 
 * Exécute MSCK REPAIR TABLE pour détecter les nouveaux fichiers Parquet dans S3
 */

import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand } from '@aws-sdk/client-athena';

// Charger les variables d'environnement depuis .env si disponible
try {
  const dotenv = require('dotenv');
  dotenv.config();
} catch (e) {
  // dotenv non disponible, utiliser les variables d'environnement système
}

const ATHENA_DATABASE = process.env.ATHENA_DATABASE || 'adel_ai_dev';
const ATHENA_WORK_GROUP = process.env.ATHENA_WORK_GROUP || 'adel-ai-dev-workgroup';
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET || 'adel-ai-dev-athena-results';

const athenaClient = new AthenaClient({
  region: process.env.AWS_REGION || 'eu-west-3',
});

async function executeAthenaQuery(query: string): Promise<void> {
  console.log(`\n📝 Exécution: ${query}\n`);

  const startResponse = await athenaClient.send(
    new StartQueryExecutionCommand({
      QueryString: query,
      QueryExecutionContext: {
        Database: ATHENA_DATABASE,
      },
      ResultConfiguration: {
        OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/`,
      },
      WorkGroup: ATHENA_WORK_GROUP,
    })
  );

  const queryExecutionId = startResponse.QueryExecutionId;
  if (!queryExecutionId) {
    throw new Error('Query execution ID not returned');
  }

  console.log(`   Query ID: ${queryExecutionId}`);

  // Attendre la fin de l'exécution
  let status = 'RUNNING';
  while (status === 'RUNNING' || status === 'QUEUED') {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const statusResponse = await athenaClient.send(
      new GetQueryExecutionCommand({
        QueryExecutionId: queryExecutionId,
      })
    );

    status = statusResponse.QueryExecution?.Status?.State || 'UNKNOWN';
    console.log(`   Status: ${status}`);
  }

  if (status !== 'SUCCEEDED') {
    const error = statusResponse.QueryExecution?.Status?.StateChangeReason;
    throw new Error(`Query failed: ${error || status}`);
  }

  console.log('   ✅ Requête exécutée avec succès!');
}

async function repairInsiderTradesTable() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔧 Réparation de la table Athena: insider_trades');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 Configuration:');
  console.log(`   - Database: ${ATHENA_DATABASE}`);
  console.log(`   - Work Group: ${ATHENA_WORK_GROUP}`);
  console.log(`   - S3 Data Lake: s3://adel-ai-dev-data-lake/data/insider_trades/\n`);

  try {
    // Étape 1: Vérifier que la table existe
    console.log('🔍 Étape 1: Vérification de l\'existence de la table...');
    try {
      await executeAthenaQuery('DESCRIBE insider_trades;');
      console.log('   ✅ Table existe\n');
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        console.log('   ❌ Table n\'existe pas!');
        console.log('   → Exécuter d\'abord: infra/athena/ddl/create_sec_smart_money_tables.sql\n');
        return;
      }
      throw error;
    }

    // Étape 2: Réparer la table (détecter les nouvelles partitions)
    console.log('🔄 Étape 2: Détection des partitions (MSCK REPAIR TABLE)...');
    await executeAthenaQuery('MSCK REPAIR TABLE insider_trades;');
    console.log('   ✅ Partitions détectées\n');

    // Étape 3: Vérifier les partitions
    console.log('🔍 Étape 3: Vérification des partitions...');
    await executeAthenaQuery('SHOW PARTITIONS insider_trades;');

    // Étape 4: Tester avec COUNT
    console.log('🧪 Étape 4: Test COUNT...');
    await executeAthenaQuery('SELECT COUNT(*) as total FROM insider_trades;');

    console.log('\n✅ Table réparée avec succès!');
    console.log('   → Les nouvelles données devraient maintenant être visibles\n');
  } catch (error: any) {
    console.error(`\n❌ Erreur: ${error.message}\n`);
    process.exit(1);
  }
}

repairInsiderTradesTable().catch(console.error);
