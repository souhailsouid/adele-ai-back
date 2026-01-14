/**
 * Lambda pour synchroniser les données SEC Smart Money
 * 
 * Déclenché par SQS (via EventBridge cron: quotidien à 9h UTC)
 * 
 * Synchronise :
 * - Form 4 des top companies (insider transactions)
 */

import { SQSEvent } from "aws-lambda";
import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from "@aws-sdk/client-athena";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// Configuration
const ATHENA_DATABASE = process.env.ATHENA_DATABASE || "adel_ai_dev";
const ATHENA_WORK_GROUP = process.env.ATHENA_WORK_GROUP || "adel-ai-dev-workgroup";
const ATHENA_RESULTS_BUCKET = process.env.ATHENA_RESULTS_BUCKET || "adel-ai-dev-athena-results";
const S3_DATA_LAKE_BUCKET = process.env.S3_DATA_LAKE_BUCKET || "adel-ai-dev-data-lake";

// AWS_REGION est automatiquement défini par Lambda, pas besoin de le passer
const athenaClient = new AthenaClient();
const s3Client = new S3Client();
const sqsClient = new SQSClient();

const FORM4_PARSER_QUEUE_URL = process.env.FORM4_PARSER_QUEUE_URL || "";

const SEC_EDGAR_BASE_URL = 'https://www.sec.gov';
const SEC_SUBMISSIONS_API_BASE_URL = 'https://data.sec.gov/submissions';
const USER_AGENT = 'ADEL AI (contact@adel.ai)';
const RATE_LIMIT_DELAY = 100; // 100ms entre requêtes = 10 req/s

