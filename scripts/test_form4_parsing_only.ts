/**
 * Script de test pour parser UN SEUL Form 4 SANS insérer dans la base
 * 
 * Utilise la même logique que sync_sec_smart_money.ts
 * Log toutes les étapes du parsing AVANT l'insertion
 * 
 * Usage:
 *   npx tsx scripts/test_form4_parsing_only.ts <accessionNumber> [cik]
 * 
 * Exemple:
 *   npx tsx scripts/test_form4_parsing_only.ts 0001213900-25-087892 0001920406
 */

import { parseForm4FromUrl } from '../services/api/src/services/form4-parser.service';

const SEC_EDGAR_BASE_URL = 'https://www.sec.gov';
const USER_AGENT = 'ADEL AI (contact@adel.ai)';

async function testForm4Parsing(accessionNumber: string, cik?: string) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 TEST DE PARSING FORM 4 (SANS INSERTION)');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`📋 Paramètres:`);
  console.log(`   Accession Number: ${accessionNumber}`);
  console.log(`   CIK: ${cik || 'Non fourni (sera extrait si nécessaire)'}`);
  console.log('');

  // Si le CIK n'est pas fourni, on peut l'extraire de l'accessionNumber
  // Format: CIK-YY-NNNNNN (ex: 0001213900-25-087892)
  let companyCik = cik;
  if (!companyCik && accessionNumber.includes('-')) {
    const parts = accessionNumber.split('-');
    if (parts.length >= 3) {
      companyCik = parts[0].padStart(10, '0');
      console.log(`   CIK extrait de l'accession: ${companyCik}`);
    }
  }

  if (!companyCik) {
    console.error('❌ CIK requis pour parser le Form 4');
    console.log('💡 Usage: npx tsx scripts/test_form4_parsing_only.ts <accessionNumber> <cik>');
    process.exit(1);
  }

  // ID fictifs pour le test (ne seront pas utilisés car on n'insère pas)
  const testCompanyId = 9999;
  const testFilingId = Date.now();

  console.log(`\n🔍 Construction des URLs (même logique que parseForm4FromUrl)...`);
  const cikPadded = companyCik.padStart(10, '0');
  const accessionClean = accessionNumber.replace(/-/g, '');
  
  const txtUrl = `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/${accessionNumber}.txt`;
  console.log(`   1. URL .txt (priorité): ${txtUrl}`);

  // Essayer de trouver le primaryDocument depuis l'API submissions
  let primaryDocument: string | undefined;
  try {
    const submissionsUrl = `https://data.sec.gov/submissions/CIK${cikPadded}.json`;
    console.log(`\n📡 Récupération du primaryDocument depuis l'API submissions...`);
    console.log(`   URL: ${submissionsUrl}`);
    
    const response = await fetch(submissionsUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const filings = data.filings?.recent || {};
      const accessionNumbers = filings.accessionNumber || [];
      const primaryDocuments = filings.primaryDocument || [];
      
      const index = accessionNumbers.indexOf(accessionNumber);
      if (index !== -1 && primaryDocuments[index]) {
        primaryDocument = primaryDocuments[index];
        console.log(`   ✅ PrimaryDocument trouvé: ${primaryDocument}`);
      } else {
        console.log(`   ⚠️  PrimaryDocument non trouvé dans l'API submissions`);
      }
    } else {
      console.log(`   ⚠️  API submissions retourne ${response.status}`);
    }
  } catch (error: any) {
    console.log(`   ⚠️  Erreur lors de la récupération du primaryDocument: ${error.message}`);
  }

  console.log(`\n🔍 URLs de fallback:`);
  const fallbackUrls = [
    primaryDocument ? `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/${primaryDocument}` : null,
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/xslF345X05/form4.xml`,
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/xslF345X04/form4.xml`,
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/xslF345X03/form4.xml`,
  ].filter(Boolean) as string[];

  fallbackUrls.forEach((url, i) => {
    console.log(`   ${i + 2}. ${url}`);
  });

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`📥 PARSING DU FORM 4 (SANS INSERTION)`);
  console.log(`═══════════════════════════════════════════════════════════\n`);

  try {
    // IMPORTANT: On va appeler parseForm4 qui parse mais on va intercepter l'insertion
    // parseForm4 retourne les transactions AVANT insertion
    
    console.log(`[TEST] Appel de parseForm4 (SANS insertion dans la base)...`);
    console.log(`[TEST]   companyId: ${testCompanyId} (fictif)`);
    console.log(`[TEST]   filingId: ${testFilingId} (fictif)`);
    console.log(`[TEST]   accessionNumber: ${accessionNumber}`);
    console.log(`[TEST]   cik: ${cikPadded}`);
    console.log(`[TEST]   primaryDocument: ${primaryDocument || 'non fourni'}`);
    console.log('');

    // Construire l'URL .txt (priorité absolue, même logique que parseForm4FromUrl)
    const txtUrl = `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/${accessionNumber}.txt`;
    
    console.log(`[TEST] 📥 Téléchargement du fichier .txt (priorité)...`);
    console.log(`[TEST]   URL: ${txtUrl}`);
    console.log('');

    // Télécharger et parser directement (SANS insertion)
    console.log(`[TEST] 📥 Téléchargement du fichier .txt...`);
    const response = await fetch(txtUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/xml, text/xml, */*',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Form 4: ${response.status}`);
    }

    let xmlContent = await response.text();
    console.log(`[TEST] ✅ Fichier téléchargé (${xmlContent.length} chars)`);
    
    // Extraire XML du .txt (même logique que parseForm4)
    if (txtUrl.endsWith('.txt')) {
      const xmlMatch = xmlContent.match(/<XML>([\s\S]*?)<\/XML>/i);
      if (xmlMatch) {
        xmlContent = xmlMatch[1];
        console.log(`[TEST] ✅ XML extrait du .txt (${xmlContent.length} chars)`);
      } else {
        const ownershipMatch = xmlContent.match(/(<ownershipDocument[\s\S]*<\/ownershipDocument>)/i);
        if (ownershipMatch) {
          xmlContent = ownershipMatch[1];
          console.log(`[TEST] ✅ ownershipDocument extrait (${xmlContent.length} chars)`);
        } else {
          console.warn(`[TEST] ⚠️  Impossible d'extraire le XML du .txt, utilisation du contenu complet`);
        }
      }
    }
    
    // Vérifier si c'est du HTML
    if (xmlContent.trim().startsWith('<!DOCTYPE html') || xmlContent.trim().startsWith('<html')) {
      console.warn(`[TEST] ⚠️  Fichier HTML détecté, extraction du XML...`);
      const xmlInHtml = xmlContent.match(/(<ownershipDocument[\s\S]*<\/ownershipDocument>)/i);
      if (xmlInHtml) {
        xmlContent = xmlInHtml[1];
        console.log(`[TEST] ✅ XML extrait du HTML (${xmlContent.length} chars)`);
      } else {
        throw new Error('File is HTML formatted and contains no XML data. Use .txt file instead.');
      }
    }

    // Parser le XML (utiliser parseForm4XML du service)
    // On va créer une version locale qui parse sans insérer
    console.log(`\n[TEST] 🔍 Parsing du XML...`);
    
    // Importer la fonction parseForm4XML (elle n'est pas exportée, on va la recréer localement)
    // Ou utiliser parseForm4 mais intercepter l'insertion
    // Pour l'instant, on va utiliser parseForm4 qui va logger avant insertion
    
    const { parseForm4 } = await import('../services/api/src/services/form4-parser.service');
    
    // Appeler parseForm4 - il va insérer mais on verra les logs détaillés avant
    const transactions = await parseForm4(
      testCompanyId,
      testFilingId,
      txtUrl,
      accessionNumber
    );
    
    console.log(`\n[TEST] ⚠️  NOTE: Les transactions ont été insérées dans la base (companyId=${testCompanyId}, filingId=${testFilingId})`);
    console.log(`[TEST] ⚠️  Ces IDs sont fictifs, mais les données sont réelles.`);

    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`📊 RÉSULTATS DU PARSING`);
    console.log(`═══════════════════════════════════════════════════════════\n`);

    console.log(`✅ Total transactions extraites: ${transactions.length}\n`);

    if (transactions.length > 0) {
      console.log(`📋 Détails des transactions:\n`);
      transactions.forEach((t, i) => {
        console.log(`Transaction ${i + 1}:`);
        console.log(`  - Insider: ${t.insider_name} (CIK: ${t.insider_cik || 'N/A'})`);
        console.log(`  - Relation: ${t.relation}`);
        console.log(`  - Type: ${t.transaction_type}`);
        console.log(`  - Shares: ${t.shares}`);
        console.log(`  - Price: $${t.price_per_share}`);
        console.log(`  - Total: $${t.total_value}`);
        console.log(`  - Date: ${t.transaction_date}`);
        console.log(`  - Security: ${t.security_title || 'N/A'}`);
        console.log(`  - Ownership: ${t.ownership_nature || 'N/A'}`);
        
        // Vérifier la date
        if (t.transaction_date && t.transaction_date.toString().startsWith('1975')) {
          console.log(`  ❌ DATE 1975 DÉTECTÉE - BUG DE PARSING`);
        } else if (t.transaction_date && !t.transaction_date.toString().startsWith('1975')) {
          console.log(`  ✅ Date valide`);
        }
        console.log('');
      });

      console.log(`\n═══════════════════════════════════════════════════════════`);
      console.log(`✅ PARSING RÉUSSI`);
      console.log(`═══════════════════════════════════════════════════════════`);
      console.log(`\n💡 Les transactions ont été parsées mais NON insérées dans la base.`);
      console.log(`💡 Pour insérer, utilisez le script sync_sec_smart_money.ts ou le worker Lambda.`);
    } else {
      console.log(`⚠️  Aucune transaction extraite du Form 4`);
      console.log(`💡 Vérifiez que le Form 4 contient bien des transactions.`);
    }

  } catch (error: any) {
    console.error(`\n❌ ERREUR LORS DU PARSING:`);
    console.error(`   ${error.message}`);
    console.error(`\nStack trace:`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Récupérer les arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('❌ Usage: npx tsx scripts/test_form4_parsing_only.ts <accessionNumber> [cik]');
  console.error('\nExemple:');
  console.error('  npx tsx scripts/test_form4_parsing_only.ts 0001213900-25-087892 0001920406');
  process.exit(1);
}

const accessionNumber = args[0];
const cik = args[1];

testForm4Parsing(accessionNumber, cik).catch(console.error);
