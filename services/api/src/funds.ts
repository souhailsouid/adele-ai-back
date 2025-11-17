import { supabase } from "./supabase";
import { z } from "zod";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const eventBridge = new EventBridgeClient({});
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || "";

const CreateFundInput = z.object({
  name: z.string().min(1),
  cik: z.string().regex(/^\d{10}$/, "CIK must be 10 digits"),
  tier_influence: z.number().int().min(1).max(5).default(3),
  category: z.enum(["hedge_fund", "family_office", "mutual_fund", "pension_fund", "other"]).default("hedge_fund"),
});

export interface Fund {
  id: number;
  name: string;
  cik: string;
  tier_influence: number;
  category: string;
  created_at: string;
}

/**
 * Créer un nouveau fond et déclencher automatiquement :
 * 1. Détection des filings existants
 * 2. Parsing des filings
 * 3. Vérification des valeurs
 */
export async function createFund(body: unknown) {
  const input = CreateFundInput.parse(body);
  
  // 1. Vérifier si le fond existe déjà
  const { data: existing, error: checkError } = await supabase
    .from("funds")
    .select("id")
    .eq("cik", input.cik)
    .single();

  if (checkError && checkError.code !== "PGRST116") {
    throw checkError;
  }

  if (existing) {
    throw new Error(`Fund with CIK ${input.cik} already exists`);
  }

  // 2. Créer le fond
  const { data: fund, error: insertError } = await supabase
    .from("funds")
    .insert({
      name: input.name,
      cik: input.cik,
      tier_influence: input.tier_influence,
      category: input.category,
    })
    .select()
    .single();

  if (insertError) throw insertError;

  console.log(`Fund created: ${fund.name} (CIK: ${fund.cik})`);

  // 3. Déclencher automatiquement la détection des filings
  await discoverAndParseFilings(fund.id, fund.cik);

  return {
    fund,
    message: "Fund created and filings discovery started",
  };
}

/**
 * Découvrir et parser automatiquement tous les filings d'un fond
 */
export async function discoverAndParseFilings(fundId: number, cik: string) {
  console.log(`Discovering filings for fund ${fundId} (CIK: ${cik})`);

  // 1. Récupérer les filings depuis EDGAR
  // Note: On récupère les 13F-HR et 13F-HR/A (amendments) séparément car EDGAR ne supporte pas les filtres multiples
  // On va faire deux requêtes et merger les résultats
  const rssUrl13F = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR&dateb=&owner=include&count=40&output=atom`;
  const rssUrl13FA = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR/A&dateb=&owner=include&count=40&output=atom`;

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
    // Merger les résultats (éviter les doublons par accession_number)
    const existingAccessions = new Set(entries.map(e => extractAccessionNumber(e.link)));
    for (const entry of entries13FA) {
      const accNum = extractAccessionNumber(entry.link);
      if (accNum && !existingAccessions.has(accNum)) {
        entries.push(entry);
      }
    }
  }

  console.log(`Found ${entries.length} filings in EDGAR feed`);

  const discoveredFilings: any[] = [];

  // 2. Pour chaque filing, vérifier s'il existe déjà
  for (const entry of entries) {
    const accessionNumber = extractAccessionNumber(entry.link);
    if (!accessionNumber) continue;

    // Vérifier si ce filing existe déjà
    const { data: existing, error: checkError } = await supabase
      .from("fund_filings")
      .select("id")
      .eq("accession_number", accessionNumber)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    if (existing) {
      console.log(`Filing ${accessionNumber} already exists, skipping`);
      continue;
    }

    // Nouveau filing détecté
    // Déterminer le type de form (13F-HR ou 13F-HR/A)
    let formType = "13F-HR";
    if (entry.title?.includes("13F-HR/A") || entry.link?.includes("13F-HR/A")) {
      formType = "13F-HR/A";
    }

    const { data: filing, error: insertError } = await supabase
      .from("fund_filings")
      .insert({
        fund_id: fundId,
        cik: cik,
        accession_number: accessionNumber,
        form_type: formType,
        filing_date: extractDate(entry.updated),
        status: "DISCOVERED",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    discoveredFilings.push(filing);

    // 3. Déclencher le parser via EventBridge
    await eventBridge.send(new PutEventsCommand({
      Entries: [{
        Source: "adel.signals",
        DetailType: "13F Discovered",
        Detail: JSON.stringify({
          fund_id: fundId,
          filing_id: filing.id,
          cik: cik,
          accession_number: accessionNumber,
          filing_url: entry.link,
        }),
        EventBusName: EVENT_BUS_NAME,
      }],
    }));

    console.log(`Event published for filing ${accessionNumber}`);
  }

  return {
    discovered: discoveredFilings.length,
    filings: discoveredFilings,
  };
}

/**
 * Lister tous les fonds
 */
export async function getFunds() {
  const { data, error } = await supabase
    .from("funds")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Obtenir un fond par ID
 */
export async function getFund(id: number) {
  const { data, error } = await supabase
    .from("funds")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Obtenir les holdings d'un fond
 */
export async function getFundHoldings(fundId: number, limit = 100) {
  const { data, error } = await supabase
    .from("fund_holdings")
    .select("*, fund_filings(filing_date)")
    .eq("fund_id", fundId)
    .order("market_value", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/**
 * Obtenir les filings d'un fond
 */
export async function getFundFilings(fundId: number) {
  const { data, error } = await supabase
    .from("fund_filings")
    .select("*")
    .eq("fund_id", fundId)
    .order("filing_date", { ascending: false });

  if (error) throw error;
  return data;
}

// Helper functions
function parseEDGARFeed(xml: string): Array<{ link: string; updated: string; title: string }> {
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
  const match = url.match(/\/(\d{10}-\d{2}-\d{6})/);
  return match ? match[1] : null;
}

function extractDate(dateStr: string): string {
  return new Date(dateStr).toISOString().split("T")[0];
}

