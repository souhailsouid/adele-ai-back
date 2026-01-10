/**
 * Service de notifications pour les changements de funds
 * Gère le filtrage du bruit, la priorisation et le batching
 */

import { supabase } from "../supabase";
import { formatDiffMessage } from "./fund-diff.service";

export interface NotificationPreferences {
  user_id: string;
  fund_id: number;
  min_change_pct: number;
  notify_on_new: boolean;
  notify_on_exit: boolean;
  notify_on_increase: boolean;
  notify_on_decrease: boolean;
  notify_on_accumulation?: boolean; // Notifier les accumulations multi-trimestres (défaut: true)
  email_enabled: boolean;
  push_enabled: boolean;
  webhook_url?: string;
  digest_enabled: boolean;
  digest_time: string; // Format HH:MM:SS
}

export interface FundNotification {
  id: number;
  user_id: string;
  fund_id: number;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  ticker: string | null;
  action: 'new' | 'exit' | 'increase' | 'decrease' | 'accumulation' | null;
  diff_shares_pct: number | null;
  trend_quarters?: number; // Nombre de trimestres d'accumulation (pour action='accumulation')
  is_strong_accumulation?: boolean; // true si 3+ trimestres (signal très fort)
  status: 'pending' | 'sent' | 'failed' | 'batched';
  created_at: string;
}

export interface NotificationDigest {
  id: number;
  user_id: string;
  digest_date: string;
  title: string;
  summary: string;
  total_notifications: number;
  funds_count: number;
  status: 'pending' | 'sent' | 'failed';
}

/**
 * Crée ou met à jour les préférences de notification pour un utilisateur et un fund
 */