export const handler = async (event: SQSEvent) => {
  console.log("SEC Smart Money Sync triggered via SQS");
  console.log(`Received ${event.Records.length} message(s) from SQS`);

  const errors: Array<{ messageId: string; error: any }> = [];

  for (const record of event.Records) {
    try {
      // Parser le body pour déterminer le mode
      let mode = "insiders-only"; // Mode par défaut
      if (record.body) {
        try {
          const messageBody = JSON.parse(record.body);
          mode = messageBody.mode || "insiders-only";
        } catch (e) {
          // Si le body n'est pas du JSON, utiliser le mode par défaut
          console.log("SQS message body is not JSON, using default mode: insiders-only");
        }
      }

      console.log("Processing SQS message:", {
        messageId: record.messageId,
        mode: mode,
      });

      // Exécuter la synchronisation selon le mode
      if (mode === "track-insiders") {
        await syncInsiderCrossCompany();
      } else {
        await syncInsiderTransactions();
      }

    } catch (error: any) {
      console.error(`Error processing SQS message ${record.messageId}:`, error);
      errors.push({ messageId: record.messageId, error });
    }
  }

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
 * Exécuter une requête Athena
 */
async function executeAthenaQuery(query: string): Promise<any[]> {
  const startCommand = new StartQueryExecutionCommand({
    QueryString: query,
    QueryExecutionContext: {
      Database: ATHENA_DATABASE,
    },
    WorkGroup: ATHENA_WORK_GROUP,
    ResultConfiguration: {
      OutputLocation: `s3://${ATHENA_RESULTS_BUCKET}/queries/`,
    },
  });

  const startResponse = await athenaClient.send(startCommand);
  const queryExecutionId = startResponse.QueryExecutionId;

  if (!queryExecutionId) {
    throw new Error('Failed to start Athena query');
  }

  // Attendre la fin de l'exécution
  let status = 'RUNNING';
  let attempts = 0;
  const maxAttempts = 60;

  while (status === 'RUNNING' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const statusCommand = new GetQueryExecutionCommand({
      QueryExecutionId: queryExecutionId,
    });

    const statusResponse = await athenaClient.send(statusCommand);
    status = statusResponse.QueryExecution?.Status?.State || 'FAILED';

    if (status === 'FAILED') {
      const reason = statusResponse.QueryExecution?.Status?.StateChangeReason || 'Unknown error';
      throw new Error(`Athena query failed: ${reason}`);
    }

    attempts++;
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Athena query did not complete: ${status}`);
  }

  // Récupérer les résultats
  const results: any[] = [];
  let nextToken: string | undefined;

  do {
    const resultsCommand = new GetQueryResultsCommand({
      QueryExecutionId: queryExecutionId,
      NextToken: nextToken,
      MaxResults: 1000,
    });

    const resultsResponse = await athenaClient.send(resultsCommand);
    const rows = resultsResponse.ResultSet?.Rows || [];

    if (rows.length > 0) {
      // Skip header row
      const dataRows = rows.slice(1);
      for (const row of dataRows) {
        const values = row.Data?.map((d: any) => d.VarCharValue || null) || [];
        results.push(values);
      }
    }

    nextToken = resultsResponse.NextToken;
  } while (nextToken);

  return results;
}

/**
 * Récupérer les top companies depuis Athena
 */
async function getCompaniesAthena(limit: number = 100, offset: number = 0): Promise<any[]> {
  let query: string;
  
  if (offset === 0) {
    query = `
      SELECT 
        id,
        ticker,
        cik,
        name,
        sector,
        industry,
        market_cap
      FROM companies
      WHERE cik IS NOT NULL
        AND cik != ''
      ORDER BY market_cap DESC NULLS LAST
      LIMIT ${limit}
    `;
  } else {
    // Athena ne supporte pas OFFSET directement, utiliser ROW_NUMBER()
    query = `
      SELECT * FROM (
        SELECT 
          id,
          ticker,
          cik,
          name,
          sector,
          industry,
          market_cap,
          ROW_NUMBER() OVER (ORDER BY market_cap DESC NULLS LAST) as rn
        FROM companies
        WHERE cik IS NOT NULL
          AND cik != ''
      ) WHERE rn > ${offset} AND rn <= ${offset + limit}
    `;
  }

  const results = await executeAthenaQuery(query);
  
  return results.map((row: any[]) => ({
    id: parseInt(row[0], 10),
    ticker: row[1],
    cik: row[2],
    name: row[3],
    sector: row[4],
    industry: row[5],
    market_cap: row[6] ? parseInt(row[6], 10) : null,
  }));
}

/**
 * Insérer une ligne dans S3 (simplifié - utilise Parquet via write service)
 * Note: Pour une vraie implémentation, il faudrait utiliser le service write.ts
 * Pour l'instant, on va juste logger et laisser le script principal gérer l'écriture
 */
async function insertRowS3(tableName: string, data: any): Promise<{ id: number }> {
  // Générer un ID simple (timestamp + random)
  const id = Date.now() + Math.floor(Math.random() * 1000);
  
  console.log(`[S3 Write] Would insert into ${tableName}:`, data);
  
  // TODO: Implémenter l'écriture réelle vers S3 Parquet
  // Pour l'instant, on retourne juste un ID
  // L'écriture réelle devrait utiliser le service write.ts
  
  return { id };
}

/**
 * Synchroniser les Form 4 des top companies
 * 
 * Utilise le delta processing : compare les accessionNumber au lieu de filtrer par date
 * Gère le cas du lundi (pas de nouveaux dépôts depuis vendredi)
 */
async function syncInsiderTransactions(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('👥 SYNCHRONISATION FORM 4 (Insider Transactions)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Récupérer les top 100 companies
  const companies = await getCompaniesAthena(100, 0);
  console.log(`Found ${companies.length} companies to sync\n`);

  let totalNewFilings = 0;

  for (const company of companies) {
    try {
      if (!company.cik) {
        console.log(`  ⚠️  Skipping ${company.name || company.ticker} (no CIK)`);
        continue;
      }

      console.log(`  📋 Processing ${company.name || company.ticker} (CIK: ${company.cik})...`);

      // Récupérer la dernière date de modification depuis la base (si disponible)
      // Pour l'instant, on ne l'utilise pas, mais on pourrait l'implémenter plus tard
      const lastModified = await getLastModifiedDate(company.cik);

      // Découvrir les nouveaux Form 4 (delta processing)
      const newFilings = await discoverNewForm4Filings(company.cik, lastModified);
      
      if (newFilings.length === 0) {
        console.log(`    No new Form 4 filings\n`);
        continue;
      }

      console.log(`    Found ${newFilings.length} new Form 4 filings`);

      // Traiter chaque filing
      for (const filing of newFilings) {
        await processForm4Filing(company.id, company.cik, filing);
        await sleep(RATE_LIMIT_DELAY);
      }

      totalNewFilings += newFilings.length;
      console.log(`  ✅ Completed ${company.name || company.ticker} (${newFilings.length} new filings)\n`);
      await sleep(RATE_LIMIT_DELAY);
    } catch (error: any) {
      console.error(`  ❌ Error processing ${company.name || company.ticker}:`, error.message);
    }
  }

  console.log(`\n📊 Total: ${totalNewFilings} new Form 4 filings discovered across ${companies.length} companies`);
}

/**
 * Découvrir les nouveaux Form 4 pour un CIK
 * 
 * Utilise le delta processing : compare les accessionNumber au lieu de filtrer par date
 * Optimisé avec If-Modified-Since pour éviter les requêtes inutiles
 */
async function discoverNewForm4Filings(cik: string, lastModified?: string): Promise<any[]> {
  const cikPadded = cik.padStart(10, '0');
  const submissionsApiUrl = `${SEC_SUBMISSIONS_API_BASE_URL}/CIK${cikPadded}.json`;
  
  await sleep(RATE_LIMIT_DELAY);
  
  try {
    // Construire les headers avec If-Modified-Since si disponible
    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
    };
    
    if (lastModified) {
      headers['If-Modified-Since'] = lastModified;
    }

    const response = await fetch(submissionsApiUrl, { headers });

    // 304 Not Modified : pas de changements depuis la dernière requête
    if (response.status === 304) {
      console.log(`    No changes since last check (304 Not Modified)`);
      return [];
    }

    if (!response.ok) {
      throw new Error(`SEC Submissions API error: ${response.status}`);
    }

    const data = await response.json();
    const form4Filings = data.filings?.recent?.form
      ?.map((formType: string, index: number) => {
        if (formType === '4') {
          return {
            formType: formType,
            accessionNumber: data.filings.recent.accessionNumber[index],
            filingDate: data.filings.recent.filingDate[index],
            reportDate: data.filings.recent.reportDate[index],
            primaryDocument: data.filings.recent.primaryDocument[index],
          };
        }
        return null;
      })
      .filter(Boolean) || [];

    if (form4Filings.length === 0) {
      return [];
    }

    // Delta Processing : Comparer les accessionNumber avec ceux déjà en base
    // Ne pas filtrer par date (gère le cas du lundi où il n'y a pas eu de dépôts depuis vendredi)
    const accessionNumbers = form4Filings.map((f: any) => f.accessionNumber);
    
    if (accessionNumbers.length === 0) {
      return [];
    }

    // Vérifier quels filings sont nouveaux (delta processing)
    const accessionList = accessionNumbers.map((a: string) => `'${a.replace(/'/g, "''")}'`).join(', ');
    const query = `
      SELECT DISTINCT accession_number
      FROM company_filings
      WHERE accession_number IN (${accessionList})
        AND form_type = '4'
    `;

    try {
      const existing = await executeAthenaQuery(query);
      const existingSet = new Set(
        existing.map((row: any[]) => row[0]).filter(Boolean)
      );
      
      // Retourner uniquement les nouveaux (delta)
      const newFilings = form4Filings.filter((f: any) => !existingSet.has(f.accessionNumber));
      
      if (newFilings.length > 0) {
        console.log(`    Found ${newFilings.length} new Form 4 filings (out of ${form4Filings.length} total)`);
      }
      
      return newFilings;
    } catch (error: any) {
      console.warn(`[Form4 Discovery] Could not check existing filings: ${error.message}`);
      // En cas d'erreur, retourner tous les filings (sécurité)
      return form4Filings;
    }
  } catch (error: any) {
    console.error(`[Form4 Discovery] Error: ${error.message}`);
    return [];
  }
}

