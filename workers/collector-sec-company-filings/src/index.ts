/**
 * Lambda pour découvrir automatiquement les filings SEC des entreprises
 * Déclenché par EventBridge (cron: quotidien ou à la demande)
 * 
 * Form types supportés:
 * - 8-K: Événements importants
 * - 10-K: Rapport annuel
 * - 10-Q: Rapport trimestriel
 * - 4: Insider trading (Form 4)
 * - DEF 14A: Proxy statements
 */

import { EventBridgeEvent } from "aws-lambda";
import { supabase } from "./supabase";
import { PutEventsCommand, EventBridgeClient } from "@aws-sdk/client-eventbridge";

const eventBridge = new EventBridgeClient({});
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || "";

interface Company {
  id: number;
  cik: string;
  ticker: string;
  name: string;
}

// Form types à suivre (prioritaires)
const FORM_TYPES = ["8-K", "10-K", "10-Q", "4", "DEF 14A"];

export const handler = async (event: EventBridgeEvent<"Scheduled Event", any>) => {
  console.log("SEC Company Filings Collector triggered");

  try {
    // 1. Récupérer toutes les entreprises à suivre
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, cik, ticker, name");

    if (companiesError) throw companiesError;
    if (!companies || companies.length === 0) {
      console.log("No companies to watch");
      return { statusCode: 200, body: JSON.stringify({ message: "No companies configured" }) };
    }

    console.log(`Checking ${companies.length} companies for new filings`);

    // 2. Pour chaque entreprise, vérifier EDGAR
    let totalDiscovered = 0;
    for (const company of companies) {
      try {
        const discovered = await checkCompanyForNewFilings(company);
        totalDiscovered += discovered;
      } catch (error: any) {
        console.error(`Error checking company ${company.name} (CIK: ${company.cik}):`, error);
        // Continue avec les autres entreprises
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        companies_checked: companies.length,
        filings_discovered: totalDiscovered,
      }),
    };
  } catch (error: any) {
    console.error("SEC Company Filings Collector error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

async function checkCompanyForNewFilings(company: Company): Promise<number> {
  console.log(`Checking filings for ${company.name} (CIK: ${company.cik})`);

  let totalDiscovered = 0;

  // Pour chaque type de form, récupérer les filings récents
  for (const formType of FORM_TYPES) {
    try {
      const discovered = await checkFormType(company, formType);
      totalDiscovered += discovered;
    } catch (error: any) {
      console.error(`Error checking form type ${formType} for ${company.ticker}:`, error);
      // Continue avec les autres form types
    }
  }

  return totalDiscovered;
}

async function checkFormType(company: Company, formType: string): Promise<number> {
  // EDGAR RSS feed pour un CIK et un form type
  const rssUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${company.cik}&type=${formType}&dateb=&owner=include&count=20&output=atom`;

  const response = await fetch(rssUrl, {
    headers: {
      "User-Agent": "ADEL AI (contact@adel.ai)",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      // Pas de filings de ce type pour cette entreprise
      return 0;
    }
    throw new Error(`EDGAR API error: ${response.status}`);
  }

  const xml = await response.text();
  const entries = parseEDGARFeed(xml);

  console.log(`Found ${entries.length} ${formType} filings for ${company.ticker}`);

  let discovered = 0;

  // Pour chaque entry, vérifier si c'est nouveau
  for (const entry of entries) {
    const accessionNumber = extractAccessionNumber(entry.link);
    if (!accessionNumber) continue;

    // Vérifier si ce filing existe déjà
    const { data: existing, error: checkError } = await supabase
      .from("company_filings")
      .select("id")
      .eq("accession_number", accessionNumber)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    if (existing) {
      // Déjà connu, skip
      continue;
    }

    // Nouveau filing détecté
    const filingDate = extractDate(entry.updated);

    // Construire l'URL du document
    const documentUrl = entry.link;

    // Insérer le filing
    const { data: filing, error: insertError } = await supabase
      .from("company_filings")
      .insert({
        company_id: company.id,
        cik: company.cik,
        form_type: formType,
        accession_number: accessionNumber,
        filing_date: filingDate,
        document_url: documentUrl,
        status: "DISCOVERED",
      })
      .select()
      .single();

    if (insertError) {
      console.error(`Error inserting filing ${accessionNumber}:`, insertError);
      continue;
    }

    console.log(`Discovered new ${formType} filing: ${accessionNumber} for ${company.ticker}`);

    // Publier un événement EventBridge pour déclencher le parser (futur)
    try {
      await eventBridge.send(
        new PutEventsCommand({
          Entries: [
            {
              Source: "adel.signals",
              DetailType: "Company Filing Discovered",
              Detail: JSON.stringify({
                company_id: company.id,
                filing_id: filing.id,
                cik: company.cik,
                ticker: company.ticker,
                form_type: formType,
                accession_number: accessionNumber,
                filing_url: documentUrl,
              }),
              EventBusName: EVENT_BUS_NAME,
            },
          ],
        })
      );
    } catch (eventError: any) {
      console.error(`Error publishing event for filing ${accessionNumber}:`, eventError);
      // Continue même si l'événement échoue
    }

    discovered++;
  }

  return discovered;
}

// Helper functions (similaires à collector-sec-watcher)

function parseEDGARFeed(xml: string): Array<{ link: string; updated: string; title: string }> {
  const entries: Array<{ link: string; updated: string; title: string }> = [];
  const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);

  for (const match of entryMatches) {
    const entryXml = match[1];
    const linkMatch = entryXml.match(/<link[^>]*href="([^"]+)"/);
    const updatedMatch =
      entryXml.match(/<updated>([^<]+)<\/updated>/) ||
      entryXml.match(/<filing-date>([^<]+)<\/filing-date>/);
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
  // Format: https://www.sec.gov/cgi-bin/viewer?action=view&cik=...&accession_number=0001045810-25-000001
  const match = url.match(/accession_number=(\d{10}-\d{2}-\d{6})/);
  if (match) return match[1];

  // Format alternatif: https://www.sec.gov/Archives/edgar/data/1045810/000104581025000001/...
  const match2 = url.match(/\/(\d{10}-\d{2}-\d{6})/);
  return match2 ? match2[1] : null;
}

function extractDate(dateStr: string): string {
  // Convertir ISO date en YYYY-MM-DD
  try {
    return new Date(dateStr).toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}




