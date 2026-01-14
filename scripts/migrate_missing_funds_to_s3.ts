/**
 * Script pour migrer les funds manquants de Supabase vers S3
 * 
 * Usage:
 *   npx tsx scripts/migrate_missing_funds_to_s3.ts
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
          process.env[key] = value;
        }
      }
    } catch (e) {
      console.warn('Could not parse .env file:', e);
    }
  }
}

const { supabase } = require('../services/api/src/supabase');
const { getFundByCikAthena } = require('../services/api/src/athena/funds');
const { insertRowS3 } = require('../services/api/src/athena/write');

async function migrateMissingFunds() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔄 MIGRATION DES FUNDS MANQUANTS VERS S3');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Récupérer tous les funds de Supabase
  console.log('1️⃣  Récupération des funds depuis Supabase...');
  const { data: fundsSupabase, error: supabaseError } = await supabase
    .from('funds')
    .select('*')
    .order('id');

  if (supabaseError) {
    console.error('❌ Erreur Supabase:', supabaseError);
    process.exit(1);
  }

  if (!fundsSupabase || fundsSupabase.length === 0) {
    console.log('⚠️  Aucun fund trouvé dans Supabase');
    process.exit(0);
  }

  console.log(`✅ ${fundsSupabase.length} funds trouvés dans Supabase\n`);

  // 2. Vérifier quels funds sont manquants dans Athena
  console.log('2️⃣  Vérification des funds dans Athena...');
  const missingFunds: any[] = [];

  for (const fund of fundsSupabase) {
    try {
      const existing = await getFundByCikAthena(fund.cik);
      if (!existing) {
        missingFunds.push(fund);
        console.log(`   ⚠️  Manquant: ${fund.name} (CIK: ${fund.cik})`);
      } else {
        console.log(`   ✅ Existe: ${fund.name} (CIK: ${fund.cik})`);
      }
    } catch (error: any) {
      // Si erreur Athena, considérer comme manquant
      missingFunds.push(fund);
      console.log(`   ⚠️  Erreur Athena pour ${fund.name}, à migrer: ${error.message}`);
    }
  }

  if (missingFunds.length === 0) {
    console.log('\n✅ Tous les funds sont déjà dans Athena/S3 !');
    process.exit(0);
  }

  console.log(`\n📊 ${missingFunds.length} funds à migrer vers S3\n`);

  // 3. Migrer chaque fund vers S3
  console.log('3️⃣  Migration vers S3...');
  let successCount = 0;
  let errorCount = 0;

  for (const fund of missingFunds) {
    try {
      console.log(`\n   Migrant: ${fund.name} (CIK: ${fund.cik})...`);
      
      const fundData = {
        name: fund.name,
        cik: fund.cik,
        tier_influence: fund.tier_influence || 3,
        category: fund.category || 'hedge_fund',
        created_at: fund.created_at || new Date().toISOString(),
        updated_at: fund.updated_at || new Date().toISOString(),
      };

      const inserted = await insertRowS3('funds', fundData);
      console.log(`   ✅ Migré avec succès (ID: ${inserted.id}, S3 Key: ${inserted.s3Key})`);
      successCount++;
    } catch (error: any) {
      console.error(`   ❌ Erreur lors de la migration: ${error.message}`);
      errorCount++;
    }
  }

  // 4. Résumé
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 RÉSUMÉ DE LA MIGRATION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   ✅ Migrés avec succès: ${successCount}`);
  console.log(`   ❌ Erreurs: ${errorCount}`);
  console.log(`   📦 Total à migrer: ${missingFunds.length}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (errorCount > 0) {
    console.log('⚠️  Certains funds n\'ont pas pu être migrés. Vérifiez les erreurs ci-dessus.');
    process.exit(1);
  }

  console.log('✅ Migration terminée avec succès !');
  console.log('\n💡 Note: Les données sont maintenant dans S3. Pour les voir dans Athena,');
  console.log('   exécutez: MSCK REPAIR TABLE funds; dans Athena.');
}

migrateMissingFunds()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
