/**
 * Script pour analyser pourquoi certaines entreprises enrichies n'ont pas de filings
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

const SEC_BASE_URL = 'https://data.sec.gov/submissions';
const USER_AGENT = 'Souhail souhailsouidpro@gmail.com';

interface SECSubmission {
  filings?: {
    recent?: {
      form?: string[];
      filingDate?: string[];
      items?: string[];
      accessionNumber?: string[];
    };
  };
}

function padCik(cik: string): string {
  const numericCik = cik.replace(/^0+/, '') || '0';
  return `CIK${numericCik.padStart(10, '0')}`;
}

async function fetchSecData(cik: string): Promise<SECSubmission | null> {
  try {
    const paddedCik = padCik(cik);
    const url = `${SEC_BASE_URL}/${paddedCik}.json`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      if (response.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchSecData(cik);
      }
      return null;
    }

    return await response.json();
  } catch (error: any) {
    return null;
  }
}

async function analyzeMissingFilings() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Analyse des entreprises enrichies sans filings');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Récupérer toutes les entreprises enrichies
    const { data: enrichedCompanies } = await supabase
      .from('companies')
      .select('id, ticker, name, cik, ein')
      .not('ein', 'is', null)
      .order('cik', { ascending: true });

    if (!enrichedCompanies || enrichedCompanies.length === 0) {
      console.log('❌ Aucune entreprise enrichie trouvée');
      return;
    }

    // 2. Récupérer les entreprises qui ont des filings
    const { data: companiesWithFilings } = await supabase
      .from('company_filings')
      .select('cik')
      .limit(100000);

    const ciksWithFilings = new Set(companiesWithFilings?.map(f => f.cik) || []);

    // 3. Identifier les entreprises enrichies sans filings
    const companiesWithoutFilings = enrichedCompanies.filter(c => !ciksWithFilings.has(c.cik));

    console.log(`📊 STATISTIQUES\n`);
    console.log(`Entreprises enrichies totales: ${enrichedCompanies.length}`);
    console.log(`Entreprises avec filings: ${ciksWithFilings.size}`);
    console.log(`Entreprises enrichies SANS filings: ${companiesWithoutFilings.length}\n`);

    // 4. Analyser un échantillon (10 entreprises)
    const sampleSize = Math.min(10, companiesWithoutFilings.length);
    const sample = companiesWithoutFilings.slice(0, sampleSize);

    console.log(`🔍 ANALYSE D'UN ÉCHANTILLON (${sampleSize} entreprises)\n`);

    let companiesWithAvailableFilings = 0;
    let companiesWithoutAvailableFilings = 0;
    let companiesWithError = 0;

    const targetFormTypes = ['8-K', '10-Q', '10-K', 'DEF 14A', '4'];

    for (const company of sample) {
      console.log(`\n[${sample.indexOf(company) + 1}/${sampleSize}] ${company.ticker} - ${company.name}`);
      console.log(`   CIK: ${company.cik}`);

      const secData = await fetchSecData(company.cik);
      
      if (!secData) {
        console.log(`   ❌ Données SEC non disponibles`);
        companiesWithError++;
        await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
        continue;
      }

      if (!secData.filings?.recent) {
        console.log(`   ⚠️  Aucun filing récent dans les données SEC`);
        companiesWithoutAvailableFilings++;
        await new Promise(resolve => setTimeout(resolve, 200));
        continue;
      }

      const recent = secData.filings.recent;
      const formTypes = recent.form || [];
      
      // Compter les filings des types ciblés
      const targetFilings = formTypes.filter(form => targetFormTypes.includes(form));
      const totalFilings = formTypes.length;

      console.log(`   📋 Total filings dans SEC: ${totalFilings}`);
      console.log(`   📋 Filings ciblés (${targetFormTypes.join(', ')}): ${targetFilings.length}`);

      if (targetFilings.length > 0) {
        console.log(`   ✅ Filings disponibles mais non stockés`);
        companiesWithAvailableFilings++;
        
        // Afficher quelques exemples
        const filingBreakdown: Record<string, number> = {};
        targetFilings.forEach(form => {
          filingBreakdown[form] = (filingBreakdown[form] || 0) + 1;
        });
        
        console.log(`   Répartition: ${Object.entries(filingBreakdown).map(([type, count]) => `${type}:${count}`).join(', ')}`);
      } else {
        console.log(`   ⚠️  Aucun filing des types ciblés`);
        companiesWithoutAvailableFilings++;
      }

      await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
    }

    // Résumé
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ DE L\'ANALYSE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Entreprises analysées: ${sampleSize}`);
    console.log(`✅ Avec filings disponibles: ${companiesWithAvailableFilings}`);
    console.log(`⚠️  Sans filings ciblés: ${companiesWithoutAvailableFilings}`);
    console.log(`❌ Erreurs API: ${companiesWithError}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Diagnostic
    console.log('💡 DIAGNOSTIC\n');
    
    if (companiesWithAvailableFilings > 0) {
      console.log(`⚠️  ${companiesWithAvailableFilings} entreprises ont des filings disponibles mais non stockés`);
      console.log(`💡 Raison possible:`);
      console.log(`   - Le script a été interrompu avant de traiter ces entreprises`);
      console.log(`   - Erreur lors de l'insertion des filings`);
      console.log(`   - Les filings ont été filtrés (doublons, etc.)`);
      console.log(`\n💡 Solution:`);
      console.log(`   - Relancer le script enrich_companies_from_sec.ts`);
      console.log(`   - Utiliser --start-from pour reprendre depuis ces entreprises`);
    }
    
    if (companiesWithoutAvailableFilings > 0) {
      console.log(`\n✅ ${companiesWithoutAvailableFilings} entreprises n'ont pas de filings des types ciblés`);
      console.log(`   C'est normal : certaines entreprises n'ont pas de 8-K, 10-K, etc. récents`);
    }

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

analyzeMissingFilings().catch(console.error);
