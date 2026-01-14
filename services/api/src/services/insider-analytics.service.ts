/**
 * Service d'analytics pour les insiders
 * 
 * Calcule le ROI moyen et la fiabilité des dirigeants
 */

import { executeAthenaQuery } from '../athena/query';

export interface InsiderROI {
  insider_cik: string;
  insider_name: string;
  total_transactions: number;
  buy_transactions: number;
  sell_transactions: number;
  avg_roi_pct: number | null;
  median_roi_pct: number | null;
  win_rate: number; // % de transactions avec ROI positif
  reliability_score: 'A' | 'B' | 'C' | 'D' | 'F';
  total_buy_value: number;
  total_sell_value: number;
}

export interface CompanyInsiderROI {
  ticker: string;
  company_name: string;
  insider_count: number;
  avg_roi_pct: number | null;
  total_buy_value: number;
  transaction_count: number;
}

export class InsiderAnalyticsService {
  /**
   * Calculer le ROI moyen d'un insider
   * 
   * ROI = (prix_vente - prix_achat) / prix_achat * 100
   * 
   * On compare le prix d'achat avec le prix de vente ultérieur
   */
  async calculateInsiderROI(insiderCik: string, days: number = 365): Promise<InsiderROI | null> {
    // Requête complexe pour calculer le ROI
    // On cherche les paires buy/sell pour le même insider
    const query = `
      WITH buy_transactions AS (
        SELECT 
          it.insider_cik,
          MAX(it.insider_name) as insider_name,
          it.company_id,
          it.transaction_date as buy_date,
          it.price_per_share as buy_price,
          it.total_value as buy_value,
          c.ticker
        FROM insider_trades it
        LEFT JOIN companies c ON it.company_id = c.id
        WHERE it.insider_cik = '${insiderCik.replace(/'/g, "''")}'
          AND LOWER(it.transaction_type) IN ('buy', 'purchase')
          AND it.price_per_share IS NOT NULL
          AND it.transaction_date >= date_add('day', -${days}, CURRENT_DATE)
      ),
      sell_transactions AS (
        SELECT 
          it.insider_cik,
          it.company_id,
          it.transaction_date as sell_date,
          it.price_per_share as sell_price,
          it.total_value as sell_value
        FROM insider_trades it
        WHERE it.insider_cik = '${insiderCik.replace(/'/g, "''")}'
          AND LOWER(it.transaction_type) IN ('sell', 'sale')
          AND it.price_per_share IS NOT NULL
          AND it.transaction_date >= date_add('day', -${days}, CURRENT_DATE)
      ),
      matched_pairs AS (
        SELECT 
          b.insider_cik,
          b.insider_name,
          b.ticker,
          b.buy_date,
          b.buy_price,
          b.buy_value,
          s.sell_date,
          s.sell_price,
          s.sell_value,
          CASE 
            WHEN b.buy_price > 0 THEN ((s.sell_price - b.buy_price) / b.buy_price * 100)
            ELSE NULL
          END as roi_pct
        FROM buy_transactions b
        INNER JOIN sell_transactions s ON b.company_id = s.company_id
        WHERE s.sell_date > b.buy_date
          AND s.sell_date <= date_add('day', 365, b.buy_date)
      )
      SELECT 
        MAX(insider_cik) as insider_cik,
        MAX(insider_name) as insider_name,
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN roi_pct IS NOT NULL THEN 1 END) as transactions_with_roi,
        AVG(roi_pct) as avg_roi_pct,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY roi_pct) as median_roi_pct,
        COUNT(CASE WHEN roi_pct > 0 THEN 1 END) * 100.0 / NULLIF(COUNT(CASE WHEN roi_pct IS NOT NULL THEN 1 END), 0) as win_rate,
        SUM(buy_value) as total_buy_value,
        SUM(sell_value) as total_sell_value
      FROM matched_pairs
      GROUP BY insider_cik
    `;

    const results = await executeAthenaQuery(query);
    
    if (results.length === 0) {
      return null;
    }

    const row = results[0];
    const avgROI = row[4] ? parseFloat(row[4]) : null;
    const medianROI = row[5] ? parseFloat(row[5]) : null;
    const winRate = row[6] ? parseFloat(row[6]) : 0;

    // Calculer le reliability score
    const reliabilityScore = this.calculateReliabilityScore(avgROI, medianROI, winRate, parseInt(row[2] || '0', 10));

    return {
      insider_cik: row[0] || insiderCik,
      insider_name: row[1] || null,
      total_transactions: parseInt(row[2] || '0', 10),
      buy_transactions: parseInt(row[2] || '0', 10), // Approximation
      sell_transactions: parseInt(row[2] || '0', 10), // Approximation
      avg_roi_pct: avgROI,
      median_roi_pct: medianROI,
      win_rate: winRate,
      reliability_score: reliabilityScore,
      total_buy_value: parseFloat(row[7] || '0'),
      total_sell_value: parseFloat(row[8] || '0'),
    };
  }

