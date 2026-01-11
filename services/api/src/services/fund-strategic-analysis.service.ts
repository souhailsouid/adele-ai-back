/**
 * Service d'analyse stratégique des différences 13F
 * Transforme une liste brute de transactions en insights exploitables
 * 
 * Objectifs :
 * - Hiérarchiser par "Conviction" (% Portfolio Impact)
 * - Distinguer Exits vs Trims
 * - Analyser les tendances (3+ trimestres)
 * - Grouper par secteur
 * - Calculer le flux sectoriel
 */

import { supabase } from "../supabase";

export interface StrategicDiff {
  id: number;
  ticker: string;
  action: 'new' | 'exit' | 'increase' | 'decrease';
  diff_shares: number;
  diff_value: number;
  diff_pct_shares: number | null;
  
  // Portfolio Impact (le poids réel dans le portefeuille)
  portfolio_impact_pct: number; // % du portefeuille total affecté
  portfolio_weight_old: number | null; // Poids avant
  portfolio_weight_new: number | null; // Poids après
  
  // Classification stratégique
  conviction_level: 'high' | 'medium' | 'low' | 'noise'; // Basé sur portfolio_impact_pct
  is_exit: boolean; // true si sortie totale, false si trim/rebalancing
  is_strong_conviction: boolean; // true si nouvelle position > 5% ou achat massif
  
  // Contexte
  filing_id_new: number;
  filing_id_old: number | null;
  filing_date_new: string;
  filing_date_old: string | null;
  sector: string | null;
  
  // Tendances (calculées séparément)
  trend_quarters?: number; // Nombre de trimestres consécutifs (pour accumulation/distribution)
  trend_direction?: 'accumulating' | 'distributing' | 'stable';
  is_accumulating?: boolean; // true si accumulation sur 2+ trimestres (signal pertinent), 3+ = signal très fort
  is_distributing?: boolean; // true si distribution sur 2+ trimestres (signal pertinent), 3+ = signal très fort
}

export interface SectorFlow {
  sector: string;
  inflow: number; // Valeur totale des entrées
  outflow: number; // Valeur totale des sorties
  net_flow: number; // inflow - outflow
  net_flow_pct: number; // % du portefeuille total
  ticker_count: number; // Nombre de tickers affectés
  top_movements: Array<{
    ticker: string;
    action: string;
    value: number;
    impact_pct: number;
  }>;
}

export interface StrategicAnalysis {
  fund_id: number;
  fund_name: string;
  filing_date_new: string;
  filing_date_old: string | null;
  
  // Résumé stratégique
  summary: {
    portfolio_value_latest_filing: number; // Valeur totale du portefeuille au filing le plus récent (en milliers USD)
    total_changes_value: number; // Valeur absolue de tous les changements (activité brute, en milliers USD)
    net_inflow: number; // Argent frais injecté (new + increase) - Utile pour le frontend (en milliers USD)
    net_outflow: number; // Argent retiré (exit + decrease) - Utile pour le frontend (en milliers USD)
    strong_conviction_count: number; // Nombre de mouvements > 5% d'impact
    exits_count: number;
    new_positions_count: number;
    sector_rotation_detected: boolean;
  };
  
  // Mouvements par conviction (triés par impact)
  strong_conviction_movements: StrategicDiff[]; // > 5% d'impact ou nouveaux > 3%
  medium_conviction_movements: StrategicDiff[]; // 1-5% d'impact
  low_conviction_movements: StrategicDiff[]; // 0.5-1% d'impact
  noise_filtered_out: number; // Nombre de mouvements < 0.5% filtrés
  
  // Flux sectoriel
  sector_flows: SectorFlow[];
  sector_flows_filtered: SectorFlow[]; // Exclut les secteurs "Unknown" (pour graphique)
  has_only_unknown_sectors: boolean; // true si tous les secteurs sont "Unknown"
  
  // Exits distincts des trims
  exits: StrategicDiff[]; // Sorties totales
  trims: StrategicDiff[]; // Réductions partielles
  
  // Nouveautés
  new_positions: StrategicDiff[]; // Nouvelles positions
  
  // Liste fusionnée et triée de tous les mouvements (prête pour l'affichage frontend)
  // Trié par priorité : accumulations 3+ trimestres > accumulations 2+ trimestres > impact décroissant
  all_movements: StrategicDiff[]; // Fusionne strong + medium + (optionnellement) low conviction
  
  // Tendances multi-trimestres (nécessite plusieurs filings)
  trends?: {
    accumulating_positions: Array<{
      ticker: string;
      quarters: number;
      total_added: number;
      avg_impact_per_quarter: number;
      is_strong_accumulation?: boolean; // true si 3+ trimestres (signal le plus fort)
    }>;
    distributing_positions: Array<{
      ticker: string;
      quarters: number;
      total_reduced: number;
      avg_impact_per_quarter: number;
      is_strong_distribution?: boolean; // true si 3+ trimestres
    }>;
  };
}

/**
 * Calcule le % Portfolio Impact d'un diff
 * Portfolio Impact = |diff_value| / total_portfolio_value * 100
 */
function calculatePortfolioImpact(
  diffValue: number,
  totalPortfolioValue: number
): number {
  if (totalPortfolioValue === 0) return 0;
  return Math.abs(diffValue) / totalPortfolioValue * 100;
}

