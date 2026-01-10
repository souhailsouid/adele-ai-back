import { supabase } from "./supabase";

// Types
interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  timestamp: string;
}

interface Ownership {
  name: string;
  shares: number;
  units: number;
  value: number;
  is_hedge_fund: boolean;
  report_date: string;
  filing_date: string;
  percentage?: number;
}

interface Activity {
  institution_name: string;
  units_change: number;
  change: number;
  avg_price: number;
  buy_price?: number | null;
  sell_price?: number | null;
  filing_date: string;
  report_date: string;
  price_on_filing: number;
  price_on_report: number;
  close: number;
  transaction_type: "BUY" | "SELL";
}

interface InsiderTrade {
  owner_name: string;
  officer_title: string;
  transaction_code: string;
  acquisitionOrDisposition: string;
  amount: number;
  transaction_date: string;
  shares?: number;
  price?: number;
}

interface CongressTrade {
  name: string;
  member_type: string;
  txn_type: string;
  amounts: string;
  transaction_date: string;
}

interface OptionsFlow {
  type: string;
  strike: number;
  total_premium: number;
  premium: number;
  volume: number;
  expiry: string;
  created_at: string;
  open_interest?: number;
}

interface DarkPoolTrade {
  date: string; // Date formatée depuis executed_at
  executed_at: string; // Timestamp ISO de l'API
  volume: number;
  size: number;
  price: number;
  value: number;
  premium?: string;
  ticker?: string;
  market_center?: string;
  canceled?: boolean;
}

// Helpers
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function addHours(hours: number): Date {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date;
}

function addDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// API Clients - Lazy loading pour éviter les erreurs au chargement du module
function getUnusualWhalesApiKey(): string {
  const apiKey = requireEnv("UNUSUAL_WHALES_API_KEY");
  const trimmed = apiKey.trim();
  if (!trimmed || trimmed.length === 0) {
    throw new Error("UNUSUAL_WHALES_API_KEY is empty or contains only whitespace");
  }
  return trimmed;
}

function getFmpApiKey(): string {
  return requireEnv("FMP_API_KEY");
}

const UNUSUAL_WHALES_BASE_URL = "https://api.unusualwhales.com/api";
const FMP_BASE_URL = "https://financialmodelingprep.com/stable";

