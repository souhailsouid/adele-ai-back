/**
 * Script pour diagnostiquer le problème des filings
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

async function diagnoseFilingsIssue() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Diagnostic du problème des filings');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Statistiques générales
    const { count: totalFilings } = await supabase
      .from('company_filings')
      .select('*', { count: 'exact', head: true });

    // 2. Filings avec et sans company_id
    const { data: filingsWithCompanyId } = await supabase
      .from('company_filings')
      .select('company_id')
      .not('company_id', 'is', null);

    const { data: filingsWithoutCompanyId } = await supabase
      .from('company_filings')
      .select('cik, form_type')
      .is('company_id', null)
      .limit(1000);

    // 3. CIKs uniques dans les filings
    const { data: uniqueCiks } = await supabase
      .from('company_filings')
      .select('cik')
      .limit(10000);

    const uniqueCikSet = new Set(uniqueCiks?.map(f => f.cik) || []);
    const uniqueCikCount = uniqueCikSet.size;

    // 4. Vérifier si ces CIKs existent dans companies
    const cikArray = Array.from(uniqueCikSet).slice(0, 100);
    const { data: companiesForCiks } = await supabase
      .from('companies')
      .select('id, ticker, name, cik')
      .in('cik', cikArray);

    console.log('📊 STATISTIQUES\n');
    console.log(`Total filings: ${totalFilings || 0}`);
    console.log(`Filings avec company_id: ${filingsWithCompanyId?.length || 0}`);
    console.log(`Filings sans company_id: ${filingsWithoutCompanyId?.length || 0}`);
    console.log(`CIKs uniques dans filings: ${uniqueCikCount}`);
    console.log(`Entreprises trouvées pour ces CIKs: ${companiesForCiks?.length || 0}\n`);

    // 5. Exemples de CIKs sans company_id
    if (filingsWithoutCompanyId && filingsWithoutCompanyId.length > 0) {
      console.log('📋 EXEMPLES DE FILINGS SANS COMPANY_ID\n');
      const sampleCiks = Array.from(new Set(filingsWithoutCompanyId.map(f => f.cik))).slice(0, 10);
      
      for (const cik of sampleCiks) {
        const { data: company } = await supabase
          .from('companies')
          .select('id, ticker, name, cik')
          .eq('cik', cik)
          .maybeSingle();

        if (company) {
          console.log(`   ✅ CIK ${cik}: Trouvé (${company.ticker} - ${company.name})`);
        } else {
          console.log(`   ❌ CIK ${cik}: Non trouvé dans companies`);
        }
      }
    }

    // 6. Vérifier la répartition par type
    const { data: filingsByType } = await supabase
      .from('company_filings')
      .select('form_type, company_id')
      .limit(10000);

    const typeBreakdown: Record<string, { total: number; withCompanyId: number; withoutCompanyId: number }> = {};
    filingsByType?.forEach(f => {
      if (!typeBreakdown[f.form_type]) {
        typeBreakdown[f.form_type] = { total: 0, withCompanyId: 0, withoutCompanyId: 0 };
      }
      typeBreakdown[f.form_type].total++;
      if (f.company_id) {
        typeBreakdown[f.form_type].withCompanyId++;
      } else {
        typeBreakdown[f.form_type].withoutCompanyId++;
      }
    });

    console.log('\n\n📊 RÉPARTITION PAR TYPE\n');
    Object.entries(typeBreakdown).forEach(([type, stats]) => {
      console.log(`   ${type.padEnd(10)}: Total=${String(stats.total).padStart(6)}, Avec ID=${String(stats.withCompanyId).padStart(6)}, Sans ID=${String(stats.withoutCompanyId).padStart(6)}`);
    });

    // 7. Recommandation
    console.log('\n\n💡 DIAGNOSTIC\n');
    if ((filingsWithoutCompanyId?.length || 0) > 0) {
      console.log('   ⚠️  Problème détecté: Beaucoup de filings sans company_id');
      console.log('   💡 Solution: Mettre à jour company_id pour les filings existants');
      console.log('   💡 Script: Créer un script de migration pour lier les filings aux companies\n');
    } else {
      console.log('   ✅ Tous les filings ont un company_id\n');
    }

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

diagnoseFilingsIssue().catch(console.error);
