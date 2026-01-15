/**
 * Service pour écrire des données directement sur S3 en Parquet
 * 
 * Architecture Extreme Budget: Écriture directe sur S3, pas de Supabase
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createRequire } from 'module';

// parquetjs est un module CommonJS, on doit utiliser require
const require = createRequire(import.meta.url);
const parquetjs = require('parquetjs');
const { ParquetSchema, ParquetWriter } = parquetjs;

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-3',
});

const S3_DATA_LAKE_BUCKET = process.env.S3_DATA_LAKE_BUCKET || 'adel-ai-dev-data-lake';

/**
 * Schémas Parquet pour chaque table
 */
const PARQUET_SCHEMAS: Record<string, ParquetSchema> = {
  companies: new ParquetSchema({
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
  }),
  funds: new ParquetSchema({
    id: { type: 'INT64', optional: false },
    name: { type: 'UTF8', optional: true },
    cik: { type: 'UTF8', optional: true },
    tier_influence: { type: 'INT32', optional: true },
    category: { type: 'UTF8', optional: true },
    created_at: { type: 'TIMESTAMP_MILLIS', optional: true },
  }),
  fund_filings: new ParquetSchema({
    id: { type: 'INT64', optional: false },
    fund_id: { type: 'INT64', optional: true },
    accession_number: { type: 'UTF8', optional: true },
    form_type: { type: 'UTF8', optional: true },
    filing_date: { type: 'DATE', optional: true },
    period_of_report: { type: 'DATE', optional: true },
    raw_storage_path: { type: 'UTF8', optional: true },
    status: { type: 'UTF8', optional: true },
    created_at: { type: 'TIMESTAMP_MILLIS', optional: true },
    updated_at: { type: 'TIMESTAMP_MILLIS', optional: true },
  }),
  company_filings: new ParquetSchema({
    id: { type: 'INT64', optional: false },
    company_id: { type: 'INT64', optional: true },
    cik: { type: 'UTF8', optional: true },
    form_type: { type: 'UTF8', optional: true },
    accession_number: { type: 'UTF8', optional: true },
    filing_date: { type: 'DATE', optional: true },
    period_of_report: { type: 'DATE', optional: true },
    document_url: { type: 'UTF8', optional: true },
    status: { type: 'UTF8', optional: true },
    created_at: { type: 'TIMESTAMP_MILLIS', optional: true },
    updated_at: { type: 'TIMESTAMP_MILLIS', optional: true },
  }),
  fund_holdings_diff: new ParquetSchema({
    id: { type: 'INT64', optional: false },
    fund_id: { type: 'INT64', optional: true },
    ticker: { type: 'UTF8', optional: true },
    filing_id_new: { type: 'INT64', optional: true },
    filing_id_old: { type: 'INT64', optional: true },
    diff_shares: { type: 'INT64', optional: true },
    diff_value: { type: 'INT64', optional: true },
    diff_pct_shares: { type: 'DOUBLE', optional: true },
    action: { type: 'UTF8', optional: true },
    created_at: { type: 'TIMESTAMP_MILLIS', optional: true },
  }),
  fund_holdings: new ParquetSchema({
    id: { type: 'INT64', optional: false },
    fund_id: { type: 'INT64', optional: true },
    filing_id: { type: 'INT64', optional: true },
    ticker: { type: 'UTF8', optional: true },
    cusip: { type: 'UTF8', optional: true },
    shares: { type: 'INT64', optional: true },
    market_value: { type: 'INT64', optional: true },
    type: { type: 'UTF8', optional: true },
    change_pct: { type: 'DOUBLE', optional: true },
    previous_holding_id: { type: 'INT64', optional: true },
    created_at: { type: 'TIMESTAMP_MILLIS', optional: true },
  }),
  insider_trades: new ParquetSchema({
    id: { type: 'INT64', optional: false },
    company_id: { type: 'INT64', optional: true },
    filing_id: { type: 'INT64', optional: true },
    insider_name: { type: 'UTF8', optional: true },
    insider_cik: { type: 'UTF8', optional: true }, // CIK du dirigeant
    insider_title: { type: 'UTF8', optional: true },
    relation: { type: 'UTF8', optional: true },
    transaction_type: { type: 'UTF8', optional: true },
    shares: { type: 'INT64', optional: true },
    price_per_share: { type: 'DOUBLE', optional: true },
    total_value: { type: 'DOUBLE', optional: true },
    transaction_date: { type: 'DATE', optional: true },
    alert_flag: { type: 'BOOLEAN', optional: true },
    created_at: { type: 'TIMESTAMP_MILLIS', optional: true },
  }),
  top_insider_signals: new ParquetSchema({
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
    signal_score: { type: 'INT32', optional: true },
    created_at: { type: 'TIMESTAMP_MILLIS', optional: true },
  }),
  company_financials: new ParquetSchema({
    id: { type: 'INT64', optional: false },
    company_id: { type: 'INT64', optional: true },
    filing_id: { type: 'INT64', optional: true },
    period_end_date: { type: 'DATE', optional: true },
    form_type: { type: 'UTF8', optional: true },
    net_income: { type: 'INT64', optional: true },
    total_revenue: { type: 'INT64', optional: true },
    cash_and_equivalents: { type: 'INT64', optional: true },
    xbrl_data: { type: 'UTF8', optional: true },
    extraction_method: { type: 'UTF8', optional: true },
    created_at: { type: 'TIMESTAMP_MILLIS', optional: true },
    updated_at: { type: 'TIMESTAMP_MILLIS', optional: true },
  }),
  cusip_ticker_mapping: new ParquetSchema({
    id: { type: 'INT64', optional: false },
    cusip: { type: 'UTF8', optional: true },
    ticker: { type: 'UTF8', optional: true },
    company_name: { type: 'UTF8', optional: true },
    isin: { type: 'UTF8', optional: true },
    source: { type: 'UTF8', optional: true },
    last_verified_at: { type: 'TIMESTAMP_MILLIS', optional: true },
    created_at: { type: 'TIMESTAMP_MILLIS', optional: true },
    updated_at: { type: 'TIMESTAMP_MILLIS', optional: true },
  }),
  transaction_alerts: new ParquetSchema({
    id: { type: 'INT64', optional: false },
    alert_type: { type: 'UTF8', optional: true },
    company_id: { type: 'INT64', optional: true },
    fund_id: { type: 'INT64', optional: true },
    filing_id: { type: 'INT64', optional: true },
    insider_trade_id: { type: 'INT64', optional: true },
    title: { type: 'UTF8', optional: true },
    description: { type: 'UTF8', optional: true },
    transaction_value: { type: 'DOUBLE', optional: true },
    threshold_value: { type: 'DOUBLE', optional: true },
    severity: { type: 'UTF8', optional: true },
    status: { type: 'UTF8', optional: true },
    created_at: { type: 'TIMESTAMP_MILLIS', optional: true },
    viewed_at: { type: 'TIMESTAMP_MILLIS', optional: true },
  }),
};

