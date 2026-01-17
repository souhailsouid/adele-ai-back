/**
 * Lambda pour collecter les Form 4 depuis les flux Atom RSS par INSIDER (CIK personnel)
 * 
 * Utilise la liste des 100 dirigeants prioritaires (depuis monitored-entities.json)
 * Pour chaque dirigeant, récupère le flux Atom spécifique par son CIK personnel
 * 
 * Avantages:
 * - Ciblage ultra-précis (seulement les transactions du dirigeant)
 * - Découvre les transactions cross-company (si le dirigeant siège dans plusieurs entreprises)
 * - Flux très petits (5-20 entrées max par dirigeant)
 * - Parsing ultra-rapide
 * - Moins de rate limiting
 * 
 * Exemple:
 * - Jensen Huang (CIK: 0001283630) → Flux Atom par CIK personnel
 * - Découvre ses transactions dans NVDA, mais aussi dans d'autres entreprises où il siège
 * 
 * Déclenché par EventBridge cron (toutes les 30 min en intraday)
 */

import { EventBridgeEvent } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import * as fs from 'fs';
import * as path from 'path';

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

// Charger la liste des entités monitorées depuis le JSON
function loadMonitoredEntities(): MonitoredEntity[] {
  try {
    // Essayer plusieurs chemins possibles (Lambda runtime, local dev, etc.)
    const possiblePaths = [
      '/var/task/monitored-entities.json', // Lambda runtime path (après copie dans build.mjs)
      path.join(__dirname, 'monitored-entities.json'), // Même dossier que index.cjs
      path.join(__dirname, '../form4-company-collector/src/monitored-entities.json'), // Fallback vers source
      path.join(process.cwd(), 'monitored-entities.json'), // CWD
    ];
    
    for (const jsonPath of possiblePaths) {
      if (fs.existsSync(jsonPath)) {
        const content = fs.readFileSync(jsonPath, 'utf-8');
        const entities: MonitoredEntity[] = JSON.parse(content);
        // Filtrer seulement ceux qui ont un insider_cik
        const filtered = entities.filter(e => e.insider_cik);
        console.log(`[Form4 Insider Collector] Loaded ${filtered.length} insiders with CIK from ${jsonPath}`);
        return filtered;
      }
    }
    
    console.warn('[Form4 Insider Collector] monitored-entities.json not found in any path, using empty list');
    return [];
  } catch (error: any) {
    console.error('[Form4 Insider Collector] Error loading monitored entities:', error.message);
    return [];
  }
}

const monitoredEntities: MonitoredEntity[] = loadMonitoredEntities();

interface AtomEntry {
  title: string;
  link: string;
  updated: string;
  category?: string;
  summary?: string;
  accessionNumber?: string;
  companyCik?: string; // CIK de l'entreprise (pas du dirigeant)
}

