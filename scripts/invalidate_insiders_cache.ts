/**
 * Script pour invalider le cache DynamoDB des insiders
 * 
 * Usage:
 *   npx tsx scripts/invalidate_insiders_cache.ts
 */

// Charger les variables d'environnement si disponibles
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: '.env.local' });
} catch (e) {
  // dotenv n'est pas disponible
}

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-3' })
);

const INSIDERS_CACHE_TABLE = process.env.INSIDERS_CACHE_TABLE || 'adel-ai-dev-insiders-cache';

async function invalidateCache() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🗑️  Invalidation du cache DynamoDB Insiders');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Scanner tous les items
    console.log('🔍 Scan de tous les items du cache...');
    const scanCommand = new ScanCommand({
      TableName: INSIDERS_CACHE_TABLE,
    });

    const response = await dynamoClient.send(scanCommand);
    const items = response.Items || [];

    console.log(`📦 Total: ${items.length} item(s) trouvé(s)\n`);

    if (items.length === 0) {
      console.log('✅ Cache déjà vide\n');
      return;
    }

    // Supprimer tous les items
    console.log('🗑️  Suppression des items...');
    let deletedCount = 0;

    for (const item of items) {
      try {
        const deleteCommand = new DeleteCommand({
          TableName: INSIDERS_CACHE_TABLE,
          Key: {
            cache_key: item.cache_key,
          },
        });

        await dynamoClient.send(deleteCommand);
        deletedCount++;
        
        if (deletedCount % 10 === 0) {
          console.log(`   ✅ ${deletedCount}/${items.length} supprimé(s)`);
        }
      } catch (error: any) {
        console.error(`   ❌ Erreur lors de la suppression de ${item.cache_key}:`, error.message);
      }
    }

    console.log(`\n✅ ${deletedCount} item(s) supprimé(s) au total\n`);
    console.log('💡 Le cache sera régénéré avec les nouvelles données au prochain appel API\n');

  } catch (error: any) {
    console.error('\n❌ Erreur lors de l\'invalidation:', error.message);
    console.error(error);
    process.exit(1);
  }
}

invalidateCache().catch(console.error);
