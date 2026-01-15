/**
 * Service pour consulter les données insider (Read API)
 * 
 * Architecture: S3 + Athena pour analytics, DynamoDB pour cache rapide
 */

import { executeAthenaQuery } from '../athena/query';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { withCache, CacheKeys } from '../athena/cache';

const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-3' })
);

const INSIDERS_CACHE_TABLE = process.env.INSIDERS_CACHE_TABLE || 'adel-ai-dev-insiders-cache';
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 jours

export interface InsiderTransaction {
  id: number;
  company_id: number | null;
  filing_id: number | null;
  insider_name: string | null;
  insider_cik: string | null;
  insider_title: string | null;
  relation: string | null;
  transaction_type: string | null;
  shares: number | null;
  price_per_share: number | null;
  total_value: number | null;
  transaction_date: string | null;
  alert_flag: boolean | null;
  created_at: string | null;
  // Champs enrichis
  ticker?: string;
  company_name?: string;
}

export interface TrendingInsider {
  ticker: string;
  company_name: string;
  total_buy_value: number;
  total_sell_value: number;
  net_value: number;
  transaction_count: number;
  last_transaction_date: string;
}

export interface InsiderPersonRecord {
  insider_cik: string;
  insider_name: string;
  total_companies: number;
  total_buy_value: number;
  total_sell_value: number;
  net_value: number;
  transaction_count: number;
  companies: Array<{
    ticker: string;
    company_name: string;
    transaction_count: number;
    net_value: number;
  }>;
}

export class InsidersService {
  /**
   * GET /insiders/trending
   * Top entreprises avec le plus d'achats d'insiders sur les 7 derniers jours
   */
  async getTrendingInsiders(days: number = 7, limit: number = 20): Promise<TrendingInsider[]> {
    const cacheKey = `trending_${days}d_${limit}`;
    
    // Vérifier le cache DynamoDB
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached as TrendingInsider[];
    }

    // Athena utilise date_add au lieu de INTERVAL
    const query = `
      SELECT 
        c.ticker,
        c.name as company_name,
        SUM(CASE WHEN LOWER(it.transaction_type) IN ('buy', 'purchase') THEN it.total_value ELSE 0 END) as total_buy_value,
        SUM(CASE WHEN LOWER(it.transaction_type) IN ('sell', 'sale') THEN it.total_value ELSE 0 END) as total_sell_value,
        SUM(CASE WHEN LOWER(it.transaction_type) IN ('buy', 'purchase') THEN it.total_value ELSE -it.total_value END) as net_value,
        COUNT(*) as transaction_count,
        MAX(it.transaction_date) as last_transaction_date
      FROM insider_trades it
      LEFT JOIN companies c ON it.company_id = c.id
      WHERE it.transaction_date >= date_add('day', -${days}, CURRENT_DATE)
        AND LOWER(it.transaction_type) IN ('buy', 'sell', 'purchase', 'sale')
        AND it.total_value IS NOT NULL
      GROUP BY c.ticker, c.name
      HAVING SUM(CASE WHEN LOWER(it.transaction_type) IN ('buy', 'purchase') THEN it.total_value ELSE 0 END) > 0
      ORDER BY net_value DESC
      LIMIT ${limit}
    `;

    const results = await executeAthenaQuery(query);
    
    const trending: TrendingInsider[] = results.map((row: any) => ({
      ticker: row.ticker || '',
      company_name: row.company_name || '',
      total_buy_value: parseFloat(row.total_buy_value || '0'),
      total_sell_value: parseFloat(row.total_sell_value || '0'),
      net_value: parseFloat(row.net_value || '0'),
      transaction_count: parseInt(row.transaction_count || '0', 10),
      last_transaction_date: row.last_transaction_date || '',
    }));

    // Mettre en cache (TTL 1 heure pour trending)
    await this.putInCache(cacheKey, trending, 3600);

