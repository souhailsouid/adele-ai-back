/**
 * Lambda DISCOVER - Découvre les Form 4 depuis SEC API
 * 
 * Architecture:
 * - Déclenchée par EventBridge (cron quotidien) ou manuellement
 * - Récupère whitelist de CIKs (env var JSON ou S3)
 * - Pour chaque CIK: appelle SEC submissions API
 * - Extrait Form 4 récents (max 20 par CIK)
 * - Dédup en 1 SEULE requête Athena batch
 * - Push dans SQS form4-parser-queue (1 message = 1 filing)
 * 
 * ⚠️ COST SAFETY:
 * - 1 seule requête Athena (batch WHERE IN (...))
 * - Rate limiting SEC: 120ms entre appels (8.3 req/s)
 * - Kill switch: ENABLE_SEC_SYNC=false
 */

import { EventBridgeEvent } from 'aws-lambda';
import { AthenaClient } from '@aws-sdk/client-athena';
import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import { fetchSECSubmissions, extractForm4Filings } from '../../shared-utils/src/sec-client';
import { executeAthenaQuery, checkExistingAccessionNumbers } from '../../shared-utils/src/athena-client';

// Configuration
const ENABLE_SEC_SYNC = process.env.ENABLE_SEC_SYNC === 'true';
const COMPANY_CIKS_JSON = process.env.COMPANY_CIKS_JSON || '[]'; // JSON array de CIKs
const ATHENA_DATABASE = process.env.ATHENA_DATABASE || 'adel_ai_dev';
const ATHENA_WORK_GROUP = process.env.ATHENA_WORK_GROUP || 'adel-ai-dev-workgroup';
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET || 'adel-ai-dev-athena-results';
const FORM4_PARSER_QUEUE_URL = process.env.FORM4_PARSER_QUEUE_URL || '';

const athenaClient = new AthenaClient();
const sqsClient = new SQSClient();

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Récupérer la whitelist de CIKs depuis env var
 */
function getCompanyCIKs(): string[] {
  try {
    const ciks = JSON.parse(COMPANY_CIKS_JSON);
    if (!Array.isArray(ciks)) {
      throw new Error('COMPANY_CIKS_JSON must be a JSON array');
    }
    return ciks.filter((cik: any) => typeof cik === 'string' && cik.length > 0);
  } catch (error: any) {
    console.error('Error parsing COMPANY_CIKS_JSON:', error.message);
    return [];
  }
}

/**
 * Handler principal
 */
