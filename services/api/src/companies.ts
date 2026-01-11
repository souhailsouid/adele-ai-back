import { supabase } from "./supabase";
import { z } from "zod";

import { enrichCompanyFromFMP, enrichCompaniesBatch } from "./services/company-enrichment.service";

const CreateCompanyInput = z.object({
  ticker: z.string().min(1).max(10),
  cik: z.string().regex(/^\d{10}$/, "CIK must be 10 digits"),
  name: z.string().min(1),
  sector: z.string().optional(),
  industry: z.string().optional(),
  market_cap: z.number().int().positive().optional(),
  headquarters_country: z.string().optional(),
  headquarters_state: z.string().optional(),
});

export interface Company {
  id: number;
  ticker: string;
  cik: string;
  name: string;
  sector: string | null;
  industry: string | null;
  market_cap: number | null;
  headquarters_country: string | null;
  headquarters_state: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Créer une nouvelle entreprise à suivre
 */
export async function createCompany(body: unknown) {
  console.log("[DEBUG] createCompany called with body:", JSON.stringify(body));

  // Validation
  const input = CreateCompanyInput.parse(body);
  console.log("[DEBUG] Input validated:", input);

  // Vérifier si l'entreprise existe déjà
  const { data: existing, error: checkError } = await supabase
    .from("companies")
    .select("id")
    .or(`ticker.eq.${input.ticker},cik.eq.${input.cik}`)
    .single();

  if (checkError && checkError.code !== "PGRST116") {
    throw checkError;
  }

  if (existing) {
    throw new Error(`Company with ticker ${input.ticker} or CIK ${input.cik} already exists`);
  }

  // Créer l'entreprise
  const { data: company, error: insertError } = await supabase
    .from("companies")
    .insert({
      ticker: input.ticker.toUpperCase(),
      cik: input.cik,
      name: input.name,
      sector: input.sector,
      industry: input.industry,
      market_cap: input.market_cap,
      headquarters_country: input.headquarters_country,
      headquarters_state: input.headquarters_state,
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  console.log(`[SUCCESS] Company created: ${company.name} (Ticker: ${company.ticker}, CIK: ${company.cik})`);

  // Note: La découverte des filings se fera automatiquement via le collector SEC (EventBridge cron)
  // On pourrait aussi déclencher une découverte immédiate ici si nécessaire

  return {
    company,
    message: "Company created successfully. Filings discovery will start automatically.",
  };
}

/**
 * Lister toutes les entreprises
 */
export async function getCompanies() {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Obtenir une entreprise par ID
 */
export async function getCompany(id: number) {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Obtenir une entreprise par ticker
 */
export async function getCompanyByTicker(ticker: string) {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("ticker", ticker.toUpperCase())
    .single();

  if (error) throw error;
  return data;
}

/**
 * Obtenir les filings d'une entreprise
 */
export async function getCompanyFilings(companyId: number, formType?: string) {
  let query = supabase
    .from("company_filings")
    .select("*")
    .eq("company_id", companyId)
    .order("filing_date", { ascending: false });

  if (formType) {
    query = query.eq("form_type", formType);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

/**
 * Obtenir les événements d'une entreprise
 */
export async function getCompanyEvents(companyId: number, eventType?: string) {
  let query = supabase
    .from("company_events")
    .select("*, company_filings(filing_date, form_type)")
    .eq("company_id", companyId)
    .order("event_date", { ascending: false });

  if (eventType) {
    query = query.eq("event_type", eventType);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

/**
 * Obtenir les insider trades d'une entreprise
 */
export async function getCompanyInsiderTrades(companyId: number) {
  const { data, error } = await supabase
    .from("insider_trades")
    .select("*, company_filings(filing_date)")
    .eq("company_id", companyId)
    .order("transaction_date", { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Enrichir une entreprise depuis FMP (créer ou mettre à jour avec secteur/industrie)
 */
export async function enrichCompanyFromFMPAPI(ticker: string, cik?: string) {
  return await enrichCompanyFromFMP(ticker, cik);
}

/**
 * Enrichir plusieurs entreprises en batch depuis FMP
 */
export async function enrichCompaniesBatchAPI(body: unknown) {
  const { tickers, cikMap, delayMs } = body as {
    tickers: string[];
    cikMap?: Record<string, string>;
    delayMs?: number;
  };

  if (!tickers || !Array.isArray(tickers)) {
    throw new Error("tickers array is required");
  }

  const cikMapObj = cikMap ? new Map(Object.entries(cikMap)) : undefined;
  return await enrichCompaniesBatch(tickers, cikMapObj, delayMs);
}







