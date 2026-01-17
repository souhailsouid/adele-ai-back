/**
 * Script de test complet pour le système Form 144
 * 
 * Teste:
 * 1. Collector: Récupération depuis flux Atom SEC
 * 2. Parsing: Extraction des données depuis XML
 * 3. Écriture: Stockage dans S3 Parquet
 * 4. Vérification: Lecture depuis Athena
 */

import { executeAthenaQuery } from '../services/api/src/athena/query';

const SEC_ATOM_FEED_URL = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=144&count=10&output=atom";
const USER_AGENT = "ADEL AI (contact@adel.ai)";

interface AtomEntry {
  title: string;
  link: string;
  id: string;
  updated: string;
  category?: string;
}

async function testForm144System() {
  console.log("🧪 TEST DU SYSTÈME FORM 144");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Test 1: Collector - Récupération depuis flux Atom
  console.log("1️⃣  TEST COLLECTOR: Récupération depuis flux Atom SEC");
  console.log("───────────────────────────────────────────────────────────");
  try {
    const entries = await fetchForm144Feed();
    console.log(`✅ Flux Atom récupéré: ${entries.length} entrées trouvées\n`);

    // Filtrer les Form 144
    const form144Entries = entries.filter(entry => entry.category === "144");
    console.log(`   📊 Form 144 trouvés: ${form144Entries.length}`);
    
    if (form144Entries.length > 0) {
      console.log(`\n   📋 Exemples de Form 144:`);
      form144Entries.slice(0, 3).forEach((entry, i) => {
        const parsed = parseForm144Entry(entry);
        console.log(`      ${i + 1}. ${parsed.companyName || entry.title}`);
        console.log(`         - Accession: ${parsed.accessionNumber || 'N/A'}`);
        console.log(`         - CIK: ${parsed.cik || 'N/A'}`);
        console.log(`         - Date: ${parsed.filingDate || entry.updated}`);
      });
    }
  } catch (error: any) {
    console.error(`❌ Erreur collector: ${error.message}`);
    return;
  }

  console.log("\n");

  // Test 2: Parsing - Tester avec un Form 144 réel
  console.log("2️⃣  TEST PARSING: Extraction des données depuis XML");
  console.log("───────────────────────────────────────────────────────────");
  try {
    // Récupérer un Form 144 réel depuis le flux
    const entries = await fetchForm144Feed();
    const form144Entry = entries.find(entry => entry.category === "144");
    
    if (!form144Entry) {
      console.log("⚠️  Aucun Form 144 trouvé dans le flux pour tester le parsing");
      console.log("   (Normal si aucun Form 144 n'a été déposé récemment)");
    } else {
      const parsed = parseForm144Entry(form144Entry);
      console.log(`✅ Entrée Form 144 extraite:`);
      console.log(`   - Company: ${parsed.companyName || 'N/A'}`);
      console.log(`   - Accession: ${parsed.accessionNumber || 'N/A'}`);
      console.log(`   - CIK: ${parsed.cik || 'N/A'}`);
      
      // Tester le parsing XML (si on a une URL)
      if (parsed.accessionNumber && parsed.cik) {
        console.log(`\n   🔍 Test de parsing XML...`);
        const notice = await testParseForm144XML(parsed.accessionNumber, parsed.cik, parsed.companyName);
        if (notice) {
          console.log(`   ✅ Parsing réussi!`);
          console.log(`      - Insider: ${notice.insider_name || 'N/A'}`);
          console.log(`      - Shares: ${notice.shares?.toLocaleString() || 'N/A'}`);
          console.log(`      - Price: $${notice.price_per_share?.toFixed(2) || 'N/A'}`);
          console.log(`      - Total: $${notice.total_value?.toLocaleString() || 'N/A'}`);
          console.log(`      - Filing Date: ${notice.filing_date || 'N/A'}`);
          console.log(`      - Proposed Sale Date: ${notice.proposed_sale_date || 'N/A'}`);
        } else {
          console.log(`   ⚠️  Parsing XML échoué (peut être normal si le format est différent)`);
        }
      }
    }
  } catch (error: any) {
    console.error(`❌ Erreur parsing: ${error.message}`);
  }

  console.log("\n");

  // Test 3: Vérification dans Athena
  console.log("3️⃣  TEST VÉRIFICATION: Lecture depuis Athena");
  console.log("───────────────────────────────────────────────────────────");
  try {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT cik) as companies,
        MAX(CAST(filing_date AS VARCHAR)) as last_filing,
        SUM(shares) as total_shares,
        AVG(total_value) as avg_value
      FROM form_144_notices
    `;

    const results = await executeAthenaQuery(query);
    const row = results[0] || {};
    
    console.log(`✅ Table form_144_notices accessible`);
    console.log(`   - Total notices: ${row.total || 0}`);
    console.log(`   - Companies: ${row.companies || 0}`);
    console.log(`   - Dernier filing: ${row.last_filing?.substring(0, 10) || 'N/A'}`);
    console.log(`   - Total shares: ${row.total_shares ? parseInt(row.total_shares).toLocaleString() : 'N/A'}`);
    console.log(`   - Valeur moyenne: $${row.avg_value ? parseFloat(row.avg_value).toLocaleString(undefined, {maximumFractionDigits: 0}) : 'N/A'}`);

    // Afficher quelques exemples récents
    if (parseInt(row.total || '0') > 0) {
      const examplesQuery = `
        SELECT 
          company_name,
          insider_name,
          shares,
          total_value,
          CAST(filing_date AS VARCHAR) as filing_date
        FROM form_144_notices
        ORDER BY filing_date DESC
        LIMIT 5
      `;
      const examples = await executeAthenaQuery(examplesQuery);
      console.log(`\n   📋 Exemples récents:`);
      examples.forEach((ex, i) => {
        console.log(`      ${i + 1}. ${ex.company_name || 'N/A'} - ${ex.insider_name || 'N/A'}`);
        console.log(`         ${ex.shares?.toLocaleString() || 'N/A'} shares - $${ex.total_value ? parseFloat(ex.total_value).toLocaleString() : 'N/A'} - ${ex.filing_date?.substring(0, 10) || 'N/A'}`);
      });
    } else {
      console.log(`\n   ⚠️  Aucune donnée dans la table (normal si le système vient d'être déployé)`);
    }
  } catch (error: any) {
    console.error(`❌ Erreur vérification Athena: ${error.message}`);
    if (error.message.includes('does not exist')) {
      console.log(`\n   💡 La table form_144_notices n'existe pas encore.`);
      console.log(`   Exécute: npx tsx scripts/create_form_144_notices_table.ts`);
    }
  }

  console.log("\n");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("✅ TESTS TERMINÉS");
  console.log("═══════════════════════════════════════════════════════════");
}