/**
 * Générer un ID unique basé sur le timestamp et un compteur
 * Format: timestamp (ms) avec suffixe aléatoire pour éviter les collisions
 */
let idCounter = 0;
function generateId(): number {
  const timestamp = Date.now();
  const counter = idCounter++;
  // Utiliser les 13 chiffres du timestamp + 3 chiffres du compteur
  // Format: timestamp * 1000 + counter (max 999)
  // Exemple: 1704067200000 * 1000 + 42 = 1704067200000042
  // Note: Si timestamp dépasse 13 chiffres, on tronque le compteur
  const maxCounter = 999;
  return timestamp * 1000 + (counter % maxCounter);
}

/**
 * Convertir une date en timestamp millis pour Parquet
 */
function toTimestampMillis(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  if (typeof date === 'string') {
    return new Date(date).getTime();
  }
  return date.getTime();
}

/**
 * Écrire une ou plusieurs lignes dans un fichier Parquet et l'uploader sur S3
 */
export async function writeToS3Parquet(
  tableName: string,
  rows: any[],
  options: {
    partitionByDate?: boolean; // Si true, partitionner par year/month basé sur created_at
    customPartition?: { year: number; month: number }; // Partition personnalisée
  } = {}
): Promise<{ s3Key: string; rowsWritten: number }> {
  if (rows.length === 0) {
    throw new Error('No rows to write');
  }

  console.log(`[writeToS3Parquet] Writing ${rows.length} rows to ${tableName}`);

  const schema = PARQUET_SCHEMAS[tableName];
  if (!schema) {
    throw new Error(`No Parquet schema defined for table: ${tableName}`);
  }

  // Déterminer la partition
  let year: number;
  let month: number;

  if (options.customPartition) {
    year = options.customPartition.year;
    month = options.customPartition.month;
  } else if (options.partitionByDate) {
    // Pour insider_trades et top_insider_signals, utiliser transaction_date au lieu de created_at
    const dateField = (tableName === 'insider_trades' || tableName === 'top_insider_signals') ? 'transaction_date' : 'created_at';
    const dateValue = rows[0]?.[dateField];
    
    if (dateValue && dateValue.trim && dateValue.trim() !== '') {
      // Si c'est déjà une string au format YYYY-MM-DD, parser directement
      if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())) {
        const [y, m] = dateValue.trim().split('-').map(Number);
        if (y && m && y >= 1900 && y <= 2100 && m >= 1 && m <= 12) {
          year = y;
          month = m;
        } else {
          // Date invalide, utiliser la date actuelle
          const now = new Date();
          year = now.getFullYear();
          month = now.getMonth() + 1;
        }
      } else {
        // Essayer de parser avec Date
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          year = date.getFullYear();
          month = date.getMonth() + 1;
        } else {
          // Date invalide, utiliser la date actuelle
          const now = new Date();
          year = now.getFullYear();
          month = now.getMonth() + 1;
        }
      }
    } else {
      // Pas de date, utiliser la date actuelle
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }
  } else {
    // Par défaut: partition actuelle
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  // Préparer les données pour Parquet
  const parquetRows = rows.map(row => {
    const parquetRow: any = { ...row };
    
    // Convertir les dates en timestamp millis
    if (parquetRow.created_at) {
      parquetRow.created_at = toTimestampMillis(parquetRow.created_at);
    }
    if (parquetRow.updated_at) {
      parquetRow.updated_at = toTimestampMillis(parquetRow.updated_at);
    }
    
    // Convertir transaction_date (string YYYY-MM-DD) en objet Date pour Parquet
    if (parquetRow.transaction_date && typeof parquetRow.transaction_date === 'string') {
      // Parquet DATE attend un objet Date JavaScript
      const dateStr = parquetRow.transaction_date.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        // Format YYYY-MM-DD valide, convertir en Date (UTC pour éviter les problèmes de timezone)
        const [year, month, day] = dateStr.split('-').map(Number);
        if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          // Utiliser UTC pour éviter les décalages de timezone
          parquetRow.transaction_date = new Date(Date.UTC(year, month - 1, day));
        } else {
          console.warn(`[writeToS3Parquet] Invalid date: ${dateStr}, using current date`);
          parquetRow.transaction_date = new Date();
        }
      } else {
        // Essayer de parser avec Date
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          parquetRow.transaction_date = date;
        } else {
          console.warn(`[writeToS3Parquet] Could not parse date: ${dateStr}, using current date`);
          parquetRow.transaction_date = new Date();
        }
      }
    }
    
    if (parquetRow.filing_date && typeof parquetRow.filing_date === 'string') {
      // Pour les dates, on garde le format string (Parquet gère DATE)
      // Mais on peut aussi convertir en timestamp si nécessaire
    }
    
    return parquetRow;
  });

  // Créer un fichier temporaire
  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(7);
  const tempFilePath = path.join(tempDir, `${tableName}_${timestamp}_${randomSuffix}.parquet`);

  try {
    // Écrire le fichier Parquet
    const writer = await ParquetWriter.openFile(schema, tempFilePath);
    
    for (const row of parquetRows) {
      await writer.appendRow(row);
    }
    
    await writer.close();

    // Lire le fichier et l'uploader sur S3
    const fileBuffer = fs.readFileSync(tempFilePath);
    
    // Générer la clé S3
    const s3Key = `data/${tableName}/year=${year}/month=${month}/insert_${timestamp}_${randomSuffix}.parquet`;
    
    // Uploader sur S3
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_DATA_LAKE_BUCKET,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'application/octet-stream',
    }));

    // Nettoyer le fichier temporaire
    fs.unlinkSync(tempFilePath);

    return {
      s3Key,
      rowsWritten: rows.length,
    };
  } catch (error) {
    // Nettoyer en cas d'erreur
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    throw error;
  }
}

