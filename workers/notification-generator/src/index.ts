/**
 * Lambda pour générer automatiquement les notifications de funds
 * Déclenché par SQS (via EventBridge cron: toutes les 5 minutes)
 * 
 * Scanne les nouveaux diffs dans fund_holdings_diff et génère les notifications
 * pour tous les utilisateurs qui suivent les funds concernés
 */

import { SQSEvent } from "aws-lambda";
import { supabase } from "./supabase";

/**
 * Génère une notification pour un changement de holding
 * Version simplifiée pour le worker (sans dépendances externes)
 */
async function generateNotificationForDiff(
  userId: string,
  fundId: number,
  diff: {
    ticker: string;
    action: 'new' | 'exit' | 'increase' | 'decrease';
    diff_shares: number;
    diff_shares_pct: number | null;
    filing_id_new: number;
    diff_id: number;
  },
  fundName: string
): Promise<any | null> {
  // Récupérer les préférences
  const { data: preferences } = await supabase
    .from("user_fund_notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("fund_id", fundId)
    .single();

  // Valeurs par défaut
  const minChangePct = preferences?.min_change_pct ?? 5.0;
  const notifyOnNew = preferences?.notify_on_new ?? true;
  const notifyOnExit = preferences?.notify_on_exit ?? true;
  const notifyOnIncrease = preferences?.notify_on_increase ?? true;
  const notifyOnDecrease = preferences?.notify_on_decrease ?? false;

  // Filtrer selon les règles
  let shouldNotify = false;

  if (diff.action === 'exit') {
    shouldNotify = notifyOnExit;
  } else if (diff.action === 'new') {
    shouldNotify = notifyOnNew;
  } else if (diff.action === 'increase') {
    shouldNotify = notifyOnIncrease && (diff.diff_shares_pct === null || diff.diff_shares_pct >= minChangePct);
  } else if (diff.action === 'decrease') {
    shouldNotify = notifyOnDecrease && (diff.diff_shares_pct === null || Math.abs(diff.diff_shares_pct) >= minChangePct);
  }

  if (!shouldNotify) {
    return null; // Pas de notification (bruit filtré)
  }

  // Déterminer la priorité
  let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  if (diff.action === 'exit') {
    priority = 'critical';
  } else if (diff.action === 'new') {
    priority = 'high';
  } else if (diff.diff_shares_pct !== null) {
    if (Math.abs(diff.diff_shares_pct) >= 20) {
      priority = 'high';
    } else if (Math.abs(diff.diff_shares_pct) >= 10) {
      priority = 'medium';
    } else {
      priority = 'low';
    }
  }

  // Générer le message
  const sharesFormatted = formatShares(Math.abs(diff.diff_shares));
  const pctFormatted = diff.diff_shares_pct
    ? ` (${diff.diff_shares_pct > 0 ? '+' : ''}${diff.diff_shares_pct.toFixed(1)}%)`
    : '';

  let message = '';
  switch (diff.action) {
    case 'new':
      message = `${fundName} a acheté ${sharesFormatted} actions ${diff.ticker} (nouvelle position)`;
      break;
    case 'exit':
      message = `${fundName} a vendu toutes ses actions ${diff.ticker}`;
      break;
    case 'increase':
      message = `${fundName} a acheté ${sharesFormatted} actions ${diff.ticker}${pctFormatted}`;
      break;
    case 'decrease':
      message = `${fundName} a vendu ${sharesFormatted} actions ${diff.ticker}${pctFormatted}`;
      break;
  }

  const title = diff.action === 'exit'
    ? `🚨 ${fundName} a vendu toutes ses actions ${diff.ticker}`
    : diff.action === 'new'
    ? `✨ ${fundName} a pris une nouvelle position dans ${diff.ticker}`
    : `📊 ${fundName} a modifié sa position dans ${diff.ticker}`;

  // Créer la notification
  const { data: notification, error } = await supabase
    .from("fund_notifications")
    .insert({
      user_id: userId,
      fund_id: fundId,
      diff_id: diff.diff_id,
      filing_id_new: diff.filing_id_new,
      title,
      message,
      priority,
      ticker: diff.ticker,
      action: diff.action,
      diff_shares_pct: diff.diff_shares_pct,
      status: preferences?.digest_enabled !== false ? 'batched' : 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error(`Error creating notification:`, error);
    return null;
  }

  return notification;
}

function formatShares(shares: number): string {
  if (shares >= 1000000) {
    return `${(shares / 1000000).toFixed(2)}M`;
  }
  if (shares >= 1000) {
    return `${(shares / 1000).toFixed(2)}K`;
  }
  return shares.toLocaleString();
}

export const handler = async (event: SQSEvent) => {
  console.log("Notification Generator triggered via SQS");
  console.log(`Received ${event.Records.length} message(s) from SQS`);

  const errors: Array<{ messageId: string; error: any }> = [];

  for (const record of event.Records) {
    try {
      let messageBody: any = {};
      if (record.body) {
        try {
          messageBody = JSON.parse(record.body);
        } catch (e) {
          console.log("SQS message body is not JSON (expected for cron), proceeding with default processing");
        }
      }

      console.log("Processing SQS message:", {
        messageId: record.messageId,
        body: messageBody,
      });

      await processNotificationGenerator();

    } catch (error: any) {
      console.error(`Error processing SQS message ${record.messageId}:`, error);
      errors.push({ messageId: record.messageId, error });
    }
  }

  if (errors.length > 0) {
    throw new Error(`Failed to process ${errors.length} message(s). First error: ${errors[0].error.message}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      messagesProcessed: event.Records.length,
    }),
  };
};

async function processNotificationGenerator() {
  try {
    // 1. Récupérer tous les diffs récents qui n'ont pas encore de notifications
    // On cherche les diffs créés dans les dernières 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: newDiffs, error: diffsError } = await supabase
      .from("fund_holdings_diff")
      .select(`
        *,
        funds:funds!fund_id(id, name),
        filing_new:fund_filings!filing_id_new(filing_date, form_type)
      `)
      .gte("created_at", tenMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(100); // Traiter max 100 diffs à la fois

    if (diffsError) {
      throw diffsError;
    }

    if (!newDiffs || newDiffs.length === 0) {
      console.log("No new diffs to process");
      return;
    }

    console.log(`Processing ${newDiffs.length} new diffs`);

    let notificationsCreated = 0;
    let errors = 0;

    // 2. Pour chaque diff, vérifier si des notifications existent déjà
    // Si non, générer les notifications pour tous les utilisateurs qui suivent ce fund
    for (const diff of newDiffs) {
      try {
        const fund = diff.funds as any;
        if (!fund) {
          console.warn(`Fund not found for diff ${diff.id}`);
          continue;
        }

        const fundId = fund.id;
        const fundName = fund.name || 'Unknown Fund';

        // Vérifier si des notifications existent déjà pour ce diff
        const { data: existingNotifications, error: checkError } = await supabase
          .from("fund_notifications")
          .select("id")
          .eq("diff_id", diff.id)
          .limit(1);

        if (checkError) {
          console.error(`Error checking existing notifications for diff ${diff.id}:`, checkError);
          continue;
        }

        // Si des notifications existent déjà, passer au suivant
        if (existingNotifications && existingNotifications.length > 0) {
          console.log(`Notifications already exist for diff ${diff.id}, skipping`);
          continue;
        }

        // Récupérer tous les utilisateurs qui suivent ce fund
        const { data: users, error: usersError } = await supabase
          .from("user_fund_notifications")
          .select("user_id")
          .eq("fund_id", fundId);

        if (usersError) {
          console.error(`Error fetching users for fund ${fundId}:`, usersError);
          continue;
        }

        if (!users || users.length === 0) {
          console.log(`No users following fund ${fundId} (${fundName}), skipping`);
          continue;
        }

        console.log(`Generating notifications for ${users.length} users, fund ${fundId} (${fundName}), diff ${diff.id}`);

        // Générer une notification pour chaque utilisateur
        for (const user of users) {
          try {
            const notification = await generateNotificationForDiff(
              user.user_id,
              fundId,
              {
                ticker: diff.ticker,
                action: diff.action as 'new' | 'exit' | 'increase' | 'decrease',
                diff_shares: diff.diff_shares,
                diff_shares_pct: diff.diff_pct_shares,
                filing_id_new: diff.filing_id_new,
                diff_id: diff.id,
              },
              fundName
            );

            if (notification) {
              notificationsCreated++;
            }
          } catch (notifError: any) {
            console.error(`Error generating notification for user ${user.user_id}, diff ${diff.id}:`, notifError);
            errors++;
          }
        }
      } catch (diffError: any) {
        console.error(`Error processing diff ${diff.id}:`, diffError);
        errors++;
      }
    }

    console.log(`Processed: ${newDiffs.length} diffs, ${notificationsCreated} notifications created, ${errors} errors`);

    return {
      success: true,
      processed: newDiffs.length,
      notifications: notificationsCreated,
      errors,
    };
  } catch (error: any) {
    console.error("Notification Generator error:", error);
    throw error; // Re-throw pour que SQS gère les retries
  }
}
