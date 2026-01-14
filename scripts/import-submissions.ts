/**
 * Script d'import des submissions SEC dans la table companies
 * 
 * Usage:
 *   npx tsx scripts/import-submissions.ts [--limit=100] [--dry-run]
 * 
 * Variables d'environnement requises:
 *   - SUPABASE_URL: URL de votre instance Supabase
 *   - SUPABASE_SERVICE_KEY: Clé service role (pour bypass RLS)
 * 
 * Options:
 *   --limit=N: Limiter le nombre de fichiers à traiter (défaut: 100)
 *   --dry-run: Mode test (affiche les données sans insérer)
 *   --path=PATH: Chemin vers le dossier submissions (défaut: ./data_sec)
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Charger les variables d'environnement
// Essayer d'abord avec dotenv, sinon parser manuellement le fichier .env
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
        // Ignorer les commentaires et lignes vides
        if (!trimmed || trimmed.startsWith('#')) continue;
        // Parser KEY=VALUE
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          // Enlever les guillemets si présents
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          // Ne pas écraser les variables d'environnement existantes
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
const SUBMISSIONS_PATH = process.env.SUBMISSIONS_PATH || './data_sec';
const DEFAULT_LIMIT = 100;

// Parser les arguments de ligne de commande
const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : DEFAULT_LIMIT;
const dryRun = args.includes('--dry-run');
const pathArg = args.find(arg => arg.startsWith('--path='));
const submissionsPath = pathArg ? pathArg.split('=')[1] : SUBMISSIONS_PATH;

// Vérifier les variables d'environnement
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erreur: SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis');
  console.error('   Ajoutez-les dans votre fichier .env ou passez-les en variables d\'environnement');
  console.error('   Variables acceptées: SUPABASE_SERVICE_KEY, SUPABASE_SERVICE_ROLE_KEY, ou SUPABASE_ANON_KEY');
  console.error('');
  console.error('💡 Solution rapide:');
  console.error('   export SUPABASE_URL="..."');
  console.error('   export SUPABASE_SERVICE_KEY="..."');
  console.error('   npx tsx scripts/import-submissions.ts --dry-run');
  console.error('');
  console.error('   Ou directement:');
  console.error('   SUPABASE_URL="..." SUPABASE_SERVICE_KEY="..." npx tsx scripts/import-submissions.ts --dry-run');
  process.exit(1);
}

// Créer le client Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

interface SECSubmission {
  cik: string;
  name?: string;
  tickers?: string[];
  sic?: string;
  sicDescription?: string;
  entityType?: string;
  [key: string]: any; // Pour les autres champs non utilisés
}

interface CompanyData {
  cik: string;
  ticker: string | null;
  name: string;
  sic_code: string | null;
  industry: string | null; // On utilise sicDescription comme industry
}

/**
 * Lire et parser un fichier JSON
 */
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

/**
 * Extraire les données de company depuis une submission SEC
 */
function extractCompanyData(submission: SECSubmission, cik: string): CompanyData | null {
  // Extraire le ticker (prendre le premier si plusieurs, filtrer les valeurs vides)
  const validTickers = (submission.tickers || []).filter(t => t && t.trim().length > 0);
  const ticker = validTickers.length > 0 
    ? validTickers[0].toUpperCase().trim() 
    : null;

  // Extraire le nom
  const name = submission.name || `Company ${cik}`;

  // Extraire le SIC code (peut être "0000" ou vide, traiter comme null)
  let sicCode = submission.sic || null;
  if (sicCode === '' || sicCode === '0000') {
    sicCode = null;
  }

  // Extraire la description SIC (utilisée comme industry)
  const sicDescription = submission.sicDescription || null;

  // Validation minimale : au moins un nom
  if (!name || name.trim().length === 0) {
    return null;
  }

  // Normaliser le CIK (s'assurer qu'il fait 10 caractères avec des zéros à gauche)
  const normalizedCik = cik.padStart(10, '0');

  return {
    cik: normalizedCik,
    ticker,
    name: name.trim(),
    sic_code: sicCode,
    industry: sicDescription,
  };
}

/**
 * Insérer ou mettre à jour une entreprise dans Supabase
 */