    return trending;
  }

  /**
   * GET /insiders/company/{ticker}
   * Liste toutes les transactions pour une entreprise
   */
  async getCompanyInsiderTransactions(
    ticker: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<InsiderTransaction[]> {
    const cacheKey = `company_${ticker}_${limit}_${offset}`;
    
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached as InsiderTransaction[];
    }

    // Athena ne supporte pas OFFSET de manière standard, utiliser ROW_NUMBER() pour la pagination
    const query = offset > 0 ? `
      SELECT * FROM (
        SELECT 
          it.id,
          it.company_id,
          it.filing_id,
          it.insider_name,
          it.insider_cik,
          it.insider_title,
          it.relation,
          it.transaction_type,
          it.shares,
          it.price_per_share,
          it.total_value,
          CAST(it.transaction_date AS VARCHAR) as transaction_date,
          it.alert_flag,
          CAST(it.created_at AS VARCHAR) as created_at,
          c.ticker,
          c.name as company_name,
          ROW_NUMBER() OVER (ORDER BY it.transaction_date DESC, it.created_at DESC) as rn
        FROM insider_trades it
        LEFT JOIN companies c ON it.company_id = c.id
        WHERE UPPER(TRIM(c.ticker)) = UPPER(TRIM('${ticker.replace(/'/g, "''")}'))
      ) WHERE rn > ${offset} AND rn <= ${offset + limit}
    ` : `
      SELECT 
        it.id,
        it.company_id,
        it.filing_id,
        it.insider_name,
        it.insider_cik,
        it.insider_title,
        it.relation,
        it.transaction_type,
        it.shares,
        it.price_per_share,
        it.total_value,
        CAST(it.transaction_date AS VARCHAR) as transaction_date,
        it.alert_flag,
        CAST(it.created_at AS VARCHAR) as created_at,
        c.ticker,
        c.name as company_name
      FROM insider_trades it
      LEFT JOIN companies c ON it.company_id = c.id
      WHERE UPPER(TRIM(c.ticker)) = UPPER(TRIM('${ticker.replace(/'/g, "''")}'))
      ORDER BY it.transaction_date DESC, it.created_at DESC
      LIMIT ${limit}
    `;

    const results = await executeAthenaQuery(query);
    
    const transactions: InsiderTransaction[] = results.map((row: any) => ({
      id: parseInt(row.id || '0', 10),
      company_id: row.company_id ? parseInt(row.company_id, 10) : null,
      filing_id: row.filing_id ? parseInt(row.filing_id, 10) : null,
      insider_name: row.insider_name || null,
      insider_cik: row.insider_cik || null,
      insider_title: row.insider_title || null,
      relation: row.relation || null,
      transaction_type: row.transaction_type || null,
      shares: row.shares ? parseInt(row.shares, 10) : null,
      price_per_share: row.price_per_share ? parseFloat(row.price_per_share) : null,
      total_value: row.total_value ? parseFloat(row.total_value) : null,
      transaction_date: row.transaction_date || null,
      alert_flag: row.alert_flag === true || row.alert_flag === 'true',
      created_at: row.created_at || null,
      ticker: row.ticker || ticker,
      company_name: row.company_name || null,
    }));

    // Mettre en cache (TTL 30 minutes)
    await this.putInCache(cacheKey, transactions, 1800);

    return transactions;
  }

  /**
   * GET /insiders/person/{cik}
   * Track record d'un dirigeant (cross-company)
   */
  async getInsiderPersonRecord(insiderCik: string): Promise<InsiderPersonRecord | null> {
    const cacheKey = `person_${insiderCik}`;
    
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached as InsiderPersonRecord;
    }

    // Requête principale pour les stats globales
    const statsQuery = `
      SELECT 
        it.insider_cik,
        MAX(it.insider_name) as insider_name,
        COUNT(DISTINCT it.company_id) as total_companies,
        SUM(CASE WHEN LOWER(it.transaction_type) IN ('buy', 'purchase') THEN it.total_value ELSE 0 END) as total_buy_value,
        SUM(CASE WHEN LOWER(it.transaction_type) IN ('sell', 'sale') THEN it.total_value ELSE 0 END) as total_sell_value,
        SUM(CASE WHEN LOWER(it.transaction_type) IN ('buy', 'purchase') THEN it.total_value ELSE -it.total_value END) as net_value,
        COUNT(*) as transaction_count
      FROM insider_trades it
      WHERE it.insider_cik = '${insiderCik.replace(/'/g, "''")}'
        AND LOWER(it.transaction_type) IN ('buy', 'sell', 'purchase', 'sale')
        AND it.total_value IS NOT NULL
      GROUP BY it.insider_cik
    `;

    const statsResults = await executeAthenaQuery(statsQuery);
    
    if (statsResults.length === 0) {
      return null;
    }

    if (statsResults.length === 0) {
      return null;
    }
    
    // Requête pour les entreprises par insider
    const companiesQuery = `
      SELECT 
        c.ticker,
        c.name as company_name,
        COUNT(*) as transaction_count,
        SUM(CASE WHEN LOWER(it.transaction_type) IN ('buy', 'purchase') THEN it.total_value ELSE -it.total_value END) as net_value
      FROM insider_trades it
      LEFT JOIN companies c ON it.company_id = c.id
      WHERE it.insider_cik = '${insiderCik.replace(/'/g, "''")}'
        AND LOWER(it.transaction_type) IN ('buy', 'sell', 'purchase', 'sale')
        AND it.total_value IS NOT NULL
      GROUP BY c.ticker, c.name
      ORDER BY net_value DESC
    `;

    const companiesResults = await executeAthenaQuery(companiesQuery);
    
    const statsRow = statsResults[0];
    const record: InsiderPersonRecord = {
      insider_cik: statsRow?.insider_cik || insiderCik,
      insider_name: statsRow?.insider_name || null,
      total_companies: parseInt(statsRow?.total_companies || '0', 10),
      total_buy_value: parseFloat(statsRow?.total_buy_value || '0'),
      total_sell_value: parseFloat(statsRow?.total_sell_value || '0'),
      net_value: parseFloat(statsRow?.net_value || '0'),
      transaction_count: parseInt(statsRow?.transaction_count || '0', 10),
      companies: companiesResults.map((row: any) => ({
        ticker: row.ticker || '',
        company_name: row.company_name || '',
        transaction_count: parseInt(row.transaction_count || '0', 10),
        net_value: parseFloat(row.net_value || '0'),
      })),
    };

    // Mettre en cache (TTL 1 heure)
    await this.putInCache(cacheKey, record, 3600);

    return record;
  }

  /**
   * GET /insiders/signals/hot
   * Récupère les derniers "Top Signals" (achats volontaires significatifs)
   * 
   * Critères Golden Filter:
   * - Purchase uniquement (Code P)
   * - Montant > 50 000$
   * - Priorité CEO/CFO/Director
   */
  async getHotSignals(limit: number = 10, minScore: number = 5): Promise<any[]> {
    const cacheKey = `hot_signals_${limit}_${minScore}`;
    
    // Vérifier le cache DynamoDB (TTL 5 minutes pour hot signals)
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached as any[];
    }

    const query = `
      SELECT 
        ts.id,
        ts.company_id,
        ts.filing_id,
        ts.insider_name,
        ts.insider_cik,
        ts.insider_title,
        ts.relation,
        ts.transaction_type,
        ts.shares,
        ts.price_per_share,
        ts.total_value,
        CAST(ts.transaction_date AS VARCHAR) as transaction_date,
        ts.signal_score,
        CAST(ts.created_at AS VARCHAR) as created_at,
        c.ticker,
        c.name as company_name,
        cf.accession_number,
        CAST(cf.filing_date AS VARCHAR) as filing_date
      FROM top_insider_signals ts
      LEFT JOIN companies c ON ts.company_id = c.id
      LEFT JOIN company_filings cf ON ts.filing_id = cf.id
      WHERE ts.signal_score >= ${minScore}
      ORDER BY ts.signal_score DESC, ts.transaction_date DESC, ts.created_at DESC
      LIMIT ${limit}
    `;

    const results = await executeAthenaQuery(query);
    
    const signals = results.map((row: any) => ({
      id: parseInt(row.id || '0', 10),
      company_id: row.company_id ? parseInt(row.company_id, 10) : null,
      filing_id: row.filing_id ? parseInt(row.filing_id, 10) : null,
      insider_name: row.insider_name || null,
      insider_cik: row.insider_cik || null,
      insider_title: row.insider_title || null,
      relation: row.relation || null,
      transaction_type: row.transaction_type || null,
      shares: row.shares ? parseInt(row.shares, 10) : null,
      price_per_share: row.price_per_share ? parseFloat(row.price_per_share) : null,
      total_value: row.total_value ? parseFloat(row.total_value) : null,
      transaction_date: row.transaction_date || null,
      signal_score: row.signal_score ? parseInt(row.signal_score, 10) : null,
      created_at: row.created_at || null,
      ticker: row.ticker || null,
      company_name: row.company_name || null,
      accession_number: row.accession_number || null,
      filing_date: row.filing_date || null,
      sec_url: row.accession_number && row.insider_cik ? `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${row.insider_cik}&accession_number=${row.accession_number}&xbrl_type=v` : null,
    }));

    // Mettre en cache (TTL 5 minutes pour hot signals)
    await this.putInCache(cacheKey, signals, 300);

    return signals;
  }

  /**
   * Cache DynamoDB helpers
   */
  private async getFromCache(key: string): Promise<any | null> {
    try {
      const result = await dynamoClient.send(
        new GetCommand({
          TableName: INSIDERS_CACHE_TABLE,
          Key: { cache_key: key },
        })
      );

      if (!result.Item) {
        return null;
      }

      // Vérifier TTL
      const ttl = result.Item.ttl;
      if (ttl && ttl < Math.floor(Date.now() / 1000)) {
        return null; // Expiré
      }

      return result.Item.data;
    } catch (error: any) {
      console.warn(`[InsidersService] Cache read error: ${error.message}`);
      return null;
    }
  }

  private async putInCache(key: string, data: any, ttlSeconds: number): Promise<void> {
    try {
      const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;
      
      await dynamoClient.send(
        new PutCommand({
          TableName: INSIDERS_CACHE_TABLE,
          Item: {
            cache_key: key,
            data: data,
            ttl: ttl,
            created_at: new Date().toISOString(),
          },
        })
      );
    } catch (error: any) {
      console.warn(`[InsidersService] Cache write error: ${error.message}`);
      // Ne pas faire échouer la requête si le cache échoue
    }
  }
}
