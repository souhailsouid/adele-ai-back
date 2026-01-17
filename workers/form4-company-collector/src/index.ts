/**
 * Lambda pour collecter les Form 4 depuis les flux Atom RSS par entreprise
 * 
 * Utilise la liste des 100 entreprises prioritaires (monitored-entities.json)
 * Pour chaque entreprise, récupère le flux Atom spécifique et publie dans SQS
 * 
 * Avantages:
 * - Ciblage précis (seulement les entreprises prioritaires)
 * - Flux plus petits (10-50 entrées max par entreprise)
 * - Parsing plus rapide
 * - Moins de rate limiting
 * - Optionnel: Filtrage par insider_cik pour ne garder que les dirigeants clés
 * 
 * Déclenché par EventBridge cron (toutes les 30 min en intraday)
 */

import { EventBridgeEvent } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import * as fs from 'fs';
import * as path from 'path';

// Charger la liste des entités monitorées depuis le JSON
// Dans Lambda, le fichier est dans le même répertoire que index.cjs
function loadMonitoredEntities(): MonitoredEntity[] {
  try {
    // Essayer plusieurs chemins possibles
    const possiblePaths = [
      path.join(__dirname, 'monitored-entities.json'),
      path.join(process.cwd(), 'monitored-entities.json'),
      '/var/task/monitored-entities.json', // Lambda runtime path
    ];
    
    for (const jsonPath of possiblePaths) {
      if (fs.existsSync(jsonPath)) {
        const content = fs.readFileSync(jsonPath, 'utf-8');
        return JSON.parse(content);
      }
    }
    
    // Fallback: retourner une liste vide si le fichier n'est pas trouvé
    console.warn('[Form4 Company Collector] monitored-entities.json not found, using empty list');
    return [];
  } catch (error: any) {
    console.error('[Form4 Company Collector] Error loading monitored entities:', error.message);
    return [];
  }
}

const monitoredEntities: MonitoredEntity[] = loadMonitoredEntities();

const USER_AGENT = "ADEL AI (contact@adel.ai)";
const FORM4_PARSER_QUEUE_URL = process.env.FORM4_PARSER_QUEUE_URL || "";

const sqsClient = new SQSClient({});

interface MonitoredEntity {
  ticker: string;
  company_cik: string;
  insider_name?: string;
  insider_cik?: string;
  sector: string;
}

interface AtomEntry {
  title: string;
  link: string;
  updated: string;
  category?: string;
  summary?: string;
  accessionNumber?: string;
  cik?: string;
  insiderCik?: string; // CIK de l'insider qui a signé le Form 4
}

export const handler = async (event: EventBridgeEvent<string, any>) => {
  console.log("[Form4 Company Collector] Starting collection for monitored entities");
  
  const now = new Date();
  const utcHour = now.getUTCHours();
  
  // Déterminer la fenêtre temporelle
  // Intraday: dernières 2 heures (pour overlap et retry)
  const timeWindowEnd = new Date(now);
  const timeWindowStart = new Date(now);
  timeWindowStart.setUTCHours(timeWindowStart.getUTCHours() - 2);
  
  console.log(`[Form4 Company Collector] Time window: ${timeWindowStart.toISOString()} to ${timeWindowEnd.toISOString()}`);
  console.log(`[Form4 Company Collector] Processing ${monitoredEntities.length} monitored entities`);

  let totalPublished = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const resultsByCompany: Record<string, { published: number; skipped: number; errors: number }> = {};

  // Traiter chaque entreprise monitorée
  for (const entity of monitoredEntities as MonitoredEntity[]) {
    const { ticker, company_cik, insider_cik } = entity;
    
    try {
      console.log(`\n[${ticker}] Processing company CIK ${company_cik}...`);
      
      // Récupérer le flux Atom pour cette entreprise
      const entries = await fetchCompanyAtomFeed(company_cik);
      console.log(`[${ticker}] Found ${entries.length} entries in Atom feed`);

      // Filtrer: seulement les Form 4 (category term="4")
      const form4Entries = entries.filter(entry => entry.category === "4");
      console.log(`[${ticker}] Found ${form4Entries.length} Form 4 entries`);

      // Filtrer par date selon la fenêtre temporelle
      const filteredEntries = form4Entries.filter(entry => {
        const entryDate = new Date(entry.updated);
        return entryDate >= timeWindowStart && entryDate < timeWindowEnd;
      });
      console.log(`[${ticker}] Found ${filteredEntries.length} Form 4 entries in time window`);

      // Optionnel: Filtrer par insider_cik si spécifié
      let finalEntries = filteredEntries;
      if (insider_cik) {
        const insiderFiltered = filteredEntries.filter(entry => {
          // Extraire le CIK de l'insider depuis le summary ou le lien
          const entryInsiderCik = entry.insiderCik || extractInsiderCikFromEntry(entry);
          return entryInsiderCik === insider_cik || entryInsiderCik === insider_cik.padStart(10, '0');
        });
        console.log(`[${ticker}] Filtered to ${insiderFiltered.length} entries for insider CIK ${insider_cik}`);
        finalEntries = insiderFiltered;
      }

      let published = 0;
      let skipped = 0;

      for (const entry of finalEntries) {
        try {
          const parsed = parseForm4Entry(entry);
          
          if (!parsed.accessionNumber || !parsed.cik) {
            console.warn(`[${ticker}] Skipping entry without accession/cik: ${entry.title}`);
            skipped++;
            continue;
          }

          // Publier dans SQS pour parsing
          const message = {
            accessionNumber: parsed.accessionNumber,
            cik: parsed.cik,
            companyName: entity.ticker,
            primaryDocument: "xslF345X05/ownership.xml",
            filingDate: parsed.filingDate || entry.updated,
            sourceType: 'COMPANY_FEED', // Provenance: flux Atom par entreprise
          };

          await sqsClient.send(new SendMessageCommand({
            QueueUrl: FORM4_PARSER_QUEUE_URL,
            MessageBody: JSON.stringify(message),
          }));

          published++;
          totalPublished++;
          console.log(`[${ticker}] Published: ${parsed.accessionNumber}`);

          // Rate limiting: 100ms entre chaque publication
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error: any) {
          console.error(`[${ticker}] Error processing entry:`, error.message);
          totalErrors++;
          skipped++;
        }
      }

      resultsByCompany[ticker] = { published, skipped, errors: 0 };
      totalSkipped += skipped;

      // Rate limiting entre les entreprises: 200ms
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error: any) {
      console.error(`[${ticker}] Error processing company:`, error.message);
      totalErrors++;
      resultsByCompany[ticker] = { published: 0, skipped: 0, errors: 1 };
    }
  }

  // Résumé
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Form4 Company Collector] Collection complete`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total published: ${totalPublished}`);
  console.log(`Total skipped: ${totalSkipped}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Companies processed: ${monitoredEntities.length}`);
  
  // Top 5 companies avec le plus de Form 4 publiés
  const topCompanies = Object.entries(resultsByCompany)
    .sort((a, b) => b[1].published - a[1].published)
    .slice(0, 5);
  
  if (topCompanies.length > 0) {
    console.log(`\nTop 5 companies:`);
    topCompanies.forEach(([ticker, stats]) => {
      if (stats.published > 0) {
        console.log(`  ${ticker}: ${stats.published} published, ${stats.skipped} skipped`);
      }
    });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      totalPublished,
      totalSkipped,
      totalErrors,
      companiesProcessed: monitoredEntities.length,
      timeWindow: {
        from: timeWindowStart.toISOString(),
        to: timeWindowEnd.toISOString(),
      },
      resultsByCompany,
    }),
  };
};

