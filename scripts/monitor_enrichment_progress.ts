/**
 * Script pour monitorer la progression de l'enrichissement SEC
 * 
 * Usage:
 *   npx tsx scripts/monitor_enrichment_progress.ts
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

async function monitorProgress() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 Monitoring de l\'enrichissement SEC');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Compter les entreprises enrichies
    const { data: enrichedCompanies, error: enrichedError } = await supabase
      .from('companies')
      .select('id', { count: 'exact', head: true })
      .not('ein', 'is', null);

    if (enrichedError) {
      console.error('❌ Erreur:', enrichedError.message);
      return;
    }

    // Compter toutes les entreprises
    const { data: allCompanies, error: allError } = await supabase
      .from('companies')
      .select('id', { count: 'exact', head: true });

    if (allError) {
      console.error('❌ Erreur:', allError.message);
      return;
    }

    // Compter les filings
    const { data: filings, error: filingsError } = await supabase
      .from('company_filings')
      .select('id, form_type, filing_date', { count: 'exact' })
      .order('filing_date', { ascending: false })
      .limit(1);

    if (filingsError) {
      console.error('❌ Erreur:', filingsError.message);
      return;
    }

    // Compter par type de filing
    const { data: filingsByType } = await supabase
      .from('company_filings')
      .select('form_type')
      .limit(10000); // Limite pour éviter les timeouts

    const typeCounts: Record<string, number> = {};
    filingsByType?.forEach(f => {
      typeCounts[f.form_type] = (typeCounts[f.form_type] || 0) + 1;
    });

    // Compter les entreprises avec filings
    const { data: companiesWithFilings } = await supabase
      .from('company_filings')
      .select('company_id')
      .limit(10000);

    const uniqueCompanies = new Set(companiesWithFilings?.map(f => f.company_id) || []);

    console.log('📈 Statistiques:');
    console.log(`   Entreprises totales: ${allCompanies?.length || 0}`);
    console.log(`   Entreprises enrichies (avec EIN): ${enrichedCompanies?.length || 0}`);
    console.log(`   Entreprises avec filings: ${uniqueCompanies.size}`);
    console.log(`   Total filings: ${filings?.length || 0}+`);
    
    if (Object.keys(typeCounts).length > 0) {
      console.log(`\n📋 Répartition par type:`);
      for (const [formType, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`   ${formType.padEnd(8)}: ${count.toLocaleString()}`);
      }
    }

    // Derniers filings ajoutés
    const { data: recentFilings } = await supabase
      .from('company_filings')
      .select('form_type, filing_date, accession_number, companies(ticker, name)')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentFilings && recentFilings.length > 0) {
      console.log(`\n🕐 Derniers filings ajoutés:`);
      recentFilings.forEach((f: any, i: number) => {
        const company = f.companies;
        console.log(`   ${(i + 1).toString().padStart(2)}. ${f.form_type.padEnd(6)} - ${company?.ticker || 'N/A'} - ${f.filing_date || 'N/A'}`);
      });
    }

    console.log('\n✅ Monitoring terminé\n');

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

// Exécuter toutes les 10 secondes
console.log('🔄 Monitoring toutes les 10 secondes (Ctrl+C pour arrêter)\n');
monitorProgress();

setInterval(() => {
  console.log('\n' + '─'.repeat(60));
  monitorProgress();
}, 10000);
