/**
 * Script pour analyser l'utilisation actuelle de Supabase et estimer les besoins futurs
 * 
 * Usage:
 *   npx tsx scripts/analyze_supabase_plan_usage.ts
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

// Plans Supabase (2025) - Source: supabase.com
const SUPABASE_PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    databaseSize: 500, // MB
    fileStorage: 1, // GB
    bandwidth: 5, // GB/mois
    databaseConnections: 60,
    apiRequests: 'Unlimited',
    authUsers: 50000,
    edgeFunctions: 2,
    edgeFunctionInvocations: 500000, // /mois
    realtimeMessages: 2000000, // /mois
  },
  PRO: {
    name: 'Pro',
    price: 25, // $/mois (base)
    databaseSize: 8, // GB (inclus)
    fileStorage: 100, // GB (inclus)
    bandwidth: 250, // GB/mois (inclus)
    databaseConnections: 200,
    apiRequests: 'Unlimited',
    authUsers: 100000, // inclus
    edgeFunctions: 50,
    edgeFunctionInvocations: 2000000, // /mois (inclus)
    realtimeMessages: 5000000, // /mois (inclus)
    // Frais supplémentaires:
    databaseOverage: 0.125, // $/GB/mois
    fileStorageOverage: 0.021, // $/GB/mois
    bandwidthOverage: 0.09, // $/GB/mois
    authUsersOverage: 0.00325, // $/user/mois
  },
  TEAM: {
    name: 'Team',
    price: 599, // $/mois
    databaseSize: 8, // GB (inclus, même que Pro)
    fileStorage: 100, // GB (inclus)
    bandwidth: 250, // GB/mois (inclus)
    databaseConnections: 400,
    apiRequests: 'Unlimited',
    authUsers: 100000,
    edgeFunctions: 100,
    edgeFunctionInvocations: 5000000, // /mois
    realtimeMessages: 10000000, // /mois
  },
};

async function analyzeSupabasePlanUsage() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 Analyse de l\'utilisation Supabase et besoins futurs');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 1. Compter les données actuelles
    console.log('📈 DONNÉES ACTUELLES\n');

    const { count: totalCompanies } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });

    const { count: totalFilings } = await supabase
      .from('company_filings')
      .select('*', { count: 'exact', head: true });

    const { count: totalFundFilings } = await supabase
      .from('fund_filings')
      .select('*', { count: 'exact', head: true });

    const { count: totalFundHoldings } = await supabase
      .from('fund_holdings')
      .select('*', { count: 'exact', head: true });

    const { count: totalNotifications } = await supabase
      .from('fund_notifications')
      .select('*', { count: 'exact', head: true });

    // Vérifier si d'autres tables existent
    const { count: earningsCalendar } = await supabase
      .from('earnings_calendar')
      .select('*', { count: 'exact', head: true })
      .then(r => r.count)
      .catch(() => 0);

    console.log(`Entreprises (companies): ${totalCompanies?.toLocaleString() || 0}`);
    console.log(`Filings SEC (company_filings): ${totalFilings?.toLocaleString() || 0}`);
    console.log(`Filings 13F (fund_filings): ${totalFundFilings?.toLocaleString() || 0}`);
    console.log(`Holdings 13F (fund_holdings): ${totalFundHoldings?.toLocaleString() || 0}`);
    console.log(`Notifications: ${totalNotifications?.toLocaleString() || 0}`);
    console.log(`Earnings Calendar: ${earningsCalendar?.toLocaleString() || 0}\n`);

    // 2. Estimer la taille des données (approximation)
    console.log('💾 ESTIMATION DE LA TAILLE DES DONNÉES\n');

    // Taille moyenne par enregistrement (approximation)
    const avgSizePerCompany = 2; // KB
    const avgSizePerFiling = 1; // KB (métadonnées seulement)
    const avgSizePerFundFiling = 5; // KB
    const avgSizePerHolding = 0.5; // KB
    const avgSizePerNotification = 1; // KB
    const avgSizePerEarningsEvent = 0.5; // KB

    const currentStorageMB = (
      (totalCompanies || 0) * avgSizePerCompany +
      (totalFilings || 0) * avgSizePerFiling +
      (totalFundFilings || 0) * avgSizePerFundFiling +
      (totalFundHoldings || 0) * avgSizePerHolding +
      (totalNotifications || 0) * avgSizePerNotification +
      (earningsCalendar || 0) * avgSizePerEarningsEvent
    ) / 1024; // Convertir en MB

    console.log(`Stockage actuel estimé: ~${currentStorageMB.toFixed(2)} MB\n`);

    // 3. Estimer les besoins futurs
    console.log('🔮 ESTIMATION DES BESOINS FUTURS\n');

    // Scénarios
    const scenarios = {
      conservative: {
        name: 'Conservateur',
        companies: 10000,
        secFilings: 10000000, // 10M filings SEC (avec tous les types)
        fundFilings: 50000, // 50k filings 13F
        fundHoldings: 5000000, // 5M holdings
        notifications: 100000,
        earningsEvents: 100000,
        news: 0, // Pas encore implémenté
      },
      realistic: {
        name: 'Réaliste',
        companies: 20000,
        secFilings: 20000000, // 20M filings SEC
        fundFilings: 100000, // 100k filings 13F
        fundHoldings: 10000000, // 10M holdings
        notifications: 500000,
        earningsEvents: 500000,
        news: 1000000, // 1M articles de news
      },
      aggressive: {
        name: 'Agressif',
        companies: 50000,
        secFilings: 50000000, // 50M filings SEC
        fundFilings: 500000, // 500k filings 13F
        fundHoldings: 50000000, // 50M holdings
        notifications: 2000000,
        earningsEvents: 2000000,
        news: 10000000, // 10M articles de news
      },
    };

    Object.entries(scenarios).forEach(([key, scenario]) => {
      const futureStorageMB = (
        scenario.companies * avgSizePerCompany +
        scenario.secFilings * avgSizePerFiling +
        scenario.fundFilings * avgSizePerFundFiling +
        scenario.fundHoldings * avgSizePerHolding +
        scenario.notifications * avgSizePerNotification +
        scenario.earningsEvents * avgSizePerEarningsEvent +
        scenario.news * 5 // 5 KB par article de news
      ) / 1024; // Convertir en MB

      const futureStorageGB = futureStorageMB / 1024;

      console.log(`📊 Scénario ${scenario.name}:`);
      console.log(`   - Entreprises: ${scenario.companies.toLocaleString()}`);
      console.log(`   - Filings SEC: ${scenario.secFilings.toLocaleString()}`);
      console.log(`   - Filings 13F: ${scenario.fundFilings.toLocaleString()}`);
      console.log(`   - Holdings: ${scenario.fundHoldings.toLocaleString()}`);
      console.log(`   - News: ${scenario.news.toLocaleString()}`);
      console.log(`   - Stockage estimé: ~${futureStorageGB.toFixed(2)} GB (${futureStorageMB.toFixed(2)} MB)\n`);
    });

    // 4. Comparer avec les plans Supabase
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💰 COMPARAISON DES PLANS SUPABASE');
    console.log('═══════════════════════════════════════════════════════════\n');

    Object.entries(SUPABASE_PLANS).forEach(([key, plan]) => {
      const isCurrentPlan = key === 'FREE'; // À adapter selon ton plan actuel
      
      console.log(`${isCurrentPlan ? '👉 ' : '   '}Plan ${plan.name} - $${plan.price}/mois`);
      // Afficher correctement MB vs GB
      if (plan.databaseSize < 1) {
        console.log(`   Base de données: ${plan.databaseSize} MB`);
      } else {
        console.log(`   Base de données: ${plan.databaseSize} GB`);
      }
      console.log(`   Stockage fichiers: ${plan.fileStorage} GB`);
      console.log(`   Bandwidth: ${plan.bandwidth} GB/mois`);
      console.log(`   Connexions DB: ${plan.databaseConnections}`);
      console.log(`   Edge Functions: ${plan.edgeFunctions}`);
      console.log(`   Invocations: ${plan.edgeFunctionInvocations.toLocaleString()}/mois`);
      if (plan.databaseOverage) {
        console.log(`   ⚠️  Frais supplémentaires:`);
        console.log(`      - DB: $${plan.databaseOverage}/GB au-delà de ${plan.databaseSize} GB`);
        console.log(`      - Fichiers: $${plan.fileStorageOverage}/GB au-delà de ${plan.fileStorage} GB`);
        console.log(`      - Bandwidth: $${plan.bandwidthOverage}/GB au-delà de ${plan.bandwidth} GB`);
      }
      console.log('');
    });

    // 5. Recommandation
    console.log('═══════════════════════════════════════════════════════════');
    console.log('💡 RECOMMANDATION');
    console.log('═══════════════════════════════════════════════════════════\n');

    const realisticStorageGB = (
      scenarios.realistic.companies * avgSizePerCompany +
      scenarios.realistic.secFilings * avgSizePerFiling +
      scenarios.realistic.fundFilings * avgSizePerFundFiling +
      scenarios.realistic.fundHoldings * avgSizePerHolding +
      scenarios.realistic.notifications * avgSizePerNotification +
      scenarios.realistic.earningsEvents * avgSizePerEarningsEvent +
      scenarios.realistic.news * 5
    ) / 1024 / 1024; // Convertir en GB

    console.log(`Stockage actuel: ~${currentStorageMB.toFixed(2)} MB`);
    console.log(`Stockage estimé (scénario réaliste): ~${realisticStorageGB.toFixed(2)} GB\n`);

    const currentStorageGB = currentStorageMB / 1024;
    
    if (currentStorageGB < 0.5) {
      console.log('✅ Plan FREE suffisant pour l\'instant');
      console.log(`   Utilisation: ${((currentStorageMB / 500) * 100).toFixed(1)}% de la limite (500 MB)`);
    } else if (currentStorageGB < 8) {
      console.log('⚠️  Plan FREE insuffisant, Plan PRO recommandé');
      console.log(`   Utilisation actuelle: ${((currentStorageGB / 8) * 100).toFixed(1)}% de la limite PRO (8 GB)`);
      
      // Calculer les frais supplémentaires si on dépasse
      if (currentStorageGB > 8) {
        const overageGB = currentStorageGB - 8;
        const overageCost = overageGB * SUPABASE_PLANS.PRO.databaseOverage;
        console.log(`   💰 Coût supplémentaire estimé: $${overageCost.toFixed(2)}/mois (${overageGB.toFixed(2)} GB × $${SUPABASE_PLANS.PRO.databaseOverage}/GB)`);
        console.log(`   💰 Coût total estimé: $${(SUPABASE_PLANS.PRO.price + overageCost).toFixed(2)}/mois`);
      }
    } else {
      console.log('⚠️  Plan PRO insuffisant, Plan TEAM recommandé');
      const overageGB = currentStorageGB - 8;
      const overageCost = overageGB * SUPABASE_PLANS.PRO.databaseOverage;
      console.log(`   💰 Coût avec PRO: $${(SUPABASE_PLANS.PRO.price + overageCost).toFixed(2)}/mois`);
      console.log(`   💰 Coût avec TEAM: $${SUPABASE_PLANS.TEAM.price}/mois (fixe)`);
    }

    if (realisticStorageGB < 8) {
      console.log(`\n💡 Pour le scénario réaliste: Plan PRO suffisant (${realisticStorageGB.toFixed(2)} GB < 8 GB)`);
      console.log(`   Coût: $${SUPABASE_PLANS.PRO.price}/mois`);
    } else {
      const overageGB = realisticStorageGB - 8;
      const overageCost = overageGB * SUPABASE_PLANS.PRO.databaseOverage;
      console.log(`\n💡 Pour le scénario réaliste: Plan PRO avec frais supplémentaires`);
      console.log(`   Stockage: ${realisticStorageGB.toFixed(2)} GB (${overageGB.toFixed(2)} GB au-delà)`);
      console.log(`   Coût PRO: $${(SUPABASE_PLANS.PRO.price + overageCost).toFixed(2)}/mois`);
      console.log(`   Coût TEAM: $${SUPABASE_PLANS.TEAM.price}/mois (fixe, mais plus cher)`);
      
      if (overageCost > 200) {
        console.log(`   ⚠️  Les frais supplémentaires dépassent $200/mois, considérer une solution alternative`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

analyzeSupabasePlanUsage().catch(console.error);
