/**
 * Script pour enrichir les entreprises en parallèle (multi-workers)
 * 
 * Ce script divise le travail en plusieurs "workers" qui traitent des plages de CIK différentes
 * 
 * Usage:
 *   npx tsx scripts/enrich_companies_from_sec_parallel.ts --workers=2 --worker-id=1
 * 
 * Exemple pour 2 terminaux:
 *   Terminal 1: npx tsx scripts/enrich_companies_from_sec_parallel.ts --workers=2 --worker-id=1
 *   Terminal 2: npx tsx scripts/enrich_companies_from_sec_parallel.ts --workers=2 --worker-id=2
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erreur: SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration API SEC
const SEC_BASE_URL = 'https://data.sec.gov/submissions';
const USER_AGENT = 'Souhail souhailsouidpro@gmail.com';
const RATE_LIMIT_MS = 200; // Pause entre chaque requête

// Interface pour les données SEC (copié depuis enrich_companies_from_sec.ts)
interface SECSubmission {
  cik: string;
  name: string;
  ein?: string;
  sic?: string;
  sicDescription?: string;
  fiscalYearEnd?: string;
  category?: string;
  exchanges?: string[];
  formerNames?: Array<{ name: string; from?: string; to?: string }>;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      reportDate?: string[];
      acceptanceDateTime?: string[];
      act?: string[];
      form?: string[];
      fileNumber?: string[];
      filmNumber?: string[];
      items?: string[];
      size?: string[];
      isXBRL?: string[];
      isInlineXBRL?: string[];
      primaryDocument?: string[];
      primaryDocDescription?: string[];
    };
    files?: Array<{
      name: string;
      filingCount?: number;
      filingFrom?: string;
      filingTo?: string;
    }>;
  };
}

function padCik(cik: string): string {
  const numericCik = cik.replace(/^0+/, '') || '0';
  return `CIK${numericCik.padStart(10, '0')}`;
}

function cleanCikForUrl(cik: string): string {
  return cik.replace(/^0+/, '') || '0';
}

function cleanAccessionNumber(accession: string): string {
  return accession.replace(/-/g, '');
}

function generateSecDocumentUrl(cik: string, accessionNumber: string, primaryDocument: string): string {
  const cleanCik = cleanCikForUrl(cik);
  const cleanAccession = cleanAccessionNumber(accessionNumber);
  return `https://www.sec.gov/Archives/edgar/data/${cleanCik}/${cleanAccession}/${primaryDocument}`;
}

async function fetchSecData(cik: string): Promise<SECSubmission | null> {
  try {
    const paddedCik = padCik(cik);
    const url = `${SEC_BASE_URL}/${paddedCik}.json`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`   ⚠️  CIK ${cik} non trouvé sur SEC EDGAR`);
        return null;
      }
      if (response.status === 429) {
        console.warn(`   ⚠️  Rate limit atteint, pause de 2 secondes...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchSecData(cik); // Retry
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: SECSubmission = await response.json();
    return data;
  } catch (error: any) {
    console.error(`   ❌ Erreur lors de la récupération des données SEC pour CIK ${cik}:`, error.message);
    return null;
  }
}

async function updateCompany(companyId: number, secData: SECSubmission, dryRun: boolean): Promise<boolean> {
  const updateData: any = {};

  if (secData.ein) updateData.ein = secData.ein;
  if (secData.sic) updateData.sic_code = secData.sic;
  if (secData.sicDescription) updateData.industry = secData.sicDescription;
  if (secData.fiscalYearEnd) updateData.fiscal_year_end = secData.fiscalYearEnd;
  if (secData.category) updateData.filer_category = secData.category;
  if (secData.exchanges && secData.exchanges.length > 0) {
    updateData.exchanges = secData.exchanges.join(', ');
  }
  if (secData.formerNames && secData.formerNames.length > 0) {
    updateData.former_names = JSON.stringify(secData.formerNames);
  }

  if (Object.keys(updateData).length === 0) {
    return false;
  }

  if (dryRun) {
    console.log(`   [DRY-RUN] Mise à jour:`, updateData);
    return true;
  }

  const { error } = await supabase
    .from('companies')
    .update(updateData)
    .eq('id', companyId);

  if (error) {
    console.error(`   ❌ Erreur lors de la mise à jour de l'entreprise:`, error.message);
    return false;
  }

  return true;
}

async function processFilings(
  companyId: number,
  cik: string,
  secData: SECSubmission,
  dryRun: boolean
): Promise<number> {
  if (!secData.filings?.recent) {
    return 0;
  }

  const recent = secData.filings.recent;
  const formTypes = recent.form || [];
  const accessionNumbers = recent.accessionNumber || [];
  const filingDates = recent.filingDate || [];
  const reportDates = recent.reportDate || [];
  const primaryDocuments = recent.primaryDocument || [];
  const items = recent.items || [];

  const targetFormTypes = ['8-K', '10-Q', '10-K', 'DEF 14A', '4'];

  let insertedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < formTypes.length; i++) {
    const formType = formTypes[i];
    
    if (!targetFormTypes.includes(formType)) {
      continue;
    }

    const accessionNumber = accessionNumbers[i];
    const filingDate = filingDates[i];
    const reportDate = reportDates[i];
    const primaryDocument = primaryDocuments[i] || '';

    if (!accessionNumber || !filingDate) {
      continue;
    }

    const documentUrl = primaryDocument 
      ? generateSecDocumentUrl(cik, accessionNumber, primaryDocument)
      : null;

    const filingData = {
      company_id: companyId,
      cik: cik,
      form_type: formType,
      accession_number: accessionNumber,
      filing_date: filingDate,
      period_of_report: reportDate || null,
      document_url: documentUrl,
      status: 'DISCOVERED' as const,
    };

    if (dryRun) {
      console.log(`   [DRY-RUN] Filing: ${formType} - ${accessionNumber} - ${filingDate}`);
      insertedCount++;
      continue;
    }

    const { data: existing } = await supabase
      .from('company_filings')
      .select('id')
      .eq('accession_number', accessionNumber)
      .maybeSingle();

    if (existing) {
      skippedCount++;
      continue;
    }

    const { error } = await supabase
      .from('company_filings')
      .insert(filingData);

    if (error) {
      console.error(`   ❌ Erreur lors de l'insertion du filing ${accessionNumber}:`, error.message);
      continue;
    }

    insertedCount++;
  }

  if (skippedCount > 0) {
    console.log(`   📋 ${insertedCount} nouveaux filings, ${skippedCount} déjà présents`);
  } else {
    console.log(`   📋 ${insertedCount} nouveaux filings`);
  }

  return insertedCount;
}

/**
 * Divise les entreprises en plages pour traitement parallèle
 */
