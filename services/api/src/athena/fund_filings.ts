/**
 * Service Athena pour les requêtes sur la table fund_filings
 * 
 * Architecture Extreme Budget: Utilise S3 + Athena au lieu de PostgreSQL
 */

import { executeAthenaQuery, executeAthenaQuerySingle } from './query';
import { withCache, CacheKeys } from './cache';

export interface FundFiling {
  id: number;
  fund_id: number;
  cik: string;
  accession_number: string;
  form_type: string;
  filing_date: string;
  report_date: string | null;
  status: string;
  raw_storage_path: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Récupérer les filings d'un fund
 * 
 * Utilise Athena avec cache pour éviter les requêtes répétées
 */
export async function getFundFilingsAthena(fundId: number, limit?: number): Promise<FundFiling[]> {
  return withCache(
    CacheKeys.fundFilings(fundId),
    async () => {
      const limitClause = limit ? `LIMIT ${limit}` : '';
      
      const query = `
        SELECT 
          id,
          fund_id,
          cik,
          accession_number,
          form_type,
          CAST(filing_date AS VARCHAR) as filing_date,
          CAST(report_date AS VARCHAR) as report_date,
          status,
          raw_storage_path,
          CAST(created_at AS VARCHAR) as created_at,
          CAST(updated_at AS VARCHAR) as updated_at
        FROM fund_filings
        WHERE fund_id = ${fundId}
        ORDER BY filing_date DESC
        ${limitClause}
      `;

      const results = await executeAthenaQuery(query);
      
      return results.map(result => ({
        id: parseInt(result.id || '0', 10),
        fund_id: parseInt(result.fund_id || '0', 10),
        cik: result.cik || '',
        accession_number: result.accession_number || '',
        form_type: result.form_type || '',
        filing_date: result.filing_date || '',
        report_date: result.report_date || null,
        status: result.status || '',
        raw_storage_path: result.raw_storage_path || null,
        created_at: result.created_at || '',
        updated_at: result.updated_at || '',
      }));
    },
    5 * 60 * 1000 // 5 minutes cache
  );
}

/**
 * Récupérer un filing spécifique par ID
 */
export async function getFundFilingByIdAthena(fundId: number, filingId: number): Promise<FundFiling | null> {
  return withCache(
    CacheKeys.fundFiling(fundId, filingId),
    async () => {
      const query = `
        SELECT 
          id,
          fund_id,
          cik,
          accession_number,
          form_type,
          CAST(filing_date AS VARCHAR) as filing_date,
          CAST(report_date AS VARCHAR) as report_date,
          status,
          raw_storage_path,
          CAST(created_at AS VARCHAR) as created_at,
          CAST(updated_at AS VARCHAR) as updated_at
        FROM fund_filings
        WHERE id = ${filingId}
          AND fund_id = ${fundId}
        LIMIT 1
      `;

      const result = await executeAthenaQuerySingle(query);
      
      if (!result) {
        return null;
      }

      return {
        id: parseInt(result.id || '0', 10),
        fund_id: parseInt(result.fund_id || '0', 10),
        cik: result.cik || '',
        accession_number: result.accession_number || '',
        form_type: result.form_type || '',
        filing_date: result.filing_date || '',
        report_date: result.report_date || null,
        status: result.status || '',
        raw_storage_path: result.raw_storage_path || null,
        created_at: result.created_at || '',
        updated_at: result.updated_at || '',
      };
    },
    5 * 60 * 1000 // 5 minutes cache
  );
}