/**
 * Récupère les secteurs pour plusieurs tickers en batch (optimisé)
 */
/**
 * Normalise un ticker pour la recherche (uppercase, trim, retire les espaces multiples)
 */
function normalizeTicker(ticker: string | null | undefined): string {
  if (!ticker) return '';
  return ticker.toUpperCase().trim().replace(/\s+/g, ' ');
}

/**
 * Cherche une correspondance entre un ticker du holding et un ticker dans companies
 * Gère les cas où "LULULEMON" doit correspondre à "LULU", "BRUKER COR" à "BRKR", etc.
 */
function findTickerMatch(holdingTicker: string, companiesMap: Map<string, string | null>): string | null {
  const normalized = normalizeTicker(holdingTicker);
  
  // 1. Recherche exacte
  if (companiesMap.has(normalized)) {
    return companiesMap.get(normalized) || null;
  }
  
  // 2. Extraire le premier mot du ticker (ex: "LULULEMON" -> "LULULEMON", "BRUKER COR" -> "BRUKER")
  const firstWord = normalized.split(/\s+/)[0];
  
  // 3. Chercher si un ticker dans companies commence par le premier mot ou vice versa
  for (const [companyTicker, companySector] of companiesMap.entries()) {
    const companyFirstWord = companyTicker.split(/\s+/)[0];
    
    // Si le premier mot du ticker du holding commence par le ticker de la company (ex: "LULULEMON" commence par "LULU")
    // OU si le ticker de la company commence par le premier mot du holding (ex: "LULU" commence par "LULULEMON" - peu probable)
    if (firstWord.startsWith(companyFirstWord) || companyFirstWord.startsWith(firstWord)) {
      // Vérifier que c'est une correspondance raisonnable (au moins 3 caractères communs)
      const minLength = Math.min(firstWord.length, companyFirstWord.length);
      if (minLength >= 3) {
        return companySector;
      }
    }
  }
  
  // 4. Recherche par inclusion (pour gérer les cas où le ticker court est dans le ticker long)
  // Ex: "LULU" est dans "LULULEMON"
  for (const [companyTicker, companySector] of companiesMap.entries()) {
    const companyFirstWord = companyTicker.split(/\s+/)[0];
    
    // Si le ticker de la company est contenu dans le ticker du holding au début
    if (firstWord.indexOf(companyFirstWord) === 0 || companyFirstWord.indexOf(firstWord) === 0) {
      if (Math.min(firstWord.length, companyFirstWord.length) >= 3) {
        return companySector;
      }
    }
  }
  
  return null;
}

/**
 * Récupère les secteurs pour plusieurs tickers en batch (optimisé)
 * Gère la normalisation des tickers pour faire correspondre "LULULEMON " avec "LULU", etc.
 */
async function getTickersSectorsBatch(tickers: string[]): Promise<Map<string, string | null>> {
  const sectorMap = new Map<string, string | null>();
  
  if (tickers.length === 0) return sectorMap;
  
  // Récupérer tous les secteurs en une seule requête
  const { data: companies, error } = await supabase
    .from("companies")
    .select("ticker, sector");
  
  if (error || !companies) {
    // Si erreur, retourner null pour tous
    for (const ticker of tickers) {
      sectorMap.set(normalizeTicker(ticker), null);
    }
    return sectorMap;
  }
  
  // Créer un map de tous les tickers normalisés vers leurs secteurs
  const companiesMap = new Map<string, string | null>();
  for (const company of companies) {
    if (company.ticker) {
      const normalized = normalizeTicker(company.ticker);
      companiesMap.set(normalized, company.sector || null);
    }
  }
  
  // Chercher une correspondance pour chaque ticker (exact ou partielle)
  for (const ticker of tickers) {
    const sector = findTickerMatch(ticker, companiesMap);
    sectorMap.set(normalizeTicker(ticker), sector);
  }
  
  return sectorMap;
}

/**
 * Récupère les poids de portefeuille pour tous les tickers d'un coup (optimisé)
 */
async function getPortfolioWeightsBatch(
  fundId: number,
  filingIds: Set<number | null>
): Promise<Map<number | null, { total: number; tickerWeights: Map<string, number> }>> {
  const portfolioMap = new Map<number | null, { total: number; tickerWeights: Map<string, number> }>();
  
  // Charger tous les holdings en une seule fois par filing
  const filingArray = Array.from(filingIds).filter(id => id !== null) as number[];
  
  if (filingArray.length === 0) {
    portfolioMap.set(null, { total: 0, tickerWeights: new Map() });
    return portfolioMap;
  }
  
  // Récupérer tous les holdings pour tous les filings en une requête
  const { data: allHoldings, error } = await supabase
    .from("fund_holdings")
    .select("filing_id, ticker, market_value")
    .in("filing_id", filingArray)
    .eq("type", "stock");
  
  if (error || !allHoldings) {
    for (const filingId of filingIds) {
      portfolioMap.set(filingId, { total: 0, tickerWeights: new Map() });
    }
    return portfolioMap;
  }
  
  // Grouper par filing_id
  const holdingsByFiling = new Map<number, typeof allHoldings>();
  for (const holding of allHoldings) {
    if (!holdingsByFiling.has(holding.filing_id)) {
      holdingsByFiling.set(holding.filing_id, []);
    }
    holdingsByFiling.get(holding.filing_id)!.push(holding);
  }
  
  // Calculer les totaux et poids pour chaque filing
  for (const filingId of filingIds) {
    if (filingId === null) {
      portfolioMap.set(null, { total: 0, tickerWeights: new Map() });
      continue;
    }
    
    const holdings = holdingsByFiling.get(filingId) || [];
    const total = holdings.reduce((sum, h) => sum + (h.market_value || 0), 0);
    const tickerWeights = new Map<string, number>();
    
    for (const holding of holdings) {
      if (holding.ticker && total > 0) {
        const weight = (holding.market_value || 0) / total * 100;
        tickerWeights.set(holding.ticker.toUpperCase().trim(), weight);
      }
    }
    
    portfolioMap.set(filingId, { total, tickerWeights });
  }
  
  return portfolioMap;
}

