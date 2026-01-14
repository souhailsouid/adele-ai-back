/**
 * Script de test pour les alertes Telegram
 * 
 * Usage:
 *   npx tsx scripts/test_telegram_alert.ts
 * 
 * Variables d'environnement requises:
 *   TELEGRAM_BOT_TOKEN=8327759989:AAGa8KWU5jJX8Tarm_hLGvkM38Vipgcr8EY
 *   TELEGRAM_CHAT_ID=<votre_chat_id>
 */

import { alertTopSignals } from '../services/api/src/services/signal-alerts.service';
import { TopInsiderSignal } from '../services/api/src/services/top-signals.service';

async function testTelegramAlert() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TEST D\'ALERTE TELEGRAM');
  console.log('═══════════════════════════════════════════════════════════\n');

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN non défini dans les variables d\'environnement');
    console.log('\n💡 Pour définir:');
    console.log('   export TELEGRAM_BOT_TOKEN="8327759989:AAGa8KWU5jJX8Tarm_hLGvkM38Vipgcr8EY"');
    process.exit(1);
  }

  if (!chatId || chatId === '<votre_chat_id>') {
    console.error('❌ TELEGRAM_CHAT_ID non défini ou invalide');
    console.log('\n💡 Pour obtenir votre chat_id:');
    console.log('   1. Définissez d\'abord le token:');
    console.log(`      export TELEGRAM_BOT_TOKEN="${botToken}"`);
    console.log('   2. Exécutez le script:');
    console.log('      npx tsx scripts/get_telegram_chat_id.ts');
    console.log('   3. Ou utilisez cette méthode manuelle:');
    console.log(`      - Visitez: https://api.telegram.org/bot${botToken}/getUpdates`);
    console.log('      - Envoyez d\'abord un message à @boumbobot sur Telegram');
    console.log('      - Cherchez "chat":{"id":... dans la réponse JSON');
    console.log('      - Le chat_id est le nombre après "id": (ex: 123456789)');
    console.log('   4. Définissez ensuite:');
    console.log('      export TELEGRAM_CHAT_ID="<le_nombre_trouvé>"');
    process.exit(1);
  }

  // Créer un signal de test
  const testSignal: TopInsiderSignal & { ticker?: string; company_name?: string; accession_number?: string } = {
    id: Date.now(),
    company_id: 1,
    filing_id: 1,
    insider_name: 'John Doe',
    insider_cik: '0001234567',
    insider_title: 'CEO',
    relation: 'Chief Executive Officer',
    transaction_type: 'Purchase',
    shares: 10000,
    price_per_share: 150.50,
    total_value: 1505000,
    transaction_date: new Date().toISOString().split('T')[0],
    signal_score: 10,
    created_at: new Date().toISOString(),
    ticker: 'AAPL',
    company_name: 'Apple Inc.',
    accession_number: '0001234567-25-000001',
  };

  console.log('📤 Envoi d\'un signal de test...');
  console.log(`   Bot: @boumbobot`);
  console.log(`   Chat ID: ${chatId}`);
  console.log(`   Signal: ${testSignal.ticker} - ${testSignal.insider_name} (${testSignal.total_value?.toLocaleString()}$)`);
  console.log('');

  try {
    const result = await alertTopSignals([testSignal], {
      telegramBotToken: botToken,
      telegramChatId: chatId,
    });

    if (result.sent > 0) {
      console.log('✅ Alerte envoyée avec succès !');
      console.log(`   Vérifiez votre conversation avec @boumbobot sur Telegram`);
    } else {
      console.log('❌ Aucune alerte envoyée');
    }

    if (result.failed > 0) {
      console.log(`⚠️ ${result.failed} alerte(s) échouée(s)`);
    }
  } catch (error: any) {
    console.error('❌ Erreur lors de l\'envoi:', error.message);
    console.error(error);
    process.exit(1);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ TEST TERMINÉ');
  console.log('═══════════════════════════════════════════════════════════');
}

testTelegramAlert().catch(console.error);