  /**
   * Calculer le ROI moyen pour une entreprise (tous les insiders)
   */
  async calculateCompanyInsiderROI(ticker: string, days: number = 365): Promise<CompanyInsiderROI | null> {
    const query = `
      SELECT 
        c.ticker,
        c.name as company_name,
        COUNT(DISTINCT it.insider_cik) as insider_count,
        AVG(
          CASE 
            WHEN LOWER(it.transaction_type) IN ('buy', 'purchase') AND it.price_per_share > 0 
            THEN it.price_per_share 
            ELSE NULL 
          END
        ) as avg_buy_price,
        COUNT(*) as transaction_count,
        SUM(CASE WHEN LOWER(it.transaction_type) IN ('buy', 'purchase') THEN it.total_value ELSE 0 END) as total_buy_value
      FROM insider_trades it
      LEFT JOIN companies c ON it.company_id = c.id
      WHERE UPPER(TRIM(c.ticker)) = UPPER(TRIM('${ticker.replace(/'/g, "''")}'))
        AND it.transaction_date >= date_add('day', -${days}, CURRENT_DATE)
        AND LOWER(it.transaction_type) IN ('buy', 'sell', 'purchase', 'sale')
      GROUP BY c.ticker, c.name
    `;

    const results = await executeAthenaQuery(query);
    
    if (results.length === 0) {
      return null;
    }

    const row = results[0];
    
    // Pour le ROI moyen, on aurait besoin de comparer avec les prix de vente
    // Pour simplifier, on retourne les stats de base
    return {
      ticker: row[0] || ticker,
      company_name: row[1] || null,
      insider_count: parseInt(row[2] || '0', 10),
      avg_roi_pct: null, // Nécessiterait une requête plus complexe
      total_buy_value: parseFloat(row[5] || '0'),
      transaction_count: parseInt(row[4] || '0', 10),
    };
  }

  /**
   * Calculer le reliability score (A, B, C, D, F)
   * 
   * Critères:
   * - A: ROI moyen > 20%, win rate > 60%, > 10 transactions
   * - B: ROI moyen > 10%, win rate > 50%, > 5 transactions
   * - C: ROI moyen > 0%, win rate > 40%, > 3 transactions
   * - D: ROI moyen > -10%, win rate > 30%
   * - F: Sinon
   */
  private calculateReliabilityScore(
    avgROI: number | null,
    medianROI: number | null,
    winRate: number,
    transactionCount: number
  ): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (!avgROI || transactionCount < 3) {
      return 'F';
    }

    const roi = avgROI;
    const median = medianROI || avgROI;

    // Score A
    if (roi > 20 && winRate > 60 && transactionCount > 10) {
      return 'A';
    }

    // Score B
    if (roi > 10 && winRate > 50 && transactionCount > 5) {
      return 'B';
    }

    // Score C
    if (roi > 0 && winRate > 40 && transactionCount > 3) {
      return 'C';
    }

    // Score D
    if (roi > -10 && winRate > 30) {
      return 'D';
    }

    // Score F
    return 'F';
  }

  /**
   * Top insiders par ROI (pour dashboard)
   */
  async getTopInsidersByROI(limit: number = 20, minTransactions: number = 5): Promise<InsiderROI[]> {
    // Cette requête est complexe, on simplifie pour l'instant
    // En production, on pourrait pré-calculer ces stats dans une table dédiée
    const query = `
      SELECT 
        it.insider_cik,
        MAX(it.insider_name) as insider_name,
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN LOWER(it.transaction_type) IN ('buy', 'purchase') THEN 1 END) as buy_transactions,
        COUNT(CASE WHEN LOWER(it.transaction_type) IN ('sell', 'sale') THEN 1 END) as sell_transactions,
        SUM(CASE WHEN LOWER(it.transaction_type) IN ('buy', 'purchase') THEN it.total_value ELSE 0 END) as total_buy_value,
        SUM(CASE WHEN LOWER(it.transaction_type) IN ('sell', 'sale') THEN it.total_value ELSE 0 END) as total_sell_value
      FROM insider_trades it
      WHERE it.transaction_date >= date_add('day', -365, CURRENT_DATE)
        AND LOWER(it.transaction_type) IN ('buy', 'sell', 'purchase', 'sale')
        AND it.insider_cik IS NOT NULL
      GROUP BY it.insider_cik
      HAVING COUNT(*) >= ${minTransactions}
      ORDER BY total_buy_value DESC
      LIMIT ${limit}
    `;

    const results = await executeAthenaQuery(query);
    
    // Pour chaque insider, calculer le ROI (simplifié)
    const insiders: InsiderROI[] = [];
    
    for (const row of results) {
      const insiderCik = row[0];
      const roi = await this.calculateInsiderROI(insiderCik);
      
      if (roi) {
        insiders.push(roi);
      }
    }

    // Trier par ROI moyen
    return insiders.sort((a, b) => {
      const roiA = a.avg_roi_pct || -1000;
      const roiB = b.avg_roi_pct || -1000;
      return roiB - roiA;
    });
  }
}