/**
 * Classifie le niveau de conviction d'un mouvement
 */
function classifyConviction(portfolioImpactPct: number, action: string, isNew: boolean): 'high' | 'medium' | 'low' | 'noise' {
  // Les nouvelles positions > 3% sont toujours "high conviction"
  if (isNew && portfolioImpactPct >= 3) return 'high';
  
  // Exits sont toujours "high conviction" (changement de thèse)
  if (action === 'exit') return 'high';
  
  // Classification standard
  if (portfolioImpactPct >= 5) return 'high';
  if (portfolioImpactPct >= 1) return 'medium';
  if (portfolioImpactPct >= 0.5) return 'low';
  return 'noise';
}

/**
 * Analyse stratégique des diffs en batch (optimisé)
 */
async function analyzeStrategicDiffsBatch(
  diffs: any[],
  totalPortfolioValue: number,
  portfolioWeightsMap: Map<number | null, { total: number; tickerWeights: Map<string, number> }>,
  sectorMap: Map<string, string | null>
): Promise<StrategicDiff[]> {
  const strategicDiffs: StrategicDiff[] = [];
  
  for (const diff of diffs) {
    const portfolioImpact = calculatePortfolioImpact(diff.diff_value || 0, totalPortfolioValue);
    
    // Récupérer les poids depuis le map
    const oldWeights = portfolioWeightsMap.get(diff.filing_id_old) || { total: 0, tickerWeights: new Map() };
    const newWeights = portfolioWeightsMap.get(diff.filing_id_new) || { total: 0, tickerWeights: new Map() };
    
    const tickerKey = normalizeTicker(diff.ticker) || '';
    const weightOld = oldWeights.tickerWeights.get(tickerKey) || null;
    const weightNew = newWeights.tickerWeights.get(tickerKey) || null;
    
    const sector = sectorMap.get(tickerKey) || null;
    const isNew = diff.action === 'new';
    const isExit = diff.action === 'exit';
    
    const conviction = classifyConviction(portfolioImpact, diff.action, isNew);
    const isStrongConviction = conviction === 'high' || (isNew && portfolioImpact >= 3);
    
    strategicDiffs.push({
      id: diff.id,
      ticker: diff.ticker,
      action: diff.action,
      diff_shares: diff.diff_shares || 0,
      diff_value: diff.diff_value || 0,
      diff_pct_shares: diff.diff_pct_shares,
      portfolio_impact_pct: portfolioImpact,
      portfolio_weight_old: weightOld,
      portfolio_weight_new: weightNew,
      conviction_level: conviction,
      is_exit: isExit,
      is_strong_conviction: isStrongConviction,
      filing_id_new: diff.filing_id_new,
      filing_id_old: diff.filing_id_old,
      filing_date_new: diff.filing_new?.filing_date || diff.filing_date_new,
      filing_date_old: diff.filing_old?.filing_date || diff.filing_date_old,
      sector: sector,
    });
  }
  
  return strategicDiffs;
}

/**
 * Analyse stratégique complète des diffs d'un fund
 * @param includeLowConviction Si true, inclut les low_conviction_movements dans all_movements
 */
