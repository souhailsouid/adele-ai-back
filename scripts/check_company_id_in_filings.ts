/**
 * Script pour vérifier le problème des company_id dans les filings
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

async function checkCompanyIdInFilings() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Vérification des company_id dans les filings');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Statistiques globales
    const { data: allFilings } = await supabase
      .from('company_filings')
      .select('company_id, cik')
      .limit(100000);

    const totalFilings = allFilings?.length || 0;
    const filingsWithCompanyId = allFilings?.filter(f => f.company_id !== null).length || 0;
    const filingsWithoutCompanyId = totalFilings - filingsWithCompanyId;

    const uniqueCiks = new Set(allFilings?.map(f => f.cik) || []);
    const uniqueCompanyIds = new Set(allFilings?.map(f => f.company_id).filter(id => id !== null) || []);

    console.log('📊 STATISTIQUES\n');
    console.log(`Total filings analysés: ${totalFilings.toLocaleString()}`);
    console.log(`Filings avec company_id: ${filingsWithCompanyId.toLocaleString()} (${((filingsWithCompanyId / totalFilings) * 100).toFixed(1)}%)`);
    console.log(`Filings sans company_id: ${filingsWithoutCompanyId.toLocaleString()} (${((filingsWithoutCompanyId / totalFilings) * 100).toFixed(1)}%)`);
    console.log(`CIKs uniques: ${uniqueCiks.size}`);
    console.log(`Company IDs uniques: ${uniqueCompanyIds.size}\n`);

    // 2. Vérifier quelques CIKs spécifiques
    const { data: enrichedCompanies } = await supabase
      .from('companies')
      .select('id, ticker, name, cik')
      .not('ein', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(20);

    console.log('🔍 VÉRIFICATION PAR ENTREPRISE\n');
    if (enrichedCompanies) {
      for (const company of enrichedCompanies) {
        const { count: filingsByCik } = await supabase
          .from('company_filings')
          .select('*', { count: 'exact', head: true })
          .eq('cik', company.cik);

        const { count: filingsByCompanyId } = await supabase
          .from('company_filings')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id);

        const { count: filingsWithoutCompanyId } = await supabase
          .from('company_filings')
          .select('*', { count: 'exact', head: true })
          .eq('cik', company.cik)
          .is('company_id', null);

        if ((filingsByCik || 0) > 0) {
          console.log(`${company.ticker?.padEnd(8)} - ${company.name?.substring(0, 35).padEnd(35)}`);
          console.log(`   CIK: ${company.cik}, Company ID: ${company.id}`);
          console.log(`   Filings par CIK: ${filingsByCik || 0}`);
          console.log(`   Filings avec company_id=${company.id}: ${filingsByCompanyId || 0}`);
          console.log(`   Filings sans company_id: ${filingsWithoutCompanyId || 0}`);
          console.log('');
        }
      }
    }

    // 3. Exemples de filings sans company_id
    const { data: filingsWithoutId } = await supabase
      .from('company_filings')
      .select('cik, form_type, filing_date, company_id')
      .is('company_id', null)
      .limit(10);

    if (filingsWithoutId && filingsWithoutId.length > 0) {
      console.log('⚠️  EXEMPLES DE FILINGS SANS COMPANY_ID\n');
      filingsWithoutId.forEach(f => {
        console.log(`   CIK: ${f.cik}, Form: ${f.form_type}, Date: ${f.filing_date}`);
      });
    }

    // Résumé
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 DIAGNOSTIC');
    console.log('═══════════════════════════════════════════════════════════');
    
    if (filingsWithoutCompanyId > 0) {
      console.log(`⚠️  ${filingsWithoutCompanyId.toLocaleString()} filings n'ont pas de company_id`);
      console.log(`💡 Ces filings ont un CIK mais pas de lien vers la table companies`);
      console.log(`💡 Solution: Créer un script pour mettre à jour les company_id manquants`);
    } else {
      console.log(`✅ Tous les filings ont un company_id`);
    }
    
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

checkCompanyIdInFilings().catch(console.error);
