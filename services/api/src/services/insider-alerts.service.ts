/**
 * Service d'alertes pour les transactions insider
 * 
 * Envoie des notifications (Telegram, Discord, Email) pour les transactions importantes
 */

import { executeAthenaQuery } from '../athena/query';
import { InsidersService, InsiderTransaction } from './insiders.service';

export interface AlertConfig {
  minBuyValue: number; // Seuil minimum pour alerter (ex: 100000 = 100k$)
  minSellValue: number;
  alertChannels: ('telegram' | 'discord' | 'email')[];
  telegramBotToken?: string;
  telegramChatId?: string;
  discordWebhookUrl?: string;
  emailRecipients?: string[];
}

export interface InsiderAlert {
  transaction: InsiderTransaction;
  alert_type: 'buy' | 'sell' | 'large_buy' | 'large_sell';
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export class InsiderAlertsService {
  private insidersService: InsidersService;
  private defaultConfig: AlertConfig = {
    minBuyValue: 100000, // 100k$
    minSellValue: 500000, // 500k$ (ventes plus importantes)
    alertChannels: [],
  };

  constructor(config?: Partial<AlertConfig>) {
    this.insidersService = new InsidersService();
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  /**
   * Scanner les nouvelles transactions et générer des alertes
   * 
   * À appeler depuis un cron job ou après parsing d'un Form 4
   */
  async scanAndAlertNewTransactions(
    sinceDate?: string,
    config?: Partial<AlertConfig>
  ): Promise<InsiderAlert[]> {
    const alertConfig = { ...this.defaultConfig, ...config };
    const since = sinceDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Récupérer les transactions récentes avec alert_flag = true ou valeur importante
    const query = `
      SELECT 
        it.id,
        it.company_id,
        it.filing_id,
        it.insider_name,
        it.insider_cik,
        it.insider_title,
        it.relation,
        it.transaction_type,
        it.shares,
        it.price_per_share,
        it.total_value,
        CAST(it.transaction_date AS VARCHAR) as transaction_date,
        it.alert_flag,
        CAST(it.created_at AS VARCHAR) as created_at,
        c.ticker,
        c.name as company_name
      FROM insider_trades it
      LEFT JOIN companies c ON it.company_id = c.id
      WHERE it.transaction_date >= DATE '${since}'
        AND LOWER(it.transaction_type) IN ('buy', 'sell', 'purchase', 'sale')
        AND (
          it.alert_flag = true
          OR (LOWER(it.transaction_type) IN ('buy', 'purchase') AND it.total_value >= ${alertConfig.minBuyValue})
          OR (LOWER(it.transaction_type) IN ('sell', 'sale') AND it.total_value >= ${alertConfig.minSellValue})
        )
      ORDER BY it.total_value DESC
    `;

    const results = await executeAthenaQuery(query);
    
    const alerts: InsiderAlert[] = [];

    for (const row of results) {
      const transaction: InsiderTransaction = {
        id: parseInt(row[0] || '0', 10),
        company_id: row[1] ? parseInt(row[1], 10) : null,
        filing_id: row[2] ? parseInt(row[2], 10) : null,
        insider_name: row[3] || null,
        insider_cik: row[4] || null,
        insider_title: row[5] || null,
        relation: row[6] || null,
        transaction_type: row[7] || null,
        shares: row[8] ? parseInt(row[8], 10) : null,
        price_per_share: row[9] ? parseFloat(row[9]) : null,
        total_value: row[10] ? parseFloat(row[10]) : null,
        transaction_date: row[11] || null,
        alert_flag: row[12] === true || row[12] === 'true',
        created_at: row[13] || null,
        ticker: row[14] || null,
        company_name: row[15] || null,
      };

      const alert = this.createAlert(transaction, alertConfig);
      if (alert) {
        alerts.push(alert);
      }
    }

    // Envoyer les alertes
    for (const alert of alerts) {
      await this.sendAlert(alert, alertConfig);
    }

    return alerts;
  }

  /**
   * Créer une alerte à partir d'une transaction
   */
  private createAlert(
    transaction: InsiderTransaction,
    config: AlertConfig
  ): InsiderAlert | null {
    if (!transaction.transaction_type || !transaction.total_value) {
      return null;
    }

    const isBuy = transaction.transaction_type?.toLowerCase() === 'buy' || transaction.transaction_type?.toLowerCase() === 'purchase';
    const value = transaction.total_value;
    const threshold = isBuy ? config.minBuyValue : config.minSellValue;

    if (value < threshold) {
      return null;
    }

    // Déterminer le type d'alerte
    let alertType: 'buy' | 'sell' | 'large_buy' | 'large_sell';
    let priority: 'high' | 'medium' | 'low';

    if (isBuy) {
      alertType = value >= 1000000 ? 'large_buy' : 'buy';
      priority = value >= 1000000 ? 'high' : value >= 500000 ? 'medium' : 'low';
    } else {
      alertType = value >= 2000000 ? 'large_sell' : 'sell';
      priority = value >= 2000000 ? 'high' : value >= 1000000 ? 'medium' : 'low';
    }

    // Construire le message
    const valueFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

    const message = `🚨 ${isBuy ? 'BUY' : 'SELL'} Alert: ${transaction.insider_name || 'Insider'} (${transaction.insider_title || transaction.relation || 'N/A'}) ${isBuy ? 'bought' : 'sold'} ${valueFormatted} of ${transaction.ticker || 'N/A'} (${transaction.company_name || ''}) on ${transaction.transaction_date || 'N/A'}`;

    return {
      transaction,
      alert_type: alertType,
      message,
      priority,
    };
  }

  /**
   * Envoyer une alerte via les canaux configurés
   */
  private async sendAlert(alert: InsiderAlert, config: AlertConfig): Promise<void> {
    const promises: Promise<void>[] = [];

    if (config.alertChannels.includes('telegram') && config.telegramBotToken && config.telegramChatId) {
      promises.push(this.sendTelegramAlert(alert, config));
    }

    if (config.alertChannels.includes('discord') && config.discordWebhookUrl) {
      promises.push(this.sendDiscordAlert(alert, config));
    }

    if (config.alertChannels.includes('email') && config.emailRecipients && config.emailRecipients.length > 0) {
      promises.push(this.sendEmailAlert(alert, config));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Envoyer une alerte Telegram
   */
  private async sendTelegramAlert(alert: InsiderAlert, config: AlertConfig): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.telegramChatId,
          text: alert.message,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }
    } catch (error: any) {
      console.error(`[InsiderAlerts] Telegram error: ${error.message}`);
    }
  }

  /**
   * Envoyer une alerte Discord
   */
  private async sendDiscordAlert(alert: InsiderAlert, config: AlertConfig): Promise<void> {
    try {
      const color = alert.alert_type.includes('buy') ? 0x00ff00 : 0xff0000;
      
      const response = await fetch(config.discordWebhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: `${alert.alert_type.toUpperCase()} Alert`,
            description: alert.message,
            color: color,
            fields: [
              {
                name: 'Ticker',
                value: alert.transaction.ticker || 'N/A',
                inline: true,
              },
              {
                name: 'Insider',
                value: alert.transaction.insider_name || 'N/A',
                inline: true,
              },
              {
                name: 'Value',
                value: new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(alert.transaction.total_value || 0),
                inline: true,
              },
            ],
            timestamp: alert.transaction.transaction_date || new Date().toISOString(),
          }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook error: ${response.status}`);
      }
    } catch (error: any) {
      console.error(`[InsiderAlerts] Discord error: ${error.message}`);
    }
  }

  /**
   * Envoyer une alerte Email
   */
  private async sendEmailAlert(alert: InsiderAlert, config: AlertConfig): Promise<void> {
    // TODO: Implémenter avec AWS SES ou un service email
    console.log(`[InsiderAlerts] Email alert (not implemented): ${alert.message}`);
  }

  /**
   * Générer un résumé quotidien des Top 5 Insider Buys
   */
  async generateDailySummary(config?: Partial<AlertConfig>): Promise<string> {
    const trending = await this.insidersService.getTrendingInsiders(1, 5);
    
    if (trending.length === 0) {
      return 'No significant insider activity today.';
    }

    let summary = '📊 **Top 5 Insider Buys (Last 24h)**\n\n';
    
    for (let i = 0; i < trending.length; i++) {
      const item = trending[i];
      const valueFormatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(item.net_value);

      summary += `${i + 1}. **${item.ticker}** (${item.company_name})\n`;
      summary += `   Net Value: ${valueFormatted}\n`;
      summary += `   Transactions: ${item.transaction_count}\n\n`;
    }

    return summary;
  }
}
