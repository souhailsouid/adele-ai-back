/**
 * Script de test pour l'INSERTION réelle d'un Form 4 NVIDIA dans la base
 * 
 * Teste le flux complet :
 * 1. Récupère un Form 4 depuis le flux Atom
 * 2. Parse le XML
 * 3. Insère dans company_filings (via S3)
 * 4. Insère les transactions (via S3)
 * 5. Vérifie dans Athena
 */

import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';
import { executeAthenaQuery } from '../services/api/src/athena/query.js';
import { insertRowS3, insertRowsS3 } from '../services/api/src/athena/write.js';

const SEC_EDGAR_BASE_URL = 'https://www.sec.gov';
const USER_AGENT = 'PersonaMy Contact@example.com';

const NVDA_CIK = '0001045810';
const NVDA_TICKER = 'NVDA';

/**
 * Récupérer le premier Form 4 récent depuis le flux Atom (déprécié, utiliser getForm4ListFromFeed)
 */
async function getFirstForm4FromFeed(): Promise<{ accessionNumber: string; cik: string; filingDate: string } | null> {
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${NVDA_CIK}&type=4&count=5&output=atom`;
  
  console.log(`📥 Fetching Atom feed: ${url}`);
  
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Atom feed: ${response.status}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    removeNSPrefix: true,
  });

  const parsed = parser.parse(xml);
  const feedEntries = parsed.feed?.entry || [];
  const entriesArray = Array.isArray(feedEntries) ? feedEntries : (feedEntries ? [feedEntries] : []);

  if (entriesArray.length === 0) {
    return null;
  }

  const entry = entriesArray[0];
  let linkStr = '';
  if (typeof entry.link === 'string') {
    linkStr = entry.link;
  } else if (Array.isArray(entry.link)) {
    linkStr = entry.link[0]?.['@_href'] || entry.link[0] || '';
  } else if (entry.link?.['@_href']) {
    linkStr = entry.link['@_href'];
  }

  // Extraire accession_number depuis l'URL
  const indexMatch = linkStr.match(/(\d{10}-\d{2}-\d{6})-index\.htm/);
  const accessionNumber = indexMatch?.[1];
  
  if (!accessionNumber) {
    return null;
  }

  let updatedStr = '';
  if (typeof entry.updated === 'string') {
    updatedStr = entry.updated;
  } else if (entry.updated?.['#text']) {
    updatedStr = entry.updated['#text'];
  }

  return {
    accessionNumber,
    cik: NVDA_CIK,
    filingDate: updatedStr.split('T')[0],
  };
}

/**
 * Parser un Form 4 XML (simplifié, même logique que le worker)
 */
async function parseForm4XML(accessionNumber: string, cik: string): Promise<any> {
  const cikPadded = String(cik).padStart(10, '0');
  const accessionClean = accessionNumber.replace(/-/g, '');
  
  const url = `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/${accessionNumber}.txt`;
  
  console.log(`📄 Fetching XML: ${url}`);
  
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch XML: ${response.status}`);
  }

  let xmlContent = await response.text();

  // Extraire XML du .txt
  const xmlMatch = xmlContent.match(/<XML>([\s\S]*?)<\/XML>/i);
  if (xmlMatch) {
    xmlContent = xmlMatch[1];
  } else {
    const ownershipMatch = xmlContent.match(/(<ownershipDocument[\s\S]*<\/ownershipDocument>)/i);
    if (ownershipMatch) {
      xmlContent = ownershipMatch[1];
    }
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    removeNSPrefix: true,
  });

  return parser.parse(xmlContent);
}

/**
 * Trouver ou créer la company
 */
async function findOrCreateCompany(): Promise<number> {
  console.log(`🔍 Recherche de la company ${NVDA_TICKER}...`);
  
  const query = `
    SELECT id, ticker, name
    FROM companies
    WHERE ticker = '${NVDA_TICKER}'
    LIMIT 1
  `;
  
  const results = await executeAthenaQuery(query);
  
  if (results.length > 0) {
    const companyId = parseInt(results[0].id, 10);
    console.log(`✅ Company trouvée: ID=${companyId}, ${results[0].name}`);
    return companyId;
  }
  
  // Créer la company
  console.log(`📝 Création de la company ${NVDA_TICKER}...`);
  const companyData = {
    ticker: NVDA_TICKER,
    cik: NVDA_CIK,
    name: 'NVIDIA Corporation',
    sector: 'Technology',
    industry: 'Semiconductors',
  };
  
  const inserted = await insertRowS3('companies', companyData);
  console.log(`✅ Company créée: ID=${inserted.id}`);
  return inserted.id;
}