export async function upsertNotificationPreferences(
  userId: string,
  fundId: number,
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("user_fund_notifications")
    .upsert({
      user_id: userId,
      fund_id: fundId,
      ...preferences,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,fund_id',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Récupère les préférences de notification pour un utilisateur et un fund
 */
export async function getNotificationPreferences(
  userId: string,
  fundId: number
): Promise<NotificationPreferences | null> {
  const { data, error } = await supabase
    .from("user_fund_notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("fund_id", fundId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}

/**
 * Génère une notification pour un changement de holding
 * Applique les règles de filtrage selon les préférences utilisateur
 */
export async function generateNotificationForDiff(
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
): Promise<FundNotification | null> {
  // Récupérer les préférences
  const preferences = await getNotificationPreferences(userId, fundId);
  
  // Si pas de préférences, utiliser les valeurs par défaut
  const minChangePct = preferences?.min_change_pct ?? 5.0;
  const notifyOnNew = preferences?.notify_on_new ?? true;
  const notifyOnExit = preferences?.notify_on_exit ?? true;
  const notifyOnIncrease = preferences?.notify_on_increase ?? true;
  const notifyOnDecrease = preferences?.notify_on_decrease ?? false;

  // Filtrer selon les règles
  let shouldNotify = false;

  if (diff.action === 'exit') {
    shouldNotify = notifyOnExit; // Exit = toujours notifier si activé
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
  const message = formatDiffMessage(
    {
      ticker: diff.ticker,
      action: diff.action,
      diff_shares: diff.diff_shares,
      diff_shares_pct: diff.diff_shares_pct,
    } as any,
    fundName
  );

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

  if (error) throw error;
  return notification;
}

/**
 * Récupère les notifications en attente pour un utilisateur
 */
export async function getPendingNotifications(
  userId: string,
  limit = 50
): Promise<FundNotification[]> {
  const { data, error } = await supabase
    .from("fund_notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .is("digest_id", null)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Crée un daily digest pour un utilisateur
 * Regroupe toutes les notifications du jour
 */
export async function createDailyDigest(
  userId: string,
  date: string = new Date().toISOString().split('T')[0]
): Promise<NotificationDigest> {
  // Récupérer toutes les notifications en attente pour ce jour
  const { data: notifications, error: notificationsError } = await supabase
    .from("fund_notifications")
    .select(`
      *,
      funds(name)
    `)
    .eq("user_id", userId)
    .eq("status", "batched")
    .is("digest_id", null)
    .gte("created_at", `${date}T00:00:00Z`)
    .lt("created_at", `${date}T23:59:59Z`);

  if (notificationsError) throw notificationsError;

  if (!notifications || notifications.length === 0) {
    throw new Error("No notifications to digest");
  }

  // Compter les funds uniques
  const uniqueFunds = new Set(notifications.map((n: any) => n.fund_id));
  const fundsCount = uniqueFunds.size;

  // Générer le résumé
  const criticalCount = notifications.filter((n: any) => n.priority === 'critical').length;
  const highCount = notifications.filter((n: any) => n.priority === 'high').length;
  
  let summary = `Aujourd'hui, ${fundsCount} fond${fundsCount > 1 ? 's' : ''} de votre watchlist ont publié leurs rapports.\n\n`;
  
  if (criticalCount > 0) {
    summary += `🚨 ${criticalCount} sortie${criticalCount > 1 ? 's' : ''} totale${criticalCount > 1 ? 's' : ''} détectée${criticalCount > 1 ? 's' : ''}\n`;
  }
  if (highCount > 0) {
    summary += `✨ ${highCount} nouvelle${highCount > 1 ? 's' : ''} position${highCount > 1 ? 's' : ''}\n`;
  }
  
  summary += `\nTotal: ${notifications.length} changement${notifications.length > 1 ? 's' : ''} significatif${notifications.length > 1 ? 's' : ''}`;

  const title = `📊 Daily Digest - ${date}`;

  // Créer le digest
  const { data: digest, error: digestError } = await supabase
    .from("notification_digests")
    .insert({
      user_id: userId,
      digest_date: date,
      title,
      summary,
      total_notifications: notifications.length,
      funds_count: fundsCount,
      status: 'pending',
    })
    .select()
    .single();

  if (digestError) throw digestError;

  // Associer les notifications au digest
  const { error: updateError } = await supabase
    .from("fund_notifications")
    .update({ digest_id: digest.id })
    .in("id", notifications.map((n: any) => n.id));

  if (updateError) throw updateError;

  return digest;
}

/**
 * Récupère les digests pour un utilisateur
 */
export async function getDigests(
  userId: string,
  limit = 30
): Promise<NotificationDigest[]> {
  const { data, error } = await supabase
    .from("notification_digests")
    .select("*")
    .eq("user_id", userId)
    .order("digest_date", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Récupère les notifications d'un digest
 */
export async function getDigestNotifications(
  digestId: number
): Promise<FundNotification[]> {
  const { data, error } = await supabase
    .from("fund_notifications")
    .select("*")
    .eq("digest_id", digestId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Génère une notification pour une accumulation multi-trimestres
 * Priorité élevée car c'est un signal fort pour les investisseurs
 */
export async function generateAccumulationNotification(
  userId: string,
  fundId: number,
  accumulation: {
    ticker: string;
    trend_quarters: number;
    is_strong_accumulation: boolean;
    total_added: number; // Valeur totale ajoutée en milliers USD
    avg_impact_per_quarter: number;
    filing_id_new: number;
  },
  fundName: string
): Promise<FundNotification | null> {
  // Vérifier les préférences
  const preferences = await getNotificationPreferences(userId, fundId);
  const notifyOnAccumulation = preferences?.notify_on_accumulation !== false; // Défaut: true

  if (!notifyOnAccumulation) {
    return null; // Utilisateur a désactivé les notifications d'accumulation
  }

  // Priorité: high pour 3+ trimestres, medium pour 2 trimestres
  const priority: 'high' | 'medium' = accumulation.is_strong_accumulation ? 'high' : 'medium';
  
  // Générer le message
  const quartersLabel = accumulation.trend_quarters >= 3 
    ? `${accumulation.trend_quarters} trimestres consécutifs (Signal très fort 🔥)`
    : `${accumulation.trend_quarters} trimestres consécutifs (Signal pertinent ✓)`;
  
  const totalValueInM = (accumulation.total_added / 1000).toFixed(1);
  const avgValueInM = (accumulation.avg_impact_per_quarter / 1000).toFixed(1);
  
  const title = accumulation.is_strong_accumulation
    ? `🔥 ${fundName} accumule ${accumulation.ticker} depuis ${accumulation.trend_quarters} trimestres`
    : `📈 ${fundName} accumule ${accumulation.ticker} depuis ${accumulation.trend_quarters} trimestres`;
  
  const message = `${fundName} accumule ${accumulation.ticker} depuis ${quartersLabel}.\n\n` +
    `💰 Total ajouté: $${totalValueInM}M\n` +
    `📊 Moyenne par trimestre: $${avgValueInM}M\n\n` +
    `C'est un signal ${accumulation.is_strong_accumulation ? 'très fort' : 'pertinent'} : le fonds construit patiemment une grosse ligne sur ce titre.`;

  // Créer la notification
  const { data: notification, error } = await supabase
    .from("fund_notifications")
    .insert({
      user_id: userId,
      fund_id: fundId,
      filing_id_new: accumulation.filing_id_new,
      title,
      message,
      priority,
      ticker: accumulation.ticker,
      action: 'accumulation',
      diff_shares_pct: null, // Pas de diff_shares_pct pour les accumulations
      trend_quarters: accumulation.trend_quarters,
      is_strong_accumulation: accumulation.is_strong_accumulation,
      status: preferences?.digest_enabled !== false ? 'batched' : 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return notification;
}

/**
 * Récupère toutes les notifications d'accumulation pour un utilisateur
 * (Route globale, pas spécifique à un fund)
 */
export async function getAccumulationNotifications(
  userId: string,
  limit = 50,
  includeSent = false
): Promise<FundNotification[]> {
  let query = supabase
    .from("fund_notifications")
    .select(`
      *,
      funds(name)
    `)
    .eq("user_id", userId)
    .eq("action", "accumulation");

  if (!includeSent) {
    query = query.in("status", ['pending', 'batched']);
  }

  const { data, error } = await query
    .order("is_strong_accumulation", { ascending: false }) // Prioriser les 3+Q
    .order("trend_quarters", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Récupère toutes les notifications d'accumulation globales (pour tous les utilisateurs)
 * Utile pour un feed global "News" d'accumulations
 * 
 * NOUVEAU: Analyse l'historique complet des filings parsés au lieu de se baser uniquement
 * sur les notifications générées. Cela permet d'avoir un historique complet même si
 * les notifications n'ont pas encore été créées.
 */
export async function getGlobalAccumulationNotifications(
  limit = 100,
  minQuarters: number = 2,
  onlyStrong = false,
  options?: {
    from_date?: string; // Filtrer par date de début (YYYY-MM-DD)
    to_date?: string;   // Filtrer par date de fin (YYYY-MM-DD)
    quarter?: string;   // Filtrer par trimestre (ex: "Q1-2024")
    year?: number;      // Filtrer par année
  }
): Promise<Array<{
  fund_id: number;
  fund_name: string;
  ticker: string;
  trend_quarters: number;
  is_strong_accumulation: boolean;
  total_added: number; // en milliers USD
  avg_impact_per_quarter: number;
  filing_date: string; // Date du filing le plus récent où l'accumulation est détectée
  filing_id_new: number;
  created_at: string; // Date de création (pour tri)
}>> {
  // Importer dynamiquement pour éviter les dépendances circulaires
  const { detectMultiQuarterTrends } = await import("./fund-strategic-analysis.service");
  
  // Récupérer tous les funds
  const { data: funds, error: fundsError } = await supabase
    .from("funds")
    .select("id, name")
    .order("name", { ascending: true });

  if (fundsError || !funds || funds.length === 0) {
    return [];
  }

  const allAccumulations: Array<{
    fund_id: number;
    fund_name: string;
    ticker: string;
    trend_quarters: number;
    is_strong_accumulation: boolean;
    total_added: number;
    avg_impact_per_quarter: number;
    filing_date: string;
    filing_id_new: number;
    created_at: string;
  }> = [];

  // Analyser chaque fund pour détecter les accumulations historiques
  for (const fund of funds) {
    try {
      // Récupérer les filings parsés pour ce fund
      let filingsQuery = supabase
        .from("fund_filings")
        .select("id, filing_date")
        .eq("fund_id", fund.id)
        .eq("status", "PARSED")
        .order("filing_date", { ascending: false })
        .limit(8); // Analyser les 8 derniers filings (~24 mois)

      // Appliquer les filtres de date si spécifiés
      if (options?.from_date) {
        filingsQuery = filingsQuery.gte("filing_date", options.from_date);
      }
      if (options?.to_date) {
        filingsQuery = filingsQuery.lte("filing_date", options.to_date);
      }
      if (options?.year) {
        const yearStart = `${options.year}-01-01`;
        const yearEnd = `${options.year}-12-31`;
        filingsQuery = filingsQuery.gte("filing_date", yearStart).lte("filing_date", yearEnd);
      }
      if (options?.quarter) {
        // Parser le format "Q1-2024" ou "2024-Q1"
        const quarterMatch = options.quarter.match(/(?:Q(\d))-?(\d{4})|(\d{4})-?Q(\d)/);
        if (quarterMatch) {
          const quarter = parseInt(quarterMatch[1] || quarterMatch[4]);
          const year = parseInt(quarterMatch[2] || quarterMatch[3]);
          const monthStart = (quarter - 1) * 3 + 1;
          const monthEnd = quarter * 3;
          const dateStart = `${year}-${String(monthStart).padStart(2, '0')}-01`;
          const dateEnd = `${year}-${String(monthEnd).padStart(2, '0')}-${new Date(year, monthEnd, 0).getDate()}`;
          filingsQuery = filingsQuery.gte("filing_date", dateStart).lte("filing_date", dateEnd);
        }
      }

      const { data: filings, error: filingsError } = await filingsQuery;

      if (filingsError || !filings || filings.length < 2) {
        continue; // Pas assez de filings pour détecter des tendances
      }

      // Détecter les accumulations multi-trimestres
      // detectMultiQuarterTrends récupère les filings et diffs elle-même depuis la DB
      const trends = await detectMultiQuarterTrends(fund.id, []);

      // Filtrer selon les critères
      let accumulatingPositions = trends.accumulating_positions;
      
      if (minQuarters >= 2) {
        accumulatingPositions = accumulatingPositions.filter(acc => acc.quarters >= minQuarters);
      }
      
      if (onlyStrong) {
        accumulatingPositions = accumulatingPositions.filter(acc => acc.is_strong_accumulation);
      }

      // Pour chaque accumulation, trouver le filing le plus récent où elle est détectée
      // Récupérer les diffs pour trouver le filing le plus récent
      const filingIds = filings.map(f => f.id);
      const { data: rawDiffs } = await supabase
        .from("fund_holdings_diff")
        .select(`
          *,
          filing_new:fund_filings!filing_id_new(filing_date)
        `)
        .in("filing_id_new", filingIds)
        .eq("fund_id", fund.id);

      for (const accumulation of accumulatingPositions) {
        // Trouver le filing le plus récent qui contient ce ticker avec une action d'accumulation
        const relevantDiffs = (rawDiffs || []).filter((d: any) => 
          d.ticker?.toUpperCase().trim() === accumulation.ticker.toUpperCase().trim() &&
          (d.action === 'new' || d.action === 'increase') &&
          d.diff_value > 0
        );

        if (relevantDiffs.length === 0) continue;

        // Prendre le filing le plus récent
        const latestDiff = relevantDiffs.sort((a: any, b: any) => {
          const dateA = (a.filing_new as any)?.filing_date || filings.find(f => f.id === a.filing_id_new)?.filing_date || '';
          const dateB = (b.filing_new as any)?.filing_date || filings.find(f => f.id === b.filing_id_new)?.filing_date || '';
          return dateB.localeCompare(dateA);
        })[0];

        const latestFiling = filings.find(f => f.id === latestDiff.filing_id_new);
        const filingDate = latestFiling?.filing_date || (latestDiff.filing_new as any)?.filing_date || '';

        // Appliquer les filtres de date si spécifiés
        if (options?.from_date && filingDate < options.from_date) continue;
        if (options?.to_date && filingDate > options.to_date) continue;

        allAccumulations.push({
          fund_id: fund.id,
          fund_name: fund.name,
          ticker: accumulation.ticker,
          trend_quarters: accumulation.quarters,
          is_strong_accumulation: accumulation.is_strong_accumulation,
          total_added: accumulation.total_added,
          avg_impact_per_quarter: accumulation.avg_impact_per_quarter,
          filing_date: filingDate,
          filing_id_new: latestDiff.filing_id_new,
          created_at: filingDate, // Utiliser filing_date pour le tri
        });
      }
    } catch (error: any) {
      console.error(`Error analyzing accumulations for fund ${fund.id} (${fund.name}):`, error);
      // Continue avec les autres funds
      continue;
    }
  }

  // Trier et limiter
  return allAccumulations
    .sort((a, b) => {
      // Prioriser les accumulations 3+ trimestres
      if (a.is_strong_accumulation && !b.is_strong_accumulation) return -1;
      if (!a.is_strong_accumulation && b.is_strong_accumulation) return 1;
      // Puis par nombre de trimestres
      if (a.trend_quarters !== b.trend_quarters) {
        return b.trend_quarters - a.trend_quarters;
      }
      // Puis par date de filing (plus récent en premier)
      return b.filing_date.localeCompare(a.filing_date);
    })
    .slice(0, limit);
}