async function upsertCompany(company: CompanyData): Promise<{ success: boolean; created: boolean; error?: string }> {
  try {
    // Vérifier si l'entreprise existe déjà (par CIK ou ticker)
    let existing = null;

    if (company.cik) {
      const { data: byCik } = await supabase
        .from('companies')
        .select('id, ticker, cik')
        .eq('cik', company.cik)
        .maybeSingle();

      if (byCik) {
        existing = byCik;
      }
    }

    if (!existing && company.ticker) {
      const { data: byTicker } = await supabase
        .from('companies')
        .select('id, ticker, cik')
        .eq('ticker', company.ticker)
        .maybeSingle();

      if (byTicker) {
        existing = byTicker;
      }
    }

    if (existing) {
      // Mettre à jour l'entreprise existante
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          name: company.name,
          sic_code: company.sic_code || existing.sic_code,
          industry: company.industry || existing.industry,
          // Ne pas écraser le ticker si déjà présent
          ticker: company.ticker || existing.ticker,
        })
        .eq('id', existing.id);

      if (updateError) {
        return { success: false, created: false, error: updateError.message };
      }

      return { success: true, created: false };
    } else {
      // Créer une nouvelle entreprise
      // Note: ticker peut être null, mais on a besoin d'au moins un identifiant
      if (!company.ticker && !company.cik) {
        return { success: false, created: false, error: 'Missing both ticker and CIK' };
      }

      const { error: insertError } = await supabase
        .from('companies')
        .insert({
          cik: company.cik,
          ticker: company.ticker,
          name: company.name,
          sic_code: company.sic_code,
          industry: company.industry,
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

/**
 * Traiter tous les fichiers JSON du dossier
 */
async function processSubmissions() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📥 Import des Submissions SEC');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📍 Dossier: ${submissionsPath}`);
  console.log(`📊 Limite: ${limit} fichiers`);
  console.log(`🧪 Mode: ${dryRun ? 'DRY RUN (test)' : 'PRODUCTION'}`);
  console.log('');

  // Vérifier que le dossier existe
  if (!fs.existsSync(submissionsPath)) {
    console.error(`❌ Erreur: Le dossier ${submissionsPath} n'existe pas`);
    process.exit(1);
  }

  // Lire tous les fichiers JSON du dossier
  // Ignorer les fichiers -submissions-*.json (on veut seulement les fichiers principaux)
  const files = fs.readdirSync(submissionsPath)
    .filter(file => {
      // Accepter seulement les fichiers .json qui ne sont PAS des submissions
      return file.endsWith('.json') && !file.includes('-submissions-');
    })
    .slice(0, limit);

  if (files.length === 0) {
    console.error(`❌ Aucun fichier JSON trouvé dans ${submissionsPath}`);
    process.exit(1);
  }

  console.log(`📁 ${files.length} fichiers JSON trouvés\n`);

  // Statistiques
  let processed = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const errorsList: Array<{ file: string; error: string }> = [];

  // Traiter chaque fichier
  for (const file of files) {
    const filePath = path.join(submissionsPath, file);
    
    // Extraire le CIK du nom de fichier (format: CIK0000000020.json ou 0000000020.json)
    let cik = path.basename(file, '.json');
    if (cik.startsWith('CIK')) {
      cik = cik.substring(3); // Enlever le préfixe "CIK"
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

    // Extraire les données
    const companyData = extractCompanyData(submission, actualCik);
    if (!companyData) {
      console.log('   ⚠️  Données insuffisantes, ignoré');
      skipped++;
      continue;
    }

    console.log(`   📊 Ticker: ${companyData.ticker || 'N/A'}`);
    console.log(`   🏢 Nom: ${companyData.name}`);
    console.log(`   📋 SIC Code: ${companyData.sic_code || 'N/A'}`);
    console.log(`   🏭 Industry: ${companyData.industry || 'N/A'}`);

    // Mode dry-run : afficher sans insérer
    if (dryRun) {
      console.log('   ✅ [DRY RUN] Serait inséré/mis à jour');
      processed++;
      continue;
    }

    // Insérer ou mettre à jour
    const result = await upsertCompany(companyData);
    
    if (result.success) {
      if (result.created) {
        console.log('   ✅ Créé');
        created++;
      } else {
        console.log('   🔄 Mis à jour');
        updated++;
      }
      processed++;
    } else {
      console.log(`   ❌ Erreur: ${result.error}`);
      errors++;
      errorsList.push({ file, error: result.error || 'Unknown error' });
    }

    // Petite pause pour éviter le rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Afficher le résumé
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📊 RÉSUMÉ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Traités: ${processed}`);
  console.log(`🆕 Créés: ${created}`);
  console.log(`🔄 Mis à jour: ${updated}`);
  console.log(`⏭️  Ignorés: ${skipped}`);
  console.log(`❌ Erreurs: ${errors}`);

  if (errorsList.length > 0) {
    console.log('\n❌ Erreurs détaillées:');
    errorsList.forEach(({ file, error }) => {
      console.log(`   - ${file}: ${error}`);
    });
  }

  console.log('\n✅ Import terminé !');
}

// Exécuter le script
processSubmissions().catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});
