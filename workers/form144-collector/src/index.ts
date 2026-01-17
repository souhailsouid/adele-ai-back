/**
 * Lambda pour collecter les Form 144 depuis le flux Atom SEC
 * 
 * Déclenché par EventBridge cron (toutes les heures)
 * Récupère les Form 144 récents et les publie dans SQS pour parsing
 * 
 * Flux Atom SEC: https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=144&count=100&output=atom
 */

import { EventBridgeEvent } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const USER_AGENT = "ADEL AI (contact@adel.ai)";
const FORM144_PARSER_QUEUE_URL = process.env.FORM144_PARSER_QUEUE_URL || "";

const sqsClient = new SQSClient({});

// Construire l'URL du flux Atom SEC avec count dynamique
function getAtomFeedUrl(count: number = 100): string {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=144&count=${count}&output=atom`;
}

interface AtomEntry {
  title: string;
  link: string;
  id: string;
  updated: string;
  summary?: string;
  accessionNumber?: string;
  cik?: string;
  companyName?: string;
}

export const handler = async (event: EventBridgeEvent<string, any>) => {
  // Détecter le mode automatiquement selon l'heure UTC
  // 5h15 UTC = mode morning (récap avec count=1000)
  // Autres heures = mode intraday (temps réel avec count=100)
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  
  // Si c'est entre 5h00 et 5h30 UTC, c'est le run du matin
  const isMorning = hour === 5 && minute >= 0 && minute < 30;
  const mode = isMorning ? 'morning' : 'intraday';
  const count = isMorning ? 1000 : 100;
  
  console.log(`[Form144 Collector] Time: ${hour}:${minute.toString().padStart(2, '0')} UTC, Mode: ${mode}, Count: ${count}`);
  
  // Note: Pour l'intraday, on prend les 2 dernières heures pour créer un chevauchement
  // Cela permet de récupérer les fichiers qui n'étaient pas encore disponibles au run précédent
  
  try {
    const entries = await fetchForm144Feed(count);
    console.log(`Found ${entries.length} Form 144 entries`);
    
    let published = 0;
    let skipped = 0;
    
    for (const entry of entries) {
      try {
        // Extraire l'accession number et le CIK depuis le lien
        const parsed = parseForm144Entry(entry);
        
        if (!parsed.accessionNumber || !parsed.cik) {
          console.warn(`Skipping entry without accession/cik: ${entry.title}`);
          skipped++;
          continue;
        }
        
        // Publier dans SQS pour parsing
        await sqsClient.send(new SendMessageCommand({
          QueueUrl: FORM144_PARSER_QUEUE_URL,
          MessageBody: JSON.stringify({
            accessionNumber: parsed.accessionNumber,
            cik: parsed.cik,
            companyName: parsed.companyName || entry.title,
            filingDate: parsed.filingDate || entry.updated,
            documentUrl: entry.link,
            entryId: entry.id,
          }),
        }));
        
        published++;
        console.log(`Published Form 144: ${parsed.accessionNumber} (${parsed.companyName})`);
        
        // Rate limiting: 100ms entre chaque publication
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error: any) {
        console.error(`Error processing entry ${entry.id}:`, error.message);
        skipped++;
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        entriesFound: entries.length,
        published,
        skipped,
      }),
    };
    
  } catch (error: any) {
    console.error("Error collecting Form 144:", error);
    throw error;
  }
};

/**
 * Récupérer le flux Atom SEC pour les Form 144
 */
async function fetchForm144Feed(count: number = 100): Promise<AtomEntry[]> {
  const url = getAtomFeedUrl(count);
  console.log(`[Form144 Collector] Fetching from: ${url}`);
  
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
    const idMatch = entryXml.match(/<id>(.*?)<\/id>/);
    const updatedMatch = entryXml.match(/<updated>(.*?)<\/updated>/);
    const summaryMatch = entryXml.match(/<summary[^>]*>(.*?)<\/summary>/);
    
    if (titleMatch && linkMatch && idMatch) {
      entries.push({
        title: decodeHtmlEntities(titleMatch[1].trim()),
        link: linkMatch[1].trim(),
        id: idMatch[1].trim(),
        updated: updatedMatch?.[1]?.trim() || new Date().toISOString(),
        summary: summaryMatch?.[1]?.trim(),
      });
    }
  }
  
  return entries;
}

/**
 * Parser une entrée Form 144 pour extraire les infos
 */
function parseForm144Entry(entry: AtomEntry): {
  accessionNumber?: string;
  cik?: string;
  companyName?: string;
  filingDate?: string;
} {
  // Le lien Atom peut avoir plusieurs formats:
  // 1. https://www.sec.gov/cgi-bin/viewer?action=view&cik=0001234567&accession_number=0001234567-25-000001
  // 2. https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001234567&owner=include&count=40
  // 3. Le lien peut aussi contenir l'accession dans le chemin
  
  // Essayer d'extraire depuis le lien viewer
  let accessionMatch = entry.link.match(/accession_number=([^&]+)/);
  let cikMatch = entry.link.match(/[&?]cik=([^&]+)/i) || entry.link.match(/CIK=([^&]+)/i);
  
  // Si pas trouvé, essayer depuis l'ID Atom (contient souvent l'accession)
  // Format: tag:sec.gov,2025:accession-number=0001234567-25-000001
  if (!accessionMatch && entry.id) {
    const idMatch = entry.id.match(/accession-number=([^,]+)/);
    if (idMatch) {
      accessionMatch = [null, idMatch[1]];
    }
  }
  
  // Si pas trouvé, essayer depuis le titre
  // Format: "144 - COMPANY NAME (0001234567) (Issuer)"
  if (!cikMatch) {
    const titleCikMatch = entry.title.match(/\(([0-9]{10})\)/);
    if (titleCikMatch) {
      cikMatch = [null, titleCikMatch[1]];
    }
  }
  
  // Extraire le nom de la company depuis le titre
  // Format: "144 - COMPANY NAME (0001234567) (Issuer)" ou "Form 144 - COMPANY NAME"
  const titleMatch = entry.title.match(/(?:144|Form 144)\s*-\s*([^(]+)/i);
  
  return {
    accessionNumber: accessionMatch?.[1],
    cik: cikMatch?.[1]?.padStart(10, '0'), // S'assurer que le CIK a 10 chiffres
    companyName: titleMatch?.[1]?.trim(),
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
