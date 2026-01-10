/**
 * Lambda pour détecter les nouveaux filings SEC pertinents sur EDGAR
 * Déclenché par SQS (via EventBridge cron: toutes les heures)
 * 
 * Récupère :
 * - 13F-HR et 13F-HR/A (rapports trimestriels - stock)
 * - SC 13G et SC 13G/A (positions majeures >5% - flux réactif)
 * - SC 13D et SC 13D/A (intentions actives - flux réactif)
 * 
 * Ignore :
 * - Form 4 (mouvements internes - bruit)
 */

import { SQSEvent } from "aws-lambda";
import { supabase } from "./supabase";
import { PutEventsCommand, EventBridgeClient } from "@aws-sdk/client-eventbridge";

const eventBridge = new EventBridgeClient({});
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || "";

interface Fund {
  id: number;
  cik: string;
  name: string;
}

// Types de formulaires pertinents pour le suivi institutionnel
const RELEVANT_FORM_TYPES = [
  '13F-HR',        // Rapport trimestriel complet (stock)
  '13F-HR/A',      // Amendement du rapport trimestriel
  'SC 13G',        // Déclaration de propriété > 5% (flux - réactif)
  'SC 13G/A',      // Amendement de déclaration 13G
  'SC 13D',        // Déclaration de propriété > 5% (intention active)
  '13D',           // Variante de SC 13D
  '13D/A',         // Amendement 13D
] as const;

// Types de formulaires à ignorer (bruit)
const IGNORED_FORM_TYPES = [
  '4',             // Form 4 - Mouvements internes (insider trading)
  '3',             // Form 3 - Déclaration initiale d'insider
  '5',             // Form 5 - Transactions annuelles d'insider
] as const;

/**
 * Détermine le type de formulaire depuis le titre ou l'URL EDGAR
 */
function determineFormType(title?: string | null, link?: string | null): string | null {
  if (!title && !link) return null;
  
  const searchText = `${title || ''} ${link || ''}`.toUpperCase();
  
  // Ordre de priorité : chercher les types les plus spécifiques d'abord
  if (searchText.includes('13F-HR/A') || searchText.includes('13F-HR/AMEND')) {
    return '13F-HR/A';
  }
  if (searchText.includes('13F-HR')) {
    return '13F-HR';
  }
  if (searchText.includes('SC 13G/A') || searchText.includes('13G/A')) {
    return 'SC 13G/A';
  }
  if (searchText.includes('SC 13G') || searchText.includes('13G')) {
    return 'SC 13G';
  }
  if (searchText.includes('SC 13D/A') || searchText.includes('13D/A')) {
    return 'SC 13D/A';
  }
  if (searchText.includes('SC 13D') || searchText.includes('13D')) {
    return 'SC 13D';
  }
  
  return null;
}

/**
 * Vérifie si un type de formulaire est pertinent
 */
function isRelevantFormType(formType: string | null | undefined): boolean {
  if (!formType) return false;
  
  const normalized = formType.trim().toUpperCase();
  
  // Vérifier si c'est un type ignoré
  if (IGNORED_FORM_TYPES.some(ignored => normalized.includes(ignored))) {
    return false;
  }
  
  // Vérifier si c'est un type pertinent
  return RELEVANT_FORM_TYPES.some(relevant => normalized.includes(relevant));
}

export const handler = async (event: SQSEvent) => {
  console.log("SEC Watcher triggered via SQS");
  console.log(`Received ${event.Records.length} message(s) from SQS`);

  // Traiter chaque message SQS (normalement 1 message pour un cron)
  const errors: Array<{ messageId: string; error: any }> = [];
  
  for (const record of event.Records) {
    try {
      // Pour un cron, le body peut être vide ou contenir des métadonnées
      let messageBody: any = {};
      if (record.body) {
        try {
          messageBody = JSON.parse(record.body);
        } catch (e) {
          // Si le body n'est pas du JSON, c'est OK pour un cron
          console.log("SQS message body is not JSON (expected for cron), proceeding with default processing");
        }
      }

      console.log("Processing SQS message:", {
        messageId: record.messageId,
        body: messageBody,
      });

      // Exécuter la logique principale
      await processSECWatcher();

    } catch (error: any) {
      console.error(`Error processing SQS message ${record.messageId}:`, error);
      errors.push({ messageId: record.messageId, error });
      // Continuer avec les autres messages, mais on throw à la fin si erreurs
    }
  }

  // Si des erreurs se sont produites, throw pour que SQS gère les retries
  if (errors.length > 0) {
    throw new Error(`Failed to process ${errors.length} message(s). First error: ${errors[0].error.message}`);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      messagesProcessed: event.Records.length,
    }),
  };
};

