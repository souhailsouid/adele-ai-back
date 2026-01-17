/**
 * Script de test pour le parsing Form 4 de NVIDIA (NVDA)
 * 
 * Teste le flux RSS Atom par entreprise et vérifie que toutes les informations
 * sont correctement récupérées et parsées.
 */

import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';
import { executeAthenaQuery } from '../services/api/src/athena/query.js';

const SEC_EDGAR_BASE_URL = 'https://www.sec.gov';
const USER_AGENT = 'PersonaMy Contact@example.com';

// CIK de NVIDIA
const NVDA_CIK = '0001045810';
const NVDA_TICKER = 'NVDA';
const NVDA_NAME = 'NVIDIA Corporation';

interface AtomEntry {
  title: string;
  link: string;
  updated: string;
  category?: string;
  summary?: string;
  accessionNumber?: string;
  cik?: string;
}

interface Form4Data {
  accessionNumber: string;
  cik: string;
  filingDate: string;
  insiderName?: string;
  insiderCik?: string;
  transactions: Array<{
    transactionType: string;
    shares: number;
    pricePerShare?: number;
    totalValue?: number;
    transactionDate: string;
    relation?: string;
    insiderTitle?: string;
  }>;
}

/**
 * Récupérer le flux Atom pour NVIDIA
 */
