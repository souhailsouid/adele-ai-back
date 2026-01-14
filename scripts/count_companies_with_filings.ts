/**
 * Script pour compter le nombre réel d'entreprises avec des filings
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

async function countCompaniesWithFilings() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Comptage réel des entreprises avec filings');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Récupérer TOUS les CIKs de filings (par batch)
    console.log('📊 Récupération de tous les CIKs...\n');
    let allCiks: string[] = [];
    let offset = 0;
    const batchSize = 10000;
    
    // D'abord, compter le total
    const { count: totalCount } = await supabase
      .from('company_filings')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total filings dans la base: ${totalCount?.toLocaleString() || 0}\n`);
    
    // Récupérer tous les CIKs uniques directement
    const { data: allFilingsData, error: fetchError } = await supabase
      .from('company_filings')
      .select('cik');
    
    if (fetchError) {
      console.error('❌ Erreur lors de la récupération:', fetchError.message);
      return;
    }
    
    allCiks = allFilingsData?.map(f => f.cik) || [];
    
    const uniqueCiks = new Set(allCiks);
    console.log(`Total filings: ${allCiks.length.toLocaleString()}`);
    console.log(`CIKs uniques avec filings: ${uniqueCiks.size}\n`);

    // 2. Compter les entreprises enrichies
    const { count: enrichedCount } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .not('ein', 'is', null);
    
    console.log(`Entreprises enrichies (avec EIN): ${enrichedCount || 0}\n`);

    // 3. Vérifier combien d'entreprises enrichies ont des filings
    const cikArray = Array.from(uniqueCiks);
    let companiesWithFilingsCount = 0;
    
    // Par batch de 1000
    for (let i = 0; i < cikArray.length; i += 1000) {
      const batch = cikArray.slice(i, i + 1000);
      const { data: companies } = await supabase
        .from('companies')
        .select('id, ticker, name, cik')
        .in('cik', batch);
      
      companiesWithFilingsCount += companies?.length || 0;
    }
    
    console.log(`Entreprises enrichies avec filings: ${companiesWithFilingsCount}`);
    console.log(`Entreprises enrichies SANS filings: ${(enrichedCount || 0) - companiesWithFilingsCount}\n`);

    // Résumé
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Total filings: ${allCiks.length.toLocaleString()}`);
    console.log(`✅ CIKs uniques: ${uniqueCiks.size}`);
    console.log(`✅ Entreprises enrichies: ${enrichedCount || 0}`);
    console.log(`✅ Entreprises avec filings: ${companiesWithFilingsCount}`);
    console.log(`⏳ Entreprises sans filings: ${(enrichedCount || 0) - companiesWithFilingsCount}`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

countCompaniesWithFilings().catch(console.error);
