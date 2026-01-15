/**
 * Script pour envoyer des alertes Telegram pour les Top Signals existants
 * 
 * Usage:
 *   TELEGRAM_BOT_TOKEN="your_token" TELEGRAM_CHAT_ID="your_chat_id" npx tsx scripts/send_telegram_alerts_for_signals.ts
 */

import { executeAthenaQuery } from '../services/api/src/athena/query';
import { alertTopSignals } from '../services/api/src/services/signal-alerts.service';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('❌ Erreur: TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID sont requis');
  console.error('Usage: TELEGRAM_BOT_TOKEN="token" TELEGRAM_CHAT_ID="chat_id" npx tsx scripts/send_telegram_alerts_for_signals.ts');
  process.exit(1);
}

async function sendAlertsForRecentSignals() {
  console.log('🔍 Récupération des Top Signals récents...');
  
  // Récupérer les 10 derniers signals uniques avec score >= 8
  // Grouper par (insider_name, ticker, transaction_date, total_value) pour éviter les doublons
  const query = `
    SELECT 
      ts.id,
      ts.company_id,
      ts.filing_id,
      ts.insider_name,
      ts.insider_cik,
      ts.insider_title,
      ts.relation,
      ts.transaction_type,
      ts.shares,
      ts.price_per_share,
      ts.total_value,
      CAST(ts.transaction_date AS VARCHAR) as transaction_date,
      ts.signal_score,
      CAST(ts.created_at AS VARCHAR) as created_at,
      c.ticker,
      c.name as company_name,
      cf.accession_number,
      CAST(cf.filing_date AS VARCHAR) as filing_date,
      ROW_NUMBER() OVER (
        PARTITION BY ts.insider_name, c.ticker, ts.transaction_date, ts.total_value 
        ORDER BY ts.created_at DESC
      ) as row_num
    FROM top_insider_signals ts
    LEFT JOIN companies c ON ts.company_id = c.id
    LEFT JOIN company_filings cf ON ts.filing_id = cf.id
    WHERE ts.signal_score >= 8
  ) ranked
  WHERE row_num = 1
  ORDER BY transaction_date DESC, created_at DESC
  LIMIT 10
  `;

  const results = await executeAthenaQuery(query);
  
  if (results.length === 0) {
    console.log('⚠️  Aucun signal trouvé avec score >= 8');
    return;
  }

  console.log(`✅ ${results.length} signals trouvés`);
  
  // Mapper les résultats
  const signals = results.map((row: any) => ({
    id: parseInt(row.id || '0', 10),
    company_id: row.company_id ? parseInt(row.company_id, 10) : null,
    filing_id: row.filing_id ? parseInt(row.filing_id, 10) : null,
    insider_name: row.insider_name || null,
    insider_cik: row.insider_cik || null,
    insider_title: row.insider_title || null,
    relation: row.relation || null,
    transaction_type: row.transaction_type || null,
    shares: row.shares ? parseInt(row.shares, 10) : null,
    price_per_share: row.price_per_share ? parseFloat(row.price_per_share) : null,
    total_value: row.total_value ? parseFloat(row.total_value) : null,
    transaction_date: row.transaction_date || null,
    signal_score: row.signal_score ? parseInt(row.signal_score, 10) : null,
    created_at: row.created_at || null,
    ticker: row.ticker || null,
    company_name: row.company_name || null,
    accession_number: row.accession_number || null,
    filing_date: row.filing_date || null,
  }));

  console.log('\n📋 Signals à envoyer:');
  signals.forEach((signal, index) => {
    console.log(`  ${index + 1}. ${signal.ticker || 'N/A'} - ${signal.insider_name} - Score: ${signal.signal_score} - $${signal.total_value?.toLocaleString() || '0'}`);
  });

  console.log('\n📤 Envoi des alertes Telegram...');
  
  const alertConfig = {
    telegramBotToken: TELEGRAM_BOT_TOKEN,
    telegramChatId: TELEGRAM_CHAT_ID,
  };

  const result = await alertTopSignals(signals, alertConfig);
  
  console.log(`\n✅ Résultat:`);
  console.log(`   - Alertes envoyées: ${result.sent}`);
  console.log(`   - Échecs: ${result.failed}`);
  
  if (result.failed > 0) {
    console.log('\n⚠️  Certaines alertes ont échoué. Vérifiez les logs ci-dessus.');
  }
}

sendAlertsForRecentSignals()
  .then(() => {
    console.log('\n✅ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  });