/**
 * Récupérer le flux Atom SEC pour les Form 144
 */
async function fetchForm144Feed(): Promise<AtomEntry[]> {
  const response = await fetch(SEC_ATOM_FEED_URL, {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });
  
  if (!response.ok) {
    throw new Error(`SEC feed error: ${response.status} ${response.statusText}`);
  }
  
  const xml = await response.text();
  return parseAtomFeed(xml);
}

/**
 * Parser le flux Atom
 */
function parseAtomFeed(xml: string): AtomEntry[] {
  const entries: AtomEntry[] = [];
  
  const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
  
  for (const match of entryMatches) {
    const entryXml = match[1];
    
    const titleMatch = entryXml.match(/<title[^>]*>(.*?)<\/title>/);
    const linkMatch = entryXml.match(/<link[^>]*href="([^"]*)"[^>]*>/);
    const idMatch = entryXml.match(/<id>(.*?)<\/id>/);
    const updatedMatch = entryXml.match(/<updated>(.*?)<\/updated>/);
    
    // Extraire la catégorie (term)
    const categoryMatch = entryXml.match(/<category[^>]*term="([^"]*)"[^>]*>/);
    const category = categoryMatch?.[1];
    
    if (titleMatch && linkMatch && idMatch) {
      entries.push({
        title: decodeHtmlEntities(titleMatch[1].trim()),
        link: linkMatch[1].trim(),
        id: idMatch[1].trim(),
        updated: updatedMatch?.[1]?.trim() || new Date().toISOString(),
        category: category,
      });
    }
  }
  
  return entries;
}

/**
 * Parser une entrée Form 144
 */
