/**
 * Service de déduplication pour éviter le double comptage
 * Gère le cas où plusieurs CIK déclarent les mêmes positions
 * 
 * Règle d'or : Utiliser le CIK Primary (Parent) pour le portefeuille total
 */

import { supabase } from "../supabase";

export interface FundPortfolioAggregated {
  fund_id: number;
  fund_name: string;
  primary_cik: string;
  total_holdings: number;
  total_market_value: number;
  filing_date: string | null; // Date du filing utilisé pour le portfolio
  filing_id: number | null; // ID du filing utilisé pour le portfolio
  holdings: Array<{
    ticker: string;
    shares: number;
    market_value: number;
    source_cik: string; // CIK qui a déclaré cette position
    is_primary: boolean; // Vient du CIK primary
  }>;
}

/**
 * Récupère le portefeuille agrégé d'un fund en évitant le double comptage
 * Priorise le CIK Primary (Parent) qui consolide généralement les filiales
 */
export async function getFundPortfolioDeduplicated(
  fundId: number
): Promise<FundPortfolioAggregated> {
  // 1. Récupérer le fund et son CIK primary
  const { data: fund, error: fundError } = await supabase
    .from("funds")
    .select("id, name, cik")
    .eq("id", fundId)
    .single();

  if (fundError || !fund) {
    throw new Error(`Fund ${fundId} not found`);
  }

  // 2. Récupérer tous les CIK du fund
  const { data: fundCiks, error: ciksError } = await supabase
    .from("fund_ciks")
    .select("cik, is_primary, entity_name")
    .eq("fund_id", fundId)
    .order("is_primary", { ascending: false });

  const allCiks = [
    { cik: fund.cik, is_primary: true, entity_name: fund.name },
    ...(fundCiks || []),
  ];

  // 3. Récupérer le dernier filing parsé pour chaque CIK
  // Utiliser celui qui a des holdings (le plus récent avec des holdings)
  const filingsByCik = new Map<string, { id: number; filing_date: string }>();

  for (const cikData of allCiks) {
    // Récupérer les filings parsés, triés par date décroissante
    // D'abord essayer les PARSED, puis les autres statuts si aucun PARSED n'a de holdings
    const { data: parsedFilings, error: parsedFilingsError } = await supabase
      .from("fund_filings")
      .select("id, filing_date, status")
      .eq("fund_id", fundId)
      .eq("cik", cikData.cik)
      .eq("status", "PARSED")
      .order("filing_date", { ascending: false })
      .limit(5);

    let filingsToCheck = parsedFilings || [];

    // Si aucun filing PARSED, essayer les autres statuts (peut-être que le parsing a partiellement réussi)
    if (!parsedFilings || parsedFilings.length === 0) {
      const { data: otherFilings, error: otherFilingsError } = await supabase
        .from("fund_filings")
        .select("id, filing_date, status")
        .eq("fund_id", fundId)
        .eq("cik", cikData.cik)
        .in("status", ["DISCOVERED", "FAILED"])
        .order("filing_date", { ascending: false })
        .limit(5);

      if (!otherFilingsError && otherFilings) {
        filingsToCheck = otherFilings;
      }
    }

    if (filingsToCheck.length > 0) {
      // Trouver le premier filing qui a des holdings
      for (const filing of filingsToCheck) {
        const { count, error: countError } = await supabase
          .from("fund_holdings")
          .select("*", { count: "exact", head: true })
          .eq("filing_id", filing.id)
          .eq("type", "stock");

        const holdingsCount = countError ? 0 : (count || 0);
        
        // Utiliser le premier filing qui a au moins 1 holding
        if (holdingsCount > 0) {
          filingsByCik.set(cikData.cik, { id: filing.id, filing_date: filing.filing_date });
          break; // Prendre le plus récent qui a des holdings
        }
      }
    }
  }

  if (filingsByCik.size === 0) {
    // Debug: Récupérer les stats des filings pour comprendre pourquoi le portfolio est vide
    const { data: allFilings, error: allFilingsError } = await supabase
      .from("fund_filings")
      .select("status, filing_date, cik")
      .eq("fund_id", fundId);

    const filingsStats = {
      total: allFilings?.length || 0,
      by_status: {} as Record<string, number>,
      by_cik: {} as Record<string, { total: number; parsed: number; failed: number; discovered: number }>,
    };

    if (allFilings) {
      for (const filing of allFilings) {
        const status = filing.status || "UNKNOWN";
        filingsStats.by_status[status] = (filingsStats.by_status[status] || 0) + 1;

        const cik = filing.cik || "UNKNOWN";
        if (!filingsStats.by_cik[cik]) {
          filingsStats.by_cik[cik] = { total: 0, parsed: 0, failed: 0, discovered: 0 };
        }
        filingsStats.by_cik[cik].total++;
        if (status === "PARSED") filingsStats.by_cik[cik].parsed++;
        if (status === "FAILED") filingsStats.by_cik[cik].failed++;
        if (status === "DISCOVERED") filingsStats.by_cik[cik].discovered++;
      }
    }

    return {
      fund_id: fundId,
      fund_name: fund.name,
      primary_cik: fund.cik,
      total_holdings: 0,
      total_market_value: 0,
      filing_date: null,
      filing_id: null,
      holdings: [],
      debug: {
        message: "No parsed filings found with holdings",
        filings_stats: filingsStats,
        note: "To fix: Check why filings are not being parsed. Use POST /funds/{id}/filings/{filingId}/retry to retry parsing.",
      },
    };
  }

  // Récupérer la date du filing primary (le plus récent)
  const primaryCikFiling = filingsByCik.get(fund.cik);
  const filingDate = primaryCikFiling?.filing_date || null;
  const primaryFilingId = primaryCikFiling?.id || null;

  // 4. Récupérer les holdings de tous les CIK
  const allHoldings: Array<{
    ticker: string;
    shares: number;
    market_value: number;
    cik: string;
    is_primary: boolean;
  }> = [];

  for (const [cik, filingInfo] of filingsByCik.entries()) {
    const cikData = allCiks.find(c => c.cik === cik);
    // Le CIK primary est soit celui de funds.cik, soit un CIK avec is_primary=true dans fund_ciks
    const isPrimary = cikData?.is_primary ?? (cik === fund.cik);

    const { data: holdings, error: holdingsError } = await supabase
      .from("fund_holdings")
      .select("ticker, shares, market_value")
      .eq("filing_id", filingInfo.id)
      .eq("type", "stock");

    if (!holdingsError && holdings) {
      for (const holding of holdings) {
        if (holding.ticker) {
          allHoldings.push({
            ticker: holding.ticker,
            shares: holding.shares || 0,
            market_value: holding.market_value || 0,
            cik: cik,
            is_primary: isPrimary,
          });
        }
      }
    }
  }

  // 5. Dédupliquer : Prioriser le CIK Primary pour chaque ticker
  const holdingsMap = new Map<string, typeof allHoldings[0]>();

  // D'abord, ajouter toutes les positions du CIK Primary
  for (const holding of allHoldings) {
    if (holding.is_primary) {
      holdingsMap.set(holding.ticker, holding);
    }
  }

  // Ensuite, ajouter les positions des CIK secondaires uniquement si le ticker n'existe pas déjà
  for (const holding of allHoldings) {
    if (!holding.is_primary && !holdingsMap.has(holding.ticker)) {
      holdingsMap.set(holding.ticker, holding);
    }
  }

  // 6. Calculer les totaux
  const holdings = Array.from(holdingsMap.values());
  const totalMarketValue = holdings.reduce((sum, h) => sum + (h.market_value || 0), 0);

  return {
    fund_id: fundId,
    fund_name: fund.name,
    primary_cik: fund.cik,
    total_holdings: holdings.length,
    total_market_value: totalMarketValue,
    filing_date: filingDate,
    filing_id: primaryFilingId,
    holdings: holdings.map(h => ({
      ticker: h.ticker,
      shares: h.shares,
      market_value: h.market_value,
      source_cik: h.cik,
      is_primary: h.is_primary,
    })),
  };
}

