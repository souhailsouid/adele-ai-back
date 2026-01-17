/**
 * Service Athena pour les requêtes sur la table companies
 * 
 * Architecture Extreme Budget: Utilise S3 + Athena au lieu de PostgreSQL
 */

import { executeAthenaQuery, executeAthenaQuerySingle } from './query';
import { withCache, CacheKeys } from './cache';
import { Company } from '../companies';

/**
 * Récupérer une entreprise par son ticker
 * 
 * ⚠️ OPTIMISATION COÛT: Utilise uniquement Athena avec cache (pas de S3 direct read)
 * Le cache Lambda (5 min) évite les requêtes répétées, beaucoup moins cher que 43M requêtes S3 GET
 */
export async function getCompanyByTickerAthena(ticker: string): Promise<Company | null> {
  return withCache(
    CacheKeys.companyByTicker(ticker),
    async () => {
      const query = `
        SELECT 
          id,
          ticker,
          cik,
          name,
          sector,
          industry,
          market_cap,
          headquarters_country,
          headquarters_state,
          sic_code,
          category,
          CAST(created_at AS VARCHAR) as created_at,
          CAST(updated_at AS VARCHAR) as updated_at
        FROM companies
        WHERE UPPER(TRIM(ticker)) = UPPER(TRIM('${ticker.replace(/'/g, "''")}'))
        LIMIT 1
      `;

      const result = await executeAthenaQuerySingle(query);
      
      if (!result) {
        return null;
      }

      return {
        id: parseInt(result.id || '0', 10),
        ticker: result.ticker || '',
        cik: result.cik || '',
        name: result.name || '',
        sector: result.sector || null,
        industry: result.industry || null,
        market_cap: result.market_cap ? parseInt(result.market_cap, 10) : null,
        headquarters_country: result.headquarters_country || null,
        headquarters_state: result.headquarters_state || null,
        sic_code: result.sic_code || null,
        category: result.category || null,
        created_at: result.created_at || '',
        updated_at: result.updated_at || '',
      };
    },
    5 * 60 * 1000 // 5 minutes cache
  );
}

/**
 * Récupérer une entreprise par son ID
 * 
 * ⚠️ OPTIMISATION COÛT: Utilise uniquement Athena avec cache (pas de S3 direct read)
 */
export async function getCompanyByIdAthena(id: number): Promise<Company | null> {
  return withCache(
    CacheKeys.companyById(id),
    async () => {
      const query = `
        SELECT 
          id,
          ticker,
          cik,
          name,
          sector,
          industry,
          market_cap,
          headquarters_country,
          headquarters_state,
          sic_code,
          category,
          CAST(created_at AS VARCHAR) as created_at,
          CAST(updated_at AS VARCHAR) as updated_at
        FROM companies
        WHERE id = ${id}
        LIMIT 1
      `;

      const result = await executeAthenaQuerySingle(query);
      
      if (!result) {
        return null;
      }

      return {
        id: parseInt(result.id || '0', 10),
        ticker: result.ticker || '',
        cik: result.cik || '',
        name: result.name || '',
        sector: result.sector || null,
        industry: result.industry || null,
        market_cap: result.market_cap ? parseInt(result.market_cap, 10) : null,
        headquarters_country: result.headquarters_country || null,
        headquarters_state: result.headquarters_state || null,
        sic_code: result.sic_code || null,
        category: result.category || null,
        created_at: result.created_at || '',
        updated_at: result.updated_at || '',
      };
    },
    5 * 60 * 1000
  );
}

/**
 * Récupérer une entreprise par son CIK
 * 
 * ⚠️ OPTIMISATION COÛT: Utilise uniquement Athena avec cache (pas de S3 direct read)
 */
export async function getCompanyByCikAthena(cik: string): Promise<Company | null> {
  return withCache(
    CacheKeys.companyByCik(cik),
    async () => {
      const query = `
        SELECT 
          id,
          ticker,
          cik,
          name,
          sector,
          industry,
          market_cap,
          headquarters_country,
          headquarters_state,
          sic_code,
          category,
          CAST(created_at AS VARCHAR) as created_at,
          CAST(updated_at AS VARCHAR) as updated_at
        FROM companies
        WHERE cik = '${cik.replace(/'/g, "''")}'
        LIMIT 1
      `;

      const result = await executeAthenaQuerySingle(query);
      
      if (!result) {
        return null;
      }

      return {
        id: parseInt(result.id || '0', 10),
        ticker: result.ticker || '',
        cik: result.cik || '',
        name: result.name || '',
        sector: result.sector || null,
        industry: result.industry || null,
        market_cap: result.market_cap ? parseInt(result.market_cap, 10) : null,
        headquarters_country: result.headquarters_country || null,
        headquarters_state: result.headquarters_state || null,
        sic_code: result.sic_code || null,
        category: result.category || null,
        created_at: result.created_at || '',
        updated_at: result.updated_at || '',
      };
    },
    5 * 60 * 1000
  );
}

/**
 * Lister les entreprises (avec pagination)
 * 
 * Note: Athena ne supporte pas OFFSET dans tous les contextes.
 * Pour offset > 0, on utilise une sous-requête avec ROW_NUMBER() ou on limite simplement.
 */
export async function getCompaniesAthena(
  limit: number = 100,
  offset: number = 0,
  orderBy: 'market_cap' | 'name' | 'ticker' = 'market_cap',
  orderDirection: 'ASC' | 'DESC' = 'DESC'
): Promise<Company[]> {
  // Si offset est 0, on peut utiliser LIMIT directement
  // Sinon, on utilise une sous-requête avec ROW_NUMBER() pour la pagination
  let query: string;
  
  if (offset === 0) {
    query = `
      SELECT 
        id,
        ticker,
        cik,
        name,
        sector,
        industry,
        market_cap,
        headquarters_country,
        headquarters_state,
        sic_code,
        category,
        CAST(created_at AS VARCHAR) as created_at,
        CAST(updated_at AS VARCHAR) as updated_at
      FROM companies
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT ${limit}
    `;
  } else {
    // Pour offset > 0, utiliser ROW_NUMBER() pour la pagination
    query = `
      SELECT 
        id,
        ticker,
        cik,
        name,
        sector,
        industry,
        market_cap,
        headquarters_country,
        headquarters_state,
        sic_code,
        category,
        CAST(created_at AS VARCHAR) as created_at,
        CAST(updated_at AS VARCHAR) as updated_at
      FROM (
        SELECT 
          *,
          ROW_NUMBER() OVER (ORDER BY ${orderBy} ${orderDirection}) as rn
        FROM companies
      ) ranked
      WHERE rn > ${offset} AND rn <= ${offset + limit}
    `;
  }

  const results = await executeAthenaQuery(query);

  return results.map((row: any) => ({
    id: parseInt(row.id || '0', 10),
    ticker: row.ticker || '',
    cik: row.cik || '',
    name: row.name || '',
    sector: row.sector || null,
    industry: row.industry || null,
    market_cap: row.market_cap ? parseInt(row.market_cap, 10) : null,
    headquarters_country: row.headquarters_country || null,
    headquarters_state: row.headquarters_state || null,
    sic_code: row.sic_code || null,
    category: row.category || null,
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
  }));
}