async function fetchNVDAAtomFeed(): Promise<AtomEntry[]> {
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${NVDA_CIK}&type=4&count=40&output=atom`;
  
  console.log(`📥 Fetching Atom feed: ${url}`);
  
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Atom feed: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    removeNSPrefix: true,
  });

  const parsed = parser.parse(xml);
  const entries: AtomEntry[] = [];

  const feedEntries = parsed.feed?.entry || [];
  const entriesArray = Array.isArray(feedEntries) ? feedEntries : (feedEntries ? [feedEntries] : []);

  for (const entry of entriesArray) {
    // Gérer link qui peut être un objet ou un array
    let linkStr = '';
    if (typeof entry.link === 'string') {
      linkStr = entry.link;
    } else if (Array.isArray(entry.link)) {
      linkStr = entry.link[0]?.['@_href'] || entry.link[0] || '';
    } else if (entry.link?.['@_href']) {
      linkStr = entry.link['@_href'];
    }
    
    // Extraire accession_number depuis l'URL
    // Format: https://www.sec.gov/Archives/edgar/data/1045810/000134784226000002/0001347842-26-000002-index.htm
    // L'accession number est dans le nom du dossier: 0001347842-26-000002
    let accessionNumber: string | undefined;
    const pathMatch = linkStr.match(/\/Archives\/edgar\/data\/\d+\/([^\/]+)\//);
    if (pathMatch) {
      // Le nom du dossier contient l'accession number avec des zéros initiaux
      // Exemple: 000134784226000002 -> 0001347842-26-000002
      const folderName = pathMatch[1];
      // Extraire depuis le nom du fichier index si présent
      const indexMatch = linkStr.match(/(\d{10}-\d{2}-\d{6})-index\.htm/);
      if (indexMatch) {
        accessionNumber = indexMatch[1];
      } else {
        // Essayer de reconstruire depuis le nom du dossier
        // Format: 000134784226000002 (CIK + accession sans tirets)
        if (folderName.length >= 18) {
          const cikPart = folderName.substring(0, 10);
          const rest = folderName.substring(10);
          if (rest.length >= 8) {
            accessionNumber = `${cikPart}-${rest.substring(0, 2)}-${rest.substring(2)}`;
          }
        }
      }
    }
    
    // Fallback: chercher dans le lien directement
    if (!accessionNumber) {
      const accessionMatch = linkStr.match(/accession_number=([^&]+)/);
      accessionNumber = accessionMatch?.[1];
    }
    
    const cikMatch = linkStr.match(/cik=([^&]+)/) || linkStr.match(/\/data\/(\d+)\//);
    
    // Gérer title qui peut être un objet
    let titleStr = '';
    if (typeof entry.title === 'string') {
      titleStr = entry.title;
    } else if (entry.title?.['#text']) {
      titleStr = entry.title['#text'];
    }
    
    // Gérer updated
    let updatedStr = '';
    if (typeof entry.updated === 'string') {
      updatedStr = entry.updated;
    } else if (entry.updated?.['#text']) {
      updatedStr = entry.updated['#text'];
    }
    
    // Gérer category
    let categoryStr = '';
    if (typeof entry.category === 'string') {
      categoryStr = entry.category;
    } else if (entry.category?.['@_term']) {
      categoryStr = entry.category['@_term'];
    } else if (Array.isArray(entry.category)) {
      const form4Category = entry.category.find((c: any) => c['@_term'] === '4');
      categoryStr = form4Category?.['@_term'] || '';
    }
    
    entries.push({
      title: titleStr,
      link: linkStr,
      updated: updatedStr,
      category: categoryStr,
      summary: typeof entry.summary === 'string' ? entry.summary : (entry.summary?.['#text'] || ''),
      accessionNumber: accessionNumber,
      cik: cikMatch?.[1]?.padStart(10, '0') || NVDA_CIK,
    });
  }

  return entries;
}

/**
 * Parser un Form 4 XML
 */
async function parseForm4XML(accessionNumber: string, cik: string): Promise<Form4Data | null> {
  const cikPadded = String(cik).padStart(10, '0');
  const accessionClean = accessionNumber.replace(/-/g, '');
  
  const possibleUrls = [
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/${accessionNumber}.txt`,
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/xslF345X05/form4.xml`,
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/xslF345X04/form4.xml`,
  ];

  for (const url of possibleUrls) {
    try {
      console.log(`  📄 Trying: ${url}`);
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
      });

      if (!response.ok) {
        continue;
      }

      let xmlContent = await response.text();

      // Extraire XML du .txt si nécessaire
      if (url.endsWith('.txt')) {
        const xmlMatch = xmlContent.match(/<XML>([\s\S]*?)<\/XML>/i);
        if (xmlMatch) {
          xmlContent = xmlMatch[1];
        } else {
          const ownershipMatch = xmlContent.match(/(<ownershipDocument[\s\S]*<\/ownershipDocument>)/i);
          if (ownershipMatch) {
            xmlContent = ownershipMatch[1];
          }
        }
      }

      // Parser le XML
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        removeNSPrefix: true,
      });

      const parsed = parser.parse(xmlContent);
      const ownershipDoc = parsed.ownershipDocument;

      if (!ownershipDoc) {
        continue;
      }

      // Extraire les informations
      const reportingOwner = ownershipDoc.reportingOwner || {};
      const rptOwnerName = reportingOwner.reportingOwnerId?.rptOwnerName || reportingOwner.reportingOwnerName;
      const rptOwnerCik = reportingOwner.reportingOwnerId?.rptOwnerCik || reportingOwner.reportingOwnerCik;

      // Extraire relation/insider_title
      let relation = 'Unknown';
      const officerTitle = reportingOwner.reportingOwnerRelationship?.officerTitle;
      const directorTitle = reportingOwner.reportingOwnerRelationship?.directorTitle;
      const isDirector = reportingOwner.reportingOwnerRelationship?.isDirector;
      const isOfficer = reportingOwner.reportingOwnerRelationship?.isOfficer;
      const isTenPercentOwner = reportingOwner.reportingOwnerRelationship?.isTenPercentOwner;

      if (officerTitle) {
        relation = officerTitle;
      } else if (directorTitle) {
        relation = directorTitle;
      } else if (isDirector === '1' || isDirector === true) {
        relation = 'Director';
      } else if (isOfficer === '1' || isOfficer === true) {
        relation = 'Officer';
      } else if (isTenPercentOwner === '1' || isTenPercentOwner === true) {
        relation = '10% Owner';
      }

      // Extraire les transactions
      const transactions: Form4Data['transactions'] = [];
      
      // Non-derivative transactions
      const nonDerivativeTable = ownershipDoc.nonDerivativeTable;
      if (nonDerivativeTable?.nonDerivativeTransaction) {
        const txs = Array.isArray(nonDerivativeTable.nonDerivativeTransaction)
          ? nonDerivativeTable.nonDerivativeTransaction
          : [nonDerivativeTable.nonDerivativeTransaction];

        for (const tx of txs) {
          const transactionCode = tx.transactionCode || tx.transactionCode?.value || '';
          const shares = parseFloat(tx.transactionAmounts?.transactionShares?.value || tx.transactionShares?.value || '0');
          const price = parseFloat(tx.transactionAmounts?.transactionPricePerShare?.value || tx.transactionPricePerShare?.value || '0');
          const totalValue = shares * price;
          const transactionDate = tx.transactionDate?.value || tx.transactionDate || '';

          if (shares > 0) {
            transactions.push({
              transactionType: mapTransactionCode(transactionCode),
              shares: Math.round(shares),
              pricePerShare: price > 0 ? price : undefined,
              totalValue: totalValue > 0 ? totalValue : undefined,
              transactionDate: transactionDate,
              relation: relation,
              insiderTitle: relation,
            });
          }
        }
      }

      // Filing date
      const periodOfReport = ownershipDoc.periodOfReport || ownershipDoc.periodOfReport?.value || '';
      const filingDate = periodOfReport || new Date().toISOString().split('T')[0];

      return {
        accessionNumber,
        cik: cikPadded,
        filingDate,
        insiderName: rptOwnerName,
        insiderCik: rptOwnerCik,
        transactions,
      };
    } catch (error: any) {
      console.warn(`  ⚠️ Error parsing ${url}: ${error.message}`);
      continue;
    }
  }

  return null;
}

