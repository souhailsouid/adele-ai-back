/**
 * Script de synchronisation SEC pour Smart Money
 * 
 * 1. Synchronise les 13F-HR des Investment Managers
 * 2. Synchronise les Form 4 des top 100 companies
 * 3. Synchronise les données XBRL des 10-Q/10-K
 * 4. Suit les dirigeants via leur CIK personnel (cross-company tracking)
 * 
 * Usage:
 *   npx tsx scripts/sync_sec_smart_money.ts [--funds-only] [--insiders-only] [--earnings-only] [--track-insiders]
 * 
 * Options:
 *   --funds-only        : Synchroniser uniquement les 13F-HR des Investment Managers
 *   --insiders-only     : Synchroniser uniquement les Form 4 des top companies
 *   --earnings-only     : Synchroniser uniquement les données XBRL (10-Q/10-K)
 *   --track-insiders    : Suivre les dirigeants via leur CIK personnel (cross-company tracking)
 */

import * as path from 'path';
import * as fs from 'fs';
import { executeAthenaQuery } from '../services/api/src/athena/query';
import { findRowByColumnInS3Parquet } from '../services/api/src/athena/s3-direct-read';
import { insertRowS3, insertRowsS3 } from '../services/api/src/athena/write';
import { mapCusipToTicker, mapCusipsToTickers } from '../services/api/src/services/cusip-mapping.service';
import { parseForm4FromUrl } from '../services/api/src/services/form4-parser.service';
import { parseXBRLFromUrl } from '../services/api/src/services/xbrl-parser.service';
import { getCompaniesAthena } from '../services/api/src/athena/companies';
import { getFundsAthena } from '../services/api/src/athena/funds';

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

const SEC_EDGAR_BASE_URL = 'https://www.sec.gov';
const USER_AGENT = 'ADEL AI (contact@adel.ai)';

// Rate limiting: 10 requêtes par seconde max (SEC requirement)
const RATE_LIMIT_DELAY = 100; // 100ms entre chaque requête = 10 req/s

/**
 * Synchroniser les 13F-HR des Investment Managers
 */
async function syncFunds13F(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 SYNCHRONISATION 13F-HR (Investment Managers)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Récupérer tous les funds de type Investment Manager (via Athena)
  const allFunds = await getFundsAthena(1000);
  const funds = allFunds.filter(f => 
    f.category === 'investment_manager' || f.category === 'hedge_fund'
  ).slice(0, 50); // Limiter pour les tests

  console.log(`Found ${funds.length} Investment Managers to sync\n`);

  for (const fund of funds || []) {
    try {
      console.log(`Processing ${fund.name} (CIK: ${fund.cik})...`);
      
      // Chercher les nouveaux 13F-HR filings
      const filings = await discoverNew13FFilings(fund.cik);
      
      if (filings.length === 0) {
        console.log(`  No new filings found\n`);
        continue;
      }

      console.log(`  Found ${filings.length} new 13F-HR filings`);

      for (const filing of filings) {
        await process13FFiling(fund.id, fund.cik, filing);
        await sleep(RATE_LIMIT_DELAY);
      }

      console.log(`  ✅ Completed ${fund.name}\n`);
    } catch (error: any) {
      console.error(`  ❌ Error processing ${fund.name}:`, error.message);
    }
  }
}

/**
 * Découvrir les nouveaux 13F-HR filings pour un CIK
 */
async function discoverNew13FFilings(cik: string): Promise<any[]> {
  const rssUrl = `${SEC_EDGAR_BASE_URL}/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR&dateb=&owner=include&count=10&output=atom`;

  const response = await fetch(rssUrl, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`EDGAR API error: ${response.status}`);
  }

  const xml = await response.text();
  const entries = parseEDGARFeed(xml);

  // Vérifier quels filings existent déjà (via Athena)
  const accessionNumbers = entries.map(e => e.accessionNumber);
  if (accessionNumbers.length === 0) {
    return [];
  }

  const accessionList = accessionNumbers.map(a => `'${a.replace(/'/g, "''")}'`).join(', ');
  const query = `
    SELECT DISTINCT accession_number
    FROM fund_filings
    WHERE accession_number IN (${accessionList})
  `;

  try {
    const existing = await executeAthenaQuery(query);
    const existingSet = new Set(
      existing.map((row: any) => row.accession_number || row[0]).filter(Boolean)
    );
    
    return entries.filter(e => !existingSet.has(e.accessionNumber));
  } catch (error: any) {
    // Si la table n'existe pas encore, retourner tous les entries
    console.warn(`[13F Discovery] Could not check existing filings: ${error.message}`);
    return entries;
  }
}