/**
 * Traiter un Form 4 filing
 * Crée le filing et publie un message SQS pour le parsing avec rate limiting
 */
async function processForm4Filing(companyId: number, cik: string, filing: any): Promise<void> {
  // Vérifier si le filing existe déjà
  let filingId: number | null = null;
  try {
    const checkQuery = `
      SELECT id, status
      FROM company_filings
      WHERE accession_number = '${filing.accessionNumber.replace(/'/g, "''")}'
        AND form_type = '4'
      LIMIT 1
    `;
    const existing = await executeAthenaQuery(checkQuery);
    
    if (existing && existing.length > 0) {
      filingId = parseInt(existing[0][0], 10);
      const status = existing[0][1];
      if (status === 'PARSED') {
        console.log(`    Skipping ${filing.accessionNumber} (already parsed)`);
        return;
      }
    }
  } catch (error: any) {
    console.warn(`[Form4] Could not check existing filing: ${error.message}`);
  }

  // Créer le filing si nécessaire
  if (!filingId) {
    const filingData = {
      company_id: companyId,
      cik: cik,
      form_type: '4',
      accession_number: filing.accessionNumber,
      filing_date: filing.filingDate,
      document_url: '',
      status: 'DISCOVERED',
    };

    const result = await insertRowS3('company_filings', filingData);
    filingId = result.id;
    console.log(`    ✅ Created filing ${filing.accessionNumber}`);
  }

  // Publier dans SQS pour le parsing avec rate limiting
  if (FORM4_PARSER_QUEUE_URL) {
    try {
      // Calculer un delay progressif pour espacer les messages (rate limiting)
      // Chaque message aura un delay de 100ms * index pour respecter 10 req/s
      const messageIndex = Math.floor(Math.random() * 100); // Simuler un index
      const delaySeconds = Math.min(Math.floor(messageIndex * 0.1), 900); // Max 15 min

      await sqsClient.send(new SendMessageCommand({
        QueueUrl: FORM4_PARSER_QUEUE_URL,
        MessageBody: JSON.stringify({
          companyId: companyId,
          filingId: filingId,
          accessionNumber: filing.accessionNumber,
          cik: cik,
          primaryDocument: filing.primaryDocument,
        }),
        DelaySeconds: delaySeconds, // Espacer les messages pour rate limiting
      }));

      console.log(`    📤 Published to parsing queue: ${filing.accessionNumber}`);
    } catch (error: any) {
      console.error(`    ❌ Error publishing to queue:`, error.message);
      // Ne pas faire échouer le processus si la publication échoue
    }
  } else {
    console.warn(`    ⚠️  FORM4_PARSER_QUEUE_URL not set, skipping queue publication`);
  }
}

