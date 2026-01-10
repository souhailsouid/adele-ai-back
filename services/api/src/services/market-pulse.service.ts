/**
 * Service pour Market Pulse - Tendances sectorielles et changements globaux
 */

import { supabase } from "../supabase";
import { logger } from "../utils/logger";

export interface TickerFundChange {
  ticker: string;
  action: 'new' | 'exit' | 'increase' | 'decrease';
  fund_id: number;
  fund_name: string;
  shares_old: number | null;
  shares_new: number;
  diff_shares: number;
  diff_shares_pct: number | null;
  filing_date: string;
  filing_id: number;
}

export interface SectorTrend {
  sector: string;
  net_buys: number;
  net_sells: number;
  total_funds: number;
  top_tickers: Array<{
    ticker: string;
    net_change: number;
    funds_count: number;
  }>;
}

export interface MarketPulse {
  global_trends: {
    total_new_positions: number;
    total_exits: number;
    total_increases: number;
    total_decreases: number;
    active_funds: number;
  };
  sector_trends: SectorTrend[];
  top_changes: Array<{
    ticker: string;
    action: 'new' | 'exit' | 'increase' | 'decrease';
    fund_name: string;
    diff_shares_pct: number | null;
    filing_date: string;
  }>;
  period_start: string;
  period_end: string;
}

