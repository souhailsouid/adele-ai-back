/**
 * Script pour corriger manuellement le statut du filing 61
 * Écrit le fichier Parquet dans la bonne partition (year=2025/month=11)
 */

import { executeAthenaQuery } from '../services/api/src/athena/query';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ParquetWriter, ParquetSchema } from 'parquetjs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const S3_DATA_LAKE_BUCKET = process.env.S3_DATA_LAKE_BUCKET || 'adel-ai-dev-data-lake';
const AWS_REGION = process.env.AWS_REGION || 'eu-west-3';

const s3Client = new S3Client({ region: AWS_REGION });

const COMPANY_FILINGS_SCHEMA = new ParquetSchema({
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
});

async function fixFiling61Status() {
  console.log('🔧 Correction du statut du filing 61...\n');

  // Récupérer le filing existant
  const query = `
    SELECT id, company_id, cik, form_type, accession_number, filing_date, period_of_report, document_url, status, created_at
    FROM company_filings
    WHERE id = 61
    LIMIT 1
  `;
  
  const results = await executeAthenaQuery(query);
  
  if (results.length === 0) {
    console.error('❌ Filing 61 non trouvé');
    return;
  }
  
  const existingFiling = results[0];
  const now = new Date();
  
  // Utiliser filing_date pour déterminer la partition (year=2025/month=11)
  const filingDate = existingFiling.filing_date 
    ? new Date(existingFiling.filing_date)
    : new Date('2025-11-06');
  const partitionYear = filingDate.getUTCFullYear();
  const partitionMonth = filingDate.getUTCMonth() + 1;
  
  // Mettre à jour le statut et period_of_report
  const updatedFiling = {
    id: 61,
    company_id: existingFiling.company_id ? parseInt(existingFiling.company_id, 10) : null,
    cik: existingFiling.cik || null,
    form_type: existingFiling.form_type || '4',
    accession_number: existingFiling.accession_number || null,
    filing_date: existingFiling.filing_date || '2025-11-06',
    period_of_report: '2025-11-03', // Extrait du XML
    document_url: existingFiling.document_url || null,
    status: 'PARSED',
    created_at: existingFiling.created_at || now.toISOString(),
    updated_at: now.toISOString(),
  };
  
  console.log('📋 Données mises à jour:');
  console.log(`   Status: ${updatedFiling.status}`);
  console.log(`   Period of Report: ${updatedFiling.period_of_report}`);
  console.log(`   Partition: year=${partitionYear}/month=${partitionMonth}\n`);
  
  // Écrire dans S3 Parquet
  try {
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);
    const tempFilePath = path.join(tempDir, `filing_61_${timestamp}_${randomSuffix}.parquet`);
    
    // Écrire le fichier Parquet
    const writer = await ParquetWriter.openFile(COMPANY_FILINGS_SCHEMA, tempFilePath);
    
    const parquetRow = {
      ...updatedFiling,
      created_at: updatedFiling.created_at ? new Date(updatedFiling.created_at).getTime() : Date.now(),
      updated_at: new Date(updatedFiling.updated_at).getTime(),
      filing_date: updatedFiling.filing_date ? new Date(updatedFiling.filing_date) : null,
      period_of_report: updatedFiling.period_of_report ? new Date(updatedFiling.period_of_report) : null,
    };
    await writer.appendRow(parquetRow);
    await writer.close();
    
    // Uploader sur S3
    const fileBuffer = fs.readFileSync(tempFilePath);
    const s3Key = `data/company_filings/year=${partitionYear}/month=${partitionMonth}/fix_filing_61_${timestamp}_${randomSuffix}.parquet`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_DATA_LAKE_BUCKET,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'application/octet-stream',
    }));
    
    // Nettoyer
    fs.unlinkSync(tempFilePath);
    
    console.log(`✅ Fichier Parquet écrit dans S3: ${s3Key}`);
    console.log(`\n⏳ Attendez 10-20 secondes pour qu'Athena indexe le nouveau fichier, puis vérifiez avec:`);
    console.log(`   npx tsx scripts/check_filing_61_status.ts`);
  } catch (error: any) {
    console.error(`❌ Erreur:`, error.message);
    throw error;
  }
}

fixFiling61Status().catch(console.error);
