/**
 * Lambda PARSER - Parse les Form 4 depuis SQS (batch)
 *
 * Objectifs:
 * - COST SAFETY: 1 query Athena par batch (idempotence)
 * - SEC safety: rate limiting géré par fetchSECDocument (shared utils)
 * - Robustesse SQS: retry uniquement si nécessaire via batchItemFailures
 *
 * Stratégie erreurs (simple et stable):
 * - Message invalide (JSON / champs manquants) -> RETRY (puis DLQ)
 * - Erreur transitoire (429 / 5xx / réseau / timeouts) -> RETRY (puis DLQ)
 * - Erreur définitive (404 doc, etc.) -> ACK + écrit status=ERROR (pas de retry)
 * - Si l’écriture du status ERROR échoue -> RETRY (pour éviter perdre le debug)
 *
 * Kill switch:
 * - ENABLE_SEC_SYNC=false -> on laisse les messages en queue (RETRY) pour pause totale
 */

import { SQSEvent, SQSBatchResponse } from "aws-lambda";
import { AthenaClient } from "@aws-sdk/client-athena";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ParquetSchema, ParquetWriter } from "parquetjs";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import { checkExistingAccessionNumbers } from "../../shared-utils/src/athena-client";
import { fetchSECDocument } from "../../shared-utils/src/sec-client";

// ======================
// Configuration
// ======================
const ENABLE_SEC_SYNC = process.env.ENABLE_SEC_SYNC === "true";
const ATHENA_DATABASE = process.env.ATHENA_DATABASE || "adel_ai_dev";
const ATHENA_WORK_GROUP = process.env.ATHENA_WORK_GROUP || "adel-ai-dev-workgroup";
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET || "adel-ai-dev-athena-results";
const S3_DATA_LAKE_BUCKET = process.env.S3_DATA_LAKE_BUCKET || "adel-ai-dev-data-lake";

const SEC_EDGAR_BASE_URL = "https://www.sec.gov";

const athenaClient = new AthenaClient();
const s3Client = new S3Client();

// ======================
// Types
// ======================
interface Form4ParsingMessage {
  companyCik: string;
  accessionNumber: string;
  filingDate: string; // ISO string
  reportDate: string; // ISO string
  primaryDocument: string;
}

// ======================
// Helpers (id, validation, errors)
// ======================

function generateFilingId(accessionNumber: string): string {
  return accessionNumber.replace(/\D/g, ""); // digits only
}

function generateTxId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function isValidMessage(m: any): m is Form4ParsingMessage {
  return (
    m &&
    typeof m.companyCik === "string" &&
    typeof m.accessionNumber === "string" &&
    typeof m.primaryDocument === "string" &&
    m.companyCik.length > 0 &&
    m.accessionNumber.length > 0 &&
    m.primaryDocument.length > 0
  );
}

function normalizeAccessionForUrl(accessionNumber: string): string {
  return accessionNumber.replace(/-/g, "");
}

function buildForm4Url(cik: string, accessionNumber: string, primaryDocument: string): string {
  const cikPadded = (cik || "").padStart(10, "0");
  const accessionClean = normalizeAccessionForUrl(accessionNumber);
  return `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/${primaryDocument}`;
}

function isRetryableError(err: any): boolean {
  const status = err?.status;
  const msg = String(err?.message || err || "").toLowerCase();

  // 429 / 5xx: retry
  if (status === 429) return true;
  if (typeof status === "number" && status >= 500) return true;

  // erreurs réseau / timeouts (souvent sans status)
  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("network") ||
    msg.includes("econnreset") ||
    msg.includes("eai_again") ||
    msg.includes("enotfound") ||
    msg.includes("socket") ||
    msg.includes("too many requests")
  ) {
    return true;
  }

  return false;
}

function isDefinitiveError(err: any): boolean {
  // Document 404 => définitif (souvent)
  const status = err?.status;
  const msg = String(err?.message || err || "").toLowerCase();
  if (status === 404) return true;
  if (msg.includes("not found (404)")) return true;
  return false;
}

// ======================
// Parquet schemas
// ======================
const COMPANY_FILINGS_SCHEMA = new ParquetSchema({
  id: { type: "UTF8", optional: false }, // filingId = accession digits
  company_cik: { type: "UTF8", optional: false },
  form_type: { type: "UTF8", optional: true },
  accession_number: { type: "UTF8", optional: true },
  filing_date: { type: "TIMESTAMP_MILLIS", optional: true },
  period_of_report: { type: "TIMESTAMP_MILLIS", optional: true },
  document_url: { type: "UTF8", optional: true },
  status: { type: "UTF8", optional: true }, // PARSED | FETCHED | ERROR
  error_message: { type: "UTF8", optional: true },
  created_at: { type: "TIMESTAMP_MILLIS", optional: true },
  updated_at: { type: "TIMESTAMP_MILLIS", optional: true },
});