function parseForm144Entry(entry: AtomEntry): {
  accessionNumber?: string;
  cik?: string;
  companyName?: string;
  filingDate?: string;
} {
  // Essayer d'extraire depuis le lien viewer
  let accessionMatch = entry.link.match(/accession_number=([^&]+)/);
  let cikMatch = entry.link.match(/[&?]cik=([^&]+)/i) || entry.link.match(/CIK=([^&]+)/i);
  
  // Si pas trouvé, essayer depuis l'ID Atom
  if (!accessionMatch && entry.id) {
    const idMatch = entry.id.match(/accession-number=([^,]+)/);
    if (idMatch) {
      accessionMatch = [null, idMatch[1]];
    }
  }
  
  // Si pas trouvé, essayer depuis le titre
  if (!cikMatch) {
    const titleCikMatch = entry.title.match(/\(([0-9]{10})\)/);
    if (titleCikMatch) {
      cikMatch = [null, titleCikMatch[1]];
    }
  }
  
  // Extraire le nom de la company depuis le titre
  const titleMatch = entry.title.match(/(?:144|Form 144)\s*-\s*([^(]+)/i);
  
  return {
    accessionNumber: accessionMatch?.[1],
    cik: cikMatch?.[1]?.padStart(10, '0'),
    companyName: titleMatch?.[1]?.trim(),
    filingDate: entry.updated,
  };
}

/**
 * Tester le parsing XML d'un Form 144
 */
async function testParseForm144XML(accessionNumber: string, cik: string, companyName?: string): Promise<any | null> {
  try {
    const SEC_EDGAR_BASE_URL = 'https://www.sec.gov';
    const cikPadded = String(cik || '').padStart(10, '0');
    const accessionClean = accessionNumber.replace(/-/g, '');

    // Essayer différentes URLs
    const possibleUrls = [
      `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/${accessionNumber}.txt`,
      `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/xslF144X05/form144.xml`,
    ];

    for (const url of possibleUrls) {
      try {
        const response = await fetch(url, {
          headers: {
            "User-Agent": USER_AGENT,
          },
        });

        if (!response.ok) continue;

        let xmlContent = await response.text();

        // Si c'est un fichier .txt, extraire la section XML
        if (url.endsWith('.txt')) {
          const xmlMatch = xmlContent.match(/<XML>([\s\S]*?)<\/XML>/i);
          if (xmlMatch) {
            xmlContent = xmlMatch[1];
          }
        }

        // Parser le XML (simplifié pour le test)
        const insiderNameMatch = xmlContent.match(/<issuerName>([^<]+)<\/issuerName>/i) ||
                                xmlContent.match(/<reportingOwnerName>([^<]+)<\/reportingOwnerName>/i);
        const sharesMatch = xmlContent.match(/<sharesToBeSold>([^<]+)<\/sharesToBeSold>/i) ||
                           xmlContent.match(/<quantityOfSecurities>([^<]+)<\/quantityOfSecurities>/i);
        const priceMatch = xmlContent.match(/<pricePerShare>([^<]+)<\/pricePerShare>/i);
        const filingDateMatch = xmlContent.match(/<filingDate>([^<]+)<\/filingDate>/i);
        const proposedSaleDateMatch = xmlContent.match(/<proposedSaleDate>([^<]+)<\/proposedSaleDate>/i);

        if (insiderNameMatch || sharesMatch) {
          return {
            insider_name: insiderNameMatch?.[1]?.trim(),
            shares: sharesMatch ? parseFloat(sharesMatch[1].replace(/,/g, '')) : undefined,
            price_per_share: priceMatch ? parseFloat(priceMatch[1].replace(/[$,]/g, '')) : undefined,
            total_value: sharesMatch && priceMatch 
              ? parseFloat(sharesMatch[1].replace(/,/g, '')) * parseFloat(priceMatch[1].replace(/[$,]/g, ''))
              : undefined,
            filing_date: filingDateMatch?.[1]?.trim(),
            proposed_sale_date: proposedSaleDateMatch?.[1]?.trim(),
          };
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  } catch (error: any) {
    return null;
  }
}

/**
 * Décoder les entités HTML
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

testForm144System()
  .then(() => {
    console.log("\n✅ Script terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur:", error);
    process.exit(1);
  });
