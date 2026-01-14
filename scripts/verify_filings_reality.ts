/**
 * Script pour vérifier la réalité des filings dans la base
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

async function verifyFilingsReality() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Vérification RÉELLE des filings dans la base');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Total filings
    const { count: totalFilings } = await supabase
      .from('company_filings')
      .select('*', { count: 'exact', head: true });

    // 2. Filings par type
    const { data: allFilings } = await supabase
      .from('company_filings')
      .select('form_type, company_id, cik, created_at')
      .order('created_at', { ascending: false })
      .limit(10000);

    const typeBreakdown: Record<string, number> = {};
    const ciksWithFilings = new Set<string>();
    const companyIdsWithFilings = new Set<number>();
    
    allFilings?.forEach(f => {
      typeBreakdown[f.form_type] = (typeBreakdown[f.form_type] || 0) + 1;
      if (f.cik) ciksWithFilings.add(f.cik);
      if (f.company_id) companyIdsWithFilings.add(f.company_id);
    });

    // 3. Vérifier les entreprises qui devraient avoir des filings
    const { data: enrichedCompanies } = await supabase
      .from('companies')
      .select('id, ticker, name, cik, ein')
      .not('ein', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(50);

    console.log('📊 STATISTIQUES GLOBALES\n');
    console.log(`Total filings dans la base: ${totalFilings || 0}`);
    console.log(`CIKs uniques avec filings: ${ciksWithFilings.size}`);
    console.log(`Company IDs uniques avec filings: ${companyIdsWithFilings.size}`);
    console.log(`Entreprises enrichies (avec EIN): ${enrichedCompanies?.length || 0}\n`);

    console.log('📋 RÉPARTITION PAR TYPE (échantillon de 10k)\n');
    Object.entries(typeBreakdown).sort(([, a], [, b]) => b - a).forEach(([type, count]) => {
      console.log(`   ${type.padEnd(10)}: ${count}`);
    });

    // 4. Vérifier quelques entreprises spécifiques
    console.log('\n\n🔍 VÉRIFICATION PAR ENTREPRISE\n');
    if (enrichedCompanies) {
      for (const company of enrichedCompanies.slice(0, 10)) {
        const { count: filingsCount } = await supabase
          .from('company_filings')
          .select('*', { count: 'exact', head: true })
          .eq('cik', company.cik);

        const { count: filingsByCompanyId } = await supabase
          .from('company_filings')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id);

        console.log(`${company.ticker?.padEnd(8)} - ${company.name?.substring(0, 40).padEnd(40)}`);
        console.log(`   CIK: ${company.cik}`);
        console.log(`   Filings par CIK: ${filingsCount || 0}`);
        console.log(`   Filings par company_id: ${filingsByCompanyId || 0}`);
        console.log('');
      }
    }

    // 5. Filings récents (dernières 24h)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { count: recentFilings } = await supabase
      .from('company_filings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString());

    console.log('\n\n📅 FILINGS RÉCENTS\n');
    console.log(`Filings créés dans les dernières 24h: ${recentFilings || 0}`);

    // Résumé
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 DIAGNOSTIC');
    console.log('═══════════════════════════════════════════════════════════');
    
    if (totalFilings && totalFilings > 200000) {
      console.log(`✅ ${totalFilings.toLocaleString()} filings sont bien dans la base !`);
    } else {
      console.log(`⚠️  Seulement ${totalFilings || 0} filings dans la base`);
      console.log(`💡 Il y a peut-être un problème avec les insertions`);
    }
    
    if (companyIdsWithFilings.size < 10) {
      console.log(`⚠️  Seulement ${companyIdsWithFilings.size} entreprises ont des filings liés par company_id`);
      console.log(`💡 Vérifier si les company_id sont correctement assignés`);
    }
    
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

verifyFilingsReality().catch(console.error);
