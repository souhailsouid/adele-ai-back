/**
 * Script pour estimer les coûts de l'enrichissement SEC
 * 
 * Usage:
 *   npx tsx scripts/estimate_enrichment_costs.ts
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

async function estimateCosts() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('💰 Estimation des coûts d\'enrichissement SEC');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Compter les entreprises totales
    const { count: totalCompanies } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });

    // Compter les entreprises déjà enrichies
    const { count: enrichedCompanies } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .not('ein', 'is', null);

    // Compter les filings existants
    const { count: existingFilings } = await supabase
      .from('company_filings')
      .select('*', { count: 'exact', head: true });

    // Estimer les filings à venir (basé sur les 100 top entreprises : 66,000 filings pour 99 entreprises)
    const avgFilingsPerCompany = 667; // Basé sur notre analyse précédente
    const remainingCompanies = (totalCompanies || 0) - (enrichedCompanies || 0);
    const estimatedNewFilings = remainingCompanies * avgFilingsPerCompany;

    // Estimation de la taille des données
    const avgFilingSize = 2; // KB par filing (métadonnées seulement, pas le contenu brut)
    const estimatedStorageMB = (estimatedNewFilings * avgFilingSize) / 1024;

    console.log('📊 Données actuelles:');
    console.log(`   Entreprises totales: ${totalCompanies || 0}`);
    console.log(`   Entreprises enrichies: ${enrichedCompanies || 0}`);
    console.log(`   Entreprises restantes: ${remainingCompanies}`);
    console.log(`   Filings existants: ${existingFilings || 0}\n`);

    console.log('📈 Estimations pour les entreprises restantes:');
    console.log(`   Filings à insérer: ~${estimatedNewFilings.toLocaleString()}`);
    console.log(`   Stockage estimé: ~${estimatedStorageMB.toFixed(2)} MB\n`);

    // Coûts Supabase (basé sur le plan Free/Pro)
    console.log('💰 Coûts estimés:\n');
    
    console.log('1. API SEC EDGAR:');
    console.log('   ✅ GRATUIT (API publique)\n');

    console.log('2. Supabase (Base de données):');
    
    // Plan Free
    const freePlanStorage = 500; // MB
    const freePlanBandwidth = 5; // GB
    const freePlanDatabaseSize = 500; // MB
    
    const currentStorageMB = estimatedStorageMB;
    const isWithinFreePlan = currentStorageMB < freePlanStorage;
    
    if (isWithinFreePlan) {
      console.log('   ✅ Plan FREE suffisant');
      console.log(`   Stockage utilisé: ~${currentStorageMB.toFixed(2)} MB / ${freePlanStorage} MB`);
      console.log(`   Coût: $0/mois\n`);
    } else {
      // Plan Pro ($25/mois)
      const proPlanStorage = 8000; // GB
      const proPlanBandwidth = 250; // GB
      const estimatedCostPerMonth = 25; // $25/mois pour le plan Pro
      
      console.log('   ⚠️  Plan FREE insuffisant (nécessite Pro)');
      console.log(`   Stockage estimé: ~${currentStorageMB.toFixed(2)} MB`);
      console.log(`   Plan Pro: $25/mois`);
      console.log(`   Inclut: ${proPlanStorage} GB stockage, ${proPlanBandwidth} GB bandwidth\n`);
    }

    console.log('3. Requêtes API:');
    const estimatedApiCalls = remainingCompanies; // 1 appel par entreprise
    console.log(`   Appels API SEC: ~${estimatedApiCalls.toLocaleString()}`);
    console.log(`   Coût: GRATUIT\n`);

    console.log('4. Opérations base de données:');
    const estimatedDbWrites = estimatedNewFilings + remainingCompanies; // 1 update par entreprise + 1 insert par filing
    console.log(`   Writes estimés: ~${estimatedDbWrites.toLocaleString()}`);
    console.log(`   (Dans la limite du plan Supabase)\n`);

    // Temps d'exécution
    const rateLimitMs = 200;
    const avgApiTime = 500; // ms
    const totalTimeSeconds = (remainingCompanies * (rateLimitMs + avgApiTime)) / 1000;
    const totalTimeMinutes = totalTimeSeconds / 60;
    const totalTimeHours = totalTimeMinutes / 60;

    console.log('⏱️  Temps d\'exécution estimé:');
    console.log(`   Séquentiel: ~${totalTimeMinutes.toFixed(1)} minutes (~${totalTimeHours.toFixed(2)} heures)`);
    console.log(`   Parallèle (2 workers): ~${(totalTimeMinutes / 2).toFixed(1)} minutes (~${(totalTimeHours / 2).toFixed(2)} heures)\n`);

    // Résumé
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 RÉSUMÉ DES COÛTS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ API SEC: GRATUIT');
    if (isWithinFreePlan) {
      console.log('✅ Supabase: GRATUIT (Plan Free)');
      console.log(`   Stockage: ~${currentStorageMB.toFixed(2)} MB / ${freePlanStorage} MB`);
    } else {
      console.log('💰 Supabase: $25/mois (Plan Pro requis)');
      console.log(`   Stockage: ~${currentStorageMB.toFixed(2)} MB`);
    }
    console.log('✅ Exécution locale: Négligeable (électricité)');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Recommandations
    console.log('💡 Recommandations:');
    if (currentStorageMB < freePlanStorage * 0.8) {
      console.log('   ✅ Tu es dans les limites du plan Free');
      console.log('   ✅ Pas de coût supplémentaire');
    } else {
      console.log('   ⚠️  Tu approches de la limite du plan Free');
      console.log('   💡 Considère le plan Pro si tu dépasses 500 MB');
    }
    console.log('   💡 Les filings sont des métadonnées légères (pas de contenu brut)');
    console.log('   💡 Le stockage réel sera probablement inférieur à l\'estimation\n');

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

estimateCosts().catch(console.error);
