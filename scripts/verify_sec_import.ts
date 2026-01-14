/**
 * Script de vérification de l'import SEC dans Supabase
 * 
 * Vérifie le nombre d'entreprises et d'événements earnings importés
 * 
 * Usage:
 *   npx tsx scripts/verify_sec_import.ts
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

// Vérifier les variables d'environnement
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erreur: SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis');
  process.exit(1);
}

// Créer le client Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyImport() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Vérification de l\'import SEC dans Supabase');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  try {
    // 1. Compter les entreprises
    console.log('📦 Vérification des entreprises...');
    const { count: companiesCount, error: companiesError } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });

    if (companiesError) {
      console.error(`❌ Erreur lors du comptage des entreprises: ${companiesError.message}`);
    } else {
      console.log(`   ✅ Total entreprises: ${companiesCount || 0}`);
    }

    // 2. Compter les entreprises avec category
    const { count: companiesWithCategory, error: categoryError } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .not('category', 'is', null);

    if (!categoryError) {
      console.log(`   📂 Avec category: ${companiesWithCategory || 0}`);
    }

    // 3. Compter les entreprises avec SIC code
    const { count: companiesWithSic, error: sicError } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .not('sic_code', 'is', null);

    if (!sicError) {
      console.log(`   📋 Avec SIC code: ${companiesWithSic || 0}`);
    }

    // 4. Compter les entreprises avec industry
    const { count: companiesWithIndustry, error: industryError } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .not('industry', 'is', null);

    if (!industryError) {
      console.log(`   🏭 Avec industry: ${companiesWithIndustry || 0}`);
    }

    // 5. Répartition par category
    console.log('\n📊 Répartition par category:');
    const { data: categoryStats, error: categoryStatsError } = await supabase
      .from('companies')
      .select('category')
      .not('category', 'is', null);

    if (!categoryStatsError && categoryStats) {
      const categoryCounts: Record<string, number> = {};
      categoryStats.forEach((c: any) => {
        const cat = c.category || 'Unknown';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });

      const sortedCategories = Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      sortedCategories.forEach(([category, count]) => {
        console.log(`   ${category}: ${count}`);
      });
    }

    // 6. Vérifier la table earnings_calendar
    console.log('\n📅 Vérification des événements earnings...');
    const { count: earningsCount, error: earningsError } = await supabase
      .from('earnings_calendar')
      .select('*', { count: 'exact', head: true });

    if (earningsError) {
      if (earningsError.message?.includes('does not exist')) {
        console.log('   ⚠️  Table earnings_calendar n\'existe pas encore');
        console.log('   💡 Appliquez la migration: infra/supabase/migrations/027_add_earnings_calendar_and_company_category.sql');
      } else {
        console.error(`   ❌ Erreur: ${earningsError.message}`);
      }
    } else {
      console.log(`   ✅ Total événements earnings: ${earningsCount || 0}`);
    }

    // 7. Événements par année (si la table existe)
    if (!earningsError) {
      const { data: earningsByYear, error: yearError } = await supabase
        .from('earnings_calendar')
        .select('filing_date');

      if (!yearError && earningsByYear) {
        const yearCounts: Record<string, number> = {};
        earningsByYear.forEach((e: any) => {
          if (e.filing_date) {
            const year = e.filing_date.substring(0, 4);
            yearCounts[year] = (yearCounts[year] || 0) + 1;
          }
        });

        console.log('\n📅 Événements par année (top 10):');
        const sortedYears = Object.entries(yearCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10);

        sortedYears.forEach(([year, count]) => {
          console.log(`   ${year}: ${count} événements`);
        });
      }
    }

    // 8. Exemples d'entreprises récemment créées
    console.log('\n📝 Exemples d\'entreprises récemment créées:');
    const { data: recentCompanies, error: recentError } = await supabase
      .from('companies')
      .select('ticker, name, category, sic_code, industry, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (!recentError && recentCompanies) {
      recentCompanies.forEach((company: any) => {
        console.log(`   - ${company.ticker || 'N/A'}: ${company.name}`);
        console.log(`     Category: ${company.category || 'N/A'}, SIC: ${company.sic_code || 'N/A'}`);
      });
    }

    console.log('\n✅ Vérification terminée !');

  } catch (error: any) {
    console.error('\n❌ Erreur fatale:', error.message);
    process.exit(1);
  }
}

// Exécuter le script
verifyImport().catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});
