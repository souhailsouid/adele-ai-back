/**
 * Lambda pour parser les Form 144 (Notice of Proposed Sale of Securities)
 * 
 * Consomme depuis SQS avec rate limiting strict (10 req/s max pour SEC)
 * 
 * Architecture:
 * - Collector découvre les Form 144 → publie dans SQS
 * - Ce worker consomme depuis SQS → parse avec rate limiting
 */

import { SQSEvent } from "aws-lambda";
import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from "@aws-sdk/client-athena";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ParquetSchema, ParquetWriter } from 'parquetjs';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createRequire } from 'module';

// parquetjs est un module CommonJS
let requirePath: string;
if (typeof __filename !== 'undefined') {
  requirePath = __filename;
} else {
  requirePath = path.join(process.cwd(), 'index.js');
}
const require = createRequire(requirePath);
const parquetjs = require('parquetjs');
const { ParquetSchema: ParquetSchemaLib, ParquetWriter: ParquetWriterLib } = parquetjs;
const ParquetSchema = ParquetSchemaLib;
const ParquetWriter = ParquetWriterLib;

// Configuration
const ATHENA_DATABASE = process.env.ATHENA_DATABASE || "adel_ai_dev";
const ATHENA_WORK_GROUP = process.env.ATHENA_WORK_GROUP || "adel-ai-dev-workgroup";
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET || "adel-ai-dev-athena-results";
const S3_DATA_LAKE_BUCKET = process.env.S3_DATA_LAKE_BUCKET || "adel-ai-dev-data-lake";

const athenaClient = new AthenaClient();
const s3Client = new S3Client();

const SEC_EDGAR_BASE_URL = 'https://www.sec.gov';
const USER_AGENT = 'ADEL AI (contact@adel.ai)';
const RATE_LIMIT_DELAY = 100; // 100ms entre requêtes = 10 req/s (strict)

/**
 * Vérifier si un Form 144 a déjà été traité (déduplication)
 * Utilise l'accession_number comme clé unique
 */
async function checkIfForm144Exists(accessionNumber: string): Promise<boolean> {
  try {
    const query = `
      SELECT COUNT(*) as count
      FROM form_144_notices
      WHERE accession_number = '${accessionNumber.replace(/'/g, "''")}'
      LIMIT 1
    `;
    
    const results = await executeAthenaQuery(query);
    const count = parseInt(results[0]?.count || '0');
    return count > 0;
  } catch (error: any) {
    // En cas d'erreur (table vide, etc.), on continue quand même
    console.warn(`[Form144 Parser] Warning checking deduplication: ${error.message}`);
    return false; // Si erreur, on traite quand même (pas de blocage)
  }
}

/**
 * Helper pour exécuter des requêtes Athena
 */
