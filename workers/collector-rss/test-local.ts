/**
 * Script de test local pour collector-rss
 * Usage: npx tsx test-local.ts
 * 
 * Prérequis:
 * 1. Créer un fichier .env dans workers/collector-rss/ avec:
 *    SUPABASE_URL=https://votre-projet.supabase.co
 *    SUPABASE_SERVICE_KEY=votre-service-key
 *    EVENT_BUS_NAME=adel-signals-bus (optionnel)
 * 
 * 2. Installer les dépendances: npm install
 */

import { handler } from './src/index';
import { EventBridgeEvent } from 'aws-lambda';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

// Vérifier les variables requises
const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
const missingVars = requiredVars.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error('❌ Variables d\'environnement manquantes:');
  missingVars.forEach(v => console.error(`   - ${v}`));
  console.error(`\n💡 Créez un fichier .env dans ${__dirname}/ avec ces variables.`);
  process.exit(1);
}

console.log('✅ Variables d\'environnement chargées:');
console.log(`   - SUPABASE_URL: ${process.env.SUPABASE_URL?.substring(0, 30)}...`);
console.log(`   - SUPABASE_SERVICE_KEY: ${process.env.SUPABASE_SERVICE_KEY ? '✅ Définie' : '❌ Manquante'}`);
console.log(`   - EVENT_BUS_NAME: ${process.env.EVENT_BUS_NAME || 'Non défini (optionnel)'}\n`);

// Simuler un événement EventBridge
const mockEvent: EventBridgeEvent<"Scheduled Event", any> = {
  version: '0',
  id: 'test-event-id',
  'detail-type': 'Scheduled Event',
  source: 'aws.events',
  account: '123456789012',
  time: new Date().toISOString(),
  region: 'us-east-1',
  resources: [],
  detail: {},
};

async function test() {
  console.log('🚀 Démarrage du test collector-rss...\n');
  console.log('📡 Test des flux RSS:');
  console.log('   - Reuters');
  console.log('   - AP News');
  console.log('   - Yahoo Finance');
  console.log('   - CNBC');
  console.log('   - MarketWatch');
  console.log('   - Financial Juice (NOUVEAU)\n');

  const startTime = Date.now();

  try {
    const result = await handler(mockEvent);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n✅ Test réussi !');
    console.log(`⏱️  Durée: ${duration}s`);
    console.log('📊 Résultat:', JSON.stringify(result, null, 2));
    
    console.log('\n💡 Prochaines étapes:');
    console.log('   1. Vérifiez les signaux dans Supabase:');
    console.log('      SELECT * FROM signals WHERE source = \'rss\' ORDER BY created_at DESC LIMIT 10;');
    console.log('   2. Vérifiez qu\'il n\'y a pas de doublons');
    console.log('   3. Si tout fonctionne, on peut ajouter Financial Juice RSS !');
  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.error('\n❌ Test échoué !');
    console.error(`⏱️  Durée: ${duration}s`);
    console.error('🔴 Erreur:', error.message);
    
    if (error.stack) {
      console.error('\n📋 Stack trace:');
      console.error(error.stack);
    }
    
    console.error('\n💡 Vérifications:');
    console.error('   1. Les variables d\'environnement sont-elles correctes ?');
    console.error('   2. Supabase est-il accessible ?');
    console.error('   3. Les flux RSS sont-ils accessibles ?');
    
    process.exit(1);
  }
}

test();

