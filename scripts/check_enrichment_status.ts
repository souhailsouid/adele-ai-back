/**
 * Script pour vérifier l'état de l'enrichissement SEC dans la base de données
 * 
 * Usage:
 *   npx tsx scripts/check_enrichment_status.ts
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

async function checkEnrichmentStatus() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Vérification de l\'état de l\'enrichissement SEC');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Statistiques générales des entreprises
    const { count: totalCompanies } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });

    const { count: companiesWithEin } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .not('ein', 'is', null);

    const { count: companiesWithSic } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .not('sic_code', 'is', null);

    const { count: companiesWithFiscalYearEnd } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .not('fiscal_year_end', 'is', null);

    // 2. Statistiques des filings
    const { count: totalFilings } = await supabase
      .from('company_filings')
      .select('*', { count: 'exact', head: true });

    // Répartition par type de filing
    const { data: filingsByType } = await supabase
      .from('company_filings')
      .select('form_type');

    const filingTypeBreakdown: Record<string, number> = {};
    filingsByType?.forEach(f => {
      filingTypeBreakdown[f.form_type] = (filingTypeBreakdown[f.form_type] || 0) + 1;
    });

    // 3. Entreprises avec filings
    const { data: companiesWithFilingsData } = await supabase
      .from('company_filings')
      .select('cik');

    const uniqueCiksWithFilings = new Set(companiesWithFilingsData?.map(f => f.cik) || []);
    const companiesWithFilingsCount = uniqueCiksWithFilings.size;

    // 4. Dernières entreprises enrichies
    const { data: recentlyEnriched } = await supabase
      .from('companies')
      .select('ticker, name, ein, sic_code, fiscal_year_end, updated_at')
      .not('ein', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(10);

    // 5. Derniers filings ajoutés
    const { data: recentFilings } = await supabase
      .from('company_filings')
      .select('form_type, filing_date, cik, companies(ticker, name)')
      .order('created_at', { ascending: false })
      .limit(10);

    // 6. Statistiques par type de filing
    const { data: filingsStats } = await supabase
      .from('company_filings')
      .select('form_type, filing_date')
      .order('filing_date', { ascending: false })
      .limit(1000);

    const recentFilingsByType: Record<string, number> = {};
    const currentYear = new Date().getFullYear();
    filingsStats?.forEach(f => {
      const filingYear = new Date(f.filing_date).getFullYear();
      if (filingYear >= currentYear - 1) { // Dernières 2 années
        recentFilingsByType[f.form_type] = (recentFilingsByType[f.form_type] || 0) + 1;
      }
    });

    // Affichage des résultats
    console.log('📊 STATISTIQUES GÉNÉRALES\n');
    console.log('Entreprises:');
    console.log(`   Total: ${totalCompanies || 0}`);
    console.log(`   Avec EIN (enrichies): ${companiesWithEin || 0} (${totalCompanies ? ((companiesWithEin || 0) / totalCompanies * 100).toFixed(1) : 0}%)`);
    console.log(`   Avec SIC code: ${companiesWithSic || 0}`);
    console.log(`   Avec fiscal year end: ${companiesWithFiscalYearEnd || 0}`);
    console.log(`   Avec filings: ${companiesWithFilingsCount}\n`);

    console.log('Filings:');
    console.log(`   Total: ${totalFilings || 0}`);
    console.log(`   Répartition par type:`);
    const sortedBreakdown = Object.entries(filingTypeBreakdown).sort(([, a], [, b]) => b - a);
    sortedBreakdown.forEach(([type, count]) => {
      const percentage = totalFilings ? ((count / totalFilings) * 100).toFixed(1) : 0;
      console.log(`      ${type.padEnd(10)}: ${String(count).padStart(8)} (${percentage}%)`);
    });

    if (Object.keys(recentFilingsByType).length > 0) {
      console.log(`\n   Filings récents (2 dernières années):`);
      Object.entries(recentFilingsByType).forEach(([type, count]) => {
        console.log(`      ${type.padEnd(10)}: ${String(count).padStart(8)}`);
      });
    }

    console.log('\n\n🕐 DERNIÈRES ENTREPRISES ENRICHIES\n');
    if (recentlyEnriched && recentlyEnriched.length > 0) {
      recentlyEnriched.forEach((company, index) => {
        const updatedAt = company.updated_at ? new Date(company.updated_at).toLocaleString('fr-FR') : 'N/A';
        console.log(`   ${String(index + 1).padStart(2)}. ${company.ticker?.padEnd(8)} - ${company.name?.substring(0, 40).padEnd(40)}`);
        console.log(`      EIN: ${company.ein || 'N/A'}, SIC: ${company.sic_code || 'N/A'}, Mis à jour: ${updatedAt}`);
      });
    } else {
      console.log('   Aucune entreprise enrichie récemment');
    }

    console.log('\n\n📋 DERNIERS FILINGS AJOUTÉS\n');
    if (recentFilings && recentFilings.length > 0) {
      recentFilings.forEach((filing, index) => {
        const company = filing.companies as { ticker?: string; name?: string } | null;
        const companyName = company?.name || 'N/A';
        const companyTicker = company?.ticker || 'N/A';
        console.log(`   ${String(index + 1).padStart(2)}. ${filing.form_type.padEnd(10)} - ${companyTicker.padEnd(8)} - ${filing.filing_date}`);
        console.log(`      ${companyName.substring(0, 60)}`);
      });
    } else {
      console.log('   Aucun filing ajouté récemment');
    }

    // 7. Vérification de la cohérence
    console.log('\n\n✅ VÉRIFICATION DE COHÉRENCE\n');
    
    // Entreprises avec EIN mais sans filings
    const { data: companiesWithEinButNoFilings } = await supabase
      .from('companies')
      .select('ticker, name, ein, cik')
      .not('ein', 'is', null)
      .limit(100);

    if (companiesWithEinButNoFilings) {
      const ciksWithEin = new Set(companiesWithEinButNoFilings.map(c => c.cik));
      const { data: filingsForEinCompanies } = await supabase
        .from('company_filings')
        .select('cik')
        .in('cik', Array.from(ciksWithEin));

      const ciksWithFilings = new Set(filingsForEinCompanies?.map(f => f.cik) || []);
      const companiesWithoutFilings = companiesWithEinButNoFilings.filter(c => !ciksWithFilings.has(c.cik));

      if (companiesWithoutFilings.length > 0) {
        console.log(`   ⚠️  ${companiesWithoutFilings.length} entreprises avec EIN mais sans filings:`);
        companiesWithoutFilings.slice(0, 5).forEach(c => {
          console.log(`      - ${c.ticker} (${c.name})`);
        });
        if (companiesWithoutFilings.length > 5) {
          console.log(`      ... et ${companiesWithoutFilings.length - 5} autres`);
        }
      } else {
        console.log('   ✅ Toutes les entreprises avec EIN ont des filings');
      }
    }

    // Résumé final
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ');
    console.log('═══════════════════════════════════════════════════════════');
    const enrichmentPercentage = totalCompanies ? ((companiesWithEin || 0) / totalCompanies * 100).toFixed(1) : 0;
    console.log(`✅ Enrichissement: ${companiesWithEin || 0}/${totalCompanies || 0} entreprises (${enrichmentPercentage}%)`);
    console.log(`✅ Filings stockés: ${totalFilings || 0}`);
    console.log(`✅ Entreprises avec filings: ${companiesWithFilingsCount}`);
    
    if (totalCompanies && companiesWithEin) {
      const remaining = (totalCompanies || 0) - (companiesWithEin || 0);
      console.log(`⏳ Restantes: ${remaining} entreprises`);
    }
    
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

checkEnrichmentStatus().catch(console.error);
