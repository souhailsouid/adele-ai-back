/**
 * Service Athena pour requêtes de corrélation entre investisseurs
 * 
 * Architecture Extreme Budget: Utilise S3 + Athena au lieu de PostgreSQL
 * 
 * Exemple d'utilisation:
 *   const correlation = await getInvestorCorrelation('Scion Asset Management', 'ARK Investment Management');
 */

import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from '@aws-sdk/client-athena';

const athenaClient = new AthenaClient({
  region: process.env.AWS_REGION || 'eu-west-3',
});

const ATHENA_DATABASE = process.env.ATHENA_DATABASE || 'personamy_prod';
const ATHENA_WORK_GROUP = process.env.ATHENA_WORK_GROUP || 'primary';
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET || 'personamy-prod-athena-results';

export interface InvestorCorrelation {
  ticker: string;
  fund1_shares: number;
  fund1_value: number;
  fund2_shares: number;
  fund2_value: number;
  correlation_score: number; // 0-1 (1 = parfait overlap)
  total_overlap_value: number;
}

export interface CorrelationSummary {
  fund1_name: string;
  fund2_name: string;
  total_overlap_tickers: number;
  total_overlap_value: number;
  correlation_score: number;
  common_holdings: InvestorCorrelation[];
}

/**
 * Exécuter une requête Athena et attendre le résultat
 */
