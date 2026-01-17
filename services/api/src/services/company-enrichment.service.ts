/**
 * Service d'enrichissement automatique des entreprises depuis FMP
 * Crée ou met à jour les entreprises dans la table companies avec leurs secteurs
 */

import { supabase } from "../supabase";
import { getFMPSECCompanyFullProfile } from "../fmp";
import { logger } from "../utils/logger";
import { insertRowS3 } from "../athena/write";
import { getCompanyByTickerAthena, getCompanyByCikAthena } from "../athena/companies";

const log = logger.child({ service: "CompanyEnrichment" });

export interface CompanyEnrichmentResult {
  ticker: string;
  created: boolean;
  updated: boolean;
  sector: string | null;
  industry: string | null;
  error?: string;
}

/**
 * Enrichit une entreprise depuis FMP et la crée/met à jour dans la table companies
 * @param ticker - Le ticker de l'entreprise (ex: "AAPL")
 * @param cik - Le CIK optionnel (pour améliorer la recherche)
 * @returns Résultat de l'enrichissement
 */
export async function enrichCompanyFromFMP(
  ticker: string,
  cik?: string
): Promise<CompanyEnrichmentResult> {
  const upperTicker = ticker.toUpperCase().trim();
  
  try {
    log.info(`Enriching company ${upperTicker} from FMP`, { cik });

    // 1. Récupérer le profil complet depuis FMP
    const profileResponse = await getFMPSECCompanyFullProfile({
      symbol: upperTicker,
      cik: cik,
    });

    if (!profileResponse?.data || profileResponse.data.length === 0) {
      log.warn(`No FMP profile found for ${upperTicker}`);
      return {
        ticker: upperTicker,
        created: false,
        updated: false,
        sector: null,
        industry: null,
        error: "No profile found in FMP",
      };
    }

    const profile = profileResponse.data[0];
    
    // 2. Extraire les informations pertinentes
    const companyData = {
      ticker: upperTicker,
      cik: profile.cik || cik || null,
      name: profile.registrantName || upperTicker,
      sector: profile.marketSector || null, // FMP utilise "marketSector"
      industry: profile.sicDescription || null, // FMP utilise "sicDescription" pour l'industrie
      market_cap: null, // Sera enrichi séparément si nécessaire
      headquarters_country: profile.country || null,
      headquarters_state: profile.state || profile.stateLocation || null,
    };

    if (!companyData.cik) {
      log.warn(`No CIK found for ${upperTicker}, cannot create company`);
      return {
        ticker: upperTicker,
        created: false,
        updated: false,
        sector: companyData.sector,
        industry: companyData.industry,
        error: "No CIK available",
      };
    }

    // 3. Vérifier si l'entreprise existe déjà
    const useS3Writes = process.env.USE_S3_WRITES === 'true' || process.env.USE_S3_WRITES === '1';
    const useAthenaReads = process.env.USE_ATHENA === 'true' || process.env.USE_ATHENA === '1';
    
    let existing = null;
    let checkError = null;
    
    if (useAthenaReads) {
      try {
        // Chercher par ticker d'abord
        existing = await getCompanyByTickerAthena(upperTicker);
        
        // Si pas trouvé et qu'on a un CIK, chercher par CIK
        if (!existing && companyData.cik) {
          existing = await getCompanyByCikAthena(companyData.cik);
        }
      } catch (athenaError: any) {
        log.warn(`[Athena] Error checking existing company, falling back to Supabase: ${athenaError.message}`);
        // Fallback to Supabase
        const { data: byTicker, error: tickerError } = await supabase
          .from("companies")
          .select("id, ticker, sector, industry")
          .eq("ticker", upperTicker)
          .maybeSingle();
        
        if (tickerError && tickerError.code !== "PGRST116") {
          checkError = tickerError;
        } else if (byTicker) {
          existing = byTicker;
        }
        
        if (!existing && companyData.cik) {
          const { data: byCik, error: cikError } = await supabase
            .from("companies")
            .select("id, ticker, sector, industry")
            .eq("cik", companyData.cik)
            .maybeSingle();
          
          if (cikError && cikError.code !== "PGRST116") {
            checkError = cikError;
          } else if (byCik) {
            existing = byCik;
          }
        }
      }
    } else {
      // Supabase check if Athena reads are not enabled
      const { data: byTicker, error: tickerError } = await supabase
        .from("companies")
        .select("id, ticker, sector, industry")
        .eq("ticker", upperTicker)
        .maybeSingle();
      
      if (tickerError && tickerError.code !== "PGRST116") {
        checkError = tickerError;
        log.error(`Error checking company by ticker: ${tickerError.message}`);
      } else if (byTicker) {
        existing = byTicker;
      }
      
      if (!existing && companyData.cik) {
        const { data: byCik, error: cikError } = await supabase
          .from("companies")
          .select("id, ticker, sector, industry")
          .eq("cik", companyData.cik)
          .maybeSingle();
        
        if (cikError && cikError.code !== "PGRST116") {
          checkError = cikError;
          log.error(`Error checking company by CIK: ${cikError.message}`);
        } else if (byCik) {
          existing = byCik;
        }
      }
    }

    if (checkError) {
      throw checkError;
    }

    let created = false;
    let updated = false;

    if (existing) {
      // 4a. Mettre à jour l'entreprise existante (seulement si secteur/industrie manquants)
      const needsUpdate = 
        (!existing.sector && companyData.sector) ||
        (!existing.industry && companyData.industry);

      if (needsUpdate) {
        const updateData: any = {};
        if (!existing.sector && companyData.sector) {
          updateData.sector = companyData.sector;
        }
        if (!existing.industry && companyData.industry) {
          updateData.industry = companyData.industry;
        }
        if (companyData.headquarters_country) {
          updateData.headquarters_country = companyData.headquarters_country;
        }
        if (companyData.headquarters_state) {
          updateData.headquarters_state = companyData.headquarters_state;
        }

        const { error: updateError } = await supabase
          .from("companies")
          .update(updateData)
          .eq("id", existing.id);

        if (updateError) {
          log.error(`Error updating company: ${updateError.message}`);
          throw updateError;
        }

        updated = true;
        log.info(`Updated company ${upperTicker}`, {
          sector: companyData.sector,
          industry: companyData.industry,
        });
      }
    } else {
      // 4b. Créer une nouvelle entreprise
      if (useS3Writes) {
        try {
          log.info(`[S3 Write] Creating company ${upperTicker} on S3`);
          const insertedCompany = await insertRowS3('companies', {
            ticker: companyData.ticker,
            cik: companyData.cik,
            name: companyData.name,
            sector: companyData.sector,
            industry: companyData.industry,
            market_cap: companyData.market_cap,
            headquarters_country: companyData.headquarters_country,
            headquarters_state: companyData.headquarters_state,
          });
          created = true;
          log.info(`Created company ${upperTicker} on S3`, {
            id: insertedCompany.id,
            sector: companyData.sector,
            industry: companyData.industry,
            cik: companyData.cik,
            s3Key: insertedCompany.s3Key,
          });
        } catch (s3Error: any) {
          log.error(`[S3 Write] Error inserting to S3, falling back to Supabase: ${s3Error.message}`);
          // Fallback to Supabase if S3 write fails
          const { data: newCompanyArray, error: insertError } = await supabase
            .from("companies")
            .insert({
              ticker: companyData.ticker,
              cik: companyData.cik,
              name: companyData.name,
              sector: companyData.sector,
              industry: companyData.industry,
              market_cap: companyData.market_cap,
              headquarters_country: companyData.headquarters_country,
              headquarters_state: companyData.headquarters_state,
            })
            .select();

          if (insertError) {
            log.error(`Error creating company: ${insertError.message}`);
            throw insertError;
          }

          if (!newCompanyArray || newCompanyArray.length === 0) {
            log.error(`Company insert returned no data for ${upperTicker}`);
            throw new Error("Company insert failed: no data returned");
          }

          created = true;
          log.info(`Created company ${upperTicker} (fallback Supabase)`, {
            id: newCompanyArray[0].id,
            sector: companyData.sector,
            industry: companyData.industry,
            cik: companyData.cik,
          });
        }
      } else {
        // Original Supabase insert
        const { data: newCompanyArray, error: insertError } = await supabase
          .from("companies")
          .insert({
            ticker: companyData.ticker,
            cik: companyData.cik,
            name: companyData.name,
            sector: companyData.sector,
            industry: companyData.industry,
            market_cap: companyData.market_cap,
            headquarters_country: companyData.headquarters_country,
            headquarters_state: companyData.headquarters_state,
          })
          .select();

        if (insertError) {
          log.error(`Error creating company: ${insertError.message}`);
          throw insertError;
        }

        if (!newCompanyArray || newCompanyArray.length === 0) {
          log.error(`Company insert returned no data for ${upperTicker}`);
          throw new Error("Company insert failed: no data returned");
        }

        created = true;
        log.info(`Created company ${upperTicker}`, {
          id: newCompanyArray[0].id,
          sector: companyData.sector,
          industry: companyData.industry,
          cik: companyData.cik,
        });
      }
    }

    return {
      ticker: upperTicker,
      created,
      updated,
      sector: companyData.sector,
      industry: companyData.industry,
    };
  } catch (error: any) {
    log.error(`Error enriching company ${upperTicker}:`, error);
    return {
      ticker: upperTicker,
      created: false,
      updated: false,
      sector: null,
      industry: null,
      error: error.message || "Unknown error",
    };
  }
}