/**
 * Parser un feed Atom EDGAR
 */
function parseEDGARFeed(xml: string): any[] {
  const entries: any[] = [];
  const entryMatches = xml.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/gi);
  
  for (const match of entryMatches) {
    const entryXml = match[1];
    const titleMatch = entryXml.match(/<title[^>]*>([^<]+)<\/title>/i);
    const linkMatch = entryXml.match(/<link[^>]*href="([^"]+)"/i);
    const updatedMatch = entryXml.match(/<updated[^>]*>([^<]+)<\/updated>/i);
    const accessionMatch = entryXml.match(/<accession-number[^>]*>([^<]+)<\/accession-number>/i);
    
    if (titleMatch && linkMatch && updatedMatch) {
      entries.push({
        title: titleMatch[1].trim(),
        link: linkMatch[1],
        filingDate: updatedMatch[1].substring(0, 10),
        accessionNumber: accessionMatch ? accessionMatch[1].trim() : extractAccessionFromLink(linkMatch[1]),
      });
    }
  }
  
  return entries;
}

function extractAccessionFromLink(link: string): string {
  const match = link.match(/data\/(\d+)\/([^\/]+)/);
  if (match) {
    return match[2].replace(/-/g, '-');
  }
  return '';
}

/**
 * Traiter un filing 13F-HR
 * 
 * Note: Cette fonction appelle le parser 13F existant via EventBridge
 * ou directement si on est en mode local
 */
async function process13FFiling(fundId: number, cik: string, filing: any): Promise<void> {
  // Vérifier si le filing existe déjà (via Athena)
  try {
    const checkQuery = `
      SELECT id, status
      FROM fund_filings
      WHERE accession_number = '${filing.accessionNumber.replace(/'/g, "''")}'
      LIMIT 1
    `;
    const existing = await executeAthenaQuery(checkQuery);
    
    if (existing && existing.length > 0) {
      const existingRow = existing[0];
      const status = existingRow.status || existingRow[1];
      if (status === 'PARSED') {
        console.log(`    Skipping ${filing.accessionNumber} (already parsed)`);
        return;
      }
    }
  } catch (error: any) {
    // Si la table n'existe pas encore, continuer avec l'insertion
    console.warn(`[13F] Could not check existing filing: ${error.message}`);
  }

  // Créer le filing sur S3
  const filingData = {
    fund_id: fundId,
    accession_number: filing.accessionNumber,
    form_type: '13F-HR',
    filing_date: filing.filingDate,
    status: 'DISCOVERED',
  };

  await insertRowS3('fund_filings', filingData);
  console.log(`    ✅ Saved filing ${filing.accessionNumber}`);

  // TODO: Déclencher le parser 13F (via EventBridge ou directement)
  // Pour l'instant, on laisse le système existant gérer le parsing
}

/**
 * Synchroniser les transactions cross-company des dirigeants
 * 
 * Récupère tous les CIK de dirigeants uniques et suit leurs transactions
 * dans toutes les entreprises où ils sont actifs (Form 3, 4, 5)
 */
