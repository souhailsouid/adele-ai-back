/**
 * Script pour vérifier le nombre de filings détectés pour les 100 entreprises les plus performantes
 * 
 * Usage:
 *   npx tsx scripts/check_filings_count_top_companies.ts [--limit=10]
 */

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

// Liste des 100 entreprises (même liste que check_top_saas_companies.ts)
const TOP_COMPANIES = [
  { ticker: 'NVDA', name: 'NVIDIA', category: 'Hyper-Géants' },
  { ticker: 'GOOGL', name: 'Alphabet', category: 'Hyper-Géants' },
  { ticker: 'AAPL', name: 'Apple', category: 'Hyper-Géants' },
  { ticker: 'MSFT', name: 'Microsoft', category: 'Hyper-Géants' },
  { ticker: 'AMZN', name: 'Amazon', category: 'Hyper-Géants' },
  { ticker: 'META', name: 'Meta Platforms', category: 'Hyper-Géants' },
  { ticker: 'AVGO', name: 'Broadcom', category: 'Hyper-Géants' },
  { ticker: 'TSLA', name: 'Tesla', category: 'Hyper-Géants' },
  { ticker: 'BRK.B', name: 'Berkshire Hathaway', category: 'Hyper-Géants', cik: '0001067983', tickerVariants: ['BRKB', 'BRK B', 'BRK.B', 'BRK-B'] },
  { ticker: 'LLY', name: 'Eli Lilly', category: 'Hyper-Géants' },
  { ticker: 'ORCL', name: 'Oracle', category: 'Tech & Cloud' },
  { ticker: 'CRM', name: 'Salesforce', category: 'Tech & Cloud' },
  { ticker: 'ADBE', name: 'Adobe', category: 'Tech & Cloud' },
  { ticker: 'NOW', name: 'ServiceNow', category: 'Tech & Cloud' },
  { ticker: 'NFLX', name: 'Netflix', category: 'Tech & Cloud' },
  { ticker: 'INTC', name: 'Intel', category: 'Tech & Cloud' },
  { ticker: 'AMD', name: 'AMD', category: 'Tech & Cloud' },
  { ticker: 'QCOM', name: 'Qualcomm', category: 'Tech & Cloud' },
  { ticker: 'IBM', name: 'IBM', category: 'Tech & Cloud' },
  { ticker: 'INTU', name: 'Intuit', category: 'Tech & Cloud' },
  { ticker: 'PLTR', name: 'Palantir', category: 'Tech & Cloud' },
  { ticker: 'SNOW', name: 'Snowflake', category: 'Tech & Cloud' },
  { ticker: 'DDOG', name: 'Datadog', category: 'Tech & Cloud' },
  { ticker: 'CRWD', name: 'CrowdStrike', category: 'Tech & Cloud' },
  { ticker: 'PANW', name: 'Palo Alto Networks', category: 'Tech & Cloud' },
  { ticker: 'UBER', name: 'Uber', category: 'Tech & Cloud' },
  { ticker: 'ABNB', name: 'Airbnb', category: 'Tech & Cloud' },
  { ticker: 'BKNG', name: 'Booking Holdings', category: 'Tech & Cloud' },
  { ticker: 'ANET', name: 'Arista Networks', category: 'Tech & Cloud' },
  { ticker: 'WDAY', name: 'Workday', category: 'Tech & Cloud' },
  { ticker: 'SNPS', name: 'Synopsys', category: 'Tech & Cloud' },
  { ticker: 'CDNS', name: 'Cadence Design', category: 'Tech & Cloud' },
  { ticker: 'ADSK', name: 'Autodesk', category: 'Tech & Cloud' },
  { ticker: 'TEAM', name: 'Atlassian', category: 'Tech & Cloud' },
  { ticker: 'SHOP', name: 'Shopify', category: 'Tech & Cloud' },
  { ticker: 'PDD', name: 'Pinduoduo', category: 'Tech & Cloud' },
  { ticker: 'MELI', name: 'MercadoLibre', category: 'Tech & Cloud' },
  { ticker: 'SQ', name: 'Block (Square)', category: 'Tech & Cloud', cik: '0001512673', tickerVariants: ['XYZ'], nameVariants: ['Block, Inc.', 'Block Inc'] },
  { ticker: 'NET', name: 'Cloudflare', category: 'Tech & Cloud' },
  { ticker: 'HUBS', name: 'HubSpot', category: 'Tech & Cloud' },
  { ticker: 'JPM', name: 'JPMorgan Chase', category: 'Finance' },
  { ticker: 'V', name: 'Visa', category: 'Finance' },
  { ticker: 'MA', name: 'Mastercard', category: 'Finance' },
  { ticker: 'BAC', name: 'Bank of America', category: 'Finance' },
  { ticker: 'GS', name: 'Goldman Sachs', category: 'Finance' },
  { ticker: 'MS', name: 'Morgan Stanley', category: 'Finance' },
  { ticker: 'WFC', name: 'Wells Fargo', category: 'Finance' },
  { ticker: 'AXP', name: 'American Express', category: 'Finance' },
  { ticker: 'SPGI', name: 'S&P Global', category: 'Finance' },
  { ticker: 'BLK', name: 'BlackRock', category: 'Finance' },
  { ticker: 'C', name: 'Citigroup', category: 'Finance' },
  { ticker: 'PYPL', name: 'PayPal', category: 'Finance' },
  { ticker: 'PGR', name: 'Progressive', category: 'Finance' },
  { ticker: 'UNH', name: 'UnitedHealth Group', category: 'Santé' },
  { ticker: 'JNJ', name: 'Johnson & Johnson', category: 'Santé' },
  { ticker: 'MRK', name: 'Merck', category: 'Santé' },
  { ticker: 'ABBV', name: 'AbbVie', category: 'Santé' },
  { ticker: 'PFE', name: 'Pfizer', category: 'Santé' },
  { ticker: 'TMO', name: 'Thermo Fisher', category: 'Santé' },
  { ticker: 'DHR', name: 'Danaher', category: 'Santé' },
  { ticker: 'AMGN', name: 'Amgen', category: 'Santé' },
  { ticker: 'ISRG', name: 'Intuitive Surgical', category: 'Santé' },
  { ticker: 'SYK', name: 'Stryker', category: 'Santé' },
  { ticker: 'ABT', name: 'Abbott', category: 'Santé' },
  { ticker: 'CVS', name: 'CVS Health', category: 'Santé' },
  { ticker: 'WMT', name: 'Walmart', category: 'Consommation' },
  { ticker: 'COST', name: 'Costco', category: 'Consommation' },
  { ticker: 'HD', name: 'Home Depot', category: 'Consommation' },
  { ticker: 'MCD', name: 'McDonald\'s', category: 'Consommation' },
  { ticker: 'KO', name: 'Coca-Cola', category: 'Consommation' },
  { ticker: 'PEP', name: 'PepsiCo', category: 'Consommation' },
  { ticker: 'PG', name: 'Procter & Gamble', category: 'Consommation' },
  { ticker: 'NKE', name: 'Nike', category: 'Consommation' },
  { ticker: 'LOW', name: 'Lowe\'s', category: 'Consommation' },
  { ticker: 'SBUX', name: 'Starbucks', category: 'Consommation' },
  { ticker: 'TGT', name: 'Target', category: 'Consommation' },
  { ticker: 'MDLZ', name: 'Mondelez', category: 'Consommation' },
  { ticker: 'XOM', name: 'Exxon Mobil', category: 'Industrie' },
  { ticker: 'CVX', name: 'Chevron', category: 'Industrie' },
  { ticker: 'GE', name: 'GE Aerospace', category: 'Industrie' },
  { ticker: 'CAT', name: 'Caterpillar', category: 'Industrie' },
  { ticker: 'HON', name: 'Honeywell', category: 'Industrie' },
  { ticker: 'LMT', name: 'Lockheed Martin', category: 'Industrie' },
  { ticker: 'UNP', name: 'Union Pacific', category: 'Industrie' },
  { ticker: 'BA', name: 'Boeing', category: 'Industrie' },
  { ticker: 'RTX', name: 'RTX Corporation', category: 'Industrie' },
  { ticker: 'DE', name: 'Deere & Co', category: 'Industrie' },
  { ticker: 'VZ', name: 'Verizon', category: 'Télécoms' },
  { ticker: 'CMCSA', name: 'Comcast', category: 'Télécoms' },
  { ticker: 'TMUS', name: 'T-Mobile US', category: 'Télécoms' },
  { ticker: 'DIS', name: 'Disney', category: 'Télécoms' },
  { ticker: 'T', name: 'AT&T', category: 'Télécoms' },
  { ticker: 'DASH', name: 'DoorDash', category: 'Croissance 2026' },
  { ticker: 'MDB', name: 'MongoDB', category: 'Croissance 2026' },
  { ticker: 'DKNG', name: 'DraftKings', category: 'Croissance 2026' },
  { ticker: 'APP', name: 'AppLovin', category: 'Croissance 2026' },
  { ticker: 'VRT', name: 'Vertiv', category: 'Croissance 2026' },
  { ticker: 'ARM', name: 'ARM Holdings', category: 'Croissance 2026' },
  { ticker: 'SMCI', name: 'Super Micro Computer', category: 'Croissance 2026' },
];

