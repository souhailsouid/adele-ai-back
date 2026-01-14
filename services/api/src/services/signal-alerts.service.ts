/**
 * Service d'alertes pour les Top Signals
 * 
 * Envoie des notifications Discord/Telegram lorsqu'un Top Signal est détecté
 */

import { filterTopSignals, TopInsiderSignal } from './top-signals.service';

export interface AlertConfig {
  telegramBotToken?: string;
  telegramChatId?: string;
  discordWebhookUrl?: string;
  emailRecipients?: string[];
}

/**
 * Formater un Top Signal pour Discord
 */
function formatSignalForDiscord(signal: TopInsiderSignal & { ticker?: string; company_name?: string; accession_number?: string }): string {
  const secUrl = signal.accession_number && signal.insider_cik
    ? `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${signal.insider_cik}&accession_number=${signal.accession_number}&xbrl_type=v`
    : null;

  return `🔥 **TOP INSIDER SIGNAL DETECTED**

**${signal.ticker || 'N/A'}** - ${signal.company_name || 'Unknown Company'}
👤 **${signal.insider_name}** (${signal.insider_title || signal.relation || 'N/A'})
📊 **${signal.transaction_type.toUpperCase()}** - ${signal.shares?.toLocaleString() || 'N/A'} shares @ $${signal.price_per_share?.toFixed(2) || '0.00'}
💰 **Total: $${signal.total_value?.toLocaleString() || '0'}**
⭐ **Score: ${signal.signal_score}/10**
📅 Date: ${signal.transaction_date || 'N/A'}

${secUrl ? `📄 [View SEC Filing](${secUrl})` : ''}`;
}

/**
 * Formater un Top Signal pour Telegram
 */
function formatSignalForTelegram(signal: TopInsiderSignal & { ticker?: string; company_name?: string; accession_number?: string }): string {
  const secUrl = signal.accession_number && signal.insider_cik
    ? `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${signal.insider_cik}&accession_number=${signal.accession_number}&xbrl_type=v`
    : null;

  return `🔥 *TOP INSIDER SIGNAL DETECTED*

*${signal.ticker || 'N/A'}* - ${signal.company_name || 'Unknown Company'}
👤 *${signal.insider_name}* (${signal.insider_title || signal.relation || 'N/A'})
📊 *${signal.transaction_type.toUpperCase()}* - ${signal.shares?.toLocaleString() || 'N/A'} shares @ $${signal.price_per_share?.toFixed(2) || '0.00'}
💰 *Total: $${signal.total_value?.toLocaleString() || '0'}*
⭐ *Score: ${signal.signal_score}/10*
📅 Date: ${signal.transaction_date || 'N/A'}

${secUrl ? `📄 [View SEC Filing](${secUrl})` : ''}`;
}

/**
 * Envoyer une alerte Discord
 */
async function sendDiscordAlert(signal: TopInsiderSignal & { ticker?: string; company_name?: string; accession_number?: string }, webhookUrl: string): Promise<void> {
  try {
    const message = formatSignalForDiscord(signal);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message,
      }),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
    }

    console.log(`[Signal Alerts] ✅ Discord alert sent for ${signal.ticker || 'N/A'}`);
  } catch (error: any) {
    console.error(`[Signal Alerts] ❌ Error sending Discord alert:`, error.message);
    throw error;
  }
}

/**
 * Envoyer une alerte Telegram
 */
async function sendTelegramAlert(
  signal: TopInsiderSignal & { ticker?: string; company_name?: string; accession_number?: string },
  botToken: string,
  chatId: string
): Promise<void> {
  try {
    const message = formatSignalForTelegram(signal);
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Telegram API failed: ${error.description || response.statusText}`);
    }

    console.log(`[Signal Alerts] ✅ Telegram alert sent for ${signal.ticker || 'N/A'}`);
  } catch (error: any) {
    console.error(`[Signal Alerts] ❌ Error sending Telegram alert:`, error.message);
    throw error;
  }
}

/**
 * Envoyer des alertes pour les Top Signals détectés
 */
export async function alertTopSignals(
  signals: TopInsiderSignal[],
  config: AlertConfig
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const signal of signals) {
    try {
      // Discord
      if (config.discordWebhookUrl) {
        await sendDiscordAlert(signal, config.discordWebhookUrl);
        sent++;
      }

      // Telegram
      if (config.telegramBotToken && config.telegramChatId) {
        await sendTelegramAlert(signal, config.telegramBotToken, config.telegramChatId);
        sent++;
      }
    } catch (error: any) {
      console.error(`[Signal Alerts] Failed to send alert for signal ${signal.id}:`, error.message);
      failed++;
    }
  }

  return { sent, failed };
}
