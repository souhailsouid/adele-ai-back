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

interface Form4ParsingMessage {
  companyId: number;
  filingId: number;
  accessionNumber: string;
  cik: string;
  primaryDocument?: string;
  retryCount?: number;
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
        companyId: message.companyId,
        filingId: message.filingId,
        accessionNumber: message.accessionNumber,
      });

      // Parser le Form 4 avec rate limiting
      await parseForm4(message);

      // Rate limiting: attendre 100ms avant de traiter le prochain message
      // (SQS gère déjà le batch, mais on veut être sûr)
      if (event.Records.length > 1) {
        await sleep(RATE_LIMIT_DELAY);
      }

    } catch (error: any) {
      console.error(`Error processing message ${record.messageId}:`, error);
      errors.push({ messageId: record.messageId, error });
      
      // Si erreur récupérable, republier avec retry
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        await republishWithDelay(record.body, 1000); // Retry après 1 seconde
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
 * Parser un Form 4
 */
async function parseForm4(message: Form4ParsingMessage): Promise<void> {
  const { companyId, filingId, accessionNumber, cik, primaryDocument } = message;

  // Construire l'URL du document
  const cikNumber = cik.replace(/^0+/, '');
  const accessionClean = accessionNumber.replace(/-/g, '');

  const possibleUrls = [];
  if (primaryDocument) {
    possibleUrls.push(`${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikNumber}/${accessionClean}/${primaryDocument}`);
  }
  possibleUrls.push(
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikNumber}/${accessionClean}/${accessionNumber}.txt`,
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikNumber}/${accessionClean}/primarydocument.xml`,
  );

  // Essayer chaque URL avec rate limiting
  for (const url of possibleUrls) {
    try {
      await sleep(RATE_LIMIT_DELAY); // Rate limiting strict

      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/xml, text/xml, */*',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limit hit, attendre plus longtemps
          console.warn(`Rate limit hit for ${url}, waiting 2 seconds...`);
          await sleep(2000);
          continue;
        }
        continue; // Essayer l'URL suivante
      }

      const xmlContent = await response.text();
      const transactions = parseForm4XML(xmlContent, companyId, filingId);

      if (transactions.length > 0) {
        // Insérer les transactions dans S3
        await insertInsiderTransactions(companyId, filingId, transactions);
        
        // Mettre à jour le statut du filing
        await updateFilingStatus(filingId, 'PARSED');
        
        console.log(`✅ Parsed Form 4 ${accessionNumber}: ${transactions.length} transactions`);
        return; // Succès, on arrête
      }
    } catch (error: any) {
      console.log(`Failed to parse ${url}, trying next...`);
      continue;
    }
  }

  throw new Error(`Failed to parse Form 4 from any URL for ${accessionNumber}`);
}

/**
 * Parser le XML Form 4 (version simplifiée)
 */
function parseForm4XML(xmlContent: string, companyId: number, filingId: number): any[] {
  const transactions: any[] = [];

  try {
    // Extraire le nom du reporting owner
    const ownerNameMatch = xmlContent.match(/<rptOwnerName[^>]*>([^<]+)<\/rptOwnerName>/i);
    const ownerName = ownerNameMatch ? ownerNameMatch[1].trim() : 'Unknown';
    
    // Extraire le CIK du reporting owner
    const ownerCikMatch = xmlContent.match(/<rptOwnerCik[^>]*>([^<]+)<\/rptOwnerCik>/i);
    const ownerCik = ownerCikMatch ? ownerCikMatch[1].trim().padStart(10, '0') : undefined;

    // Parser les transactions non-dérivatives
    const nonDerivativeMatches = xmlContent.matchAll(/<nonDerivativeTransaction[^>]*>([\s\S]*?)<\/nonDerivativeTransaction>/gi);
    
    for (const match of nonDerivativeMatches) {
      const transactionXml = match[1];
      const transaction = parseTransactionBlock(transactionXml, ownerName, ownerCik, 'stock');
      if (transaction) {
        transactions.push(transaction);
      }
    }

    // Parser les transactions dérivatives
    const derivativeMatches = xmlContent.matchAll(/<derivativeTransaction[^>]*>([\s\S]*?)<\/derivativeTransaction>/gi);
    
    for (const match of derivativeMatches) {
      const transactionXml = match[1];
      const transaction = parseTransactionBlock(transactionXml, ownerName, ownerCik, 'derivative');
      if (transaction) {
        transactions.push(transaction);
      }
    }

    // Extraire la relation
    const relationMatch = xmlContent.match(/<officerTitle[^>]*>([^<]+)<\/officerTitle>/i) ||
                         xmlContent.match(/<directorTitle[^>]*>([^<]+)<\/directorTitle>/i);
    const relation = relationMatch ? relationMatch[1].trim() : 'Unknown';

    // Mettre à jour la relation pour toutes les transactions
    transactions.forEach(t => {
      if (t.relation === 'Unknown') {
        t.relation = relation;
      }
    });

  } catch (error: any) {
    console.error('[Form4 Parser] XML parsing error:', error.message);
  }

  return transactions;
}

/**
 * Parser un bloc de transaction
 */
function parseTransactionBlock(
  transactionXml: string,
  ownerName: string,
  ownerCik: string | undefined,
  type: 'stock' | 'derivative'
): any | null {
  try {
    const dateMatch = transactionXml.match(/<transactionDate[^>]*>([^<]+)<\/transactionDate>/i);
    const transactionDate = dateMatch ? dateMatch[1].trim() : null;
    
    if (!transactionDate) {
      return null;
    }

    const codeMatch = transactionXml.match(/<transactionCode[^>]*>([^<]+)<\/transactionCode>/i);
    const transactionCode = codeMatch ? codeMatch[1].trim() : '';
    const transactionType = mapTransactionCode(transactionCode);

    const sharesMatch = transactionXml.match(/<transactionShares[^>]*>([^<]+)<\/transactionShares>/i);
    const shares = sharesMatch ? parseFloat(sharesMatch[1].replace(/,/g, '')) : 0;

    const priceMatch = transactionXml.match(/<transactionPricePerShare[^>]*>([^<]+)<\/transactionPricePerShare>/i);
    const pricePerShare = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;

    const totalValue = shares * pricePerShare;

    return {
      insider_name: ownerName,
      insider_cik: ownerCik,
      relation: 'Unknown',
      transaction_type: transactionType,
      shares: Math.abs(shares),
      price_per_share: pricePerShare,
      total_value: Math.abs(totalValue),
      transaction_date: formatDate(transactionDate),
    };
  } catch (error: any) {
    console.error('[Form4 Parser] Transaction parsing error:', error.message);
    return null;
  }
}

/**
 * Mapper les codes de transaction
 */
function mapTransactionCode(code: string): string {
  const codeMap: Record<string, string> = {
    'P': 'Purchase',
    'S': 'Sale',
    'A': 'Grant',
    'D': 'Sale to Issuer',
    'F': 'Payment of Exercise Price',
    'I': 'Discretionary Transaction',
    'M': 'Exercise or Conversion',
    'C': 'Conversion',
    'E': 'Expiration of Short Derivative Position',
    'H': 'Expiration of Long Derivative Position',
    'O': 'Exercise of Out-of-the-Money Derivative',
    'X': 'Exercise of In-the-Money or At-the-Money Derivative',
    'G': 'Gift',
    'W': 'Acquisition or Disposition by Will',
    'L': 'Small Acquisition',
    'Z': 'Deposit into or Withdrawal from Voting Trust',
  };
  return codeMap[code] || code;
}

/**
 * Formater une date
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

/**
 * Buffer pour accumuler les transactions avant d'écrire (évite le Small File Problem)
 */
const transactionBuffer: Array<{
  companyId: number;
  filingId: number;
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
  companyId: number,
  filingId: number,
  transactions: any[]
): Promise<void> {
  // Ajouter au buffer
  transactionBuffer.push({
    companyId,
    filingId,
    transactions,
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
        company_id: bufferItem.companyId,
        filing_id: bufferItem.filingId,
        insider_name: transaction.insider_name,
        insider_cik: transaction.insider_cik,
        insider_title: transaction.relation,
        relation: transaction.relation,
        transaction_type: transaction.transaction_type.toLowerCase(),
        shares: Math.round(transaction.shares),
        price_per_share: transaction.price_per_share,
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
  company_id: { type: 'INT64', optional: true },
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
    const date = new Date(transaction.transaction_date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const partitionKey = `${year}-${month}`;
    
    if (!transactionsByPartition.has(partitionKey)) {
      transactionsByPartition.set(partitionKey, []);
    }
    transactionsByPartition.get(partitionKey)!.push(transaction);
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
async function updateFilingStatus(filingId: number, status: string): Promise<void> {
  // TODO: Mettre à jour le statut dans Athena/S3
  console.log(`[Filing Update] Would update filing ${filingId} to status ${status}`);
}

/**
 * Republier un message avec delay
 */
async function republishWithDelay(messageBody: string, delaySeconds: number): Promise<void> {
  if (!FORM4_PARSER_QUEUE_URL) {
    console.warn("FORM4_PARSER_QUEUE_URL not set, cannot republish");
    return;
  }

  try {
    await sqsClient.send(new SendMessageCommand({
      QueueUrl: FORM4_PARSER_QUEUE_URL,
      MessageBody: messageBody,
      DelaySeconds: Math.min(delaySeconds, 900), // Max 15 minutes
    }));
    console.log(`Republished message with ${delaySeconds}s delay`);
  } catch (error: any) {
    console.error("Error republishing message:", error);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
