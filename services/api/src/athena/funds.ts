/**
 * Service Athena pour les requêtes sur la table funds
 * 
 * Architecture Extreme Budget: Utilise S3 + Athena au lieu de PostgreSQL
 */

import { executeAthenaQuery, executeAthenaQuerySingle } from './query';
import { findRowByIdInS3Parquet, findRowByColumnInS3Parquet } from './s3-direct-read';
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
 * Utilise S3 direct read (pas Athena) pour éviter le minimum de facturation
 */
export async function getFundByIdAthena(id: number): Promise<Fund | null> {
  return withCache(
    CacheKeys.fundById(id),
    async () => {
      // S3 direct read pour lookup par ID (évite le minimum 10MB d'Athena)
      return await findRowByIdInS3Parquet<Fund>('funds', id);
    },
    5 * 60 * 1000 // 5 minutes cache
  );
}

/**
 * Récupérer un fund par son CIK
 * 
 * Optimisé avec cache et S3 direct read
 */
export async function getFundByCikAthena(cik: string): Promise<Fund | null> {
  return withCache(
    CacheKeys.fundByCik(cik),
    async () => {
      // Essayer S3 direct read d'abord
      const s3Result = await findRowByColumnInS3Parquet<Fund>(
        'funds',
        'cik',
        cik
      );

      if (s3Result) {
        return s3Result;
      }

      // Fallback Athena
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