function getCikRangeForWorker(totalCompanies: number, numWorkers: number, workerId: number): { start: number; end: number } {
  const companiesPerWorker = Math.ceil(totalCompanies / numWorkers);
  const start = (workerId - 1) * companiesPerWorker;
  const end = workerId === numWorkers ? totalCompanies : start + companiesPerWorker;
  return { start, end };
}

async function enrichCompaniesFromSecParallel() {
  // Parse arguments
  const args = process.argv.slice(2);
  const workersArg = args.find(arg => arg.startsWith('--workers='));
  const workerIdArg = args.find(arg => arg.startsWith('--worker-id='));
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const startFromArg = args.find(arg => arg.startsWith('--start-from='));
  const startFromCik = startFromArg ? startFromArg.split('=')[1] : null;

  const numWorkers = workersArg ? parseInt(workersArg.split('=')[1]) : 1;
  const workerId = workerIdArg ? parseInt(workerIdArg.split('=')[1]) : 1;
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

  if (numWorkers < 1 || workerId < 1 || workerId > numWorkers) {
    console.error('❌ Erreur: --workers et --worker-id doivent être valides (worker-id entre 1 et workers)');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Enrichissement des entreprises depuis SEC EDGAR (PARALLÈLE)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Configuration:`);
  console.log(`   - Workers: ${numWorkers}`);
  console.log(`   - Worker ID: ${workerId}/${numWorkers}`);
  console.log(`   - Limit: ${limit || 'Aucune'}`);
  console.log(`   - Dry Run: ${dryRun ? 'Oui' : 'Non'}`);
  console.log(`   - Force: ${force ? 'Oui' : 'Non'}`);
  console.log(`   - Start From: ${startFromCik || 'Début'}`);
  console.log(`   - Rate Limit: ${RATE_LIMIT_MS}ms entre chaque requête\n`);

  try {
    // Récupérer toutes les entreprises
    let query = supabase
      .from('companies')
      .select('id, ticker, name, cik, sic_code, industry')
      .order('cik', { ascending: true });

    if (startFromCik) {
      query = query.gte('cik', startFromCik);
    }

    const { data: companies, error } = await query;

    if (error) {
      console.error('❌ Erreur lors de la récupération des entreprises:', error.message);
      process.exit(1);
    }

    if (!companies || companies.length === 0) {
      console.log('❌ Aucune entreprise trouvée dans la base de données');
      process.exit(1);
    }

    const companiesToProcess = limit ? companies.slice(0, limit) : companies;
    
    // Filtrer les entreprises déjà enrichies
    let companiesToEnrich = companiesToProcess;
    let skippedAlreadyEnriched = 0;
    
    if (!dryRun && !force) {
      const enrichedCiks = new Set<string>();
      
      const { data: enrichedCompanies } = await supabase
        .from('companies')
        .select('cik')
        .not('ein', 'is', null);
      
      enrichedCompanies?.forEach(c => enrichedCiks.add(c.cik));
      
      const { data: companiesWithFilings } = await supabase
        .from('company_filings')
        .select('cik')
        .limit(50000);
      
      const filingCounts: Record<string, number> = {};
      companiesWithFilings?.forEach(f => {
        filingCounts[f.cik] = (filingCounts[f.cik] || 0) + 1;
      });
      
      Object.entries(filingCounts).forEach(([cik, count]) => {
        if (count >= 10) {
          enrichedCiks.add(cik);
        }
      });
      
      companiesToEnrich = companiesToProcess.filter(c => !enrichedCiks.has(c.cik));
      skippedAlreadyEnriched = companiesToProcess.length - companiesToEnrich.length;
      
      if (skippedAlreadyEnriched > 0) {
        console.log(`⏭️  ${skippedAlreadyEnriched} entreprises déjà enrichies seront ignorées\n`);
      }
    }

    // Diviser le travail entre les workers
    const { start, end } = getCikRangeForWorker(companiesToEnrich.length, numWorkers, workerId);
    const workerCompanies = companiesToEnrich.slice(start, end);
    
    console.log(`📋 Worker ${workerId}/${numWorkers}: ${workerCompanies.length} entreprises à traiter`);
    console.log(`   Plage: ${start + 1} à ${end} (sur ${companiesToEnrich.length} total)\n`);

    let processedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;
    let filingsCount = 0;
    let errorCount = 0;

    // ✅ OPTIMISATION: Batch queries pour éviter N requêtes Supabase
    // Au lieu de 2 requêtes par company (5400 requêtes pour 2700 companies),
    // on fait 2 requêtes batch totales (99.96% de réduction)
    let existingCompaniesMap: Map<string, { ein: string | null }> = new Map();
    let filingsCountMap: Map<string, number> = new Map();

    if (!dryRun && !force && workerCompanies.length > 0) {
      console.log(`\n🔍 Batch lookup pour ${workerCompanies.length} companies (optimisation coût)...\n`);
      
      // 1. Batch query pour toutes les companies (1 requête au lieu de N)
      const ciks = workerCompanies.map(c => c.cik);
      const { data: existingCompanies } = await supabase
        .from('companies')
        .select('cik, ein')
        .in('cik', ciks);
      
      if (existingCompanies) {
        for (const comp of existingCompanies) {
          existingCompaniesMap.set(comp.cik, { ein: comp.ein });
        }
      }
      console.log(`   ✅ Found ${existingCompaniesMap.size} companies avec EIN (out of ${ciks.length})`);
      
      // 2. Batch query pour compter les filings (1 requête au lieu de N)
      const { data: filingsData } = await supabase
        .from('company_filings')
        .select('cik')
        .in('cik', ciks);
      
      if (filingsData) {
        for (const filing of filingsData) {
          filingsCountMap.set(filing.cik, (filingsCountMap.get(filing.cik) || 0) + 1);
        }
      }
      console.log(`   ✅ Found filings counts for ${filingsCountMap.size} companies\n`);
    }

    for (const company of workerCompanies) {
      processedCount++;
      console.log(`\n[Worker ${workerId}] [${processedCount}/${workerCompanies.length}] ${company.ticker} - ${company.name}`);
      console.log(`   CIK: ${company.cik}`);

      if (!dryRun && !force) {
        // Utiliser les maps au lieu de requêtes Supabase
        const existingCompany = existingCompaniesMap.get(company.cik);
        const filingsCountForCompany = filingsCountMap.get(company.cik) || 0;
        
        if (existingCompany?.ein || filingsCountForCompany >= 10) {
          console.log(`   ⏭️  Déjà enrichie (EIN: ${existingCompany?.ein ? 'oui' : 'non'}, Filings: ${filingsCountForCompany}), skip`);
          skippedCount++;
          continue;
        }
      }

      const secData = await fetchSecData(company.cik);
      
      if (!secData) {
        errorCount++;
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
        continue;
      }

      const wasUpdated = await updateCompany(company.id, secData, dryRun);
      if (wasUpdated) {
        updatedCount++;
        console.log(`   ✅ Entreprise mise à jour`);
      }

      const filingsInserted = await processFilings(company.id, company.cik, secData, dryRun);
      filingsCount += filingsInserted;

      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
    }

    // Résumé
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log(`📊 RÉSUMÉ (Worker ${workerId}/${numWorkers})`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Entreprises traitées: ${processedCount}`);
    if (skippedAlreadyEnriched > 0 || skippedCount > 0) {
      console.log(`⏭️  Entreprises ignorées (déjà enrichies): ${skippedAlreadyEnriched + skippedCount}`);
    }
    console.log(`📝 Entreprises mises à jour: ${updatedCount}`);
    console.log(`📋 Filings insérés: ${filingsCount}`);
    console.log(`❌ Erreurs: ${errorCount}`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('\n❌ Erreur fatale:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

enrichCompaniesFromSecParallel().catch(console.error);
