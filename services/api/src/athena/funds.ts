/**
 * Service Athena pour les requêtes sur la table funds
 * 
 * Architecture Extreme Budget: Utilise S3 + Athena au lieu de PostgreSQL
 */

import { executeAthenaQuery, executeAthenaQuerySingle } from './query';
import { withCache, CacheKeys } from './cache';

export interface Fund {
  id: number;
  name: string;
  cik: string;
  tier_influence: number;
  category: string;
  created_at: string;
}

/**
 * Récupérer un fund par son ID
 * 
 * ⚠️ OPTIMISATION COÛT: Utilise uniquement Athena avec cache (pas de S3 direct read)
 * Le cache Lambda (5 min) évite les requêtes répétées, beaucoup moins cher que 43M requêtes S3 GET
 */
export async function getFundByIdAthena(id: number): Promise<Fund | null> {
  return withCache(
    CacheKeys.fundById(id),
    async () => {
      const query = `
        SELECT 
          id,
          name,
          cik,
          tier_influence,
          category,
          CAST(created_at AS VARCHAR) as created_at
        FROM funds
        WHERE id = ${id}
        LIMIT 1
      `;

      const result = await executeAthenaQuerySingle(query);
      
      if (!result) {
        return null;
      }

      return {
        id: parseInt(result.id || '0', 10),
        name: result.name || '',
        cik: result.cik || '',
        tier_influence: parseInt(result.tier_influence || '3', 10),
        category: result.category || '',
        created_at: result.created_at || '',
      };
    },
    5 * 60 * 1000 // 5 minutes cache
  );
}

/**
 * Récupérer un fund par son CIK
 * 
 * ⚠️ OPTIMISATION COÛT: Utilise uniquement Athena avec cache (pas de S3 direct read)
 */
export async function getFundByCikAthena(cik: string): Promise<Fund | null> {
  return withCache(
    CacheKeys.fundByCik(cik),
    async () => {
      const query = `
        SELECT 
          id,
          name,
          cik,
          tier_influence,
          category,
          CAST(created_at AS VARCHAR) as created_at
        FROM funds
        WHERE cik = '${cik.replace(/'/g, "''")}'
        LIMIT 1
      `;

      const result = await executeAthenaQuerySingle(query);
      
      if (!result) {
        return null;
      }

      return {
        id: parseInt(result.id || '0', 10),
        name: result.name || '',
        cik: result.cik || '',
        tier_influence: parseInt(result.tier_influence || '3', 10),
        category: result.category || '',
        created_at: result.created_at || '',
      };
    },
    5 * 60 * 1000 // 5 minutes cache
  );
}

/**
 * Lister tous les funds
 * 
 * Utilise Athena avec cache (petite table, ~20 rows)
 */
export async function getFundsAthena(limit: number = 100): Promise<Fund[]> {
  return withCache(
    CacheKeys.fundsList(),
    async () => {
      const query = `
        SELECT 
          id,
          name,
          cik,
          tier_influence,
          category,
          CAST(created_at AS VARCHAR) as created_at
        FROM funds
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

      const results = await executeAthenaQuery(query);
      
      return results.map(result => ({
        id: parseInt(result.id || '0', 10),
        name: result.name || '',
        cik: result.cik || '',
        tier_influence: parseInt(result.tier_influence || '3', 10),
        category: result.category || '',
        created_at: result.created_at || '',
      }));
    },
    5 * 60 * 1000 // 5 minutes cache
  );
}
