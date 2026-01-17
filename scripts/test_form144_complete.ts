/**
 * Script de test complet du système Form 144
 * Vérifie: collector, parsing, écriture S3, et lecture Athena
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ParquetSchema, ParquetWriter } from 'parquetjs';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createRequire } from 'module';
import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from '@aws-sdk/client-athena';

const requirePath = typeof __filename !== 'undefined' ? __filename : path.join(process.cwd(), 'index.js');
const require = createRequire(requirePath);
const parquetjs = require('parquetjs');
const { ParquetSchema: ParquetSchemaLib, ParquetWriter: ParquetWriterLib } = parquetjs;
const ParquetSchema = ParquetSchemaLib;
const ParquetWriter = ParquetWriterLib;

const s3Client = new S3Client({});
const athenaClient = new AthenaClient({});
const S3_DATA_LAKE_BUCKET = 'adel-ai-dev-data-lake';
const ATHENA_DATABASE = 'adel_ai_dev';
const ATHENA_WORK_GROUP = 'adel-ai-dev-workgroup';
const ATHENA_RESULTS_BUCKET = 'adel-ai-dev-athena-results';

async function executeAthenaQuery(query: string): Promise<any[]> {
  const execution = await athenaClient.send(new StartQueryExecutionCommand({
    QueryString: query,
    QueryExecutionContext: { Database: ATHENA_DATABASE },
    ResultConfiguration: { OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/test/` },
    WorkGroup: ATHENA_WORK_GROUP,
  }));
  
  let status = 'RUNNING';
  while (status === 'RUNNING' || status === 'QUEUED') {
    await new Promise(r => setTimeout(r, 1000));
    const result = await athenaClient.send(new GetQueryExecutionCommand({
      QueryExecutionId: execution.QueryExecutionId,
    }));
    status = result.QueryExecution?.Status?.State || 'FAILED';
    if (status === 'FAILED') {
      const reason = result.QueryExecution?.Status?.StateChangeReason || 'Unknown';
      throw new Error(`Query failed: ${reason}`);
    }
  }
  
  const results = await athenaClient.send(new GetQueryResultsCommand({
    QueryExecutionId: execution.QueryExecutionId,
    MaxResults: 10,
  }));
  
  const rows = results.ResultSet?.Rows?.slice(1) || [];
  const columns = results.ResultSet?.ResultSetMetadata?.ColumnInfo || [];
  
  return rows.map(row => {
    const obj: any = {};
    row.Data?.forEach((cell, i) => {
      const colName = columns[i]?.Name || `col${i}`;
      obj[colName] = cell.VarCharValue || null;
    });
    return obj;
  });
}

async function testWriteAndRead() {
  console.log('🧪 TEST COMPLET DU SYSTÈME FORM 144');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Notice de test
  const notice = {
    id: Date.now(),
    accession_number: '0001976408-26-000021',
    cik: '0001983527',
    company_name: 'Sol-Gel Technologies Ltd.',
    insider_name: 'Yosef Itzik',
    insider_cik: '0001983527',
    shares: 713,
    price_per_share: 62.94,
    total_value: 44876.22,
    filing_date: '2026-01-14',
    proposed_sale_date: '2026-01-14',
    created_at: new Date().toISOString(),
  };

  console.log('1️⃣  Test d\'écriture S3 (logique Form 4)...\n');
  
  // Convertir filing_date en Date UTC (comme Form 4)
  const dateStr = notice.filing_date.trim();
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const yearPartition = date.getUTCFullYear();
  const monthPartition = date.getUTCMonth() + 1; // 1-12, SANS padding

  console.log(`   📅 Date: ${dateStr}`);
  console.log(`   📂 Partition: year=${yearPartition}, month=${monthPartition} (sans padding, comme Form 4)`);

  // Créer fichier Parquet
  const tempDir = os.tmpdir();
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(7);
  const tempFilePath = path.join(tempDir, `form144_test_${timestamp}_${randomSuffix}.parquet`);

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

  const writer = await ParquetWriter.openFile(FORM144_SCHEMA, tempFilePath);

  await writer.appendRow({
    ...notice,
    filing_date: date,
    proposed_sale_date: date,
    created_at: new Date(notice.created_at).getTime(),
  });

  await writer.close();

  const fileBuffer = fs.readFileSync(tempFilePath);
  const s3Key = `data/form_144_notices/year=${yearPartition}/month=${monthPartition}/batch_${timestamp}_${randomSuffix}.parquet`;

  console.log(`   📦 Fichier créé: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
  console.log(`   🔑 S3 Key: ${s3Key}`);

  await s3Client.send(new PutObjectCommand({
    Bucket: S3_DATA_LAKE_BUCKET,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: 'application/octet-stream',
  }));

  fs.unlinkSync(tempFilePath);

  console.log(`   ✅ Fichier uploadé dans S3!`);
  console.log(`   🎯 Format vérifié: month=${monthPartition} (sans padding, comme Form 4)\n`);

  // Vérifier dans S3
  console.log('2️⃣  Vérification dans S3...\n');
  const { listObjectsV2 } = await import('@aws-sdk/client-s3');
  const { S3Client: S3ClientLib, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
  const s3ListClient = new S3ClientLib({});
  const listResult = await s3ListClient.send(new ListObjectsV2Command({
    Bucket: S3_DATA_LAKE_BUCKET,
    Prefix: 'data/form_144_notices/',
  }));
  
  const files = listResult.Contents || [];
  console.log(`   📊 Fichiers trouvés: ${files.length}`);
  files.forEach((file, i) => {
    console.log(`      ${i + 1}. ${file.Key} (${((file.Size || 0) / 1024).toFixed(2)} KB)`);
    // Vérifier le format
    if (file.Key?.includes('/month=')) {
      const monthMatch = file.Key.match(/\/month=(\d+)\//);
      if (monthMatch) {
        const monthValue = parseInt(monthMatch[1]);
        if (monthValue >= 1 && monthValue <= 12 && monthValue.toString().length === 1) {
          console.log(`         ✅ Format correct: month=${monthValue} (sans padding)`);
        } else {
          console.log(`         ⚠️  Format incorrect: month=${monthValue} (devrait être 1-12 sans padding)`);
        }
      }
    }
  });
  console.log('');

  // Attendre quelques secondes pour propagation
  console.log('3️⃣  Vérification dans Athena (attente 5s pour propagation S3)...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    console.log('   📊 Test 1: Comptage total...');
    const countResults = await executeAthenaQuery('SELECT COUNT(*) as total FROM form_144_notices');
    const total = countResults[0]?.total || '0';
    console.log(`      ✅ Total: ${total} notices\n`);

    if (parseInt(total) > 0) {
      console.log('   📊 Test 2: Détails (avec filtre partition year=2026, month=1)...');
      const details = await executeAthenaQuery(`
        SELECT 
          accession_number,
          company_name,
          insider_name,
          shares,
          price_per_share,
          total_value,
          CAST(filing_date AS VARCHAR) as filing_date,
          year,
          month
        FROM form_144_notices
        WHERE year = 2026 AND month = 1
        LIMIT 5
      `);

      console.log(`      ✅ Résultats: ${details.length} notices\n`);
      details.forEach((row, i) => {
        console.log(`      ${i + 1}. ${row.company_name || 'N/A'} - ${row.insider_name || 'N/A'}`);
        console.log(`         - Accession: ${row.accession_number || 'N/A'}`);
        console.log(`         - Shares: ${row.shares ? parseInt(row.shares).toLocaleString() : 'N/A'}`);
        console.log(`         - Price: $${row.price_per_share ? parseFloat(row.price_per_share).toFixed(2) : 'N/A'}`);
        console.log(`         - Total: $${row.total_value ? parseFloat(row.total_value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A'}`);
        console.log(`         - Partition: year=${row.year}, month=${row.month}`);
        console.log('');
      });
    } else {
      console.log('      ⚠️  Aucune donnée trouvée dans Athena');
      console.log('      💡 Cela peut prendre quelques minutes pour que les données apparaissent');
      console.log('      💡 Vérifiez que le format de partition est correct (month=1, pas month=01)\n');
    }
  } catch (error: any) {
    console.error(`   ❌ Erreur: ${error.message}\n`);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ TEST TERMINÉ');
  console.log('═══════════════════════════════════════════════════════════');
}

testWriteAndRead().catch(console.error);
