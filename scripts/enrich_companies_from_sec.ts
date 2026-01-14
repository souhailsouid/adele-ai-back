/**
 * Script pour enrichir les entreprises depuis l'API SEC EDGAR
 * 
 * Ce script :
 * 1. Parcourt toutes les entreprises de la base de données
 * 2. Utilise l'API SEC EDGAR pour récupérer les métadonnées
 * 3. Met à jour les entreprises avec les informations enrichies
 * 4. Extrait et stocke les filings (8-K, 10-Q, 10-K, DEF 14A, Form 4)
 * 
 * Usage:
 *   npx tsx scripts/enrich_companies_from_sec.ts [--limit=100] [--dry-run] [--start-from=cik]
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

// Parser manuellement le fichier .env si dotenv n'a pas fonctionné
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
const USER_AGENT = 'Souhail souhailsouidpro@gmail.com'; // À adapter avec votre email
const RATE_LIMIT_MS = 200; // Pause entre chaque requête

// Interface pour les données SEC
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

/**
 * Nettoie le CIK pour l'URL (enlève les zéros au début)
 */
function cleanCikForUrl(cik: string): string {
  return cik.replace(/^0+/, '') || '0';
}

/**
 * Nettoie l'accession number (enlève les tirets)
 */
function cleanAccessionNumber(accession: string): string {
  return accession.replace(/-/g, '');
}

/**
 * Génère l'URL d'accès directe pour un document SEC
 */
function generateSecDocumentUrl(cik: string, accessionNumber: string, primaryDocument: string): string {
  const cleanCik = cleanCikForUrl(cik);
  const cleanAccession = cleanAccessionNumber(accessionNumber);
  return `https://www.sec.gov/Archives/edgar/data/${cleanCik}/${cleanAccession}/${primaryDocument}`;
}

/**
 * Pad le CIK avec des zéros pour l'URL de l'API (format: CIK0000000000)
 */
function padCik(cik: string): string {
  const numericCik = cik.replace(/^0+/, '') || '0';
  return `CIK${numericCik.padStart(10, '0')}`;
}

/**
 * Récupère les données d'une entreprise depuis l'API SEC
 */
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

/**
 * Met à jour une entreprise avec les données enrichies
 */
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
    return false; // Aucune donnée à mettre à jour
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

/**
 * Extrait et stocke les filings depuis les données SEC
 */
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

  // Types de filings à traiter
  const targetFormTypes = ['8-K', '10-Q', '10-K', 'DEF 14A', '4'];

  // Étape 1: Préparer tous les filings à insérer
  const filingsToInsert: any[] = [];
  const accessionNumbersToCheck: string[] = [];

  for (let i = 0; i < formTypes.length; i++) {
    const formType = formTypes[i];
    
    if (!targetFormTypes.includes(formType)) {
      continue; // Ignorer les autres types de filings
    }

    const accessionNumber = accessionNumbers[i];
    const filingDate = filingDates[i];
    const reportDate = reportDates[i];
    const primaryDocument = primaryDocuments[i] || '';

    if (!accessionNumber || !filingDate) {
      continue; // Données incomplètes
    }

    accessionNumbersToCheck.push(accessionNumber);

    // Générer l'URL du document
    const documentUrl = primaryDocument 
      ? generateSecDocumentUrl(cik, accessionNumber, primaryDocument)
      : null;

    filingsToInsert.push({
      company_id: companyId,
      cik: cik,
      form_type: formType,
      accession_number: accessionNumber,
      filing_date: filingDate,
      period_of_report: reportDate || null,
      document_url: documentUrl,
      status: 'DISCOVERED' as const,
    });
  }

  if (filingsToInsert.length === 0) {
    return 0;
  }

  if (dryRun) {
    console.log(`   [DRY-RUN] ${filingsToInsert.length} filings à insérer`);
    return filingsToInsert.length;
  }

  // Étape 2: Vérifier en batch quels filings existent déjà
  const { data: existingFilings } = await supabase
    .from('company_filings')
    .select('accession_number')
    .in('accession_number', accessionNumbersToCheck);

  const existingAccessionNumbers = new Set(
    existingFilings?.map(f => f.accession_number) || []
  );

  // Étape 3: Filtrer les filings qui n'existent pas encore
  // Également supprimer les doublons dans le batch lui-même
  const seenAccessionNumbers = new Set<string>();
  const newFilings = filingsToInsert.filter(f => {
    // Ignorer si déjà dans la DB
    if (existingAccessionNumbers.has(f.accession_number)) {
      return false;
    }
    // Ignorer les doublons dans le batch
    if (seenAccessionNumbers.has(f.accession_number)) {
      return false;
    }
    seenAccessionNumbers.add(f.accession_number);
    return true;
  });

  const skippedCount = filingsToInsert.length - newFilings.length;

  if (newFilings.length === 0) {
    if (skippedCount > 0) {
      console.log(`   📋 0 nouveaux filings, ${skippedCount} déjà présents`);
    }
    return 0;
  }

  // Étape 4: Insérer en batch (par lots de 1000 pour éviter les limites)
  // Utiliser upsert avec onConflict pour éviter les erreurs de contrainte unique
  const BATCH_SIZE = 1000;
  let insertedCount = 0;
  let actuallySkippedCount = skippedCount;

  for (let i = 0; i < newFilings.length; i += BATCH_SIZE) {
    const batch = newFilings.slice(i, i + BATCH_SIZE);
    
    // Utiliser upsert avec ignoreDuplicates pour éviter les erreurs
    const { error, data } = await supabase
      .from('company_filings')
      .upsert(batch, {
        onConflict: 'accession_number',
        ignoreDuplicates: true,
      })
      .select('accession_number');

    if (error) {
      // Si upsert échoue, essayer d'insérer un par un avec gestion d'erreur
      console.warn(`   ⚠️  Erreur lors de l'upsert du batch ${Math.floor(i / BATCH_SIZE) + 1}, insertion un par un...`);
      for (const filing of batch) {
        const { error: singleError } = await supabase
          .from('company_filings')
          .upsert(filing, {
            onConflict: 'accession_number',
            ignoreDuplicates: true,
          });
        if (!singleError) {
          insertedCount++;
        } else {
          // Si erreur de contrainte unique, c'est normal (déjà présent)
          if (singleError.code === '23505' || singleError.message.includes('duplicate key')) {
            actuallySkippedCount++;
          } else {
            console.error(`   ❌ Erreur pour ${filing.accession_number}:`, singleError.message);
          }
        }
      }
    } else {
      // Compter les filings réellement insérés
      insertedCount += data?.length || batch.length;
      // Les filings non retournés sont des doublons ignorés
      if (data && data.length < batch.length) {
        actuallySkippedCount += (batch.length - data.length);
      }
    }
  }

  if (actuallySkippedCount > 0) {
    console.log(`   📋 ${insertedCount} nouveaux filings, ${actuallySkippedCount} déjà présents`);
  } else {
    console.log(`   📋 ${insertedCount} nouveaux filings`);
  }

  return insertedCount;
}

