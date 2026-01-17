/**
 * Lambda pour collecter les Form 4 depuis le flux Atom SEC
 * 
 * Déclenché par EventBridge cron (tous les jours à 5h15)
 * Récupère les Form 4 récents et les publie dans SQS pour parsing
 * 
 * Flux Atom SEC: https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&count=1000&output=atom
 * 
 * Avantages:
 * - Évite le bannissement (rate limiting): ne télécharge que les Form 4 récents
 * - Rapidité: 10 secondes au lieu de plusieurs minutes
 * - Fiabilité: ne rate rien, même les nouvelles entreprises
 */

import { EventBridgeEvent } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const USER_AGENT = "ADEL AI (contact@adel.ai)";
const FORM4_PARSER_QUEUE_URL = process.env.FORM4_PARSER_QUEUE_URL || "";

const sqsClient = new SQSClient({});

// Construire l'URL du flux Atom SEC avec count dynamique
function getAtomFeedUrl(count: number = 1000): string {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&count=${count}&output=atom`;
}

interface AtomEntry {
  title: string;
  link: string;
  id: string;
  updated: string;
  category?: string; // term du category (ex: "4", "424B2", etc.)
  summary?: string;
  accessionNumber?: string;
  cik?: string;
  companyName?: string;
}

export const handler = async (event: EventBridgeEvent<string, any>) => {
  // Détecter le mode automatiquement selon l'heure UTC
  // 5h15 UTC = mode morning (récap avec count=1000, fenêtre hier 5h15 - aujourd'hui 5h15)
  // Autres heures = mode intraday (temps réel avec count=100, dernière heure)
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  
  // Si c'est entre 5h00 et 5h30 UTC, c'est le run du matin
  const isMorning = hour === 5 && minute >= 0 && minute < 30;
  const mode = isMorning ? 'morning' : 'intraday';
  const count = isMorning ? 1000 : 100;
  
  console.log(`[Form4 Collector] Time: ${hour}:${minute.toString().padStart(2, '0')} UTC, Mode: ${mode}, Count: ${count}`);
  
  try {
    // Calculer la fenêtre temporelle selon le mode
    let timeWindowStart: Date;
    let timeWindowEnd: Date;
    
    if (isMorning) {
      // Mode morning: hier 5h15 - aujourd'hui 5h15
      const today515 = new Date(now);
      today515.setUTCHours(5, 15, 0, 0);
      
      const yesterday515 = new Date(today515);
      yesterday515.setUTCDate(yesterday515.getUTCDate() - 1);
      
      timeWindowStart = yesterday515;
      timeWindowEnd = today515;
    } else {
      // Mode intraday: 2 dernières heures (chevauchement pour gérer les fichiers qui ne sont pas encore disponibles)
      // Cela permet au run suivant de récupérer les fichiers qui n'étaient pas encore disponibles
      timeWindowEnd = new Date(now);
      timeWindowStart = new Date(now);
      timeWindowStart.setUTCHours(timeWindowStart.getUTCHours() - 2); // 2 heures au lieu d'1
    }
    
    console.log(`[Form4 Collector] Filtering Form 4 between ${timeWindowStart.toISOString()} and ${timeWindowEnd.toISOString()}`);
    
    const entries = await fetchForm4Feed(count);
    console.log(`Found ${entries.length} total entries in Atom feed`);
    
    // Filtrer: seulement les Form 4 (category term="4")
    const form4Entries = entries.filter(entry => entry.category === "4");
    console.log(`Found ${form4Entries.length} Form 4 entries`);
    
    // Filtrer par date selon la fenêtre temporelle
    const filteredEntries = form4Entries.filter(entry => {
      const entryDate = new Date(entry.updated);
      return entryDate >= timeWindowStart && entryDate < timeWindowEnd;
    });
    console.log(`Found ${filteredEntries.length} Form 4 entries in time window`);
    
    let published = 0;
    let skipped = 0;
    
    for (const entry of filteredEntries) {
      try {
        // Extraire l'accession number et le CIK depuis le lien
        const parsed = parseForm4Entry(entry);
        
        if (!parsed.accessionNumber || !parsed.cik) {
          console.warn(`Skipping entry without accession/cik: ${entry.title}`);
          skipped++;
          continue;
        }
        
        // Extraire le company_id depuis le CIK (nécessite une requête Athena ou cache)
        // Pour l'instant, on publie avec le CIK et le parser trouvera le company_id
        const message = {
          accessionNumber: parsed.accessionNumber,
          cik: parsed.cik,
          companyName: parsed.companyName || entry.title,
          primaryDocument: "xslF345X05/ownership.xml", // Format standard Form 4
          filingDate: parsed.filingDate || entry.updated,
          sourceType: 'ATOM_FEED', // Provenance: flux Atom global
        };
        
        // Publier dans SQS pour parsing
        await sqsClient.send(new SendMessageCommand({
          QueueUrl: FORM4_PARSER_QUEUE_URL,
          MessageBody: JSON.stringify(message),
        }));
        
        published++;
        console.log(`Published Form 4: ${parsed.accessionNumber} (${parsed.companyName})`);
        
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
        form4Entries: form4Entries.length,
        filteredEntries: filteredEntries.length,
        published,
        skipped,
        timeWindow: {
          from: timeWindowStart.toISOString(),
          to: timeWindowEnd.toISOString(),
        },
      }),
    };
    
  } catch (error: any) {
    console.error("Error collecting Form 4:", error);
    throw error;
  }
};

/**
 * Récupérer le flux Atom SEC pour les Form 4
 */
async function fetchForm4Feed(count: number = 1000): Promise<AtomEntry[]> {
  const url = getAtomFeedUrl(count);
  console.log(`[Form4 Collector] Fetching from: ${url}`);
  
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
    
    // Extraire la catégorie (term) - c'est crucial pour filtrer les Form 4
    // Format: <category scheme="https://www.sec.gov/" label="form type" term="4"/>
    const categoryMatch = entryXml.match(/<category[^>]*term="([^"]*)"[^>]*>/);
    const category = categoryMatch?.[1];
    
    if (titleMatch && linkMatch && idMatch) {
      entries.push({
        title: decodeHtmlEntities(titleMatch[1].trim()),
        link: linkMatch[1].trim(),
        id: idMatch[1].trim(),
        updated: updatedMatch?.[1]?.trim() || new Date().toISOString(),
        summary: summaryMatch?.[1]?.trim(),
        category: category, // "4" pour Form 4, "424B2" pour prospectus, etc.
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
  companyName?: string;
  filingDate?: string;
} {
  // Extraire l'accession number depuis le lien
  // Format: https://www.sec.gov/cgi-bin/viewer?action=view&cik=0001234567&accession_number=0001234567-25-000001
  const accessionMatch = entry.link.match(/accession_number=([^&]+)/);
  const cikMatch = entry.link.match(/cik=([^&]+)/);
  
  // Extraire le nom de la company depuis le titre
  // Format: "4 - APPLE INC (0000320193) (Issuer)"
  const titleMatch = entry.title.match(/4\s*-\s*([^(]+)\s*\(/i);
  
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