async function executeAthenaQuery(query: string): Promise<any[]> {
  const queryExecution = await athenaClient.send(new StartQueryExecutionCommand({
    QueryString: query,
    QueryExecutionContext: { Database: ATHENA_DATABASE },
    ResultConfiguration: {
      OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/dedup/`,
    },
    WorkGroup: ATHENA_WORK_GROUP,
  }));

  const queryExecutionId = queryExecution.QueryExecutionId;
  if (!queryExecutionId) {
    throw new Error('Failed to start query');
  }

  // Attendre la fin de l'exécution
  let status = 'RUNNING';
  while (status === 'RUNNING' || status === 'QUEUED') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const statusResult = await athenaClient.send(new GetQueryExecutionCommand({
      QueryExecutionId: queryExecutionId,
    }));
    status = statusResult.QueryExecution?.Status?.State || 'FAILED';

    if (status === 'FAILED' || status === 'CANCELLED') {
      const reason = statusResult.QueryExecution?.Status?.StateChangeReason || 'Unknown error';
      throw new Error(`Query failed: ${reason}`);
    }
  }

  // Récupérer les résultats
  const results = await athenaClient.send(new GetQueryResultsCommand({
    QueryExecutionId: queryExecutionId,
  }));

  if (!results.ResultSet?.Rows) {
    return [];
  }

  // Convertir les résultats en objets
  const columns = results.ResultSet.ResultSetMetadata?.ColumnInfo || [];
  const rows = results.ResultSet.Rows.slice(1); // Skip header

  return rows.map(row => {
    const obj: any = {};
    row.Data?.forEach((cell, index) => {
      const colName = columns[index]?.Name || `col${index}`;
      obj[colName] = cell.VarCharValue || null;
    });
    return obj;
  });
}

interface Form144ParsingMessage {
  accessionNumber: string;
  cik: string;
  companyName?: string;
  filingDate?: string;
  documentUrl?: string;
  entryId?: string;
}

interface Form144Notice {
  id: number;
  accession_number: string;
  cik: string;
  company_name?: string;
  insider_name?: string;
  insider_cik?: string;
  shares?: number;
  price_per_share?: number;
  total_value?: number;
  filing_date: string;
  proposed_sale_date?: string;
  created_at: string;
}

export const handler = async (event: SQSEvent) => {
  console.log("Form 144 Parser triggered via SQS");
  console.log(`Received ${event.Records.length} message(s) from SQS`);

  const errors: Array<{ messageId: string; error: any }> = [];

  // Traiter UN message à la fois pour respecter le rate limiting
  for (const record of event.Records) {
    try {
      const message: Form144ParsingMessage = JSON.parse(record.body);
      
      console.log("Processing Form 144:", {
        messageId: record.messageId,
        accessionNumber: message.accessionNumber,
        cik: message.cik,
      });

      // Vérifier la déduplication avant de parser
      const alreadyExists = await checkIfForm144Exists(message.accessionNumber);
      if (alreadyExists) {
        console.log(`[Form144 Parser] ⚠️ Skipping duplicate: ${message.accessionNumber} (already processed)`);
        continue; // Skip ce message, déjà traité
      }

      // Parser le Form 144 avec rate limiting
      await parseForm144(message);

      // Rate limiting: attendre 100ms avant de traiter le prochain message
      if (event.Records.length > 1) {
        await sleep(RATE_LIMIT_DELAY);
      }

    } catch (error: any) {
      console.error(`Error processing message ${record.messageId}:`, error);
      errors.push({ messageId: record.messageId, error });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      messagesProcessed: event.Records.length,
      errors: errors.length,
    }),
  };
};

/**
 * Parser un Form 144
 */
async function parseForm144(message: Form144ParsingMessage): Promise<void> {
  const { accessionNumber, cik, companyName } = message;
  const cikPadded = String(cik || '').padStart(10, '0');
  const accessionClean = accessionNumber.replace(/-/g, '');

  // URLs possibles pour le Form 144
  const possibleUrls = [
    // Format .txt (contient le XML brut)
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/${accessionNumber}.txt`,
    // Format XML direct
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/xslF144X05/form144.xml`,
  ];

  for (const url of possibleUrls) {
    try {
      console.log(`[Form144 Parser] Attempting URL: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
        },
      });

      if (!response.ok) {
        // Gestion spéciale pour 404: le fichier peut ne pas être encore disponible
        // Retry avec délai de 5 secondes
        if (response.status === 404 && url === possibleUrls[0]) {
          console.warn(`[Form144 Parser] 404 on primary URL ${url}, file may not be available yet. Retrying in 5 seconds...`);
          await sleep(5000);
          
          // Retry une fois
          const retryResponse = await fetch(url, {
            headers: {
              "User-Agent": USER_AGENT,
            },
          });
          
          if (retryResponse.ok) {
            console.log(`[Form144 Parser] ✅ Retry successful for ${url}`);
            // Continuer avec le traitement normal
            let xmlContent = await retryResponse.text();
            if (url.endsWith('.txt')) {
              const xmlMatch = xmlContent.match(/<XML>([\s\S]*?)<\/XML>/i);
              if (xmlMatch) {
                xmlContent = xmlMatch[1];
              }
            }
            
            if (xmlContent.length < 500) {
              console.warn(`[Form144 Parser] XML content is very short after retry`);
              continue;
            }
            
            const notice = parseForm144XML(xmlContent, accessionNumber, cikPadded, companyName);
            if (notice) {
              await insertForm144Notice(notice);
              console.log(`✅ Parsed Form 144 ${accessionNumber}`);
              return;
            }
          } else {
            console.warn(`[Form144 Parser] Retry also failed (${retryResponse.status}), will be picked up by next run`);
            // Ne pas throw d'erreur, laisser le run suivant s'en occuper grâce au chevauchement de fenêtre
            continue;
          }
        }
        
        console.log(`Failed to fetch ${url}: ${response.status}`);
        continue;
      }

      let xmlContent = await response.text();

      // Si c'est un fichier .txt, extraire la section XML
      if (url.endsWith('.txt')) {
        const xmlMatch = xmlContent.match(/<XML>([\s\S]*?)<\/XML>/i);
        if (xmlMatch) {
          xmlContent = xmlMatch[1];
        }
      }

      if (xmlContent.length < 500) {
        console.warn(`[Form144 Parser] XML content is very short, might be an error page`);
        continue;
      }

      // Parser le XML
      const notice = parseForm144XML(xmlContent, accessionNumber, cikPadded, companyName);

      if (notice) {
        // Insérer dans S3
        await insertForm144Notice(notice);
        console.log(`✅ Parsed Form 144 ${accessionNumber}`);
        return; // Succès, on arrête
      }
    } catch (error: any) {
      console.log(`Failed to parse ${url}, trying next...`);
      continue;
    }
  }

  throw new Error(`Failed to parse Form 144 from any URL for ${accessionNumber}`);
}

