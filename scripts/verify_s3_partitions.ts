/**
 * Script de vérification des partitions S3
 * 
 * Vérifie que toutes les tables partitionnées utilisent bien year=YYYY/month=MM
 * 
 * Usage:
 *   npx tsx scripts/verify_s3_partitions.ts
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-3',
});

const S3_DATA_LAKE_BUCKET = process.env.S3_DATA_LAKE_BUCKET || 'adel-ai-dev-data-lake';

const PARTITIONED_TABLES = [
  'insider_trades',
  'company_financials',
  'transaction_alerts',
  'company_filings',
  'fund_holdings',
];

const NON_PARTITIONED_TABLES = [
  'cusip_ticker_mapping',
  'companies',
  'funds',
];

/**
 * Vérifier les partitions d'une table
 */
async function verifyTablePartitions(tableName: string, shouldBePartitioned: boolean): Promise<void> {
  console.log(`\n📊 Checking ${tableName}...`);
  
  const prefix = `data/${tableName}/`;
  const command = new ListObjectsV2Command({
    Bucket: S3_DATA_LAKE_BUCKET,
    Prefix: prefix,
    Delimiter: '/',
  });
  
  try {
    const response = await s3Client.send(command);
    const prefixes = response.CommonPrefixes || [];
    
    if (shouldBePartitioned) {
      // Vérifier que les partitions sont year=YYYY/month=MM
      const validPartitions = prefixes.filter(p => {
        const key = p.Prefix || '';
        return /year=\d{4}\/month=\d{1,2}\//.test(key);
      });
      
      const invalidPartitions = prefixes.filter(p => {
        const key = p.Prefix || '';
        return !/year=\d{4}\/month=\d{1,2}\//.test(key);
      });
      
      console.log(`  ✅ ${validPartitions.length} valid partitions (year=YYYY/month=MM)`);
      
      if (invalidPartitions.length > 0) {
        console.log(`  ❌ ${invalidPartitions.length} INVALID partitions found:`);
        invalidPartitions.forEach(p => {
          console.log(`     - ${p.Prefix}`);
        });
      }
    } else {
      // Table non partitionnée: vérifier qu'il n'y a pas de partitions
      if (prefixes.length > 0) {
        console.log(`  ⚠️  Table should not be partitioned, but found ${prefixes.length} prefixes:`);
        prefixes.forEach(p => {
          console.log(`     - ${p.Prefix}`);
        });
      } else {
        console.log(`  ✅ Table correctly non-partitioned`);
      }
    }
  } catch (error: any) {
    console.error(`  ❌ Error checking ${tableName}:`, error.message);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Verifying S3 Partitions...');
  console.log(`Bucket: ${S3_DATA_LAKE_BUCKET}\n`);

  // Vérifier les tables partitionnées
  for (const table of PARTITIONED_TABLES) {
    await verifyTablePartitions(table, true);
  }

  // Vérifier les tables non partitionnées
  for (const table of NON_PARTITIONED_TABLES) {
    await verifyTablePartitions(table, false);
  }

  console.log('\n✅ Verification complete');
}

main().catch(console.error);
