404 /**
 * Script pour créer les tables Athena pour Smart Money SEC Sync
 * 
 * Exécute automatiquement:
 * 1. Les CREATE TABLE depuis le DDL SQL
 * 2. Les MSCK REPAIR TABLE pour chaque table
 * 
 * Usage:
 *   npx tsx scripts/create_athena_smart_money_tables.ts
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
  console.log(query.substring(0, 100) + (query.length > 100 ? '...' : ''));

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
  const maxAttempts = 60; // 5 minutes max

  while (status === 'RUNNING' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Attendre 2 secondes

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
      console.log('   ✅ Requête exécutée avec succès');
      return;
    }

    attempts++;
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Athena query did not complete: ${status}`);
  }
}

/**
 * Parser le fichier SQL et extraire les requêtes CREATE TABLE
 */
function parseSQLFile(filePath: string): { createTables: string[]; tableNames: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const createTables: string[] = [];
  const tableNames: string[] = [];

  // Nettoyer le contenu (enlever les commentaires de ligne)
  const lines = content.split('\n');
  const cleanedLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Ignorer les lignes de commentaires (--)
    if (trimmed.startsWith('--')) {
      continue;
    }
    cleanedLines.push(line);
  }
  const cleanedContent = cleanedLines.join('\n');

  // Extraire les CREATE TABLE (gérer les requêtes multi-lignes)
  // Pattern: CREATE EXTERNAL TABLE IF NOT EXISTS table_name ... jusqu'au point-virgule final
  const createTableRegex = /CREATE\s+EXTERNAL\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)[\s\S]*?;/gi;
  let match;

  while ((match = createTableRegex.exec(cleanedContent)) !== null) {
    const fullMatch = match[0].trim();
    const tableName = match[1];
    
    // Ignorer les MSCK REPAIR dans la requête CREATE TABLE
    const withoutMsck = fullMatch.replace(/MSCK\s+REPAIR\s+TABLE\s+\w+\s*;/gi, '').trim();
    
    if (withoutMsck && withoutMsck.length > 0) {
      createTables.push(withoutMsck);
      tableNames.push(tableName);
    }
  }

  return { createTables, tableNames };
}

/**
 * Fonction principale
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 CRÉATION DES TABLES ATHENA POUR SMART MONEY SEC SYNC');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Configuration:`);
  console.log(`   Database: ${ATHENA_DATABASE}`);
  console.log(`   WorkGroup: ${ATHENA_WORK_GROUP}`);
  console.log(`   Region: ${process.env.AWS_REGION || 'eu-west-3'}`);

  const sqlFilePath = path.resolve(process.cwd(), 'infra/athena/ddl/create_sec_smart_money_tables.sql');
  
  if (!fs.existsSync(sqlFilePath)) {
    console.error(`\n❌ Erreur: Fichier SQL non trouvé: ${sqlFilePath}`);
    process.exit(1);
  }

  console.log(`\n📄 Lecture du fichier: ${sqlFilePath}`);

  // Parser le fichier SQL
  const { createTables, tableNames } = parseSQLFile(sqlFilePath);

  if (createTables.length === 0) {
    console.error('\n❌ Erreur: Aucune table CREATE TABLE trouvée dans le fichier SQL');
    process.exit(1);
  }

  console.log(`\n📋 ${createTables.length} table(s) trouvée(s):`);
  tableNames.forEach((name, index) => {
    console.log(`   ${index + 1}. ${name}`);
  });

  // Créer les tables
  console.log('\n🔨 Création des tables...');
  for (let i = 0; i < createTables.length; i++) {
    const tableName = tableNames[i];
    const createQuery = createTables[i];

    try {
      console.log(`\n📊 Création de la table: ${tableName}`);
      await executeAthenaQuery(createQuery);
    } catch (error: any) {
      console.error(`\n❌ Erreur lors de la création de ${tableName}:`, error.message);
      // Continuer avec les autres tables
    }
  }

  // Exécuter MSCK REPAIR TABLE pour chaque table
  console.log('\n🔧 Exécution de MSCK REPAIR TABLE...');
  for (const tableName of tableNames) {
    try {
      console.log(`\n🔧 MSCK REPAIR TABLE ${tableName}...`);
      await executeAthenaQuery(`MSCK REPAIR TABLE ${tableName};`);
    } catch (error: any) {
      console.error(`\n⚠️  Erreur lors de MSCK REPAIR pour ${tableName}:`, error.message);
      // Note: Certaines tables peuvent ne pas être partitionnées, c'est normal
      if (!error.message.includes('not partitioned')) {
        console.warn(`   (Peut être normal si la table n'est pas partitionnée)`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ CRÉATION DES TABLES TERMINÉE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Tables créées:`);
  tableNames.forEach((name, index) => {
    console.log(`   ${index + 1}. ${name}`);
  });
  console.log('\n💡 Vérifiez les tables dans Athena Console si nécessaire');
}

// Exécuter
main().catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});