/**
 * Récupère les informations de transparence pour un fund (Transparency Mode)
 * Liste tous les CIK et leurs entités légales
 */
export async function getFundTransparencyInfo(fundId: number) {
  const { data: fund, error: fundError } = await supabase
    .from("funds")
    .select("id, name, cik")
    .eq("id", fundId)
    .single();

  if (fundError || !fund) {
    throw new Error(`Fund ${fundId} not found`);
  }

  // Récupérer tous les CIK (exclure le CIK primary s'il est déjà dans fund_ciks)
  const { data: fundCiks, error: ciksError } = await supabase
    .from("fund_ciks")
    .select("cik, entity_name, is_primary, created_at")
    .eq("fund_id", fundId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  // Construire la liste des CIK sans doublons
  // Le CIK primary peut être soit dans funds.cik, soit dans fund_ciks avec is_primary=true
  const cikSet = new Set<string>();
  const allCiks: Array<{
    cik: string;
    entity_name: string;
    is_primary: boolean;
    created_at: string | null;
  }> = [];

  // Ajouter le CIK primary depuis funds.cik
  if (!cikSet.has(fund.cik)) {
    allCiks.push({
      cik: fund.cik,
      entity_name: fund.name,
      is_primary: true,
      created_at: null,
    });
    cikSet.add(fund.cik);
  }

  // Ajouter les CIK supplémentaires (exclure ceux qui sont déjà dans la liste)
  if (fundCiks) {
    for (const cikData of fundCiks) {
      if (!cikSet.has(cikData.cik)) {
        allCiks.push({
          cik: cikData.cik,
          entity_name: cikData.entity_name || fund.name,
          is_primary: cikData.is_primary || false,
          created_at: cikData.created_at,
        });
        cikSet.add(cikData.cik);
      }
    }
  }

  // Pour chaque CIK, récupérer les stats (nombre de filings, dernier filing)
  const ciksWithStats = await Promise.all(
    allCiks.map(async (cikData) => {
      const { data: filings, error: filingsError } = await supabase
        .from("fund_filings")
        .select("id, filing_date, form_type, status")
        .eq("fund_id", fundId)
        .eq("cik", cikData.cik)
        .order("filing_date", { ascending: false })
        .limit(1);

      const lastFiling = filings && filings.length > 0 ? filings[0] : null;

      const { count } = await supabase
        .from("fund_filings")
        .select("*", { count: "exact", head: true })
        .eq("fund_id", fundId)
        .eq("cik", cikData.cik);

      return {
        cik: cikData.cik,
        entity_name: cikData.entity_name || fund.name,
        is_primary: cikData.is_primary,
        total_filings: count || 0,
        last_filing_date: lastFiling?.filing_date || null,
        last_filing_type: lastFiling?.form_type || null,
        last_filing_status: lastFiling?.status || null,
      };
    })
  );

  return {
    fund_id: fundId,
    fund_name: fund.name,
    primary_cik: fund.cik,
    total_ciks: ciksWithStats.length,
    ciks: ciksWithStats,
    note: "Le portefeuille agrégé priorise le CIK Primary pour éviter le double comptage",
  };
}
