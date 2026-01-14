/**
 * Vérifier que le déploiement Athena est correct
 * 
 * Usage:
 *   npx tsx scripts/verify_athena_deployment.ts
 */

import { LambdaClient, GetFunctionConfigurationCommand } from '@aws-sdk/client-lambda';
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

const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || 'eu-west-3',
});

const LAMBDA_FUNCTION_NAME = process.env.LAMBDA_FUNCTION_NAME || 'adel-ai-dev-api';

async function verifyDeployment() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Vérification du Déploiement Athena');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 Configuration:');
  console.log(`   - Lambda: ${LAMBDA_FUNCTION_NAME}`);
  console.log(`   - Region: ${process.env.AWS_REGION || 'eu-west-3'}\n`);

  try {
    const command = new GetFunctionConfigurationCommand({
      FunctionName: LAMBDA_FUNCTION_NAME,
    });

    const response = await lambdaClient.send(command);
    const envVars = response.Environment?.Variables || {};

    console.log('✅ Lambda trouvée\n');

    // Vérifier les variables d'environnement Athena
    const requiredVars = [
      'USE_ATHENA',
      'ATHENA_DATABASE',
      'ATHENA_WORK_GROUP',
      'ATHENA_RESULTS_BUCKET',
      'S3_DATA_LAKE_BUCKET',
      'USE_S3_WRITES',
    ];

    console.log('📋 Variables d\'environnement:\n');

    let allPresent = true;
    for (const varName of requiredVars) {
      const value = envVars[varName];
      if (value) {
        const displayValue = varName.includes('KEY') || varName.includes('PASSWORD') 
          ? '***' 
          : value;
        console.log(`   ✅ ${varName.padEnd(25)} = ${displayValue}`);
      } else {
        console.log(`   ❌ ${varName.padEnd(25)} = (manquant)`);
        allPresent = false;
      }
    }

    console.log('\n');

    // Vérifier USE_ATHENA
    if (envVars.USE_ATHENA === 'true') {
      console.log('✅ USE_ATHENA=true est activé\n');
    } else {
      console.log('⚠️  USE_ATHENA n\'est pas activé ou est false\n');
    }

    // Vérifier USE_S3_WRITES
    if (envVars.USE_S3_WRITES === 'true') {
      console.log('✅ USE_S3_WRITES=true est activé\n');
    } else {
      console.log('ℹ️  USE_S3_WRITES=false (normal pour migration progressive)\n');
    }

    // Résumé
    console.log('═══════════════════════════════════════════════════════════');
    if (allPresent && envVars.USE_ATHENA === 'true') {
      console.log('✅ Déploiement réussi! Athena est activé.');
      console.log('\n💡 Prochaines étapes:');
      console.log('   1. Tester les routes API:');
      console.log('      npx tsx scripts/test_api_routes_with_athena.ts <TOKEN>');
      console.log('   2. Monitorer les performances:');
      console.log('      npx tsx scripts/monitor_athena_performance.ts');
    } else {
      console.log('⚠️  Déploiement incomplet. Vérifier les variables manquantes.');
    }
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification:', error.message);
    if (error.name === 'ResourceNotFoundException') {
      console.error('   💡 La Lambda n\'existe pas ou le nom est incorrect');
    } else if (error.name === 'AccessDeniedException') {
      console.error('   💡 Permissions insuffisantes. Vérifier les credentials AWS');
    }
    process.exit(1);
  }
}

verifyDeployment().catch(console.error);
