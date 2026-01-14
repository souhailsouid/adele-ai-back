/**
 * Service helper Athena pour requêtes génériques
 * 
 * Architecture Extreme Budget: Utilise S3 + Athena au lieu de PostgreSQL
 */

import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from '@aws-sdk/client-athena';

const athenaClient = new AthenaClient({
  region: process.env.AWS_REGION || 'eu-west-3',
});

const ATHENA_DATABASE = process.env.ATHENA_DATABASE || 'adel_ai_dev';
const ATHENA_WORK_GROUP = process.env.ATHENA_WORK_GROUP || 'adel-ai-dev-workgroup';
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET || 'adel-ai-dev-athena-results';

export interface AthenaQueryOptions {
  timeout?: number; // Timeout en secondes (défaut: 300)
  maxAttempts?: number; // Nombre max de tentatives (défaut: 60)
}

/**
 * Exécuter une requête Athena et attendre le résultat
 */
export async function executeAthenaQuery(
  query: string,
  options: AthenaQueryOptions = {}
): Promise<any[]> {
  const { timeout = 300, maxAttempts = 60 } = options;

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
  const pollInterval = 5000; // 5 secondes

  while (status === 'RUNNING' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

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
    const columnInfo = resultsResponse.ResultSet?.ResultSetMetadata?.ColumnInfo || [];

    // Ignorer la première ligne (headers)
    const dataRows = rows.slice(1);

    for (const row of dataRows) {
      const data = row.Data || [];
      const rowData: any = {};
      
      columnInfo.forEach((col, index) => {
        const cell = data[index];
        let value: any = null;
        
        if (cell?.VarCharValue) {
          value = cell.VarCharValue;
        } else if (cell?.BigIntValue !== undefined) {
          value = parseInt(cell.BigIntValue);
        } else if (cell?.DoubleValue !== undefined) {
          value = parseFloat(cell.DoubleValue);
        } else if (cell?.BooleanValue !== undefined) {
          value = cell.BooleanValue;
        }
        
        rowData[col.Name || `col${index}`] = value;
      });
      
      results.push(rowData);
    }

    nextToken = resultsResponse.NextToken;
  } while (nextToken);

  return results;
}

/**
 * Exécuter une requête Athena et retourner le premier résultat (ou null)
 */
export async function executeAthenaQuerySingle(
  query: string,
  options: AthenaQueryOptions = {}
): Promise<any | null> {
  const results = await executeAthenaQuery(query, options);
  return results.length > 0 ? results[0] : null;
}

/**
 * Exécuter une requête COUNT et retourner le nombre
 */
export async function executeAthenaCount(
  query: string,
  options: AthenaQueryOptions = {}
): Promise<number> {
  // S'assurer que la requête est un COUNT
  if (!query.trim().toUpperCase().startsWith('SELECT COUNT')) {
    throw new Error('Query must be a COUNT query');
  }

  const result = await executeAthenaQuerySingle(query, options);
  const countKey = Object.keys(result || {})[0] || 'count';
  return parseInt(result?.[countKey] || '0', 10);
}