export const handler = async (event: EventBridgeEvent<string, any>) => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 SEC Form 4 DISCOVER - Démarrage');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Kill switch
  if (!ENABLE_SEC_SYNC) {
    console.log('⚠️  ENABLE_SEC_SYNC=false - Arrêt immédiat (kill switch)');
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        skipped: true,
        reason: 'ENABLE_SEC_SYNC=false',
      }),
    };
  }
  
  const startTime = Date.now();
  const metrics = {
    companiesScanned: 0,
    filingsFound: 0,
    newFilingsEnqueued: 0,
    errors: 0,
  };
  
  try {
    // 1. Récupérer la whitelist de CIKs
    const companyCIKs = getCompanyCIKs();
    console.log(`📋 Whitelist: ${companyCIKs.length} companies\n`);
    
    if (companyCIKs.length === 0) {
      console.log('⚠️  Aucun CIK dans la whitelist - Arrêt');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          skipped: true,
          reason: 'No CIKs in whitelist',
          metrics,
        }),
      };
    }
    
    // 2. Pour chaque CIK: récupérer les Form 4 récents
    const allFilings: Array<{
      companyCik: string;
      accessionNumber: string;
      filingDate: string;
      reportDate: string;
      primaryDocument: string;
    }> = [];
    
    const RATE_LIMIT_DELAY_MS = 120; // 120ms entre chaque CIK (rate limiting SEC)
    
    for (const cik of companyCIKs) {
      try {
        // ⚠️ Rate limiting: attendre 120ms entre chaque CIK
        await sleep(RATE_LIMIT_DELAY_MS);
        
        console.log(`  📋 Processing CIK: ${cik}...`);
        metrics.companiesScanned++;
        
        const submissions = await fetchSECSubmissions(cik);
        if (!submissions) {
          console.log(`    ⚠️  CIK non trouvé\n`);
          continue;
        }
        
        const form4Filings = extractForm4Filings(submissions, 20); // Max 20 par CIK
        console.log(`    ✅ Found ${form4Filings.length} Form 4 filings`);
        
        for (const filing of form4Filings) {
          allFilings.push({
            companyCik: cik,
            accessionNumber: filing.accessionNumber,
            filingDate: filing.filingDate,
            reportDate: filing.reportDate,
            primaryDocument: filing.primaryDocument,
          });
        }
        
        metrics.filingsFound += form4Filings.length;
      } catch (error: any) {
        console.error(`  ❌ Error processing CIK ${cik}:`, error.message);
        metrics.errors++;
      }
    }
    
    console.log(`\n📊 Total filings found: ${allFilings.length}\n`);
    
    if (allFilings.length === 0) {
      console.log('⚠️  Aucun Form 4 trouvé - Arrêt');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          metrics,
        }),
      };
    }
    
    // 3. Dédup en 1 SEULE requête Athena batch
    console.log('🔍 Déduplication (1 requête Athena batch)...\n');
    const accessionNumbers = allFilings.map(f => f.accessionNumber);
    const existingAccessions = await checkExistingAccessionNumbers(
      accessionNumbers,
      athenaClient,
      ATHENA_DATABASE,
      ATHENA_WORK_GROUP,
      ATHENA_RESULTS_BUCKET
    );
    
    console.log(`  ✅ Found ${existingAccessions.size} existing filings (out of ${accessionNumbers.length})`);
    
    // 4. Filtrer les nouveaux filings
    const newFilings = allFilings.filter(
      f => !existingAccessions.has(f.accessionNumber)
    );
    
    console.log(`\n📦 New filings to enqueue: ${newFilings.length}\n`);
    
    if (newFilings.length === 0) {
      console.log('⚠️  Aucun nouveau filing - Arrêt');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          metrics,
        }),
      };
    }
    
    // 5. Push dans SQS par batch (10 messages par batch)
    console.log('📤 Enqueueing filings to SQS (batch)...\n');
    const BATCH_SIZE = 10; // SQS SendMessageBatch max = 10 messages
    
    for (let i = 0; i < newFilings.length; i += BATCH_SIZE) {
      const batch = newFilings.slice(i, i + BATCH_SIZE);
      
      try {
        const entries = batch.map((filing, index) => ({
          Id: `${i + index}`, // ID unique dans le batch
          MessageBody: JSON.stringify({
            companyCik: filing.companyCik,
            accessionNumber: filing.accessionNumber,
            filingDate: filing.filingDate,
            reportDate: filing.reportDate,
            primaryDocument: filing.primaryDocument,
          }),
        }));
        
        const response = await sqsClient.send(new SendMessageBatchCommand({
          QueueUrl: FORM4_PARSER_QUEUE_URL,
          Entries: entries,
        }));
        
        // Compter les succès
        const successCount = response.Successful?.length || 0;
        metrics.newFilingsEnqueued += successCount;
        
        // Logger les échecs partiels
        if (response.Failed && response.Failed.length > 0) {
          console.warn(`  ⚠️  ${response.Failed.length} messages failed in batch ${Math.floor(i / BATCH_SIZE) + 1}`);
          for (const failure of response.Failed) {
            console.error(`    ❌ Failed: ${failure.Id} - ${failure.Code}: ${failure.Message}`);
            metrics.errors++;
          }
        }
      } catch (error: any) {
        console.error(`  ❌ Error enqueueing batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
        metrics.errors += batch.length;
      }
    }
    
    const duration = Date.now() - startTime;
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ DISCOVER terminé');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📊 Metrics:`);
    console.log(`   - Companies scanned: ${metrics.companiesScanned}`);
    console.log(`   - Filings found: ${metrics.filingsFound}`);
    console.log(`   - New filings enqueued: ${metrics.newFilingsEnqueued}`);
    console.log(`   - Errors: ${metrics.errors}`);
    console.log(`   - Duration: ${duration}ms\n`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        metrics,
        duration,
      }),
    };
  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
};
