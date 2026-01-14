import { supabase } from "./supabase";
import { z } from "zod";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { determineFormType, isRelevantFormType } from "./services/sec-filter.service";
import { getAllFundCiks } from "./services/fund-ciks.service";
import { getTickerFundsChanges, getMarketPulse, getPulseFeed } from "./services/market-pulse.service";
import { getFundByIdAthena, getFundsAthena, getFundByCikAthena } from "./athena/funds";
import { getFundFilingsAthena, getFundFilingByIdAthena } from "./athena/fund_filings";
import { getFundDiffsAthena } from "./athena/fund_holdings_diff";
import { getAllFundsRecentChangesAthena } from "./athena/market_pulse";
import { insertRowS3 } from "./athena/write";

export { getTickerFundsChanges, getMarketPulse, getPulseFeed };
export { analyzeFundDiffsStrategically } from "./services/fund-strategic-analysis.service";

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
 * Créer un nouveau fond (responsabilité unique : création du fund)
 */
export async function createFund(body: unknown) {
  console.log("[DEBUG] createFund called with body:", JSON.stringify(body));
  
  // Validation
  const input = CreateFundInput.parse(body);
  console.log("[DEBUG] Input validated:", input);

  // Architecture Extreme Budget: Athena/S3 uniquement, pas de Supabase
  if (process.env.USE_ATHENA !== 'true' && process.env.USE_ATHENA !== '1') {
    throw new Error('USE_ATHENA must be enabled. Supabase is no longer supported.');
  }
  if (process.env.USE_S3_WRITES !== 'true' && process.env.USE_S3_WRITES !== '1') {
    throw new Error('USE_S3_WRITES must be enabled. Supabase is no longer supported.');
  }

  // Vérifier si le fond existe déjà (Athena uniquement)
  const existing = await getFundByCikAthena(input.cik);
  if (existing) {
    throw new Error(`Fund with CIK ${input.cik} already exists`);
  }

  // Créer le fund dans S3
  console.log("[S3 Write] Inserting fund directly to S3...");
  const newFundData = {
    name: input.name,
    cik: input.cik,
    tier_influence: input.tier_influence,
    category: input.category,
    created_at: new Date().toISOString(),
  };
  
  const insertedFund = await insertRowS3('funds', newFundData);
  const fund: Fund = {
    id: insertedFund.id,
    name: input.name,
    cik: input.cik,
    tier_influence: input.tier_influence,
    category: input.category,
    created_at: newFundData.created_at,
  };
  console.log(`[S3 Write] Fund created on S3: ${fund.name} (CIK: ${fund.cik}, ID: ${fund.id})`);

  console.log(`[SUCCESS] Fund created: ${fund.name} (CIK: ${fund.cik})`);

  // Découvrir automatiquement les filings pour tous les CIK (asynchrone, non bloquant)
  // Note: Au moment de la création, seul le CIK principal existe, mais la fonction
  // discoverAllFundFilings gère déjà tous les CIK (y compris ceux ajoutés plus tard)
  discoverAllFundFilings(fund.id)
    .then(result => {
      console.log(`[SUCCESS] Discovery completed: ${result.total_discovered} filings discovered across ${result.ciks_checked} CIKs`);
    })
    .catch(error => {
      console.error(`[ERROR] Discovery failed:`, error);
    });

  return {
    fund,
    message: "Fund created successfully. Filings discovery started.",
  };
}

/**
 * Découvrir les filings d'un fond pour TOUS ses CIK (principal + secondaires)
 * Découvre les filings depuis EDGAR pour chaque CIK et les insère en base
 * Le parsing se fait automatiquement via EventBridge
 */
