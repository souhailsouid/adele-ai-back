/**
 * Script pour tester le parsing de PLUSIEURS Form 4 en une seule fois
 * 
 * Usage:
 *   npx tsx scripts/test_multiple_form4.ts
 * 
 * Ou avec des accession numbers spécifiques:
 *   npx tsx scripts/test_multiple_form4.ts 0001213900-25-087892,0001127602-17-005429
 */

import { parseForm4FromUrl } from '../services/api/src/services/form4-parser.service';

const SEC_EDGAR_BASE_URL = 'https://www.sec.gov';
const USER_AGENT = 'ADEL AI (contact@adel.ai)';

// Liste de Form 4 à tester (accessionNumber, cik, primaryDocument optionnel)
// Utiliser des Form 4 réels et récents pour valider le parsing
const TEST_CASES = [
  { accessionNumber: '0001213900-25-087892', cik: '0001920406', name: 'Test 1 (déjà testé - 6 transactions)' },
  { accessionNumber: '0001341439-25-000090', cik: '0001341439', name: 'Test 2 (Oracle - 2 transactions)' },
  // Ajouter d'autres Form 4 réels si disponibles
];

async function testMultipleForm4(accessionNumbers?: string[]) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TEST DE PARSING MULTIPLE FORM 4');
  console.log('═══════════════════════════════════════════════════════════\n');

  const testCases = accessionNumbers 
    ? accessionNumbers.map(acc => {
        // Extraire le CIK depuis l'accessionNumber si possible, sinon utiliser un CIK par défaut
        const parts = acc.split('-');
        const cik = parts[0] ? parts[0].padStart(10, '0') : '0000000000';
        return { accessionNumber: acc, cik, name: `Custom: ${acc}` };
      })
    : TEST_CASES;

  const results: Array<{
    accessionNumber: string;
    success: boolean;
    transactionCount: number;
    error?: string;
  }> = [];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const { accessionNumber, cik, name } = testCase;
    
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📋 TEST ${i + 1}/${testCases.length}: ${name}`);
    console.log(`   Accession: ${accessionNumber}`);
    console.log(`   CIK: ${cik}`);
    console.log(`${'═'.repeat(60)}\n`);

    try {
      // IDs fictifs pour le test
      const testCompanyId = 9999;
      const testFilingId = Date.now();

      // Récupérer le primaryDocument depuis l'API submissions (optionnel)
      let primaryDocument: string | undefined;
      try {
        const cikPadded = String(cik || '').padStart(10, '0');
        const submissionsUrl = `https://data.sec.gov/submissions/CIK${cikPadded}.json`;
        console.log(`📡 Récupération du primaryDocument depuis l'API submissions...`);
        const submissionsResponse = await fetch(submissionsUrl, {
          headers: { 'User-Agent': USER_AGENT },
        });
        if (submissionsResponse.ok) {
          const submissionsData = await submissionsResponse.json();
          const filings = submissionsData.filings?.recent || {};
          const accessionNumbers = filings.accessionNumber || [];
          const primaryDocuments = filings.primaryDocument || [];
          const index = accessionNumbers.findIndex((acc: string) => acc === accessionNumber);
          if (index >= 0 && primaryDocuments[index]) {
            primaryDocument = primaryDocuments[index];
            console.log(`   ✅ PrimaryDocument trouvé: ${primaryDocument}`);
          }
        }
      } catch (err) {
        console.log(`   ⚠️  Impossible de récupérer le primaryDocument, utilisation des fallbacks`);
      }

      console.log(`📥 Parsing avec parseForm4FromUrl (gère les fallbacks automatiquement)...`);
      
      // Utiliser parseForm4FromUrl qui gère les fallbacks et retry automatiquement
      const transactions = await parseForm4FromUrl(
        testCompanyId,
        testFilingId,
        accessionNumber,
        cik,
        primaryDocument
      );

      console.log(`\n✅ SUCCÈS: ${transactions.length} transactions extraites\n`);
      
      // Afficher un résumé des transactions
      if (transactions.length > 0) {
        const types = transactions.map(t => t.transaction_type);
        const uniqueTypes = [...new Set(types)];
        const dates = transactions.map(t => t.transaction_date);
        const uniqueDates = [...new Set(dates)];
        
        console.log(`   📊 Résumé:`);
        console.log(`      - Types: ${uniqueTypes.join(', ')}`);
        console.log(`      - Dates: ${uniqueDates.join(', ')}`);
        console.log(`      - Insider: ${transactions[0].insider_name} (CIK: ${transactions[0].insider_cik || 'N/A'})`);
        console.log(`      - Relation: ${transactions[0].relation}`);
        
        // Vérifier les dates
        const invalidDates = transactions.filter(t => 
          t.transaction_date && t.transaction_date.toString().startsWith('1975')
        );
        if (invalidDates.length > 0) {
          console.log(`      ⚠️  ${invalidDates.length} transaction(s) avec date 1975 (BUG)`);
        } else {
          console.log(`      ✅ Toutes les dates sont valides`);
        }
      }

      results.push({
        accessionNumber,
        success: true,
        transactionCount: transactions.length,
      });

    } catch (error: any) {
      // Si erreur 503 (rate limiting), retry une fois après 5 secondes
      if (error.message.includes('503') || error.message.includes('429')) {
        console.log(`\n⏳ Rate limiting détecté (503/429), retry dans 5 secondes...\n`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        try {
          console.log(`🔄 Retry du parsing...`);
          const transactions = await parseForm4FromUrl(
            testCompanyId,
            testFilingId,
            accessionNumber,
            cik,
            primaryDocument
          );
          
          console.log(`\n✅ SUCCÈS (après retry): ${transactions.length} transactions extraites\n`);
          results.push({
            accessionNumber,
            success: true,
            transactionCount: transactions.length,
          });
          continue; // Passer au test suivant
        } catch (retryError: any) {
          console.error(`\n❌ ERREUR (après retry): ${retryError.message}\n`);
          results.push({
            accessionNumber,
            success: false,
            transactionCount: 0,
            error: retryError.message,
          });
        }
      } else {
        console.error(`\n❌ ERREUR: ${error.message}\n`);
        results.push({
          accessionNumber,
          success: false,
          transactionCount: 0,
          error: error.message,
        });
      }
    }

    // Attendre un peu entre les tests pour respecter le rate limiting
    if (i < testCases.length - 1) {
      console.log(`\n⏳ Attente de 2 secondes avant le prochain test (rate limiting)...\n`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Résumé final
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 RÉSUMÉ FINAL`);
  console.log(`${'═'.repeat(60)}\n`);

  const successCount = results.filter(r => r.success).length;
  const totalTransactions = results.reduce((sum, r) => sum + r.transactionCount, 0);

  console.log(`✅ Tests réussis: ${successCount}/${results.length}`);
  console.log(`📊 Total transactions extraites: ${totalTransactions}\n`);

  results.forEach((result, i) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} Test ${i + 1}: ${result.accessionNumber}`);
    if (result.success) {
      console.log(`   → ${result.transactionCount} transaction(s) extraite(s)`);
    } else {
      console.log(`   → Erreur: ${result.error}`);
    }
  });

  console.log(`\n${'═'.repeat(60)}\n`);
}

// Récupérer les arguments
const args = process.argv.slice(2);
if (args.length > 0) {
  // Si des accession numbers sont fournis en argument, les utiliser
  const accessionNumbers = args[0].split(',').map(s => s.trim());
  testMultipleForm4(accessionNumbers).catch(console.error);
} else {
  // Sinon, utiliser les cas de test par défaut
  testMultipleForm4().catch(console.error);
}