/**
 * Récupérer plusieurs Form 4 depuis le flux Atom
 */
async function getForm4ListFromFeed(count: number = 5): Promise<Array<{ accessionNumber: string; cik: string; filingDate: string }>> {
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${NVDA_CIK}&type=4&count=${count}&output=atom`;
  
  console.log(`📥 Fetching Atom feed: ${url}`);
  
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Atom feed: ${response.status}`);
  }

  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    removeNSPrefix: true,
  });

  const parsed = parser.parse(xml);
  const feedEntries = parsed.feed?.entry || [];
  const entriesArray = Array.isArray(feedEntries) ? feedEntries : (feedEntries ? [feedEntries] : []);

  const form4List: Array<{ accessionNumber: string; cik: string; filingDate: string }> = [];

  for (const entry of entriesArray) {
    let linkStr = '';
    if (typeof entry.link === 'string') {
      linkStr = entry.link;
    } else if (Array.isArray(entry.link)) {
      linkStr = entry.link[0]?.['@_href'] || entry.link[0] || '';
    } else if (entry.link?.['@_href']) {
      linkStr = entry.link['@_href'];
    }

    const indexMatch = linkStr.match(/(\d{10}-\d{2}-\d{6})-index\.htm/);
    const accessionNumber = indexMatch?.[1];
    
    if (!accessionNumber) continue;

    let updatedStr = '';
    if (typeof entry.updated === 'string') {
      updatedStr = entry.updated;
    } else if (entry.updated?.['#text']) {
      updatedStr = entry.updated['#text'];
    }

    form4List.push({
      accessionNumber,
      cik: NVDA_CIK,
      filingDate: updatedStr.split('T')[0],
    });
  }

  return form4List;
}

/**
 * Test d'insertion complet pour un Form 4
 */