export const handler = async (event: EventBridgeEvent<string, any>) => {
  console.log("[Form4 Insider Collector] Starting collection for monitored insiders");
  console.log(`[Form4 Insider Collector] Found ${monitoredEntities.length} insiders with CIK`);
  
  const now = new Date();
  
  // Déterminer la fenêtre temporelle
  // Intraday: dernières 2 heures (pour overlap et retry)
  const timeWindowEnd = new Date(now);
  const timeWindowStart = new Date(now);
  timeWindowStart.setUTCHours(timeWindowStart.getUTCHours() - 2);
  
  console.log(`[Form4 Insider Collector] Time window: ${timeWindowStart.toISOString()} to ${timeWindowEnd.toISOString()}`);

  let totalPublished = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const resultsByInsider: Record<string, { published: number; skipped: number; errors: number }> = {};

  // Traiter chaque dirigeant monitoré
  for (const entity of monitoredEntities) {
    const { ticker, company_cik, insider_name, insider_cik } = entity;
    
    if (!insider_cik) {
      console.log(`[${ticker}] Skipping ${insider_name || 'Unknown'} (no insider_cik)`);
      continue;
    }
    
    try {
      console.log(`\n[${ticker}] Processing insider ${insider_name} (CIK: ${insider_cik})...`);
      
      // Récupérer le flux Atom pour ce dirigeant (par son CIK personnel)
      const entries = await fetchInsiderAtomFeed(insider_cik);
      console.log(`[${ticker}] Found ${entries.length} entries in Atom feed for ${insider_name}`);

      // Filtrer: seulement les Form 4 (category term="4")
      const form4Entries = entries.filter(entry => entry.category === "4");
      console.log(`[${ticker}] Found ${form4Entries.length} Form 4 entries`);

      // Filtrer par date selon la fenêtre temporelle
      const filteredEntries = form4Entries.filter(entry => {
        const entryDate = new Date(entry.updated);
        return entryDate >= timeWindowStart && entryDate < timeWindowEnd;
      });
      console.log(`[${ticker}] Found ${filteredEntries.length} Form 4 entries in time window`);

      let published = 0;
      let skipped = 0;

      for (const entry of filteredEntries) {
        try {
          const parsed = parseForm4Entry(entry);
          
          if (!parsed.accessionNumber || !parsed.companyCik) {
            console.warn(`[${ticker}] Skipping entry without accession/company_cik: ${entry.title}`);
            skipped++;
            continue;
          }

          // Publier dans SQS pour parsing
          // Note: On utilise companyCik (de l'entreprise) et non insider_cik (du dirigeant)
          const message = {
            accessionNumber: parsed.accessionNumber,
            cik: parsed.companyCik, // CIK de l'entreprise où la transaction a eu lieu
            companyName: ticker, // Ticker de l'entreprise principale (peut être différent si cross-company)
            primaryDocument: "xslF345X05/ownership.xml",
            filingDate: parsed.filingDate || entry.updated,
            sourceType: 'INSIDER_FEED', // Provenance: flux Atom par dirigeant (CIK personnel)
            // Optionnel: Ajouter insider_cik pour référence
            insiderCik: insider_cik,
          };

          await sqsClient.send(new SendMessageCommand({
            QueueUrl: FORM4_PARSER_QUEUE_URL,
            MessageBody: JSON.stringify(message),
          }));

          published++;
          totalPublished++;
          console.log(`[${ticker}] Published: ${parsed.accessionNumber} (Company CIK: ${parsed.companyCik})`);

          // Rate limiting: 100ms entre chaque publication
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error: any) {
          console.error(`[${ticker}] Error processing entry:`, error.message);
          totalErrors++;
          skipped++;
        }
      }

      resultsByInsider[insider_name || ticker] = { published, skipped, errors: 0 };
      totalSkipped += skipped;

      // Rate limiting entre les dirigeants: 200ms
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error: any) {
      console.error(`[${ticker}] Error processing insider:`, error.message);
      totalErrors++;
      resultsByInsider[insider_name || ticker] = { published: 0, skipped: 0, errors: 1 };
    }
  }

  // Résumé
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Form4 Insider Collector] Collection complete`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total published: ${totalPublished}`);
  console.log(`Total skipped: ${totalSkipped}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Insiders processed: ${monitoredEntities.length}`);
  
  // Top 5 insiders avec le plus de Form 4 publiés
  const topInsiders = Object.entries(resultsByInsider)
    .sort((a, b) => b[1].published - a[1].published)
    .slice(0, 5);
  
  if (topInsiders.length > 0) {
    console.log(`\nTop 5 insiders:`);
    topInsiders.forEach(([name, stats]) => {
      if (stats.published > 0) {
        console.log(`  ${name}: ${stats.published} published, ${stats.skipped} skipped`);
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
      insidersProcessed: monitoredEntities.length,
      timeWindow: {
        from: timeWindowStart.toISOString(),
        to: timeWindowEnd.toISOString(),
      },
      resultsByInsider,
    }),
  };
};

/**
 * Récupérer le flux Atom SEC pour un dirigeant spécifique (par son CIK personnel)
 */
async function fetchInsiderAtomFeed(insiderCik: string): Promise<AtomEntry[]> {
  const cikPadded = String(insiderCik).padStart(10, '0');
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cikPadded}&type=4&count=40&output=atom`;
  
  console.log(`  📥 Fetching Atom feed: ${url}`);
  
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
      
      // Extraire CIK de l'ENTREPRISE depuis l'URL (pas du dirigeant)
      // Format: https://www.sec.gov/Archives/edgar/data/1045810/... → CIK de l'entreprise = 1045810
      const companyCikMatch = linkStr.match(/\/data\/(\d+)\//);
      const companyCik = companyCikMatch?.[1]?.padStart(10, '0');
      
      entries.push({
        title: decodeHtmlEntities(titleMatch[1].trim()),
        link: linkStr,
        updated: updatedMatch?.[1]?.trim() || new Date().toISOString(),
        summary: summaryMatch?.[1]?.trim(),
        category: category, // "4" pour Form 4
        accessionNumber,
        companyCik, // CIK de l'entreprise où la transaction a eu lieu
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
  companyCik?: string; // CIK de l'entreprise (pas du dirigeant)
  filingDate?: string;
} {
  return {
    accessionNumber: entry.accessionNumber,
    companyCik: entry.companyCik,
    filingDate: entry.updated,
  };
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
