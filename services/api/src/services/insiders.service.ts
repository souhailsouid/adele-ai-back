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
  company_cik: string | null; // Utiliser company_cik au lieu de company_id
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

export interface Form4Filing {
  id: number;
  filing_id: number;
  company_cik: string | null;
  cik: string | null; // Alias pour compatibilité
  form_type: string | null;
  accession_number: string | null;
  filing_date: string | null;
  period_of_report: string | null;
  document_url: string | null;
  status: string;
  created_at: string | null;
  ticker: string | null;
  company_name: string | null;
  transaction_count: number;
}

export interface TrendingInsider {
  ticker: string;
  company_name: string;
  total_buy_value: number; // Somme des achats (Purchase uniquement)
  total_sell_value: number;
  net_value: number;
  transaction_count: number; // Nombre de transactions Purchase
  last_transaction_date: string;
  // Nouveaux champs pour distinguer les types d'insiders
  ceo_cfo_director_count: number; // Nombre de transactions par CEO/CFO/Director
  ten_percent_owner_count: number; // Nombre de transactions par 10% Owner (fonds)
  top_insider: string | null; // Nom du plus gros acheteur
  top_insider_title: string | null; // Titre du plus gros acheteur
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
   * Top entreprises avec le plus d'achats d'insiders (pondéré par volume financier)
   * 
   * Filtre crucial: Uniquement les transactions "purchase" (Code P - Achat sur marché ouvert)
   * Exclut: "gift" (G) et "grant" (A - Attribution gratuite d'options)
   * 
   * La logique: Somme des transaction_value groupée par ticker sur les N derniers jours
   * Trier par volume financier décroissant (pas par nombre de transactions)
   */
  async getTrendingInsiders(days: number = 7, limit: number = 20): Promise<TrendingInsider[]> {
    const cacheKey = `trending_${days}d_${limit}`;
    
    // Vérifier le cache DynamoDB
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached as TrendingInsider[];
    }

    // Requête principale: Somme des achats Purchase uniquement, groupée par ticker
    // Filtre: transaction_type = 'purchase' (Purchase uniquement, exclut 'gift' Gift et 'grant' Attribution)
    // Exclut les fonds (Fund, Trust, LLC dans le nom) - seules les entreprises publiques sont pertinentes
    // Note: Les transaction_type sont stockés en lowercase ('purchase', 'sale', 'gift', 'grant', etc.)
    const query = `
      WITH purchase_transactions AS (
        SELECT 
          c.ticker,
          c.name as company_name,
          it.insider_name,
          it.insider_title,
          it.relation,
          it.total_value,
          it.transaction_date
        FROM insider_trades it
        LEFT JOIN companies c ON it.company_cik = c.cik
        WHERE it.transaction_date >= date_add('day', -${days}, CURRENT_DATE)
          AND LOWER(TRIM(it.transaction_type)) = 'purchase'  -- Purchase uniquement (exclut 'gift' Gift et 'grant' Attribution)
          AND it.total_value IS NOT NULL
          AND it.total_value > 0
          AND c.ticker IS NOT NULL
      ),
      aggregated AS (
        SELECT 
          ticker,
          MAX(company_name) as company_name,
          SUM(total_value) as total_buy_value,
          COUNT(*) as transaction_count,
          MAX(transaction_date) as last_transaction_date,
          -- Compter les transactions par type d'insider
          -- Note: relation et insider_title peuvent être NULL ou 'Unknown', vérifier les deux
          SUM(CASE 
            WHEN (relation IS NOT NULL AND relation != 'Unknown' AND (
              LOWER(relation) LIKE '%ceo%' 
              OR LOWER(relation) LIKE '%chief executive%'
              OR LOWER(relation) LIKE '%cfo%'
              OR LOWER(relation) LIKE '%chief financial%'
              OR LOWER(relation) LIKE '%director%'
              OR LOWER(relation) LIKE '%president%'
              OR LOWER(relation) LIKE '%chairman%'
              OR LOWER(relation) LIKE '%coo%'
              OR LOWER(relation) LIKE '%chief operating%'
            ))
            OR (insider_title IS NOT NULL AND insider_title != 'Unknown' AND (
              LOWER(insider_title) LIKE '%ceo%'
              OR LOWER(insider_title) LIKE '%chief executive%'
              OR LOWER(insider_title) LIKE '%cfo%'
              OR LOWER(insider_title) LIKE '%chief financial%'
              OR LOWER(insider_title) LIKE '%director%'
              OR LOWER(insider_title) LIKE '%president%'
              OR LOWER(insider_title) LIKE '%chairman%'
              OR LOWER(insider_title) LIKE '%coo%'
              OR LOWER(insider_title) LIKE '%chief operating%'
            ))
            THEN 1 ELSE 0 END) as ceo_cfo_director_count,
          SUM(CASE 
            WHEN (relation IS NOT NULL AND relation != 'Unknown' AND (
              LOWER(relation) LIKE '%10% owner%'
              OR LOWER(relation) LIKE '%greater than 10%'
              OR LOWER(relation) LIKE '%10 percent%'
              OR LOWER(relation) LIKE '%more than 10%'
            ))
            OR (insider_title IS NOT NULL AND insider_title != 'Unknown' AND (
              LOWER(insider_title) LIKE '%10% owner%'
              OR LOWER(insider_title) LIKE '%greater than 10%'
              OR LOWER(insider_title) LIKE '%10 percent%'
              OR LOWER(insider_title) LIKE '%more than 10%'
            ))
            THEN 1 ELSE 0 END) as ten_percent_owner_count
        FROM purchase_transactions
        GROUP BY ticker
        HAVING SUM(total_value) > 0
      ),
      top_insiders AS (
        SELECT 
          a.ticker,
          a.company_name,
          a.total_buy_value,
          a.transaction_count,
          a.last_transaction_date,
          a.ceo_cfo_director_count,
          a.ten_percent_owner_count,
          pt.insider_name as top_insider,
          pt.insider_title as top_insider_title,
          ROW_NUMBER() OVER (PARTITION BY a.ticker ORDER BY pt.total_value DESC) as rn
        FROM aggregated a
        LEFT JOIN purchase_transactions pt ON a.ticker = pt.ticker
      )
      SELECT 
        ticker,
        company_name,
        ROUND(total_buy_value, 2) as total_buy_value,  -- Arrondir à 2 décimales pour éviter les erreurs de précision
        0.0 as total_sell_value,  -- Pas de ventes dans cette vue (Purchase uniquement)
        ROUND(total_buy_value, 2) as net_value,  -- Arrondir à 2 décimales
        transaction_count,
        last_transaction_date,
        ceo_cfo_director_count,
        ten_percent_owner_count,
        MAX(CASE WHEN rn = 1 THEN top_insider END) as top_insider,
        MAX(CASE WHEN rn = 1 THEN top_insider_title END) as top_insider_title
      FROM top_insiders
      GROUP BY ticker, company_name, total_buy_value, transaction_count, last_transaction_date, ceo_cfo_director_count, ten_percent_owner_count
      ORDER BY total_buy_value DESC  -- Trier par volume financier (pas par nombre de transactions)
      LIMIT ${limit}
    `;

    const results = await executeAthenaQuery(query);
    
    const trending: TrendingInsider[] = results.map((row: any) => ({
      ticker: row.ticker || '',
      company_name: row.company_name || '',
      total_buy_value: Math.round(parseFloat(row.total_buy_value || '0') * 100) / 100, // Arrondir à 2 décimales
      total_sell_value: Math.round(parseFloat(row.total_sell_value || '0') * 100) / 100, // Arrondir à 2 décimales
      net_value: Math.round(parseFloat(row.net_value || '0') * 100) / 100, // Arrondir à 2 décimales
      transaction_count: parseInt(row.transaction_count || '0', 10),
      last_transaction_date: row.last_transaction_date || '',
      ceo_cfo_director_count: parseInt(row.ceo_cfo_director_count || '0', 10),
      ten_percent_owner_count: parseInt(row.ten_percent_owner_count || '0', 10),
      top_insider: row.top_insider || null,
      top_insider_title: row.top_insider_title && row.top_insider_title !== 'Unknown' ? row.top_insider_title : null, // Ne pas retourner 'Unknown'
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
          it.company_cik,
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
        LEFT JOIN companies c ON it.company_cik = c.cik
        WHERE UPPER(TRIM(c.ticker)) = UPPER(TRIM('${ticker.replace(/'/g, "''")}'))
      ) WHERE rn > ${offset} AND rn <= ${offset + limit}
    ` : `
      SELECT 
        it.id,
        it.company_cik,
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
      LEFT JOIN companies c ON it.company_cik = c.cik
      WHERE UPPER(TRIM(c.ticker)) = UPPER(TRIM('${ticker.replace(/'/g, "''")}'))
      ORDER BY it.transaction_date DESC, it.created_at DESC
      LIMIT ${limit}
    `;

    const results = await executeAthenaQuery(query);
    
    const transactions: InsiderTransaction[] = results.map((row: any) => ({
      id: parseInt(row.id || '0', 10),
      company_cik: row.company_cik || null,
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
        COUNT(DISTINCT it.company_cik) as total_companies,
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
      LEFT JOIN companies c ON it.company_cik = c.cik
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
      WITH ranked_signals AS (
        SELECT 
          ts.id,
          ts.company_cik,
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
          -- Utiliser accession_number directement depuis top_insider_signals si disponible, sinon depuis company_filings
          COALESCE(ts.accession_number, cf.accession_number) as accession_number,
          CAST(cf.filing_date AS VARCHAR) as filing_date,
          -- Déduplication: garder seulement le premier signal pour chaque combinaison unique
          ROW_NUMBER() OVER (
            PARTITION BY ts.insider_cik, c.ticker, ts.transaction_date, ts.total_value, ts.signal_score
            ORDER BY ts.created_at DESC
          ) as row_num
        FROM top_insider_signals ts
        LEFT JOIN companies c ON ts.company_cik = c.cik
        LEFT JOIN company_filings cf ON ts.filing_id = cf.id
        WHERE ts.signal_score >= ${minScore}
          -- Exclure les dates suspectes (avant 2000 ou après aujourd'hui)
          AND CAST(ts.transaction_date AS DATE) >= DATE '2000-01-01'
          AND CAST(ts.transaction_date AS DATE) <= CURRENT_DATE
          -- Exclure les signals sans accession_number
          AND COALESCE(ts.accession_number, cf.accession_number) IS NOT NULL
      )
      SELECT * FROM ranked_signals
      WHERE row_num = 1
      ORDER BY signal_score DESC, transaction_date DESC, created_at DESC
      LIMIT ${limit}
    `;

    const results = await executeAthenaQuery(query);
    
    const signals = results.map((row: any) => ({
      id: parseInt(row.id || '0', 10),
      company_cik: row.company_cik || null,
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
   * ============================================
   * HELPERS POUR FORM 4 FILINGS (Réutilisables)
   * ============================================
   */

  /**
   * Construit la partie SELECT commune pour les requêtes Form 4
   * Note: On ne sélectionne PAS company_id car on ne l'utilise pas dans les réponses
   */
  private buildForm4FilingBaseSelect(): string {
    return `
      cf.id,
      cf.cik,
      cf.form_type,
      cf.accession_number,
      CAST(cf.filing_date AS VARCHAR) as filing_date,
      CAST(cf.period_of_report AS VARCHAR) as period_of_report,
      cf.document_url,
      cf.status,
      CAST(cf.created_at AS VARCHAR) as created_at,
      c.ticker,
      c.name as company_name,
      COUNT(it.id) as transaction_count
    `;
  }

  /**
   * Construit la clause GROUP BY commune pour les requêtes Form 4
   * Note: On garde company_id dans GROUP BY car il est nécessaire pour le JOIN, mais on ne le sélectionne pas
   */
  private buildForm4FilingGroupBy(): string {
    return `
      cf.id, cf.company_id, cf.cik, cf.form_type, cf.accession_number, 
      cf.filing_date, cf.period_of_report, cf.document_url, cf.status, 
      cf.created_at, c.ticker, c.name
    `;
  }

  /**
   * Mappe une ligne de résultat Athena vers un objet Form4Filing
   * Fonction réutilisable pour éviter la duplication
   */
  private mapForm4FilingRow(row: any): Form4Filing {
    const transactionCount = parseInt(row.transaction_count || '0', 10);
    const computedStatus = transactionCount > 0 ? 'PARSED' : (row.status || 'DISCOVERED');
    const filingId = parseInt(row.id || '0', 10);
    const companyCik = row.cik || null;

    return {
      id: filingId,
      filing_id: filingId,
      company_cik: companyCik,
      cik: companyCik, // Alias pour compatibilité
      form_type: row.form_type || null,
      accession_number: row.accession_number || null,
      filing_date: row.filing_date || null,
      period_of_report: row.period_of_report || null,
      document_url: row.document_url || null,
      status: computedStatus,
      created_at: row.created_at || null,
      ticker: row.ticker || null,
      company_name: row.company_name || null,
      transaction_count: transactionCount,
    };
  }

  /**
   * Construit une requête Form 4 avec pagination (offset)
   */
  private buildForm4FilingQueryWithPagination(
    whereClause: string,
    orderBy: string = 'ORDER BY cf.filing_date DESC, cf.created_at DESC',
    limit: number,
    offset: number,
    havingClause: string = ''
  ): string {
    const baseSelect = this.buildForm4FilingBaseSelect();
    const groupBy = this.buildForm4FilingGroupBy();

    return `
      SELECT * FROM (
        SELECT 
          ${baseSelect},
          ROW_NUMBER() OVER (${orderBy}) as rn
        FROM company_filings cf
        LEFT JOIN companies c ON cf.company_id = c.id
        LEFT JOIN insider_trades it ON cf.id = it.filing_id
        WHERE cf.form_type = '4'
          ${whereClause}
        GROUP BY ${groupBy}
        ${havingClause}
      ) WHERE rn > ${offset} AND rn <= ${offset + limit}
    `;
  }

  /**
   * Construit une requête Form 4 simple (sans pagination offset)
   */
  private buildForm4FilingQuerySimple(
    whereClause: string,
    orderBy: string = 'ORDER BY cf.filing_date DESC, cf.created_at DESC',
    limit: number,
    havingClause: string = ''
  ): string {
    const baseSelect = this.buildForm4FilingBaseSelect();
    const groupBy = this.buildForm4FilingGroupBy();

    return `
      SELECT 
        ${baseSelect}
      FROM company_filings cf
      LEFT JOIN companies c ON cf.company_id = c.id
      LEFT JOIN insider_trades it ON cf.id = it.filing_id
      WHERE cf.form_type = '4'
        ${whereClause}
      GROUP BY ${groupBy}
      ${havingClause}
      ${orderBy}
      LIMIT ${limit}
    `;
  }

  /**
   * ============================================
   * ENDPOINTS FORM 4 FILINGS
   * ============================================
   */

  /**
   * GET /insiders/filings
   * Liste des Form 4 filings avec pagination
   */
  async getForm4Filings(limit: number = 50, offset: number = 0, days?: number, hasTransactions: boolean = true): Promise<{ data: Form4Filing[]; total_count: number }> {
    const cacheKey = `form4_filings_${limit}_${offset}_${days || 'all'}_${hasTransactions}`;
    
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached as { data: Form4Filing[]; total_count: number };
    }

    const dateFilter = days ? `AND cf.filing_date >= DATE_ADD('day', -${days}, CURRENT_DATE)` : '';
    const transactionFilter = hasTransactions ? `HAVING COUNT(it.id) > 0` : '';

    // Requête pour compter le total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM (
        SELECT cf.id
        FROM company_filings cf
        LEFT JOIN companies c ON cf.company_id = c.id
        LEFT JOIN insider_trades it ON cf.id = it.filing_id
        WHERE cf.form_type = '4'
          ${dateFilter}
        GROUP BY cf.id
        ${transactionFilter}
      )
    `;

    const whereClause = dateFilter;
    const query = offset > 0
      ? this.buildForm4FilingQueryWithPagination(whereClause, 'ORDER BY cf.filing_date DESC, cf.created_at DESC', limit, offset, transactionFilter)
      : this.buildForm4FilingQuerySimple(whereClause, 'ORDER BY cf.filing_date DESC, cf.created_at DESC', limit, transactionFilter);

    const [results, countResults] = await Promise.all([
      executeAthenaQuery(query),
      executeAthenaQuery(countQuery)
    ]);
    
    const totalCount = parseInt(countResults[0]?.total || '0', 10);
    const filings = results.map((row: any) => this.mapForm4FilingRow(row));

    const response = { data: filings, total_count: totalCount };
    await this.putInCache(cacheKey, response, 300);

    return response;
  }

  /**
   * GET /insiders/filings/{filingId}
   * Détails d'un Form 4 filing
   */
  async getForm4Filing(filingId: number): Promise<Form4Filing | null> {
    const cacheKey = `form4_filing_${filingId}`;
    
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached as Form4Filing;
    }

    const baseSelect = this.buildForm4FilingBaseSelect();
    const groupBy = this.buildForm4FilingGroupBy();

    const query = `
      SELECT 
        ${baseSelect}
      FROM company_filings cf
      LEFT JOIN companies c ON cf.company_id = c.id
      LEFT JOIN insider_trades it ON cf.id = it.filing_id
      WHERE cf.id = ${filingId}
        AND cf.form_type = '4'
      GROUP BY ${groupBy}
    `;

    const results = await executeAthenaQuery(query);
    
    if (results.length === 0) {
      return null;
    }

    const filing = this.mapForm4FilingRow(results[0]);
    await this.putInCache(cacheKey, filing, 300);

    return filing;
  }

  /**
   * GET /insiders/company/{ticker}/filings
   * Form 4 filings pour une entreprise
   */
  async getCompanyForm4Filings(ticker: string, limit: number = 50, offset: number = 0, hasTransactions: boolean = true): Promise<{ data: Form4Filing[]; total_count: number }> {
    const cacheKey = `company_form4_${ticker}_${limit}_${offset}_${hasTransactions}`;
    
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached as { data: Form4Filing[]; total_count: number };
    }

    const tickerFilter = `AND UPPER(TRIM(c.ticker)) = UPPER(TRIM('${ticker.replace(/'/g, "''")}'))`;
    const transactionFilter = hasTransactions ? `HAVING COUNT(it.id) > 0` : '';

    // Requête pour compter le total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM (
        SELECT cf.id
        FROM company_filings cf
        LEFT JOIN companies c ON cf.company_id = c.id
        LEFT JOIN insider_trades it ON cf.id = it.filing_id
        WHERE cf.form_type = '4'
          ${tickerFilter}
        GROUP BY cf.id
        ${transactionFilter}
      )
    `;

    const whereClause = tickerFilter;
    const query = offset > 0
      ? this.buildForm4FilingQueryWithPagination(whereClause, 'ORDER BY cf.filing_date DESC, cf.created_at DESC', limit, offset, transactionFilter)
      : this.buildForm4FilingQuerySimple(whereClause, 'ORDER BY cf.filing_date DESC, cf.created_at DESC', limit, transactionFilter);

    const [results, countResults] = await Promise.all([
      executeAthenaQuery(query),
      executeAthenaQuery(countQuery)
    ]);
    
    const totalCount = parseInt(countResults[0]?.total || '0', 10);
    const filings = results.map((row: any) => this.mapForm4FilingRow(row));

    const response = { data: filings, total_count: totalCount };
    await this.putInCache(cacheKey, response, 300);

    return response;
  }

  /**
   * GET /insiders/person/{cik}/filings
   * Form 4 filings pour un insider
   */
  async getInsiderForm4Filings(
    insiderCik: string, 
    limit: number = 50, 
    offset: number = 0,
    hasTransactions: boolean = true
  ): Promise<{ data: Form4Filing[]; total_count: number }> {
    const cacheKey = `insider_form4_${insiderCik}_${limit}_${offset}_${hasTransactions}`;
    
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached as { data: Form4Filing[]; total_count: number };
    }

    const insiderFilter = `AND it.insider_cik = '${insiderCik.replace(/'/g, "''")}'`;
    const transactionFilter = hasTransactions ? `HAVING COUNT(it.id) > 0` : '';

    // Requête pour compter le total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM (
        SELECT cf.id
        FROM company_filings cf
        LEFT JOIN companies c ON cf.company_id = c.id
        LEFT JOIN insider_trades it ON cf.id = it.filing_id
        WHERE cf.form_type = '4'
          ${insiderFilter}
        GROUP BY cf.id
        ${transactionFilter}
      )
    `;

    const whereClause = insiderFilter;
    const query = offset > 0
      ? this.buildForm4FilingQueryWithPagination(whereClause, 'ORDER BY cf.filing_date DESC, cf.created_at DESC', limit, offset, transactionFilter).replace('SELECT', 'SELECT DISTINCT')
      : this.buildForm4FilingQuerySimple(whereClause, 'ORDER BY cf.filing_date DESC, cf.created_at DESC', limit, transactionFilter).replace('SELECT', 'SELECT DISTINCT');

    const [results, countResults] = await Promise.all([
      executeAthenaQuery(query),
      executeAthenaQuery(countQuery)
    ]);
    
    const totalCount = parseInt(countResults[0]?.total || '0', 10);
    const filings = results.map((row: any) => this.mapForm4FilingRow(row));

    const response = { data: filings, total_count: totalCount };
    await this.putInCache(cacheKey, response, 300);

    return response;
  }

  /**
   * GET /insiders/filings/{filingId}/transactions
   * Transactions d'un Form 4 filing
   */
  async getForm4FilingTransactions(filingId: number, limit: number = 100): Promise<InsiderTransaction[]> {
    const cacheKey = `form4_filing_transactions_${filingId}_${limit}`;
    
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached as InsiderTransaction[];
    }

    // Utiliser ROW_NUMBER() pour dédupliquer par (insider_cik, transaction_date, shares, total_value)
    const query = `
      WITH ranked_transactions AS (
        SELECT 
          it.id,
          it.company_cik,
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
          ROW_NUMBER() OVER (
            PARTITION BY it.insider_cik, it.transaction_date, it.shares, it.total_value, it.transaction_type
            ORDER BY it.created_at DESC
          ) as row_num
        FROM insider_trades it
        LEFT JOIN companies c ON it.company_cik = c.cik
        WHERE it.filing_id = ${filingId}
      )
      SELECT * FROM ranked_transactions
      WHERE row_num = 1
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT ${limit}
    `;

    const results = await executeAthenaQuery(query);
    
    const transactions: InsiderTransaction[] = results.map((row: any) => {
      // Normaliser et enrichir le type de transaction
      let transactionType = row.transaction_type || null;
      if (transactionType) {
        // Nettoyer "other ()" -> "other"
        transactionType = transactionType.replace(/\s*\(\)\s*$/, '').trim();
        
        // Enrichissement contextuel basé sur les patterns
        const typeLower = transactionType.toLowerCase();
        if (typeLower.includes('other')) {
          // Essayer d'enrichir "OTHER" avec des informations disponibles
          // Note: L'enrichissement complet se fait au parsing (form4-parser)
          // Ici on normalise juste le format
          transactionType = 'OTHER';
        } else {
          // Convertir en majuscules pour cohérence
          transactionType = transactionType.toUpperCase();
        }
      }
      
      // Arrondir les valeurs financières à 2 décimales
      const pricePerShare = row.price_per_share 
        ? Math.round(parseFloat(row.price_per_share) * 100) / 100 
        : null;
      const totalValue = row.total_value 
        ? Math.round(parseFloat(row.total_value) * 100) / 100 
        : null;
      
      return {
        id: parseInt(row.id || '0', 10),
        company_cik: row.company_cik || null, // Utiliser company_cik au lieu de company_id
        filing_id: row.filing_id ? parseInt(row.filing_id, 10) : null,
        insider_name: row.insider_name || null,
        insider_cik: row.insider_cik || null,
        insider_title: row.insider_title || null,
        relation: row.relation || null,
        transaction_type: transactionType,
        shares: row.shares ? parseInt(row.shares, 10) : null,
        price_per_share: pricePerShare,
        total_value: totalValue,
        transaction_date: row.transaction_date || null,
        alert_flag: row.alert_flag === true || row.alert_flag === 'true',
        created_at: row.created_at || null,
        ticker: row.ticker || null,
        company_name: row.company_name || null,
      };
    });

    await this.putInCache(cacheKey, transactions, 300);

    return transactions;
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