/**
 * Enrichit plusieurs entreprises en batch (avec rate limiting pour éviter le throttling)
 * @param tickers - Liste des tickers à enrichir
 * @param cikMap - Map optionnelle ticker -> CIK pour améliorer la recherche
 * @param delayMs - Délai entre chaque requête (défaut: 200ms pour éviter le throttling)
 * @returns Résultats de l'enrichissement
 */
export async function enrichCompaniesBatch(
  tickers: string[],
  cikMap?: Map<string, string>,
  delayMs: number = 200
): Promise<CompanyEnrichmentResult[]> {
  const results: CompanyEnrichmentResult[] = [];
  const uniqueTickers = Array.from(new Set(tickers.map(t => t.toUpperCase().trim())));

  log.info(`Enriching ${uniqueTickers.length} companies from FMP`, {
    delayMs,
  });

  // ✅ OPTIMISATION: Batch query pour éviter N requêtes Supabase
  // Au lieu de 1 requête par ticker, on fait 1 requête batch totale
  const { data: existingCompanies } = await supabase
    .from("companies")
    .select("ticker, sector, industry")
    .in("ticker", uniqueTickers);

  const existingMap = new Map(
    existingCompanies?.map(c => [c.ticker.toUpperCase(), { sector: c.sector, industry: c.industry }]) || []
  );

  for (let i = 0; i < uniqueTickers.length; i++) {
    const ticker = uniqueTickers[i];
    const cik = cikMap?.get(ticker);

    // Vérifier d'abord si l'entreprise existe déjà avec secteur (depuis le map)
    const existing = existingMap.get(ticker);

    if (existing?.sector && existing?.industry) {
      log.debug(`Company ${ticker} already has sector and industry, skipping`);
      results.push({
        ticker,
        created: false,
        updated: false,
        sector: existing.sector,
        industry: existing.industry,
      });
      continue;
    }

    // Enrichir depuis FMP
    const result = await enrichCompanyFromFMP(ticker, cik);
    results.push(result);

    // Délai entre les requêtes pour éviter le throttling
    if (i < uniqueTickers.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const stats = {
    created: results.filter(r => r.created).length,
    updated: results.filter(r => r.updated).length,
    skipped: results.filter(r => !r.created && !r.updated && r.sector).length,
    failed: results.filter(r => r.error).length,
  };

  log.info(`Enrichment batch completed`, stats);

  return results;
}