/**
 * Synchroniser les transactions cross-company des dirigeants
 * 
 * Récupère tous les CIK de dirigeants uniques et suit leurs transactions
 * dans toutes les entreprises où ils sont actifs (Form 3, 4, 5)
 */
async function syncInsiderCrossCompany(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔗 SYNCHRONISATION CROSS-COMPANY (Insider Tracking)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Récupérer tous les CIK de dirigeants uniques depuis insider_trades
  const query = `
    SELECT DISTINCT insider_cik
    FROM insider_trades
    WHERE insider_cik IS NOT NULL
      AND insider_cik != ''
    ORDER BY insider_cik
    LIMIT 100  -- Limiter pour éviter trop de requêtes
  `;

  try {
    const results = await executeAthenaQuery(query);
    const insiderCiks = results
      .map((row: any[]) => row[0])
      .filter(Boolean);

    console.log(`Found ${insiderCiks.length} unique insiders to track\n`);

    for (const insiderCik of insiderCiks) {
      try {
        console.log(`Tracking insider CIK: ${insiderCik}...`);
        
        // Récupérer tous les filings de ce dirigeant
        const filings = await discoverInsiderFilings(insiderCik);
        
        if (filings.length === 0) {
          console.log(`  No new filings found\n`);
          continue;
        }

        console.log(`  Found ${filings.length} filings (Form 3/4/5)`);

        // Traiter chaque filing
        for (const filing of filings) {
          await processInsiderFiling(insiderCik, filing);
          await sleep(RATE_LIMIT_DELAY);
        }

        console.log(`  ✅ Completed tracking for CIK ${insiderCik}\n`);
        await sleep(RATE_LIMIT_DELAY);
      } catch (error: any) {
        console.error(`  ❌ Error tracking CIK ${insiderCik}:`, error.message);
      }
    }
  } catch (error: any) {
    console.error(`[Cross-Company] Error fetching insider CIKs:`, error.message);
  }
}

/**
 * Découvrir tous les filings d'un dirigeant (Form 3, 4, 5)
 */
async function discoverInsiderFilings(insiderCik: string): Promise<any[]> {
  const cikPadded = insiderCik.padStart(10, '0');
  const submissionsUrl = `${SEC_SUBMISSIONS_API_BASE_URL}/CIK${cikPadded}.json`;

  await sleep(RATE_LIMIT_DELAY);

  try {
    const response = await fetch(submissionsUrl, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`SEC submissions API error: ${response.status}`);
    }

    const data = await response.json();
    const formTypes = data.filings?.recent?.form || [];
    const accessionNumbers = data.filings?.recent?.accessionNumber || [];
    const filingDates = data.filings?.recent?.filingDate || [];
    const primaryDocuments = data.filings?.recent?.primaryDocument || [];
    
    const insiderFilings: any[] = [];
    for (let i = 0; i < formTypes.length; i++) {
      const formType = formTypes[i];
      if (formType === '3' || formType === '4' || formType === '5') {
        insiderFilings.push({
          formType: formType,
          accessionNumber: accessionNumbers[i],
          filingDate: filingDates[i],
          primaryDocument: primaryDocuments[i],
        });
      }
    }

    return insiderFilings.slice(0, 20); // Limiter aux 20 plus récents
  } catch (error: any) {
    console.error(`[Insider Discovery] Error: ${error.message}`);
    return [];
  }
}

