/**
 * Script de diagnostic pour tester getFundByCikAthena
 * 
 * Usage: npx tsx scripts/test_get_fund_by_cik.ts [cik]
 */

import * as path from 'path';
import * as fs from 'fs';
import { getFundByCikAthena, getFundsAthena } from '../services/api/src/athena/funds';

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
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (key && value) {
          process.env[key.trim()] = value.trim();
        }
      }
    });
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 DIAGNOSTIC: getFundByCikAthena');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Vérifier les variables d'environnement
  console.log('📋 Variables d\'environnement:');
  console.log(`   USE_ATHENA: ${process.env.USE_ATHENA}`);
  console.log(`   ATHENA_DATABASE: ${process.env.ATHENA_DATABASE}`);
  console.log(`   ATHENA_WORKGROUP: ${process.env.ATHENA_WORKGROUP}`);
  console.log(`   S3_DATA_BUCKET: ${process.env.S3_DATA_BUCKET}`);
  console.log(`   AWS_REGION: ${process.env.AWS_REGION || 'eu-west-3'}`);
  console.log('');

  // Récupérer un CIK depuis la liste des funds
  console.log('📊 Étape 1: Récupérer la liste des funds...');
  try {
    const funds = await getFundsAthena(5);
    console.log(`   ✅ ${funds.length} funds trouvés\n`);
    
    if (funds.length === 0) {
      console.log('   ❌ Aucun fund trouvé. Impossible de tester.');
      process.exit(1);
    }

    // Afficher les premiers funds
    console.log('   Funds disponibles:');
    funds.slice(0, 3).forEach((fund, index) => {
      console.log(`   ${index + 1}. ${fund.name} (CIK: ${fund.cik}, ID: ${fund.id})`);
    });
    console.log('');

    // Utiliser le CIK du premier fund ou celui fourni en argument
    const testCik = process.argv[2] || funds[0].cik;
    console.log(`🧪 Étape 2: Tester getFundByCikAthena avec CIK: "${testCik}"`);
    console.log('');

    // Test avec le CIK exact
    console.log(`   Test 1: CIK exact "${testCik}"`);
    try {
      const fund1 = await getFundByCikAthena(testCik);
      if (fund1) {
        console.log(`   ✅ Fund trouvé:`);
        console.log(`      - Name: ${fund1.name}`);
        console.log(`      - CIK: ${fund1.cik}`);
        console.log(`      - ID: ${fund1.id}`);
        console.log(`      - Tier: ${fund1.tier_influence}`);
        console.log(`      - Category: ${fund1.category}`);
      } else {
        console.log(`   ❌ Fund non trouvé avec CIK "${testCik}"`);
      }
    } catch (error: any) {
      console.log(`   ❌ Erreur: ${error.message}`);
      console.log(`   Stack: ${error.stack}`);
    }
    console.log('');

    // Test avec CIK sans zéros initiaux (si applicable)
    if (testCik.startsWith('0')) {
      const cikWithoutZeros = testCik.replace(/^0+/, '');
      console.log(`   Test 2: CIK sans zéros initiaux "${cikWithoutZeros}"`);
      try {
        const fund2 = await getFundByCikAthena(cikWithoutZeros);
        if (fund2) {
          console.log(`   ✅ Fund trouvé:`);
          console.log(`      - Name: ${fund2.name}`);
          console.log(`      - CIK: ${fund2.cik}`);
          console.log(`      - ID: ${fund2.id}`);
        } else {
          console.log(`   ❌ Fund non trouvé avec CIK "${cikWithoutZeros}"`);
        }
      } catch (error: any) {
        console.log(`   ❌ Erreur: ${error.message}`);
      }
      console.log('');
    }

    // Test avec CIK avec zéros initiaux (si applicable)
    if (!testCik.startsWith('0') && testCik.length < 10) {
      const cikWithZeros = testCik.padStart(10, '0');
      console.log(`   Test 3: CIK avec zéros initiaux "${cikWithZeros}"`);
      try {
        const fund3 = await getFundByCikAthena(cikWithZeros);
        if (fund3) {
          console.log(`   ✅ Fund trouvé:`);
          console.log(`      - Name: ${fund3.name}`);
          console.log(`      - CIK: ${fund3.cik}`);
          console.log(`      - ID: ${fund3.id}`);
        } else {
          console.log(`   ❌ Fund non trouvé avec CIK "${cikWithZeros}"`);
        }
      } catch (error: any) {
        console.log(`   ❌ Erreur: ${error.message}`);
      }
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ DIAGNOSTIC TERMINÉ');
    console.log('═══════════════════════════════════════════════════════════');

  } catch (error: any) {
    console.error('❌ Erreur fatale:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

main().catch(console.error);
