/**
 * Script de monitoring des performances et coûts Athena
 * 
 * Usage:
 *   npx tsx scripts/monitor_athena_performance.ts
 */

import { AthenaClient, ListQueryExecutionsCommand, GetQueryExecutionCommand, BatchGetQueryExecutionCommand } from '@aws-sdk/client-athena';
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

const ATHENA_WORK_GROUP = process.env.ATHENA_WORK_GROUP || 'adel-ai-dev-workgroup';

interface QueryStats {
  total: number;
  succeeded: number;
  failed: number;
  avgDuration: number;
  totalDataScanned: number; // En bytes
  estimatedCost: number; // En dollars ($5/TB)
}

async function getRecentQueries(workGroup: string, maxResults: number = 50): Promise<string[]> {
  const command = new ListQueryExecutionsCommand({
    WorkGroup: workGroup,
    MaxResults: maxResults,
  });

  const response = await athenaClient.send(command);
  return response.QueryExecutionIds || [];
}

async function getQueryDetails(queryExecutionIds: string[]): Promise<any[]> {
  if (queryExecutionIds.length === 0) return [];

  const command = new BatchGetQueryExecutionCommand({
    QueryExecutionIds: queryExecutionIds,
  });

  const response = await athenaClient.send(command);
  return response.QueryExecutions || [];
}

async function calculateStats(queries: any[]): Promise<QueryStats> {
  let total = queries.length;
  let succeeded = 0;
  let failed = 0;
  let totalDuration = 0;
  let totalDataScanned = 0;

  for (const query of queries) {
    const status = query.Status?.State;
    if (status === 'SUCCEEDED') {
      succeeded++;
      const duration = query.Statistics?.TotalExecutionTimeInMillis || 0;
      totalDuration += duration;
      const dataScanned = query.Statistics?.DataScannedInBytes || 0;
      totalDataScanned += dataScanned;
    } else if (status === 'FAILED' || status === 'CANCELLED') {
      failed++;
    }
  }

  const avgDuration = succeeded > 0 ? totalDuration / succeeded : 0;
  const totalDataScannedTB = totalDataScanned / (1024 ** 4); // Convertir en TB
  const estimatedCost = totalDataScannedTB * 5; // $5/TB

  return {
    total,
    succeeded,
    failed,
    avgDuration: avgDuration / 1000, // Convertir en secondes
    totalDataScanned: totalDataScanned / (1024 ** 2), // Convertir en MB pour affichage
    estimatedCost,
  };
}

async function monitorAthena() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 Monitoring: Performances & Coûts Athena');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 Configuration:');
  console.log(`   - Work Group: ${ATHENA_WORK_GROUP}`);
  console.log(`   - Region: ${process.env.AWS_REGION || 'eu-west-3'}\n`);

  console.log('🔄 Récupération des requêtes récentes...\n');

  try {
    const queryIds = await getRecentQueries(ATHENA_WORK_GROUP, 50);
    
    if (queryIds.length === 0) {
      console.log('   ⚠️  Aucune requête récente trouvée');
      console.log('   💡 Cela peut signifier que USE_ATHENA=true n\'est pas encore activé en production\n');
      return;
    }

    console.log(`   ✅ ${queryIds.length} requêtes récentes trouvées\n`);

    const queries = await getQueryDetails(queryIds);
    const stats = await calculateStats(queries);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📈 STATISTIQUES');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`📊 Requêtes:`);
    console.log(`   - Total: ${stats.total}`);
    console.log(`   - Succès: ${stats.succeeded} (${((stats.succeeded / stats.total) * 100).toFixed(1)}%)`);
    console.log(`   - Échecs: ${stats.failed} (${((stats.failed / stats.total) * 100).toFixed(1)}%)\n`);

    console.log(`⚡ Performance:`);
    console.log(`   - Durée moyenne: ${stats.avgDuration.toFixed(2)}s`);
    console.log(`   - Données scannées: ${stats.totalDataScanned.toFixed(2)} MB\n`);

    console.log(`💰 Coûts:`);
    console.log(`   - Coût estimé: $${stats.estimatedCost.toFixed(4)}`);
    console.log(`   - Coût par requête: $${(stats.estimatedCost / stats.succeeded || 0).toFixed(6)}`);
    console.log(`   - Projection mensuelle (si même rythme): $${(stats.estimatedCost * 30).toFixed(2)}\n`);

    // Afficher les dernières requêtes
    const recentQueries = queries
      .filter(q => q.Status?.State === 'SUCCEEDED')
      .sort((a, b) => {
        const timeA = new Date(a.Status?.SubmissionDateTime || 0).getTime();
        const timeB = new Date(b.Status?.SubmissionDateTime || 0).getTime();
        return timeB - timeA;
      })
      .slice(0, 5);

    if (recentQueries.length > 0) {
      console.log('🕐 Dernières requêtes réussies:\n');
      recentQueries.forEach((query, index) => {
        const duration = (query.Statistics?.TotalExecutionTimeInMillis || 0) / 1000;
        const dataScanned = (query.Statistics?.DataScannedInBytes || 0) / (1024 ** 2);
        const cost = (dataScanned / 1024) * 5; // MB -> TB -> $
        const time = new Date(query.Status?.SubmissionDateTime || 0).toLocaleString();
        
        console.log(`   ${index + 1}. ${time}`);
        console.log(`      Durée: ${duration.toFixed(2)}s | Données: ${dataScanned.toFixed(2)} MB | Coût: $${cost.toFixed(6)}`);
        if (query.Query) {
          const queryPreview = query.Query.substring(0, 80).replace(/\n/g, ' ');
          console.log(`      Query: ${queryPreview}...`);
        }
        console.log();
      });
    }

    // Recommandations
    console.log('💡 Recommandations:\n');
    if (stats.avgDuration > 10) {
      console.log('   ⚠️  Latence élevée (> 10s). Vérifier:');
      console.log('      - Les partitions sont-elles correctement configurées?');
      console.log('      - Les requêtes utilisent-elles WHERE avec partitions?');
    } else {
      console.log('   ✅ Latence acceptable (< 10s)');
    }

    if (stats.estimatedCost > 1) {
      console.log('   ⚠️  Coût élevé détecté. Optimiser:');
      console.log('      - Utiliser S3 direct read pour les lookups simples');
      console.log('      - Activer le cache pour les requêtes fréquentes');
      console.log('      - Filtrer avec partitions (year, month)');
    } else {
      console.log('   ✅ Coûts raisonnables');
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');
  } catch (error: any) {
    console.error('❌ Erreur lors du monitoring:', error.message);
    if (error.message.includes('AccessDenied')) {
      console.error('   💡 Vérifier les permissions IAM pour Athena');
    }
  }
}

monitorAthena().catch(console.error);