/**
 * Traiter un filing d'un dirigeant
 */
async function processInsiderFiling(insiderCik: string, filing: any): Promise<void> {
  // Extraire le CIK de l'entreprise depuis l'accession number
  const companyCikMatch = filing.accessionNumber.match(/^(\d{10})-/);
  const companyCik = companyCikMatch ? companyCikMatch[1] : null;

  if (!companyCik) {
    console.warn(`    Could not extract company CIK from ${filing.accessionNumber}`);
    return;
  }

  // Chercher l'entreprise par CIK
  let companyId: number | null = null;
  try {
    const companyQuery = `
      SELECT id
      FROM companies
      WHERE cik = '${companyCik}'
      LIMIT 1
    `;
    const companies = await executeAthenaQuery(companyQuery);
    if (companies && companies.length > 0) {
      companyId = parseInt(companies[0][0], 10);
    }
  } catch (error: any) {
    console.warn(`[Insider Filing] Could not find company for CIK ${companyCik}:`, error.message);
  }

  if (!companyId) {
    console.log(`    Skipping ${filing.accessionNumber} (company CIK ${companyCik} not in database)`);
    return;
  }

  // Vérifier si le filing existe déjà
  let filingId: number | null = null;
  try {
    const checkQuery = `
      SELECT id, status
      FROM company_filings
      WHERE accession_number = '${filing.accessionNumber.replace(/'/g, "''")}'
        AND form_type = '${filing.formType}'
      LIMIT 1
    `;
    const existing = await executeAthenaQuery(checkQuery);
    
    if (existing && existing.length > 0) {
      filingId = parseInt(existing[0][0], 10);
      const status = existing[0][1];
      if (status === 'PARSED') {
        console.log(`    Skipping ${filing.accessionNumber} (already parsed)`);
        return;
      }
    }
  } catch (error: any) {
    console.warn(`[Insider Filing] Could not check existing filing: ${error.message}`);
  }

  // Créer le filing si nécessaire
  if (!filingId) {
    const filingData = {
      company_id: companyId,
      cik: companyCik,
      form_type: filing.formType,
      accession_number: filing.accessionNumber,
      filing_date: filing.filingDate,
      document_url: '',
      status: 'DISCOVERED',
    };

    const result = await insertRowS3('company_filings', filingData);
    filingId = result.id;
  }

  // Parser le Form 4 uniquement (Form 3 et 5 nécessitent des parsers différents)
  if (filing.formType === '4' && FORM4_PARSER_QUEUE_URL) {
    try {
      await sqsClient.send(new SendMessageCommand({
        QueueUrl: FORM4_PARSER_QUEUE_URL,
        MessageBody: JSON.stringify({
          companyId: companyId,
          filingId: filingId,
          accessionNumber: filing.accessionNumber,
          cik: companyCik,
          primaryDocument: filing.primaryDocument,
        }),
        DelaySeconds: 0,
      }));
      console.log(`    📤 Published Form 4 to parsing queue: ${filing.accessionNumber}`);
    } catch (error: any) {
      console.error(`    ❌ Error publishing to queue:`, error.message);
    }
  } else {
    console.log(`    ⚠️  Form ${filing.formType} parsing not yet implemented`);
  }
}

/**
 * Récupérer la dernière date de modification pour un CIK
 * (pour utiliser If-Modified-Since dans les requêtes futures)
 */
async function getLastModifiedDate(cik: string): Promise<string | undefined> {
  try {
    // Récupérer la date du dernier filing parsé pour ce CIK
    const query = `
      SELECT MAX(filing_date) as last_filing_date
      FROM company_filings
      WHERE cik = '${cik.replace(/'/g, "''")}'
        AND form_type = '4'
        AND status = 'PARSED'
    `;
    
    const results = await executeAthenaQuery(query);
    if (results && results.length > 0 && results[0][0]) {
      // Convertir la date en format HTTP If-Modified-Since
      const lastDate = new Date(results[0][0]);
      return lastDate.toUTCString();
    }
  } catch (error: any) {
    // Ignorer les erreurs, on continue sans If-Modified-Since
    console.warn(`[LastModified] Could not get last modified date: ${error.message}`);
  }
  
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
