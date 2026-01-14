/**
 * Script pour obtenir votre Telegram Chat ID
 * 
 * Usage:
 *   export TELEGRAM_BOT_TOKEN="8327759989:AAGa8KWU5jJX8Tarm_hLGvkM38Vipgcr8EY"
 *   npx tsx scripts/get_telegram_chat_id.ts
 */

async function getTelegramChatId() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN non défini');
    console.log('\n💡 Définissez:');
    console.log('   export TELEGRAM_BOT_TOKEN="8327759989:AAGa8KWU5jJX8Tarm_hLGvkM38Vipgcr8EY"');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 RÉCUPÉRATION DU CHAT ID TELEGRAM');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📋 Instructions:');
  console.log('   1. Ouvrez Telegram et commencez une conversation avec @boumbobot');
  console.log('   2. Envoyez un message (ex: /start ou "Hello")');
  console.log('   3. Attendez 2-3 secondes puis appuyez sur Entrée pour continuer...\n');
  console.log('⏳ En attente que vous envoyiez un message au bot...\n');

  // Attendre que l'utilisateur envoie un message
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve(undefined));
  });

  // Attendre un peu pour que Telegram traite le message
  console.log('⏳ Attente de 2 secondes pour que Telegram traite le message...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    const url = `https://api.telegram.org/bot${botToken}/getUpdates`;
    console.log(`📡 Récupération des mises à jour depuis: ${url}\n`);

    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.description || 'API Telegram error');
    }

    if (!data.result || data.result.length === 0) {
      console.log('⚠️ Aucun message trouvé.');
      console.log('\n💡 Solutions:');
      console.log('   1. Vérifiez que vous avez bien envoyé un message à @boumbobot');
      console.log('   2. Attendez quelques secondes et réessayez');
      console.log('   3. Ou utilisez cette méthode alternative:');
      console.log(`      - Visitez: https://api.telegram.org/bot${botToken}/getUpdates`);
      console.log('      - Cherchez "chat":{"id":... dans la réponse JSON');
      console.log('      - Le chat_id est le nombre après "id":');
      process.exit(1);
    }

    // Extraire tous les chat IDs uniques
    const chatIds = new Set<number>();
    data.result.forEach((update: any) => {
      if (update.message?.chat?.id) {
        chatIds.add(update.message.chat.id);
      }
    });

    if (chatIds.size === 0) {
      console.log('⚠️ Aucun chat ID trouvé dans les mises à jour');
      process.exit(1);
    }

    console.log('✅ Chat ID(s) trouvé(s):\n');
    chatIds.forEach(chatId => {
      console.log(`   💬 Chat ID: ${chatId}`);
      console.log(`   📝 Définissez: export TELEGRAM_CHAT_ID="${chatId}"`);
      console.log('');
    });

    console.log('💡 Pour tester l\'alerte:');
    console.log('   npx tsx scripts/test_telegram_alert.ts\n');

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
    process.exit(1);
  }
}

getTelegramChatId().catch(console.error);
