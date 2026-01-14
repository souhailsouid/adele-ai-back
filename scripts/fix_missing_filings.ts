/**
 * Script pour corriger les filings manquants pour les entreprises enrichies
 * 
 * Ce script :
 * 1. Identifie les entreprises enrichies sans filings
 * 2. Vérifie si elles ont des filings disponibles dans l'API SEC
 * 3. Insère les filings manquants
 * 
 * Usage:
 *   npx tsx scripts/fix_missing_filings.ts [--limit=10] [--dry-run]
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

const SEC_BASE_URL = 'https://data.sec.gov/submissions';
const USER_AGENT = 'Souhail souhailsouidpro@gmail.com';
const RATE_LIMIT_MS = 200;

interface SECSubmission {
  filings?: {
    recent?: {
      form?: string[];
      filingDate?: string[];
      reportDate?: string[];
      accessionNumber?: string[];
      primaryDocument?: string[];
    };
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
        return null;
      }
      if (response.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchSecData(cik);
      }
      return null;
    }

    return await response.json();
  } catch (error: any) {
    return null;
  }
}

async function processFilings(
  companyId: number,
  cik: string,
  secData: SECSubmission,
  dryRun: boolean
): Promise<{ inserted: number; skipped: number }> {
  if (!secData.filings?.recent) {
    return { inserted: 0, skipped: 0 };
  }

  const recent = secData.filings.recent;
  const formTypes = recent.form || [];
  const accessionNumbers = recent.accessionNumber || [];
  const filingDates = recent.filingDate || [];
  const reportDates = recent.reportDate || [];
  const primaryDocuments = recent.primaryDocument || [];

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
      insertedCount++;
      continue;
    }

    // Vérifier si le filing existe déjà
    const { data: existing } = await supabase
      .from('company_filings')
      .select('id')
      .eq('accession_number', accessionNumber)
      .maybeSingle();

    if (existing) {
      skippedCount++;
      continue;
    }

    // Insérer le nouveau filing
    const { error } = await supabase
      .from('company_filings')
      .insert(filingData);

    if (error) {
      console.error(`   ❌ Erreur lors de l'insertion du filing ${accessionNumber}:`, error.message);
      continue;
    }

    insertedCount++;
  }

  return { inserted: insertedCount, skipped: skippedCount };
}

async function fixMissingFilings() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
  const dryRun = args.includes('--dry-run');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔧 Correction des filings manquants');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Configuration:`);
  console.log(`   - Limit: ${limit || 'Aucune'}`);
  console.log(`   - Dry Run: ${dryRun ? 'Oui' : 'Non'}`);
  console.log(`   - Rate Limit: ${RATE_LIMIT_MS}ms entre chaque requête\n`);

  try {
    // 1. Récupérer les entreprises enrichies
    const { data: enrichedCompanies } = await supabase
      .from('companies')
      .select('id, ticker, name, cik, ein')
      .not('ein', 'is', null)
      .order('cik', { ascending: true });

    if (!enrichedCompanies || enrichedCompanies.length === 0) {
      console.log('❌ Aucune entreprise enrichie trouvée');
      return;
    }

    // 2. Récupérer les entreprises qui ont déjà des filings
    const { data: companiesWithFilings } = await supabase
      .from('company_filings')
      .select('cik')
      .limit(100000);

    const ciksWithFilings = new Set(companiesWithFilings?.map(f => f.cik) || []);

    // 3. Identifier les entreprises enrichies sans filings
    const companiesWithoutFilings = enrichedCompanies.filter(c => !ciksWithFilings.has(c.cik));
    const companiesToProcess = limit ? companiesWithoutFilings.slice(0, limit) : companiesWithoutFilings;

    console.log(`📋 ${companiesToProcess.length} entreprises à traiter (sur ${companiesWithoutFilings.length} sans filings)\n`);

    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let totalFilingsInserted = 0;
    let totalFilingsSkipped = 0;

    for (const company of companiesToProcess) {
      processedCount++;
      console.log(`\n[${processedCount}/${companiesToProcess.length}] ${company.ticker} - ${company.name}`);
      console.log(`   CIK: ${company.cik}`);

      const secData = await fetchSecData(company.cik);
      
      if (!secData) {
        console.log(`   ❌ Données SEC non disponibles`);
        errorCount++;
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
        continue;
      }

      if (!secData.filings?.recent) {
        console.log(`   ⚠️  Aucun filing récent`);
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
        continue;
      }

      const { inserted, skipped } = await processFilings(company.id, company.cik, secData, dryRun);
      totalFilingsInserted += inserted;
      totalFilingsSkipped += skipped;

      if (inserted > 0) {
        successCount++;
        console.log(`   ✅ ${inserted} filings insérés, ${skipped} déjà présents`);
      } else if (skipped > 0) {
        console.log(`   ⏭️  ${skipped} filings déjà présents`);
      } else {
        console.log(`   ⚠️  Aucun filing des types ciblés`);
      }

      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
    }

    // Résumé
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Entreprises traitées: ${processedCount}`);
    console.log(`✅ Entreprises avec filings insérés: ${successCount}`);
    console.log(`❌ Erreurs: ${errorCount}`);
    console.log(`📋 Filings insérés: ${totalFilingsInserted}`);
    console.log(`📋 Filings ignorés (déjà présents): ${totalFilingsSkipped}`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('\n❌ Erreur fatale:', error.message);
    console.error(error.stack);
  }
}

fixMissingFilings().catch(console.error);
