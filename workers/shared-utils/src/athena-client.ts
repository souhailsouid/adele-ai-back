/**
 * Athena Client avec throttling et batch helpers
 * 
 * ⚠️ COST SAFETY: Architecture volontairement séquentielle et lente
 * 
 * WHY:
 * - Athena facture par requête + données scannées
 * - Le throttling (500ms) évite les TooManyRequestsException qui coûtent cher en retries
 * - Le chunking (200 valeurs max) évite les query strings trop longues qui peuvent planter
 * - Pas de parallélisme = contrôle total des coûts (pas de "burst" surprise)
 * 
 * Trade-off accepté: Latence plus élevée en échange d'une facture prévisible
 */

import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from '@aws-sdk/client-athena';

/**
 * Type pour une ligne de résultat Athena
 * 
 * WHY: Typage explicite évite les bugs silencieux (au lieu de any[])
 */
export type AthenaRow = (string | null)[];

// ⚠️ COST SAFETY: Throttling strict pour éviter TooManyRequestsException
// WHY: Athena limite à ~20 requêtes/seconde par compte. En restant à 2 req/s, on évite
// les erreurs 429 qui nécessitent des retries coûteux.
const ATHENA_QUERY_DELAY_MS = 500; // 500ms = 2 requêtes/seconde max

// ⚠️ COST SAFETY: Chunking pour éviter query strings trop longues
// WHY: Les requêtes SQL avec IN (...) de 1000+ valeurs peuvent:
// - Dépasser les limites de taille de requête AWS
// - Être lentes à parser côté Athena
// - Coûter plus cher (plus de données scannées)
const MAX_IN_CLAUSE_SIZE = 200; // 200 valeurs max par IN clause

// ⚠️ COST SAFETY: Timeout explicite pour éviter les requêtes qui tournent indéfiniment
// WHY: Une requête qui timeout coûte quand même (données scannées avant timeout)
const POLL_INTERVAL_MS = 2000; // Poll toutes les 2 secondes
const MAX_POLL_ATTEMPTS = 60; // 60 * 2s = 120 secondes (2 minutes max)

// Rate limiter global (in-memory, par processus Lambda)
// WHY: Simple et efficace pour un Lambda avec concurrency=1
// Limitation: Si plusieurs Lambdas tournent, chaque processus a son propre compteur
// → Acceptable car concurrency limitée à 1 pour cost safety
let lastQueryTime = 0;

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper interne: Chunk un array en paquets de taille fixe
 * 
 * WHY: Utilisé pour diviser les grandes listes d'accessionNumbers en chunks
 * qui rentrent dans les IN clauses SQL sans dépasser MAX_IN_CLAUSE_SIZE
 */
function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Rate limiter pour Athena
 * 
 * WHY: Force un délai minimum entre chaque StartQueryExecution pour éviter
 * les erreurs 429 (TooManyRequestsException) qui nécessitent des retries coûteux
 */
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastQuery = now - lastQueryTime;
  
  if (timeSinceLastQuery < ATHENA_QUERY_DELAY_MS) {
    const waitTime = ATHENA_QUERY_DELAY_MS - timeSinceLastQuery;
    await sleep(waitTime);
  }
  
  lastQueryTime = Date.now();
}

/**
 * Exécuter une requête Athena avec polling
 * 
 * ⚠️ COST SAFETY: Throttling strict (1 requête à la fois, 500ms entre requêtes)
 * 
 * WHY: Séquentiel = contrôle total des coûts. Pas de parallélisme = pas de "burst" surprise
 */
export async function executeAthenaQuery(
  query: string,
  athenaClient: AthenaClient,
  database: string,
  workGroup: string,
  resultsBucket: string
): Promise<AthenaRow[]> {
  // Throttling: attendre avant de lancer une nouvelle requête
  await rateLimit();
  
  const startCommand = new StartQueryExecutionCommand({
    QueryString: query,
    QueryExecutionContext: {
      Database: database,
    },
    WorkGroup: workGroup,
    ResultConfiguration: {
      OutputLocation: `s3://${resultsBucket}/queries/`,
    },
  });
  
  const startResponse = await athenaClient.send(startCommand);
  const queryExecutionId = startResponse.QueryExecutionId;
  
  if (!queryExecutionId) {
    throw new Error('Failed to start Athena query: QueryExecutionId is missing');
  }
  
  // Attendre la fin de l'exécution (polling)
  // WHY: Athena est asynchrone. On doit poller pour savoir quand la requête est terminée
  let status = 'RUNNING';
  let attempts = 0;
  
  while (status === 'RUNNING' && attempts < MAX_POLL_ATTEMPTS) {
    await sleep(POLL_INTERVAL_MS);
    
    const statusCommand = new GetQueryExecutionCommand({
      QueryExecutionId: queryExecutionId,
    });
    
    const statusResponse = await athenaClient.send(statusCommand);
    status = statusResponse.QueryExecution?.Status?.State || 'FAILED';
    
    if (status === 'FAILED' || status === 'CANCELLED') {
      const reason = statusResponse.QueryExecution?.Status?.StateChangeReason || 'Unknown error';
      throw new Error(
        `Athena query failed (QueryExecutionId: ${queryExecutionId}): ${reason}`
      );
    }
    
    attempts++;
  }
  
  if (status !== 'SUCCEEDED') {
    throw new Error(
      `Athena query timeout after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s ` +
      `(QueryExecutionId: ${queryExecutionId}, final status: ${status})`
    );
  }
  
  // Récupérer les résultats (pagination)
  // WHY: Athena peut retourner jusqu'à 1000 lignes par page. On doit paginer pour tout récupérer
  const results: AthenaRow[] = [];
  let nextToken: string | undefined;
  let isFirstPage = true;
  
  do {
    const resultsCommand = new GetQueryResultsCommand({
      QueryExecutionId: queryExecutionId,
      NextToken: nextToken,
      MaxResults: 1000,
    });
    
    const resultsResponse = await athenaClient.send(resultsCommand);
    const rows = resultsResponse.ResultSet?.Rows || [];
    
    if (rows.length > 0) {
      // ⚠️ BUG FIX: Supprimer le header uniquement sur la première page
      // WHY: La première ligne contient les noms de colonnes. Les pages suivantes
      // n'ont que des données. Si on supprime la première ligne de chaque page,
      // on perd des données réelles.
      const dataRows = isFirstPage ? rows.slice(1) : rows;
      
      for (const row of dataRows) {
        const values = row.Data?.map((d: { VarCharValue?: string | null }) => d.VarCharValue || null) || [];
        results.push(values);
      }
      
      isFirstPage = false;
    }
    
    nextToken = resultsResponse.NextToken;
  } while (nextToken);
  
  return results;
}