/**
 * Insérer une nouvelle ligne dans une table (écriture sur S3)
 */
export async function insertRowS3(
  tableName: string,
  data: any
): Promise<{ id: number; s3Key: string }> {
  // Générer un ID unique
  const id = data.id || generateId();
  
  // Ajouter les timestamps si absents
  const now = new Date();
  const row = {
    ...data,
    id,
    created_at: data.created_at || now.toISOString(),
    updated_at: data.updated_at || now.toISOString(),
  };

  const result = await writeToS3Parquet(tableName, [row], {
    partitionByDate: true,
  });

  return {
    id,
    s3Key: result.s3Key,
  };
}

/**
 * Insérer plusieurs lignes en batch (écriture sur S3)
 */
export async function insertRowsS3(
  tableName: string,
  rows: any[]
): Promise<{ ids: number[]; s3Key: string }> {
  const now = new Date();
  const rowsWithIds = rows.map(row => {
    const rowWithDefaults = {
      ...row,
      id: row.id || generateId(),
    };
    
    // Pour insider_trades, on n'ajoute pas created_at si transaction_date existe
    // car on utilise transaction_date pour la partition
    if (tableName !== 'insider_trades' || !row.transaction_date) {
      rowWithDefaults.created_at = row.created_at || now.toISOString();
    } else {
      // Pour insider_trades avec transaction_date, on ajoute created_at seulement si absent
      rowWithDefaults.created_at = row.created_at || now.toISOString();
    }
    
    rowWithDefaults.updated_at = row.updated_at || now.toISOString();
    
    return rowWithDefaults;
  });

  const result = await writeToS3Parquet(tableName, rowsWithIds, {
    partitionByDate: true,
  });

  return {
    ids: rowsWithIds.map(r => r.id),
    s3Key: result.s3Key,
  };
}
