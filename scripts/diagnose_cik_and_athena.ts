/**
 * Script de diagnostic pour vérifier:
 * 1. Les CIK dans Supabase
 * 2. Les CIK dans Athena
 * 3. Les fonctions getFundByCik et resolveFundId
 * 4. Les erreurs potentielles lors de la migration Athena
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
          process.env[key] = value;
        }
      }
    } catch (e) {
      console.warn('Could not parse .env file:', e);
    }
  }
}

// Maintenant on peut importer les modules qui nécessitent les variables d'env
const { supabase } = require('../services/api/src/supabase');
const { getFundByCikAthena, getFundsAthena } = require('../services/api/src/athena/funds');
const { getFundByCik, resolveFundId } = require('../services/api/src/funds');

async function diagnoseCikAndAthena() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 DIAGNOSTIC CIK ET ATHENA');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. Vérifier les CIK dans Supabase
  console.log('1️⃣  VÉRIFICATION SUPABASE:');
  console.log('─────────────────────────────────────────────────────────');
  try {
    const { data: fundsSupabase, error: supabaseError } = await supabase
      .from('funds')
      .select('id, name, cik')
      .limit(10);

    if (supabaseError) {
      console.error('❌ Erreur Supabase:', supabaseError);
    } else {
      console.log(`✅ ${fundsSupabase?.length || 0} funds trouvés dans Supabase`);
      if (fundsSupabase && fundsSupabase.length > 0) {
        console.log('\n   Premiers funds:');
        fundsSupabase.slice(0, 5).forEach((fund: any) => {
          console.log(`   - ${fund.name} (CIK: ${fund.cik}, ID: ${fund.id})`);
        });
      }
    }
  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification Supabase:', error.message);
  }

  // 2. Vérifier les CIK dans Athena
  console.log('\n2️⃣  VÉRIFICATION ATHENA:');
  console.log('─────────────────────────────────────────────────────────');
  try {
    const fundsAthena = await getFundsAthena(10);
    console.log(`✅ ${fundsAthena.length} funds trouvés dans Athena`);
    if (fundsAthena.length > 0) {
      console.log('\n   Premiers funds:');
      fundsAthena.slice(0, 5).forEach((fund) => {
        console.log(`   - ${fund.name} (CIK: ${fund.cik}, ID: ${fund.id})`);
      });
    } else {
      console.log('⚠️  Aucun fund trouvé dans Athena - la table est peut-être vide');
    }
  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification Athena:', error.message);
    console.error('   Stack:', error.stack);
  }

  // 3. Tester getFundByCik avec un CIK réel
  console.log('\n3️⃣  TEST getFundByCik() AVEC CIK RÉEL:');
  console.log('─────────────────────────────────────────────────────────');
  try {
    // Récupérer un CIK depuis Supabase
    const { data: testFund } = await supabase
      .from('funds')
      .select('cik')
      .limit(1)
      .single();

    if (testFund && testFund.cik) {
      const testCik = testFund.cik;
      console.log(`   Test avec CIK: ${testCik}`);

      // Tester avec USE_ATHENA=false (Supabase)
      process.env.USE_ATHENA = 'false';
      try {
        const fundSupabase = await getFundByCik(testCik);
        if (fundSupabase) {
          console.log(`   ✅ getFundByCik() avec Supabase: OK (${fundSupabase.name})`);
        } else {
          console.log(`   ❌ getFundByCik() avec Supabase: Fund non trouvé`);
        }
      } catch (error: any) {
        console.error(`   ❌ getFundByCik() avec Supabase: ${error.message}`);
      }

      // Tester avec USE_ATHENA=true (Athena)
      process.env.USE_ATHENA = 'true';
      try {
        const fundAthena = await getFundByCik(testCik);
        if (fundAthena) {
          console.log(`   ✅ getFundByCik() avec Athena: OK (${fundAthena.name})`);
        } else {
          console.log(`   ⚠️  getFundByCik() avec Athena: Fund non trouvé (peut être normal si migration incomplète)`);
        }
      } catch (error: any) {
        console.error(`   ❌ getFundByCik() avec Athena: ${error.message}`);
        console.error(`      Stack: ${error.stack}`);
      }

      // Tester directement getFundByCikAthena
      try {
        const fundDirect = await getFundByCikAthena(testCik);
        if (fundDirect) {
          console.log(`   ✅ getFundByCikAthena() direct: OK (${fundDirect.name})`);
        } else {
          console.log(`   ⚠️  getFundByCikAthena() direct: Fund non trouvé`);
        }
      } catch (error: any) {
        console.error(`   ❌ getFundByCikAthena() direct: ${error.message}`);
        console.error(`      Stack: ${error.stack}`);
      }
    } else {
      console.log('   ⚠️  Aucun fund trouvé dans Supabase pour tester');
    }
  } catch (error: any) {
    console.error('   ❌ Erreur lors du test getFundByCik:', error.message);
  }

  // 4. Tester resolveFundId avec un CIK réel
  console.log('\n4️⃣  TEST resolveFundId() AVEC CIK RÉEL:');
  console.log('─────────────────────────────────────────────────────────');
  try {
    const { data: testFund } = await supabase
      .from('funds')
      .select('cik, id')
      .limit(1)
      .single();

    if (testFund && testFund.cik) {
      const testCik = testFund.cik;
      console.log(`   Test avec CIK: ${testCik} (ID attendu: ${testFund.id})`);

      // Tester avec USE_ATHENA=false (Supabase)
      process.env.USE_ATHENA = 'false';
      try {
        const fundIdSupabase = await resolveFundId(testCik);
        console.log(`   ✅ resolveFundId() avec Supabase: OK (ID: ${fundIdSupabase})`);
        if (fundIdSupabase !== testFund.id) {
          console.log(`   ⚠️  ID mismatch: attendu ${testFund.id}, obtenu ${fundIdSupabase}`);
        }
      } catch (error: any) {
        console.error(`   ❌ resolveFundId() avec Supabase: ${error.message}`);
      }

      // Tester avec USE_ATHENA=true (Athena)
      process.env.USE_ATHENA = 'true';
      try {
        const fundIdAthena = await resolveFundId(testCik);
        console.log(`   ✅ resolveFundId() avec Athena: OK (ID: ${fundIdAthena})`);
        if (fundIdAthena !== testFund.id) {
          console.log(`   ⚠️  ID mismatch: attendu ${testFund.id}, obtenu ${fundIdAthena}`);
        }
      } catch (error: any) {
        console.error(`   ❌ resolveFundId() avec Athena: ${error.message}`);
        console.error(`      Stack: ${error.stack}`);
      }
    } else {
      console.log('   ⚠️  Aucun fund trouvé dans Supabase pour tester');
    }
  } catch (error: any) {
    console.error('   ❌ Erreur lors du test resolveFundId:', error.message);
  }

  // 5. Vérifier les variables d'environnement
  console.log('\n5️⃣  VARIABLES D\'ENVIRONNEMENT:');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`   USE_ATHENA: ${process.env.USE_ATHENA || 'non défini'}`);
  console.log(`   USE_S3_WRITES: ${process.env.USE_S3_WRITES || 'non défini'}`);
  console.log(`   AWS_REGION: ${process.env.AWS_REGION || 'non défini'}`);
  console.log(`   ATHENA_DATABASE: ${process.env.ATHENA_DATABASE || 'non défini'}`);
  console.log(`   ATHENA_WORKGROUP: ${process.env.ATHENA_WORKGROUP || 'non défini'}`);
  console.log(`   S3_DATA_BUCKET: ${process.env.S3_DATA_BUCKET || 'non défini'}`);

  // 6. Comparaison Supabase vs Athena
  console.log('\n6️⃣  COMPARAISON SUPABASE VS ATHENA:');
  console.log('─────────────────────────────────────────────────────────');
  try {
    const { data: allFundsSupabase } = await supabase
      .from('funds')
      .select('id, name, cik')
      .order('id');

    const allFundsAthena = await getFundsAthena(1000);

    console.log(`   Supabase: ${allFundsSupabase?.length || 0} funds`);
    console.log(`   Athena: ${allFundsAthena.length} funds`);

    if (allFundsSupabase && allFundsSupabase.length > 0) {
      const supabaseCiks = new Set(allFundsSupabase.map((f: any) => f.cik));
      const athenaCiks = new Set(allFundsAthena.map((f) => f.cik));

      const missingInAthena = allFundsSupabase.filter(
        (f: any) => !athenaCiks.has(f.cik)
      );
      const missingInSupabase = allFundsAthena.filter(
        (f) => !supabaseCiks.has(f.cik)
      );

      if (missingInAthena.length > 0) {
        console.log(`\n   ⚠️  ${missingInAthena.length} funds dans Supabase mais pas dans Athena:`);
        missingInAthena.slice(0, 5).forEach((f: any) => {
          console.log(`      - ${f.name} (CIK: ${f.cik})`);
        });
      }

      if (missingInSupabase.length > 0) {
        console.log(`\n   ⚠️  ${missingInSupabase.length} funds dans Athena mais pas dans Supabase:`);
        missingInSupabase.slice(0, 5).forEach((f) => {
          console.log(`      - ${f.name} (CIK: ${f.cik})`);
        });
      }

      if (missingInAthena.length === 0 && missingInSupabase.length === 0) {
        console.log('   ✅ Les deux bases sont synchronisées');
      }
    }
  } catch (error: any) {
    console.error('   ❌ Erreur lors de la comparaison:', error.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ DIAGNOSTIC TERMINÉ');
  console.log('═══════════════════════════════════════════════════════════\n');
}

// Exécuter le diagnostic
diagnoseCikAndAthena()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
