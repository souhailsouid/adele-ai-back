/**
 * Script de migration: fund_holdings (Supabase) → S3 (Parquet)
 * 
 * Usage:
 *   npx tsx scripts/migrate_holdings_to_s3.ts \
 *     --batch-size=100000 \
 *     --s3-bucket=personamy-prod-data-lake \
 *     --s3-prefix=fund_holdings/ \
 *     --limit=10000  # Optionnel: limiter pour test
 * 
 * Objectif:
 *   1. Exporter fund_holdings depuis Supabase par batches
 *   2. Convertir en format Parquet
 *   3. Upload vers S3 avec partitionnement (year/month/day)
 *   4. Optimiser pour Athena (compression Snappy)
 */

import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

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
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 100000;

const s3BucketArg = args.find(arg => arg.startsWith('--s3-bucket='));
const s3Bucket = s3BucketArg ? s3BucketArg.split('=')[1] : process.env.S3_DATA_LAKE_BUCKET;

const s3PrefixArg = args.find(arg => arg.startsWith('--s3-prefix='));
const s3Prefix = s3PrefixArg ? s3PrefixArg.split('=')[1] : 'fund_holdings/';

const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const dryRun = args.includes('--dry-run');

if (!s3Bucket) {
  console.error('❌ Erreur: --s3-bucket est requis ou S3_DATA_LAKE_BUCKET doit être défini');
  process.exit(1);
}

// Initialiser S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-3',
});

interface Holding {
  id: number;
  fund_id: number;
  filing_id: number;
  ticker: string | null;
  cusip: string | null;
  shares: number | null;
  market_value: number | null;
  type: string | null;
  created_at: string;
}

/**
 * Convertir un batch de holdings en Parquet
 * Note: Cette fonction nécessite une librairie Parquet (ex: parquetjs)
 * Pour l'instant, on génère un JSON compressé (à remplacer par Parquet)
 */
async function convertToParquet(holdings: Holding[]): Promise<Buffer> {
  // TODO: Utiliser une vraie librairie Parquet (ex: parquetjs, @dsnp/parquetjs)
  // Pour l'instant, on génère du JSON compressé comme placeholder
  const json = JSON.stringify(holdings);
  return Buffer.from(json);
}

/**
 * Upload vers S3 avec partitionnement par date
 */
async function uploadToS3(
  data: Buffer,
  year: number,
  month: number,
  day: number,
  batchIndex: number
): Promise<void> {
  const s3Key = `${s3Prefix}year=${year}/month=${String(month).padStart(2, '0')}/day=${String(day).padStart(2, '0')}/holdings_batch_${batchIndex}.parquet`;
  
  if (dryRun) {
    console.log(`   [DRY RUN] Upload vers: s3://${s3Bucket}/${s3Key}`);
    return;
  }
  
  const command = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: s3Key,
    Body: data,
    ContentType: 'application/x-parquet',
    ServerSideEncryption: 'AES256',
  });
  
  await s3Client.send(command);
  console.log(`   ✅ Uploadé: s3://${s3Bucket}/${s3Key}`);
}

async function migrateHoldingsToS3() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 Migration: fund_holdings → S3 (Parquet)');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log(`📊 Configuration:`);
  console.log(`   - Batch size: ${batchSize.toLocaleString()}`);
  console.log(`   - S3 Bucket: ${s3Bucket}`);
  console.log(`   - S3 Prefix: ${s3Prefix}`);
  console.log(`   - Limit: ${limit ? limit.toLocaleString() : 'Aucune'}`);
  console.log(`   - Dry Run: ${dryRun ? 'Oui' : 'Non'}\n`);
  
  // Compter le total de holdings
  const { count: totalCount, error: countError } = await supabase
    .from('fund_holdings')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('❌ Erreur lors du comptage:', countError.message);
    process.exit(1);
  }
  
  const totalRows = limit ? Math.min(limit, totalCount || 0) : (totalCount || 0);
  console.log(`📈 Total de holdings à migrer: ${totalRows.toLocaleString()}\n`);
  
  let processedCount = 0;
  let batchIndex = 0;
  let uploadedBatches = 0;
  
  while (processedCount < totalRows) {
    batchIndex++;
    const remaining = totalRows - processedCount;
    const currentBatchSize = Math.min(batchSize, remaining);
    
    console.log(`\n[Batch ${batchIndex}] Récupération de ${currentBatchSize.toLocaleString()} holdings...`);
    
    // Récupérer le batch depuis Supabase
    const { data: holdings, error } = await supabase
      .from('fund_holdings')
      .select('*')
      .order('id', { ascending: true })
      .range(processedCount, processedCount + currentBatchSize - 1);
    
    if (error) {
      console.error(`   ❌ Erreur lors de la récupération:`, error.message);
      break;
    }
    
    if (!holdings || holdings.length === 0) {
      console.log('   ℹ️  Aucun holding à traiter');
      break;
    }
    
    console.log(`   ✅ ${holdings.length} holdings récupérés`);
    
    // Grouper par date pour le partitionnement
    const holdingsByDate: Record<string, Holding[]> = {};
    holdings.forEach(holding => {
      const date = new Date(holding.created_at);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const dateKey = `${year}-${month}-${day}`;
      
      if (!holdingsByDate[dateKey]) {
        holdingsByDate[dateKey] = [];
      }
      holdingsByDate[dateKey].push(holding);
    });
    
    // Convertir et uploader par date
    for (const [dateKey, dateHoldings] of Object.entries(holdingsByDate)) {
      const [year, month, day] = dateKey.split('-').map(Number);
      const parquetData = await convertToParquet(dateHoldings);
      
      await uploadToS3(parquetData, year, month, day, batchIndex);
      uploadedBatches++;
    }
    
    processedCount += holdings.length;
    console.log(`   📊 Progression: ${processedCount.toLocaleString()}/${totalRows.toLocaleString()} (${((processedCount / totalRows) * 100).toFixed(1)}%)`);
    
    // Pause pour éviter le rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📊 RÉSUMÉ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Holdings traités: ${processedCount.toLocaleString()}`);
  console.log(`📦 Batches uploadés: ${uploadedBatches}`);
  console.log(`💾 Destination: s3://${s3Bucket}/${s3Prefix}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (!dryRun) {
    console.log('💡 Prochaines étapes:');
    console.log('   1. Créer la table Athena pointant vers S3');
    console.log('   2. Exécuter: MSCK REPAIR TABLE fund_holdings;');
    console.log('   3. Valider les données avec des requêtes de test');
  }
}

migrateHoldingsToS3().catch(console.error);