/**
 * Batch helper: vérifier quels accessionNumbers existent déjà
 * 
 * ⚠️ COST SAFETY: Chunking automatique (200 valeurs max par requête)
 * 
 * WHY:
 * - Évite les query strings trop longues qui peuvent planter
 * - Réduit le coût par requête (moins de données scannées par requête)
 * - Requêtes séquentielles (pas de parallélisme) = coûts prévisibles
 * 
 * @param accessionNumbers - Liste des accessionNumbers à vérifier
 * @returns Set des accessionNumbers qui existent déjà
 */
export async function checkExistingAccessionNumbers(
  accessionNumbers: string[],
  athenaClient: AthenaClient,
  database: string,
  workGroup: string,
  resultsBucket: string
): Promise<Set<string>> {
  if (accessionNumbers.length === 0) {
    return new Set();
  }
  
  const existingSet = new Set<string>();
  
  // Chunking automatique pour éviter query strings trop longues
  // WHY: Les IN clauses avec 1000+ valeurs peuvent dépasser les limites AWS
  const chunks = chunkArray(accessionNumbers, MAX_IN_CLAUSE_SIZE);
  
  // Traiter chaque chunk séquentiellement (pas de parallélisme)
  // WHY: Cost safety = contrôle total. Pas de "burst" de requêtes simultanées
  let chunkIndex = 0;
  for (const chunk of chunks) {
    chunkIndex++;
    
    // Échapper les valeurs pour SQL (protection injection SQL)
    const escapedAccessions = chunk
      .map(acc => `'${acc.replace(/'/g, "''")}'`)
      .join(', ');
    
    // 1 requête batch par chunk
    const query = `
      SELECT DISTINCT accession_number
      FROM company_filings
      WHERE form_type = '4'
        AND accession_number IN (${escapedAccessions})
    `;
    
    try {
      const results = await executeAthenaQuery(
        query,
        athenaClient,
        database,
        workGroup,
        resultsBucket
      );
      
      for (const row of results) {
        if (row[0]) {
          existingSet.add(row[0]);
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to check existing accession numbers (chunk ${chunkIndex}/${chunks.length}): ${errorMessage}`
      );
    }
  }
  
  return existingSet;
}

/**
 * Batch helper: vérifier quels accessionNumbers sont déjà PARSED
 * 
 * ⚠️ COST SAFETY: Chunking automatique (200 valeurs max par requête)
 * 
 * WHY: Même logique que checkExistingAccessionNumbers - chunking pour éviter
 * les query strings trop longues et réduire les coûts par requête
 * 
 * @param accessionNumbers - Liste des accessionNumbers à vérifier
 * @returns Set des accessionNumbers qui sont déjà PARSED
 */
export async function checkParsedAccessionNumbers(
  accessionNumbers: string[],
  athenaClient: AthenaClient,
  database: string,
  workGroup: string,
  resultsBucket: string
): Promise<Set<string>> {
  if (accessionNumbers.length === 0) {
    return new Set();
  }
  
  const parsedSet = new Set<string>();
  
  // Chunking automatique pour éviter query strings trop longues
  // WHY: Les IN clauses avec 1000+ valeurs peuvent dépasser les limites AWS
  const chunks = chunkArray(accessionNumbers, MAX_IN_CLAUSE_SIZE);
  
  // Traiter chaque chunk séquentiellement (pas de parallélisme)
  // WHY: Cost safety = contrôle total. Pas de "burst" de requêtes simultanées
  let chunkIndex = 0;
  for (const chunk of chunks) {
    chunkIndex++;
    
    // Échapper les valeurs pour SQL (protection injection SQL)
    const escapedAccessions = chunk
      .map(acc => `'${acc.replace(/'/g, "''")}'`)
      .join(', ');
    
    // 1 requête batch par chunk
    const query = `
      SELECT DISTINCT accession_number
      FROM company_filings
      WHERE form_type = '4'
        AND status = 'PARSED'
        AND accession_number IN (${escapedAccessions})
    `;
    
    try {
      const results = await executeAthenaQuery(
        query,
        athenaClient,
        database,
        workGroup,
        resultsBucket
      );
      
      for (const row of results) {
        if (row[0]) {
          parsedSet.add(row[0]);
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to check parsed accession numbers (chunk ${chunkIndex}/${chunks.length}): ${errorMessage}`
      );
    }
  }
  
  return parsedSet;
}
