/**
 * Script de Migration: Supabase → S3 Parquet (Extreme Budget Architecture)
 * 
 * Usage:
 *   npx tsx scripts/migrate_to_s3_parquet.ts \
 *     --table=companies \
 *     --s3-bucket=personamy-prod-data-lake \
 *     --batch-size=10000 \
 *     --limit=1000  # Optionnel pour test
 * 
 * Objectif:
 *   1. Extraire les données depuis Supabase
 *   2. Convertir en format Apache Parquet
 *   3. Upload vers S3 avec partitionnement Hive (year/month)
 *   4. Structure: s3://bucket/data/{table_name}/year=2025/month=12/data.parquet
 */

import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { ParquetWriter, ParquetSchema } from 'parquetjs';

// Charger les variables d'environnement
let dotenvLoaded = false;
try {
  const dotenv = require('dotenv');
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    dotenvLoaded = true;
  }
} catch (e) {
  // dotenv n'est pas installé, parser manuellement
}

if (!dotenvLoaded) {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const lines = envContent.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    } catch (e) {
      // Ignorer les erreurs de parsing
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erreur: SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse arguments
const args = process.argv.slice(2);
const tableArg = args.find(arg => arg.startsWith('--table='));
const tableName = tableArg ? tableArg.split('=')[1] : null;

const s3BucketArg = args.find(arg => arg.startsWith('--s3-bucket='));
const s3Bucket = s3BucketArg ? s3BucketArg.split('=')[1] : process.env.S3_DATA_LAKE_BUCKET;

const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 10000;

const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const dryRun = args.includes('--dry-run');

if (!tableName) {
  console.error('❌ Erreur: --table est requis (ex: --table=companies)');
  process.exit(1);
}

if (!s3Bucket) {
  console.error('❌ Erreur: --s3-bucket est requis ou S3_DATA_LAKE_BUCKET doit être défini');
  process.exit(1);
}

// Initialiser S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-3',
});

/**
 * Définir le schéma Parquet selon la table
 */
function getParquetSchema(tableName: string): ParquetSchema {
  const schemas: Record<string, ParquetSchema> = {
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
    fund_holdings: new ParquetSchema({
      id: { type: 'INT64', optional: false },
      fund_id: { type: 'INT64', optional: true },
      filing_id: { type: 'INT64', optional: true },
      ticker: { type: 'UTF8', optional: true },
      cusip: { type: 'UTF8', optional: true },
      shares: { type: 'INT64', optional: true },
      market_value: { type: 'INT64', optional: true },
      type: { type: 'UTF8', optional: true },
      created_at: { type: 'TIMESTAMP_MILLIS', optional: true },
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
  };

  if (!schemas[tableName]) {
    throw new Error(`Schéma Parquet non défini pour la table: ${tableName}`);
  }

  return schemas[tableName];
}

/**
 * Convertir un batch de données en Parquet
 */
async function convertToParquet(
  data: any[],
  schema: ParquetSchema,
  tempPath: string
): Promise<Buffer> {
  const writer = await ParquetWriter.openFile(schema, tempPath);

  for (const row of data) {
    // Convertir les dates en timestamps
    const convertedRow: any = { ...row };
    
    if (convertedRow.created_at) {
      convertedRow.created_at = new Date(convertedRow.created_at).getTime();
    }
    if (convertedRow.updated_at) {
      convertedRow.updated_at = new Date(convertedRow.updated_at).getTime();
    }
    if (convertedRow.filing_date) {
      convertedRow.filing_date = new Date(convertedRow.filing_date);
    }
    if (convertedRow.period_of_report) {
      convertedRow.period_of_report = new Date(convertedRow.period_of_report);
    }

    await writer.appendRow(convertedRow);
  }

  await writer.close();

  // Lire le fichier Parquet
  const parquetBuffer = fs.readFileSync(tempPath);
  
  // Supprimer le fichier temporaire
  fs.unlinkSync(tempPath);

  return parquetBuffer;
}

/**
 * Upload vers S3 avec partitionnement Hive
 */
async function uploadToS3(
  data: Buffer,
  tableName: string,
  year: number,
  month: number,
  batchIndex: number
): Promise<string> {
  const s3Key = `data/${tableName}/year=${year}/month=${String(month).padStart(2, '0')}/data_batch_${batchIndex}.parquet`;

  if (dryRun) {
    console.log(`   [DRY RUN] Upload vers: s3://${s3Bucket}/${s3Key}`);
    return s3Key;
  }

  const command = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: s3Key,
    Body: data,
    ContentType: 'application/x-parquet',
    ServerSideEncryption: 'AES256',
    Metadata: {
      'table-name': tableName,
      'year': String(year),
      'month': String(month),
      'batch-index': String(batchIndex),
    },
  });

  await s3Client.send(command);
  console.log(`   ✅ Uploadé: s3://${s3Bucket}/${s3Key} (${(data.length / 1024 / 1024).toFixed(2)} MB)`);
  
  return s3Key;
}

