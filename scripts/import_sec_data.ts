/**
 * Script d'import des données SEC dans Supabase
 * 
 * 1. Table companies : Import avec mapping SIC vers category
 * 2. Table earnings_calendar : Détection des annonces de résultats (8-K avec item 2.02)
 * 
 * Usage:
 *   npx tsx scripts/import_sec_data.ts [--limit=50] [--dry-run] [--skip-existing] [--start-from=CIK0002104640.json] [--path=/Users/souhailsouid/Downloads/submissions]
 *   
 *   --limit=0 : Traiter tous les fichiers (pas de limite)
 *   --skip-existing : Ignorer les entreprises déjà présentes dans la base (évite les requêtes inutiles)
 *   --start-from=FILE : Reprendre l'import à partir d'un fichier spécifique (ex: CIK0002104640.json)
 * 
 * Variables d'environnement requises:
 *   - SUPABASE_URL: URL de votre instance Supabase
 *   - SUPABASE_SERVICE_KEY: Clé service role (pour bypass RLS)
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

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

// Configuration
const SUBMISSIONS_PATH = process.env.SUBMISSIONS_PATH || '/Users/souhailsouid/Downloads/submissions';
const DEFAULT_LIMIT = 50;

// Parser les arguments de ligne de commande
const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limitValue = limitArg ? parseInt(limitArg.split('=')[1]) : DEFAULT_LIMIT;
// 0 signifie pas de limite (traiter tous les fichiers)
const limit = limitValue === 0 ? Infinity : limitValue;
const dryRun = args.includes('--dry-run');
const skipExisting = args.includes('--skip-existing');
const pathArg = args.find(arg => arg.startsWith('--path='));
const submissionsPath = pathArg ? pathArg.split('=')[1] : SUBMISSIONS_PATH;
const startFromArg = args.find(arg => arg.startsWith('--start-from='));
const startFromFile = startFromArg ? startFromArg.split('=')[1] : null;

// Vérifier les variables d'environnement
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erreur: SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis');
  console.error('   Ajoutez-les dans votre fichier .env ou passez-les en variables d\'environnement');
  console.error('   Variables acceptées: SUPABASE_SERVICE_KEY, SUPABASE_SERVICE_ROLE_KEY, ou SUPABASE_ANON_KEY');
  process.exit(1);
}

// Créer le client Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// Mapping SIC vers Category
// ============================================

function mapSicToCategory(sicCode: string | null | undefined): string | null {
  if (!sicCode || sicCode === '' || sicCode === '0000') {
    return null;
  }

  const sic = parseInt(sicCode);
  if (isNaN(sic)) {
    return null;
  }

  // Agriculture & Pêche
  if (sic >= 100 && sic <= 999) {
    return 'Agriculture & Pêche';
  }
  // Mines & Pétrole
  if (sic >= 1000 && sic <= 1499) {
    return 'Mines & Pétrole';
  }
  // Industrie / Manufacturier
  if (sic >= 2000 && sic <= 3999) {
    return 'Industrie / Manufacturier';
  }
  // Transports & Services publics
  if (sic >= 4000 && sic <= 4999) {
    return 'Transports & Services publics';
  }
  // Commerce / Retail
  if (sic >= 5000 && sic <= 5999) {
    return 'Commerce / Retail';
  }
  // Finance, Banque & Assurance
  if (sic >= 6000 && sic <= 6799) {
    return 'Finance, Banque & Assurance';
  }
  // Services & Tech
  if (sic >= 7000 && sic <= 8999) {
    return 'Services & Tech';
  }

  return null;
}

// ============================================
// Interfaces TypeScript
// ============================================

interface SECSubmission {
  cik: string;
  name?: string;
  tickers?: string[];
  sic?: string;
  sicDescription?: string;
  filings?: {
    recent?: {
      form?: string[];
      filingDate?: string[];
      items?: string[];
      accessionNumber?: string[];
      reportDate?: string[];
    };
  };
  [key: string]: any;
}

interface CompanyData {
  cik: string;
  ticker: string | null;
  name: string;
  sic_code: string | null;
  industry: string | null;
  category: string | null;
}

interface EarningsCalendarEvent {
  cik: string;
  ticker: string | null;
  filing_date: string;
  accession_number: string | null;
  form_type: string;
  item: string;
}

// ============================================
// Fonctions utilitaires
// ============================================

function readSubmissionFile(filePath: string): SECSubmission | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data;
  } catch (error: any) {
    console.error(`❌ Erreur lecture ${filePath}:`, error.message);
    return null;
  }
}

function extractCompanyData(submission: SECSubmission, cik: string): CompanyData | null {
  // Extraire le ticker (premier valide du tableau)
  const validTickers = (submission.tickers || []).filter(t => t && t.trim().length > 0);
  const ticker = validTickers.length > 0 
    ? validTickers[0].toUpperCase().trim() 
    : null;

  // VALIDATION : Ticker est obligatoire
  if (!ticker) {
    return null; // Ignorer les entreprises sans ticker
  }

  // Extraire le nom
  const name = submission.name || `Company ${cik}`;

  // VALIDATION : Nom est obligatoire
  if (!name || name.trim().length === 0) {
    return null;
  }

  // VALIDATION : CIK est obligatoire
  const actualCik = submission.cik || cik;
  if (!actualCik || actualCik.trim().length === 0) {
    return null;
  }

  // Extraire le SIC code
  let sicCode = submission.sic || null;
  if (sicCode === '' || sicCode === '0000') {
    sicCode = null;
  }

  // Extraire la description SIC (utilisée comme industry)
  const sicDescription = submission.sicDescription || null;

  // Mapper SIC vers category
  const category = mapSicToCategory(sicCode);

  // Normaliser le CIK (10 caractères avec zéros à gauche)
  const normalizedCik = actualCik.padStart(10, '0');

  return {
    cik: normalizedCik,
    ticker,
    name: name.trim(),
    sic_code: sicCode,
    industry: sicDescription,
    category,
  };
}

function extractEarningsEvents(submission: SECSubmission, cik: string, ticker: string | null): EarningsCalendarEvent[] {
  const events: EarningsCalendarEvent[] = [];
  
  const filings = submission.filings?.recent;
  if (!filings) {
    return events;
  }

  const forms = filings.form || [];
  const filingDates = filings.filingDate || [];
  const items = filings.items || [];
  const accessionNumbers = filings.accessionNumber || [];

  // Parcourir tous les filings
  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    const filingDate = filingDates[i];
    const item = items[i] || '';
    const accessionNumber = accessionNumbers[i] || null;

    // Détecter les 8-K avec item 2.02 (annonce de résultats)
    if (form === '8-K' && item.includes('2.02')) {
      if (filingDate) {
        events.push({
          cik: cik.padStart(10, '0'),
          ticker,
          filing_date: filingDate,
          accession_number: accessionNumber,
          form_type: '8-K',
          item: '2.02',
        });
      }
    }
  }

  return events;
}

// ============================================
// Fonctions d'insertion Supabase
// ============================================

async function upsertCompany(company: CompanyData): Promise<{ success: boolean; created: boolean; error?: string }> {
  try {
    // Vérifier si l'entreprise existe déjà (par CIK ou ticker)
    let existing: { id: number; ticker: string; cik: string; category?: string | null; sic_code?: string | null; industry?: string | null } | null = null;

    if (company.cik) {
      const { data: byCik } = await supabase
        .from('companies')
        .select('id, ticker, cik, category, sic_code, industry')
        .eq('cik', company.cik)
        .maybeSingle();

      if (byCik) {
        existing = byCik;
      }
    }

    if (!existing && company.ticker) {
      const { data: byTicker } = await supabase
        .from('companies')
        .select('id, ticker, cik, category, sic_code, industry')
        .eq('ticker', company.ticker)
        .maybeSingle();

      if (byTicker) {
        existing = byTicker;
      }
    }

    if (existing) {
      // Mettre à jour l'entreprise existante
      const updateData: any = {
        name: company.name,
        sic_code: company.sic_code || existing.sic_code || null,
        industry: company.industry || existing.industry || null,
        ticker: company.ticker || existing.ticker,
      };

      // Ajouter category seulement si elle n'existe pas déjà
      if (company.category && !existing.category) {
        updateData.category = company.category;
      }

      const { error: updateError } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', existing.id);

      if (updateError) {
        return { success: false, created: false, error: updateError.message };
      }

      return { success: true, created: false };
    } else {
      // Créer une nouvelle entreprise
      // Validation : ticker et cik sont obligatoires (déjà vérifiés dans extractCompanyData)
      if (!company.ticker || !company.cik) {
        return { success: false, created: false, error: 'Missing ticker or CIK (should not happen)' };
      }

      const { error: insertError } = await supabase
        .from('companies')
        .insert({
          cik: company.cik,
          ticker: company.ticker,
          name: company.name,
          sic_code: company.sic_code,
          industry: company.industry,
          category: company.category,
        });

      if (insertError) {
        return { success: false, created: false, error: insertError.message };
      }

      return { success: true, created: true };
    }
  } catch (error: any) {
    return { success: false, created: false, error: error.message };
  }
}

async function upsertEarningsEvent(event: EarningsCalendarEvent): Promise<{ success: boolean; created: boolean; error?: string }> {
  try {
    // Vérifier si l'événement existe déjà (par CIK + filing_date + form_type + item)
    const { data: existing } = await supabase
      .from('earnings_calendar')
      .select('id')
      .eq('cik', event.cik)
      .eq('filing_date', event.filing_date)
      .eq('form_type', event.form_type)
      .eq('item', event.item)
      .maybeSingle();

    if (existing) {
      // Mettre à jour l'événement existant
      const { error: updateError } = await supabase
        .from('earnings_calendar')
        .update({
          ticker: event.ticker,
          accession_number: event.accession_number,
        })
        .eq('id', existing.id);

      if (updateError) {
        return { success: false, created: false, error: updateError.message };
      }

      return { success: true, created: false };
    } else {
      // Créer un nouvel événement
      const { error: insertError } = await supabase
        .from('earnings_calendar')
        .insert({
          cik: event.cik,
          ticker: event.ticker,
          filing_date: event.filing_date,
          accession_number: event.accession_number,
          form_type: event.form_type,
          item: event.item,
        });

      if (insertError) {
        return { success: false, created: false, error: insertError.message };
      }

      return { success: true, created: true };
    }
  } catch (error: any) {
    // Si la table n'existe pas, on ignore l'erreur (sera créée par migration)
    if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
      console.warn(`⚠️  Table earnings_calendar n'existe pas encore. Créez-la avec la migration SQL.`);
      return { success: false, created: false, error: 'Table earnings_calendar does not exist' };
    }
    return { success: false, created: false, error: error.message };
  }
}

// ============================================
// Fonction principale
// ============================================

async function processSubmissions() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📥 Import des Données SEC');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📍 Dossier: ${submissionsPath}`);
  console.log(`📊 Limite: ${limit === Infinity ? 'Aucune (tous les fichiers)' : `${limit} fichiers`}`);
  console.log(`🧪 Mode: ${dryRun ? 'DRY RUN (test)' : 'PRODUCTION'}`);
  console.log(`⏭️  Skip existing: ${skipExisting ? 'Oui (ignorer les entreprises déjà importées)' : 'Non'}`);
  if (startFromFile) {
    console.log(`▶️  Reprendre depuis: ${startFromFile}`);
  }
  console.log('');

  // Vérifier que le dossier existe
  if (!fs.existsSync(submissionsPath)) {
    console.error(`❌ Erreur: Le dossier ${submissionsPath} n'existe pas`);
    process.exit(1);
  }

  // Lire tous les fichiers JSON du dossier (ignorer les fichiers -submissions-)
  const allFiles = fs.readdirSync(submissionsPath)
    .filter(file => {
      return file.endsWith('.json') && !file.includes('-submissions-');
    })
    .sort(); // Trier pour garantir l'ordre
  
  // Si --start-from est spécifié, commencer à partir de ce fichier
  let filesToProcess = allFiles;
  if (startFromFile) {
    const startIndex = allFiles.findIndex(file => file === startFromFile || file >= startFromFile);
    if (startIndex === -1) {
      console.error(`❌ Erreur: Le fichier ${startFromFile} n'a pas été trouvé dans le dossier`);
      console.error(`   Vérifiez que le nom du fichier est correct (ex: CIK0002104640.json)`);
      process.exit(1);
    }
    filesToProcess = allFiles.slice(startIndex);
    console.log(`📌 Reprise à partir de ${startFromFile} (${startIndex + 1}/${allFiles.length} fichiers)`);
  }
  
  const files = limit === Infinity ? filesToProcess : filesToProcess.slice(0, limit);

  if (files.length === 0) {
    console.error(`❌ Aucun fichier JSON trouvé dans ${submissionsPath}`);
    process.exit(1);
  }

  console.log(`📁 ${files.length} fichiers JSON trouvés\n`);

  // Statistiques
  let processed = 0;
  let companiesCreated = 0;
  let companiesUpdated = 0;
  let earningsEventsCreated = 0;
  let earningsEventsUpdated = 0;
  let skipped = 0;
  let errors = 0;
  const errorsList: Array<{ file: string; error: string }> = [];

  // Traiter chaque fichier
  for (const file of files) {
    const filePath = path.join(submissionsPath, file);
    
    // Extraire le CIK du nom de fichier
    let cik = path.basename(file, '.json');
    if (cik.startsWith('CIK')) {
      cik = cik.substring(3);
    }

    console.log(`\n📄 ${file} (CIK: ${cik})`);

    // Lire le fichier
    const submission = readSubmissionFile(filePath);
    if (!submission) {
      skipped++;
      continue;
    }

    // Utiliser le CIK du JSON si présent, sinon celui du nom de fichier
    const actualCik = submission.cik || cik;

    // Extraire les données de l'entreprise
    const companyData = extractCompanyData(submission, actualCik);
    if (!companyData) {
      console.log('   ⚠️  Données incomplètes (ticker, nom ou CIK manquant), ignoré');
      skipped++;
      continue;
    }

    console.log(`   📊 Ticker: ${companyData.ticker || 'N/A'}`);
    console.log(`   🏢 Nom: ${companyData.name}`);
    console.log(`   📋 SIC Code: ${companyData.sic_code || 'N/A'}`);
    console.log(`   🏭 Industry: ${companyData.industry || 'N/A'}`);
    console.log(`   📂 Category: ${companyData.category || 'N/A'}`);

    // Extraire les événements earnings (8-K avec item 2.02)
    const earningsEvents = extractEarningsEvents(submission, actualCik, companyData.ticker);
    if (earningsEvents.length > 0) {
      console.log(`   📅 ${earningsEvents.length} événement(s) earnings détecté(s)`);
      earningsEvents.forEach(event => {
        console.log(`      - ${event.filing_date} (8-K, item 2.02)`);
      });
    }

    // Mode dry-run : afficher sans insérer
    if (dryRun) {
      console.log('   ✅ [DRY RUN] Serait inséré/mis à jour');
      processed++;
      continue;
    }

    // Vérifier si l'entreprise existe déjà (si --skip-existing)
    if (skipExisting && !dryRun) {
      const { data: existing } = await supabase
        .from('companies')
        .select('id')
        .or(`cik.eq.${companyData.cik}${companyData.ticker ? `,ticker.eq.${companyData.ticker}` : ''}`)
        .maybeSingle();
      
      if (existing) {
        console.log('   ⏭️  Entreprise déjà existante, ignorée (--skip-existing)');
        skipped++;
        continue;
      }
    }

    // Insérer ou mettre à jour l'entreprise
    const companyResult = await upsertCompany(companyData);
    
    if (companyResult.success) {
      if (companyResult.created) {
        console.log('   ✅ Entreprise créée');
        companiesCreated++;
      } else {
        console.log('   🔄 Entreprise mise à jour');
        companiesUpdated++;
      }
    } else {
      console.log(`   ❌ Erreur entreprise: ${companyResult.error}`);
      errors++;
      errorsList.push({ file, error: `Company: ${companyResult.error}` });
    }

    // Insérer ou mettre à jour les événements earnings
    for (const event of earningsEvents) {
      const eventResult = await upsertEarningsEvent(event);
      if (eventResult.success) {
        if (eventResult.created) {
          earningsEventsCreated++;
        } else {
          earningsEventsUpdated++;
        }
      } else {
        // Ne pas bloquer si la table n'existe pas encore
        if (!eventResult.error?.includes('does not exist')) {
          // Filtrer les erreurs HTML (réponses non-JSON de Supabase)
          const errorMessage = eventResult.error || '';
          const isHtmlError = errorMessage.trim().startsWith('<!DOCTYPE') || errorMessage.includes('<html');
          const isNetworkError = errorMessage.includes('fetch failed') || errorMessage.includes('ECONNREFUSED');
          
          if (isHtmlError || isNetworkError) {
            // Erreurs réseau/Supabase : compter mais ne pas afficher le HTML complet
            const shortError = isHtmlError ? 'Supabase 500 error (rate limit?)' : 'Network error';
            errors++;
            errorsList.push({ file, error: `Earnings event: ${shortError}` });
          } else {
            errors++;
            // Limiter la taille du message d'erreur
            const truncatedError = errorMessage.length > 200 
              ? errorMessage.substring(0, 200) + '...' 
              : errorMessage;
            errorsList.push({ file, error: `Earnings event: ${truncatedError}` });
          }
        }
      }
    }

    processed++;

    // Pause plus longue pour éviter le rate limiting (augmenté à 100ms)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Afficher le résumé
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📊 RÉSUMÉ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Fichiers traités: ${processed}`);
  console.log(`\n📦 Companies:`);
  console.log(`   🆕 Créés: ${companiesCreated}`);
  console.log(`   🔄 Mis à jour: ${companiesUpdated}`);
  console.log(`\n📅 Earnings Calendar:`);
  console.log(`   🆕 Événements créés: ${earningsEventsCreated}`);
  console.log(`   🔄 Événements mis à jour: ${earningsEventsUpdated}`);
  console.log(`\n⏭️  Ignorés: ${skipped}`);
  console.log(`❌ Erreurs: ${errors}`);

  if (errorsList.length > 0) {
    console.log('\n❌ Erreurs détaillées:');
    // Limiter l'affichage à 20 premières erreurs pour éviter le spam
    const errorsToShow = errorsList.slice(0, 20);
    errorsToShow.forEach(({ file, error }) => {
      console.log(`   - ${file}: ${error}`);
    });
    if (errorsList.length > 20) {
      console.log(`   ... et ${errorsList.length - 20} autres erreurs (non affichées)`);
    }
  }

  console.log('\n✅ Import terminé !');
}

// Exécuter le script
processSubmissions().catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});
