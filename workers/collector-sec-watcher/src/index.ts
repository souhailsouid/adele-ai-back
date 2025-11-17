/**
 * Lambda pour détecter les nouveaux 13F filings sur EDGAR
 * Déclenché par EventBridge (cron: toutes les 5 minutes)
 */

import { EventBridgeEvent } from "aws-lambda";
import { supabase } from "./supabase";
import { PutEventsCommand, EventBridgeClient } from "@aws-sdk/client-eventbridge";

const eventBridge = new EventBridgeClient({});
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || "";

interface Fund {
  id: number;
  cik: string;
  name: string;
}

export const handler = async (event: EventBridgeEvent<"Scheduled Event", any>) => {
  console.log("SEC Watcher triggered");

  try {
    // 1. Récupérer tous les funds à suivre
    const { data: funds, error: fundsError } = await supabase
      .from("funds")
      .select("id, cik, name");

    if (fundsError) throw fundsError;
    if (!funds || funds.length === 0) {
      console.log("No funds to watch");
      return { statusCode: 200, body: JSON.stringify({ message: "No funds configured" }) };
    }

    console.log(`Checking ${funds.length} funds for new 13F filings`);

    // 2. Pour chaque fund, vérifier EDGAR
    for (const fund of funds) {
      try {
        await checkFundForNewFilings(fund);
      } catch (error: any) {
        console.error(`Error checking fund ${fund.name} (CIK: ${fund.cik}):`, error);
        // Continue avec les autres funds
      }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error: any) {
    console.error("SEC Watcher error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

async function checkFundForNewFilings(fund: Fund) {
  // EDGAR RSS feed pour un CIK
  // Récupérer les 13F-HR et 13F-HR/A (amendments)
  const rssUrl13F = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${fund.cik}&type=13F-HR&dateb=&owner=include&count=10&output=atom`;
  const rssUrl13FA = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${fund.cik}&type=13F-HR/A&dateb=&owner=include&count=10&output=atom`;

  // Récupérer les 13F-HR
  const response13F = await fetch(rssUrl13F, {
    headers: {
      "User-Agent": "ADEL AI (contact@adel.ai)",
    },
  });

  if (!response13F.ok) {
    throw new Error(`EDGAR API error: ${response13F.status}`);
  }

  const xml13F = await response13F.text();
  let entries = parseEDGARFeed(xml13F);

  // Récupérer les 13F-HR/A (amendments)
  const response13FA = await fetch(rssUrl13FA, {
    headers: {
      "User-Agent": "ADEL AI (contact@adel.ai)",
    },
  });

  if (response13FA.ok) {
    const xml13FA = await response13FA.text();
    const entries13FA = parseEDGARFeed(xml13FA);
    // Merger les résultats (éviter les doublons)
    const existingAccessions = new Set(entries.map(e => extractAccessionNumber(e.link)));
    for (const entry of entries13FA) {
      const accNum = extractAccessionNumber(entry.link);
      if (accNum && !existingAccessions.has(accNum)) {
        entries.push(entry);
      }
    }
  }

  // 3. Vérifier quels filings sont nouveaux
  for (const entry of entries) {
    const accessionNumber = extractAccessionNumber(entry.link);
    if (!accessionNumber) continue;

    // Vérifier si ce filing existe déjà
    const { data: existing, error: checkError } = await supabase
      .from("fund_filings")
      .select("id")
      .eq("accession_number", accessionNumber)
      .single();

    if (checkError && checkError.code !== "PGRST116") { // PGRST116 = not found (OK)
      throw checkError;
    }

    if (existing) {
      // Déjà vu, skip
      continue;
    }

    // Nouveau filing détecté !
    console.log(`New 13F filing detected for ${fund.name}: ${accessionNumber}`);

    // Déterminer le type de form (13F-HR ou 13F-HR/A)
    let formType = "13F-HR";
    if (entry.title?.includes("13F-HR/A") || entry.link?.includes("13F-HR/A")) {
      formType = "13F-HR/A";
    }

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

    if (insertError) throw insertError;

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
  }
}

function parseEDGARFeed(xml: string): Array<{ link: string; updated: string; title: string }> {
  // Parser Atom/RSS simplifié
  const entries: Array<{ link: string; updated: string; title: string }> = [];
  const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
  
  for (const match of entryMatches) {
    const entryXml = match[1];
    const linkMatch = entryXml.match(/<link[^>]*href="([^"]+)"/);
    const updatedMatch = entryXml.match(/<updated>([^<]+)<\/updated>/);
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

