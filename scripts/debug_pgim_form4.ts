/**
 * Script pour analyser manuellement le parsing Form 4 pour PGIM
 * Télécharge le XML et vérifie pourquoi le titre n'est pas extrait
 */

import fetch from 'node-fetch';

const SEC_EDGAR_BASE_URL = 'https://www.sec.gov';
const USER_AGENT = 'Mozilla/5.0 (compatible; PersonamyBot/1.0)';

// Accession number pour PGIM - à trouver depuis la base de données
// Pour l'instant, on va chercher un exemple récent
const PGIM_CIK = '0001759669'; // CIK de PGIM Private Credit Fund (à vérifier)

async function downloadForm4XML(accessionNumber: string, cik: string) {
  const cikPadded = String(cik || '').padStart(10, '0');
  const accessionClean = accessionNumber.replace(/-/g, '');
  
  const txtUrl = `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/${accessionNumber}.txt`;
  
  console.log(`📥 Téléchargement: ${txtUrl}`);
  
  const response = await fetch(txtUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/xml, text/xml, */*',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  let content = await response.text();
  
  // Extraire le XML du fichier .txt
  const xmlMatch = content.match(/<XML>([\s\S]*?)<\/XML>/i);
  if (xmlMatch) {
    content = xmlMatch[1];
  } else {
    const ownershipMatch = content.match(/(<ownershipDocument[\s\S]*<\/ownershipDocument>)/i);
    if (ownershipMatch) {
      content = ownershipMatch[1];
    }
  }
  
  return content;
}

function analyzeXML(xmlContent: string) {
  console.log('\n🔍 Analyse du XML...\n');
  
  // Supprimer les namespaces
  const xmlWithoutNamespaces = xmlContent.replace(/<(\/?)([^:>]+):([^>]+)>/g, '<$1$3>');
  
  // 1. Chercher le nom de l'insider
  const ownerNameMatch = xmlWithoutNamespaces.match(/<rptOwnerName[^>]*>([^<]+)<\/rptOwnerName>/i);
  const ownerName = ownerNameMatch ? ownerNameMatch[1].trim() : null;
  console.log(`👤 Nom de l'insider: ${ownerName || 'NON TROUVÉ'}`);
  
  // 2. Chercher officerTitle
  const officerTitleMatch = xmlWithoutNamespaces.match(/<officerTitle[^>]*>([^<]+)<\/officerTitle>/i);
  const officerTitle = officerTitleMatch ? officerTitleMatch[1].trim() : null;
  console.log(`📋 officerTitle: ${officerTitle || 'NON TROUVÉ'}`);
  
  // 3. Chercher directorTitle
  const directorTitleMatch = xmlWithoutNamespaces.match(/<directorTitle[^>]*>([^<]+)<\/directorTitle>/i);
  const directorTitle = directorTitleMatch ? directorTitleMatch[1].trim() : null;
  console.log(`📋 directorTitle: ${directorTitle || 'NON TROUVÉ'}`);
  
  // 4. Chercher reportingOwnerSection pour voir tous les champs disponibles
  const reportingOwnerMatch = xmlWithoutNamespaces.match(/<reportingOwner[^>]*>([\s\S]*?)<\/reportingOwner>/i);
  if (reportingOwnerMatch) {
    const reportingOwnerSection = reportingOwnerMatch[1];
    console.log('\n📄 Section reportingOwner trouvée:');
    
    // Extraire tous les tags dans cette section
    const tags = reportingOwnerSection.match(/<([^>]+)>([^<]+)<\/\1>/gi);
    if (tags) {
      console.log('\n🔍 Tous les champs dans reportingOwner:');
      tags.forEach(tag => {
        const match = tag.match(/<([^>]+)>([^<]+)<\/\1>/i);
        if (match) {
          console.log(`   • ${match[1]}: ${match[2]}`);
        }
      });
    }
  }
  
  // 5. Chercher isDirector, isOfficer, isTenPercentOwner
  const isDirectorMatch = xmlWithoutNamespaces.match(/<isDirector[^>]*>([^<]+)<\/isDirector>/i);
  const isDirector = isDirectorMatch ? isDirectorMatch[1].trim() : null;
  console.log(`\n👔 isDirector: ${isDirector || 'NON TROUVÉ'}`);
  
  const isOfficerMatch = xmlWithoutNamespaces.match(/<isOfficer[^>]*>([^<]+)<\/isOfficer>/i);
  const isOfficer = isOfficerMatch ? isOfficerMatch[1].trim() : null;
  console.log(`👔 isOfficer: ${isOfficer || 'NON TROUVÉ'}`);
  
  const isTenPercentOwnerMatch = xmlWithoutNamespaces.match(/<isTenPercentOwner[^>]*>([^<]+)<\/isTenPercentOwner>/i);
  const isTenPercentOwner = isTenPercentOwnerMatch ? isTenPercentOwnerMatch[1].trim() : null;
  console.log(`👔 isTenPercentOwner: ${isTenPercentOwner || 'NON TROUVÉ'}`);
  
  // 6. Chercher dans ownerSignature (parfois le titre est là)
  const ownerSignatureMatch = xmlWithoutNamespaces.match(/<ownerSignature[^>]*>([\s\S]*?)<\/ownerSignature>/i);
  if (ownerSignatureMatch) {
    console.log('\n✍️ ownerSignature trouvé');
    const signatureSection = ownerSignatureMatch[1];
    const signatureTags = signatureSection.match(/<([^>]+)>([^<]+)<\/\1>/gi);
    if (signatureTags) {
      signatureTags.forEach(tag => {
        const match = tag.match(/<([^>]+)>([^<]+)<\/\1>/i);
        if (match) {
          console.log(`   • ${match[1]}: ${match[2]}`);
        }
      });
    }
  }
  
  return {
    ownerName,
    officerTitle,
    directorTitle,
    isDirector,
    isOfficer,
    isTenPercentOwner,
  };
}

async function main() {
  // Pour tester, on a besoin d'un accession number réel
  // On va utiliser un exemple - vous pouvez le remplacer par un vrai
  const accessionNumber = process.argv[2];
  const cik = process.argv[3] || PGIM_CIK;
  
  if (!accessionNumber) {
    console.error('❌ Usage: npx tsx scripts/debug_pgim_form4.ts <accession_number> [cik]');
    console.error('   Exemple: npx tsx scripts/debug_pgim_form4.ts 0001759669-25-000001 0001759669');
    process.exit(1);
  }
  
  try {
    console.log(`🔍 Analyse du Form 4 pour PGIM`);
    console.log(`   Accession: ${accessionNumber}`);
    console.log(`   CIK: ${cik}\n`);
    
    const xmlContent = await downloadForm4XML(accessionNumber, cik);
    console.log(`✅ XML téléchargé (${xmlContent.length} caractères)\n`);
    
    const analysis = analyzeXML(xmlContent);
    
    console.log('\n📊 Résumé:');
    console.log(`   Nom: ${analysis.ownerName || 'N/A'}`);
    console.log(`   Officer Title: ${analysis.officerTitle || 'N/A'}`);
    console.log(`   Director Title: ${analysis.directorTitle || 'N/A'}`);
    console.log(`   Is Director: ${analysis.isDirector || 'N/A'}`);
    console.log(`   Is Officer: ${analysis.isOfficer || 'N/A'}`);
    console.log(`   Is 10% Owner: ${analysis.isTenPercentOwner || 'N/A'}`);
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();
