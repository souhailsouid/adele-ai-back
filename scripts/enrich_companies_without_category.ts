/**
 * Script pour enrichir les entreprises sans category depuis FMP
 * 
 * Enrichit les entreprises qui n'ont pas de category (pas de SIC code dans les données SEC)
 * en utilisant l'API FMP pour récupérer le secteur et l'industrie
 * 
 * Usage:
 *   npx tsx scripts/enrich_companies_without_category.ts [--limit=100]
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

// Configuration
const DEFAULT_LIMIT = 100;
const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : DEFAULT_LIMIT;

// Vérifier les variables d'environnement
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const apiBaseUrl = process.env.API_BASE_URL || 'https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod';
const accessToken = process.env.ACCESS_TOKEN;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erreur: SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis');
  process.exit(1);
}

if (!accessToken) {
  console.error('❌ Erreur: ACCESS_TOKEN est requis pour appeler l\'API d\'enrichissement');
  console.error('   Vous pouvez utiliser l\'API directement ou passer ACCESS_TOKEN en variable d\'environnement');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function enrichCompaniesWithoutCategory() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Enrichissement des entreprises sans category');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Limite: ${limit} entreprises`);
  console.log('');

  try {
    // 1. Récupérer les entreprises sans category
    const { data: companies, error: fetchError } = await supabase
      .from('companies')
      .select('id, ticker, name, cik, category, sector, industry')
      .is('category', null)
      .not('ticker', 'is', null)
      .limit(limit);

    if (fetchError) {
      console.error(`❌ Erreur lors de la récupération: ${fetchError.message}`);
      process.exit(1);
    }

    if (!companies || companies.length === 0) {
      console.log('✅ Aucune entreprise sans category à enrichir !');
      return;
    }

    console.log(`📁 ${companies.length} entreprises sans category trouvées\n`);

    let enriched = 0;
    let updated = 0;
    let errors = 0;
    const errorsList: Array<{ ticker: string; error: string }> = [];

    // 2. Enrichir chaque entreprise via l'API FMP
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      console.log(`\n📄 ${company.ticker} (${company.name})`);

      if (!accessToken) {
        console.log('   ⚠️  ACCESS_TOKEN manquant, utilisation directe de Supabase uniquement');
        console.log('   💡 Pour utiliser FMP, ajoutez ACCESS_TOKEN dans .env');
        continue;
      }

      try {
        // Appeler l'API d'enrichissement
        const response = await fetch(`${apiBaseUrl}/companies/enrich`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            ticker: company.ticker,
            cik: company.cik,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        
        if (result.error) {
          console.log(`   ⚠️  Erreur: ${result.error}`);
          errors++;
          errorsList.push({ ticker: company.ticker!, error: result.error });
        } else if (result.updated || result.created) {
          console.log(`   ✅ Enrichi: sector=${result.sector || 'N/A'}, industry=${result.industry || 'N/A'}`);
          
          // Mettre à jour la category si on a un secteur
          if (result.sector) {
            // Mapper le secteur FMP vers notre category
            const category = mapSectorToCategory(result.sector);
            if (category) {
              const { error: updateError } = await supabase
                .from('companies')
                .update({ category })
                .eq('id', company.id);

              if (updateError) {
                console.log(`   ⚠️  Erreur mise à jour category: ${updateError.message}`);
              } else {
                console.log(`   📂 Category mise à jour: ${category}`);
                updated++;
              }
            }
          }
          
          enriched++;
        } else {
          console.log(`   ⏭️  Déjà enrichi ou pas de données`);
        }

        // Pause pour éviter le rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error: any) {
        console.log(`   ❌ Erreur: ${error.message}`);
        errors++;
        errorsList.push({ ticker: company.ticker!, error: error.message });
      }
    }

    // Afficher le résumé
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Entreprises enrichies: ${enriched}`);
    console.log(`📂 Categories mises à jour: ${updated}`);
    console.log(`❌ Erreurs: ${errors}`);

    if (errorsList.length > 0) {
      console.log('\n❌ Erreurs détaillées:');
      errorsList.slice(0, 10).forEach(({ ticker, error }) => {
        console.log(`   - ${ticker}: ${error.substring(0, 100)}`);
      });
      if (errorsList.length > 10) {
        console.log(`   ... et ${errorsList.length - 10} autres erreurs`);
      }
    }

    console.log('\n✅ Enrichissement terminé !');
  } catch (error: any) {
    console.error('\n❌ Erreur fatale:', error.message);
    process.exit(1);
  }
}

/**
 * Mapper le secteur FMP vers notre category
 */
function mapSectorToCategory(sector: string | null): string | null {
  if (!sector) return null;

  const sectorLower = sector.toLowerCase();

  // Agriculture
  if (sectorLower.includes('agriculture') || sectorLower.includes('farming')) {
    return 'Agriculture & Pêche';
  }

  // Mines & Pétrole
  if (sectorLower.includes('mining') || sectorLower.includes('oil') || sectorLower.includes('energy') || sectorLower.includes('petroleum')) {
    return 'Mines & Pétrole';
  }

  // Industrie / Manufacturier
  if (sectorLower.includes('manufacturing') || sectorLower.includes('industrial') || sectorLower.includes('aerospace') || sectorLower.includes('automotive')) {
    return 'Industrie / Manufacturier';
  }

  // Transports
  if (sectorLower.includes('transportation') || sectorLower.includes('transport') || sectorLower.includes('airline') || sectorLower.includes('shipping')) {
    return 'Transports & Services publics';
  }

  // Commerce / Retail
  if (sectorLower.includes('retail') || sectorLower.includes('consumer') || sectorLower.includes('wholesale')) {
    return 'Commerce / Retail';
  }

  // Finance
  if (sectorLower.includes('financial') || sectorLower.includes('banking') || sectorLower.includes('insurance') || sectorLower.includes('finance')) {
    return 'Finance, Banque & Assurance';
  }

  // Services & Tech
  if (sectorLower.includes('technology') || sectorLower.includes('software') || sectorLower.includes('services') || sectorLower.includes('telecommunications')) {
    return 'Services & Tech';
  }

  return null;
}

// Exécuter le script
enrichCompaniesWithoutCategory().catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});