// Configuration API SEC
const SEC_BASE_URL = 'https://data.sec.gov/submissions';
const USER_AGENT = 'Souhail souhailsouidpro@gmail.com';
const RATE_LIMIT_MS = 200;

interface SECSubmission {
  cik: string;
  name: string;
  filings?: {
    recent?: {
      form?: string[];
      accessionNumber?: string[];
      filingDate?: string[];
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
      if (response.status === 404) return null;
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

function countFilings(secData: SECSubmission): { total: number; byType: Record<string, number> } {
  if (!secData.filings?.recent) {
    return { total: 0, byType: {} };
  }

  const recent = secData.filings.recent;
  const formTypes = recent.form || [];
  const targetFormTypes = ['8-K', '10-Q', '10-K', 'DEF 14A', '4'];

  const byType: Record<string, number> = {};
  let total = 0;

  for (const formType of formTypes) {
    if (targetFormTypes.includes(formType)) {
      byType[formType] = (byType[formType] || 0) + 1;
      total++;
    }
  }

  return { total, byType };
}

async function checkFilingsCount() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Vérification des filings pour les Top 100 entreprises');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Configuration:`);
  console.log(`   - Limit: ${limit || 'Toutes (99 entreprises)'}`);
  console.log(`   - Rate Limit: ${RATE_LIMIT_MS}ms entre chaque requête\n`);

  const companiesToCheck = limit ? TOP_COMPANIES.slice(0, limit) : TOP_COMPANIES;
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl!, supabaseKey!);

  let processed = 0;
  let found = 0;
  let notFound = 0;
  let totalFilings = 0;
  const filingsByType: Record<string, number> = {};
  const results: Array<{ ticker: string; name: string; cik: string; filings: number; byType: Record<string, number> }> = [];

  for (const company of companiesToCheck) {
    processed++;
    
    // Récupérer le CIK depuis la base de données
    let cik = company.cik;
    if (!cik) {
      const normalizedTicker = company.ticker.toUpperCase().replace(/\./g, '');
      const { data: dbCompany } = await supabase
        .from('companies')
        .select('cik')
        .or(`ticker.eq.${company.ticker},ticker.eq.${normalizedTicker}`)
        .maybeSingle();
      
      if (dbCompany) {
        cik = dbCompany.cik;
      } else if (company.tickerVariants) {
        // Essayer les variantes
        for (const variant of company.tickerVariants) {
          const { data: dbCompany2 } = await supabase
            .from('companies')
            .select('cik')
            .eq('ticker', variant.toUpperCase())
            .maybeSingle();
          if (dbCompany2) {
            cik = dbCompany2.cik;
            break;
          }
        }
      }
    }

    if (!cik) {
      console.log(`[${processed}/${companiesToCheck.length}] ❌ ${company.ticker} - CIK non trouvé`);
      notFound++;
      continue;
    }

    console.log(`[${processed}/${companiesToCheck.length}] ${company.ticker} - ${company.name} (CIK: ${cik})`);
    
    const secData = await fetchSecData(cik);
    
    if (!secData) {
      console.log(`   ⚠️  Données SEC non disponibles`);
      notFound++;
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
      continue;
    }

    const { total, byType } = countFilings(secData);
    totalFilings += total;
    results.push({ ticker: company.ticker, name: company.name, cik, filings: total, byType });

    for (const [formType, count] of Object.entries(byType)) {
      filingsByType[formType] = (filingsByType[formType] || 0) + count;
    }

    console.log(`   ✅ ${total} filings détectés (${Object.entries(byType).map(([t, c]) => `${t}:${c}`).join(', ')})`);
    found++;

    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS));
  }

  // Résumé
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📊 RÉSUMÉ');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Entreprises trouvées: ${found}/${processed}`);
  console.log(`❌ Entreprises non trouvées: ${notFound}/${processed}`);
  console.log(`📋 Total filings détectés: ${totalFilings.toLocaleString()}`);
  console.log(`📊 Moyenne par entreprise: ${found > 0 ? Math.round(totalFilings / found) : 0} filings`);
  console.log(`\n📈 Répartition par type:`);
  for (const [formType, count] of Object.entries(filingsByType).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${formType.padEnd(8)}: ${count.toLocaleString().padStart(6)} filings (${Math.round(count / totalFilings * 100)}%)`);
  }

  // Top 10 entreprises avec le plus de filings
  console.log(`\n🏆 Top 10 entreprises avec le plus de filings:`);
  results
    .sort((a, b) => b.filings - a.filings)
    .slice(0, 10)
    .forEach((r, i) => {
      console.log(`   ${(i + 1).toString().padStart(2)}. ${r.ticker.padEnd(8)} - ${r.name.substring(0, 40).padEnd(40)} : ${r.filings.toLocaleString().padStart(5)} filings`);
    });

  console.log('═══════════════════════════════════════════════════════════\n');
}

checkFilingsCount().catch(console.error);
