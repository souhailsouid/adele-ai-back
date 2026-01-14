/**
 * Service Athena pour Market Pulse - Tendances sectorielles et changements globaux
 * 
 * Architecture Extreme Budget: Utilise S3 + Athena au lieu de PostgreSQL
 */

import { executeAthenaQuery } from './query';
import { TickerFundChange, MarketPulse, PulseFeedItem } from '../services/market-pulse.service';

/**
 * Récupère les changements d'un ticker spécifique pour tous les funds
 * 
 * Utilise Athena avec JOINs vers funds et fund_filings
 */
export async function getTickerFundsChangesAthena(
  ticker: string,
  days?: number,
  minChangePct?: number
): Promise<TickerFundChange[]> {
  const tickerUpper = ticker.toUpperCase().replace(/'/g, "''");
  
  // Construire la clause WHERE
  let whereClause = `WHERE d.ticker = '${tickerUpper}'`;
  whereClause += ` AND d.action IN ('new', 'exit', 'increase', 'decrease')`;
  
  if (days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    whereClause += ` AND d.created_at >= DATE '${cutoffDateStr}'`;
  }

  const query = `
    SELECT 
      d.ticker,
      d.action,
      d.fund_id,
      f.name as fund_name,
      d.diff_shares,
      d.diff_pct_shares,
      CAST(ff_new.filing_date AS VARCHAR) as filing_date,
      d.filing_id_new as filing_id
    FROM fund_holdings_diff d
    LEFT JOIN funds f ON d.fund_id = f.id
    LEFT JOIN fund_filings ff_new ON d.filing_id_new = ff_new.id
    ${whereClause}
    ORDER BY d.created_at DESC
    LIMIT 500
  `;

  const results = await executeAthenaQuery(query);
  
  // Filtrer côté application pour gérer minChangePct
  const filtered = results
    .filter((diff: any) => {
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
    })
    .map((diff: any) => ({
      ticker: diff.ticker || '',
      action: diff.action,
      fund_id: parseInt(diff.fund_id || '0', 10),
      fund_name: diff.fund_name || 'Unknown',
      shares_old: null, // Non disponible dans fund_holdings_diff
      shares_new: null, // Non disponible dans fund_holdings_diff
      diff_shares: parseInt(diff.diff_shares || '0', 10),
      diff_shares_pct: diff.diff_pct_shares ? parseFloat(diff.diff_pct_shares) : null,
      filing_date: diff.filing_date || '',
      filing_id: parseInt(diff.filing_id || '0', 10),
    }));

  return filtered;
}

/**
 * Récupère le Market Pulse global (tendances sectorielles et changements globaux)
 * 
 * Utilise Athena avec JOINs et agrégations
 */
export async function getMarketPulseAthena(days: number = 30): Promise<MarketPulse> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

  // Requête pour récupérer les diffs récents avec JOINs
  const query = `
    SELECT 
      d.id,
      d.ticker,
      d.action,
      d.fund_id,
      f.name as fund_name,
      d.diff_pct_shares,
      CAST(ff_new.filing_date AS VARCHAR) as filing_date,
      d.created_at
    FROM fund_holdings_diff d
    LEFT JOIN funds f ON d.fund_id = f.id
    LEFT JOIN fund_filings ff_new ON d.filing_id_new = ff_new.id
    WHERE d.action IN ('new', 'exit', 'increase', 'decrease')
      AND d.created_at >= DATE '${cutoffDateStr}'
      AND ff_new.filing_date >= DATE '${cutoffDateStr}'
    ORDER BY d.created_at DESC
    LIMIT 1000
  `;

  const results = await executeAthenaQuery(query);

  // Filtrer par date du filing
  const recentDiffs = results.filter((diff: any) => {
    if (!diff.filing_date) return false;
    const filingDate = new Date(diff.filing_date);
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
  const sectorTrends: any[] = [];

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
      ticker: d.ticker || '',
      action: d.action,
      fund_name: d.fund_name || 'Unknown',
      diff_shares_pct: d.diff_pct_shares ? parseFloat(d.diff_pct_shares) : null,
      filing_date: d.filing_date || '',
    }));

  const now = new Date();
  const periodStart = cutoffDateStr;
  const periodEnd = now.toISOString().split('T')[0];

  return {
    global_trends: globalTrends,
    sector_trends: sectorTrends,
    top_changes: topChanges,
    period_start: periodStart,
    period_end: periodEnd,
  };
}

/**
 * Récupère le Pulse Feed avec filtres interactifs
 * 
 * Utilise Athena avec JOINs et filtres dynamiques
 */