/**
 * Récupérer le flux Atom SEC pour une entreprise spécifique
 */
async function fetchCompanyAtomFeed(companyCik: string): Promise<AtomEntry[]> {
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${companyCik}&type=4&count=40&output=atom`;
  
  const response = await fetch(url, {
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
  
  // Parser les entrées <entry>
  const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
  
  for (const match of entryMatches) {
    const entryXml = match[1];
    
    const titleMatch = entryXml.match(/<title[^>]*>(.*?)<\/title>/);
    const linkMatch = entryXml.match(/<link[^>]*href="([^"]*)"[^>]*>/);
    const updatedMatch = entryXml.match(/<updated>(.*?)<\/updated>/);
    const summaryMatch = entryXml.match(/<summary[^>]*>(.*?)<\/summary>/);
    
    // Extraire la catégorie (term) - c'est crucial pour filtrer les Form 4
    const categoryMatch = entryXml.match(/<category[^>]*term="([^"]*)"[^>]*>/);
    const category = categoryMatch?.[1];
    
    if (titleMatch && linkMatch) {
      const linkStr = linkMatch[1].trim();
      
      // Extraire accession_number depuis l'URL
      let accessionNumber: string | undefined;
      const indexMatch = linkStr.match(/(\d{10}-\d{2}-\d{6})-index\.htm/);
      if (indexMatch) {
        accessionNumber = indexMatch[1];
      } else {
        const accessionMatch = linkStr.match(/accession_number=([^&]+)/);
        accessionNumber = accessionMatch?.[1];
      }
      
      // Extraire CIK de l'entreprise depuis l'URL
      const cikMatch = linkStr.match(/\/data\/(\d+)\//) || linkStr.match(/cik=([^&]+)/);
      const cik = cikMatch?.[1]?.padStart(10, '0');
      
      entries.push({
        title: decodeHtmlEntities(titleMatch[1].trim()),
        link: linkStr,
        updated: updatedMatch?.[1]?.trim() || new Date().toISOString(),
        summary: summaryMatch?.[1]?.trim(),
        category: category, // "4" pour Form 4
        accessionNumber,
        cik,
      });
    }
  }
  
  return entries;
}

/**
 * Parser une entrée Form 4 pour extraire les infos
 */
function parseForm4Entry(entry: AtomEntry): {
  accessionNumber?: string;
  cik?: string;
  filingDate?: string;
} {
  return {
    accessionNumber: entry.accessionNumber,
    cik: entry.cik,
    filingDate: entry.updated,
  };
}

/**
 * Extraire le CIK de l'insider depuis une entrée
 * (nécessite de parser le XML du Form 4, donc on le fait plus tard dans le parser)
 */
function extractInsiderCikFromEntry(entry: AtomEntry): string | undefined {
  // Pour l'instant, on ne peut pas extraire le CIK de l'insider depuis le flux Atom
  // Il faudrait parser le XML du Form 4, ce qui sera fait dans le parser
  // On retourne undefined et on laisse le parser faire le filtrage
  return undefined;
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