const INSIDER_TRADES_SCHEMA = new ParquetSchema({
  id: { type: "UTF8", optional: false }, // tx id string
  filing_id: { type: "UTF8", optional: true },
  company_cik: { type: "UTF8", optional: true },
  insider_cik: { type: "UTF8", optional: true },
  insider_name: { type: "UTF8", optional: true },
  transaction_type: { type: "UTF8", optional: true },
  transaction_code: { type: "UTF8", optional: true },
  security_title: { type: "UTF8", optional: true },
  shares: { type: "DOUBLE", optional: true },
  price_per_share: { type: "DOUBLE", optional: true },
  transaction_date: { type: "TIMESTAMP_MILLIS", optional: true },
  created_at: { type: "TIMESTAMP_MILLIS", optional: true },
});

// ======================
// S3 Parquet writer
// ======================
async function writeToS3Parquet(
  tableName: string,
  rows: any[],
  schema: ParquetSchema,
  companyCik?: string,
  accessionNumber?: string
): Promise<void> {
  if (!rows.length) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const tmpFile = path.join(os.tmpdir(), `${tableName}-${Date.now()}-${Math.random()}.parquet`);

  try {
    const writer = await ParquetWriter.openFile(schema, tmpFile);
    for (const row of rows) await writer.appendRow(row);
    await writer.close();

    let key: string;
    if (companyCik && accessionNumber) {
      const cikClean = companyCik.replace(/[^a-zA-Z0-9]/g, "");
      const accessionClean = accessionNumber.replace(/\D/g, "");
      key = `data/${tableName}/year=${year}/month=${month}/day=${day}/company_cik=${cikClean}/accession=${accessionClean}.parquet`;
    } else {
      key = `data/${tableName}/year=${year}/month=${month}/day=${day}/${Date.now()}.parquet`;
    }

    const body = fs.readFileSync(tmpFile);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_DATA_LAKE_BUCKET,
        Key: key,
        Body: body,
        ContentType: "application/octet-stream",
      })
    );

    console.log(`  ✅ Written ${rows.length} rows to s3://${S3_DATA_LAKE_BUCKET}/${key}`);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

// ======================
// Parser XML (placeholder)
// ======================
async function parseForm4XML(
  cik: string,
  accessionNumber: string,
  primaryDocument: string
): Promise<
  Array<{
    insiderCik: string;
    insiderName: string;
    transactionType: string;
    transactionCode: string;
    securityTitle: string;
    shares: number;
    pricePerShare: number;
    transactionDate: string;
  }>
> {
  const url = buildForm4Url(cik, accessionNumber, primaryDocument);

  const xmlContent = await fetchSECDocument(url);
  if (!xmlContent) {
    const e: any = new Error("Failed to fetch Form 4: Document not found (404)");
    e.status = 404;
    throw e;
  }

  // TODO: parsing réel
  console.log(`  ⚠️  XML parsing not implemented yet (${xmlContent.length} bytes)`);
  return [];
}

// ======================
// Write ERROR status helper
// ======================
async function writeErrorStatus(message: Form4ParsingMessage, err: any): Promise<void> {
  const now = new Date();
  const filingId = generateFilingId(message.accessionNumber);
  const filingDate = message.filingDate ? new Date(message.filingDate) : now;
  const reportDate = message.reportDate ? new Date(message.reportDate) : filingDate;

  const errorMessage = String(err?.message || err || "Unknown error").slice(0, 500);

  const errorFilingData = {
    id: filingId,
    company_cik: message.companyCik,
    form_type: "4",
    accession_number: message.accessionNumber,
    filing_date: filingDate,
    period_of_report: reportDate,
    document_url: buildForm4Url(message.companyCik, message.accessionNumber, message.primaryDocument),
    status: "ERROR",
    error_message: errorMessage,
    created_at: now,
    updated_at: now,
  };

  await writeToS3Parquet("company_filings", [errorFilingData], COMPANY_FILINGS_SCHEMA, message.companyCik, message.accessionNumber);
}