async function fetchUnusualWhales(endpoint: string): Promise<any> {
  const url = `${UNUSUAL_WHALES_BASE_URL}${endpoint}`;
  const apiKey = getUnusualWhalesApiKey();
  
  console.log(`[fetchUnusualWhales] Calling: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(`[fetchUnusualWhales] Error ${response.status}: ${errorText}`);
    
    // Diagnostic spécial pour les erreurs 401
    if (response.status === 401) {
      console.error(`[fetchUnusualWhales] Authentication error - Token may be invalid or expired`);
      console.error(`[fetchUnusualWhales] Token length: ${apiKey.length}, prefix: ${apiKey.substring(0, 10)}...`);
    }
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded for Unusual Whales API");
    }
    throw new Error(`Unusual Whales API error: ${response.status} ${response.statusText}: ${errorText}`);
  }

  const data = await response.json();
  console.log(`[fetchUnusualWhales] Response type: ${Array.isArray(data) ? 'array' : typeof data}, length: ${Array.isArray(data) ? data.length : 'N/A'}`);
  return data;
}

async function fetchFMP(endpoint: string): Promise<any> {
  // Construire l'URL avec le paramètre apikey
  const apiKey = getFmpApiKey();
  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${FMP_BASE_URL}${endpoint}${separator}apikey=${apiKey}`;
  
  console.log(`[fetchFMP] Calling: ${url.replace(apiKey, "***")}`);
  
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(`[fetchFMP] Error ${response.status}: ${errorText}`);
    if (response.status === 429) {
      throw new Error("Rate limit exceeded for FMP API");
    }
    throw new Error(`FMP API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Cache Helpers
async function getCachedQuote(ticker: string): Promise<Quote | null> {
  const { data, error } = await supabase
    .from("ticker_quotes")
    .select("*")
    .eq("ticker", ticker.toUpperCase())
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) return null;

  return {
    symbol: data.symbol,
    price: parseFloat(data.price || "0"),
    change: parseFloat(data.change || "0"),
    changePercent: parseFloat(data.change_percent || "0"),
    volume: parseInt(data.volume || "0", 10),
    marketCap: parseInt(data.market_cap || "0", 10),
    timestamp: data.cached_at,
  };
}

async function setCachedQuote(ticker: string, quote: Quote, ttlHours: number = 1): Promise<void> {
  await supabase.from("ticker_quotes").upsert({
    ticker: ticker.toUpperCase(),
    symbol: quote.symbol,
    price: quote.price,
    change: quote.change,
    change_percent: quote.changePercent,
    volume: quote.volume,
    market_cap: quote.marketCap,
    data: quote as any,
    expires_at: addHours(ttlHours).toISOString(),
  });
}

// Endpoints
export async function getTickerQuote(ticker: string): Promise<{
  success: boolean;
  data: Quote;
  cached: boolean;
  timestamp: string;
}> {
  // Vérifier le cache
  const cached = await getCachedQuote(ticker);
  if (cached) {
    return {
      success: true,
      data: cached,
      cached: true,
      timestamp: cached.timestamp,
    };
  }
  
  // Appel API FMP - Utiliser le bon endpoint avec paramètre query
  try {
    const fmpData = await fetchFMP(`/quote?symbol=${ticker.toUpperCase()}`);
    // Vérifier si c'est une erreur
    if (fmpData && fmpData["Error Message"]) {
      throw new Error(`FMP API: ${fmpData["Error Message"]}`);
    }
    
    if (!fmpData || !Array.isArray(fmpData) || fmpData.length === 0) {
      throw new Error(`Quote not found for ticker: ${ticker}`);
    }
    const quoteData = fmpData[0];
    const quote: Quote = {
      symbol: quoteData.symbol,
      price: quoteData.price,
      change: quoteData.change,
      changePercent: quoteData.changePercentage || quoteData.changesPercentage,
      volume: quoteData.volume,
      marketCap: quoteData.marketCap,
      timestamp: new Date().toISOString(),
    };
    // Mettre en cache
    await setCachedQuote(ticker, quote, 1);
    return {
      success: true,
      data: quote,
      cached: false,
      timestamp: quote.timestamp,
    };
  } catch (error: any) {
    // Si l'endpoint n'est pas disponible, retourner une erreur claire
    if (error.message && error.message.includes("Legacy")) {
      throw new Error("FMP quote endpoint is legacy and not available. Please upgrade your FMP plan or use an alternative endpoint.");
    }
    throw error;
  }

}

export async function getTickerOwnership(
  ticker: string,
  limit: number = 100
): Promise<{
  success: boolean;
  data: Ownership[];
  cached: boolean;
  count: number;
  timestamp: string;
}> {
  // Vérifier le cache
  const { data: cached, error } = await supabase
    .from("institutional_ownership")
    .select("*")
    .eq("ticker", ticker.toUpperCase())
    .gt("expires_at", new Date().toISOString())
    .limit(limit);

  if (!error && cached && cached.length > 0) {
    const ownership: Ownership[] = cached.map((item) => ({
      name: item.institution_name,
      shares: parseInt(item.shares || "0", 10),
      units: parseInt(item.units || "0", 10),
      value: parseFloat(item.value || "0"),
      is_hedge_fund: item.is_hedge_fund || false,
      report_date: item.report_date,
      filing_date: item.filing_date,
      percentage: item.percentage ? parseFloat(item.percentage) : undefined,
    }));

    return {
      success: true,
      data: ownership,
      cached: true,
      count: ownership.length,
      timestamp: cached[0].cached_at,
    };
  }

  // Appel API Unusual Whales
  const uwResponse = await fetchUnusualWhales(`/institution/${ticker.toUpperCase()}/ownership?limit=${limit}`);

  // Unusual Whales retourne {data: [...]} ou directement un tableau
  const uwData = Array.isArray(uwResponse) ? uwResponse : (uwResponse?.data || []);
  
  if (!Array.isArray(uwData)) {
    console.error("[getTickerOwnership] Invalid response format:", typeof uwResponse, Object.keys(uwResponse || {}));
    throw new Error("Invalid response from Unusual Whales API");
  }

  const ownership: Ownership[] = uwData.map((item: any) => ({
    name: item.name || item.short_name || "",
    shares: item.units || item.shares || 0, // Unusual Whales utilise "units"
    units: item.units || item.shares || 0,
    value: item.value || 0,
    is_hedge_fund: item.is_hedge_fund || false,
    report_date: item.report_date || "",
    filing_date: item.filing_date || "",
    percentage: item.percentage,
  }));

  // Mettre en cache
  const expiresAt = addDays(1).toISOString();
  const cacheData = uwData.map((item: any) => ({
    ticker: ticker.toUpperCase(),
    institution_name: item.name || item.short_name || "",
    shares: item.units || item.shares || 0,
    units: item.units || item.shares || 0,
    value: item.value || 0,
    is_hedge_fund: item.is_hedge_fund || false,
    report_date: item.report_date || "",
    filing_date: item.filing_date || "",
    percentage: item.percentage,
    data: item,
    expires_at: expiresAt,
  }));

  await supabase.from("institutional_ownership").upsert(cacheData, {
    onConflict: "ticker,institution_name,report_date",
  });

  return {
    success: true,
    data: ownership,
    cached: false,
    count: ownership.length,
    timestamp: new Date().toISOString(),
  };
}

export async function getTickerActivity(
  ticker: string,
  limit: number = 100,
  forceRefresh: boolean = false
): Promise<{
  success: boolean;
  data: Activity[];
  cached: boolean;
  count: number;
  timestamp: string;
  error?: string;
}> {
  // Vérifier le cache si pas de force refresh
    if (!forceRefresh) {
    const { data: cached, error } = await supabase
      .from("institutional_activity")
      .select("*")
      .eq("ticker", ticker.toUpperCase())
      .gt("expires_at", new Date().toISOString())
      .limit(limit);
      if (!error && cached && cached.length > 0) {
      const activities: Activity[] = cached.map((item) => ({
        institution_name: item.institution_name,
        units_change: parseInt(item.units_change || "0", 10),
        change: parseInt(item.change || "0", 10),
        avg_price: parseFloat(item.avg_price || "0"),
        buy_price: item.buy_price ? parseFloat(item.buy_price) : null,
        sell_price: item.sell_price ? parseFloat(item.sell_price) : null,
        filing_date: item.filing_date,
        report_date: item.report_date,
        price_on_filing: parseFloat(item.price_on_filing || "0"),
        price_on_report: parseFloat(item.price_on_report || "0"),
        close: parseFloat(item.close || "0"),
        transaction_type: (parseInt(item.units_change || "0", 10) > 0) ? "BUY" : "SELL",
      }));
      return {
        success: true,
        data: activities,
        cached: true,
        count: activities.length,
        timestamp: cached[0].cached_at,
      };
    }
  }
  
  // ⚠️ OPTIMISATION CRITIQUE : Limiter à 5 institutions maximum pour éviter timeout
  try {
    const ownership = await getTickerOwnership(ticker, 100);
    
    if (!ownership.success || !ownership.data || ownership.data.length === 0) {
      return {
        success: true,
        data: [],
        cached: false,
        count: 0,
        timestamp: new Date().toISOString(),
      };
    }
    
    const topInstitutions = ownership.data
      .sort((a, b) => b.shares - a.shares)
      .slice(0, 5); // MAX 5 institutions pour éviter timeout
    
    const allActivities: Activity[] = [];
  // Pour chaque institution, récupérer les transactions
  for (const inst of topInstitutions) {
    try {
      const encodedName = encodeURIComponent(inst.name);
      const uwResponse = await fetchUnusualWhales(
        `/institution/${encodedName}/activity?ticker=${ticker.toUpperCase()}&limit=20`
      );

      // Unusual Whales retourne {data: [...]} ou directement un tableau
      const uwData = Array.isArray(uwResponse) ? uwResponse : (uwResponse?.data || []);
      if (Array.isArray(uwData)) {
        const tickerActivities = uwData
          .filter((item: any) => item.ticker === ticker.toUpperCase())
          .map((item: any) => ({
            institution_name: inst.name,
            units_change: item.units_change || 0,
            change: item.change || item.units_change || 0,
            avg_price: item.avg_price || 0,
            buy_price: item.buy_price || null,
            sell_price: item.sell_price || null,
            filing_date: item.filing_date,
            report_date: item.report_date,
            price_on_filing: item.price_on_filing || 0,
            price_on_report: item.price_on_report || 0,
            close: item.close || 0,
            transaction_type: ((item.units_change || 0) > 0 ? "BUY" : "SELL") as "BUY" | "SELL",
          }));
        allActivities.push(...tickerActivities);
      }

      // Délai de 500ms pour respecter les rate limits (réduit pour éviter timeout)
      await sleep(500);
    } catch (error) {
      console.error(`Error fetching activity for ${inst.name}:`, error);
      // Continuer même si une institution échoue
    }
  }

  // Mettre en cache
  const expiresAt = addDays(1).toISOString();
  const cacheData = allActivities.map((activity) => ({
    ticker: ticker.toUpperCase(),
    institution_name: activity.institution_name,
    units_change: activity.units_change,
    change: activity.change,
    avg_price: activity.avg_price,
    buy_price: activity.buy_price,
    sell_price: activity.sell_price,
    filing_date: activity.filing_date,
    report_date: activity.report_date,
    price_on_filing: activity.price_on_filing,
    price_on_report: activity.price_on_report,
    close: activity.close,
    transaction_type: activity.transaction_type,
    data: activity as any,
    expires_at: expiresAt,
  }));
  if (cacheData.length > 0) {
    try {
      await supabase.from("institutional_activity").upsert(cacheData);
    } catch (cacheError) {
      console.error('Error caching activities:', cacheError);
      // Ne pas échouer si le cache échoue
    }
  }
  return {
    success: true,
    data: allActivities.slice(0, limit),
    cached: false,
    count: allActivities.length,
    timestamp: new Date().toISOString(),
  };
  } catch (error: any) {
    console.error('[getTickerActivity] Error:', error);
    // Retourner une réponse d'erreur valide au lieu de throw
    throw error; // Re-throw pour que le router gère l'erreur
  }
}

export async function getTickerHedgeFunds(
  ticker: string,
  limit: number = 100
): Promise<{
  success: boolean;
  data: Ownership[];
  cached: boolean;
  count: number;
  timestamp: string;
}> {
  try {
    // Filtrer les hedge funds depuis l'ownership
    const ownership = await getTickerOwnership(ticker, limit);
    
    // Vérifier que l'ownership a réussi
    if (!ownership.success || !ownership.data) {
      return {
        success: true,
        data: [],
        cached: false,
        count: 0,
        timestamp: new Date().toISOString(),
      };
    }
    
    const hedgeFunds = ownership.data.filter((item) => item.is_hedge_fund);

    return {
      success: true,
      data: hedgeFunds,
      cached: ownership.cached,
      count: hedgeFunds.length,
      timestamp: ownership.timestamp,
    };
  } catch (error: any) {
    console.error(`[getTickerHedgeFunds] Error for ${ticker}:`, error);
    // Retourner une réponse vide au lieu de faire planter
    return {
      success: true,
      data: [],
      cached: false,
      count: 0,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function getTickerInsiders(
  ticker: string,
  limit: number = 100
): Promise<{
  success: boolean;
  data: InsiderTrade[];
  cached: boolean;
  count: number;
  timestamp: string;
}> {
  // Vérifier le cache
  const { data: cached, error } = await supabase
    .from("insider_trades")
    .select("*")
    .eq("ticker", ticker.toUpperCase())
    .gt("expires_at", new Date().toISOString())
    .limit(limit);

  if (!error && cached && cached.length > 0) {
    // Removed debug logs getTickerInsiders > cached', cached);
    const insiders: InsiderTrade[] = cached.map((item) => ({
      owner_name: item.owner_name,
      officer_title: item.officer_title,
      transaction_code: item.transaction_code,
      acquisitionOrDisposition: item.acquisition_or_disposition,
      amount: parseFloat(item.amount || "0"),
      transaction_date: item.transaction_date,
      shares: item.shares ? parseInt(item.shares, 10) : undefined,
      price: item.price ? parseFloat(item.price) : undefined,
    }));
    // Removed debug logs getTickerInsiders > insiders', insiders);
    return {
      success: true,
      data: insiders,
      cached: true,
      count: insiders.length,
      timestamp: cached[0].cached_at,
    };
  }

  // Appel API Unusual Whales - Utiliser ticker_symbol au lieu de ticker
  const params = new URLSearchParams();
  params.append('ticker_symbol', ticker.toUpperCase());
  params.append('limit', String(limit));
  const uwResponse = await fetchUnusualWhales(`/insider/transactions?${params.toString()}`);
  // Removed debug logs getTickerInsiders > uwResponse', uwResponse);
  // Unusual Whales retourne {data: [...]} ou directement un tableau
  const uwData = Array.isArray(uwResponse) ? uwResponse : (uwResponse?.data || []);
  // Removed debug logs getTickerInsiders > uwData', uwData);
  if (!Array.isArray(uwData)) {
    console.error("[getTickerInsiders] Invalid response format:", typeof uwResponse, Object.keys(uwResponse || {}));
    throw new Error("Invalid response from Unusual Whales API");
  }
  // Filtrer les résultats pour s'assurer qu'ils correspondent au ticker demandé
  // (l'API peut retourner des résultats pour plusieurs tickers)
  const upperTicker = ticker.toUpperCase();
  const filteredData = uwData.filter((item: any) => {
    // Vérifier que le ticker correspond (case-insensitive)
    const itemTicker = item.ticker ? item.ticker.toUpperCase() : null;
    return itemTicker === upperTicker;
  });
  // Removed debug logs getTickerInsiders > filteredData', filteredData);
  const insiders: InsiderTrade[] = filteredData.map((item: any) => ({
    owner_name: item.owner_name,
    officer_title: item.officer_title,
    transaction_code: item.transaction_code,
    acquisitionOrDisposition: item.acquisitionOrDisposition,
    amount: item.amount || 0,
    transaction_date: item.transaction_date,
    shares: item.shares,
    price: item.price,
  }));
  // Removed debug logs getTickerInsiders > insiders', insiders);
  // Mettre en cache (utiliser filteredData au lieu de uwData)
  const expiresAt = addDays(1).toISOString();
  const cacheData = filteredData.map((item: any) => ({
    ticker: ticker.toUpperCase(),
    owner_name: item.owner_name,
    officer_title: item.officer_title,
    transaction_code: item.transaction_code,
    acquisition_or_disposition: item.acquisitionOrDisposition,
    amount: item.amount || 0,
    transaction_date: item.transaction_date,
    shares: item.shares,
    price: item.price,
    data: item,
    expires_at: expiresAt,
  }));
  // Removed debug logs getTickerInsiders > cacheData', cacheData);
  await supabase.from("insider_trades").upsert(cacheData);
  // Removed debug logs getTickerInsiders > insiders', insiders);
  return {
    success: true,
    data: insiders,
    cached: false,
    count: insiders.length,
    timestamp: new Date().toISOString(),
  };
}

export async function getTickerCongress(
  ticker: string,
  limit: number = 100
): Promise<{
  success: boolean;
  data: CongressTrade[];
  cached: boolean;
  count: number;
  timestamp: string;
}> {
  // Vérifier le cache
  const { data: cached, error } = await supabase
    .from("congress_trades")
    .select("*")
    .eq("ticker", ticker.toUpperCase())
    .gt("expires_at", new Date().toISOString())
    .limit(limit);

  if (!error && cached && cached.length > 0) {
    const congress: CongressTrade[] = cached.map((item) => ({
      name: item.name,
      member_type: item.member_type,
      txn_type: item.txn_type,
      amounts: item.amounts,
      transaction_date: item.transaction_date,
    }));
    // Removed debug logs getTickerCongress > congress', congress);
    return {
      success: true,
      data: congress,
      cached: true,
      count: congress.length,
      timestamp: cached[0].cached_at,
    };
  }

  // Appel API Unusual Whales
  const uwResponse = await fetchUnusualWhales(`/congress/recent-trades?ticker=${ticker.toUpperCase()}&limit=${limit}`);
  // Removed debug logs getTickerCongress > uwResponse', uwResponse);
  // Unusual Whales retourne {data: [...]} ou directement un tableau
  const uwData = Array.isArray(uwResponse) ? uwResponse : (uwResponse?.data || []);
  // Removed debug logs getTickerCongress > uwData', uwData);
  if (!Array.isArray(uwData)) {
    console.error("[getTickerCongress] Invalid response format:", typeof uwResponse, Object.keys(uwResponse || {}));
    throw new Error("Invalid response from Unusual Whales API");
  }

  const congress: CongressTrade[] = uwData.map((item: any) => ({
    name: item.name,
    member_type: item.member_type,
    txn_type: item.txn_type,
    amounts: item.amounts,
    transaction_date: item.transaction_date,
  }));
  // Removed debug logs getTickerCongress > congress', congress);
  // Mettre en cache
  const expiresAt = addDays(1).toISOString();
  const cacheData = uwData.map((item: any) => ({
    ticker: ticker.toUpperCase(),
    name: item.name,
    member_type: item.member_type,
    txn_type: item.txn_type,
    amounts: item.amounts,
    transaction_date: item.transaction_date,
    data: item,
    expires_at: expiresAt,
  }));
  // Removed debug logs getTickerCongress > cacheData', cacheData);
  await supabase.from("congress_trades").upsert(cacheData);
  // Removed debug logs getTickerCongress > congress', congress);
  return {
    success: true,
    data: congress,
    cached: false,
    count: congress.length,
    timestamp: new Date().toISOString(),
  };
}

export async function getTickerOptions(
  ticker: string,
  limit: number = 100,
  minPremium: number = 10000,
  filters?: {
    maxPremium?: number;
    isCall?: boolean;
    isPut?: boolean;
    isSweep?: boolean;
    isFloor?: boolean;
    isOtm?: boolean;
    minSize?: number;
    maxSize?: number;
    minDte?: number;
    maxDte?: number;
    minVolume?: number;
    maxVolume?: number;
  }
): Promise<{
  success: boolean;
  data: OptionsFlow[];
  cached: boolean;
  count: number;
  timestamp: string;
}> {
  // Vérifier le cache
  const { data: cached, error } = await supabase
    .from("options_flow")
    .select("*")
    .eq("ticker", ticker.toUpperCase())
    .gt("expires_at", new Date().toISOString())
    .limit(limit);

  if (!error && cached && cached.length > 0) {
    const options: OptionsFlow[] = cached.map((item) => ({
      type: item.type,
      strike: parseFloat(item.strike || "0"),
      total_premium: parseFloat(item.total_premium || "0"),
      premium: parseFloat(item.premium || "0"),
      volume: parseInt(item.volume || "0", 10),
      expiry: item.expiry,
      created_at: item.created_at,
      open_interest: item.open_interest ? parseInt(item.open_interest, 10) : undefined,
    }));
    // Removed debug logs getTickerOptions > options', options);
    return {
      success: true,
      data: options,
      cached: true,
      count: options.length,
      timestamp: cached[0].cached_at,
    };
  }

  // Appel API Unusual Whales - Utiliser le bon endpoint selon la doc avec tous les filtres disponibles
  try {
    // Construire les paramètres de requête
    const params = new URLSearchParams();
    params.append('ticker_symbol', ticker.toUpperCase());
    params.append('min_premium', String(minPremium));
    params.append('limit', String(Math.min(limit, 200))); // Max 200 selon la doc
    
    // Ajouter les filtres optionnels
    if (filters) {
      if (filters.maxPremium !== undefined) {
        params.append('max_premium', String(filters.maxPremium));
      }
      if (filters.isCall !== undefined) {
        params.append('is_call', String(filters.isCall));
      }
      if (filters.isPut !== undefined) {
        params.append('is_put', String(filters.isPut));
      }
      if (filters.isSweep !== undefined) {
        params.append('is_sweep', String(filters.isSweep));
      }
      if (filters.isFloor !== undefined) {
        params.append('is_floor', String(filters.isFloor));
      }
      if (filters.isOtm !== undefined) {
        params.append('is_otm', String(filters.isOtm));
      }
      if (filters.minSize !== undefined) {
        params.append('min_size', String(filters.minSize));
      }
      if (filters.maxSize !== undefined) {
        params.append('max_size', String(filters.maxSize));
      }
      if (filters.minDte !== undefined) {
        params.append('min_dte', String(filters.minDte));
      }
      if (filters.maxDte !== undefined) {
        params.append('max_dte', String(filters.maxDte));
      }
      if (filters.minVolume !== undefined) {
        params.append('min_volume', String(filters.minVolume));
      }
      if (filters.maxVolume !== undefined) {
        params.append('max_volume', String(filters.maxVolume));
      }
    }
    
    const uwResponse = await fetchUnusualWhales(
      `/option-trades/flow-alerts?${params.toString()}`
    );
    // Unusual Whales retourne {data: [...]} selon la doc
    const uwData = Array.isArray(uwResponse) ? uwResponse : (uwResponse?.data || []);
    if (!Array.isArray(uwData)) {
      console.error("[getTickerOptions] Invalid response format:", typeof uwResponse, Object.keys(uwResponse || {}));
      throw new Error("Invalid response from Unusual Whales API");
    }
    
    // Mapper selon le format de l'API (voir doc: option-trades/flow-alerts)
    const options: OptionsFlow[] = uwData.map((item: any) => ({
      type: item.type || (item.option_chain?.includes('C') ? 'call' : 'put'),
      strike: parseFloat(item.strike || "0"),
      total_premium: parseFloat(item.total_premium || "0"),
      premium: parseFloat(item.total_premium || "0"), // Utiliser total_premium comme premium
      volume: parseInt(item.volume || "0", 10),
      expiry: item.expiry,
      created_at: item.created_at,
      open_interest: item.open_interest ? parseInt(String(item.open_interest), 10) : undefined,
    }));
    
    // Mettre en cache (TTL: 1 heure)
    const expiresAt = addHours(1).toISOString();
    const cacheData = uwData.map((item: any) => ({
      ticker: ticker.toUpperCase(),
      type: item.type,
      strike: item.strike,
      total_premium: item.total_premium || item.premium || 0,
      premium: item.premium || 0,
      volume: item.volume || 0,
      expiry: item.expiry,
      created_at: item.created_at,
      open_interest: item.open_interest,
      data: item,
      expires_at: expiresAt,
    }));
    
    if (cacheData.length > 0) {
      await supabase.from("options_flow").upsert(cacheData);
    }
    
    return {
      success: true,
      data: options,
      cached: false,
      count: options.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    // Si l'endpoint retourne 404, retourner une réponse vide au lieu de faire planter
    if (error.message && error.message.includes("404")) {
      console.warn(`[getTickerOptions] Endpoint not found for ${ticker}, returning empty result`);
      return {
        success: true,
        data: [],
        cached: false,
        count: 0,
        timestamp: new Date().toISOString(),
      };
    }
    // Pour les autres erreurs, re-throw
    throw error;
  }
}

export async function getTickerDarkPool(
  ticker: string,
  limit: number = 100
): Promise<{
  success: boolean;
  data: DarkPoolTrade[];
  cached: boolean;
  count: number;
  timestamp: string;
}> {
  // Vérifier le cache
  const { data: cached, error } = await supabase
    .from("dark_pool_trades")
    .select("*")
    .eq("ticker", ticker.toUpperCase())
    .gt("expires_at", new Date().toISOString())
    .limit(limit);
  // Removed debug logs getTickerDarkPool > cached', cached);
  if (!error && cached && cached.length > 0) {
    const darkPool: DarkPoolTrade[] = cached.map((item) => ({
      date: item.date || (item.executed_at ? new Date(item.executed_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
      executed_at: item.executed_at || item.date || new Date().toISOString(),
      volume: parseInt(item.volume || "0", 10),
      size: parseInt(item.size || "0", 10),
      price: parseFloat(item.price || "0"),
      value: parseFloat(item.value || "0"),
      premium: item.premium,
      ticker: item.ticker,
      market_center: item.market_center,
      canceled: item.canceled || false,
    }));
    // Removed debug logs getTickerDarkPool > darkPool', darkPool);
    return {
      success: true,
      data: darkPool,
      cached: true,
      count: darkPool.length,
      timestamp: cached[0].cached_at,
    };
  }

  // Appel API Unusual Whales - Utiliser le bon endpoint selon la doc: /darkpool/{ticker}
  try {
    const uwResponse = await fetchUnusualWhales(`/darkpool/${ticker.toUpperCase()}?limit=${Math.min(limit, 500)}`);
    // Unusual Whales retourne {data: [...]} selon la doc
    const uwData = Array.isArray(uwResponse) ? uwResponse : (uwResponse?.data || []);
    if (!Array.isArray(uwData)) {
      console.error("[getTickerDarkPool] Invalid response format:", typeof uwResponse, Object.keys(uwResponse || {}));
      throw new Error("Invalid response from Unusual Whales API");
    }
    
    // Mapper selon le format de l'API (voir doc: darkpool/{ticker})
    // Le champ date n'existe pas, utiliser executed_at et extraire la date
    const darkPool: DarkPoolTrade[] = uwData.map((item: any) => {
      // Extraire la date depuis executed_at (format: "2023-02-16T00:59:44Z")
      const executedAt = item.executed_at || item.date;
      const dateStr = executedAt ? new Date(executedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      
      return {
        date: dateStr,
        executed_at: executedAt || new Date().toISOString(),
        volume: parseInt(item.volume || "0", 10),
        size: parseInt(item.size || "0", 10),
        price: parseFloat(item.price || "0"),
        value: parseFloat(item.premium || item.value || String(parseFloat(item.price || "0") * parseInt(item.size || "0", 10))),
        premium: item.premium,
        ticker: item.ticker,
        market_center: item.market_center,
        canceled: item.canceled || false,
      };
    });
    
    // Mettre en cache (TTL: 1 heure)
    const expiresAt = addHours(1).toISOString();
    const cacheData = darkPool.map((trade) => ({
      ticker: ticker.toUpperCase(),
      date: trade.date,
      executed_at: trade.executed_at,
      volume: trade.volume,
      size: trade.size,
      price: trade.price,
      value: trade.value,
      premium: trade.premium,
      market_center: trade.market_center,
      canceled: trade.canceled,
      data: uwData.find((item: any) => item.executed_at === trade.executed_at) || {},
      expires_at: expiresAt,
    }));
    
    if (cacheData.length > 0) {
      await supabase.from("dark_pool_trades").upsert(cacheData);
    }
    
    return {
      success: true,
      data: darkPool,
      cached: false,
      count: darkPool.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    // Si l'endpoint retourne 404, retourner une réponse vide au lieu de faire planter
    if (error.message && error.message.includes("404")) {
      console.warn(`[getTickerDarkPool] Endpoint not found for ${ticker}, returning empty result`);
      return {
        success: true,
        data: [],
        cached: false,
        count: 0,
        timestamp: new Date().toISOString(),
      };
    }
    // Pour les autres erreurs, re-throw
    throw error;
  }
}

export async function getTickerStats(ticker: string): Promise<{
  success: boolean;
  data: {
    totalInstitutions: number;
    totalHedgeFunds: number;
    totalInstitutionalShares: number;
    totalInstitutionalValue: number;
    recentBuys: number;
    recentSells: number;
    netActivity: number;
    insiderTrades: number;
    congressTrades: number;
    optionsFlow: {
      totalAlerts: number;
      callPremium: number;
      putPremium: number;
      putCallRatio: number;
    };
    darkPool: {
      totalTrades: number;
      totalVolume: number;
    };
  };
  cached: boolean;
  timestamp: string;
}> {
  // Récupérer toutes les données nécessaires
  const [ownership, activity, insiders, congress, options, darkPool] = await Promise.all([
    getTickerOwnership(ticker, 1000),
    getTickerActivity(ticker, 1000),
    getTickerInsiders(ticker, 1000),
    getTickerCongress(ticker, 1000),
    getTickerOptions(ticker, 1000),
    getTickerDarkPool(ticker, 1000),
  ]);
  // Removed debug logs getTickerStats > ownership', ownership);
  const hedgeFunds = ownership.data.filter((item) => item.is_hedge_fund);
  // Removed debug logs getTickerStats > hedgeFunds', hedgeFunds);
  const buys = activity.data.filter((item) => item.transaction_type === "BUY");
  // Removed debug logs getTickerStats > buys', buys);
  const sells = activity.data.filter((item) => item.transaction_type === "SELL");
  // Removed debug logs getTickerStats > sells', sells);
  const calls = options.data.filter((item) => item.type === "call");
  // Removed debug logs getTickerStats > calls', calls);
  const puts = options.data.filter((item) => item.type === "put");
  // Removed debug logs getTickerStats > puts', puts);
  const stats = {
    totalInstitutions: ownership.data.length,
    totalHedgeFunds: hedgeFunds.length,
    totalInstitutionalShares: ownership.data.reduce((sum, item) => sum + item.shares, 0),
    totalInstitutionalValue: ownership.data.reduce((sum, item) => sum + item.value, 0),
    recentBuys: buys.length,
    recentSells: sells.length,
    netActivity: buys.length - sells.length,
    insiderTrades: insiders.data.length,
    congressTrades: congress.data.length,
    optionsFlow: {
      totalAlerts: options.data.length,
      callPremium: calls.reduce((sum, item) => sum + item.premium, 0),
      putPremium: puts.reduce((sum, item) => sum + item.premium, 0),
      putCallRatio: calls.length > 0 ? puts.length / calls.length : 0,
    },
    darkPool: {
      totalTrades: darkPool.data.length,
      totalVolume: darkPool.data.reduce((sum, item) => sum + item.volume, 0),
    },
  };
  // Removed debug logs getTickerStats > stats', stats);
  return {
    success: true,
    data: stats,
    cached: ownership.cached && activity.cached && insiders.cached && congress.cached && options.cached && darkPool.cached,
    timestamp: new Date().toISOString(),
  };
}