/**
 * Mapper les codes de transaction
 */
function mapTransactionCode(code: string): string {
  const mapping: Record<string, string> = {
    'P': 'Purchase',
    'S': 'Sale',
    'M': 'Exercise',
    'C': 'Conversion',
    'A': 'Grant',
    'G': 'Gift',
    'F': 'Tax Payment',
    'J': 'Other',
  };
  return mapping[code.toUpperCase()] || `Other (${code})`;
}

/**
 * Vérifier dans Athena si les données sont présentes
 */
async function checkAthenaData(accessionNumber: string): Promise<void> {
  console.log(`\n🔍 Vérification dans Athena pour ${accessionNumber}...`);
  
  try {
    // Vérifier company_filings
    const filingQuery = `
      SELECT id, company_id, accession_number, filing_date, status
      FROM company_filings
      WHERE accession_number = '${accessionNumber.replace(/'/g, "''")}'
      LIMIT 1
    `;
    const filingResults = await executeAthenaQuery(filingQuery);
    
    if (filingResults.length > 0) {
      const filing = filingResults[0];
      console.log(`  ✅ Filing trouvé dans Athena:`);
      console.log(`     - ID: ${filing.id}`);
      console.log(`     - Company ID: ${filing.company_id}`);
      console.log(`     - Filing Date: ${filing.filing_date}`);
      console.log(`     - Status: ${filing.status}`);
      
      // Vérifier les transactions
      const transactionQuery = `
        SELECT COUNT(*) as count, 
               SUM(total_value) as total_value_sum,
               MAX(transaction_date) as last_transaction_date
        FROM insider_trades
        WHERE filing_id = ${filing.id}
      `;
      const transactionResults = await executeAthenaQuery(transactionQuery);
      
      if (transactionResults.length > 0) {
        const tx = transactionResults[0];
        console.log(`  ✅ Transactions trouvées:`);
        console.log(`     - Nombre: ${tx.count}`);
        console.log(`     - Total Value: $${parseFloat(tx.total_value_sum || '0').toLocaleString()}`);
        console.log(`     - Dernière transaction: ${tx.last_transaction_date}`);
      } else {
        console.log(`  ⚠️ Aucune transaction trouvée pour ce filing`);
      }
    } else {
      console.log(`  ⚠️ Filing non trouvé dans Athena`);
    }
  } catch (error: any) {
    console.error(`  ❌ Erreur lors de la vérification Athena: ${error.message}`);
  }
}