export async function syncInsiderCrossCompany(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔗 SYNCHRONISATION CROSS-COMPANY (Insider Tracking)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Récupérer tous les CIK de dirigeants uniques depuis insider_trades
  // Option: Ne tracker que les CIK qui n'ont pas été trackés récemment
  // Pour l'instant, on prend tous les CIK uniques (peut être optimisé plus tard)
  const query = `
    SELECT DISTINCT insider_cik
    FROM insider_trades
    WHERE insider_cik IS NOT NULL
      AND insider_cik != ''
    ORDER BY insider_cik
    LIMIT 100  -- Limiter pour éviter trop de requêtes
  `;

  try {
    const results = await executeAthenaQuery(query);
    const insiderCiks = results
      .map((row: any) => row.insider_cik || row[0])
      .filter(Boolean);

    console.log(`Found ${insiderCiks.length} unique insiders to track\n`);

    for (const insiderCik of insiderCiks) {
      try {
        console.log(`Tracking insider CIK: ${insiderCik}...`);
        
        // Récupérer tous les filings de ce dirigeant
        const filings = await discoverInsiderFilings(insiderCik);
        
        if (filings.length === 0) {
          console.log(`  No new filings found\n`);
          continue;
        }

        console.log(`  Found ${filings.length} filings (Form 3/4/5)`);

        // Parser et stocker les transactions cross-company
        for (const filing of filings) {
          await processInsiderFiling(insiderCik, filing);
          await sleep(RATE_LIMIT_DELAY);
        }

        console.log(`  ✅ Completed tracking for CIK ${insiderCik}\n`);
        await sleep(RATE_LIMIT_DELAY);
      } catch (error: any) {
        console.error(`  ❌ Error tracking CIK ${insiderCik}:`, error.message);
      }
    }
  } catch (error: any) {
    console.error(`[Cross-Company] Error fetching insider CIKs:`, error.message);
  }
}

/**
 * Découvrir tous les filings d'un dirigeant (Form 3, 4, 5)
 * 
 * Utilise l'API submissions avec le CIK du dirigeant
 */