async function migrateTableToS3() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 Migration: Supabase → S3 Parquet (Extreme Budget)');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`📊 Configuration:`);
  console.log(`   - Table: ${tableName}`);
  console.log(`   - Batch size: ${batchSize.toLocaleString()}`);
  console.log(`   - S3 Bucket: ${s3Bucket}`);
  console.log(`   - Limit: ${limit ? limit.toLocaleString() : 'Aucune'}`);
  console.log(`   - Dry Run: ${dryRun ? 'Oui' : 'Non'}\n`);

  // Vérifier que la table existe
  const { count: totalCount, error: countError } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error(`❌ Erreur lors du comptage de ${tableName}:`, countError.message);
    process.exit(1);
  }

  const totalRows = limit ? Math.min(limit, totalCount || 0) : (totalCount || 0);
  console.log(`📈 Total de rows à migrer: ${totalRows.toLocaleString()}\n`);

  // Obtenir le schéma Parquet
  const schema = getParquetSchema(tableName);
  console.log(`✅ Schéma Parquet chargé pour ${tableName}\n`);

  let processedCount = 0;
  let batchIndex = 0;
  let uploadedFiles: string[] = [];
  const tempDir = path.join(process.cwd(), 'temp_parquet');
  
  // Créer le dossier temporaire
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  while (processedCount < totalRows) {
    batchIndex++;
    const remaining = totalRows - processedCount;
    const currentBatchSize = Math.min(batchSize, remaining);

    console.log(`\n[Batch ${batchIndex}] Récupération de ${currentBatchSize.toLocaleString()} rows...`);

    // Récupérer le batch depuis Supabase
    const { data: rows, error } = await supabase
      .from(tableName)
      .select('*')
      .order('id', { ascending: true })
      .range(processedCount, processedCount + currentBatchSize - 1);

    if (error) {
      console.error(`   ❌ Erreur lors de la récupération:`, error.message);
      break;
    }

    if (!rows || rows.length === 0) {
      console.log('   ℹ️  Aucune row à traiter');
      break;
    }

    console.log(`   ✅ ${rows.length} rows récupérées`);

    // Grouper par date pour le partitionnement
    const rowsByDate: Record<string, any[]> = {};
    rows.forEach((row: any) => {
      // Utiliser created_at pour le partitionnement
      const dateField = row.created_at || row.filing_date || row.updated_at;
      if (!dateField) {
        // Si pas de date, utiliser la date actuelle
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const dateKey = `${year}-${month}`;
        if (!rowsByDate[dateKey]) {
          rowsByDate[dateKey] = [];
        }
        rowsByDate[dateKey].push(row);
        return;
      }

      const date = new Date(dateField);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const dateKey = `${year}-${month}`;

      if (!rowsByDate[dateKey]) {
        rowsByDate[dateKey] = [];
      }
      rowsByDate[dateKey].push(row);
    });

    // Convertir et uploader par date
    for (const [dateKey, dateRows] of Object.entries(rowsByDate)) {
      const [year, month] = dateKey.split('-').map(Number);
      
      const tempFilePath = path.join(tempDir, `${tableName}_${dateKey}_batch_${batchIndex}.parquet`);
      
      try {
        const parquetBuffer = await convertToParquet(dateRows, schema, tempFilePath);
        const s3Key = await uploadToS3(parquetBuffer, tableName, year, month, batchIndex);
        uploadedFiles.push(s3Key);
      } catch (error: any) {
        console.error(`   ❌ Erreur lors de la conversion/upload pour ${dateKey}:`, error.message);
      }
    }

    processedCount += rows.length;
    console.log(`   📊 Progression: ${processedCount.toLocaleString()}/${totalRows.toLocaleString()} (${((processedCount / totalRows) * 100).toFixed(1)}%)`);

    // Pause pour éviter le rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Nettoyer le dossier temporaire
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📊 RÉSUMÉ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Rows traitées: ${processedCount.toLocaleString()}`);
  console.log(`📦 Fichiers uploadés: ${uploadedFiles.length}`);
  console.log(`💾 Destination: s3://${s3Bucket}/data/${tableName}/`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!dryRun) {
    console.log('💡 Prochaines étapes:');
    console.log(`   1. Créer la table Athena pointant vers s3://${s3Bucket}/data/${tableName}/`);
    console.log('   2. Exécuter: MSCK REPAIR TABLE ' + tableName + ';');
    console.log('   3. Valider les données avec des requêtes de test');
  }
}

migrateTableToS3().catch(console.error);