export interface PulseFeedItem {
  id: string;
  type: 'ticker_change' | 'sector_trend' | 'fund_change';
  ticker?: string;
  sector?: string;
  fund_id?: number;
  fund_name?: string;
  action?: 'new' | 'exit' | 'increase' | 'decrease';
  diff_shares?: number;
  diff_shares_pct?: number | null;
  filing_date?: string;
  timestamp: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Récupère les changements d'un ticker spécifique pour tous les funds
 * Exemple: "Bridgewater aussi a vendu AAPL?"
 */
export async function getTickerFundsChanges(
  ticker: string,
  days?: number,
  minChangePct?: number
): Promise<TickerFundChange[]> {
  try {
    const log = logger.child({ operation: 'getTickerFundsChanges', ticker });
    log.info('Fetching ticker funds changes');

    let query = supabase
      .from("fund_holdings_diff")
      .select(`
        *,
        fund:funds!fund_holdings_diff_fund_id_fkey(id, name),
        filing_new:fund_filings!filing_id_new(filing_date, form_type)
      `)
      .eq("ticker", ticker.toUpperCase())
      .in("action", ["new", "exit", "increase", "decrease"]);

    // Filtrer par date si days est fourni
    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      query = query.gte("created_at", cutoffDate.toISOString());
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    // Filtrer côté application pour gérer correctement les null et les dates
    const filtered = (data || []).filter((diff: any) => {
      // Si days est fourni, vérifier la date du filing
      if (days && diff.filing_new?.filing_date) {
        const filingDate = new Date(diff.filing_new.filing_date);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        if (filingDate < cutoffDate) {
          return false;
        }
      }

      // Toujours inclure "new" et "exit"
      if (diff.action === 'new' || diff.action === 'exit') {
        return true;
      }

      // Pour "increase" et "decrease", vérifier le pourcentage si spécifié
      if (minChangePct !== undefined) {
        if (diff.action === 'increase' && diff.diff_pct_shares !== null) {
          return diff.diff_pct_shares >= minChangePct;
        }
        if (diff.action === 'decrease' && diff.diff_pct_shares !== null) {
          return Math.abs(diff.diff_pct_shares) >= minChangePct;
        }
      }

      // Si diff_pct_shares est null pour increase/decrease, exclure si minChangePct est spécifié
      if (minChangePct !== undefined) {
        return false;
      }

      return true;
    });

    // Transformer les résultats
    const changes: TickerFundChange[] = filtered.map((diff: any) => ({
      ticker: diff.ticker,
      action: diff.action,
      fund_id: diff.fund_id,
      fund_name: (diff.fund as any)?.name || 'Unknown',
      shares_old: diff.diff_shares ? (diff.shares_old || null) : null,
      shares_new: diff.diff_shares ? (diff.shares_new || 0) : 0,
      diff_shares: diff.diff_shares || 0,
      diff_shares_pct: diff.diff_pct_shares,
      filing_date: diff.filing_new?.filing_date || '',
      filing_id: diff.filing_id_new,
    }));

    log.info(`Found ${changes.length} changes for ticker ${ticker}`);
    return changes;
  } catch (error: any) {
    logger.error(`Error in getTickerFundsChanges for ${ticker}:`, error);
    throw error;
  }
}

/**
 * Récupère le Market Pulse global (tendances sectorielles et changements globaux)
 */
export async function getMarketPulse(days: number = 30): Promise<MarketPulse> {
  try {
    const log = logger.child({ operation: 'getMarketPulse', days });
    log.info('Fetching market pulse');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // Récupérer tous les changements récents
    const { data: diffs, error: diffsError } = await supabase
      .from("fund_holdings_diff")
      .select(`
        *,
        fund:funds!fund_holdings_diff_fund_id_fkey(id, name),
        filing_new:fund_filings!filing_id_new(filing_date, form_type)
      `)
      .in("action", ["new", "exit", "increase", "decrease"])
      .gte("created_at", cutoffDate.toISOString())
      .limit(1000);

    if (diffsError) throw diffsError;

    // Filtrer par date du filing
    const recentDiffs = (diffs || []).filter((diff: any) => {
      if (!diff.filing_new?.filing_date) return false;
      const filingDate = new Date(diff.filing_new.filing_date);
      return filingDate >= cutoffDate;
    });

    // Calculer les tendances globales
    const globalTrends = {
      total_new_positions: recentDiffs.filter((d: any) => d.action === 'new').length,
      total_exits: recentDiffs.filter((d: any) => d.action === 'exit').length,
      total_increases: recentDiffs.filter((d: any) => d.action === 'increase').length,
      total_decreases: recentDiffs.filter((d: any) => d.action === 'decrease').length,
      active_funds: new Set(recentDiffs.map((d: any) => d.fund_id)).size,
    };

    // Calculer les tendances sectorielles (simplifié - nécessiterait mapping ticker->sector)
    // Pour l'instant, on retourne une structure vide mais extensible
    const sectorTrends: SectorTrend[] = [];

    // Top changements (les plus importants)
    const topChanges = recentDiffs
      .filter((d: any) => d.action === 'exit' || d.action === 'new' || Math.abs(d.diff_pct_shares || 0) >= 20)
      .sort((a: any, b: any) => {
        // Prioriser exits et new positions
        if (a.action === 'exit' && b.action !== 'exit') return -1;
        if (a.action !== 'exit' && b.action === 'exit') return 1;
        if (a.action === 'new' && b.action !== 'new') return -1;
        if (a.action !== 'new' && b.action === 'new') return 1;
        // Sinon trier par pourcentage de changement
        return Math.abs(b.diff_pct_shares || 0) - Math.abs(a.diff_pct_shares || 0);
      })
      .slice(0, 20)
      .map((d: any) => ({
        ticker: d.ticker,
        action: d.action,
        fund_name: (d.fund as any)?.name || 'Unknown',
        diff_shares_pct: d.diff_pct_shares,
        filing_date: d.filing_new?.filing_date || '',
      }));

    const now = new Date();
    const periodStart = cutoffDate.toISOString().split('T')[0];
    const periodEnd = now.toISOString().split('T')[0];

    return {
      global_trends: globalTrends,
      sector_trends: sectorTrends,
      top_changes: topChanges,
      period_start: periodStart,
      period_end: periodEnd,
    };
  } catch (error: any) {
    logger.error('Error in getMarketPulse:', error);
    throw error;
  }
}

/**
 * Récupère le Pulse Feed avec filtres interactifs
 */
export async function getPulseFeed(options?: {
  ticker?: string;
  sector?: string;
  days?: number;
  minChangePct?: number;
  limit?: number;
}): Promise<PulseFeedItem[]> {
  try {
    const log = logger.child({ operation: 'getPulseFeed', options });
    log.info('Fetching pulse feed');

    const days = options?.days || 30;
    const minChangePct = options?.minChangePct || 10;
    const limit = options?.limit || 100;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let query = supabase
      .from("fund_holdings_diff")
      .select(`
        *,
        fund:funds!fund_holdings_diff_fund_id_fkey(id, name),
        filing_new:fund_filings!filing_id_new(filing_date, form_type)
      `)
      .in("action", ["new", "exit", "increase", "decrease"])
      .gte("created_at", cutoffDate.toISOString());

    // Filtrer par ticker si spécifié
    if (options?.ticker) {
      query = query.eq("ticker", options.ticker.toUpperCase());
    }

    const { data: diffs, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit * 2); // Récupérer plus pour filtrer après

    if (error) throw error;

    // Filtrer côté application
    const filtered = (diffs || []).filter((diff: any) => {
      // Filtrer par date du filing
      if (diff.filing_new?.filing_date) {
        const filingDate = new Date(diff.filing_new.filing_date);
        if (filingDate < cutoffDate) return false;
      }

      // Toujours inclure "new" et "exit"
      if (diff.action === 'new' || diff.action === 'exit') {
        return true;
      }

      // Pour "increase" et "decrease", vérifier le pourcentage
      if (diff.action === 'increase' && diff.diff_pct_shares !== null) {
        return diff.diff_pct_shares >= minChangePct;
      }
      if (diff.action === 'decrease' && diff.diff_pct_shares !== null) {
        return Math.abs(diff.diff_pct_shares) >= minChangePct;
      }

      return false;
    });

    // Transformer en PulseFeedItem
    const feedItems: PulseFeedItem[] = filtered.slice(0, limit).map((diff: any) => {
      // Déterminer l'importance
      let importance: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (diff.action === 'exit') {
        importance = 'critical';
      } else if (diff.action === 'new') {
        importance = 'high';
      } else if (Math.abs(diff.diff_pct_shares || 0) >= 50) {
        importance = 'high';
      } else if (Math.abs(diff.diff_pct_shares || 0) >= 20) {
        importance = 'medium';
      }

      return {
        id: `diff-${diff.id}`,
        type: 'ticker_change',
        ticker: diff.ticker,
        fund_id: diff.fund_id,
        fund_name: (diff.fund as any)?.name || 'Unknown',
        action: diff.action,
        diff_shares: diff.diff_shares,
        diff_shares_pct: diff.diff_pct_shares,
        filing_date: diff.filing_new?.filing_date || '',
        timestamp: diff.created_at || new Date().toISOString(),
        importance,
      };
    });

    log.info(`Found ${feedItems.length} feed items`);
    return feedItems;
  } catch (error: any) {
    logger.error('Error in getPulseFeed:', error);
    throw error;
  }
}