async function discoverInsiderFilings(insiderCik: string): Promise<any[]> {
  const cikPadded = insiderCik.padStart(10, '0');
  const submissionsUrl = `https://data.sec.gov/submissions/CIK${cikPadded}.json`;

  await sleep(RATE_LIMIT_DELAY);

  try {
    const response = await fetch(submissionsUrl, {
      headers: { 
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`SEC submissions API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extraire les Form 3, 4, 5 depuis filings.recent
    const filings = data.filings?.recent || {};
    const formTypes = filings.form || [];
    const accessionNumbers = filings.accessionNumber || [];
    const filingDates = filings.filingDate || [];
    const primaryDocuments = filings.primaryDocument || [];
    
    // Filtrer pour ne garder que les Form 3, 4, 5
    const insiderFilings: any[] = [];
    for (let i = 0; i < formTypes.length; i++) {
      const formType = formTypes[i];
      if (formType === '3' || formType === '4' || formType === '5') {
        insiderFilings.push({
          formType: formType,
          accessionNumber: accessionNumbers[i],
          filingDate: filingDates[i],
          primaryDocument: primaryDocuments[i],
        });
      }
    }

    // Limiter aux 20 plus récents
    return insiderFilings.slice(0, 20);
  } catch (error: any) {
    console.error(`[Insider Discovery] Error fetching filings for CIK ${insiderCik}:`, error.message);
    return [];
  }
}

/**
 * Traiter un filing d'un dirigeant (Form 3, 4, 5)
 * 
 * Parse le filing et stocke les transactions même si elles sont pour d'autres entreprises
 */
async function processInsiderFiling(insiderCik: string, filing: any): Promise<void> {
  // Vérifier si le filing existe déjà
  let filingId: number | null = null;
  try {
    const checkQuery = `
      SELECT id, status
      FROM company_filings
      WHERE accession_number = '${filing.accessionNumber.replace(/'/g, "''")}'
        AND form_type = '${filing.formType}'
      LIMIT 1
    `;
    const existing = await executeAthenaQuery(checkQuery);
    
    if (existing && existing.length > 0) {
      const existingRow = existing[0];
      filingId = parseInt(existingRow.id || existingRow[0], 10);
      const status = existingRow.status || existingRow[1];
      if (status === 'PARSED') {
        console.log(`    Skipping ${filing.accessionNumber} (already parsed)`);
        return;
      }
    }
  } catch (error: any) {
    console.warn(`[Insider Filing] Could not check existing filing: ${error.message}`);
  }

  // Extraire le CIK de l'entreprise depuis l'accession number
  // Format: 0001341439-25-000090 -> CIK = 0001341439
  const companyCikMatch = filing.accessionNumber.match(/^(\d{10})-/);
  const companyCik = companyCikMatch ? companyCikMatch[1] : null;

  if (!companyCik) {
    console.warn(`    Could not extract company CIK from ${filing.accessionNumber}`);
    return;
  }

  // Chercher l'entreprise par CIK
  let companyId: number | null = null;
  try {
    const companyQuery = `
      SELECT id
      FROM companies
      WHERE cik = '${companyCik}'
      LIMIT 1
    `;
    const companies = await executeAthenaQuery(companyQuery);
    if (companies && companies.length > 0) {
      companyId = parseInt(companies[0].id || companies[0][0], 10);
    }
  } catch (error: any) {
    console.warn(`[Insider Filing] Could not find company for CIK ${companyCik}:`, error.message);
  }

  // Si l'entreprise n'existe pas dans notre base, on la crée ou on skip
  // Pour l'instant, on skip si l'entreprise n'existe pas
  if (!companyId) {
    console.log(`    Skipping ${filing.accessionNumber} (company CIK ${companyCik} not in database)`);
    return;
  }

  // Créer le filing si nécessaire
  if (!filingId) {
    const filingData = {
      company_id: companyId,
      cik: companyCik,
      form_type: filing.formType,
      accession_number: filing.accessionNumber,
      filing_date: filing.filingDate,
      document_url: '', // Sera construit lors du parsing
      status: 'DISCOVERED',
    };

    const result = await insertRowS3('company_filings', filingData);
    filingId = result.id;
  }

  // Parser le Form 4 uniquement (Form 3 et 5 nécessitent des parsers différents)
  if (filing.formType === '4') {
    try {
      await parseForm4FromUrl(
        companyId,
        filingId,
        filing.accessionNumber,
        companyCik,
        filing.primaryDocument
      );
      console.log(`    ✅ Parsed Form 4 ${filing.accessionNumber} (cross-company)`);
    } catch (error: any) {
      console.error(`    ❌ Error parsing Form 4:`, error.message);
    }
  } else {
    console.log(`    ⚠️  Form ${filing.formType} parsing not yet implemented`);
  }
}

/**
 * Synchroniser les Form 4 des top 100 companies
 */
export async function syncInsiderTransactions(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('👥 SYNCHRONISATION FORM 4 (Insider Transactions)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Récupérer les top 100 companies (via Athena)
  const companies = await getCompaniesAthena(10, 0, 'market_cap', 'DESC');

  console.log(`Found ${companies.length} companies to sync\n`);

  for (const company of companies || []) {
    try {
      console.log(`Processing ${company.ticker} (${company.name})...`);
      
      // Chercher les nouveaux Form 4 filings
      const filings = await discoverNewForm4Filings(company.cik);
      
      if (filings.length === 0) {
        console.log(`  No new Form 4 filings found\n`);
        continue;
      }

      console.log(`  Found ${filings.length} new Form 4 filings`);

      for (const filing of filings) {
        await processForm4Filing(company.id, company.cik, filing);
        await sleep(RATE_LIMIT_DELAY);
      }
      
      // Rate limiting après chaque company (pour l'API submissions)
      await sleep(RATE_LIMIT_DELAY);

      console.log(`  ✅ Completed ${company.ticker}\n`);
    } catch (error: any) {
      console.error(`  ❌ Error processing ${company.ticker}:`, error.message);
    }
  }
}

/**
 * Découvrir les nouveaux Form 4 filings pour un CIK
 * 
 * Utilise l'API submissions de la SEC pour obtenir le primaryDocument exact
 * Format: https://data.sec.gov/submissions/CIK{cik}.json
 */
async function discoverNewForm4Filings(cik: string): Promise<any[]> {
  // L'API submissions nécessite le CIK avec les zéros initiaux, formaté sur 10 caractères
  const cikPadded = cik.padStart(10, '0');
  
  const submissionsUrl = `https://data.sec.gov/submissions/CIK${cikPadded}.json`;

  // Rate limiting: attendre avant chaque requête à l'API submissions
  await sleep(RATE_LIMIT_DELAY);

  try {
    const response = await fetch(submissionsUrl, {
      headers: { 
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`SEC submissions API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extraire les Form 4 depuis filings.recent
    const filings = data.filings?.recent || {};
    const formTypes = filings.form || [];
    const accessionNumbers = filings.accessionNumber || [];
    const filingDates = filings.filingDate || [];
    const primaryDocuments = filings.primaryDocument || [];
    
    // Filtrer pour ne garder que les Form 4
    const form4Entries: any[] = [];
    for (let i = 0; i < formTypes.length; i++) {
      if (formTypes[i] === '4') {
        form4Entries.push({
          accessionNumber: accessionNumbers[i],
          filingDate: filingDates[i],
          primaryDocument: primaryDocuments[i],
        });
      }
    }

    // Limiter aux 20 plus récents
    const recentForm4 = form4Entries.slice(0, 20);

    // Vérifier quels filings existent déjà (via Athena)
    const accessionNumbersList = recentForm4.map(e => e.accessionNumber);
    if (accessionNumbersList.length === 0) {
      return [];
    }

    const accessionList = accessionNumbersList.map(a => `'${a.replace(/'/g, "''")}'`).join(', ');
    const query = `
      SELECT DISTINCT accession_number
      FROM company_filings
      WHERE accession_number IN (${accessionList})
        AND form_type = '4'
    `;

    try {
      const existing = await executeAthenaQuery(query);
      const existingSet = new Set(
        existing.map((row: any) => row.accession_number || row[0]).filter(Boolean)
      );
      
      return recentForm4.filter(e => !existingSet.has(e.accessionNumber));
    } catch (error: any) {
      // Si la table n'existe pas encore, retourner tous les entries
      console.warn(`[Form4 Discovery] Could not check existing filings: ${error.message}`);
      return recentForm4;
    }
  } catch (error: any) {
    console.error(`[Form4 Discovery] Error fetching submissions for CIK ${cik}:`, error.message);
    // Fallback sur l'ancienne méthode RSS si l'API submissions échoue
    return discoverNewForm4FilingsRSS(cik);
  }
}

/**
 * Fallback: Découvrir les Form 4 via RSS feed (ancienne méthode)
 */
async function discoverNewForm4FilingsRSS(cik: string): Promise<any[]> {
  const rssUrl = `${SEC_EDGAR_BASE_URL}/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=4&dateb=&owner=include&count=20&output=atom`;

  const response = await fetch(rssUrl, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`EDGAR API error: ${response.status}`);
  }

  const xml = await response.text();
  const entries = parseEDGARFeed(xml);

  // Vérifier quels filings existent déjà (via Athena)
  const accessionNumbers = entries.map(e => e.accessionNumber);
  if (accessionNumbers.length === 0) {
    return [];
  }

  const accessionList = accessionNumbers.map(a => `'${a.replace(/'/g, "''")}'`).join(', ');
  const query = `
    SELECT DISTINCT accession_number
    FROM company_filings
    WHERE accession_number IN (${accessionList})
      AND form_type = '4'
  `;

  try {
    const existing = await executeAthenaQuery(query);
    const existingSet = new Set(
      existing.map((row: any) => row.accession_number || row[0]).filter(Boolean)
    );
    
    return entries.filter(e => !existingSet.has(e.accessionNumber));
  } catch (error: any) {
    // Si la table n'existe pas encore, retourner tous les entries
    console.warn(`[Form4 Discovery] Could not check existing filings: ${error.message}`);
    return entries;
  }
}

/**
 * Traiter un filing Form 4
 */
async function processForm4Filing(companyId: number, cik: string, filing: any): Promise<void> {
  // Vérifier si le filing existe déjà
  let filingId: number | null = null;
  try {
    const checkQuery = `
      SELECT id, status
      FROM company_filings
      WHERE accession_number = '${filing.accessionNumber.replace(/'/g, "''")}'
        AND form_type = '4'
      LIMIT 1
    `;
    const existing = await executeAthenaQuery(checkQuery);
    
    if (existing && existing.length > 0) {
      const existingRow = existing[0];
      filingId = parseInt(existingRow.id || existingRow[0], 10);
      const status = existingRow.status || existingRow[1];
      if (status === 'PARSED') {
        console.log(`    Skipping ${filing.accessionNumber} (already parsed)`);
        return;
      }
    }
  } catch (error: any) {
    console.warn(`[Form4] Could not check existing filing: ${error.message}`);
  }

  // Créer le filing sur S3 si nécessaire
  if (!filingId) {
    const filingData = {
      company_id: companyId,
      cik: cik,
      form_type: '4',
      accession_number: filing.accessionNumber,
      filing_date: filing.filingDate,
      document_url: filing.link,
      status: 'DISCOVERED',
    };

    const result = await insertRowS3('company_filings', filingData);
    filingId = result.id;
  }

  // Parser le Form 4 avec le primaryDocument si disponible
  try {
    await parseForm4FromUrl(
      companyId, 
      filingId, 
      filing.accessionNumber, 
      cik,
      filing.primaryDocument // Utiliser le primaryDocument depuis l'API submissions
    );
    console.log(`    ✅ Parsed Form 4 ${filing.accessionNumber}`);
    
    // Note: Pour mettre à jour le status, il faudrait réécrire le fichier Parquet
    // Pour l'instant, on laisse le status à 'DISCOVERED' et on compte sur le parsing
    // pour créer les transactions dans insider_trades
  } catch (error: any) {
    console.error(`    ❌ Error parsing Form 4:`, error.message);
  }
}

/**
 * Synchroniser les données XBRL des 10-Q/10-K
 */
async function syncEarningsData(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('💰 SYNCHRONISATION XBRL (10-Q/10-K Financials)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Récupérer les filings 10-Q/10-K non parsés (via Athena)
  const query = `
    SELECT 
      cf.id,
      cf.company_id,
      cf.cik,
      cf.accession_number,
      cf.form_type,
      cf.document_url,
      c.ticker,
      c.name
    FROM company_filings cf
    INNER JOIN companies c ON c.id = cf.company_id
    WHERE cf.form_type IN ('10-Q', '10-K')
      AND cf.status = 'DISCOVERED'
    ORDER BY cf.filing_date DESC
    LIMIT 50
  `;

  try {
    const filings = await executeAthenaQuery(query);

    console.log(`Found ${filings.length} filings to parse\n`);

    for (const row of filings) {
      try {
        const filing = {
          id: parseInt(row.id || row[0], 10),
          company_id: parseInt(row.company_id || row[1], 10),
          cik: row.cik || row[2],
          accession_number: row.accession_number || row[3],
          form_type: row.form_type || row[4],
          document_url: row.document_url || row[5],
          ticker: row.ticker || row[6],
          name: row.name || row[7],
        };

        console.log(`Processing ${filing.ticker} - ${filing.form_type} (${filing.accession_number})...`);
        
        // Parser le XBRL
        const financialData = await parseXBRLFromUrl(
          filing.company_id,
          filing.id,
          filing.form_type as '10-Q' | '10-K',
          filing.accession_number,
          filing.cik,
          filing.document_url || undefined
        );

        if (financialData) {
          console.log(`    ✅ Extracted: Revenue=${financialData.total_revenue}, Net Income=${financialData.net_income}, Cash=${financialData.cash_and_equivalents}`);
        } else {
          console.log(`    ⚠️  No financial data extracted`);
        }

        await sleep(RATE_LIMIT_DELAY);
      } catch (error: any) {
        console.error(`  ❌ Error processing filing:`, error.message);
      }
    }
  } catch (error: any) {
    console.error(`[Earnings] Error fetching filings: ${error.message}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const fundsOnly = args.includes('--funds-only');
  const insidersOnly = args.includes('--insiders-only');
  const earningsOnly = args.includes('--earnings-only');
  const trackInsiders = args.includes('--track-insiders');

  try {
    if (!fundsOnly && !insidersOnly && !earningsOnly && !trackInsiders) {
      // Tout synchroniser
      await syncFunds13F();
      await syncInsiderTransactions();
      await syncEarningsData();
    } else {
      if (!insidersOnly && !earningsOnly && !trackInsiders) {
        await syncFunds13F();
      }
      if (!fundsOnly && !earningsOnly && !trackInsiders) {
        await syncInsiderTransactions();
      }
      if (!fundsOnly && !insidersOnly && !trackInsiders) {
        await syncEarningsData();
      }
      if (trackInsiders) {
        await syncInsiderCrossCompany();
      }
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ SYNCHRONISATION TERMINÉE');
    console.log('═══════════════════════════════════════════════════════════');
  } catch (error: any) {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