/**
 * Parser le XML Form 144
 * 
 * Structure XML Form 144 (selon spécifications SEC):
 * - <issuerCik> et <issuerName> : Company (pas l'insider!)
 * - <nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold> : Insider name
 * - <noOfUnitsSold> : Nombre d'actions à vendre
 * - <aggregateMarketValue> : Valeur totale
 * - <approxSaleDate> : Date de vente proposée
 */
function parseForm144XML(xmlContent: string, accessionNumber: string, cik: string, companyName?: string): Form144Notice | null {
  try {
    // Gérer les namespaces XML (ex: <edgar:issuerName> ou <issuerName>)
    const xmlWithoutNamespaces = xmlContent.replace(/<(\/?)([^:>]+):([^>]+)>/g, '<$1$3>');
    
    // Company info (issuer = la company, pas l'insider!)
    const issuerNameMatch = xmlWithoutNamespaces.match(/<issuerName[^>]*>([^<]+)<\/issuerName>/i) ||
                           xmlContent.match(/<issuerName[^>]*>([^<]+)<\/issuerName>/i);
    const issuerCikMatch = xmlWithoutNamespaces.match(/<issuerCik[^>]*>([^<]+)<\/issuerCik>/i) ||
                          xmlContent.match(/<issuerCik[^>]*>([^<]+)<\/issuerCik>/i);
    
    // Insider name (personne qui vend)
    const insiderNameMatch = xmlWithoutNamespaces.match(/<nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold[^>]*>([^<]+)<\/nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold>/i) ||
                            xmlContent.match(/<nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold[^>]*>([^<]+)<\/nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold>/i);
    
    // Insider CIK (peut être dans filerCredentials ou ailleurs)
    const insiderCikMatch = xmlWithoutNamespaces.match(/<filerCredentials[^>]*>[\s\S]*?<cik[^>]*>([^<]+)<\/cik>/i) ||
                           xmlContent.match(/<filerCredentials[^>]*>[\s\S]*?<cik[^>]*>([^<]+)<\/cik>/i);

    // Shares - plusieurs formats possibles
    const sharesMatch = xmlWithoutNamespaces.match(/<noOfUnitsSold[^>]*>([^<]+)<\/noOfUnitsSold>/i) ||
                       xmlWithoutNamespaces.match(/<sharesToBeSold[^>]*>([^<]+)<\/sharesToBeSold>/i) ||
                       xmlWithoutNamespaces.match(/<quantityOfSecurities[^>]*>([^<]+)<\/quantityOfSecurities>/i) ||
                       xmlContent.match(/<noOfUnitsSold[^>]*>([^<]+)<\/noOfUnitsSold>/i);
    
    const shares = sharesMatch ? parseFloat(sharesMatch[1].replace(/,/g, '')) : undefined;

    // Total value (aggregate market value)
    const totalValueMatch = xmlWithoutNamespaces.match(/<aggregateMarketValue[^>]*>([^<]+)<\/aggregateMarketValue>/i) ||
                           xmlContent.match(/<aggregateMarketValue[^>]*>([^<]+)<\/aggregateMarketValue>/i);
    const totalValue = totalValueMatch ? parseFloat(totalValueMatch[1].replace(/[$,]/g, '')) : undefined;

    // Price per share (calculé si on a shares et total value)
    const pricePerShare = shares && totalValue && shares > 0 ? totalValue / shares : undefined;

    // Dates
    const filingDateMatch = xmlWithoutNamespaces.match(/<filingDate[^>]*>([^<]+)<\/filingDate>/i) ||
                           xmlContent.match(/<filingDate[^>]*>([^<]+)<\/filingDate>/i);
    
    const proposedSaleDateMatch = xmlWithoutNamespaces.match(/<approxSaleDate[^>]*>([^<]+)<\/approxSaleDate>/i) ||
                                 xmlWithoutNamespaces.match(/<proposedSaleDate[^>]*>([^<]+)<\/proposedSaleDate>/i) ||
                                 xmlContent.match(/<approxSaleDate[^>]*>([^<]+)<\/approxSaleDate>/i);
    
    // Convertir la date MM/DD/YYYY en YYYY-MM-DD
    let filingDate = filingDateMatch?.[1]?.trim() || new Date().toISOString().split('T')[0];
    if (filingDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [month, day, year] = filingDate.split('/');
      filingDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    let proposedSaleDate = proposedSaleDateMatch?.[1]?.trim();
    if (proposedSaleDate && proposedSaleDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [month, day, year] = proposedSaleDate.split('/');
      proposedSaleDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Utiliser issuerName comme company_name si disponible
    const finalCompanyName = issuerNameMatch?.[1]?.trim() || companyName;
    const finalCompanyCik = issuerCikMatch?.[1]?.trim()?.padStart(10, '0') || cik;

    if (!insiderNameMatch?.[1] && !insiderCikMatch?.[1]) {
      console.warn(`[Form144 Parser] No insider name or CIK found in XML`);
      // Ne pas retourner null, on peut quand même créer un notice avec les infos disponibles
    }

    return {
      id: Date.now() + Math.floor(Math.random() * 1000),
      accession_number: accessionNumber,
      cik: finalCompanyCik, // CIK de la company (issuer)
      company_name: finalCompanyName,
      insider_name: insiderNameMatch?.[1]?.trim(),
      insider_cik: insiderCikMatch?.[1]?.trim()?.padStart(10, '0'),
      shares: shares ? Math.round(shares) : undefined,
      price_per_share: pricePerShare,
      total_value: totalValue,
      filing_date: filingDate,
      proposed_sale_date: proposedSaleDate,
      created_at: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error(`[Form144 Parser] Error parsing XML:`, error.message);
    return null;
  }
}

// Buffer pour grouper les notices par partition (comme Form 4)
const noticeBuffer: Form144Notice[] = [];
let bufferFlushTimer: NodeJS.Timeout | null = null;
const BUFFER_TIMEOUT = 5000; // 5 secondes

/**
 * Ajouter une notice au buffer (comme Form 4)
 */
async function insertForm144Notice(notice: Form144Notice): Promise<void> {
  noticeBuffer.push(notice);
  
  // Flush après timeout ou si le buffer est plein
  if (bufferFlushTimer) {
    clearTimeout(bufferFlushTimer);
  }
  
  if (noticeBuffer.length >= 10) {
    await flushNoticeBuffer();
  } else {
    bufferFlushTimer = setTimeout(async () => {
      bufferFlushTimer = null;
      await flushNoticeBuffer();
    }, BUFFER_TIMEOUT);
  }
}

/**
 * Flush le buffer de notices vers S3 Parquet (même logique que Form 4)
 */
async function flushNoticeBuffer(): Promise<void> {
  if (noticeBuffer.length === 0) {
    return;
  }

  const noticesToFlush = [...noticeBuffer];
  noticeBuffer.length = 0; // Clear buffer

  try {
    // Grouper par partition (year/month) comme Form 4
    const noticesByPartition = new Map<string, Form144Notice[]>();
    
    for (const notice of noticesToFlush) {
      // Convertir filing_date (string YYYY-MM-DD) en Date UTC pour éviter les problèmes de timezone
      let date: Date;
      if (typeof notice.filing_date === 'string') {
        const dateStr = notice.filing_date.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          const [year, month, day] = dateStr.split('-').map(Number);
          date = new Date(Date.UTC(year, month - 1, day));
        } else {
          date = new Date(notice.filing_date);
        }
      } else {
        date = new Date(notice.filing_date || notice.created_at);
      }
      
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1; // 1-12, pas de padding
      const partitionKey = `${year}-${month}`;
      
      if (!noticesByPartition.has(partitionKey)) {
        noticesByPartition.set(partitionKey, []);
      }
      
      // Convertir les dates en Date objects pour Parquet
      const noticeWithDates = {
        ...notice,
        filing_date: date, // Parquet DATE attend un objet Date
        proposed_sale_date: notice.proposed_sale_date 
          ? (typeof notice.proposed_sale_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(notice.proposed_sale_date)
            ? (() => {
                const [y, m, d] = notice.proposed_sale_date.split('-').map(Number);
                return new Date(Date.UTC(y, m - 1, d));
              })()
            : new Date(notice.proposed_sale_date))
          : undefined,
      };
      noticesByPartition.get(partitionKey)!.push(noticeWithDates);
    }

    // Écrire chaque partition (même logique que Form 4)
    for (const [partitionKey, partitionNotices] of noticesByPartition) {
      const [year, month] = partitionKey.split('-').map(Number);
      
      try {
        // Créer un fichier temporaire
        const tempDir = os.tmpdir();
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const tempFilePath = path.join(tempDir, `form144_${timestamp}_${randomSuffix}.parquet`);

        const FORM144_SCHEMA = new ParquetSchema({
          id: { type: 'INT64', optional: false },
          accession_number: { type: 'UTF8', optional: true },
          cik: { type: 'UTF8', optional: true },
          company_name: { type: 'UTF8', optional: true },
          insider_name: { type: 'UTF8', optional: true },
          insider_cik: { type: 'UTF8', optional: true },
          shares: { type: 'INT64', optional: true },
          price_per_share: { type: 'DOUBLE', optional: true },
          total_value: { type: 'DOUBLE', optional: true },
          filing_date: { type: 'DATE', optional: true },
          proposed_sale_date: { type: 'DATE', optional: true },
          created_at: { type: 'TIMESTAMP_MILLIS', optional: true },
        });

        // Écrire le fichier Parquet
        const writer = await ParquetWriter.openFile(FORM144_SCHEMA, tempFilePath);
        
        for (const notice of partitionNotices) {
          // Convertir created_at en timestamp millis
          const parquetRow = {
            ...notice,
            created_at: notice.created_at ? new Date(notice.created_at).getTime() : Date.now(),
          };
          await writer.appendRow(parquetRow);
        }
        
        await writer.close();

        // Lire le fichier et l'uploader sur S3
        const fileBuffer = fs.readFileSync(tempFilePath);
        
        // Générer la clé S3 (month sans padding, comme Form 4)
        const s3Key = `data/form_144_notices/year=${year}/month=${month}/batch_${timestamp}_${randomSuffix}.parquet`;
        
        // Uploader sur S3
        await s3Client.send(new PutObjectCommand({
          Bucket: S3_DATA_LAKE_BUCKET,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: 'application/octet-stream',
        }));

        // Nettoyer le fichier temporaire
        fs.unlinkSync(tempFilePath);

        console.log(`[Form144 Parser] ✅ Wrote ${partitionNotices.length} notices to ${s3Key} (${(fileBuffer.length / 1024).toFixed(2)} KB)`);
      } catch (error: any) {
        console.error(`[Form144 Parser] ❌ Error writing partition ${partitionKey}:`, error.message);
        throw error;
      }
    }
  } catch (error: any) {
    console.error(`[Form144 Parser] ❌ Error flushing buffer:`, error.message);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