export async function analyzeFundDiffsStrategically(
  fundId: number,
  rawDiffs: any[],
  noiseThreshold: number = 0.5, // Filtrer les mouvements < 0.5% d'impact
  includeLowConviction: boolean = false // Inclure les low conviction dans all_movements
): Promise<StrategicAnalysis> {
  if (!rawDiffs || rawDiffs.length === 0) {
    // Récupérer les infos du fund
    const { data: fund } = await supabase
      .from("funds")
      .select("name")
      .eq("id", fundId)
      .single();
    
    return {
      fund_id: fundId,
      fund_name: fund?.name || 'Unknown',
      filing_date_new: '',
      filing_date_old: null,
      summary: {
        portfolio_value_latest_filing: 0,
        total_changes_value: 0,
        net_inflow: 0,
        net_outflow: 0,
        strong_conviction_count: 0,
        exits_count: 0,
        new_positions_count: 0,
        sector_rotation_detected: false,
      },
      strong_conviction_movements: [],
      medium_conviction_movements: [],
      low_conviction_movements: [],
      noise_filtered_out: 0,
      sector_flows: [],
      sector_flows_filtered: [],
      has_only_unknown_sectors: false,
      exits: [],
      trims: [],
      new_positions: [],
      all_movements: [],
    };
  }
  
  // Récupérer les infos du fund
  const { data: fund } = await supabase
    .from("funds")
    .select("name")
    .eq("id", fundId)
    .single();
  
  // Récupérer tous les filing_ids uniques (y compris le latestFilingId pour le calcul du total)
  // IMPORTANT: Le latestFilingId doit être dans le Set pour être inclus dans portfolioWeightsMap
  const latestFilingId = rawDiffs[0]?.filing_id_new;
  const filingIds = new Set<number | null>();
  
  // Ajouter le latestFilingId en premier pour s'assurer qu'il est inclus
  if (latestFilingId) {
    filingIds.add(latestFilingId);
  }
  
  for (const diff of rawDiffs) {
    if (diff.filing_id_old) filingIds.add(diff.filing_id_old);
    if (diff.filing_id_new) filingIds.add(diff.filing_id_new);
  }
  
  // Récupérer tous les tickers uniques
  const tickers = new Set<string>();
  for (const diff of rawDiffs) {
    if (diff.ticker) tickers.add(diff.ticker.toUpperCase().trim());
  }
  
  // Charger les poids de portefeuille et secteurs en batch
  // NOTE: getPortfolioWeightsBatch calcule déjà le total pour chaque filing_id inclus dans filingIds
  const [portfolioWeightsMap, sectorMap] = await Promise.all([
    getPortfolioWeightsBatch(fundId, filingIds),
    getTickersSectorsBatch(Array.from(tickers)),
  ]);
  
  // Calculer le portefeuille total (basé sur le filing le plus récent)
  // IMPORTANT: Utiliser la valeur déjà calculée dans portfolioWeightsMap pour éviter un calcul redondant
  // Note: Les valeurs sont stockées en milliers USD (market_value est en milliers selon le parser 13F)
  // Donc 68137 = 68.137 millions USD
  let totalPortfolioValue = 0;
  
  if (latestFilingId) {
    // Récupérer le total depuis portfolioWeightsMap (déjà calculé dans getPortfolioWeightsBatch)
    // Cette valeur représente la somme de tous les market_value des holdings de type "stock"
    // pour ce filing_id, en milliers USD
    const latestWeights = portfolioWeightsMap.get(latestFilingId);
    if (latestWeights && latestWeights.total > 0) {
      totalPortfolioValue = latestWeights.total;
    }
  }
  
  // Si toujours 0, essayer d'utiliser le filing_id_old le plus récent comme fallback
  // (peut arriver si le latestFilingId n'a pas de holdings ou s'ils n'ont pas été parsés)
  if (totalPortfolioValue === 0 && rawDiffs.length > 0) {
    // Chercher dans les filings précédents (filing_id_old) pour trouver une valeur de référence
    for (const diff of rawDiffs) {
      if (diff.filing_id_old) {
        const oldWeights = portfolioWeightsMap.get(diff.filing_id_old);
        if (oldWeights && oldWeights.total > 0) {
          totalPortfolioValue = oldWeights.total;
          break; // Prendre le premier disponible
        }
      }
    }
  }
  
  // Dernier fallback: si toujours 0, récupérer directement depuis la DB
  // (cas rare où filing_id n'est pas dans le map, ou holdings non parsés)
  if (totalPortfolioValue === 0 && latestFilingId) {
    const { data: holdings } = await supabase
      .from("fund_holdings")
      .select("market_value")
      .eq("filing_id", latestFilingId)
      .eq("type", "stock");
    
    if (holdings && holdings.length > 0) {
      // Somme des market_value (en milliers USD)
      totalPortfolioValue = holdings.reduce((sum, h) => sum + (h.market_value || 0), 0);
    }
  }
  
  // Analyser chaque diff en batch
  const strategicDiffs = await analyzeStrategicDiffsBatch(
    rawDiffs,
    totalPortfolioValue,
    portfolioWeightsMap,
    sectorMap
  );
  
  // Filtrer le bruit et classifier
  const strongConviction: StrategicDiff[] = [];
  const mediumConviction: StrategicDiff[] = [];
  const lowConviction: StrategicDiff[] = [];
  let noiseCount = 0;
  
  for (const diff of strategicDiffs) {
    if (diff.conviction_level === 'noise') {
      noiseCount++;
      continue;
    }
    
    if (diff.conviction_level === 'high') {
      strongConviction.push(diff);
    } else if (diff.conviction_level === 'medium') {
      mediumConviction.push(diff);
    } else {
      lowConviction.push(diff);
    }
  }
  
  // Détecter les tendances multi-trimestres (accumulation/distribution)
  const trendsData = await detectMultiQuarterTrends(fundId, strategicDiffs);
  
  // Enrichir chaque diff avec les informations de tendance
  const strategicDiffsWithTrends = strategicDiffs.map(diff => {
    const tickerKey = diff.ticker.toUpperCase().trim();
    const accumulatingTrend = trendsData.accumulating_positions.find((t: { ticker: string }) => t.ticker === tickerKey);
    const distributingTrend = trendsData.distributing_positions.find((t: { ticker: string }) => t.ticker === tickerKey);
    
    // Marquer comme "accumulating" si 2+ trimestres (signal pertinent)
    // 2 trimestres = signal pertinent, 3+ trimestres = signal très fort (priorisé dans le tri)
    if (accumulatingTrend && accumulatingTrend.quarters >= 2) {
      return {
        ...diff,
        trend_quarters: accumulatingTrend.quarters,
        trend_direction: 'accumulating' as const,
        is_accumulating: true, // 2+ trimestres = signal pertinent
        is_distributing: false,
      };
    }
    
    // Marquer comme "distributing" si 2+ trimestres (signal pertinent)
    if (distributingTrend && distributingTrend.quarters >= 2) {
      return {
        ...diff,
        trend_quarters: distributingTrend.quarters,
        trend_direction: 'distributing' as const,
        is_accumulating: false,
        is_distributing: true, // 2+ trimestres = signal pertinent
      };
    }
    
    return {
      ...diff,
      trend_quarters: undefined,
      trend_direction: undefined,
      is_accumulating: false,
      is_distributing: false,
    };
  });
  
  // Re-classifier avec les tendances
  const strongConvictionWithTrends: StrategicDiff[] = [];
  const mediumConvictionWithTrends: StrategicDiff[] = [];
  const lowConvictionWithTrends: StrategicDiff[] = [];
  let noiseCountWithTrends = 0;
  
  for (const diff of strategicDiffsWithTrends) {
    // Les accumulations sur 3+ trimestres sont toujours "high conviction" même si l'impact individuel est faible
    if (diff.is_accumulating && diff.trend_quarters && diff.trend_quarters >= 3) {
      strongConvictionWithTrends.push(diff);
      continue;
    }
    
    // Les accumulations sur 2+ trimestres (signal pertinent) sont promues à "medium conviction" minimum
    // Même si l'impact individuel est faible, c'est un signal intéressant à afficher
    if (diff.is_accumulating && diff.trend_quarters && diff.trend_quarters >= 2) {
      // Si déjà high conviction, garder high
      if (diff.conviction_level === 'high') {
        strongConvictionWithTrends.push(diff);
      } else {
        // Sinon, promouvoir à medium conviction minimum (ou strong si impact > 1%)
        if (diff.portfolio_impact_pct >= 1 || diff.conviction_level === 'medium') {
          mediumConvictionWithTrends.push(diff);
        } else {
          // Même avec impact faible, une accumulation sur 2+ trimestres mérite d'être en medium
          mediumConvictionWithTrends.push(diff);
        }
      }
      continue;
    }
    
    if (diff.conviction_level === 'noise') {
      noiseCountWithTrends++;
      continue;
    }
    
    if (diff.conviction_level === 'high') {
      strongConvictionWithTrends.push(diff);
    } else if (diff.conviction_level === 'medium') {
      mediumConvictionWithTrends.push(diff);
    } else {
      lowConvictionWithTrends.push(diff);
    }
  }
  
  // Séparer exits vs trims (avec tendances)
  const exits = strategicDiffsWithTrends.filter(d => d.is_exit);
  const trims = strategicDiffsWithTrends.filter(d => d.action === 'decrease' && !d.is_exit);
  const newPositions = strategicDiffsWithTrends.filter(d => d.action === 'new');
  
  // Calculer les flux sectoriels (avec les tendances)
  const sectorFlows = await calculateSectorFlows(strategicDiffsWithTrends, totalPortfolioValue);
  
  // Filtrer les secteurs "Unknown" pour le graphique
  const sectorFlowsFiltered = sectorFlows.filter(flow => flow.sector && flow.sector !== 'Unknown');
  const hasOnlyUnknownSectors = sectorFlows.length > 0 && sectorFlowsFiltered.length === 0;
  
  // Détecter rotation sectorielle (si > 20% du portefeuille change de secteur)
  // Utiliser les secteurs filtrés pour détecter la rotation (exclure "Unknown")
  const sectorRotationDetected = sectorFlowsFiltered.length > 0 && sectorFlowsFiltered.some(
    flow => Math.abs(flow.net_flow_pct) >= 20
  );
  
  // Calculer la valeur totale des changements (activité brute)
  const totalChangesValue = strategicDiffsWithTrends.reduce(
    (sum, d) => sum + Math.abs(d.diff_value),
    0
  );
  
  // Calculer Net Inflow (argent frais injecté) vs Net Outflow (argent retiré)
  // Utile pour le frontend pour distinguer injection vs retrait de capital
  const netInflow = strategicDiffsWithTrends
    .filter(d => d.action === 'new' || d.action === 'increase')
    .reduce((sum, d) => sum + Math.abs(d.diff_value), 0);
  
  const netOutflow = strategicDiffsWithTrends
    .filter(d => d.action === 'exit' || d.action === 'decrease')
    .reduce((sum, d) => sum + Math.abs(d.diff_value), 0);
  
  const filingDateNew = rawDiffs[0]?.filing_new?.filing_date || rawDiffs[0]?.filing_date_new || '';
  const filingDateOld = rawDiffs[0]?.filing_old?.filing_date || rawDiffs[0]?.filing_date_old || null;
  
  // Fonction de tri par priorité (utilisée pour all_movements et les listes individuelles)
  const sortByPriority = (a: StrategicDiff, b: StrategicDiff): number => {
    // Prioriser les accumulations sur 3+ trimestres (signal le plus fort pour un investisseur)
    const aIsStrongAccumulating = a.is_accumulating && a.trend_quarters && a.trend_quarters >= 3;
    const bIsStrongAccumulating = b.is_accumulating && b.trend_quarters && b.trend_quarters >= 3;
    
    if (aIsStrongAccumulating && !bIsStrongAccumulating) return -1;
    if (!aIsStrongAccumulating && bIsStrongAccumulating) return 1;
    
    // Si les deux sont des accumulations fortes, trier par nombre de trimestres décroissant
    if (aIsStrongAccumulating && bIsStrongAccumulating) {
      return (b.trend_quarters || 0) - (a.trend_quarters || 0);
    }
    
    // Prioriser les accumulations sur 2+ trimestres (signal pertinent)
    const aIsAccumulating = a.is_accumulating && a.trend_quarters && a.trend_quarters >= 2;
    const bIsAccumulating = b.is_accumulating && b.trend_quarters && b.trend_quarters >= 2;
    
    if (aIsAccumulating && !bIsAccumulating) return -1;
    if (!aIsAccumulating && bIsAccumulating) return 1;
    
    // Si les deux sont des accumulations (2+ trimestres), trier par nombre de trimestres décroissant
    if (aIsAccumulating && bIsAccumulating) {
      return (b.trend_quarters || 0) - (a.trend_quarters || 0);
    }
    
    // Sinon, trier par impact décroissant
    return b.portfolio_impact_pct - a.portfolio_impact_pct;
  };

  // Fusionner et trier tous les mouvements selon les préférences
  const allMovements = [
    ...strongConvictionWithTrends,
    ...mediumConvictionWithTrends,
    ...(includeLowConviction ? lowConvictionWithTrends : []),
  ].sort(sortByPriority);

  // Trier les listes individuelles aussi
  const sortedStrongConviction = [...strongConvictionWithTrends].sort(sortByPriority);
  const sortedMediumConviction = [...mediumConvictionWithTrends].sort((a, b) => {
    // Prioriser les accumulations dans medium conviction aussi
    if (a.is_accumulating && !b.is_accumulating) return -1;
    if (!a.is_accumulating && b.is_accumulating) return 1;
    return b.portfolio_impact_pct - a.portfolio_impact_pct;
  });
  const sortedLowConviction = [...lowConvictionWithTrends].sort((a, b) => b.portfolio_impact_pct - a.portfolio_impact_pct);

  return {
    fund_id: fundId,
    fund_name: fund?.name || 'Unknown',
    filing_date_new: filingDateNew,
    filing_date_old: filingDateOld,
    summary: {
      portfolio_value_latest_filing: totalPortfolioValue, // Valeur en milliers USD
      total_changes_value: totalChangesValue, // Valeur en milliers USD
      net_inflow: netInflow, // Valeur en milliers USD
      net_outflow: netOutflow, // Valeur en milliers USD
      strong_conviction_count: strongConvictionWithTrends.length,
      exits_count: exits.length,
      new_positions_count: newPositions.length,
      sector_rotation_detected: sectorRotationDetected,
    },
    strong_conviction_movements: sortedStrongConviction,
    medium_conviction_movements: sortedMediumConviction,
    low_conviction_movements: sortedLowConviction,
    noise_filtered_out: noiseCountWithTrends,
    sector_flows: sectorFlows.sort((a, b) => Math.abs(b.net_flow_pct) - Math.abs(a.net_flow_pct)),
    sector_flows_filtered: sectorFlowsFiltered.sort((a, b) => Math.abs(b.net_flow_pct) - Math.abs(a.net_flow_pct)),
    has_only_unknown_sectors: hasOnlyUnknownSectors,
    exits: exits.sort((a, b) => b.portfolio_impact_pct - a.portfolio_impact_pct),
    trims: trims.sort((a, b) => b.portfolio_impact_pct - a.portfolio_impact_pct),
    new_positions: newPositions.sort((a, b) => b.portfolio_impact_pct - a.portfolio_impact_pct),
    all_movements: allMovements,
    trends: trendsData,
  };
}