/**
 * Logique principale du SEC Watcher
 * Extrait depuis le handler pour être réutilisable
 */
async function processSECWatcher() {
  try {
    // 1. Récupérer tous les funds à suivre avec leurs CIK supplémentaires
    const { data: funds, error: fundsError } = await supabase
      .from("funds")
      .select("id, cik, name");

    if (fundsError) throw fundsError;
    if (!funds || funds.length === 0) {
      console.log("No funds to watch");
      return;
    }

    // 2. Récupérer tous les CIK supplémentaires pour chaque fund
    const fundsWithCiks: Array<{ id: number; name: string; ciks: string[] }> = [];
    
    for (const fund of funds) {
      // Récupérer les CIK supplémentaires
      const { data: additionalCiks, error: ciksError } = await supabase
        .from("fund_ciks")
        .select("cik")
        .eq("fund_id", fund.id);

      if (ciksError) {
        console.error(`Error fetching additional CIKs for fund ${fund.id}:`, ciksError);
        // Continuer avec seulement le CIK primary
        fundsWithCiks.push({
          id: fund.id,
          name: fund.name,
          ciks: [fund.cik],
        });
        continue;
      }

      // Combiner le CIK primary avec les CIK supplémentaires
      const allCiks = [
        fund.cik,
        ...(additionalCiks?.map((fc) => fc.cik) || []),
      ];

      // Dédupliquer
      const uniqueCiks = Array.from(new Set(allCiks));

      fundsWithCiks.push({
        id: fund.id,
        name: fund.name,
        ciks: uniqueCiks,
      });
    }

    console.log(`Checking ${fundsWithCiks.length} funds (${fundsWithCiks.reduce((sum, f) => sum + f.ciks.length, 0)} total CIKs) for new SEC filings`);

    // 3. Pour chaque fund, vérifier tous ses CIK
    let totalDiscovered = 0;
    let hasNewFilings = false;
    
    for (const fund of fundsWithCiks) {
      try {
        let fundDiscovered = 0;
        for (const cik of fund.ciks) {
          const discovered = await checkFundForNewFilings({
            id: fund.id,
            name: fund.name,
            cik: cik,
          });
          fundDiscovered += discovered;
          
          // Rate limiting SEC: 10 req/sec max
          // 150ms entre chaque requête = ~6.6 req/sec (sécurisé)
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        totalDiscovered += fundDiscovered;
        
        // Mettre à jour hasNewFilings si ce fund a découvert des nouveaux filings
        if (fundDiscovered > 0) {
          hasNewFilings = true;
        }
        
        if (fund.ciks.length > 1) {
          console.log(`Fund ${fund.name}: checked ${fund.ciks.length} CIKs, discovered ${fundDiscovered} filings`);
        }
      } catch (error: any) {
        console.error(`Error checking fund ${fund.name}:`, error);
        console.error(`Error details:`, {
          message: error.message,
          stack: error.stack,
        });
        // Continue avec les autres funds
      }
    }

    // Si des nouveaux filings ont été découverts, déclencher le filing-retry-handler
    // pour re-parser les filings en échec/discovered depuis trop longtemps
    if (hasNewFilings && totalDiscovered > 0) {
      console.log(`New filings discovered (${totalDiscovered}), triggering filing-retry-handler...`);
      try {
        await eventBridge.send(new PutEventsCommand({
          Entries: [{
            Source: "adel.signals",
            DetailType: "Filings Discovered",
            Detail: JSON.stringify({
              new_filings_count: totalDiscovered,
              timestamp: new Date().toISOString(),
            }),
            EventBusName: EVENT_BUS_NAME,
          }],
        }));
        console.log(`✅ Event published to trigger filing-retry-handler`);
      } catch (error: any) {
        console.error(`❌ Error publishing filing-retry-handler trigger event:`, error);
        // Ne pas faire échouer le collector si le déclenchement du retry échoue
      }
    } else {
      console.log(`No new filings discovered, skipping filing-retry-handler trigger`);
    }

    console.log(`SEC Watcher completed: ${totalDiscovered} new filings discovered across ${fundsWithCiks.length} funds`);
    return {
      success: true,
      funds_checked: fundsWithCiks.length,
      total_ciks_checked: fundsWithCiks.reduce((sum, f) => sum + f.ciks.length, 0),
      filings_discovered: totalDiscovered,
      retry_handler_triggered: hasNewFilings,
    };
  } catch (error: any) {
    console.error("SEC Watcher error:", error);
    throw error; // Re-throw pour que SQS gère les retries
  }
}

async function checkFundForNewFilings(fund: Fund): Promise<number> {
  console.log(`Checking fund ${fund.name} (CIK: ${fund.cik}) for new SEC filings`);
  
  // Types de formulaires à récupérer depuis EDGAR
  // Note: EDGAR ne supporte pas les filtres multiples, donc on fait une requête par type
  const formTypesToCheck = [
    '13F-HR',      // Rapport trimestriel
    '13F-HR/A',    // Amendement rapport trimestriel
    'SC 13G',      // Position majeure >5% (passif)
    'SC 13G/A',    // Amendement 13G
    'SC 13D',      // Position majeure >5% (actif)
    '13D/A',       // Amendement 13D
  ];
  
  let allEntries: Array<{ link: string; updated: string; title: string }> = [];
  
  // Récupérer les filings pour chaque type
  for (const formType of formTypesToCheck) {
    try {
      const rssUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${fund.cik}&type=${encodeURIComponent(formType)}&dateb=&owner=include&count=40&output=atom`;
      
      const response = await fetch(rssUrl, {
        headers: {
          "User-Agent": "ADEL AI (contact@adel.ai)",
        },
      });

      if (!response.ok) {
        // Certains types peuvent ne pas exister pour certains funds, c'est OK
        if (response.status === 404 || response.status === 400) {
          console.log(`No ${formType} filings found for ${fund.name} (status: ${response.status})`);
          continue;
        }
        throw new Error(`EDGAR API error for ${formType}: ${response.status}`);
      }

      const xml = await response.text();
      const entries = parseEDGARFeed(xml);
      console.log(`Found ${entries.length} ${formType} entries for ${fund.name}`);
      
      // Merger les résultats (éviter les doublons par accession_number)
      const existingAccessions = new Set(allEntries.map(e => extractAccessionNumber(e.link)));
      for (const entry of entries) {
        const accNum = extractAccessionNumber(entry.link);
        if (accNum && !existingAccessions.has(accNum)) {
          allEntries.push(entry);
        }
      }
    } catch (error: any) {
      console.error(`Error fetching ${formType} for ${fund.name}:`, error.message);
      // Continue avec les autres types
    }
  }

  console.log(`Total ${allEntries.length} filings found in EDGAR feed for ${fund.name}`);
  
  // Filtrer pour ne garder que les formulaires pertinents (exclure Form 4, etc.)
  const relevantEntries = allEntries.filter(entry => {
    const detectedType = determineFormType(entry.title, entry.link);
    return detectedType !== null && isRelevantFormType(detectedType);
  });
  
  console.log(`Filtered to ${relevantEntries.length} relevant filings (excluded Form 4, etc.)`);
  
  const entries = relevantEntries;

  let discoveredCount = 0;

  // 3. Vérifier quels filings sont nouveaux
  for (const entry of entries) {
    const accessionNumber = extractAccessionNumber(entry.link);
    if (!accessionNumber) {
      console.log(`Warning: Could not extract accession number from ${entry.link}`);
      continue;
    }

    // Vérifier si ce filing existe déjà
    const { data: existing, error: checkError } = await supabase
      .from("fund_filings")
      .select("id")
      .eq("accession_number", accessionNumber)
      .single();

    if (checkError && checkError.code !== "PGRST116") { // PGRST116 = not found (OK)
      console.error(`Error checking filing ${accessionNumber}:`, checkError);
      throw checkError;
    }

    if (existing) {
      // Déjà vu, skip
      continue;
    }

    // Nouveau filing détecté !
    // Déterminer le type de form depuis le titre/link
    const detectedFormType = determineFormType(entry.title, entry.link);
    
    if (!detectedFormType || !isRelevantFormType(detectedFormType)) {
      console.log(`Skipping irrelevant filing ${accessionNumber} (type: ${detectedFormType || 'unknown'})`);
      continue;
    }
    
    console.log(`New ${detectedFormType} filing detected for ${fund.name}: ${accessionNumber}`);
    
    const formType = detectedFormType;

    // Insérer dans fund_filings
    const { data: filing, error: insertError } = await supabase
      .from("fund_filings")
      .insert({
        fund_id: fund.id,
        cik: fund.cik,  // Ajouter le CIK pour simplifier les requêtes
        accession_number: accessionNumber,
        form_type: formType,
        filing_date: extractDate(entry.updated),
        status: "DISCOVERED",
      })
      .select()
      .single();

    if (insertError) {
      console.error(`Error inserting filing ${accessionNumber}:`, insertError);
      console.error(`Error details:`, {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      });
      throw insertError;
    }

    if (!filing) {
      console.error(`No filing returned from insert for ${accessionNumber}`);
      continue;
    }

    // Publier événement EventBridge pour déclencher le parser
    await eventBridge.send(new PutEventsCommand({
      Entries: [{
        Source: "adel.signals",
        DetailType: "13F Discovered",
        Detail: JSON.stringify({
          fund_id: fund.id,
          filing_id: filing.id,  // Ajouter le filing_id pour le parser
          cik: fund.cik,
          accession_number: accessionNumber,
          filing_url: entry.link,
        }),
        EventBusName: EVENT_BUS_NAME,
      }],
    }));

    console.log(`Event published for filing ${accessionNumber}`);
    discoveredCount++;
  }

  console.log(`Fund ${fund.name}: ${discoveredCount} new filings discovered out of ${entries.length} total`);
  return discoveredCount;
}

function parseEDGARFeed(xml: string): Array<{ link: string; updated: string; title: string }> {
  // Parser Atom/RSS simplifié
  // Pour les feeds EDGAR, on peut aussi utiliser <filing-date> au lieu de <updated>
  const entries: Array<{ link: string; updated: string; title: string }> = [];
  const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
  
  for (const match of entryMatches) {
    const entryXml = match[1];
    const linkMatch = entryXml.match(/<link[^>]*href="([^"]+)"/);
    // Pour les feeds EDGAR, on peut aussi utiliser <filing-date> au lieu de <updated>
    const updatedMatch = entryXml.match(/<updated>([^<]+)<\/updated>/) || entryXml.match(/<filing-date>([^<]+)<\/filing-date>/);
    const titleMatch = entryXml.match(/<title>([^<]+)<\/title>/);
    
    if (linkMatch && updatedMatch) {
      entries.push({
        link: linkMatch[1],
        updated: updatedMatch[1],
        title: titleMatch?.[1] || "",
      });
    }
  }
  
  return entries;
}

function extractAccessionNumber(url: string): string | null {
  // Format: https://www.sec.gov/Archives/edgar/data/1234567/000123456724000001/xslF345X03/form13fInfoTable.xml
  const match = url.match(/\/(\d{10}-\d{2}-\d{6})/);
  return match ? match[1] : null;
}

function extractDate(dateStr: string): string {
  // Convertir ISO date en DATE SQL
  return new Date(dateStr).toISOString().split("T")[0];
}

