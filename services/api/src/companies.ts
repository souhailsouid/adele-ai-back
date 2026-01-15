import { supabase } from "./supabase";
import { z } from "zod";

import { enrichCompanyFromFMP, enrichCompaniesBatch } from "./services/company-enrichment.service";
import { getCompanyByTickerAthena, getCompanyByCikAthena, getCompanyByIdAthena, getCompaniesAthena } from "./athena/companies";
// Import lazy pour éviter de charger parquetjs si non nécessaire
// import { insertRowS3 } from "./athena/write";
import { executeAthenaQuery } from "./athena/query";
import { withCache, CacheKeys } from "./athena/cache";

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
 * 
 * Architecture Extreme Budget: Écriture directe sur S3, pas Supabase
 */
export async function createCompany(body: unknown) {
  console.log("[DEBUG] createCompany called with body:", JSON.stringify(body));

  // Validation
  const input = CreateCompanyInput.parse(body);
  console.log("[DEBUG] Input validated:", input);

  const useS3 = process.env.USE_S3_WRITES === 'true' || process.env.USE_S3_WRITES === '1';

  if (useS3) {
    // Architecture Extreme Budget: Utiliser S3 + Athena
    
    // 1. Vérifier si l'entreprise existe déjà (lecture Athena)
    const existingByTicker = await getCompanyByTickerAthena(input.ticker);
    if (existingByTicker) {
      throw new Error(`Company with ticker ${input.ticker} already exists`);
    }

    const existingByCik = await getCompanyByCikAthena(input.cik);
    if (existingByCik) {
      throw new Error(`Company with CIK ${input.cik} already exists`);
    }

    // 2. Écrire directement sur S3 (pas Supabase!)
    // Import lazy pour éviter de charger parquetjs si non nécessaire
    const { insertRowS3 } = await import('./athena/write');
    const { id, s3Key } = await insertRowS3('companies', {
      ticker: input.ticker.toUpperCase(),
      cik: input.cik,
      name: input.name,
      sector: input.sector || null,
      industry: input.industry || null,
      market_cap: input.market_cap || null,
      headquarters_country: input.headquarters_country || null,
      headquarters_state: input.headquarters_state || null,
    });

    console.log(`[SUCCESS] Company created on S3: ${input.name} (Ticker: ${input.ticker}, CIK: ${input.cik}, ID: ${id})`);

    return {
      company: {
        id,
        ticker: input.ticker.toUpperCase(),
        cik: input.cik,
        name: input.name,
        sector: input.sector || null,
        industry: input.industry || null,
        market_cap: input.market_cap || null,
        headquarters_country: input.headquarters_country || null,
        headquarters_state: input.headquarters_state || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      s3Key,
      message: "Company created successfully on S3. Filings discovery will start automatically.",
    };
  }

  // Fallback: Utiliser Supabase (temporaire, à supprimer après migration complète)
  let existing = null;
  
  // Chercher par ticker
  const { data: byTicker, error: tickerError } = await supabase
    .from("companies")
    .select("id")
    .eq("ticker", input.ticker.toUpperCase())
    .maybeSingle();

  if (tickerError && tickerError.code !== "PGRST116") {
    throw tickerError;
  }
  if (byTicker) {
    existing = byTicker;
  }

  // Si pas trouvé, chercher par CIK
  if (!existing) {
    const { data: byCik, error: cikError } = await supabase
      .from("companies")
      .select("id")
      .eq("cik", input.cik)
      .maybeSingle();

    if (cikError && cikError.code !== "PGRST116") {
      throw cikError;
    }
    if (byCik) {
      existing = byCik;
    }
  }

  if (existing) {
    throw new Error(`Company with ticker ${input.ticker} or CIK ${input.cik} already exists`);
  }

  // Créer l'entreprise
  const { data: companyArray, error: insertError } = await supabase
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
    .select();

  if (insertError) {
    throw insertError;
  }

  if (!companyArray || companyArray.length === 0) {
    throw new Error("Company insert failed: no data returned");
  }

  const company = companyArray[0];

  console.log(`[SUCCESS] Company created: ${company.name} (Ticker: ${company.ticker}, CIK: ${company.cik})`);

  return {
    company,
    message: "Company created successfully. Filings discovery will start automatically.",
  };
}

/**
 * Lister toutes les entreprises
 * 
 * Architecture Extreme Budget: Utilise Athena pour les lectures
 */
export async function getCompanies() {
  const useAthena = process.env.USE_ATHENA === 'true' || process.env.USE_ATHENA === '1';

  if (useAthena) {
    try {
      // Limiter à 1000 par défaut pour éviter les requêtes trop lourdes
      const companies = await getCompaniesAthena(1000);
      console.log(`[Athena] Retrieved ${companies.length} companies`);
      return companies;
    } catch (athenaError: any) {
      console.error(`[Athena] Error fetching companies, falling back to Supabase: ${athenaError.message}`);
      // Fallback to Supabase if Athena fails
    }
  }

  // Fallback: Utiliser Supabase (temporaire, à supprimer après migration complète)
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw error;
  return data;
}

/**
 * Obtenir une entreprise par ID
 * 
 * Architecture Extreme Budget: Utilise S3 direct read ou Athena
 */
export async function getCompany(id: number) {
  const useAthena = process.env.USE_ATHENA === 'true' || process.env.USE_ATHENA === '1';

  if (useAthena) {
    try {
      const company = await getCompanyByIdAthena(id);
      if (company) {
        console.log(`[Athena] Found company ${id} via Athena`);
        return company;
      }
      // Si non trouvé, throw 404
      const error = new Error(`Company with id ${id} not found`);
      (error as any).statusCode = 404;
      throw error;
    } catch (athenaError: any) {
      console.error(`[Athena] Error fetching company ${id}, falling back to Supabase: ${athenaError.message}`);
      // Si c'est une 404, la propager
      if (athenaError.statusCode === 404) {
        throw athenaError;
      }
      // Sinon, fallback to Supabase
    }
  }

  // Fallback: Utiliser Supabase (temporaire, à supprimer après migration complète)
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      const notFoundError = new Error(`Company with id ${id} not found`);
      (notFoundError as any).statusCode = 404;
      throw notFoundError;
    }
    throw error;
  }
  return data;
}

/**
 * Obtenir une entreprise par ticker
 * 
 * Architecture Extreme Budget: Utilise Athena pour les lectures
 */
export async function getCompanyByTicker(ticker: string) {
  // Utiliser Athena pour les lectures (Extreme Budget)
  const useAthena = process.env.USE_ATHENA === 'true' || process.env.USE_ATHENA === '1';
  
  if (useAthena) {
    try {
      return await getCompanyByTickerAthena(ticker);
    } catch (error: any) {
      console.error(`[Athena] Error fetching company by ticker ${ticker}:`, error.message);
      // Fallback vers Supabase en cas d'erreur Athena
      console.log(`[Fallback] Using Supabase for company ${ticker}`);
    }
  }

  // Fallback: Utiliser Supabase (pour compatibilité ou si Athena désactivé)
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("ticker", ticker.toUpperCase())
    .maybeSingle();

  // Si erreur et ce n'est pas "not found", throw
  if (error && error.code !== "PGRST116") {
    throw error;
  }

  // Si pas de données, retourner null (le handler gérera le 404)
  if (!data) {
    return null;
  }

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