/**
 * Calcule les flux sectoriels
 */
async function calculateSectorFlows(
  strategicDiffs: StrategicDiff[],
  totalPortfolioValue: number
): Promise<SectorFlow[]> {
  const sectorMap = new Map<string, {
    inflow: number;
    outflow: number;
    tickers: Set<string>;
    movements: Array<{ ticker: string; action: string; value: number; impact_pct: number }>;
  }>();
  
  for (const diff of strategicDiffs) {
    const sector = diff.sector || 'Unknown';
    
    if (!sectorMap.has(sector)) {
      sectorMap.set(sector, {
        inflow: 0,
        outflow: 0,
        tickers: new Set(),
        movements: [],
      });
    }
    
    const sectorData = sectorMap.get(sector)!;
    sectorData.tickers.add(diff.ticker);
    
    // Inflow = nouveaux achats + augmentations
    // Outflow = exits + réductions
    if (diff.action === 'new' || diff.action === 'increase') {
      sectorData.inflow += Math.abs(diff.diff_value);
    } else if (diff.action === 'exit' || diff.action === 'decrease') {
      sectorData.outflow += Math.abs(diff.diff_value);
    }
    
    sectorData.movements.push({
      ticker: diff.ticker,
      action: diff.action,
      value: diff.diff_value,
      impact_pct: diff.portfolio_impact_pct,
    });
  }
  
  // Convertir en array et calculer net flows
  const sectorFlows: SectorFlow[] = [];
  
  for (const [sector, data] of sectorMap.entries()) {
    const netFlow = data.inflow - data.outflow;
    const netFlowPct = totalPortfolioValue > 0 ? (netFlow / totalPortfolioValue * 100) : 0;
    
    // Top 3 mouvements par secteur
    const topMovements = data.movements
      .sort((a, b) => Math.abs(b.impact_pct) - Math.abs(a.impact_pct))
      .slice(0, 3);
    
    sectorFlows.push({
      sector,
      inflow: data.inflow,
      outflow: data.outflow,
      net_flow: netFlow,
      net_flow_pct: netFlowPct,
      ticker_count: data.tickers.size,
      top_movements: topMovements,
    });
  }
  
  return sectorFlows;
}