/**
 * Fonction principale
 */
async function enrichCompaniesFromSec() {
  // Parse arguments
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const startFromArg = args.find(arg => arg.startsWith('--start-from='));
  const startFromCik = startFromArg ? startFromArg.split('=')[1] : null;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Enrichissement des entreprises depuis SEC EDGAR');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Configuration:`);
  console.log(`   - Limit: ${limit || 'Aucune'}`);
  console.log(`   - Dry Run: ${dryRun ? 'Oui' : 'Non'}`);
  console.log(`   - Force: ${force ? 'Oui (retraiter même si enrichi)' : 'Non (skip si déjà enrichi)'}`);
  console.log(`   - Start From: ${startFromCik || 'Début'}`);
  console.log(`   - Rate Limit: ${RATE_LIMIT_MS}ms entre chaque requête\n`);

  try {
    // Récupérer toutes les entreprises
    // Note: On sélectionne seulement les colonnes de base, les colonnes d'enrichissement seront ajoutées par la migration
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
    
    // Filtrer les entreprises déjà enrichies (ont un EIN ou des filings récents)
    let companiesToEnrich = companiesToProcess;
    let skippedAlreadyEnriched = 0;
    
    if (!dryRun && !force) {
      // Vérifier quelles entreprises sont déjà enrichies
      const enrichedCiks = new Set<string>();
      
      // Récupérer les entreprises avec EIN (déjà enrichies)
      const { data: enrichedCompanies } = await supabase
        .from('companies')
        .select('cik')
        .not('ein', 'is', null);
      
      enrichedCompanies?.forEach(c => enrichedCiks.add(c.cik));
      
      // Récupérer les entreprises avec des filings récents (déjà traitées)
      // On considère qu'une entreprise est enrichie si elle a au moins 10 filings
      const { data: companiesWithFilings } = await supabase
        .from('company_filings')
        .select('cik')
        .limit(50000); // Limite pour éviter les timeouts
      
      const filingCounts: Record<string, number> = {};
      companiesWithFilings?.forEach(f => {
        filingCounts[f.cik] = (filingCounts[f.cik] || 0) + 1;
      });
      
      // Considérer comme enrichie si elle a au moins 10 filings
      Object.entries(filingCounts).forEach(([cik, count]) => {
        if (count >= 10) {
          enrichedCiks.add(cik);
        }
      });
      
      // Filtrer les entreprises déjà enrichies
      companiesToEnrich = companiesToProcess.filter(c => !enrichedCiks.has(c.cik));
      skippedAlreadyEnriched = companiesToProcess.length - companiesToEnrich.length;
      
      if (skippedAlreadyEnriched > 0) {
        console.log(`⏭️  ${skippedAlreadyEnriched} entreprises déjà enrichies seront ignorées`);
        console.log(`   (Utilisez --force pour les retraiter)\n`);
      }
    }
    
    console.log(`📋 ${companiesToEnrich.length} entreprises à traiter\n`);

    let processedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;
    let filingsCount = 0;
    let errorCount = 0;

    for (const company of companiesToEnrich) {
      processedCount++;
      console.log(`\n[${processedCount}/${companiesToEnrich.length}] ${company.ticker} - ${company.name}`);
      console.log(`   CIK: ${company.cik}`);

      // Note: La vérification des entreprises déjà enrichies est faite en amont
      // On ne refait pas de requête DB ici pour chaque entreprise (optimisation)

      // Récupérer les données SEC
      const secData = await fetchSecData(company.cik);
      
      if (!secData) {
        errorCount++;
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
        continue;
      }

      // Mettre à jour l'entreprise
      const wasUpdated = await updateCompany(company.id, secData, dryRun);
      if (wasUpdated) {
        updatedCount++;
        console.log(`   ✅ Entreprise mise à jour`);
      }

      // Traiter les filings
      const filingsInserted = await processFilings(company.id, company.cik, secData, dryRun);
      filingsCount += filingsInserted;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
    }

    // Résumé
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ');
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

// Exécuter le script
enrichCompaniesFromSec().catch(console.error);
