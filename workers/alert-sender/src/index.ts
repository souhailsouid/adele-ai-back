/**
 * Lambda pour envoyer les alertes temps réel
 * Déclenché par EventBridge ou appelé périodiquement pour traiter les alertes en attente
 * 
 * Envoie les alertes vers Discord/Slack/Telegram selon la configuration
 */

import { EventBridgeEvent } from "aws-lambda";
import { supabase } from "./supabase";

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

export const handler = async (event: EventBridgeEvent<"Scheduled Event" | "New Signal", any>) => {
  console.log("Alert Sender triggered");

  try {
    // Récupérer les alertes en attente
    const { data: pendingAlerts, error: fetchError } = await supabase
      .from("alerts_sent")
      .select(`
        *,
        signals (
          id,
          source,
          type,
          timestamp,
          raw_data,
          extracted_data,
          summary,
          importance_score,
          priority
        )
      `)
      .eq("status", "pending")
      .order("sent_at", { ascending: true })
      .limit(50); // Traiter 50 alertes à la fois

    if (fetchError) {
      throw fetchError;
    }

    if (!pendingAlerts || pendingAlerts.length === 0) {
      console.log("No pending alerts");
      return { statusCode: 200, body: JSON.stringify({ success: true, processed: 0 }) };
    }

    console.log(`Processing ${pendingAlerts.length} pending alerts`);

    let successCount = 0;
    let errorCount = 0;

    // Traiter chaque alerte
    for (const alert of pendingAlerts) {
      try {
        const signal = alert.signals as any;
        
        if (!signal) {
          console.warn(`Signal not found for alert ${alert.id}`);
          await markAlertAsFailed(alert.id, "Signal not found");
          errorCount++;
          continue;
        }

        // Envoyer l'alerte selon le canal
        const success = await sendAlert(alert.channel, signal, alert.keyword);

        if (success) {
          await markAlertAsSent(alert.id);
          successCount++;
        } else {
          await markAlertAsFailed(alert.id, "Failed to send");
          errorCount++;
        }
      } catch (error: any) {
        console.error(`Error processing alert ${alert.id}:`, error);
        await markAlertAsFailed(alert.id, error.message);
        errorCount++;
      }
    }

    console.log(`Processed: ${successCount} success, ${errorCount} errors`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        processed: pendingAlerts.length,
        successCount,
        errorCount,
      }),
    };
  } catch (error: any) {
    console.error("Alert Sender error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

/**
 * Envoyer une alerte selon le canal
 */
async function sendAlert(
  channel: string,
  signal: any,
  keyword: string
): Promise<boolean> {
  const message = formatAlertMessage(signal, keyword);

  switch (channel) {
    case "discord":
      return await sendDiscordAlert(message);
    case "slack":
      return await sendSlackAlert(message);
    case "telegram":
      return await sendTelegramAlert(message);
    default:
      console.warn(`Unknown channel: ${channel}`);
      return false;
  }
}

/**
 * Formater le message d'alerte
 */
function formatAlertMessage(signal: any, keyword: string): {
  title: string;
  description: string;
  url: string;
  keyword: string;
  timestamp: string;
  importance: number;
} {
  const rawData = signal.raw_data || {};
  const extractedData = signal.extracted_data || {};
  
  // Titre
  const title = rawData.title || "Nouvelle alerte";
  
  // Description
  let description = rawData.description || "";
  
  // Ajouter les données extraites si disponibles
  if (extractedData.actual !== undefined) {
    description += `\n\n📊 **Données:**\n`;
    description += `- Actual: ${extractedData.actual}%`;
    if (extractedData.forecast !== undefined) {
      description += `\n- Forecast: ${extractedData.forecast}%`;
    }
    if (extractedData.previous !== undefined) {
      description += `\n- Previous: ${extractedData.previous}%`;
    }
    if (extractedData.surprise) {
      const emoji = extractedData.surprise === 'positive' ? '📈' : '📉';
      description += `\n${emoji} **Surprise: ${extractedData.surprise}**`;
      if (extractedData.surpriseMagnitude) {
        description += ` (${extractedData.surpriseMagnitude.toFixed(2)}pp)`;
      }
    }
  }
  
  // URL
  const url = rawData.url || "";
  
  // Priorité
  const priorityEmoji = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🟢",
  }[signal.priority || "medium"] || "🟡";
  
  return {
    title: `${priorityEmoji} ${title}`,
    description,
    url,
    keyword,
    timestamp: signal.timestamp,
    importance: signal.importance_score || 5,
  };
}

/**
 * Envoyer une alerte Discord
 */
async function sendDiscordAlert(message: any): Promise<boolean> {
  if (!DISCORD_WEBHOOK_URL) {
    console.warn("DISCORD_WEBHOOK_URL not configured");
    return false;
  }

  try {
    const embed = {
      title: message.title,
      description: message.description.substring(0, 2000), // Discord limite à 2000 caractères
      url: message.url,
      color: getColorByPriority(message.importance),
      timestamp: message.timestamp,
      footer: {
        text: `Keyword: ${message.keyword} | Financial Juice RSS`,
      },
    };

    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    return response.ok;
  } catch (error: any) {
    console.error("Discord alert error:", error);
    return false;
  }
}

/**
 * Envoyer une alerte Slack
 */
async function sendSlackAlert(message: any): Promise<boolean> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("SLACK_WEBHOOK_URL not configured");
    return false;
  }

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: message.title,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${message.title}*\n\n${message.description}\n\n<${message.url}|Lire la suite>`,
            },
          },
        ],
      }),
    });

    return response.ok;
  } catch (error: any) {
    console.error("Slack alert error:", error);
    return false;
  }
}

/**
 * Envoyer une alerte Telegram
 */
async function sendTelegramAlert(message: any): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured");
    return false;
  }

  try {
    const text = `${message.title}\n\n${message.description}\n\n${message.url}`;

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: text.substring(0, 4096), // Telegram limite à 4096 caractères
          parse_mode: "Markdown",
        }),
      }
    );

    return response.ok;
  } catch (error: any) {
    console.error("Telegram alert error:", error);
    return false;
  }
}

/**
 * Obtenir la couleur Discord selon la priorité
 */
function getColorByPriority(importance: number): number {
  if (importance >= 9) return 0xff0000; // Rouge (critical)
  if (importance >= 7) return 0xff8800; // Orange (high)
  if (importance >= 5) return 0xffaa00; // Jaune (medium)
  return 0x00ff00; // Vert (low)
}

/**
 * Marquer une alerte comme envoyée
 */
async function markAlertAsSent(alertId: string): Promise<void> {
  await supabase
    .from("alerts_sent")
    .update({ status: "sent" })
    .eq("id", alertId);
}

/**
 * Marquer une alerte comme échouée
 */
async function markAlertAsFailed(alertId: string, errorMessage: string): Promise<void> {
  await supabase
    .from("alerts_sent")
    .update({
      status: "failed",
      error_message: errorMessage,
    })
    .eq("id", alertId);
}