/**
 * Détecte les tendances multi-trimestres (accumulation/distribution)
 * Analyse les diffs historiques pour identifier les positions accumulées/distribuées sur 2+ trimestres
 * Note: 2 trimestres = signal pertinent, 3+ trimestres = signal très fort pour un investisseur
 */
export async function detectMultiQuarterTrends(
  fundId: number,
  currentDiffs: StrategicDiff[]
): Promise<{
  accumulating_positions: Array<{
    ticker: string;
    quarters: number;
    total_added: number;
    avg_impact_per_quarter: number;
    is_strong_accumulation: boolean; // true si 3+ trimestres
  }>;
  distributing_positions: Array<{
    ticker: string;
    quarters: number;
    total_reduced: number;
    avg_impact_per_quarter: number;
    is_strong_distribution: boolean; // true si 3+ trimestres
  }>;
}> {
  // Récupérer au moins 6-8 filings parsés pour analyser les tendances sur plusieurs trimestres
  // Les 13F sortent tous les ~90 jours, donc 6 filings couvrent ~18 mois (6 trimestres)
  const { data: filings, error: filingsError } = await supabase
    .from("fund_filings")
    .select("id, filing_date")
    .eq("fund_id", fundId)
    .eq("status", "PARSED")
    .order("filing_date", { ascending: false })
    .limit(8); // Augmenter à 8 pour avoir plus de données historiques
  
  if (filingsError || !filings || filings.length < 2) {
    // Pas assez de données historiques pour détecter des tendances (besoin d'au moins 2 filings)
    return {
      accumulating_positions: [],
      distributing_positions: [],
    };
  }
  
  // Récupérer tous les diffs pour ces filings
  // IMPORTANT: Récupérer uniquement les diffs où filing_id_new est dans nos filings analysés
  // Cela garantit qu'on analyse les séquences historiques sur les trimestres récents
  // Note: On ne récupère pas les diffs où filing_id_old est dans nos filings car cela
  // pourrait inclure des diffs avec des filing_id_new très anciens (avant nos 8 filings)
  const filingIds = filings.map(f => f.id);
  
  // Récupérer tous les diffs (sans trier par filing_new.filing_date car c'est une relation)
  // On triera côté application après avoir récupéré les dates
  const { data: allDiffs, error: diffsError } = await supabase
    .from("fund_holdings_diff")
    .select(`
      id,
      ticker,
      action,
      diff_shares,
      diff_value,
      filing_id_new,
      filing_id_old,
      filing_new:fund_filings!filing_id_new(filing_date)
    `)
    .in("filing_id_new", filingIds)
    .eq("fund_id", fundId);
  
  if (diffsError || !allDiffs || allDiffs.length === 0) {
    return {
      accumulating_positions: [],
      distributing_positions: [],
    };
  }
  
  // Grouper les diffs par ticker et analyser les séquences consécutives
  const tickerTrendsMap = new Map<string, Array<{
    filing_date: string;
    action: string;
    diff_shares: number;
    diff_value: number;
    filing_id_new: number;
  }>>();
  
  // Grouper les diffs par ticker
  // TODO FUTURE: Utiliser le CUSIP (identifiant unique persistant) plutôt que le ticker
  // pour gérer les cas de scissions/fusions où le ticker change (ex: FB -> META, TWTR -> X)
  // Le CUSIP ne change presque jamais, contrairement au ticker qui peut changer lors de:
  // - Fusions/Acquisitions (ex: FB -> META)
  // - Changements de nom (ex: TWTR -> X)
  // - Scissions (ex: Alphabet -> GOOGL + GOOG)
  // 
  // Actuellement, un "Exit" de FB et un "New Position" de META seront traités comme deux
  // événements distincts au lieu d'une transition de ticker. Avec le CUSIP, on pourrait
  // détecter que c'est la même entreprise et continuer le suivi de l'accumulation.
  for (const diff of allDiffs) {
    if (!diff.ticker) continue;
    
    const tickerKey = diff.ticker.toUpperCase().trim();
    // Récupérer la date de filing depuis filing_new (relation Supabase)
    // Si filing_new est un objet avec filing_date, l'utiliser, sinon chercher dans filings
    let filingDate = '';
    if ((diff.filing_new as any)?.filing_date) {
      filingDate = (diff.filing_new as any).filing_date;
    } else {
      // Fallback: chercher la date dans la liste des filings récupérés
      const filing = filings.find(f => f.id === diff.filing_id_new);
      filingDate = filing?.filing_date || '';
    }
    
    if (!filingDate) {
      // Si on n'a pas de date, skip ce diff
      continue;
    }
    
    if (!tickerTrendsMap.has(tickerKey)) {
      tickerTrendsMap.set(tickerKey, []);
    }
    
    tickerTrendsMap.get(tickerKey)!.push({
      filing_date: filingDate,
      action: diff.action,
      diff_shares: diff.diff_shares || 0,
      diff_value: diff.diff_value || 0,
      filing_id_new: diff.filing_id_new,
    });
  }
  
  // Analyser les tendances pour chaque ticker
  const accumulatingPositions: Array<{
    ticker: string;
    quarters: number;
    total_added: number;
    avg_impact_per_quarter: number;
    is_strong_accumulation: boolean; // true si 3+ trimestres (signal très fort)
  }> = [];
  
  const distributingPositions: Array<{
    ticker: string;
    quarters: number;
    total_reduced: number;
    avg_impact_per_quarter: number;
    is_strong_distribution: boolean; // true si 3+ trimestres (signal très fort)
  }> = [];
  
  for (const [ticker, diffs] of tickerTrendsMap.entries()) {
    // Trier par date décroissante (plus récent en premier)
    diffs.sort((a, b) => new Date(b.filing_date).getTime() - new Date(a.filing_date).getTime());
    
    // Détecter accumulation : achat continu sur 2+ trimestres consécutifs (signal pertinent)
    // 2 trimestres = signal pertinent, 3+ trimestres = signal très fort
    // Un achat = action 'new' OU 'increase' avec diff_value > 0
    let accumulatingStreak = 0;
    let totalAdded = 0;
    let lastFilingDate: string | null = null;
    
    for (let i = 0; i < diffs.length; i++) {
      const diff = diffs[i];
      const isAccumulation = (diff.action === 'new' || diff.action === 'increase') && diff.diff_value > 0;
      
      // Vérifier si les filings sont consécutifs temporellement
      // Les 13F sortent tous les ~90 jours (~3 mois), mais on tolère jusqu'à 5 mois
      // pour gérer les cas où un trimestre est sauté (rare) ou si le parser a eu un raté
      if (lastFilingDate && i > 0) {
        const monthsDiff = (new Date(lastFilingDate).getTime() - new Date(diff.filing_date).getTime()) / (1000 * 60 * 60 * 24 * 30);
        // Si l'écart est > 5 mois (au lieu de 6), la séquence est brisée
        // 5 mois permet de gérer un trimestre sauté sans perdre tout l'historique
        if (monthsDiff > 5) {
          break;
        }
      }
      
      if (isAccumulation) {
        accumulatingStreak++;
        totalAdded += Math.abs(diff.diff_value);
        lastFilingDate = diff.filing_date;
      } else if (diff.action === 'exit' || (diff.action === 'decrease' && diff.diff_value < 0)) {
        // Si on rencontre une vente significative, la séquence d'accumulation est brisée
        // Mais on garde le streak actuel si on a déjà >= 2 trimestres
        break;
      } else {
        // Si action non-déterminée (ex: decrease avec diff_value = 0, ou action inconnue)
        // On continue à chercher des accumulations (peut être un trim partiel suivi d'un add)
        // On met à jour lastFilingDate pour continuer la vérification temporelle
        lastFilingDate = diff.filing_date;
      }
    }
    
    // Détecter accumulations sur 2+ trimestres (signal pertinent)
    // 2 trimestres = signal pertinent, 3+ trimestres = signal très fort
    if (accumulatingStreak >= 2) {
      accumulatingPositions.push({
        ticker,
        quarters: accumulatingStreak,
        total_added: totalAdded,
        avg_impact_per_quarter: totalAdded / accumulatingStreak,
        is_strong_accumulation: accumulatingStreak >= 3, // Signal très fort: 3+ trimestres
      });
    }
    
    // Détecter distribution : vente continue sur 3+ trimestres consécutifs
    let distributingStreak = 0;
    let totalReduced = 0;
    lastFilingDate = null;
    
    for (let i = 0; i < diffs.length; i++) {
      const diff = diffs[i];
      const isDistribution = diff.action === 'exit' || (diff.action === 'decrease' && diff.diff_value < 0);
      
      if (lastFilingDate && i > 0) {
        const monthsDiff = (new Date(lastFilingDate).getTime() - new Date(diff.filing_date).getTime()) / (1000 * 60 * 60 * 24 * 30);
        // Tolérance de 5 mois pour la distribution (cohérent avec l'accumulation)
        if (monthsDiff > 5) {
          break;
        }
      }
      
      if (isDistribution) {
        distributingStreak++;
        totalReduced += Math.abs(diff.diff_value);
        lastFilingDate = diff.filing_date;
      } else if (diff.action === 'new' || (diff.action === 'increase' && diff.diff_value > 0)) {
        // Si on rencontre un achat, la séquence de distribution est brisée
        break;
      } else {
        lastFilingDate = diff.filing_date;
      }
    }
    
    // Détecter distributions sur 2+ trimestres (signal pertinent)
    // 2 trimestres = signal pertinent, 3+ trimestres = signal très fort
    if (distributingStreak >= 2) {
      distributingPositions.push({
        ticker,
        quarters: distributingStreak,
        total_reduced: totalReduced,
        avg_impact_per_quarter: totalReduced / distributingStreak,
        is_strong_distribution: distributingStreak >= 3, // Signal très fort: 3+ trimestres
      });
    }
  }
  
  return {
    accumulating_positions: accumulatingPositions.sort((a, b) => b.quarters - a.quarters),
    distributing_positions: distributingPositions.sort((a, b) => b.quarters - a.quarters),
  };
}
