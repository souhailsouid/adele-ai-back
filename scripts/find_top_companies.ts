/**
 * Script pour trouver les entreprises les plus performantes
 * 
 * Recherche les entreprises selon différents critères de performance :
 * - Market cap
 * - Nombre d'événements earnings
 * - Récence des données
 * 
 * Usage:
 *   npx tsx scripts/find_top_companies.ts [--limit=100] [--sort-by=market_cap|earnings_count|recent]
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

// Configuration
const DEFAULT_LIMIT = 100;
const args = process.argv.slice(2);
const limitArg = args.find(arg => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : DEFAULT_LIMIT;
const sortByArg = args.find(arg => arg.startsWith('--sort-by='));
const sortBy = sortByArg ? sortByArg.split('=')[1] : 'earnings_count';

// Vérifier les variables d'environnement
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erreur: SUPABASE_URL et SUPABASE_SERVICE_KEY sont requis');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface CompanyWithStats {
  id: number;
  ticker: string;
  name: string;
  cik: string;
  sector: string | null;
  industry: string | null;
  category: string | null;
  market_cap: number | null;
  sic_code: string | null;
  earnings_count: number;
  latest_earnings_date: string | null;
}

async function findTopCompanies() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🏆 Top 100 Entreprises les Plus Performantes');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Critère de tri: ${sortBy}`);
  console.log(`📈 Limite: ${limit} entreprises`);
  console.log('');

  try {
    let companies: CompanyWithStats[] = [];

    if (sortBy === 'earnings_count') {
      // Trier par nombre d'événements earnings
      const { data: earningsStats, error: earningsError } = await supabase
        .from('earnings_calendar')
        .select('cik, ticker, filing_date')
        .not('cik', 'is', null);

      if (earningsError) {
        console.error(`❌ Erreur lors de la récupération des earnings: ${earningsError.message}`);
        return;
      }

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

      // Récupérer les entreprises avec leurs stats
      const { data: allCompanies, error: companiesError } = await supabase
        .from('companies')
        .select('id, ticker, name, cik, sector, industry, category, market_cap, sic_code')
        .not('ticker', 'is', null)
        .limit(10000); // Limiter pour performance

      if (companiesError) {
        console.error(`❌ Erreur: ${companiesError.message}`);
        return;
      }

      // Combiner les données
      companies = (allCompanies || []).map((c: any) => ({
        ...c,
        earnings_count: earningsByCik[c.cik]?.count || 0,
        latest_earnings_date: earningsByCik[c.cik]?.latestDate || null,
      }));

      // Filtrer les entreprises avec au moins 1 événement earnings
      companies = companies.filter(c => c.earnings_count > 0);
      
      // Trier par nombre d'événements earnings (décroissant)
      companies.sort((a, b) => b.earnings_count - a.earnings_count);

    } else if (sortBy === 'market_cap') {
      // Trier par market cap
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, ticker, name, cik, sector, industry, category, market_cap, sic_code')
        .not('ticker', 'is', null)
        .not('market_cap', 'is', null)
        .order('market_cap', { ascending: false })
        .limit(limit);

      if (companiesError) {
        console.error(`❌ Erreur: ${companiesError.message}`);
        return;
      }

      // Compter les événements earnings pour chaque entreprise
      const ciks = (companiesData || []).map((c: any) => c.cik);
      const { data: earningsStats } = await supabase
        .from('earnings_calendar')
        .select('cik, filing_date')
        .in('cik', ciks);

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

      companies = (companiesData || []).map((c: any) => ({
        ...c,
        earnings_count: earningsByCik[c.cik]?.count || 0,
        latest_earnings_date: earningsByCik[c.cik]?.latestDate || null,
      }));

    } else if (sortBy === 'recent') {
      // Trier par récence des événements earnings
      const { data: recentEarnings, error: earningsError } = await supabase
        .from('earnings_calendar')
        .select('cik, ticker, filing_date')
        .not('cik', 'is', null)
        .order('filing_date', { ascending: false })
        .limit(10000);

      if (earningsError) {
        console.error(`❌ Erreur: ${earningsError.message}`);
        return;
      }

      // Compter les événements par CIK et trouver la date la plus récente
      const earningsByCik: Record<string, { count: number; latestDate: string | null }> = {};
      recentEarnings?.forEach((e: any) => {
        const cik = e.cik;
        if (!earningsByCik[cik]) {
          earningsByCik[cik] = { count: 0, latestDate: null };
        }
        earningsByCik[cik].count++;
        if (!earningsByCik[cik].latestDate || (e.filing_date && e.filing_date > earningsByCik[cik].latestDate!)) {
          earningsByCik[cik].latestDate = e.filing_date;
        }
      });

      // Récupérer les entreprises
      const ciks = Object.keys(earningsByCik);
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, ticker, name, cik, sector, industry, category, market_cap, sic_code')
        .in('cik', ciks)
        .limit(10000);

      if (companiesError) {
        console.error(`❌ Erreur: ${companiesError.message}`);
        return;
      }

      companies = (companiesData || []).map((c: any) => ({
        ...c,
        earnings_count: earningsByCik[c.cik]?.count || 0,
        latest_earnings_date: earningsByCik[c.cik]?.latestDate || null,
      }));

      // Trier par date la plus récente
      companies.sort((a, b) => {
        if (!a.latest_earnings_date) return 1;
        if (!b.latest_earnings_date) return -1;
        return b.latest_earnings_date.localeCompare(a.latest_earnings_date);
      });
    }

    // Limiter aux top N
    const topCompanies = companies.slice(0, limit);

    // Afficher les résultats
    console.log(`\n🏆 Top ${topCompanies.length} entreprises :\n`);

    topCompanies.forEach((company, index) => {
      console.log(`${(index + 1).toString().padStart(3, ' ')}. ${company.ticker?.padEnd(8, ' ')} | ${company.name.substring(0, 50).padEnd(50, ' ')}`);
      console.log(`     📊 Sector: ${company.sector || 'N/A'}, Category: ${company.category || 'N/A'}`);
      if (sortBy === 'market_cap' && company.market_cap) {
        const marketCapB = (company.market_cap / 1_000_000_000).toFixed(2);
        console.log(`     💰 Market Cap: $${marketCapB}B`);
      }
      console.log(`     📅 Earnings: ${company.earnings_count} événements`);
      if (company.latest_earnings_date) {
        console.log(`     📆 Dernier earnings: ${company.latest_earnings_date}`);
      }
      console.log('');
    });

    // Statistiques globales
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 STATISTIQUES');
    console.log('═══════════════════════════════════════════════════════════');
    
    const withCategory = topCompanies.filter(c => c.category).length;
    const withSector = topCompanies.filter(c => c.sector).length;
    const withMarketCap = topCompanies.filter(c => c.market_cap).length;
    const avgEarnings = topCompanies.reduce((sum, c) => sum + c.earnings_count, 0) / topCompanies.length;

    console.log(`📂 Avec category: ${withCategory}/${topCompanies.length} (${((withCategory/topCompanies.length)*100).toFixed(1)}%)`);
    console.log(`🏢 Avec sector: ${withSector}/${topCompanies.length} (${((withSector/topCompanies.length)*100).toFixed(1)}%)`);
    console.log(`💰 Avec market cap: ${withMarketCap}/${topCompanies.length} (${((withMarketCap/topCompanies.length)*100).toFixed(1)}%)`);
    console.log(`📅 Événements earnings moyens: ${avgEarnings.toFixed(1)}`);

    // Répartition par category
    const categoryCounts: Record<string, number> = {};
    topCompanies.forEach(c => {
      const cat = c.category || 'N/A';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    console.log('\n📊 Répartition par category:');
    Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count} (${((count/topCompanies.length)*100).toFixed(1)}%)`);
      });

    console.log('\n✅ Recherche terminée !');

  } catch (error: any) {
    console.error('\n❌ Erreur fatale:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécuter le script
findTopCompanies().catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});