/**
 * Test principal
 */
async function testNVDAParsing() {
  console.log('🚀 Test du parsing Form 4 pour NVIDIA (NVDA)\n');
  console.log(`📊 Informations:`);
  console.log(`   • Ticker: ${NVDA_TICKER}`);
  console.log(`   • CIK: ${NVDA_CIK}`);
  console.log(`   • Nom: ${NVDA_NAME}\n`);

  try {
    // 1. Récupérer le flux Atom
    console.log('📥 Étape 1: Récupération du flux Atom...');
    const entries = await fetchNVDAAtomFeed();
    console.log(`✅ ${entries.length} Form 4 trouvés dans le flux Atom\n`);

    if (entries.length === 0) {
      console.log('❌ Aucun Form 4 trouvé dans le flux Atom');
      return;
    }

    // 2. Parser les 3 premiers Form 4 récents
    const entriesToParse = entries.slice(0, 3);
    console.log(`📋 Étape 2: Parsing des ${entriesToParse.length} premiers Form 4...\n`);

    for (let i = 0; i < entriesToParse.length; i++) {
      const entry = entriesToParse[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Form 4 ${i + 1}/${entriesToParse.length}: ${entry.accessionNumber || 'N/A'}`);
      console.log(`${'='.repeat(60)}`);
      console.log(`Title: ${entry.title}`);
      console.log(`Updated: ${entry.updated}`);
      console.log(`Link: ${entry.link}`);

      if (!entry.accessionNumber) {
        console.log('⚠️ Pas d\'accession number, skip...');
        continue;
      }

      // Parser le Form 4
      console.log(`\n📄 Parsing du XML...`);
      const form4Data = await parseForm4XML(entry.accessionNumber, entry.cik || NVDA_CIK);

      if (!form4Data) {
        console.log('❌ Échec du parsing');
        continue;
      }

      // Afficher les résultats
      console.log(`\n✅ Parsing réussi!`);
      console.log(`   • Accession Number: ${form4Data.accessionNumber}`);
      console.log(`   • CIK: ${form4Data.cik}`);
      console.log(`   • Filing Date: ${form4Data.filingDate}`);
      console.log(`   • Insider Name: ${form4Data.insiderName || 'N/A'}`);
      console.log(`   • Insider CIK: ${form4Data.insiderCik || 'N/A'}`);
      console.log(`   • Nombre de transactions: ${form4Data.transactions.length}`);

      if (form4Data.transactions.length > 0) {
        console.log(`\n📊 Transactions:`);
        form4Data.transactions.forEach((tx, idx) => {
          console.log(`   ${idx + 1}. ${tx.transactionType}`);
          console.log(`      - Shares: ${tx.shares.toLocaleString()}`);
          console.log(`      - Price: ${tx.pricePerShare ? `$${tx.pricePerShare.toFixed(2)}` : 'N/A'}`);
          console.log(`      - Total Value: ${tx.totalValue ? `$${tx.totalValue.toLocaleString()}` : 'N/A'}`);
          console.log(`      - Date: ${tx.transactionDate}`);
          console.log(`      - Relation: ${tx.relation || 'Unknown'}`);
          console.log(`      - Title: ${tx.insiderTitle || 'Unknown'}`);
        });
      }

      // Vérifier dans Athena
      await checkAthenaData(form4Data.accessionNumber);

      // Rate limiting
      if (i < entriesToParse.length - 1) {
        console.log(`\n⏳ Attente 1 seconde (rate limiting)...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ Test terminé!');
    console.log(`${'='.repeat(60)}\n`);

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

// Exécuter le test
testNVDAParsing().catch(console.error);
