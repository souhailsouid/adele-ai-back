/**
 * Script pour vérifier quelles entreprises ont des filings
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

async function checkFilingsByCompany() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Vérification des filings par entreprise');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Entreprises avec filings
    const { data: companiesWithFilings } = await supabase
      .from('companies')
      .select(`
        id,
        ticker,
        name,
        cik,
        ein,
        company_filings(count)
      `)
      .not('company_filings.id', 'is', null)
      .limit(100);

    // Compter les filings par entreprise
    const companiesWithCounts = companiesWithFilings?.map(c => {
      const filings = c.company_filings as any[];
      return {
        ...c,
        filingsCount: filings?.length || 0
      };
    }) || [];

    companiesWithCounts.sort((a, b) => b.filingsCount - a.filingsCount);

    console.log('📊 ENTREPRISES AVEC FILINGS\n');
    console.log(`Total: ${companiesWithCounts.length} entreprises\n`);

    if (companiesWithCounts.length > 0) {
      companiesWithCounts.forEach((company, index) => {
        console.log(`${String(index + 1).padStart(3)}. ${company.ticker?.padEnd(8)} - ${company.name?.substring(0, 50).padEnd(50)}`);
        console.log(`     CIK: ${company.cik}, EIN: ${company.ein || 'N/A'}, Filings: ${company.filingsCount}`);
      });
    } else {
      console.log('   Aucune entreprise avec filings trouvée');
    }

    // Vérifier les entreprises enrichies sans filings
    const { data: enrichedWithoutFilings } = await supabase
      .from('companies')
      .select('ticker, name, cik, ein')
      .not('ein', 'is', null)
      .limit(100);

    let withoutFilings: any[] = [];
    if (enrichedWithoutFilings) {
      const ciksWithFilings = new Set(companiesWithCounts.map(c => c.cik));
      withoutFilings = enrichedWithoutFilings.filter(c => !ciksWithFilings.has(c.cik));

      console.log('\n\n⚠️  ENTREPRISES ENRICHIES SANS FILINGS\n');
      console.log(`Total: ${withoutFilings.length} entreprises\n`);

      if (withoutFilings.length > 0) {
        withoutFilings.slice(0, 20).forEach((company, index) => {
          console.log(`${String(index + 1).padStart(3)}. ${company.ticker?.padEnd(8)} - ${company.name?.substring(0, 50).padEnd(50)}`);
          console.log(`     CIK: ${company.cik}, EIN: ${company.ein || 'N/A'}`);
        });
        if (withoutFilings.length > 20) {
          console.log(`\n     ... et ${withoutFilings.length - 20} autres`);
        }
      }
    }

    // Résumé
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Entreprises avec filings: ${companiesWithCounts.length}`);
    const withoutFilingsCount = withoutFilings?.length || 0;
    console.log(`⚠️  Entreprises enrichies sans filings: ${withoutFilingsCount}`);
    
    const totalFilings = companiesWithCounts.reduce((sum, c) => sum + c.filingsCount, 0);
    console.log(`📋 Total filings: ${totalFilings}`);
    
    if (companiesWithCounts.length > 0) {
      const avgFilings = totalFilings / companiesWithCounts.length;
      console.log(`📊 Moyenne par entreprise: ${avgFilings.toFixed(1)} filings`);
    }
    
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

checkFilingsByCompany().catch(console.error);
