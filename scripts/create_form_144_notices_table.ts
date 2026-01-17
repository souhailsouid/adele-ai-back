/**
 * Script pour créer la table Athena form_144_notices
 */

import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand } from '@aws-sdk/client-athena';
import * as fs from 'fs';
import * as path from 'path';

const ATHENA_DATABASE = process.env.ATHENA_DATABASE || 'adel_ai_dev';
const ATHENA_WORK_GROUP = process.env.ATHENA_WORK_GROUP || 'adel-ai-dev-workgroup';
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET || 'adel-ai-dev-athena-results';

const athenaClient = new AthenaClient({});

async function createForm144NoticesTable() {
  console.log('📋 Création de la table form_144_notices...');
  
  // Lire le fichier SQL
  const sqlPath = path.join(__dirname, '../infra/athena/ddl/create_form_144_notices_table.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  
  // Remplacer le bucket S3 par la variable d'environnement si nécessaire
  const sqlWithBucket = sql.replace('adel-ai-dev-data-lake', process.env.S3_DATA_LAKE_BUCKET || 'adel-ai-dev-data-lake');
  
  console.log('🚀 Exécution de la requête DDL...');
  
  const queryExecution = await athenaClient.send(new StartQueryExecutionCommand({
    QueryString: sqlWithBucket,
    QueryExecutionContext: {
      Database: ATHENA_DATABASE,
    },
    ResultConfiguration: {
      OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/ddl/`,
    },
    WorkGroup: ATHENA_WORK_GROUP,
  }));
  
  const queryExecutionId = queryExecution.QueryExecutionId;
  if (!queryExecutionId) {
    throw new Error('Failed to start Athena query');
  }
  
  console.log(`📊 Query Execution ID: ${queryExecutionId}`);
  
  // Attendre que la requête soit terminée
  let status = 'RUNNING';
  while (status === 'RUNNING' || status === 'QUEUED') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const statusResult = await athenaClient.send(new GetQueryExecutionCommand({
      QueryExecutionId: queryExecutionId,
    }));
    status = statusResult.QueryExecution?.Status?.State || 'FAILED';
    
    if (status === 'FAILED' || status === 'CANCELLED') {
      const reason = statusResult.QueryExecution?.Status?.StateChangeReason || 'Unknown error';
      throw new Error(`Athena query failed: ${reason}`);
    }
    
    console.log(`⏳ Status: ${status}...`);
  }
  
  console.log('✅ Table form_144_notices créée avec succès!');
}

createForm144NoticesTable()
  .then(() => {
    console.log('✅ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });
