/**
 * Lambda pour parser les Form 4 (Insider Transactions)
 * 
 * Consomme depuis SQS avec rate limiting strict (10 req/s max pour SEC)
 * 
 * Architecture:
 * - Worker principal découvre les Form 4 → publie dans SQS
 * - Ce worker consomme depuis SQS → parse avec rate limiting
 */

import { SQSEvent } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from "@aws-sdk/client-athena";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ParquetSchema, ParquetWriter } from 'parquetjs';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Helper pour exécuter des requêtes Athena
async function executeAthenaQuery(query: string): Promise<any[]> {
  const queryExecution = await athenaClient.send(new StartQueryExecutionCommand({
    QueryString: query,
    QueryExecutionContext: {
      Database: ATHENA_DATABASE,
    },
    ResultConfiguration: {
      OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/query-results/`,
    },
    WorkGroup: ATHENA_WORK_GROUP,
  }));

  const queryExecutionId = queryExecution.QueryExecutionId;
  if (!queryExecutionId) {
    throw new Error('Failed to start Athena query');
  }

  // Attendre que la requête soit terminée
  let status = 'RUNNING';
  while (status === 'RUNNING' || status === 'QUEUED') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const statusResult = await athenaClient.send(new GetQueryExecutionCommand({
      QueryExecutionId: queryExecutionId,
    }));
    status = statusResult.QueryExecution?.Status?.State || 'FAILED';
    
    if (status === 'FAILED' || status === 'CANCELLED') {
      throw new Error(`Athena query failed: ${statusResult.QueryExecution?.Status?.StateChangeReason || 'Unknown error'}`);
    }
  }

  // Récupérer les résultats
  const results: any[] = [];
  let nextToken: string | undefined;
  
  do {
    const resultResponse = await athenaClient.send(new GetQueryResultsCommand({
      QueryExecutionId: queryExecutionId,
      NextToken: nextToken,
    }));

    const rows = resultResponse.ResultSet?.Rows || [];
    const columnInfo = resultResponse.ResultSet?.ResultSetMetadata?.ColumnInfo || [];
    
    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowData: any = {};
      
      if (row.Data) {
        for (let j = 0; j < columnInfo.length; j++) {
          const column = columnInfo[j];
          const value = row.Data[j]?.VarCharValue;
          rowData[column.Name || `col${j}`] = value || null;
        }
      }
      
      results.push(rowData);
    }
    
    nextToken = resultResponse.NextToken;
  } while (nextToken);

  return results;
}

// Configuration
const ATHENA_DATABASE = process.env.ATHENA_DATABASE || "adel_ai_dev";
const ATHENA_WORK_GROUP = process.env.ATHENA_WORK_GROUP || "adel-ai-dev-workgroup";
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET || "adel-ai-dev-athena-results";
const S3_DATA_LAKE_BUCKET = process.env.S3_DATA_LAKE_BUCKET || "adel-ai-dev-data-lake";
const FORM4_PARSER_QUEUE_URL = process.env.FORM4_PARSER_QUEUE_URL || "";

// AWS_REGION est automatiquement défini par Lambda, pas besoin de le passer
const athenaClient = new AthenaClient();
const s3Client = new S3Client();
const sqsClient = new SQSClient();
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient());

const INSIDERS_CACHE_TABLE = process.env.INSIDERS_CACHE_TABLE || 'adel-ai-dev-insiders-cache';
const MIN_CACHE_VALUE = 100000; // Cache uniquement les transactions > 100k$

const SEC_EDGAR_BASE_URL = 'https://www.sec.gov';
const USER_AGENT = 'ADEL AI (contact@adel.ai)';
const RATE_LIMIT_DELAY = 100; // 100ms entre requêtes = 10 req/s (strict)

/**
 * Schémas Parquet pour companies et company_filings
 */
const COMPANIES_SCHEMA = new ParquetSchema({
  id: { type: 'INT64', optional: false },
  ticker: { type: 'UTF8', optional: true },
  cik: { type: 'UTF8', optional: true },
  name: { type: 'UTF8', optional: true },
  sector: { type: 'UTF8', optional: true },
  industry: { type: 'UTF8', optional: true },
  market_cap: { type: 'INT64', optional: true },
  headquarters_country: { type: 'UTF8', optional: true },
  headquarters_state: { type: 'UTF8', optional: true },
  sic_code: { type: 'UTF8', optional: true },
  category: { type: 'UTF8', optional: true },
  created_at: { type: 'TIMESTAMP_MILLIS', optional: true },
  updated_at: { type: 'TIMESTAMP_MILLIS', optional: true },
});

const COMPANY_FILINGS_SCHEMA = new ParquetSchema({
  id: { type: 'INT64', optional: false },
  company_cik: { type: 'UTF8', optional: false },
  cik: { type: 'UTF8', optional: true },
  form_type: { type: 'UTF8', optional: true },
  accession_number: { type: 'UTF8', optional: true },
  filing_date: { type: 'DATE', optional: true },
  period_of_report: { type: 'DATE', optional: true },
  document_url: { type: 'UTF8', optional: true },
  status: { type: 'UTF8', optional: true },
  created_at: { type: 'TIMESTAMP_MILLIS', optional: true },
  updated_at: { type: 'TIMESTAMP_MILLIS', optional: true },
});

/**
 * Résoudre company_cik et filingId depuis le message
 * Trouve ou crée la company et le filing si nécessaire
 */
async function resolveCompanyAndFiling(message: Form4ParsingMessage): Promise<{ company_cik: string; filingId: number }> {
  const { cik, accessionNumber, companyName, filingDate } = message;
  const cikPadded = String(cik || '').padStart(10, '0');
  
  // 1. Trouver ou créer la company
  let company_cik: string = cikPadded;
  try {
    const companyQuery = `
      SELECT id, ticker, name, cik
      FROM companies
      WHERE cik = '${cikPadded.replace(/'/g, "''")}'
      LIMIT 1
    `;
    const companyResults = await executeAthenaQuery(companyQuery);
    
    if (companyResults.length > 0) {
      company_cik = companyResults[0].cik || cikPadded;
      console.log(`[Form4 Parser] Found existing company: CIK=${company_cik}, ticker=${companyResults[0].ticker}`);
    } else {
      // Créer la company si elle n'existe pas
      console.log(`[Form4 Parser] Company not found, creating new company for CIK ${cikPadded}`);
      const companyId = generateId();
      const now = new Date();
      const companyData = {
        id: companyId,
        cik: cikPadded,
        name: companyName || `Company CIK ${cikPadded}`,
        ticker: null,
        created_at: now.toISOString(),
      };
      
      // Écrire dans S3 Parquet
      await writeToS3Parquet('companies', [companyData], COMPANIES_SCHEMA);
      console.log(`[Form4 Parser] Created company: CIK=${company_cik}`);
    }
  } catch (error: any) {
    console.error(`[Form4 Parser] Error resolving company: ${error.message}`);
    throw new Error(`Failed to resolve company for CIK ${cikPadded}: ${error.message}`);
  }
  
  // 2. Trouver ou créer le filing
  let filingId: number;
  try {
    const filingQuery = `
      SELECT id, status
      FROM company_filings
      WHERE accession_number = '${accessionNumber.replace(/'/g, "''")}'
        AND form_type = '4'
      LIMIT 1
    `;
    const filingResults = await executeAthenaQuery(filingQuery);
    
    if (filingResults.length > 0) {
      filingId = parseInt(filingResults[0].id, 10);
      console.log(`[Form4 Parser] Found existing filing: ID=${filingId}, status=${filingResults[0].status}`);
    } else {
      // Créer le filing si il n'existe pas
      console.log(`[Form4 Parser] Filing not found, creating new filing for ${accessionNumber}`);
      
      // Parser la date du filing
      let parsedFilingDate: Date;
      if (filingDate) {
        try {
          parsedFilingDate = new Date(filingDate);
        } catch {
          parsedFilingDate = new Date();
        }
      } else {
        parsedFilingDate = new Date();
      }
      
      filingId = generateId();
      const now = new Date();
      const filingData = {
        id: filingId,
        company_cik: cikPadded,
        cik: cikPadded,
        form_type: '4',
        accession_number: accessionNumber,
        filing_date: parsedFilingDate,
        status: 'DISCOVERED',
        created_at: now.toISOString(),
      };
      
      // Écrire dans S3 Parquet
      await writeToS3Parquet('company_filings', [filingData], COMPANY_FILINGS_SCHEMA);
      console.log(`[Form4 Parser] Created filing: ID=${filingId}, accession=${accessionNumber}`);
    }
  } catch (error: any) {
    console.error(`[Form4 Parser] Error resolving filing: ${error.message}`);
    throw new Error(`Failed to resolve filing for ${accessionNumber}: ${error.message}`);
  }
  
  return { company_cik, filingId };
}

/**
 * Fonction générique pour écrire dans S3 Parquet
 */
async function writeToS3Parquet(tableName: string, rows: any[], schema: ParquetSchema): Promise<void> {
  if (rows.length === 0) return;
  
  // Déterminer la partition (year/month) depuis created_at
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  
  await writeToS3ParquetInPartition(tableName, rows, schema, year, month);
}

/**
 * Fonction générique pour écrire dans S3 Parquet avec partition spécifiée
 */
async function writeToS3ParquetInPartition(tableName: string, rows: any[], schema: ParquetSchema, year: number, month: number): Promise<void> {
  if (rows.length === 0) return;
  
  try {
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);
    const tempFilePath = path.join(tempDir, `${tableName}_${timestamp}_${randomSuffix}.parquet`);
    
    // Écrire le fichier Parquet
    const writer = await ParquetWriter.openFile(schema, tempFilePath);
    
    for (const row of rows) {
      const parquetRow = {
        ...row,
        created_at: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        updated_at: row.updated_at ? new Date(row.updated_at).getTime() : (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
        filing_date: row.filing_date ? (row.filing_date instanceof Date ? row.filing_date : new Date(row.filing_date)) : null,
      };
      await writer.appendRow(parquetRow);
    }
    
    await writer.close();
    
    // Uploader sur S3
    const fileBuffer = fs.readFileSync(tempFilePath);
    const s3Key = `data/${tableName}/year=${year}/month=${month}/batch_${timestamp}_${randomSuffix}.parquet`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_DATA_LAKE_BUCKET,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'application/octet-stream',
    }));
    
    // Nettoyer
    fs.unlinkSync(tempFilePath);
    
    console.log(`[S3 Write] ✅ Wrote ${rows.length} ${tableName} to ${s3Key}`);
  } catch (error: any) {
    console.error(`[S3 Write] ❌ Error writing ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Vérifier si un Form 4 a déjà été traité (déduplication)
 * Vérifie dans company_filings si le filing existe déjà avec status='PARSED'
 * ou si l'accession_number existe déjà dans insider_trades
 */
async function checkIfForm4AlreadyParsed(filingId: number, accessionNumber: string): Promise<boolean> {
  try {
    // Vérifier d'abord si le filing est déjà parsé
    if (filingId) {
      const filingQuery = `
        SELECT status
        FROM company_filings
        WHERE id = ${filingId} AND status = 'PARSED'
        LIMIT 1
      `;
      const filingResults = await executeAthenaQuery(filingQuery);
      if (filingResults.length > 0) {
        return true; // Déjà parsé
      }
    }
    
    // Vérifier aussi par accession_number dans les transactions
    const transactionQuery = `
      SELECT COUNT(*) as count
      FROM insider_trades it
      INNER JOIN company_filings cf ON it.filing_id = cf.id
      WHERE cf.accession_number = '${accessionNumber.replace(/'/g, "''")}'
      LIMIT 1
    `;
    const transactionResults = await executeAthenaQuery(transactionQuery);
    const count = parseInt(transactionResults[0]?.count || '0');
    return count > 0;
  } catch (error: any) {
    // En cas d'erreur (table vide, etc.), on continue quand même
    console.warn(`[Form4 Parser] Warning checking deduplication: ${error.message}`);
    return false; // Si erreur, on traite quand même (pas de blocage)
  }
}

interface Form4ParsingMessage {
  company_cik?: string; // Optionnel - sera trouvé/créé si absent
  filingId?: number; // Optionnel - sera trouvé/créé si absent
  accessionNumber: string;
  cik: string;
  companyName?: string; // Pour créer la company si elle n'existe pas
  primaryDocument?: string;
  filingDate?: string; // Date du filing depuis l'Atom feed
  retryCount?: number;
  sourceType?: 'COMPANY_FEED' | 'INSIDER_FEED' | 'ATOM_FEED'; // Provenance du Form 4
}

export const handler = async (event: SQSEvent) => {
  console.log("Form 4 Parser triggered via SQS");
  console.log(`Received ${event.Records.length} message(s) from SQS`);

  const errors: Array<{ messageId: string; error: any }> = [];

  // Traiter UN message à la fois pour respecter le rate limiting
  for (const record of event.Records) {
    try {
      const message: Form4ParsingMessage = JSON.parse(record.body);
      
      console.log("Processing Form 4:", {
        messageId: record.messageId,
        company_cik: message.company_cik,
        filingId: message.filingId,
        accessionNumber: message.accessionNumber,
        cik: message.cik,
      });

      // Si company_cik ou filingId manquent, les trouver/créer
      let company_cik = message.company_cik;
      let filingId = message.filingId;
      
      if (!company_cik || !filingId) {
        const resolved = await resolveCompanyAndFiling(message);
        company_cik = resolved.company_cik;
        filingId = resolved.filingId;
        
        console.log(`[Form4 Parser] Resolved: company_cik=${company_cik}, filingId=${filingId}`);
      }

      // Vérifier la déduplication avant de parser
      if (filingId) {
        const alreadyParsed = await checkIfForm4AlreadyParsed(filingId, message.accessionNumber);
        if (alreadyParsed) {
          console.log(`[Form4 Parser] ⚠️ Skipping duplicate: ${message.accessionNumber} (filing ${filingId} already processed)`);
          continue; // Skip ce message, déjà traité
        }
      }

      // Parser le Form 4 avec rate limiting
      await parseForm4({ ...message, company_cik: message.company_cik, filingId });

      // Rate limiting: attendre 100ms avant de traiter le prochain message
      // (SQS gère déjà le batch, mais on veut être sûr)
      if (event.Records.length > 1) {
        await sleep(RATE_LIMIT_DELAY);
      }

    } catch (error: any) {
      console.error(`Error processing message ${record.messageId}:`, error);
      errors.push({ messageId: record.messageId, error });
      
      // ⚠️ CORRECTION BOUCLE RÉCURSIVE: Ne pas republier automatiquement
      // Laisser SQS gérer les retries avec son mécanisme natif (redrive policy)
      // Si on republie manuellement, on crée une boucle infinie
      
      // Pour les erreurs 429 (rate limit), on laisse SQS retry automatiquement
      // Le message reviendra dans la queue après visibility_timeout
      // Si ça échoue 3 fois, il ira dans la DLQ (configuré dans Terraform)
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        console.warn(`Rate limit hit for message ${record.messageId}. SQS will retry automatically.`);
        // Ne PAS republier manuellement - laisser SQS gérer
      }
    }
  }

  // Flush le buffer avant de terminer (pour ne pas perdre de données)
  try {
    await flushTransactionBuffer();
  } catch (error: any) {
    console.error(`[Buffer Flush] Error flushing buffer at end:`, error.message);
    // Ne pas faire échouer le handler si le flush échoue
  }

  // Si des erreurs se sont produites, throw pour que SQS gère les retries
  if (errors.length > 0) {
    throw new Error(`Failed to process ${errors.length} message(s). First error: ${errors[0].error.message}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      messagesProcessed: event.Records.length,
    }),
  };
};

/**
 * Parser l'index HTML pour trouver le fichier XML Form 4
 * Parse le tableau HTML pour trouver la ligne avec:
 * - Description = "FORM 4"
 * - Type = 4
 * - Document se terminant par .xml
 */
async function findXmlFileFromIndex(cikPadded: string, accessionClean: string, accessionNumber: string): Promise<string | null> {
  const indexUrl = `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/${accessionNumber}-index.htm`;
  
  try {
    await sleep(RATE_LIMIT_DELAY);
    console.log(`[Form4 Parser] Fetching index: ${indexUrl}`);
    
    const response = await fetch(indexUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html, */*',
      },
    });
    
    if (!response.ok) {
      console.warn(`[Form4 Parser] Index not found (${response.status}), will use fallback URLs`);
      return null;
    }
    
    const htmlContent = await response.text();
    
    // Parser le tableau HTML ligne par ligne
    // Format: <tr><td>Seq</td><td>Description</td><td>Document</td><td>Type</td><td>Size</td></tr>
    // On cherche: Description="FORM 4", Type="4", Document se terminant par .xml
    // Priorité: Fichier direct (sans sous-dossier xslF345X*) > Fichier dans sous-dossier
    
    const foundUrls: Array<{ url: string; isDirect: boolean }> = [];
    
    // Regex pour capturer chaque ligne <tr> avec ses colonnes
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    
    while ((rowMatch = rowRegex.exec(htmlContent)) !== null) {
      const rowContent = rowMatch[1];
      
      // Extraire les colonnes (td)
      const tdMatches = rowContent.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
      if (!tdMatches || tdMatches.length < 4) continue;
      
      // Colonne 1: Seq (ignorée)
      // Colonne 2: Description
      const descriptionMatch = tdMatches[1]?.match(/>([^<]+)</);
      const description = descriptionMatch ? descriptionMatch[1].trim() : '';
      
      // Colonne 3: Document (lien)
      const documentMatch = tdMatches[2]?.match(/href=["']([^"']+)["']/);
      const documentHref = documentMatch ? documentMatch[1] : '';
      
      // Colonne 4: Type
      const typeMatch = tdMatches[3]?.match(/>([^<]+)</);
      const type = typeMatch ? typeMatch[1].trim() : '';
      
      // Vérifier les critères: Description="FORM 4", Type="4", Document (href) se terminant par .xml
      // IMPORTANT: Vérifier le href, pas le texte du lien (le texte peut être .html alors que le href est .xml)
      if (description === 'FORM 4' && type === '4' && documentHref && documentHref.endsWith('.xml')) {
        // Construire l'URL complète
        let fullUrl: string;
        if (documentHref.startsWith('http://') || documentHref.startsWith('https://')) {
          fullUrl = documentHref;
        } else if (documentHref.startsWith('/Archives/edgar/data/')) {
          fullUrl = `${SEC_EDGAR_BASE_URL}${documentHref}`;
        } else {
          fullUrl = `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/${documentHref}`;
        }
        
        // Vérifier si c'est un fichier direct (sans sous-dossier xslF345X*)
        const isDirect = !fullUrl.includes('/xslF345X');
        foundUrls.push({ url: fullUrl, isDirect });
        console.log(`[Form4 Parser] Found XML file in index: ${fullUrl} (Direct: ${isDirect})`);
      }
    }
    
    // Retourner le fichier direct en priorité, sinon le premier trouvé
    if (foundUrls.length > 0) {
      // Trier: fichiers directs en premier
      foundUrls.sort((a, b) => {
        if (a.isDirect && !b.isDirect) return -1;
        if (!a.isDirect && b.isDirect) return 1;
        return 0;
      });
      
      const bestUrl = foundUrls[0].url;
      console.log(`[Form4 Parser] ✅ Selected XML file: ${bestUrl} (from ${foundUrls.length} candidate(s))`);
      return bestUrl;
    }
    
    console.warn(`[Form4 Parser] No XML file found in index matching criteria (FORM 4, Type 4, .xml extension)`);
    return null;
  } catch (error: any) {
    console.warn(`[Form4 Parser] Error parsing index: ${error.message}, will use fallback URLs`);
    return null;
  }
}

/**
 * Parser un Form 4
 */
async function parseForm4(message: Form4ParsingMessage): Promise<void> {
  const { company_cik, filingId, accessionNumber, cik, primaryDocument, sourceType } = message;

  // Log détaillé pour diagnostic
  console.log(`[Form4 Parser] Received message:`, {
    company_cik,
    filingId,
    accessionNumber,
    cik: cik,
    cikType: typeof cik,
    primaryDocument,
  });

  // IMPORTANT: La SEC EDGAR nécessite le CIK avec les zéros initiaux (10 chiffres)
  // Exemple: 0001127602 (pas 1127602)
  // MÊME LOGIQUE QUE LE SCRIPT LOCAL (form4-parser.service.ts)
  const cikPadded = String(cik || '').padStart(10, '0'); // S'assurer que le CIK a 10 chiffres avec zéros initiaux
  const accessionClean = accessionNumber.replace(/-/g, ''); // Enlever les tirets pour le chemin

  console.log(`[Form4 Parser] CIK processing: original="${cik}", padded="${cikPadded}"`);

  // PRIORITÉ ABSOLUE: Le fichier .txt contient toujours le XML brut et fonctionne mieux
  // MÊME LOGIQUE QUE LE SCRIPT LOCAL
  const txtUrl = `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/${accessionNumber}.txt`;
  console.log(`[Form4 Parser] Using TXT file (contains raw XML): ${txtUrl}`);
  
  const possibleUrls = [txtUrl]; // Commencer par le .txt en priorité
  
  // NOUVEAU: Parser l'index pour trouver le fichier XML Form 4 (Description="FORM 4", Type="4", .xml)
  try {
    const xmlFileFromIndex = await findXmlFileFromIndex(cikPadded, accessionClean, accessionNumber);
    if (xmlFileFromIndex) {
      possibleUrls.push(xmlFileFromIndex);
      console.log(`[Form4 Parser] Added XML file from index to URL list`);
    } else {
      console.log(`[Form4 Parser] No XML file found in index, will use fallback URLs`);
    }
  } catch (error: any) {
    console.warn(`[Form4 Parser] Error fetching index: ${error.message}, will use fallback URLs`);
  }
  
  // Fallback: Essayer d'autres formats seulement si le .txt et l'index échouent
  // NOTE: On ne cherche plus primaryDocument car on parse l'index directement
  possibleUrls.push(
    // Format avec xslF345X05/form4.xml (format moderne)
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/xslF345X05/form4.xml`,
    // Format avec xslF345X04/form4.xml (format précédent)
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/xslF345X04/form4.xml`,
    // Format avec xslF345X03/form4.xml (ancien format)
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/xslF345X03/form4.xml`,
  );

  // Essayer chaque URL avec rate limiting
  console.log(`[Form4 Parser] Trying ${possibleUrls.length} URLs for accessionNumber ${accessionNumber}`);
  for (const url of possibleUrls) {
    try {
      await sleep(RATE_LIMIT_DELAY); // Rate limiting strict

      console.log(`[Form4 Parser] Attempting URL: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/xml, text/xml, */*',
        },
      });

      console.log(`[Form4 Parser] Response status for ${url}: ${response.status} ${response.statusText}`);
      if (!response.ok) {
        if (response.status === 429) {
          // Rate limit hit, attendre plus longtemps
          console.warn(`Rate limit hit for ${url}, waiting 2 seconds...`);
          await sleep(2000);
          continue;
        }
        
        // Gestion spéciale pour 404: le fichier peut ne pas être encore disponible
        // Retry avec délai de 5 secondes (le fichier peut mettre quelques secondes à être disponible)
        if (response.status === 404 && url === possibleUrls[0]) {
          // Seulement pour la première URL (le .txt principal)
          console.warn(`[Form4 Parser] 404 on primary URL ${url}, file may not be available yet. Retrying in 5 seconds...`);
          await sleep(5000);
          
          // Retry une fois
          const retryResponse = await fetch(url, {
            headers: {
              'User-Agent': USER_AGENT,
              'Accept': 'application/xml, text/xml, */*',
            },
          });
          
          if (retryResponse.ok) {
            console.log(`[Form4 Parser] ✅ Retry successful for ${url}`);
            // Continuer avec le traitement normal
            const xmlContent = await retryResponse.text();
            // ... (le reste du traitement sera fait après cette condition)
            // On va sortir de cette boucle et traiter le contenu
            let processedXml = xmlContent;
            if (url.endsWith('.txt')) {
              const xmlMatch = processedXml.match(/<XML>([\s\S]*?)<\/XML>/i);
              if (xmlMatch) {
                processedXml = xmlMatch[1];
              } else {
                const ownershipMatch = processedXml.match(/(<ownershipDocument[\s\S]*<\/ownershipDocument>)/i);
                if (ownershipMatch) {
                  processedXml = ownershipMatch[1];
                }
              }
            }
            
            if (processedXml.length < 500) {
              console.warn(`[Form4 Parser] XML content is very short after retry`);
              continue;
            }
            
            if (!company_cik || !filingId) {
              throw new Error(`Missing company_cik or filingId for ${accessionNumber}`);
            }
            
            const parseResult = parseForm4XML(processedXml, company_cik, filingId);
            const transactions = parseResult.transactions;
            const periodOfReport = parseResult.periodOfReport;
            
            if (transactions.length > 0) {
              // Ajouter source_type à chaque transaction
              const transactionsWithSource = transactions.map(tx => ({
                ...tx,
                source_type: sourceType || 'ATOM_FEED', // Default si non spécifié
              }));
              
              await insertInsiderTransactions(company_cik, filingId, transactionsWithSource, accessionNumber);
              await updateFilingStatus(filingId, 'PARSED', periodOfReport);
              console.log(`✅ Parsed Form 4 ${accessionNumber}: ${transactions.length} transactions, periodOfReport: ${periodOfReport || 'N/A'}`);
              return;
            }
          } else {
            console.warn(`[Form4 Parser] Retry also failed (${retryResponse.status}), will be picked up by next run`);
            // Ne pas throw d'erreur, laisser le run suivant s'en occuper grâce au chevauchement de fenêtre
            continue;
          }
        }
        
        console.warn(`[Form4 Parser] URL ${url} returned ${response.status}, trying next...`);
        continue; // Essayer l'URL suivante
      }

      let xmlContent = await response.text();
      
      // Log la taille et un échantillon du XML pour diagnostic
      console.log(`[Form4 Parser] Downloaded content (${xmlContent.length} chars), checking structure...`);
      
      // Si c'est un fichier .txt, extraire la section XML (MÊME LOGIQUE QUE LE SCRIPT LOCAL)
      if (url.endsWith('.txt')) {
        // Le fichier .txt contient <SEC-DOCUMENT><DOCUMENT><TEXT><XML>...</XML></TEXT></DOCUMENT></SEC-DOCUMENT>
        // Chercher la balise <XML> qui contient le XML brut
        const xmlMatch = xmlContent.match(/<XML>([\s\S]*?)<\/XML>/i);
        
        if (xmlMatch) {
          xmlContent = xmlMatch[1];
          console.log(`[Form4 Parser] Extracted XML section from .txt file (${xmlContent.length} chars)`);
        } else {
          // Si pas de balise <XML>, chercher directement <ownershipDocument>
          const ownershipMatch = xmlContent.match(/(<ownershipDocument[\s\S]*<\/ownershipDocument>)/i);
          if (ownershipMatch) {
            xmlContent = ownershipMatch[1];
            console.log(`[Form4 Parser] Extracted ownershipDocument from .txt file (${xmlContent.length} chars)`);
          } else {
            console.warn(`[Form4 Parser] Could not find XML section in .txt file, using full content`);
          }
        }
      }
      
      // Vérifier si c'est du HTML (ownership.xml formaté)
      if (xmlContent.trim().startsWith('<!DOCTYPE html') || xmlContent.trim().startsWith('<html')) {
        console.warn(`[Form4 Parser] File appears to be HTML formatted, not XML. Trying to extract XML from HTML...`);
        // Chercher des balises XML dans le HTML (peu probable mais possible)
        const xmlInHtml = xmlContent.match(/(<ownershipDocument[\s\S]*<\/ownershipDocument>)/i);
        if (xmlInHtml) {
          xmlContent = xmlInHtml[1];
          console.log(`[Form4 Parser] Extracted XML from HTML (${xmlContent.length} chars)`);
        } else {
          console.warn(`[Form4 Parser] File is HTML formatted and contains no XML data. Skipping...`);
          continue;
        }
      }
      
      if (xmlContent.length < 500) {
        console.warn(`[Form4 Parser] XML content is very short, might be an error page`);
        console.warn(`[Form4 Parser] First 200 chars: ${xmlContent.substring(0, 200)}`);
      }
      
      if (!company_cik || !filingId) {
        throw new Error(`Missing company_cik or filingId for ${accessionNumber}`);
      }
      
      // Parser le XML (MÊME LOGIQUE QUE LE SCRIPT LOCAL)
      const parseResult = parseForm4XML(xmlContent, company_cik, filingId);
      const transactions = parseResult.transactions;
      const periodOfReport = parseResult.periodOfReport;

      console.log(`[Form4 Parser] Parsed ${transactions.length} transactions, periodOfReport: ${periodOfReport || 'N/A'}, company_cik: ${company_cik}, filingId: ${filingId}`);

      if (transactions.length > 0) {
        try {
          console.log(`[Form4 Parser] Preparing to insert ${transactions.length} transactions...`);
          
          // Ajouter source_type à chaque transaction
          const transactionsWithSource = transactions.map(tx => ({
            ...tx,
            source_type: sourceType || 'ATOM_FEED', // Default si non spécifié
          }));
          
          console.log(`[Form4 Parser] Transactions prepared, calling insertInsiderTransactions...`);
          
          // Insérer les transactions dans S3
          await insertInsiderTransactions(company_cik, filingId, transactionsWithSource, accessionNumber);
          
          console.log(`[Form4 Parser] Transactions inserted, updating filing status...`);
          
          // Mettre à jour le statut du filing et period_of_report
          await updateFilingStatus(filingId, 'PARSED', periodOfReport);
          
          console.log(`✅ Parsed Form 4 ${accessionNumber}: ${transactions.length} transactions, periodOfReport: ${periodOfReport || 'N/A'}`);
          return; // Succès, on arrête
        } catch (insertError: any) {
          console.error(`[Form4 Parser] ❌ Error inserting transactions: ${insertError.message}`);
          console.error(`[Form4 Parser] Stack: ${insertError.stack}`);
          console.error(`[Form4 Parser] Error details:`, JSON.stringify(insertError, Object.getOwnPropertyNames(insertError)));
          // Ne pas continuer si l'insertion échoue - c'est une erreur critique
          throw new Error(`Failed to insert transactions for ${accessionNumber}: ${insertError.message}`);
        }
      } else {
        console.warn(`[Form4 Parser] No transactions extracted from Form 4 ${accessionNumber}`);
        // Continuer à essayer les autres URLs même si aucune transaction trouvée
      }
    } catch (error: any) {
      console.error(`[Form4 Parser] Error processing ${url}: ${error.message}`);
      if (error.message.includes('Failed to insert transactions')) {
        // Erreur critique, ne pas continuer
        throw error;
      }
      console.log(`[Form4 Parser] Failed to parse ${url}, trying next...`);
      continue;
    }
  }

  throw new Error(`Failed to parse Form 4 from any URL for ${accessionNumber}`);
}

/**
 * Parser le XML Form 4 (MÊME LOGIQUE QUE LE SERVICE)
 * Retourne { transactions, periodOfReport }
 */
function parseForm4XML(xmlContent: string, company_cik: string, filingId: number): { transactions: any[]; periodOfReport: string | null } {
  const transactions: any[] = [];
  let periodOfReport: string | null = null;

  try {
    // Gérer les namespaces XML (ex: <edgar:rptOwnerName> ou <rptOwnerName>)
    // Supprimer les namespaces pour simplifier le parsing
    const xmlWithoutNamespaces = xmlContent.replace(/<(\/?)([^:>]+):([^>]+)>/g, '<$1$3>');
    
    // Extraire periodOfReport depuis le XML
    const periodOfReportMatch = xmlWithoutNamespaces.match(/<periodOfReport[^>]*>(?:\s*<value>)?\s*([^<\s]+)/i) ||
                              xmlContent.match(/<periodOfReport[^>]*>(?:\s*<value>)?\s*([^<\s]+)/i);
    if (periodOfReportMatch && periodOfReportMatch[1]) {
      periodOfReport = periodOfReportMatch[1].trim();
      // Valider le format de date (YYYY-MM-DD)
      if (periodOfReport.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.log(`[Form4 Parser] Extracted periodOfReport: ${periodOfReport}`);
      } else {
        console.warn(`[Form4 Parser] Invalid periodOfReport format: ${periodOfReport}`);
        periodOfReport = null;
      }
    }
    
    // Extraire le nom du reporting owner
    // Format moderne: <rptOwnerName>Tsao David</rptOwnerName> (pas de <value> pour le nom)
    let ownerNameMatch = xmlWithoutNamespaces.match(/<rptOwnerName[^>]*>([^<]+)<\/rptOwnerName>/i);
    if (!ownerNameMatch) {
      ownerNameMatch = xmlContent.match(/<rptOwnerName[^>]*>([^<]+)<\/rptOwnerName>/i);
    }
    const ownerName = ownerNameMatch ? ownerNameMatch[1].trim() : 'Unknown';
    
    // Extraire le CIK du reporting owner
    // Format moderne: <rptOwnerCik>0002087127</rptOwnerCik> (pas de <value> pour le CIK)
    let ownerCikMatch = xmlWithoutNamespaces.match(/<rptOwnerCik[^>]*>([^<]+)<\/rptOwnerCik>/i);
    if (!ownerCikMatch) {
      ownerCikMatch = xmlContent.match(/<rptOwnerCik[^>]*>([^<]+)<\/rptOwnerCik>/i);
    }
    const ownerCik = ownerCikMatch ? ownerCikMatch[1].trim().padStart(10, '0') : undefined;

    console.log(`[Form4 Parser] Parsing XML - Owner: ${ownerName}, CIK: ${ownerCik}`);

    // Parser les transactions non-dérivatives (stocks directs)
    // Chercher dans le XML avec et sans namespaces
    const nonDerivativePattern = /<nonDerivativeTransaction[^>]*>([\s\S]*?)<\/nonDerivativeTransaction>/gi;
    const nonDerivativeMatches = Array.from(xmlWithoutNamespaces.matchAll(nonDerivativePattern));
    console.log(`[Form4 Parser] Found ${nonDerivativeMatches.length} non-derivative transactions`);
    
    for (const match of nonDerivativeMatches) {
      const transactionXml = match[1];
      const transaction = parseTransactionBlock(transactionXml, ownerName, ownerCik, 'stock');
      if (transaction) {
        transactions.push(transaction);
      } else {
        console.warn(`[Form4 Parser] Failed to parse non-derivative transaction block`);
      }
    }

    // Parser les transactions dérivatives (options, etc.)
    const derivativePattern = /<derivativeTransaction[^>]*>([\s\S]*?)<\/derivativeTransaction>/gi;
    const derivativeMatches = Array.from(xmlWithoutNamespaces.matchAll(derivativePattern));
    console.log(`[Form4 Parser] Found ${derivativeMatches.length} derivative transactions`);
    
    for (const match of derivativeMatches) {
      const transactionXml = match[1];
      const transaction = parseTransactionBlock(transactionXml, ownerName, ownerCik, 'derivative');
      if (transaction) {
        transactions.push(transaction);
      } else {
        console.warn(`[Form4 Parser] Failed to parse derivative transaction block`);
      }
    }
    
    console.log(`[Form4 Parser] Total transactions extracted: ${transactions.length}`);
    
    // Si aucune transaction trouvée, logger un échantillon du XML pour diagnostic
    if (transactions.length === 0) {
      const xmlSample = xmlContent.substring(0, 1000);
      console.warn(`[Form4 Parser] No transactions found. XML sample (first 1000 chars):`);
      console.warn(xmlSample);
    }

    // Extraire la relation (CEO, CFO, etc.) depuis le reportingOwner
    // Format moderne: <officerTitle>Chief Technology Officer</officerTitle>
    let relationMatch = xmlWithoutNamespaces.match(/<officerTitle[^>]*>([^<]+)<\/officerTitle>/i);
    if (!relationMatch) {
      relationMatch = xmlContent.match(/<officerTitle[^>]*>([^<]+)<\/officerTitle>/i);
    }
    if (!relationMatch) {
      relationMatch = xmlContent.match(/<directorTitle[^>]*>([^<]+)<\/directorTitle>/i);
    }
    
    let relation = relationMatch ? relationMatch[1].trim() : 'Unknown';
    
    // Si pas de titre explicite, utiliser les flags isDirector, isOfficer, isTenPercentOwner
    if (relation === 'Unknown') {
      const isDirectorMatch = xmlWithoutNamespaces.match(/<isDirector[^>]*>([^<]+)<\/isDirector>/i);
      const isDirector = isDirectorMatch ? isDirectorMatch[1].trim().toLowerCase() : null;
      
      const isOfficerMatch = xmlWithoutNamespaces.match(/<isOfficer[^>]*>([^<]+)<\/isOfficer>/i);
      const isOfficer = isOfficerMatch ? isOfficerMatch[1].trim().toLowerCase() : null;
      
      const isTenPercentOwnerMatch = xmlWithoutNamespaces.match(/<isTenPercentOwner[^>]*>([^<]+)<\/isTenPercentOwner>/i);
      const isTenPercentOwner = isTenPercentOwnerMatch ? isTenPercentOwnerMatch[1].trim().toLowerCase() : null;
      
      // Construire la relation à partir des flags
      if (isDirector === 'true' || isDirector === '1') {
        relation = 'Director';
      } else if (isOfficer === 'true' || isOfficer === '1') {
        relation = 'Officer';
      } else if (isTenPercentOwner === 'true' || isTenPercentOwner === '1') {
        relation = '10% Owner';
      }
      
      // Si plusieurs flags, combiner
      if ((isDirector === 'true' || isDirector === '1') && (isOfficer === 'true' || isOfficer === '1')) {
        relation = 'Director and Officer';
      }
    }

    // Mettre à jour la relation pour toutes les transactions
    // Décoder les entités HTML (&amp; -> &, etc.)
    const cleanRelation = relation
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    transactions.forEach(t => {
      if (t.relation === 'Unknown') {
        t.relation = cleanRelation;
      }
    });

  } catch (error: any) {
    console.error('[Form4 Parser] XML parsing error:', error.message);
    return { transactions: [], periodOfReport: null };
  }

  return { transactions, periodOfReport };
}

/**
 * Parser un bloc de transaction (VERSION ULTRA-ROBUSTE)
 * 
 * MÊME LOGIQUE QUE LE SERVICE form4-parser.service.ts
 */
function parseTransactionBlock(
  transactionXml: string,
  ownerName: string,
  ownerCik: string | undefined,
  type: 'stock' | 'derivative'
): any | null {
  try {
    // 1. Nettoyage des namespaces pour simplifier les Regex
    const cleanXml = transactionXml.replace(/<(\/?)([^:>]+):([^>]+)>/g, '<$1$3>');
    
    // 2. Helper ultra-robuste pour extraire une valeur numérique
    // Cette regex cherche la balise, ignore les <value> optionnels et capture le chiffre
    // Elle gère aussi les espaces et les nouvelles lignes \s*
    const extractNumeric = (tag: string): number => {
      const regex = new RegExp(`<${tag}[^>]*>(?:\\s*<value>)?\\s*([^<\\s]+)\\s*(?:<\\/value>)?\\s*<\\/${tag}>`, 'i');
      const match = cleanXml.match(regex);
      if (match) {
        const val = match[1].replace(/,/g, ''); // Enlever les virgules américaines
        return parseFloat(val) || 0;
      }
      return 0;
    };

    // 3. Extraction des données
    const transactionDateMatch = cleanXml.match(/<transactionDate[^>]*>(?:\s*<value>)?\s*([^<\s]+)/i);
    const transactionDate = transactionDateMatch ? transactionDateMatch[1] : null;
    
    const transactionCodeMatch = cleanXml.match(/<transactionCode[^>]*>(?:\s*<value>)?\s*([^<\s]+)/i);
    const transactionCode = transactionCodeMatch ? transactionCodeMatch[1] : '';

    // On cherche les shares. Si 0, on regarde si c'est une option (derivative)
    let shares = extractNumeric('transactionShares');
    if (shares === 0 && type === 'derivative') {
      shares = extractNumeric('underlyingSecurityShares');
    }

    const price = extractNumeric('transactionPricePerShare');
    const acquiredDisposedCode = cleanXml.match(/<transactionAcquiredDisposedCode[^>]*>(?:\s*<value>)?\s*([^<\s]+)/i)?.[1];
    
    // 4. LOGIQUE DE REJET (Le point sensible)
    if (!transactionDate) return null;
    
    // On ne rejette QUE si les shares ET le prix sont à 0 (cas rare des erreurs SEC)
    // Mais on accepte les shares > 0 avec prix 0 (Grants/Cadeaux)
    if (shares === 0) {
      console.warn(`[Form4 Parser] Skipping block: Shares=0. Date: ${transactionDate}`);
      return null;
    }

    // 5. Extraire le titre du security (optionnel) et informations supplémentaires pour améliorer le mapping
    const securityTitleMatch = cleanXml.match(/<securityTitle[^>]*>(?:\s*<value>)?\s*([^<]+)/i);
    const securityTitle = securityTitleMatch ? securityTitleMatch[1].trim() : undefined;
    const securityTitleLower = securityTitle ? securityTitle.toLowerCase() : '';
    
    // Extraire transactionAmounts pour détecter les types de transactions
    const transactionAmountsMatch = cleanXml.match(/<transactionAmounts[^>]*>([\s\S]*?)<\/transactionAmounts>/i);
    const transactionAmountsXml = transactionAmountsMatch ? transactionAmountsMatch[1] : '';
    
    // Détecter les patterns dans securityTitle et transactionAmounts pour affiner le type
    const isAward = securityTitleLower.includes('award') || securityTitleLower.includes('restricted') || securityTitleLower.includes('rsu');
    const isOption = securityTitleLower.includes('option') || securityTitleLower.includes('stock option');
    const isTax = transactionAmountsXml.includes('tax') || transactionCode === 'F';
    const isSale = transactionCode === 'S' || acquiredDisposedCode === 'D';
    const isPurchase = transactionCode === 'P' || acquiredDisposedCode === 'A';

    return {
      insider_name: ownerName,
      insider_cik: ownerCik,
      relation: 'Unknown', 
      transaction_type: mapTransactionCode(transactionCode, {
        securityTitle,
        isAward,
        isOption,
        isTax,
        isSale,
        isPurchase,
      }),
      shares: Math.abs(shares),
      price_per_share: price,
      total_value: Math.abs(shares * price),
      transaction_date: validateAndFormatDate(transactionDate),
      security_title: securityTitle,
      ownership_nature: acquiredDisposedCode === 'A' ? 'Direct' : 'Indirect',
    };
  } catch (error: any) {
    console.error('[Form4 Parser] Error parsing transaction block:', error.message);
    console.error('[Form4 Parser] Transaction XML snippet:', transactionXml.substring(0, 200));
    return null;
  }
}

/**
 * Mapper les codes de transaction avec enrichissement contextuel
 * 
 * Amélioration: Utilise le code SEC + informations contextuelles pour mapper "OTHER" vers des types plus explicites
 */
function mapTransactionCode(
  code: string, 
  context?: {
    securityTitle?: string;
    isAward?: boolean;
    isOption?: boolean;
    isTax?: boolean;
    isSale?: boolean;
    isPurchase?: boolean;
  }
): string {
  const codeUpper = code.toUpperCase();
  
  // Mapping standard des codes SEC
  const standardMapping: Record<string, string> = {
    'P': 'Purchase',      // Achat Open Market (LE SEUL VRAI SIGNAL)
    'S': 'Sale',          // Vente Open Market
    'M': 'Exercise',      // Conversion d'options en actions
    'C': 'Conversion',    // Conversion d'un titre dérivé
    'A': 'Grant',         // Actions gratuites données par la boîte
    'G': 'Gift',          // Cadeau (Donation)
    'F': 'Tax Payment',   // Vente forcée pour payer les impôts
    'D': 'Disposition',   // Disposition à l'émetteur
    'I': 'Discretionary', // Transaction discrétionnaire
    'X': 'Exercise OTM',  // Exercice d'options OTM
    'J': 'Other'          // Mouvements divers (souvent trusts)
  };
  
  // Si le code est mappé directement, retourner le mapping
  if (standardMapping[codeUpper]) {
    return standardMapping[codeUpper];
  }
  
  // Enrichissement contextuel pour "OTHER" ou codes inconnus
  if (context) {
    if (context.isAward || context.securityTitle?.includes('award') || context.securityTitle?.includes('restricted')) {
      return 'AWARD';
    }
    if (context.isOption || context.securityTitle?.includes('option')) {
      return 'OPTION_EXERCISE';
    }
    if (context.isTax) {
      return 'TAX_PAYMENT';
    }
    if (context.isSale) {
      return 'SALE';
    }
    if (context.isPurchase) {
      return 'PURCHASE';
    }
  }
  
  // Fallback: Retourner "OTHER" avec le code original si disponible
  return codeUpper ? `OTHER (${codeUpper})` : 'OTHER';
}

/**
 * Validation stricte de la date pour éviter le bug de 1975
 * 
 * Le problème précédent : La regex /[^0-9]/g extrait tous les chiffres,
 * ce qui peut créer des dates invalides si elle reçoit un CIK ou un timestamp.
 */
function validateAndFormatDate(dateStr: string): string {
  if (!dateStr || !dateStr.trim()) {
    console.warn(`[Form4 Parser] validateAndFormatDate: Empty date string, using current date`);
    return new Date().toISOString().split('T')[0];
  }
  
  const trimmed = dateStr.trim();
  
  // Regex pour format YYYY-MM-DD (format standard SEC)
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    
    // Validation stricte : année entre 1995 et 2028 (dates raisonnables pour Form 4)
    if (year < 1995 || year > 2028) {
      console.warn(`[Form4 Parser] validateAndFormatDate: Year ${year} is out of range (1995-2028), using current date`);
      return new Date().toISOString().split('T')[0];
    }
    
    // Validation que c'est une date valide
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return match[0]; // Retourner YYYY-MM-DD
    } else {
      console.warn(`[Form4 Parser] validateAndFormatDate: Invalid date components (${year}-${month}-${day}), using current date`);
      return new Date().toISOString().split('T')[0];
    }
  }
  
  // Si format ISO (YYYY-MM-DDTHH:mm:ss), extraire la date
  const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return validateAndFormatDate(isoMatch[1]); // Réutiliser la validation
  }
  
  // Dernier fallback: date actuelle
  console.warn(`[Form4 Parser] validateAndFormatDate: Could not parse date "${dateStr}", using current date`);
  return new Date().toISOString().split('T')[0];
}

/**
 * Buffer pour accumuler les transactions avant d'écrire (évite le Small File Problem)
 */
const transactionBuffer: Array<{
  company_cik: string;
  filingId: number;
  accessionNumber?: string; // Ajouter accession_number pour les top signals
  transactions: any[];
  timestamp: number;
}> = [];

const BUFFER_SIZE = 50; // Écrire par batch de 50 transactions
const BUFFER_TIMEOUT = 30000; // Écrire après 30 secondes même si pas plein

let bufferFlushTimer: NodeJS.Timeout | null = null;

/**
 * Insérer les transactions insider dans S3 (avec batch writing)
 * 
 * Accumule les transactions dans un buffer pour éviter le Small File Problem
 * Écrit par batch de 50 transactions ou après 30 secondes
 */
async function insertInsiderTransactions(
  company_cik: string,
  filingId: number,
  transactions: any[],
  accessionNumber?: string // Ajouter accession_number pour les top signals
): Promise<void> {
  // Ajouter au buffer
  // NOTE: Les transactions ont déjà source_type ajouté dans parseForm4, pas besoin de le refaire ici
  transactionBuffer.push({
    company_cik,
    filingId,
    accessionNumber, // Stocker accession_number dans le buffer
    transactions: transactions, // Les transactions ont déjà source_type
    timestamp: Date.now(),
  });

  console.log(`[Buffer] Added ${transactions.length} transactions to buffer (total: ${transactionBuffer.reduce((sum, b) => sum + b.transactions.length, 0)} transactions)`);

  // Vérifier si on doit flush (buffer plein ou timeout)
  const totalTransactions = transactionBuffer.reduce((sum, b) => sum + b.transactions.length, 0);
  
  if (totalTransactions >= BUFFER_SIZE) {
    await flushTransactionBuffer();
  } else {
    // Programmer un flush après timeout si pas déjà programmé
    if (!bufferFlushTimer) {
      bufferFlushTimer = setTimeout(async () => {
        await flushTransactionBuffer();
        bufferFlushTimer = null;
      }, BUFFER_TIMEOUT);
    }
  }
}

/**
 * Flush le buffer de transactions vers S3 Parquet
 */
async function flushTransactionBuffer(): Promise<void> {
  if (transactionBuffer.length === 0) {
    return;
  }

  // Récupérer toutes les transactions du buffer
  const allTransactions: any[] = [];
  for (const bufferItem of transactionBuffer) {
    const now = new Date();
    const transactionDate = bufferItem.transactions[0]?.transaction_date 
      ? new Date(bufferItem.transactions[0].transaction_date)
      : now;
    
    const year = transactionDate.getFullYear();
    const month = transactionDate.getMonth() + 1;

    for (const transaction of bufferItem.transactions) {
      allTransactions.push({
        id: generateId(),
        company_cik: bufferItem.company_cik,
        filing_id: bufferItem.filingId,
        accession_number: bufferItem.accessionNumber, // Ajouter accession_number aux transactions
        insider_name: transaction.insider_name,
        insider_cik: transaction.insider_cik,
        insider_title: transaction.relation,
        relation: transaction.relation,
        transaction_type: transaction.transaction_type.toLowerCase(),
        shares: Math.round(transaction.shares),
        price_per_share: transaction.price_per_share,
        source_type: transaction.source_type || 'ATOM_FEED', // Inclure source_type
        total_value: transaction.total_value,
        transaction_date: transaction.transaction_date,
        alert_flag: transaction.total_value > 1000000,
        created_at: now.toISOString(),
      });
    }
  }

  if (allTransactions.length === 0) {
    transactionBuffer.length = 0; // Clear buffer
    return;
  }

  try {
    // Écrire en batch vers S3 Parquet
    await writeTransactionsToS3Parquet(allTransactions);
    
    console.log(`[S3 Write] ✅ Flushed ${allTransactions.length} transactions to S3 Parquet`);
    
    // Filtrer et insérer les Top Signals (Golden Filter)
    try {
      const topSignals = filterTopSignals(allTransactions);
      
      if (topSignals.length > 0) {
        // Dédupliquer les signals avant insertion (même insider, même date, même montant)
        const uniqueSignals = new Map<string, any>();
        for (const signal of topSignals) {
          const key = `${signal.insider_name}|${signal.company_cik}|${signal.transaction_date}|${signal.total_value}`;
          if (!uniqueSignals.has(key)) {
            uniqueSignals.set(key, signal);
          } else {
            console.log(`[Top Signals] ⚠️ Duplicate signal skipped: ${signal.insider_name} - ${signal.transaction_date} - $${signal.total_value}`);
          }
        }
        
        const deduplicatedSignals = Array.from(uniqueSignals.values());
        if (deduplicatedSignals.length < topSignals.length) {
          console.log(`[Top Signals] Deduplicated: ${topSignals.length} → ${deduplicatedSignals.length} signals`);
        }
        
        await insertTopSignals(deduplicatedSignals);
        console.log(`[Top Signals] ✅ Filtered ${topSignals.length} top signals from ${allTransactions.length} transactions`);
        
        // Envoyer des alertes Telegram si configuré
        const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
        const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
        
        if ((TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) || DISCORD_WEBHOOK_URL) {
          try {
            // Filtrer seulement les transactions du jour (pas l'historique)
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
            
            const todaySignals = deduplicatedSignals.filter(signal => {
              if (!signal.transaction_date) {
                return false;
              }
              // Convertir transaction_date en string YYYY-MM-DD pour comparaison
              let signalDateStr: string;
              if (typeof signal.transaction_date === 'string') {
                signalDateStr = signal.transaction_date.split('T')[0];
              } else {
                const signalDate = new Date(signal.transaction_date);
                signalDateStr = signalDate.toISOString().split('T')[0];
              }
              return signalDateStr === todayStr;
            });

            if (todaySignals.length === 0) {
              console.log(`[Top Signals] ⚠️ No signals for today (${todayStr}), skipping alerts`);
              return;
            }

            console.log(`[Top Signals] 📅 Filtered ${todaySignals.length} signals for today (${todayStr}) out of ${deduplicatedSignals.length} total`);

            // Enrichir les signals avec les infos de company
            const enrichedSignals = await Promise.all(
              todaySignals.map(async (signal) => {
                try {
                  // Récupérer ticker et company_name depuis companies
                  const companyQuery = `
                    SELECT ticker, name 
                    FROM companies 
                    WHERE cik = ${signal.company_cik} 
                    LIMIT 1
                  `;
                  const companyResults = await executeAthenaQuery(companyQuery);
                  const company = companyResults[0] || {};
                  
                  // Récupérer accession_number depuis company_filings
                  const filingQuery = `
                    SELECT accession_number 
                    FROM company_filings 
                    WHERE id = ${signal.filing_id} 
                    LIMIT 1
                  `;
                  const filingResults = await executeAthenaQuery(filingQuery);
                  const filing = filingResults[0] || {};
                  
                  return {
                    ...signal,
                    ticker: company.ticker || undefined,
                    company_name: company.name || undefined,
                    accession_number: filing.accession_number || undefined,
                  };
                } catch (error: any) {
                  console.warn(`[Top Signals] Error enriching signal ${signal.id}:`, error.message);
                  return {
                    ...signal,
                    ticker: undefined,
                    company_name: undefined,
                    accession_number: undefined,
                  };
                }
              })
            );
            
            const result = await sendTopSignalAlerts(enrichedSignals, {
              telegramBotToken: TELEGRAM_BOT_TOKEN,
              telegramChatId: TELEGRAM_CHAT_ID,
              discordWebhookUrl: DISCORD_WEBHOOK_URL,
            });
            console.log(`[Top Signals] ✅ Sent ${result.sent} alerts (${result.failed} failed)`);
          } catch (error: any) {
            console.error(`[Top Signals] ⚠️ Error sending alerts:`, error.message);
            // Ne pas faire échouer l'insertion si les alertes échouent
          }
        }
      }
    } catch (error: any) {
      console.error(`[Top Signals] ⚠️ Error filtering top signals:`, error.message);
      // Ne pas faire échouer l'insertion principale si le filtrage échoue
    }
    
    // Écrire les transactions importantes dans DynamoDB (cache rapide)
    await writeImportantTransactionsToDynamoDB(allTransactions);
    
    // Clear buffer
    transactionBuffer.length = 0;
    
    // Clear timer
    if (bufferFlushTimer) {
      clearTimeout(bufferFlushTimer);
      bufferFlushTimer = null;
    }
  } catch (error: any) {
    console.error(`[S3 Write] ❌ Error flushing buffer:`, error.message);
    // Ne pas clear le buffer en cas d'erreur, on réessaiera plus tard
  }
}

/**
 * Générer un ID unique
 */
function generateId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

/**
 * Schéma Parquet pour insider_trades
 */
const INSIDER_TRADES_SCHEMA = new ParquetSchema({
  id: { type: 'INT64', optional: false },
  company_cik: { type: 'UTF8', optional: false },
  filing_id: { type: 'INT64', optional: true },
  insider_name: { type: 'UTF8', optional: true },
  insider_cik: { type: 'UTF8', optional: true },
  insider_title: { type: 'UTF8', optional: true },
  relation: { type: 'UTF8', optional: true },
  transaction_type: { type: 'UTF8', optional: true },
  shares: { type: 'INT64', optional: true },
  price_per_share: { type: 'DOUBLE', optional: true },
  total_value: { type: 'DOUBLE', optional: true },
  transaction_date: { type: 'DATE', optional: true },
  alert_flag: { type: 'BOOLEAN', optional: true },
  source_type: { type: 'UTF8', optional: true }, // COMPANY_FEED, INSIDER_FEED, ATOM_FEED
  created_at: { type: 'TIMESTAMP_MILLIS', optional: true },
});

/**
 * Écrire les transactions vers S3 Parquet (batch writing)
 */
async function writeTransactionsToS3Parquet(transactions: any[]): Promise<void> {
  if (transactions.length === 0) {
    return;
  }

  // Grouper par partition (year/month) pour optimiser
  const transactionsByPartition = new Map<string, any[]>();
  
  for (const transaction of transactions) {
    // Convertir transaction_date (string YYYY-MM-DD) en Date UTC pour éviter les problèmes de timezone
    let date: Date;
    if (typeof transaction.transaction_date === 'string') {
      const dateStr = transaction.transaction_date.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('-').map(Number);
        date = new Date(Date.UTC(year, month - 1, day));
      } else {
        date = new Date(transaction.transaction_date);
      }
    } else {
      date = new Date(transaction.transaction_date);
    }
    
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const partitionKey = `${year}-${month}`;
    
    if (!transactionsByPartition.has(partitionKey)) {
      transactionsByPartition.set(partitionKey, []);
    }
    
    // Convertir transaction_date en Date pour Parquet
    const transactionWithDate = {
      ...transaction,
      transaction_date: date, // Parquet DATE attend un objet Date
    };
    transactionsByPartition.get(partitionKey)!.push(transactionWithDate);
  }

  // Écrire chaque partition
  for (const [partitionKey, partitionTransactions] of transactionsByPartition) {
    const [year, month] = partitionKey.split('-').map(Number);
    
    try {
      // Créer un fichier temporaire
      const tempDir = os.tmpdir();
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(7);
      const tempFilePath = path.join(tempDir, `insider_trades_${timestamp}_${randomSuffix}.parquet`);

      // Écrire le fichier Parquet
      const writer = await ParquetWriter.openFile(INSIDER_TRADES_SCHEMA, tempFilePath);
      
      for (const transaction of partitionTransactions) {
        // Convertir created_at en timestamp millis
        const parquetRow = {
          ...transaction,
          created_at: transaction.created_at ? new Date(transaction.created_at).getTime() : Date.now(),
        };
        await writer.appendRow(parquetRow);
      }
      
      await writer.close();

      // Lire le fichier et l'uploader sur S3
      const fileBuffer = fs.readFileSync(tempFilePath);
      
      // Générer la clé S3
      const s3Key = `data/insider_trades/year=${year}/month=${month}/batch_${timestamp}_${randomSuffix}.parquet`;
      
      // Uploader sur S3
      await s3Client.send(new PutObjectCommand({
        Bucket: S3_DATA_LAKE_BUCKET,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: 'application/octet-stream',
      }));

      // Nettoyer le fichier temporaire
      fs.unlinkSync(tempFilePath);

      console.log(`[S3 Write] ✅ Wrote ${partitionTransactions.length} transactions to ${s3Key} (${(fileBuffer.length / 1024).toFixed(2)} KB)`);
    } catch (error: any) {
      console.error(`[S3 Write] ❌ Error writing partition ${partitionKey}:`, error.message);
      throw error;
    }
  }
}

/**
 * Écrire les transactions importantes dans DynamoDB (cache rapide)
 * 
 * Seules les transactions > MIN_CACHE_VALUE sont mises en cache
 * pour optimiser les performances de l'API
 */
async function writeImportantTransactionsToDynamoDB(transactions: any[]): Promise<void> {
  const importantTransactions = transactions.filter(
    t => t.total_value && Math.abs(t.total_value) >= MIN_CACHE_VALUE
  );

  if (importantTransactions.length === 0) {
    return;
  }

  console.log(`[DynamoDB Cache] Writing ${importantTransactions.length} important transactions to cache`);

  // Écrire chaque transaction importante dans DynamoDB
  const promises = importantTransactions.map(async (transaction) => {
    try {
      // Clé de cache: transaction_{id}
      const cacheKey = `transaction_${transaction.id}`;
      
      // TTL: 7 jours
      const ttl = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);

      await dynamoClient.send(
        new PutCommand({
          TableName: INSIDERS_CACHE_TABLE,
          Item: {
            cache_key: cacheKey,
            data: transaction,
            ttl: ttl,
            created_at: new Date().toISOString(),
          },
        })
      );
    } catch (error: any) {
      console.warn(`[DynamoDB Cache] Error caching transaction ${transaction.id}:`, error.message);
      // Ne pas faire échouer le flush si le cache échoue
    }
  });

  await Promise.allSettled(promises);
  
  console.log(`[DynamoDB Cache] ✅ Cached ${importantTransactions.length} important transactions`);
}

/**
 * Mettre à jour le statut du filing
 */
/**
 * Mettre à jour le statut et period_of_report d'un filing dans S3 Parquet
 */
async function updateFilingStatus(filingId: number, status: string, periodOfReport?: string | null): Promise<void> {
  try {
    // Récupérer le filing existant
    const filingQuery = `
      SELECT id, company_cik, cik, form_type, accession_number, filing_date, period_of_report, document_url, status, created_at
      FROM company_filings
      WHERE id = ${filingId}
      LIMIT 1
    `;
    const filingResults = await executeAthenaQuery(filingQuery);
    
    if (filingResults.length === 0) {
      console.warn(`[Filing Update] Filing ${filingId} not found, cannot update`);
      return;
    }
    
    const existingFiling = filingResults[0];
    const now = new Date();
    
    // Utiliser filing_date pour déterminer la partition (pas la date actuelle)
    // Cela garantit que le fichier mis à jour est dans la même partition que l'original
    const filingDate = existingFiling.filing_date 
      ? new Date(existingFiling.filing_date)
      : now;
    const partitionYear = filingDate.getUTCFullYear();
    const partitionMonth = filingDate.getUTCMonth() + 1;
    console.log('existingFiling', existingFiling);
    console.log('periodOfReport', periodOfReport);
    // Préparer les données mises à jour
    const updatedFiling = {
      id: filingId,
      company_cik: existingFiling.company_cik || null,
      cik: existingFiling.cik || null,
      form_type: existingFiling.form_type || '4',
      accession_number: existingFiling.accession_number || null,
      filing_date: existingFiling.filing_date || now.toISOString().split('T')[0],
      period_of_report: periodOfReport || existingFiling.period_of_report || null,
      document_url: existingFiling.document_url || null,
      status: status,
      created_at: existingFiling.created_at || now.toISOString(),
      updated_at: now.toISOString(),
    };
    
    // Écrire la mise à jour dans S3 Parquet avec la partition basée sur filing_date
    await writeToS3ParquetInPartition('company_filings', [updatedFiling], COMPANY_FILINGS_SCHEMA, partitionYear, partitionMonth);
    
    console.log(`[Filing Update] ✅ Updated filing ${filingId}: status=${status}, period_of_report=${periodOfReport || 'N/A'} (partition: year=${partitionYear}/month=${partitionMonth})`);
  } catch (error: any) {
    console.error(`[Filing Update] Error updating filing ${filingId}:`, error.message);
    // Ne pas faire échouer le parsing si la mise à jour échoue
  }
}

/**
 * ⚠️ FONCTION DÉSACTIVÉE - ÉVITE LES BOUCLES RÉCURSIVES
 * 
 * Ne pas republier manuellement les messages dans la queue.
 * Laisser SQS gérer les retries avec son mécanisme natif:
 * - visibility_timeout: le message revient après timeout
 * - maxReceiveCount: après 3 échecs, va dans DLQ
 * 
 * Si on republie manuellement, on crée une boucle infinie Lambda → SQS → Lambda
 */
async function republishWithDelay(messageBody: string, delaySeconds: number): Promise<void> {
  console.warn("⚠️ republishWithDelay is disabled to prevent recursive loops. SQS will handle retries automatically.");
  // Ne rien faire - laisser SQS gérer les retries
}

/**
 * Filtrer les Top Signals selon les critères "Golden Filter"
 * - Purchase uniquement (Code P)
 * - Montant > 50 000$
 * - Priorité aux CEO, CFO, Director, President, Chairman, COO
 */
function filterTopSignals(transactions: any[]): any[] {
  const topSignals: any[] = [];
  
  for (const tx of transactions) {
    // Critère 1: Purchase uniquement
    const transactionType = (tx.transaction_type || '').toLowerCase();
    if (!['purchase', 'buy', 'p'].includes(transactionType)) {
      continue;
    }
    
    // Critère 2: Montant > 50 000$
    if (!tx.total_value || tx.total_value < 50000) {
      continue;
    }
    
    // Critère 3: Priorité aux rôles importants
    const relation = (tx.relation || tx.insider_title || '').toLowerCase();
    const isPriorityRole = [
      'ceo', 'chief executive officer',
      'cfo', 'chief financial officer',
      'director',
      'president',
      'chairman', 'chairman of the board',
      'coo', 'chief operating officer'
    ].some(role => relation.includes(role));
    
    // Calculer le score (1-10)
    let score = 5; // Base
    if (isPriorityRole) {
      score += 3; // +3 pour rôle prioritaire
    }
    if (tx.total_value > 1000000) {
      score += 2; // +2 pour > 1M$
    } else if (tx.total_value > 500000) {
      score += 1; // +1 pour > 500k$
    }
    
    topSignals.push({
      company_cik: tx.company_cik,
      filing_id: tx.filing_id,
      accession_number: tx.accession_number, // Ajouter accession_number aux top signals
      insider_name: tx.insider_name,
      insider_cik: tx.insider_cik,
      insider_title: tx.insider_title || tx.relation,
      relation: tx.relation,
      transaction_type: tx.transaction_type,
      shares: tx.shares,
      price_per_share: tx.price_per_share,
      total_value: tx.total_value,
      transaction_date: tx.transaction_date,
      signal_score: Math.min(score, 10), // Max 10
      source_type: tx.source_type || 'ATOM_FEED', // Inclure source_type
      created_at: tx.created_at || new Date().toISOString(),
    });
  }
  
  return topSignals;
}

/**
 * Insérer les Top Signals dans S3 Parquet
 */
async function insertTopSignals(signals: any[]): Promise<void> {
  if (signals.length === 0) {
    return;
  }

  console.log(`[Top Signals] Inserting ${signals.length} top signals to S3...`);

  // Grouper par partition (year/month)
  const signalsByPartition = new Map<string, any[]>();
  
  for (const signal of signals) {
    const date = new Date(signal.transaction_date || signal.created_at);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const partitionKey = `${year}-${month.toString().padStart(2, '0')}`;
    
    if (!signalsByPartition.has(partitionKey)) {
      signalsByPartition.set(partitionKey, []);
    }
    signalsByPartition.get(partitionKey)!.push(signal);
  }

  // Écrire chaque partition
  for (const [partitionKey, partitionSignals] of signalsByPartition) {
    const [year, month] = partitionKey.split('-');
    const s3Key = `data/top_insider_signals/year=${year}/month=${month}/data-${Date.now()}.parquet`;
    
    // Créer un fichier Parquet temporaire
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `top_signals_${Date.now()}.parquet`);
    
    const TOP_SIGNALS_SCHEMA = new ParquetSchema({
      company_cik: { type: 'UTF8', optional: false },
      filing_id: { type: 'INT64', optional: true },
      accession_number: { type: 'UTF8', optional: true }, // Ajouter accession_number au schéma
      insider_name: { type: 'UTF8', optional: true },
      insider_cik: { type: 'UTF8', optional: true },
      insider_title: { type: 'UTF8', optional: true },
      relation: { type: 'UTF8', optional: true },
      transaction_type: { type: 'UTF8', optional: true },
      shares: { type: 'INT64', optional: true },
      price_per_share: { type: 'DOUBLE', optional: true },
      total_value: { type: 'DOUBLE', optional: true },
      transaction_date: { type: 'DATE', optional: true },
      signal_score: { type: 'INT32', optional: true },
      source_type: { type: 'UTF8', optional: true }, // COMPANY_FEED, INSIDER_FEED, ATOM_FEED
      created_at: { type: 'TIMESTAMP_MILLIS', optional: true },
    });
    
    const writer = await ParquetWriter.openFile(TOP_SIGNALS_SCHEMA, tempFilePath);
    
    for (const signal of partitionSignals) {
      await writer.appendRow({
        ...signal,
        created_at: signal.created_at ? new Date(signal.created_at).getTime() : Date.now(),
      });
    }
    
    await writer.close();
    
    // Upload vers S3
    const fileBuffer = fs.readFileSync(tempFilePath);
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_DATA_LAKE_BUCKET,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'application/octet-stream',
    }));
    
    // Nettoyer le fichier temporaire
    fs.unlinkSync(tempFilePath);
    
    console.log(`[Top Signals] ✅ Wrote ${partitionSignals.length} signals to ${s3Key}`);
  }
}

/**
 * Envoyer des alertes Telegram/Discord pour les Top Signals
 */
async function sendTopSignalAlerts(
  signals: Array<any & { ticker?: string; company_name?: string; accession_number?: string }>,
  config: { telegramBotToken?: string; telegramChatId?: string; discordWebhookUrl?: string }
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const signal of signals) {
    try {
      // Telegram
      if (config.telegramBotToken && config.telegramChatId) {
        const message = formatSignalForTelegram(signal);
        const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: config.telegramChatId,
            text: message,
            parse_mode: 'Markdown',
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Telegram API failed: ${error.description || response.statusText}`);
        }

        console.log(`[Signal Alerts] ✅ Telegram alert sent for ${signal.ticker || 'N/A'}`);
        sent++;
      }

      // Discord
      if (config.discordWebhookUrl) {
        const message = formatSignalForDiscord(signal);
        const response = await fetch(config.discordWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: message,
          }),
        });

        if (!response.ok) {
          throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
        }

        console.log(`[Signal Alerts] ✅ Discord alert sent for ${signal.ticker || 'N/A'}`);
        sent++;
      }
    } catch (error: any) {
      console.error(`[Signal Alerts] Failed to send alert for signal ${signal.id}:`, error.message);
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Formater un Top Signal pour Telegram
 */
function formatSignalForTelegram(signal: any & { ticker?: string; company_name?: string; accession_number?: string }): string {
  const secUrl = signal.accession_number && signal.insider_cik
    ? `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${signal.insider_cik}&accession_number=${signal.accession_number}&xbrl_type=v`
    : null;

  return `🔥 *TOP INSIDER SIGNAL DETECTED*

*${signal.ticker || 'N/A'}* - ${signal.company_name || 'Unknown Company'}
👤 *${signal.insider_name}* (${signal.insider_title || signal.relation || 'N/A'})
📊 *${(signal.transaction_type || '').toUpperCase()}* - ${signal.shares?.toLocaleString() || 'N/A'} shares @ $${signal.price_per_share?.toFixed(2) || '0.00'}
💰 *Total: $${signal.total_value?.toLocaleString() || '0'}*
⭐ *Score: ${signal.signal_score}/10*
📅 Date: ${signal.transaction_date || 'N/A'}

${secUrl ? `📄 [View SEC Filing](${secUrl})` : ''}`;
}

/**
 * Formater un Top Signal pour Discord
 */
function formatSignalForDiscord(signal: any & { ticker?: string; company_name?: string; accession_number?: string }): string {
  const secUrl = signal.accession_number && signal.insider_cik
    ? `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${signal.insider_cik}&accession_number=${signal.accession_number}&xbrl_type=v`
    : null;

  return `🔥 **TOP INSIDER SIGNAL DETECTED**

**${signal.ticker || 'N/A'}** - ${signal.company_name || 'Unknown Company'}
👤 **${signal.insider_name}** (${signal.insider_title || signal.relation || 'N/A'})
📊 **${(signal.transaction_type || '').toUpperCase()}** - ${signal.shares?.toLocaleString() || 'N/A'} shares @ $${signal.price_per_share?.toFixed(2) || '0.00'}
💰 **Total: $${signal.total_value?.toLocaleString() || '0'}**
⭐ **Score: ${signal.signal_score}/10**
📅 Date: ${signal.transaction_date || 'N/A'}

${secUrl ? `📄 [View SEC Filing](${secUrl})` : ''}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