export async function getPulseFeedAthena(options?: {
  ticker?: string;
  sector?: string;
  days?: number;
  minChangePct?: number;
  limit?: number;
}): Promise<PulseFeedItem[]> {
  const days = options?.days || 30;
  const limit = options?.limit || 100;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

  // Construire la clause WHERE
  let whereClause = `WHERE d.action IN ('new', 'exit', 'increase', 'decrease')`;
  whereClause += ` AND d.created_at >= DATE '${cutoffDateStr}'`;
  
  if (options?.ticker) {
    const tickerUpper = options.ticker.toUpperCase().replace(/'/g, "''");
    whereClause += ` AND UPPER(d.ticker) = '${tickerUpper}'`;
  }

  // Note: Le filtrage par sector nécessiterait un JOIN avec companies, ce qui est complexe
  // Pour l'instant, on ignore le filtre sector dans Athena

  const query = `
    SELECT 
      d.id,
      d.ticker,
      d.action,
      d.fund_id,
      f.name as fund_name,
      d.diff_shares,
      d.diff_pct_shares,
      CAST(ff_new.filing_date AS VARCHAR) as filing_date,
      d.created_at
    FROM fund_holdings_diff d
    LEFT JOIN funds f ON d.fund_id = f.id
    LEFT JOIN fund_filings ff_new ON d.filing_id_new = ff_new.id
    ${whereClause}
    ORDER BY d.created_at DESC
    LIMIT ${limit * 2}  -- Récupérer plus pour filtrer après
  `;

  const results = await executeAthenaQuery(query);

  // Filtrer par minChangePct et date du filing
  const filtered = results
    .filter((diff: any) => {
      // Filtrer par date du filing
      if (diff.filing_date) {
        const filingDate = new Date(diff.filing_date);
        if (filingDate < cutoffDate) {
          return false;
        }
      }

      // Filtrer par minChangePct
      if (options?.minChangePct !== undefined) {
        // Toujours inclure "new" et "exit"
        if (diff.action === 'new' || diff.action === 'exit') {
          return true;
        }

        // Pour "increase" et "decrease", vérifier le pourcentage
        if (diff.action === 'increase' && diff.diff_pct_shares !== null) {
          return diff.diff_pct_shares >= options.minChangePct;
        }
        if (diff.action === 'decrease' && diff.diff_pct_shares !== null) {
          return Math.abs(diff.diff_pct_shares) >= options.minChangePct;
        }

        return false;
      }

      return true;
    })
    .slice(0, limit)
    .map((diff: any) => ({
      id: `diff_${diff.id}`,
      type: 'ticker_change' as const,
      ticker: diff.ticker || '',
      fund_id: parseInt(diff.fund_id || '0', 10),
      fund_name: diff.fund_name || 'Unknown',
      action: diff.action,
      diff_shares: parseInt(diff.diff_shares || '0', 10),
      diff_shares_pct: diff.diff_pct_shares ? parseFloat(diff.diff_pct_shares) : null,
      filing_date: diff.filing_date || '',
      timestamp: diff.created_at || new Date().toISOString(),
      importance: (diff.action === 'exit' || diff.action === 'new' || Math.abs(diff.diff_pct_shares || 0) >= 20) 
        ? 'high' as const 
        : 'medium' as const,
    }));

  return filtered;
}

/**
 * Obtenir les changements récents pour TOUS les funds (analyse globale)
 * 
 * Utilise Athena avec JOINs vers funds et fund_filings
 */
export async function getAllFundsRecentChangesAthena(
  minChangePct: number = 10,
  limit: number = 200,
  days?: number
): Promise<any[]> {
  // Construire la clause WHERE
  let whereClause = `WHERE d.action IN ('new', 'exit', 'increase', 'decrease')`;
  
  if (days && days > 0) {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);
    const dateThresholdStr = dateThreshold.toISOString().split('T')[0];
    whereClause += ` AND d.created_at >= DATE '${dateThresholdStr}'`;
  }

  const query = `
    SELECT 
      d.id,
      d.fund_id,
      d.ticker,
      d.action,
      d.diff_shares,
      d.diff_value,
      d.diff_pct_shares,
      d.filing_id_new,
      d.filing_id_old,
      d.created_at,
      f.id as fund_id_join,
      f.name as fund_name,
      f.cik as fund_cik,
      f.tier_influence,
      f.category,
      CAST(ff_new.filing_date AS VARCHAR) as filing_date,
      ff_new.form_type,
      CAST(ff_old.filing_date AS VARCHAR) as filing_date_old
    FROM fund_holdings_diff d
    LEFT JOIN funds f ON d.fund_id = f.id
    LEFT JOIN fund_filings ff_new ON d.filing_id_new = ff_new.id
    LEFT JOIN fund_filings ff_old ON d.filing_id_old = ff_old.id
    ${whereClause}
    ORDER BY d.created_at DESC
    LIMIT ${Math.min(limit * 3, 1000)}  -- Récupérer plus pour filtrer après
  `;

  const results = await executeAthenaQuery(query);

  // Filtrer côté application pour gérer minChangePct
  const filtered = results
    .filter((diff: any) => {
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
      
      // Si diff_pct_shares est null pour increase/decrease, exclure
      return false;
    })
    .slice(0, limit)
    .map((diff: any) => ({
      id: parseInt(diff.id || '0', 10),
      fund_id: parseInt(diff.fund_id || '0', 10),
      ticker: diff.ticker || null,
      action: diff.action,
      diff_shares: diff.diff_shares ? parseInt(diff.diff_shares, 10) : null,
      diff_value: diff.diff_value ? parseInt(diff.diff_value, 10) : null,
      diff_pct_shares: diff.diff_pct_shares ? parseFloat(diff.diff_pct_shares) : null,
      filing_id_new: diff.filing_id_new ? parseInt(diff.filing_id_new, 10) : null,
      filing_id_old: diff.filing_id_old ? parseInt(diff.filing_id_old, 10) : null,
      created_at: diff.created_at || '',
      fund: {
        id: parseInt(diff.fund_id_join || diff.fund_id || '0', 10),
        name: diff.fund_name || 'Unknown',
        cik: diff.fund_cik || '',
        tier_influence: parseInt(diff.tier_influence || '3', 10),
        category: diff.category || '',
      },
      filing_date: diff.filing_date || diff.created_at?.split('T')[0],
      form_type: diff.form_type || null,
    }));

  return filtered;
}
