/**
 * Test d'écriture complète Form 144 dans S3 Parquet
 * 
 * Simule le flux complet:
 * 1. Récupère un Form 144 réel depuis le flux Atom
 * 2. Parse le XML
 * 3. Écrit dans S3 Parquet
 * 4. Vérifie dans Athena
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ParquetSchema, ParquetWriter } from 'parquetjs';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createRequire } from 'module';
import { executeAthenaQuery } from '../services/api/src/athena/query';

// parquetjs est un module CommonJS
const require = createRequire(import.meta.url);
const parquetjs = require('parquetjs');
const { ParquetSchema: ParquetSchemaLib, ParquetWriter: ParquetWriterLib } = parquetjs;
const ParquetSchema = ParquetSchemaLib;
const ParquetWriter = ParquetWriterLib;

const SEC_ATOM_FEED_URL = "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=144&count=5&output=atom";
const USER_AGENT = "ADEL AI (contact@adel.ai)";
const S3_DATA_LAKE_BUCKET = process.env.S3_DATA_LAKE_BUCKET || "adel-ai-dev-data-lake";
const SEC_EDGAR_BASE_URL = 'https://www.sec.gov';

const s3Client = new S3Client({});

async function testForm144Write() {
  console.log("🧪 TEST D'ÉCRITURE FORM 144 DANS S3");
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. Récupérer un Form 144 depuis le flux Atom
  console.log("1️⃣  Récupération depuis flux Atom...");
  const entries = await fetchForm144Feed();
  const form144Entry = entries.find(entry => entry.category === "144");
  
  if (!form144Entry) {
    console.log("❌ Aucun Form 144 trouvé dans le flux");
    return;
  }

  const parsed = parseForm144Entry(form144Entry);
  console.log(`✅ Form 144 trouvé:`);
  console.log(`   - Company: ${parsed.companyName || 'N/A'}`);
  console.log(`   - Accession: ${parsed.accessionNumber || 'N/A'}`);
  console.log(`   - CIK: ${parsed.cik || 'N/A'}\n`);

  if (!parsed.accessionNumber || !parsed.cik) {
    console.log("❌ Accession number ou CIK manquant");
    return;
  }

  // 2. Parser le XML
  console.log("2️⃣  Parsing XML...");
  const notice = await parseForm144XML(parsed.accessionNumber, parsed.cik, parsed.companyName);
  
  if (!notice) {
    console.log("⚠️  Parsing XML échoué, création d'un notice de test...");
    // Créer un notice de test pour tester l'écriture
    const testNotice = {
      id: Date.now(),
      accession_number: parsed.accessionNumber,
      cik: parsed.cik,
      company_name: parsed.companyName,
      insider_name: "Test Insider",
      insider_cik: parsed.cik,
      shares: 10000,
      price_per_share: 50.0,
      total_value: 500000,
      filing_date: parsed.filingDate || new Date().toISOString().split('T')[0],
      proposed_sale_date: undefined,
      created_at: new Date().toISOString(),
    };
    await writeForm144Notice(testNotice);
    console.log("✅ Notice de test écrite dans S3\n");
  } else {
    console.log(`✅ Parsing réussi:`);
    console.log(`   - Insider: ${notice.insider_name || 'N/A'}`);
    console.log(`   - Shares: ${notice.shares?.toLocaleString() || 'N/A'}`);
    console.log(`   - Price: $${notice.price_per_share?.toFixed(2) || 'N/A'}`);
    console.log(`   - Total: $${notice.total_value?.toLocaleString() || 'N/A'}\n`);
    
    // 3. Écrire dans S3
    console.log("3️⃣  Écriture dans S3 Parquet...");
    await writeForm144Notice(notice);
    console.log("✅ Notice écrite dans S3\n");
  }

  // 4. Vérifier dans Athena (attendre quelques secondes pour que S3 soit visible)
  console.log("4️⃣  Vérification dans Athena (attente 5s pour propagation S3)...");
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    const query = `
      SELECT 
        accession_number,
        company_name,
        insider_name,
        shares,
        total_value,
        CAST(filing_date AS VARCHAR) as filing_date
      FROM form_144_notices
      WHERE accession_number = '${parsed.accessionNumber}'
      LIMIT 1
    `;

    const results = await executeAthenaQuery(query);
    
    if (results.length > 0) {
      const row = results[0];
      console.log("✅ Notice trouvée dans Athena:");
      console.log(`   - Accession: ${row.accession_number}`);
      console.log(`   - Company: ${row.company_name || 'N/A'}`);
      console.log(`   - Insider: ${row.insider_name || 'N/A'}`);
      console.log(`   - Shares: ${row.shares ? parseInt(row.shares).toLocaleString() : 'N/A'}`);
      console.log(`   - Total: $${row.total_value ? parseFloat(row.total_value).toLocaleString() : 'N/A'}`);
      console.log(`   - Filing Date: ${row.filing_date?.substring(0, 10) || 'N/A'}\n`);
    } else {
      console.log("⚠️  Notice non trouvée dans Athena (peut prendre quelques minutes pour apparaître)\n");
    }
  } catch (error: any) {
    console.error(`❌ Erreur vérification Athena: ${error.message}\n`);
  }

  console.log("═══════════════════════════════════════════════════════════");
  console.log("✅ TEST TERMINÉ");
  console.log("═══════════════════════════════════════════════════════════");
}

async function fetchForm144Feed(): Promise<any[]> {
  const response = await fetch(SEC_ATOM_FEED_URL, {
    headers: { "User-Agent": USER_AGENT },
  });
  const xml = await response.text();
  return parseAtomFeed(xml);
}

function parseAtomFeed(xml: string): any[] {
  const entries: any[] = [];
  const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
  
  for (const match of entryMatches) {
    const entryXml = match[1];
    const titleMatch = entryXml.match(/<title[^>]*>(.*?)<\/title>/);
    const linkMatch = entryXml.match(/<link[^>]*href="([^"]*)"[^>]*>/);
    const idMatch = entryXml.match(/<id>(.*?)<\/id>/);
    const updatedMatch = entryXml.match(/<updated>(.*?)<\/updated>/);
    const categoryMatch = entryXml.match(/<category[^>]*term="([^"]*)"[^>]*>/);
    const summaryMatch = entryXml.match(/<summary[^>]*>(.*?)<\/summary>/);
    
    if (titleMatch && linkMatch && idMatch) {
      // Extraire l'accession depuis le summary
      const accMatch = summaryMatch?.[1]?.match(/AccNo:&lt;\/b&gt;\s*([^&<]+)/);
      
      entries.push({
        title: titleMatch[1].trim(),
        link: linkMatch[1].trim(),
        id: idMatch[1].trim(),
        updated: updatedMatch?.[1]?.trim() || new Date().toISOString(),
        category: categoryMatch?.[1],
        summary: summaryMatch?.[1]?.trim(),
        accessionNumber: accMatch?.[1]?.trim(),
      });
    }
  }
  
  return entries;
}

function parseForm144Entry(entry: any): {
  accessionNumber?: string;
  cik?: string;
  companyName?: string;
  filingDate?: string;
} {
  let accessionMatch = entry.link.match(/accession_number=([^&]+)/);
  let cikMatch = entry.link.match(/[&?]cik=([^&]+)/i) || entry.link.match(/CIK=([^&]+)/i);
  
  // Extraire depuis l'ID Atom
  if (!accessionMatch && entry.id) {
    const idMatch = entry.id.match(/accession-number=([^,]+)/);
    if (idMatch) accessionMatch = [null, idMatch[1]];
  }
  
  // Extraire depuis le summary
  if (!accessionMatch && entry.summary) {
    const accMatch = entry.summary.match(/AccNo:&lt;\/b&gt;\s*([^&<]+)/);
    if (accMatch) accessionMatch = [null, accMatch[1].trim()];
  }
  
  // Extraire CIK depuis le titre
  if (!cikMatch) {
    const titleCikMatch = entry.title.match(/\(([0-9]{10})\)/);
    if (titleCikMatch) cikMatch = [null, titleCikMatch[1]];
  }
  
  // Extraire CIK depuis le lien (chemin /data/{cik}/)
  if (!cikMatch) {
    const pathCikMatch = entry.link.match(/\/data\/([0-9]+)\//);
    if (pathCikMatch) cikMatch = [null, pathCikMatch[1].padStart(10, '0')];
  }
  
  const titleMatch = entry.title.match(/(?:144|Form 144)\s*-\s*([^(]+)/i);
  
  return {
    accessionNumber: accessionMatch?.[1] || entry.accessionNumber,
    cik: cikMatch?.[1]?.padStart(10, '0'),
    companyName: titleMatch?.[1]?.trim(),
    filingDate: entry.updated,
  };
}

async function parseForm144XML(accessionNumber: string, cik: string, companyName?: string): Promise<any | null> {
  const cikPadded = String(cik || '').padStart(10, '0');
  const accessionClean = accessionNumber.replace(/-/g, '');
  
  const possibleUrls = [
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/${accessionNumber}.txt`,
    `${SEC_EDGAR_BASE_URL}/Archives/edgar/data/${cikPadded}/${accessionClean}/xslF144X05/form144.xml`,
  ];

  for (const url of possibleUrls) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!response.ok) continue;

      let xmlContent = await response.text();
      if (url.endsWith('.txt')) {
        const xmlMatch = xmlContent.match(/<XML>([\s\S]*?)<\/XML>/i);
        if (xmlMatch) xmlContent = xmlMatch[1];
      }

      // Parser amélioré avec structure Form 144 réelle
      const xmlWithoutNamespaces = xmlContent.replace(/<(\/?)([^:>]+):([^>]+)>/g, '<$1$3>');
      
      // Company info
      const issuerNameMatch = xmlWithoutNamespaces.match(/<issuerName[^>]*>([^<]+)<\/issuerName>/i) ||
                             xmlContent.match(/<issuerName[^>]*>([^<]+)<\/issuerName>/i);
      
      // Insider name
      const insiderNameMatch = xmlWithoutNamespaces.match(/<nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold[^>]*>([^<]+)<\/nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold>/i) ||
                             xmlContent.match(/<nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold[^>]*>([^<]+)<\/nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold>/i);
      
      // Shares
      const sharesMatch = xmlWithoutNamespaces.match(/<noOfUnitsSold[^>]*>([^<]+)<\/noOfUnitsSold>/i) ||
                         xmlWithoutNamespaces.match(/<sharesToBeSold[^>]*>([^<]+)<\/sharesToBeSold>/i) ||
                         xmlContent.match(/<noOfUnitsSold[^>]*>([^<]+)<\/noOfUnitsSold>/i);
      
      // Total value
      const totalValueMatch = xmlWithoutNamespaces.match(/<aggregateMarketValue[^>]*>([^<]+)<\/aggregateMarketValue>/i) ||
                             xmlContent.match(/<aggregateMarketValue[^>]*>([^<]+)<\/aggregateMarketValue>/i);
      
      // Dates
      const filingDateMatch = xmlWithoutNamespaces.match(/<filingDate[^>]*>([^<]+)<\/filingDate>/i) ||
                             xmlContent.match(/<filingDate[^>]*>([^<]+)<\/filingDate>/i);
      const proposedSaleDateMatch = xmlWithoutNamespaces.match(/<approxSaleDate[^>]*>([^<]+)<\/approxSaleDate>/i) ||
                                   xmlContent.match(/<approxSaleDate[^>]*>([^<]+)<\/approxSaleDate>/i);

      if (insiderNameMatch || sharesMatch || totalValueMatch) {
        const shares = sharesMatch ? parseFloat(sharesMatch[1].replace(/,/g, '')) : undefined;
        const totalValue = totalValueMatch ? parseFloat(totalValueMatch[1].replace(/[$,]/g, '')) : undefined;
        const pricePerShare = shares && totalValue && shares > 0 ? totalValue / shares : undefined;
        
        // Convertir dates MM/DD/YYYY en YYYY-MM-DD
        let filingDate = filingDateMatch?.[1]?.trim() || new Date().toISOString().split('T')[0];
        if (filingDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          const [month, day, year] = filingDate.split('/');
          filingDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        let proposedSaleDate = proposedSaleDateMatch?.[1]?.trim();
        if (proposedSaleDate && proposedSaleDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          const [month, day, year] = proposedSaleDate.split('/');
          proposedSaleDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        return {
          id: Date.now(),
          accession_number: accessionNumber,
          cik: cik,
          company_name: issuerNameMatch?.[1]?.trim() || companyName,
          insider_name: insiderNameMatch?.[1]?.trim(),
          insider_cik: cik,
          shares: shares ? Math.round(shares) : undefined,
          price_per_share: pricePerShare,
          total_value: totalValue,
          filing_date: filingDate,
          proposed_sale_date: proposedSaleDate,
          created_at: new Date().toISOString(),
        };
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}

async function writeForm144Notice(notice: any): Promise<void> {
  const date = new Date(notice.filing_date || notice.created_at);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  
  const s3Key = `data/form_144_notices/year=${year}/month=${month.toString().padStart(2, '0')}/data-${Date.now()}.parquet`;
  
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `form144_${Date.now()}.parquet`);
  
  const FORM144_SCHEMA = new ParquetSchema({
    id: { type: 'INT64', optional: false },
    accession_number: { type: 'UTF8', optional: true },
    cik: { type: 'UTF8', optional: true },
    company_name: { type: 'UTF8', optional: true },
    insider_name: { type: 'UTF8', optional: true },
    insider_cik: { type: 'UTF8', optional: true },
    shares: { type: 'INT64', optional: true },
    price_per_share: { type: 'DOUBLE', optional: true },
    total_value: { type: 'DOUBLE', optional: true },
    filing_date: { type: 'DATE', optional: true },
    proposed_sale_date: { type: 'DATE', optional: true },
    created_at: { type: 'TIMESTAMP_MILLIS', optional: true },
  });
  
  const writer = await ParquetWriter.openFile(FORM144_SCHEMA, tempFilePath);
  await writer.appendRow({
    ...notice,
    created_at: new Date(notice.created_at).getTime(),
  });
  await writer.close();
  
  const fileBuffer = fs.readFileSync(tempFilePath);
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_DATA_LAKE_BUCKET,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: 'application/octet-stream',
  }));
  
  fs.unlinkSync(tempFilePath);
  console.log(`   ✅ Écrit dans: ${s3Key}`);
}

testForm144Write()
  .then(() => {
    console.log("\n✅ Script terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur:", error);
    process.exit(1);
  });