async function executeAthenaQuery(query: string): Promise<any[]> {
  // Démarrer l'exécution
  const startCommand = new StartQueryExecutionCommand({
    QueryString: query,
    QueryExecutionContext: {
      Database: ATHENA_DATABASE,
    },
    WorkGroup: ATHENA_WORK_GROUP,
    ResultConfiguration: {
      OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/queries/`,
    },
  });

  const startResponse = await athenaClient.send(startCommand);
  const queryExecutionId = startResponse.QueryExecutionId;

  if (!queryExecutionId) {
    throw new Error('Failed to start Athena query');
  }

  // Attendre la fin de l'exécution
  let status = 'RUNNING';
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max (5s * 60)

  while (status === 'RUNNING' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Attendre 5 secondes

    const statusCommand = new GetQueryExecutionCommand({
      QueryExecutionId: queryExecutionId,
    });

    const statusResponse = await athenaClient.send(statusCommand);
    status = statusResponse.QueryExecution?.Status?.State || 'FAILED';

    if (status === 'FAILED') {
      const reason = statusResponse.QueryExecution?.Status?.StateChangeReason || 'Unknown error';
      throw new Error(`Athena query failed: ${reason}`);
    }

    attempts++;
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Athena query did not complete: ${status}`);
  }

  // Récupérer les résultats
  const results: any[] = [];
  let nextToken: string | undefined;

  do {
    const resultsCommand = new GetQueryResultsCommand({
      QueryExecutionId: queryExecutionId,
      NextToken: nextToken,
      MaxResults: 1000,
    });

    const resultsResponse = await athenaClient.send(resultsCommand);
    const rows = resultsResponse.ResultSet?.Rows || [];

    // Ignorer la première row (headers)
    const dataRows = rows.slice(1);

    for (const row of dataRows) {
      const data = row.Data || [];
      const rowData: any = {};
      
      // Convertir en objet (assume que les colonnes sont dans l'ordre)
      // Note: Pour une implémentation robuste, il faudrait mapper les colonnes depuis ResultSet.ResultSetMetadata
      if (data.length > 0) {
        results.push(data.map((cell: any) => cell.VarCharValue || cell.BigIntValue || cell.DoubleValue || null));
      }
    }

    nextToken = resultsResponse.NextToken;
  } while (nextToken);

  return results;
}

/**
 * Obtenir la corrélation entre deux investisseurs (fonds)
 * 
 * Compare les holdings de deux fonds et calcule:
 * - Le nombre de tickers en commun
 * - La valeur totale de l'overlap
 * - Un score de corrélation (0-1)
 */
export async function getInvestorCorrelation(
  fund1Name: string,
  fund2Name: string,
  period?: string // Ex: '2024-Q4'
): Promise<CorrelationSummary> {
  // Requête SQL pour Athena
  // Note: Cette requête suppose que les tables Athena sont créées avec les schémas appropriés
  const query = `
    WITH fund1_holdings AS (
      SELECT 
        h.ticker,
        h.shares AS fund1_shares,
        h.market_value AS fund1_value,
        f.filing_date,
        f.fund_id AS fund1_id
      FROM fund_holdings h
      INNER JOIN fund_filings f ON h.filing_id = f.id
      INNER JOIN funds fund1 ON f.fund_id = fund1.id
      WHERE fund1.name = '${fund1Name.replace(/'/g, "''")}'
        ${period ? `AND f.period_of_report = '${period}'` : ''}
        AND h.type = 'stock'
        AND h.ticker IS NOT NULL
    ),
    fund2_holdings AS (
      SELECT 
        h.ticker,
        h.shares AS fund2_shares,
        h.market_value AS fund2_value,
        f.filing_date,
        f.fund_id AS fund2_id
      FROM fund_holdings h
      INNER JOIN fund_filings f ON h.filing_id = f.id
      INNER JOIN funds fund2 ON f.fund_id = fund2.id
      WHERE fund2.name = '${fund2Name.replace(/'/g, "''")}'
        ${period ? `AND f.period_of_report = '${period}'` : ''}
        AND h.type = 'stock'
        AND h.ticker IS NOT NULL
    ),
    overlap AS (
      SELECT 
        f1.ticker,
        f1.fund1_shares,
        f1.fund1_value,
        f2.fund2_shares,
        f2.fund2_value,
        LEAST(f1.fund1_value, f2.fund2_value) AS overlap_value,
        CASE 
          WHEN f1.fund1_value > 0 AND f2.fund2_value > 0 
          THEN LEAST(f1.fund1_value, f2.fund2_value) / GREATEST(f1.fund1_value, f2.fund2_value)
          ELSE 0
        END AS correlation_score
      FROM fund1_holdings f1
      INNER JOIN fund2_holdings f2 ON f1.ticker = f2.ticker
    )
    SELECT 
      ticker,
      SUM(fund1_shares) AS fund1_shares,
      SUM(fund1_value) AS fund1_value,
      SUM(fund2_shares) AS fund2_shares,
      SUM(fund2_value) AS fund2_value,
      AVG(correlation_score) AS correlation_score,
      SUM(overlap_value) AS total_overlap_value
    FROM overlap
    GROUP BY ticker
    ORDER BY total_overlap_value DESC
    LIMIT 50
  `;

  const results = await executeAthenaQuery(query);

  // Parser les résultats
  const commonHoldings: InvestorCorrelation[] = results.map((row: any[]) => ({
    ticker: row[0] || '',
    fund1_shares: parseInt(row[1] || '0'),
    fund1_value: parseFloat(row[2] || '0'),
    fund2_shares: parseInt(row[3] || '0'),
    fund2_value: parseFloat(row[4] || '0'),
    correlation_score: parseFloat(row[5] || '0'),
    total_overlap_value: parseFloat(row[6] || '0'),
  }));

  const totalOverlapValue = commonHoldings.reduce((sum, h) => sum + h.total_overlap_value, 0);
  const avgCorrelationScore = commonHoldings.length > 0
    ? commonHoldings.reduce((sum, h) => sum + h.correlation_score, 0) / commonHoldings.length
    : 0;

  return {
    fund1_name: fund1Name,
    fund2_name: fund2Name,
    total_overlap_tickers: commonHoldings.length,
    total_overlap_value: totalOverlapValue,
    correlation_score: avgCorrelationScore,
    common_holdings: commonHoldings,
  };
}

/**
 * Obtenir les top tickers en commun entre plusieurs investisseurs
 */
export async function getTopCommonHoldings(
  fundNames: string[],
  limit: number = 20
): Promise<Array<{ ticker: string; fund_count: number; total_value: number }>> {
  const fundNamesList = fundNames.map(name => `'${name.replace(/'/g, "''")}'`).join(', ');

  const query = `
    WITH fund_holdings_agg AS (
      SELECT 
        h.ticker,
        f.fund_id,
        SUM(h.market_value) AS total_value
      FROM fund_holdings h
      INNER JOIN fund_filings f ON h.filing_id = f.id
      INNER JOIN funds fund ON f.fund_id = fund.id
      WHERE fund.name IN (${fundNamesList})
        AND h.type = 'stock'
        AND h.ticker IS NOT NULL
      GROUP BY h.ticker, f.fund_id
    ),
    ticker_fund_count AS (
      SELECT 
        ticker,
        COUNT(DISTINCT fund_id) AS fund_count,
        SUM(total_value) AS total_value
      FROM fund_holdings_agg
      GROUP BY ticker
      HAVING COUNT(DISTINCT fund_id) = ${fundNames.length}  -- Tous les fonds doivent avoir ce ticker
    )
    SELECT 
      ticker,
      fund_count,
      total_value
    FROM ticker_fund_count
    ORDER BY total_value DESC
    LIMIT ${limit}
  `;

  const results = await executeAthenaQuery(query);

  return results.map((row: any[]) => ({
    ticker: row[0] || '',
    fund_count: parseInt(row[1] || '0'),
    total_value: parseFloat(row[2] || '0'),
  }));
}
