/**
 * Script pour vérifier la présence des top entreprises SaaS dans Supabase
 * 
 * Recherche les entreprises de référence (Microsoft, Salesforce, Adobe, etc.)
 * et affiche leurs données : ticker, sector, category, événements earnings
 * 
 * Usage:
 *   npx tsx scripts/check_top_saas_companies.ts
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

// Parser manuellement le fichier .env si dotenv n'a pas fonctionné
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

// Vérifier les variables d'environnement
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erreur: SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Liste complète des 100 entreprises américaines les plus performantes (2026)
// Note: Certaines entreprises ont des variantes de ticker ou des CIKs spécifiques
const TOP_SAAS_COMPANIES = [
  // 1. Le Top 10 : Les Hyper-Géants (The Trillion Dollar Club)
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
  
  // 2. Technologie, Software & Cloud (11-40)
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
  
  // 3. Finance (41-53)
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
  
  // 4. Santé / Pharma (54-65)
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
  
  // 5. Consommation & Retail (66-78)
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
  
  // 6. Industrie / Énergie (79-88)
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
  
  // 7. Télécoms & Media (89-93)
  { ticker: 'VZ', name: 'Verizon', category: 'Télécoms' },
  { ticker: 'CMCSA', name: 'Comcast', category: 'Télécoms' },
  { ticker: 'TMUS', name: 'T-Mobile US', category: 'Télécoms' },
  { ticker: 'DIS', name: 'Disney', category: 'Télécoms' },
  { ticker: 'T', name: 'AT&T', category: 'Télécoms' },
  
  // 8. Nouveaux Entrants / Croissance 2026 (94-100)
  { ticker: 'DASH', name: 'DoorDash', category: 'Croissance 2026' },
  { ticker: 'MDB', name: 'MongoDB', category: 'Croissance 2026' },
  { ticker: 'DKNG', name: 'DraftKings', category: 'Croissance 2026' },
  { ticker: 'APP', name: 'AppLovin', category: 'Croissance 2026' },
  { ticker: 'VRT', name: 'Vertiv', category: 'Croissance 2026' },
  { ticker: 'ARM', name: 'ARM Holdings', category: 'Croissance 2026' },
  { ticker: 'SMCI', name: 'Super Micro Computer', category: 'Croissance 2026' },
];

async function checkTopSaaSCompanies() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Vérification des Top Entreprises SaaS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Recherche de ${TOP_SAAS_COMPANIES.length} entreprises...\n`);

  try {
    const tickers = TOP_SAAS_COMPANIES.map(c => c.ticker);
    
    // Normaliser les tickers (enlever les points, convertir en majuscules)
    const normalizedTickers = tickers.map(t => t.toUpperCase().replace(/\./g, ''));
    
    // Récupérer les entreprises avec recherche par ticker
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, ticker, name, cik, sector, industry, category, market_cap, sic_code')
      .in('ticker', tickers);
    
    // Si certaines entreprises ne sont pas trouvées, essayer avec les tickers normalisés
    const foundTickers = new Set((companies || []).map(c => c.ticker?.toUpperCase()));
    const missingCompanies = TOP_SAAS_COMPANIES.filter(c => !foundTickers.has(c.ticker.toUpperCase()));
    
    // Pour les entreprises manquantes, chercher par variantes de ticker, CIK ou nom
    let additionalCompanies: any[] = [];
    if (missingCompanies.length > 0) {
      // Récupérer toutes les entreprises pour recherche manuelle
      const { data: allCompanies } = await supabase
        .from('companies')
        .select('id, ticker, name, cik, sector, industry, category, market_cap, sic_code');
      
      for (const missing of missingCompanies) {
        const normalizedMissingTicker = missing.ticker.toUpperCase().replace(/\./g, '');
        let found: any = null;
        
        // 1. Chercher par CIK si fourni (priorité car plus fiable) - recherche directe dans Supabase
        if (missing.cik) {
          const { data: cikResult } = await supabase
            .from('companies')
            .select('id, ticker, name, cik, sector, industry, category, market_cap, sic_code')
            .eq('cik', missing.cik)
            .maybeSingle();
          if (cikResult) {
            found = cikResult;
          }
        }
        
        // 2. Chercher par variantes de ticker si pas encore trouvé
        if (!found && missing.tickerVariants) {
          for (const variant of missing.tickerVariants) {
            const { data: tickerResult } = await supabase
              .from('companies')
              .select('id, ticker, name, cik, sector, industry, category, market_cap, sic_code')
              .eq('ticker', variant.toUpperCase())
              .maybeSingle();
            if (tickerResult) {
              found = tickerResult;
              break;
            }
            // Essayer aussi avec tiret au lieu de point
            const variantWithDash = variant.toUpperCase().replace(/\./g, '-');
            if (variantWithDash !== variant.toUpperCase()) {
              const { data: tickerResult2 } = await supabase
                .from('companies')
                .select('id, ticker, name, cik, sector, industry, category, market_cap, sic_code')
                .eq('ticker', variantWithDash)
                .maybeSingle();
              if (tickerResult2) {
                found = tickerResult2;
                break;
              }
            }
          }
        }
        
        // 3. Chercher par variantes de nom si fourni et pas encore trouvé
        if (!found && missing.nameVariants) {
          for (const nameVariant of missing.nameVariants) {
            const { data: nameResult } = await supabase
              .from('companies')
              .select('id, ticker, name, cik, sector, industry, category, market_cap, sic_code')
              .ilike('name', `%${nameVariant}%`)
              .limit(1)
              .maybeSingle();
            if (nameResult) {
              found = nameResult;
              break;
            }
          }
        }
        
        // 4. Chercher par ticker normalisé (sans point/tiret) si pas encore trouvé
        if (!found) {
          const { data: normalizedResult } = await supabase
            .from('companies')
            .select('id, ticker, name, cik, sector, industry, category, market_cap, sic_code');
          if (normalizedResult) {
            found = normalizedResult.find(c => {
              const companyTicker = c.ticker?.toUpperCase().replace(/\./g, '').replace(/-/g, '') || '';
              return companyTicker === normalizedMissingTicker;
            });
          }
        }
        
        if (found && !additionalCompanies.find(c => c.id === found.id)) {
          additionalCompanies.push(found);
        }
      }
    }
    
    const foundCompanies = [...(companies || []), ...additionalCompanies];

    if (companiesError) {
      console.error(`❌ Erreur: ${companiesError.message}`);
      return;
    }

    // Récupérer les événements earnings pour ces entreprises
    const ciks = foundCompanies.map(c => c.cik).filter(Boolean);
    const { data: earningsStats, error: earningsError } = await supabase
      .from('earnings_calendar')
      .select('cik, ticker, filing_date')
      .in('cik', ciks.length > 0 ? ciks : ['']);

    // Compter les événements par CIK
    const earningsByCik: Record<string, { count: number; latestDate: string | null }> = {};
    earningsStats?.forEach((e: any) => {
      const cik = e.cik;
      if (!earningsByCik[cik]) {
        earningsByCik[cik] = { count: 0, latestDate: null };
      }
      earningsByCik[cik].count++;
      if (!earningsByCik[cik].latestDate || (e.filing_date && e.filing_date > earningsByCik[cik].latestDate!)) {
        earningsByCik[cik].latestDate = e.filing_date;
      }
    });

    // Créer un map ticker normalisé -> company
    const companiesMap = new Map();
    foundCompanies.forEach(c => {
      const normalizedTicker = c.ticker?.toUpperCase().replace(/\./g, '') || '';
      companiesMap.set(normalizedTicker, c);
      // Aussi mapper le ticker original
      if (c.ticker) {
        companiesMap.set(c.ticker.toUpperCase(), c);
      }
    });

    // Afficher les résultats par catégorie avec toutes les informations
    const categories = Array.from(new Set(TOP_SAAS_COMPANIES.map(c => c.category)));
    
    let found = 0;
    let notFound = 0;

    for (const category of categories) {
      const companiesInCategory = TOP_SAAS_COMPANIES.filter(c => c.category === category);
      console.log(`\n📂 ${category}`);
      console.log('═'.repeat(100));

      for (const expected of companiesInCategory) {
        // Essayer de trouver par ticker original puis par ticker normalisé
        const normalizedExpectedTicker = expected.ticker.toUpperCase().replace(/\./g, '');
        let company = companiesMap.get(expected.ticker.toUpperCase()) || 
                     companiesMap.get(normalizedExpectedTicker);
        
        // Si pas trouvé et qu'on a des variantes, essayer les variantes
        if (!company && expected.tickerVariants) {
          for (const variant of expected.tickerVariants) {
            const normalizedVariant = variant.toUpperCase().replace(/\./g, '');
            company = companiesMap.get(variant.toUpperCase()) || 
                     companiesMap.get(normalizedVariant);
            if (company) break;
          }
        }
        
        // Si pas trouvé et qu'on a un CIK, chercher par CIK
        if (!company && expected.cik) {
          company = companiesMap.get(`CIK_${expected.cik}`) || 
                    Array.from(companiesMap.values()).find(c => c.cik === expected.cik);
        }
        
        const earnings = company ? earningsByCik[company.cik] : null;

        if (company) {
          found++;
          const marketCapB = company.market_cap ? `$${(company.market_cap / 1_000_000_000).toFixed(2)}B` : 'N/A';
          console.log(`\n✅ ${expected.ticker.padEnd(8, ' ')} | ${company.name}`);
          console.log(`   📋 Ticker DB: ${company.ticker || 'N/A'}`);
          console.log(`   🆔 CIK: ${company.cik || 'N/A'}`);
          console.log(`   📊 Sector: ${company.sector || 'N/A'}`);
          console.log(`   🏭 Industry: ${company.industry || 'N/A'}`);
          console.log(`   📂 Category: ${company.category || 'N/A'}`);
          console.log(`   🔢 SIC Code: ${company.sic_code || 'N/A'}`);
          console.log(`   💰 Market Cap: ${marketCapB}`);
          console.log(`   📅 Earnings: ${earnings?.count || 0} événements${earnings?.latestDate ? ` (dernier: ${earnings.latestDate})` : ''}`);
          console.log(`   🌍 HQ Country: ${company.headquarters_country || 'N/A'}`);
          console.log(`   🌍 HQ State: ${company.headquarters_state || 'N/A'}`);
          console.log('   ' + '─'.repeat(95));
        } else {
          notFound++;
          console.log(`\n❌ ${expected.ticker.padEnd(8, ' ')} | ${expected.name.padEnd(50, ' ')} - NON TROUVÉ`);
          console.log('   ' + '─'.repeat(95));
        }
      }
    }

    // Résumé
    console.log('\n\n═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ Trouvées: ${found}/${TOP_SAAS_COMPANIES.length}`);
    console.log(`❌ Non trouvées: ${notFound}/${TOP_SAAS_COMPANIES.length}`);
    console.log(`📈 Taux de couverture: ${((found/TOP_SAAS_COMPANIES.length)*100).toFixed(1)}%`);

    if (notFound > 0) {
      console.log('\n❌ Entreprises non trouvées:');
      TOP_SAAS_COMPANIES.forEach(expected => {
        if (!companiesMap.has(expected.ticker)) {
          console.log(`   - ${expected.ticker}: ${expected.name}`);
        }
      });
    }

    // Statistiques des entreprises trouvées
    if (found > 0) {
      const foundCompanies = Array.from(companiesMap.values());
      const withSector = foundCompanies.filter(c => c.sector).length;
      const withCategory = foundCompanies.filter(c => c.category).length;
      const withMarketCap = foundCompanies.filter(c => c.market_cap).length;
      const totalEarnings = foundCompanies.reduce((sum, c) => sum + (earningsByCik[c.cik]?.count || 0), 0);

      console.log('\n📊 Statistiques des entreprises trouvées:');
      console.log(`   🏢 Avec sector: ${withSector}/${found} (${((withSector/found)*100).toFixed(1)}%)`);
      console.log(`   📂 Avec category: ${withCategory}/${found} (${((withCategory/found)*100).toFixed(1)}%)`);
      console.log(`   💰 Avec market cap: ${withMarketCap}/${found} (${((withMarketCap/found)*100).toFixed(1)}%)`);
      console.log(`   📅 Total événements earnings: ${totalEarnings}`);
    }

    console.log('\n✅ Vérification terminée !');

  } catch (error: any) {
    console.error('\n❌ Erreur fatale:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécuter le script
checkTopSaaSCompanies().catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});