async function testInsertionSingle(form4Info: { accessionNumber: string; cik: string; filingDate: string }) {
  try {
    // Vérifier si déjà présent
    const existingQuery = `
      SELECT id, status
      FROM company_filings
      WHERE accession_number = '${form4Info.accessionNumber.replace(/'/g, "''")}'
      LIMIT 1
    `;
    const existing = await executeAthenaQuery(existingQuery);
    
    if (existing.length > 0 && existing[0].status === 'PARSED') {
      console.log(`⏭️  ${form4Info.accessionNumber}: Déjà parsé, skip...`);
      return { skipped: true, reason: 'already_parsed' };
    }

    // 2. Parser le XML
    const parsedXml = await parseForm4XML(form4Info.accessionNumber, form4Info.cik);

    // 3. Trouver ou créer la company
    const companyId = await findOrCreateCompany();

    // 4. Créer le filing
    const filingData = {
      company_id: companyId,
      cik: NVDA_CIK,
      form_type: '4',
      accession_number: form4Info.accessionNumber,
      filing_date: form4Info.filingDate,
      status: 'DISCOVERED',
    };

    let filingId: number;
    if (existing.length > 0) {
      filingId = parseInt(existing[0].id, 10);
    } else {
      const inserted = await insertRowS3('company_filings', filingData);
      filingId = inserted.id;
    }

    // 5. Extraire et insérer les transactions
    const ownershipDoc = parsedXml.ownershipDocument;
    if (!ownershipDoc) {
      return { skipped: true, reason: 'no_ownership_document' };
    }

    const reportingOwner = ownershipDoc.reportingOwner || {};
    const insiderName = reportingOwner.reportingOwnerId?.rptOwnerName || reportingOwner.reportingOwnerName || 'Unknown';
    const insiderCik = reportingOwner.reportingOwnerId?.rptOwnerCik || reportingOwner.reportingOwnerCik;

    // Extraire relation
    let relation = 'Unknown';
    const officerTitle = reportingOwner.reportingOwnerRelationship?.officerTitle;
    const directorTitle = reportingOwner.reportingOwnerRelationship?.directorTitle;
    const isDirector = reportingOwner.reportingOwnerRelationship?.isDirector;
    const isOfficer = reportingOwner.reportingOwnerRelationship?.isOfficer;

    if (officerTitle) {
      relation = officerTitle;
    } else if (directorTitle) {
      relation = directorTitle;
    } else if (isDirector === '1' || isDirector === true) {
      relation = 'Director';
    } else if (isOfficer === '1' || isOfficer === true) {
      relation = 'Officer';
    }

    // Extraire transactions
    const transactions: any[] = [];
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
        const transactionDate = tx.transactionDate?.value || tx.transactionDate || form4Info.filingDate;

        if (shares > 0) {
          transactions.push({
            company_id: companyId,
            filing_id: filingId,
            insider_name: insiderName,
            insider_cik: insiderCik ? String(insiderCik).padStart(10, '0') : null,
            insider_title: relation,
            relation: relation,
            transaction_type: mapTransactionCode(transactionCode).toLowerCase(),
            shares: Math.round(shares),
            price_per_share: price > 0 ? price : null,
            total_value: totalValue > 0 ? totalValue : null,
            transaction_date: transactionDate,
            alert_flag: totalValue > 1000000,
          });
        }
      }
    }

    if (transactions.length === 0) {
      return { skipped: true, reason: 'no_transactions' };
    }

    // Insérer les transactions
    await insertRowsS3('insider_trades', transactions, { partitionByDate: true });

    return {
      success: true,
      filingId,
      transactionCount: transactions.length,
      totalValue: transactions.reduce((sum, t) => sum + (t.total_value || 0), 0),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Test d'insertion pour plusieurs Form 4
 */
async function testInsertion() {
  console.log('🚀 Test d\'insertion Form 4 NVIDIA (Plusieurs filings)\n');
  console.log('='.repeat(60));

  try {
    // 1. Récupérer plusieurs Form 4 depuis le flux
    console.log('\n📥 Étape 1: Récupération du flux Atom...');
    const form4List = await getForm4ListFromFeed(10);
    
    if (form4List.length === 0) {
      console.log('❌ Aucun Form 4 trouvé dans le flux');
      return;
    }

    console.log(`✅ ${form4List.length} Form 4 trouvés dans le flux\n`);

    // 2. Trouver ou créer la company (une seule fois)
    console.log('🏢 Étape 2: Recherche/Création de la company...');
    const companyId = await findOrCreateCompany();
    console.log('');

    // 3. Traiter chaque Form 4
    console.log('📋 Étape 3: Traitement des Form 4...\n');
    
    const results = {
      success: 0,
      skipped: 0,
      failed: 0,
      totalTransactions: 0,
      totalValue: 0,
    };

    for (let i = 0; i < form4List.length; i++) {
      const form4Info = form4List[i];
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`Form 4 ${i + 1}/${form4List.length}: ${form4Info.accessionNumber}`);
      console.log(`${'─'.repeat(60)}`);
      
      const result = await testInsertionSingle(form4Info);
      
      if (result.success) {
        results.success++;
        results.totalTransactions += result.transactionCount || 0;
        results.totalValue += result.totalValue || 0;
        console.log(`✅ Succès: ${result.transactionCount} transactions, $${(result.totalValue || 0).toLocaleString()}`);
      } else if (result.skipped) {
        results.skipped++;
        console.log(`⏭️  Skippé: ${result.reason}`);
      } else {
        results.failed++;
        console.log(`❌ Échec: ${result.error}`);
      }

      // Rate limiting
      if (i < form4List.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 4. Résumé
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(60));
    console.log(`✅ Succès: ${results.success}`);
    console.log(`⏭️  Skippés: ${results.skipped}`);
    console.log(`❌ Échecs: ${results.failed}`);
    console.log(`📊 Transactions totales: ${results.totalTransactions}`);
    console.log(`💰 Valeur totale: $${results.totalValue.toLocaleString()}`);
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

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

testInsertion().catch(console.error);