// ======================
// Handler
// ======================
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("📄 SEC Form 4 PARSER - Démarrage");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`📊 Batch size: ${event.Records.length}`);

  // Kill switch -> on ne traite rien, on laisse en queue
  if (!ENABLE_SEC_SYNC) {
    console.log("⚠️ ENABLE_SEC_SYNC=false - Kill switch: on laisse les messages en queue (retry).");
    return { batchItemFailures: event.Records.map((r) => ({ itemIdentifier: r.messageId })) };
  }

  const metrics = { parsed: 0, skipped: 0, errors: 0 };
  const failedMessageIds: string[] = [];

  // 1) Parse batch messages (valid only) + accessions
  const parsedMessages: Array<{ recordId: string; msg: Form4ParsingMessage }> = [];
  for (const r of event.Records) {
    try {
      const raw = JSON.parse(r.body);
      if (!isValidMessage(raw)) throw new Error("Invalid message schema");
      parsedMessages.push({ recordId: r.messageId, msg: raw });
    } catch (e) {
      console.error(`❌ Invalid JSON/message schema for record ${r.messageId} -> RETRY`, String((e as any)?.message || e));
      failedMessageIds.push(r.messageId); // poison -> DLQ after retries
    }
  }

  const accessions = parsedMessages.map((x) => x.msg.accessionNumber);

  // 2) Batch idempotence check (1 query Athena)
  let existingSet = new Set<string>();
  try {
    if (accessions.length > 0) {
      console.log(`🔍 Batch idempotence check for ${accessions.length} accession(s) (1 query Athena)...`);
      existingSet = await checkExistingAccessionNumbers(accessions, athenaClient, ATHENA_DATABASE, ATHENA_WORK_GROUP, ATHENA_RESULTS_BUCKET);
      console.log(`✅ Already processed: ${existingSet.size}`);
    } else {
      console.log("⚠️ No valid messages to process after validation.");
    }
  } catch (e) {
    // si Athena tombe, on retry tout le batch valide (sinon on perd l'idempotence)
    console.error("❌ Athena idempotence check failed -> RETRY all valid messages", String((e as any)?.message || e));
    for (const x of parsedMessages) failedMessageIds.push(x.recordId);
    return { batchItemFailures: failedMessageIds.map((id) => ({ itemIdentifier: id })) };
  }

  // 3) Process each valid message
  for (const { recordId, msg } of parsedMessages) {
    try {
      console.log(`\n📋 Processing accession=${msg.accessionNumber} cik=${msg.companyCik}`);

      // Skip if already processed
      if (existingSet.has(msg.accessionNumber)) {
        console.log("  ⚠️ Already processed -> SKIP (ACK)");
        metrics.skipped++;
        continue;
      }

      // Parse Form 4
      console.log("  🔍 Fetch + parse XML...");
      const transactions = await parseForm4XML(msg.companyCik, msg.accessionNumber, msg.primaryDocument);
      console.log(`  ✅ Transactions: ${transactions.length}`);

      const now = new Date();
      const filingId = generateFilingId(msg.accessionNumber);
      const filingDate = msg.filingDate ? new Date(msg.filingDate) : now;
      const reportDate = msg.reportDate ? new Date(msg.reportDate) : filingDate;

      const status = transactions.length > 0 ? "PARSED" : "FETCHED";

      const filingData = {
        id: filingId,
        company_cik: msg.companyCik,
        form_type: "4",
        accession_number: msg.accessionNumber,
        filing_date: filingDate,
        period_of_report: reportDate,
        document_url: buildForm4Url(msg.companyCik, msg.accessionNumber, msg.primaryDocument),
        status,
        created_at: now,
        updated_at: now,
      };

      await writeToS3Parquet("company_filings", [filingData], COMPANY_FILINGS_SCHEMA, msg.companyCik, msg.accessionNumber);

      if (transactions.length > 0) {
        const insiderTrades = transactions.map((tx, idx) => ({
          id: `${generateTxId()}-${filingId}-${idx}`,
          filing_id: filingId,
          company_cik: msg.companyCik,
          insider_cik: tx.insiderCik,
          insider_name: tx.insiderName,
          transaction_type: tx.transactionType,
          transaction_code: tx.transactionCode,
          security_title: tx.securityTitle,
          shares: tx.shares,
          price_per_share: tx.pricePerShare,
          transaction_date: tx.transactionDate ? new Date(tx.transactionDate) : filingDate,
          created_at: now,
        }));

        await writeToS3Parquet("insider_trades", insiderTrades, INSIDER_TRADES_SCHEMA, msg.companyCik, msg.accessionNumber);
      }

      metrics.parsed++;
      console.log("  ✅ Done (ACK)");
    } catch (err: any) {
      metrics.errors++;
      console.error(`  ❌ Error accession=${msg.accessionNumber}:`, String(err?.message || err));

      const retryable = isRetryableError(err);
      const definitive = isDefinitiveError(err);

      // a) Si transitoire -> retry
      if (retryable && !definitive) {
        console.log("  🔁 Retryable error -> RETRY (batchItemFailures)");
        failedMessageIds.push(recordId);
        continue;
      }

      // b) Sinon -> on essaye d'écrire ERROR puis ACK
      try {
        await writeErrorStatus(msg, err);
        console.log("  🧾 ERROR status written -> ACK (no retry)");
      } catch (writeErr: any) {
        // si on n'arrive même pas à écrire le status ERROR, on retry pour ne pas perdre le debug
        console.error("  ❌ Failed to write ERROR status -> RETRY", String(writeErr?.message || writeErr));
        failedMessageIds.push(recordId);
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("✅ PARSER terminé");
  console.log(`📊 Metrics: parsed=${metrics.parsed} skipped=${metrics.skipped} errors=${metrics.errors}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  return {
    batchItemFailures: failedMessageIds.map((id) => ({ itemIdentifier: id })),
  };
};
