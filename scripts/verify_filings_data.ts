/**
 * Script pour vérifier directement les données des filings
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

async function verifyFilingsData() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Vérification directe des données filings');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Total filings
    const { count: totalFilings } = await supabase
      .from('company_filings')
      .select('*', { count: 'exact', head: true });

    // 2. Filings avec company_id
    const { count: filingsWithCompanyId } = await supabase
      .from('company_filings')
      .select('*', { count: 'exact', head: true })
      .not('company_id', 'is', null);

    // 3. Filings sans company_id
    const { count: filingsWithoutCompanyId } = await supabase
      .from('company_filings')
      .select('*', { count: 'exact', head: true })
      .is('company_id', null);

    // 4. CIKs uniques
    const { data: allFilings } = await supabase
      .from('company_filings')
      .select('cik, company_id, form_type')
      .limit(10000);

    const uniqueCiks = new Set(allFilings?.map(f => f.cik) || []);
    const uniqueCompanyIds = new Set(allFilings?.map(f => f.company_id).filter(id => id !== null) || []);

    // 5. Vérifier si les CIKs existent dans companies
    const cikArray = Array.from(uniqueCiks).slice(0, 100);
    const { data: companiesForCiks } = await supabase
      .from('companies')
      .select('id, ticker, name, cik')
      .in('cik', cikArray);

    const ciksInCompanies = new Set(companiesForCiks?.map(c => c.cik) || []);
    const ciksNotInCompanies = Array.from(uniqueCiks).filter(cik => !ciksInCompanies.has(cik));

    console.log('📊 STATISTIQUES GLOBALES\n');
    console.log(`Total filings: ${totalFilings || 0}`);
    console.log(`Filings avec company_id: ${filingsWithCompanyId || 0}`);
    console.log(`Filings sans company_id: ${filingsWithoutCompanyId || 0}`);
    console.log(`CIKs uniques dans filings: ${uniqueCiks.size}`);
    console.log(`Company IDs uniques: ${uniqueCompanyIds.size}`);
    console.log(`CIKs qui existent dans companies: ${ciksInCompanies.size}`);
    console.log(`CIKs qui n'existent PAS dans companies: ${ciksNotInCompanies.length}\n`);

    // 6. Exemples de CIKs non trouvés
    if (ciksNotInCompanies.length > 0) {
      console.log('⚠️  EXEMPLES DE CIKs NON TROUVÉS DANS COMPANIES\n');
      ciksNotInCompanies.slice(0, 10).forEach(cik => {
        const filingsForCik = allFilings?.filter(f => f.cik === cik).length || 0;
        console.log(`   CIK ${cik}: ${filingsForCik} filings`);
      });
      if (ciksNotInCompanies.length > 10) {
        console.log(`   ... et ${ciksNotInCompanies.length - 10} autres CIKs`);
      }
    }

    // 7. Répartition par type
    const typeBreakdown: Record<string, number> = {};
    allFilings?.forEach(f => {
      typeBreakdown[f.form_type] = (typeBreakdown[f.form_type] || 0) + 1;
    });

    console.log('\n\n📊 RÉPARTITION PAR TYPE (échantillon de 10k)\n');
    Object.entries(typeBreakdown).sort(([, a], [, b]) => b - a).forEach(([type, count]) => {
      console.log(`   ${type.padEnd(10)}: ${count}`);
    });

    // Résumé
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 DIAGNOSTIC');
    console.log('═══════════════════════════════════════════════════════════');
    
    if (filingsWithoutCompanyId && filingsWithoutCompanyId > 0) {
      console.log(`⚠️  ${filingsWithoutCompanyId.toLocaleString()} filings sans company_id`);
      console.log(`💡 Ces filings ne sont pas liés à des entreprises dans la table companies`);
    }
    
    if (ciksNotInCompanies.length > 0) {
      console.log(`⚠️  ${ciksNotInCompanies.length} CIKs dans filings n'existent pas dans companies`);
      console.log(`💡 Il faut soit créer ces entreprises, soit supprimer ces filings`);
    }
    
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

verifyFilingsData().catch(console.error);