export async function discoverAllFundFilings(fundId: number) {
  console.log(`Discovering filings for fund ${fundId} (all CIKs)`);
  
  // Récupérer tous les CIK du fund (primary + secondaires)
  const allCiks = await getAllFundCiks(fundId);
  console.log(`Found ${allCiks.length} CIK(s) for fund ${fundId}: ${allCiks.join(", ")}`);
  
  let totalDiscovered = 0;
  const resultsByCik: Array<{ cik: string; discovered: number }> = [];
  
  // Découvrir les filings pour chaque CIK
  for (const cik of allCiks) {
    try {
      const result = await discoverFilings(fundId, cik);
      totalDiscovered += result.discovered;
      resultsByCik.push({ cik, discovered: result.discovered });
      
      // Rate limiting SEC: 10 req/sec max
      // 150ms entre chaque CIK = ~6.6 req/sec (sécurisé)
      if (allCiks.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    } catch (error: any) {
      console.error(`Error discovering filings for CIK ${cik}:`, error);
      // Continue avec les autres CIK
    }
  }
  
  return {
    total_discovered: totalDiscovered,
    ciks_checked: allCiks.length,
    results_by_cik: resultsByCik,
  };
}

/**
 * Construire l'URL du filing depuis l'accession number et le CIK
 */
function buildFilingUrl(cik: string, accessionNumber: string): string {
  const accessionNoDashes = accessionNumber.replace(/-/g, "");
  const cikClean = cik.replace(/^0+/, "") || "0";
  return `https://www.sec.gov/Archives/edgar/data/${cikClean}/${accessionNoDashes}/${accessionNumber}-index.htm`;
}

/**
 * Re-parser tous les filings d'un fund (FAILED ou DISCOVERED)
 */
export async function retryAllFundFilings(fundId: number, options?: { status?: "FAILED" | "DISCOVERED" | "ALL" }) {
  // Récupérer tous les filings du fund
  const statusFilter = options?.status === "ALL" 
    ? ["FAILED", "DISCOVERED"] 
    : options?.status 
    ? [options.status] 
    : ["FAILED", "DISCOVERED"];

  const { data: filings, error: filingsError } = await supabase
    .from("fund_filings")
    .select("id, fund_id, cik, accession_number, form_type, filing_date, status, raw_storage_path")
    .eq("fund_id", fundId)
    .in("status", statusFilter)
    .order("filing_date", { ascending: false });

  if (filingsError) {
    throw new Error(`Error fetching filings: ${filingsError.message}`);
  }

  if (!filings || filings.length === 0) {
    return {
      message: "No filings to retry",
      fund_id: fundId,
      total: 0,
      retried: 0,
      results: [],
    };
  }

  // Récupérer le fund pour obtenir le CIK primary si nécessaire
  const { data: fund } = await supabase
    .from("funds")
    .select("cik")
    .eq("id", fundId)
    .single();

  const results: Array<{
    filing_id: number;
    accession_number: string;
    status: string;
    success: boolean;
    error?: string;
  }> = [];

  let successCount = 0;
  let errorCount = 0;

  // Re-parser chaque filing
  for (const filing of filings) {
    try {
      // Vérifier que le CIK est présent
      let cikToUse = filing.cik;
      if (!cikToUse && fund?.cik) {
        cikToUse = fund.cik;
        // Mettre à jour le CIK du filing
        await supabase
          .from("fund_filings")
          .update({ cik: fund.cik })
          .eq("id", filing.id);
      }

      if (!cikToUse) {
        throw new Error(`No CIK found for filing ${filing.id}`);
      }

      // Construire l'URL du filing
      const filingUrl = filing.raw_storage_path || buildFilingUrl(cikToUse, filing.accession_number);

      // Publier l'événement EventBridge
      await eventBridge.send(new PutEventsCommand({
        Entries: [{
          Source: "adel.signals",
          DetailType: "13F Discovered",
          Detail: JSON.stringify({
            fund_id: fundId,
            filing_id: filing.id,
            cik: cikToUse,
            accession_number: filing.accession_number,
            filing_url: filingUrl,
          }),
          EventBusName: EVENT_BUS_NAME,
        }],
      }));

      // Remettre le statut à DISCOVERED
      await supabase
        .from("fund_filings")
        .update({ 
          status: "DISCOVERED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", filing.id);

      successCount++;
      results.push({
        filing_id: filing.id,
        accession_number: filing.accession_number,
        status: filing.status,
        success: true,
      });

      // Délai entre chaque événement pour éviter de surcharger EventBridge
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      errorCount++;
      results.push({
        filing_id: filing.id,
        accession_number: filing.accession_number,
        status: filing.status,
        success: false,
        error: error.message || String(error),
      });
    }
  }

  return {
    message: "Filing retry completed",
    fund_id: fundId,
    total: filings.length,
    retried: successCount,
    errors: errorCount,
    results,
  };
}

/**
 * Forcer le re-parsing d'un filing spécifique via EventBridge
 */
export async function retryFilingParsing(fundId: number, filingId: number) {
  // Récupérer le filing
  const { data: filing, error: filingError } = await supabase
    .from("fund_filings")
    .select("id, fund_id, cik, accession_number, form_type, filing_date, status, raw_storage_path")
    .eq("id", filingId)
    .eq("fund_id", fundId)
    .single();

  if (filingError || !filing) {
    throw new Error(`Filing not found: ${filingId}`);
  }

  // Vérifier que le CIK est présent
  if (!filing.cik) {
    // Récupérer le CIK du fund si manquant
    const { data: fund } = await supabase
      .from("funds")
      .select("cik")
      .eq("id", fundId)
      .single();

    if (!fund?.cik) {
      throw new Error(`No CIK found for filing ${filingId} or fund ${fundId}`);
    }

    // Mettre à jour le CIK du filing
    await supabase
      .from("fund_filings")
      .update({ cik: fund.cik })
      .eq("id", filingId);

    filing.cik = fund.cik;
  }

  // Construire l'URL du filing
  const filingUrl = filing.raw_storage_path || buildFilingUrl(filing.cik, filing.accession_number);

  // Publier l'événement EventBridge pour déclencher le parser
  await eventBridge.send(new PutEventsCommand({
    Entries: [{
      Source: "adel.signals",
      DetailType: "13F Discovered",
      Detail: JSON.stringify({
        fund_id: fundId,
        filing_id: filingId,
        cik: filing.cik,
        accession_number: filing.accession_number,
        filing_url: filingUrl,
      }),
      EventBusName: EVENT_BUS_NAME,
    }],
  }));

  // Remettre le statut à DISCOVERED pour indiquer qu'on a re-déclenché le parsing
  await supabase
    .from("fund_filings")
    .update({ 
      status: "DISCOVERED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", filingId);

  return {
    message: "Filing parsing triggered",
    filing_id: filingId,
    accession_number: filing.accession_number,
    cik: filing.cik,
    filing_url: filingUrl,
  };
}

/**
 * Découvrir les filings d'un fond pour un CIK spécifique
 * Découvre les filings depuis EDGAR et les insère en base
 * Le parsing se fait automatiquement via EventBridge
 */
async function discoverFilings(fundId: number, cik: string) {
  console.log(`Discovering filings for fund ${fundId} (CIK: ${cik})`);

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
      const rssUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${encodeURIComponent(formType)}&dateb=&owner=include&count=40&output=atom`;
      
      const response = await fetch(rssUrl, {
        headers: {
          "User-Agent": "ADEL AI (contact@adel.ai)",
        },
      });

      if (!response.ok) {
        // Certains types peuvent ne pas exister pour certains funds, c'est OK
        if (response.status === 404 || response.status === 400) {
          console.log(`No ${formType} filings found (status: ${response.status})`);
          continue;
        }
        throw new Error(`EDGAR API error for ${formType}: ${response.status}`);
      }

      const xml = await response.text();
      const entries = parseEDGARFeed(xml);
      console.log(`Found ${entries.length} ${formType} entries`);
      
      // Merger les résultats (éviter les doublons par accession_number)
      const existingAccessions = new Set(allEntries.map(e => extractAccessionNumber(e.link)));
      for (const entry of entries) {
        const accNum = extractAccessionNumber(entry.link);
        if (accNum && !existingAccessions.has(accNum)) {
          allEntries.push(entry);
        }
      }
    } catch (error: any) {
      console.error(`Error fetching ${formType}:`, error.message);
      // Continue avec les autres types
    }
  }

  console.log(`Found ${allEntries.length} total filings in EDGAR feed`);
  
  // Filtrer pour ne garder que les formulaires pertinents (exclure Form 4, etc.)
  const relevantEntries = allEntries.filter(entry => {
    const detectedType = determineFormType(entry.title, entry.link);
    return detectedType !== null && isRelevantFormType(detectedType);
  });
  
  console.log(`Filtered to ${relevantEntries.length} relevant filings (excluded Form 4, etc.)`);
  
  const entries = relevantEntries;

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
    // Déterminer le type de form depuis le titre/link
    const detectedFormType = determineFormType(entry.title, entry.link);
    
    if (!detectedFormType || !isRelevantFormType(detectedFormType)) {
      console.log(`Skipping irrelevant filing ${accessionNumber} (type: ${detectedFormType || 'unknown'})`);
      continue;
    }
    
    const formType = detectedFormType;

    // Insérer le filing avec le CIK (important pour les requêtes directes par CIK)
    // Architecture Extreme Budget: S3 uniquement, pas de Supabase
    if (process.env.USE_S3_WRITES !== 'true' && process.env.USE_S3_WRITES !== '1') {
      throw new Error('USE_S3_WRITES must be enabled. Supabase is no longer supported.');
    }

    // Créer le filing dans S3
    console.log(`[S3 Write] Inserting filing ${accessionNumber} directly to S3...`);
    const insertedFiling = await insertRowS3('fund_filings', {
      fund_id: fundId,
      cik: cik,
      accession_number: accessionNumber,
      form_type: formType,
      filing_date: extractDate(entry.updated),
      status: "DISCOVERED",
    });
    const filing = {
      id: insertedFiling.id,
      fund_id: fundId,
      cik: cik,
      accession_number: accessionNumber,
      form_type: formType,
      filing_date: extractDate(entry.updated),
      status: "DISCOVERED",
    };
    console.log(`[S3 Write] Filing created on S3: ${accessionNumber} (ID: ${filing.id})`);

    discoveredFilings.push(filing);

    // Déclencher le parser via EventBridge
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
 * Parser un filing spécifique (déclenche le parser via EventBridge)
 * Responsabilité unique : déclencher le parsing d'un filing
 */
export async function parseFiling(filingId: number, fundId: number, cik: string, accessionNumber: string, filingUrl: string) {
  console.log(`[DEBUG] Parsing filing ${filingId} (accession: ${accessionNumber})`);

  // Déclencher le parser via EventBridge
  await eventBridge.send(new PutEventsCommand({
    Entries: [{
      Source: "adel.signals",
      DetailType: "13F Discovered",
      Detail: JSON.stringify({
        fund_id: fundId,
        filing_id: filingId,
        cik: cik,
        accession_number: accessionNumber,
        filing_url: filingUrl,
      }),
      EventBusName: EVENT_BUS_NAME,
    }],
  }));

  console.log(`[SUCCESS] Event published for filing ${accessionNumber}`);

  return {
    filing_id: filingId,
    accession_number: accessionNumber,
    message: "Parsing event published successfully.",
  };
}


/**
 * Lister tous les fonds
 */
/**
 * Lister tous les funds
 * 
 * Architecture Extreme Budget: Utilise Athena pour les lectures
 */
export async function getFunds() {
  const useAthena = process.env.USE_ATHENA === 'true' || process.env.USE_ATHENA === '1';

  if (useAthena) {
    try {
      const funds = await getFundsAthena(100);
      // Trier par tier_influence puis created_at (comme Supabase)
      return funds.sort((a, b) => {
        if (b.tier_influence !== a.tier_influence) {
          return b.tier_influence - a.tier_influence;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } catch (error: any) {
      console.error('[Athena] Error fetching funds:', error.message);
      throw error;
    }
  }

  // Fallback: Utiliser Supabase (temporaire, à supprimer après migration complète)
  console.log("[getFunds] Starting query to Supabase");
  console.log("[getFunds] Supabase client:", supabase ? "initialized" : "NOT INITIALIZED");
  
  try {
    console.log("[getFunds] Executing Supabase query...");
    const { data, error } = await supabase
      .from("funds")
      .select("*")
      .order("tier_influence", { ascending: false })
      .order("created_at", { ascending: false });

    console.log("[getFunds] Query completed. Error:", error ? JSON.stringify(error) : "none");
    console.log("[getFunds] Data length:", data?.length || 0);

    if (error) {
      console.error("[getFunds] Supabase error code:", error.code);
      console.error("[getFunds] Supabase error message:", error.message);
      console.error("[getFunds] Supabase error details:", JSON.stringify(error));
      throw error;
    }

    console.log(`[getFunds] Successfully retrieved ${data?.length || 0} funds`);
    return data || [];
  } catch (e: any) {
    console.error("[getFunds] Exception caught:");
    console.error("[getFunds] Error name:", e?.name);
    console.error("[getFunds] Error message:", e?.message);
    console.error("[getFunds] Error code:", e?.code);
    console.error("[getFunds] Error stack:", e?.stack);
    console.error("[getFunds] Full error:", JSON.stringify(e, Object.getOwnPropertyNames(e)));
    throw e;
  }
}

/**
 * Helper: Résoudre un CIK ou ID en fund ID
 * Supporte les deux formats pour compatibilité
 */
export async function resolveFundId(cikOrId: string): Promise<number> {
  // Architecture Extreme Budget: Athena uniquement, pas de Supabase
  if (process.env.USE_ATHENA !== 'true' && process.env.USE_ATHENA !== '1') {
    throw new Error('USE_ATHENA must be enabled. Supabase is no longer supported.');
  }

  // Si c'est un nombre, essayer comme ID d'abord
  if (/^\d+$/.test(cikOrId)) {
    const fundById = await getFund(parseInt(cikOrId));
    if (fundById) {
      return fundById.id;
    }
  }
  
  // Sinon, chercher par CIK (Athena uniquement)
  const fund = await getFundByCikAthena(cikOrId);
  if (!fund) {
    throw new Error(`Fund with CIK ${cikOrId} not found`);
  }
  
  return fund.id;
}

/**
 * Obtenir un fond par CIK
 */
export async function getFundByCik(cik: string) {
  // Architecture Extreme Budget: Athena uniquement, pas de Supabase
  if (process.env.USE_ATHENA !== 'true' && process.env.USE_ATHENA !== '1') {
    throw new Error('USE_ATHENA must be enabled. Supabase is no longer supported.');
  }

  // Chercher par CIK (Athena uniquement)
  return await getFundByCikAthena(cik);
}

/**
 * Obtenir un fond par ID
 * 
 * Architecture Extreme Budget: Utilise S3 direct read pour les lectures
 */
export async function getFund(id: number) {
  // Architecture Extreme Budget: Athena uniquement, pas de Supabase
  if (process.env.USE_ATHENA !== 'true' && process.env.USE_ATHENA !== '1') {
    throw new Error('USE_ATHENA must be enabled. Supabase is no longer supported.');
  }

  // Récupérer le fund depuis Athena
  return await getFundByIdAthena(id);
}

/**
 * Obtenir les holdings d'un fond
 * Note: Utilise getFundPortfolioDeduplicated() pour éviter le double comptage avec plusieurs CIK
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
 * 
 * Architecture Extreme Budget: Utilise Athena pour les lectures
 */
export async function getFundFilings(fundId: number) {
  const useAthena = process.env.USE_ATHENA === 'true' || process.env.USE_ATHENA === '1';

  if (useAthena) {
    try {
      const filings = await getFundFilingsAthena(fundId);
      console.log(`[Athena] Retrieved ${filings.length} filings for fund ${fundId}`);
      return filings;
    } catch (athenaError: any) {
      console.error(`[Athena] Error fetching fund filings for fund ${fundId}, falling back to Supabase: ${athenaError.message}`);
      // Fallback to Supabase if Athena fails
    }
  }

  // Fallback: Utiliser Supabase (temporaire, à supprimer après migration complète)
  const { data, error } = await supabase
    .from("fund_filings")
    .select("*")
    .eq("fund_id", fundId)
    .order("filing_date", { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Obtenir un filing spécifique avec ses détails
 * 
 * Architecture Extreme Budget: Utilise Athena pour les lectures
 */
export async function getFundFiling(fundId: number, filingId: number) {
  const useAthena = process.env.USE_ATHENA === 'true' || process.env.USE_ATHENA === '1';

  if (useAthena) {
    try {
      const filing = await getFundFilingByIdAthena(fundId, filingId);
      if (filing) {
        console.log(`[Athena] Found filing ${filingId} for fund ${fundId} via Athena`);
        return filing;
      }
      // Si non trouvé, throw 404
      const error = new Error(`Filing ${filingId} not found for fund ${fundId}`);
      (error as any).statusCode = 404;
      throw error;
    } catch (athenaError: any) {
      console.error(`[Athena] Error fetching filing ${filingId} for fund ${fundId}, falling back to Supabase: ${athenaError.message}`);
      // Si c'est une 404, la propager
      if (athenaError.statusCode === 404) {
        throw athenaError;
      }
      // Sinon, fallback to Supabase
    }
  }

  // Fallback: Utiliser Supabase (temporaire, à supprimer après migration complète)
  const { data, error } = await supabase
    .from("fund_filings")
    .select("*")
    .eq("id", filingId)
    .eq("fund_id", fundId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      const notFoundError = new Error(`Filing ${filingId} not found for fund ${fundId}`);
      (notFoundError as any).statusCode = 404;
      throw notFoundError;
    }
    throw error;
  }
  return data;
}

/**
 * Obtenir les holdings d'un filing spécifique
 */
export async function getFilingHoldings(fundId: number, filingId: number, limit = 1000) {
  // Vérifier que le filing appartient au fund
  const { data: filing, error: filingError } = await supabase
    .from("fund_filings")
    .select("id, status, filing_date, form_type")
    .eq("id", filingId)
    .eq("fund_id", fundId)
    .single();

  if (filingError || !filing) {
    throw new Error(`Filing ${filingId} not found for fund ${fundId}`);
  }

  // Récupérer les holdings
  const { data: holdings, error: holdingsError } = await supabase
    .from("fund_holdings")
    .select("*")
    .eq("filing_id", filingId)
    .eq("fund_id", fundId)
    .order("market_value", { ascending: false })
    .limit(limit);

  if (holdingsError) throw holdingsError;

  return {
    filing: {
      id: filing.id,
      filing_date: filing.filing_date,
      form_type: filing.form_type,
      status: filing.status,
    },
    holdings: holdings || [],
    total_holdings: holdings?.length || 0,
    total_market_value: holdings?.reduce((sum, h) => sum + (h.market_value || 0), 0) || 0,
  };
}

/**
 * Obtenir les différences de holdings entre filings
 * Supporte plusieurs modes de comparaison :
 * - Par défaut : retourne tous les diffs calculés
 * - from_date/to_date : compare deux dates spécifiques
 * - quarter/year : compare deux trimestres
 */
export async function getFundDiffs(
  fundId: number, 
  limit = 50,
  options?: {
    from_date?: string;  // Date du filing de référence (ancien) - format YYYY-MM-DD
    to_date?: string;     // Date du filing à comparer (nouveau) - format YYYY-MM-DD
    quarter?: string;     // Format: "Q1-2024" ou "2024-Q1"
    year?: number;        // Année pour comparaison annuelle
    compare_to?: string;  // Date de référence pour comparaison (si quarter ou year)
    ticker?: string;      // Filtrer par ticker spécifique
  }
) {
  // Si des dates ou périodes sont spécifiées, calculer le diff dynamiquement
  if (options?.from_date && options?.to_date) {
    // Calculer le diff entre deux dates spécifiques
    const { calculateFundDiff } = await import("./services/fund-diff.service");
    const result = await calculateFundDiff(fundId, undefined, {
      from_date: options.from_date,
      to_date: options.to_date,
    });
    return result.diffs;
  }

  // Si quarter/year est spécifié, convertir en dates
  if (options?.quarter || options?.year) {
    const { calculateFundDiff } = await import("./services/fund-diff.service");
    
    let fromDate: string | undefined;
    let toDate: string | undefined;

    if (options.quarter) {
      // Parser "Q1-2024" ou "2024-Q1"
      const match = options.quarter.match(/(?:Q(\d)-)?(\d{4})/);
      if (!match) throw new Error("Invalid quarter format. Use 'Q1-2024' or '2024-Q1'");
      
      const quarter = parseInt(match[1] || "1");
      const year = parseInt(match[2]);
      
      // Dates de début et fin du trimestre
      const quarterStartMonths = [0, 3, 6, 9]; // Jan, Apr, Jul, Oct
      const startMonth = quarterStartMonths[quarter - 1];
      const endMonth = startMonth + 2;
      
      // Date de fin du trimestre (dernier jour du trimestre)
      const endDate = new Date(year, endMonth + 1, 0); // Dernier jour du mois
      toDate = endDate.toISOString().split('T')[0];
      
      // Date de début du trimestre précédent (pour comparaison)
      const prevQuarter = quarter === 1 ? 4 : quarter - 1;
      const prevYear = quarter === 1 ? year - 1 : year;
      const prevStartMonth = quarterStartMonths[prevQuarter - 1];
      const prevEndMonth = prevStartMonth + 2;
      const prevEndDate = new Date(prevYear, prevEndMonth + 1, 0);
      fromDate = prevEndDate.toISOString().split('T')[0];
    } else if (options.year) {
      // Comparaison annuelle : fin de l'année vs fin de l'année précédente
      toDate = `${options.year}-12-31`;
      fromDate = `${options.year - 1}-12-31`;
    }

    if (fromDate && toDate) {
      const result = await calculateFundDiff(fundId, undefined, {
        from_date: fromDate,
        to_date: toDate,
      });
      // Filtrer par ticker si spécifié
      let diffs = result.diffs;
      if (options?.ticker) {
        diffs = diffs.filter(d => d.ticker?.toUpperCase() === options.ticker!.toUpperCase());
      }
      return diffs;
    }
  }

  // Par défaut : retourner les diffs calculés en base
  const useAthena = process.env.USE_ATHENA === 'true' || process.env.USE_ATHENA === '1';

  if (useAthena) {
    try {
      // Utiliser Athena pour lire les diffs pré-calculés
      const diffs = await getFundDiffsAthena(fundId, limit, options?.ticker);
      console.log(`[Athena] Retrieved ${diffs.length} diffs for fund ${fundId}`);
      
      // Note: Les relations avec fund_filings ne sont pas incluses dans Athena
      // Si nécessaire, faire des requêtes séparées pour enrichir les données
      return diffs as any; // Cast pour compatibilité avec l'interface existante
    } catch (athenaError: any) {
      console.error(`[Athena] Error fetching fund diffs for fund ${fundId}, falling back to Supabase: ${athenaError.message}`);
      // Fallback to Supabase if Athena fails
    }
  }

  // Fallback: Utiliser Supabase (temporaire, à supprimer après migration complète)
  let query = supabase
    .from("fund_holdings_diff")
    .select(`
      *,
      filing_new:fund_filings!filing_id_new(filing_date, form_type),
      filing_old:fund_filings!filing_id_old(filing_date, form_type)
    `)
    .eq("fund_id", fundId);

  // Filtrer par ticker si spécifié
  if (options?.ticker) {
    query = query.eq("ticker", options.ticker.toUpperCase());
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  
  // Si aucun diff trouvé en base, calculer automatiquement entre les deux derniers filings
  if (!data || data.length === 0) {
    const { calculateFundDiff } = await import("./services/fund-diff.service");
    
    // Récupérer les deux derniers filings parsés
    const { data: filings, error: filingsError } = await supabase
      .from("fund_filings")
      .select("id, filing_date")
      .eq("fund_id", fundId)
      .eq("status", "PARSED")
      .order("filing_date", { ascending: false })
      .limit(2);
    
    if (filingsError) throw filingsError;
    
    // Si on a au moins 2 filings, calculer le diff entre les deux derniers
    if (filings && filings.length >= 2) {
      const latestFiling = filings[0];
      const previousFiling = filings[1];
      
      try {
        const result = await calculateFundDiff(fundId, latestFiling.id);
        
        // Filtrer par ticker si spécifié
        let diffs = result.diffs;
        if (options?.ticker) {
          diffs = diffs.filter(d => d.ticker?.toUpperCase() === options.ticker!.toUpperCase());
        }
        
        // Limiter les résultats
        return diffs.slice(0, limit);
      } catch (calcError: any) {
        // Si le calcul échoue, retourner un tableau vide plutôt que de throw
        console.error(`Error calculating diff for fund ${fundId}:`, calcError);
        return [];
      }
    }
    
    // Si moins de 2 filings, retourner un tableau vide
    return [];
  }
  
  return data;
}

/**
 * Obtenir les différences pour un ticker spécifique
 */
export async function getFundTickerDiffs(fundId: number, ticker: string) {
  const { data, error } = await supabase
    .from("fund_holdings_diff")
    .select(`
      *,
      filing_new:fund_filings!filing_id_new(filing_date, form_type),
      filing_old:fund_filings!filing_id_old(filing_date, form_type)
    `)
    .eq("fund_id", fundId)
    .eq("ticker", ticker.toUpperCase())
    .order("created_at", { ascending: false });

  if (error) throw error;
  
  // Si aucun diff trouvé en base, calculer automatiquement entre les deux derniers filings
  if (!data || data.length === 0) {
    const { calculateFundDiff } = await import("./services/fund-diff.service");
    
    // Récupérer les deux derniers filings parsés
    const { data: filings, error: filingsError } = await supabase
      .from("fund_filings")
      .select("id, filing_date")
      .eq("fund_id", fundId)
      .eq("status", "PARSED")
      .order("filing_date", { ascending: false })
      .limit(2);
    
    if (filingsError) throw filingsError;
    
    // Si on a au moins 2 filings, calculer le diff entre les deux derniers
    if (filings && filings.length >= 2) {
      const latestFiling = filings[0];
      
      try {
        const result = await calculateFundDiff(fundId, latestFiling.id);
        
        // Filtrer par ticker
        const tickerDiffs = result.diffs.filter(d => d.ticker?.toUpperCase() === ticker.toUpperCase());
        return tickerDiffs;
      } catch (calcError: any) {
        // Si le calcul échoue, retourner un tableau vide plutôt que de throw
        console.error(`Error calculating diff for fund ${fundId} and ticker ${ticker}:`, calcError);
        return [];
      }
    }
    
    // Si moins de 2 filings, retourner un tableau vide
    return [];
  }
  
  return data;
}

/**
 * Obtenir les changements récents (nouveautés, sorties, augmentations importantes)
 */
export async function getFundRecentChanges(fundId: number, minChangePct = 10, days?: number) {
  // Récupérer tous les changements pertinents
  // Note: Pour "new", diff_pct_shares est toujours null (pas de valeur précédente)
  // Donc on filtre après récupération pour les actions "increase" et "decrease"
  let query = supabase
    .from("fund_holdings_diff")
    .select(`
      *,
      filing_new:fund_filings!filing_id_new(filing_date, form_type)
    `)
    .eq("fund_id", fundId)
    .or(`action.eq.new,action.eq.exit,action.eq.increase,action.eq.decrease`);

  // Note: On ne filtre PAS par created_at ici, car les diffs peuvent avoir été créés récemment
  // même si les filings sont anciens. On filtre par filing_date après la récupération.

  query = query.order("created_at", { ascending: false }).limit(500);

  const { data, error } = await query;

  if (error) throw error;

  // Si aucun diff trouvé en base, calculer automatiquement entre les deux derniers filings
  if (!data || data.length === 0) {
    const { calculateFundDiff } = await import("./services/fund-diff.service");
    
    // Récupérer les deux derniers filings parsés
    const { data: filings, error: filingsError } = await supabase
      .from("fund_filings")
      .select("id, filing_date")
      .eq("fund_id", fundId)
      .eq("status", "PARSED")
      .order("filing_date", { ascending: false })
      .limit(2);
    
    if (filingsError) throw filingsError;
    
    // Si on a au moins 2 filings, calculer le diff entre les deux derniers
    if (filings && filings.length >= 2) {
      const latestFiling = filings[0];
      
      try {
        const result = await calculateFundDiff(fundId, latestFiling.id);
        
        // Transformer les diffs en format compatible avec fund_holdings_diff
        // Note: calculateFundDiff retourne diff_shares_pct, mais fund_holdings_diff utilise diff_pct_shares
        // La structure doit correspondre à ce qui est retourné depuis la table fund_holdings_diff
        const changes = result.diffs
          .map((diff: any) => {
            // Construire la structure exacte attendue (format fund_holdings_diff)
            // Note: La table fund_holdings_diff n'a pas shares_old/shares_new, seulement diff_shares
            return {
              id: diff.filing_id_new * 1000 + Math.floor(Math.random() * 1000), // ID temporaire pour correspondre à la structure
              fund_id: fundId,
              ticker: diff.ticker,
              action: diff.action,
              diff_shares: diff.diff_shares,
              diff_value: diff.diff_value || null,
              diff_pct_shares: diff.diff_shares_pct, // Mapper diff_shares_pct vers diff_pct_shares
              filing_id_new: diff.filing_id_new,
              filing_id_old: diff.filing_id_old,
              created_at: new Date().toISOString(),
              filing_new: {
                filing_date: result.filing_date_new,
                form_type: null, // Pas disponible dans le résultat
              },
            };
          })
          .filter((diff: any) => {
            // Filtrer par date si days est fourni
            if (days && result.filing_date_new) {
              const filingDate = new Date(result.filing_date_new);
              const cutoffDate = new Date();
              cutoffDate.setDate(cutoffDate.getDate() - days);
              if (filingDate < cutoffDate) {
                return false;
              }
            }
            
            // Toujours inclure "new" et "exit"
            if (diff.action === 'new' || diff.action === 'exit') {
              return true;
            }
            
            // Pour "increase" et "decrease", vérifier le pourcentage
            // Utiliser diff_pct_shares (qui vient de diff_shares_pct)
            if (diff.action === 'increase' && diff.diff_pct_shares !== null && diff.diff_pct_shares !== undefined) {
              return diff.diff_pct_shares >= minChangePct;
            }
            
            if (diff.action === 'decrease' && diff.diff_pct_shares !== null && diff.diff_pct_shares !== undefined) {
              return Math.abs(diff.diff_pct_shares) >= minChangePct;
            }
            
            // Si diff_pct_shares est null pour increase/decrease, exclure
            return false;
          });
        
        // Limiter les résultats et trier par diff_shares absolu (comme dans calculateFundDiff)
        return changes
          .sort((a: any, b: any) => Math.abs(b.diff_shares) - Math.abs(a.diff_shares))
          .slice(0, 100);
      } catch (calcError: any) {
        // Si le calcul échoue, retourner un tableau vide plutôt que de throw
        console.error(`Error calculating changes for fund ${fundId}:`, calcError);
        return [];
      }
    }
    
    // Si moins de 2 filings, retourner un tableau vide
    return [];
  }

  // Filtrer côté application pour gérer correctement les null et les dates
  const filtered = (data || []).filter((diff: any) => {
    // Si days est fourni, vérifier la date de création du diff (quand il a été calculé)
    // plutôt que la date du filing, car les diffs peuvent être calculés récemment
    // à partir de filings anciens (ex: on calcule les diffs entre 2 filings de 2025 aujourd'hui)
    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      // Utiliser created_at du diff (quand le diff a été calculé)
      const diffCreatedAt = diff.created_at ? new Date(diff.created_at) : null;
      if (diffCreatedAt && diffCreatedAt >= cutoffDate) {
        // Le diff est récent, on l'inclut
      } else {
        // Le diff n'est pas récent, l'exclure
        return false;
      }
    }
    
    // Toujours inclure "new" et "exit"
    if (diff.action === 'new' || diff.action === 'exit') {
      return true;
    }
    
    // Pour "increase" et "decrease", vérifier le pourcentage
    if (diff.action === 'increase' && diff.diff_pct_shares !== null) {
      return diff.diff_pct_shares >= minChangePct;
    }
    
    if (diff.action === 'decrease' && diff.diff_pct_shares !== null) {
      return Math.abs(diff.diff_pct_shares) >= minChangePct;
    }
    
    // Si diff_pct_shares est null pour increase/decrease, exclure
    return false;
  });

  return filtered.slice(0, 100); // Limiter à 100 après filtrage
}

/**
 * Obtenir les changements récents pour TOUS les funds (analyse globale)
 * Retourne tous les changements significatifs de tous les funds suivis
 */
export async function getAllFundsRecentChanges(minChangePct = 10, limit = 200, days?: number) {
  const useAthena = process.env.USE_ATHENA === 'true' || process.env.USE_ATHENA === '1';

  if (useAthena) {
    try {
      console.log(`[Athena] Fetching all funds recent changes via Athena`);
      return await getAllFundsRecentChangesAthena(minChangePct, limit, days);
    } catch (athenaError: any) {
      console.error(`[Athena] Error fetching all funds recent changes, falling back to Supabase: ${athenaError.message}`);
      // Fallback to Supabase if Athena fails
    }
  }

  // Construire la requête de base
  // Note: La syntaxe Supabase pour les jointures utilise le nom de la clé étrangère
  // Si aucune clé nommée n'existe, on utilise simplement le nom de la table
  let query = supabase
    .from("fund_holdings_diff")
    .select(`
      *,
      filing_new:fund_filings!filing_id_new(filing_date, form_type),
      filing_old:fund_filings!filing_id_old(filing_date, form_type),
      funds!fund_holdings_diff_fund_id_fkey(id, name, cik, tier_influence, category)
    `);

  // Filtrer par date si spécifié (derniers N jours)
  if (days && days > 0) {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);
    query = query.gte("created_at", dateThreshold.toISOString());
  }

  // Filtrer par critères significatifs
  // Note: Pour "new", diff_pct_shares est toujours null (pas de valeur précédente)
  // On récupère d'abord toutes les actions, puis on filtre côté application
  query = query
    .or(`action.eq.new,action.eq.exit,action.eq.increase,action.eq.decrease`)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit * 3, 1000)); // Récupérer plus pour filtrer après

  const { data, error } = await query;

  if (error) throw error;

  // Filtrer côté application pour gérer correctement les null et minChangePct
  const filtered = (data || []).filter((diff: any) => {
    // Toujours inclure "new" et "exit"
    if (diff.action === 'new' || diff.action === 'exit') {
      return true;
    }
    
    // Pour "increase" et "decrease", vérifier le pourcentage
    if (diff.action === 'increase' && diff.diff_pct_shares !== null) {
      return diff.diff_pct_shares >= minChangePct;
    }
    
    if (diff.action === 'decrease' && diff.diff_pct_shares !== null) {
      return Math.abs(diff.diff_pct_shares) >= minChangePct;
    }
    
    // Si diff_pct_shares est null pour increase/decrease, exclure
    return false;
  });

  // Enrichir les données avec les informations du fund (simplifier la structure)
  // Gérer le cas où la jointure Supabase retourne un tableau ou un objet
  const enriched = filtered
    .filter((diff: any) => diff && diff.id && diff.fund_id) // Filtrer les null/undefined et éléments sans ID/fund_id
    .map((diff: any) => {
      try {
        // La jointure Supabase peut retourner un tableau ou un objet selon la cardinalité
        let fund: any = {};
        if (diff.funds) {
          fund = Array.isArray(diff.funds) ? diff.funds[0] || {} : diff.funds;
        }
        
        // Si le fund est toujours vide, utiliser le fund_id comme fallback
        if (!fund.id && diff.fund_id) {
          fund = { id: diff.fund_id };
        }
        
        const filingNew = diff.filing_new || {};
        
        // Retirer la redondance : ne garder que "fund" (pas "funds")
        const { funds, ...diffWithoutFunds } = diff;
        
        return {
          ...diffWithoutFunds,
          fund: {
            id: fund.id || diff.fund_id,
            name: fund.name || 'Unknown',
            cik: fund.cik || '',
            tier_influence: fund.tier_influence || 0,
            category: fund.category || '',
          },
          filing_date: filingNew.filing_date || diff.created_at?.split('T')[0],
          form_type: filingNew.form_type,
        };
      } catch (e) {
        console.error('Error enriching diff:', e, diff);
        return null;
      }
    })
    .filter((item: any) => item !== null && item !== undefined && item.id); // Filtrer les éléments null/undefined après mapping

  // Vérifier que enriched contient des éléments valides
  if (!enriched || enriched.length === 0) {
    return {
      stats: {
        total_changes: 0,
        by_action: { exit: 0, new: 0, increase: 0, decrease: 0 },
        by_fund: {},
      },
      changes: [],
    };
  }

  // Trier par priorité : Exit > New > Changements importants
  enriched.sort((a: any, b: any) => {
    if (!a || !b) return 0; // Protection contre null/undefined
    
    // Priorité 1: Exit (critical)
    if (a.action === 'exit' && b.action !== 'exit') return -1;
    if (b.action === 'exit' && a.action !== 'exit') return 1;
    
    // Priorité 2: New (high)
    if (a.action === 'new' && b.action !== 'new' && b.action !== 'exit') return -1;
    if (b.action === 'new' && a.action !== 'new' && a.action !== 'exit') return 1;
    
    // Priorité 3: Changements par pourcentage (absolu) - seulement si non null
    const aPct = a.diff_pct_shares !== null ? Math.abs(a.diff_pct_shares) : 0;
    const bPct = b.diff_pct_shares !== null ? Math.abs(b.diff_pct_shares) : 0;
    if (aPct !== bPct) return bPct - aPct;
    
    // Priorité 4: Date de création (plus récent d'abord)
    try {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } catch {
      return 0;
    }
  });

  // Filtrer à nouveau après tri (au cas où le tri aurait introduit des null)
  const validEnriched = enriched.filter((item: any) => item !== null && item !== undefined && item.id);

  // Limiter après filtrage et tri
  const limited = validEnriched.slice(0, limit);

  // Statistiques globales (sur les résultats limités réels)
  const finalChanges = limited.filter((d: any) => d !== null && d !== undefined && d.id);

  const stats = {
    total_changes: finalChanges.length,
    by_action: {
      exit: finalChanges.filter((d: any) => d.action === 'exit').length,
      new: finalChanges.filter((d: any) => d.action === 'new').length,
      increase: finalChanges.filter((d: any) => d.action === 'increase').length,
      decrease: finalChanges.filter((d: any) => d.action === 'decrease').length,
    },
    by_fund: {} as Record<string, number>,
  };

  // Compter les changements par fund
  finalChanges.forEach((diff: any) => {
    if (diff && diff.fund && diff.fund.name) {
      const fundName = diff.fund.name;
      stats.by_fund[fundName] = (stats.by_fund[fundName] || 0) + 1;
    }
  });

  return {
    stats,
    changes: finalChanges,
  };
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

