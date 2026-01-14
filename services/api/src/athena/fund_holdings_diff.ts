/**
 * Service Athena pour les requêtes sur la table fund_holdings_diff
 * 
 * Architecture Extreme Budget: Utilise S3 + Athena au lieu de PostgreSQL
 */

import { executeAthenaQuery } from './query';

export interface FundHoldingDiff {
  id: number;
  fund_id: number;
  ticker: string | null;
  filing_id_new: number | null;
  filing_id_old: number | null;
  diff_shares: number | null;
  diff_value: number | null;
  diff_pct_shares: number | null;
  action: string | null;
  created_at: string;
}

/**
 * Récupérer les diffs d'un fund depuis fund_holdings_diff
 * 
 * Note: Cette fonction lit uniquement les diffs pré-calculés.
 * Pour calculer des diffs dynamiques, utiliser calculateFundDiff (Supabase pour l'instant).
 */
export async function getFundDiffsAthena(
  fundId: number,
  limit: number = 50,
  ticker?: string
): Promise<FundHoldingDiff[]> {
  const tickerFilter = ticker ? `AND UPPER(ticker) = UPPER('${ticker.replace(/'/g, "''")}')` : '';
  
  const query = `
    SELECT 
      id,
      fund_id,
      ticker,
      filing_id_new,
      filing_id_old,
      diff_shares,
      diff_value,
      diff_pct_shares,
      action,
      CAST(created_at AS VARCHAR) as created_at
    FROM fund_holdings_diff
    WHERE fund_id = ${fundId}
      ${tickerFilter}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  const results = await executeAthenaQuery(query);
  
  return results.map(result => ({
    id: parseInt(result.id || '0', 10),
    fund_id: parseInt(result.fund_id || '0', 10),
    ticker: result.ticker || null,
    filing_id_new: result.filing_id_new ? parseInt(result.filing_id_new, 10) : null,
    filing_id_old: result.filing_id_old ? parseInt(result.filing_id_old, 10) : null,
    diff_shares: result.diff_shares ? parseInt(result.diff_shares, 10) : null,
    diff_value: result.diff_value ? parseInt(result.diff_value, 10) : null,
    diff_pct_shares: result.diff_pct_shares ? parseFloat(result.diff_pct_shares) : null,
    action: result.action || null,
    created_at: result.created_at || '',
  }));
}
