/**
 * Types pour les endpoints Unusual Whales - Market
 * Basés sur la documentation officielle: https://api.unusualwhales.com/api
 */

import type { FinancialSector } from './earnings';

// ========== Correlations ==========

/**
 * Corrélation entre deux tickers
 * GET /market/correlations
 */
export interface Correlation {
  /** Premier ticker */
  fst: string; // Ex: "AAPL"
  /** Second ticker */
  snd: string; // Ex: "SPY"
  /** Corrélation entre les deux tickers */
  correlation: number; // Ex: 0.27936797861890483
  /** Date minimale */
  min_date: string; // ISO date: "2023-07-11"
  /** Date maximale */
  max_date: string; // ISO date: "2024-07-11"
  /** Nombre de points de données considérés */
  rows: number; // Ex: 253
}

/**
 * Réponse de l'endpoint GET /market/correlations
 */
export interface CorrelationsResponse {
  data: Correlation[];
}

/**
 * Paramètres de requête pour GET /market/correlations
 */
export interface CorrelationsQueryParams {
  /** Liste de tickers séparés par des virgules (requis). Pour exclure, préfixer avec - */
  tickers: string; // Ex: "AAPL,SPY" ou "-AAPL,INTC"
  /** Intervalle de temps (YTD, 1D, 2D, 1W, 2W, 1M, 2M, 1Y, 2Y, etc.) */
  interval?: string; // Ex: "1Y" (défaut: "1Y")
  /** Date de début au format YYYY-MM-DD */
  start_date?: string; // ISO date: "2023-01-01"
  /** Date de fin au format YYYY-MM-DD (défaut: date actuelle si start_date fourni) */
  end_date?: string; // ISO date: "2023-12-31"
}

// ========== Economic Calendar ==========

/**
 * Événement du calendrier économique (structure réelle de l'API UW)
 * GET /market/economic-calendar
 * 
 * Réponse réelle de l'API :
 * {
 *   "type": "report",
 *   "time": "2025-12-12T15:00:00Z",
 *   "prev": "0.0%",
 *   "event": "Wholesale inventories",
 *   "reported_period": "September",
 *   "forecast": null
 * }
 */
export interface EconomicEvent {
  /** Type d'événement */
  type: string; // "report" | "FOMC" | "fed-speaker" | "13F" | ...
  /** Date/heure ISO de l'événement */
  time: string; // ISO: "2025-12-10T19:00:00Z"
  /** Valeur précédente (format texte) */
  prev: string | null; // "0.9%" | "-59600000000" | "" | null
  /** Nom de l'événement */
  event: string; // "U.S. trade deficit", "FOMC interest-rate decision", ...
  /** Période rapportée */
  reported_period: string | null; // "September", "Q4", ... ou null
  /** Prévision (format texte) */
  forecast: string | null; // "0.9%" | "-61600000000" | null
}

/**
 * Réponse de l'endpoint GET /market/economic-calendar
 */
export interface EconomicCalendarResponse {
  data: EconomicEvent[];
}

/**
 * Paramètres de requête pour GET /market/economic-calendar
 */
export interface EconomicCalendarQueryParams {
  /** Date de trading au format YYYY-MM-DD (optionnel, défaut: dernière date de trading) */
  date?: string; // ISO date: "2024-01-18"
  /** Nombre d'éléments à retourner (1-500, défaut: 500) */
  limit?: number; // Min: 1, Max: 500, Default: 500
  /** Numéro de page (utiliser avec limit). Commence à la page 0 */
  page?: number; // Ex: 1
}

// ========== FDA Calendar ==========

/**
 * Événement du calendrier FDA
 * GET /market/fda-calendar
 */
export interface FDAEvent {
  /** Date de l'événement (date ISO) */
  date: string; // ISO date: "2024-01-09"
  /** Description de l'événement */
  description: string; // Ex: "FDA Approval"
  /** Ticker concerné */
  ticker: string; // Ex: "AAPL"
}

/**
 * Réponse de l'endpoint GET /market/fda-calendar
 */
export interface FDACalendarResponse {
  data: FDAEvent[];
}

/**
 * Paramètres de requête pour GET /market/fda-calendar
 */
export interface FDACalendarQueryParams {
  /** Date de trading au format YYYY-MM-DD (optionnel, défaut: dernière date de trading) */
  date?: string; // ISO date: "2024-01-18"
  /** Nombre d'éléments à retourner (1-500, défaut: 500) */
  limit?: number; // Min: 1, Max: 500, Default: 500
  /** Numéro de page (utiliser avec limit). Commence à la page 0 */
  page?: number; // Ex: 1
}

// ========== Insider Buy & Sells ==========

/**
 * Total des achats et ventes d'insiders
 * GET /market/insider-buy-sells
 */
export interface InsiderBuySell {
  /** Date (date ISO) */
  date: string; // ISO date: "2024-01-09"
  /** Total des achats */
  buys: number; // Ex: 1500000
  /** Total des ventes */
  sells: number; // Ex: 2000000
  /** Net (achats - ventes) */
  net: number; // Ex: -500000
}

/**
 * Réponse de l'endpoint GET /market/insider-buy-sells
 */
export interface InsiderBuySellsResponse {
  data: InsiderBuySell[];
}

/**
 * Paramètres de requête pour GET /market/insider-buy-sells
 */
export interface InsiderBuySellsQueryParams {
  /** Date de début (format YYYY-MM-DD) */
  start_date?: string; // ISO date: "2023-01-01"
  /** Date de fin (format YYYY-MM-DD) */
  end_date?: string; // ISO date: "2023-03-31"
  /** Nombre d'éléments à retourner (1-500, défaut: 500) */
  limit?: number; // Min: 1, Max: 500, Default: 500
  /** Numéro de page (utiliser avec limit). Commence à la page 0 */
  page?: number; // Ex: 1
}

// ========== Market Tide ==========

/**
 * Market Tide
 * GET /market/market-tide
 */
export interface MarketTide {
  /** Date (date ISO) */
  date: string; // ISO date: "2024-01-09"
  /** Valeur du market tide */
  tide: string; // Ex: "0.75"
}

/**
 * Réponse de l'endpoint GET /market/market-tide
 */
export interface MarketTideResponse {
  data: MarketTide[];
}

/**
 * Paramètres de requête pour GET /market/market-tide
 */
export interface MarketTideQueryParams {
  /** Date de trading au format YYYY-MM-DD (optionnel, défaut: dernière date de trading) */
  date?: string; // ISO date: "2024-01-18"
  /** Nombre d'éléments à retourner (1-500, défaut: 500) */
  limit?: number; // Min: 1, Max: 500, Default: 500
  /** Numéro de page (utiliser avec limit). Commence à la page 0 */
  page?: number; // Ex: 1
}

// ========== OI Change ==========

/**
 * Changement d'Open Interest
 * GET /market/oi-change
 */
export interface OIChange {
  /** Ticker */
  ticker: string; // Ex: "AAPL"
  /** Changement d'OI */
  oi_change: number; // Ex: 15000
  /** Date (date ISO) */
  date: string; // ISO date: "2024-01-09"
}

/**
 * Réponse de l'endpoint GET /market/oi-change
 */
export interface OIChangeResponse {
  data: OIChange[];
}

/**
 * Paramètres de requête pour GET /market/oi-change
 */
export interface OIChangeQueryParams {
  /** Date de trading au format YYYY-MM-DD (optionnel, défaut: dernière date de trading) */
  date?: string; // ISO date: "2024-01-18"
  /** Nombre d'éléments à retourner (1-500, défaut: 500) */
  limit?: number; // Min: 1, Max: 500, Default: 500
  /** Numéro de page (utiliser avec limit). Commence à la page 0 */
  page?: number; // Ex: 1
}

// ========== Sector ETFs ==========

/**
 * ETF sectoriel
 * GET /market/sector-etfs
 */
export interface SectorETF {
  /** Ticker de l'ETF */
  ticker: string; // Ex: "XLK"
  /** Nom de l'ETF */
  name: string; // Ex: "Technology Select Sector SPDR Fund"
  /** Secteur financier */
  sector: FinancialSector; // Ex: "Technology"
}

/**
 * Réponse de l'endpoint GET /market/sector-etfs
 */
export interface SectorETFsResponse {
  data: SectorETF[];
}

/**
 * Paramètres de requête pour GET /market/sector-etfs
 */
export interface SectorETFsQueryParams {
  /** Aucun paramètre selon la documentation */
}

// ========== SPIKE ==========

/**
 * SPIKE (indicateur de volatilité)
 * GET /market/spike
 */
export interface Spike {
  /** Ticker */
  ticker: string; // Ex: "AAPL"
  /** Valeur du SPIKE */
  spike: string; // Ex: "2.5"
  /** Date (date ISO) */
  date: string; // ISO date: "2024-01-09"
}

/**
 * Réponse de l'endpoint GET /market/spike
 */
export interface SpikeResponse {
  data: Spike[];
}

/**
 * Paramètres de requête pour GET /market/spike
 */
export interface SpikeQueryParams {
  /** Date de trading au format YYYY-MM-DD (optionnel, défaut: dernière date de trading) */
  date?: string; // ISO date: "2024-01-18"
  /** Nombre d'éléments à retourner (1-500, défaut: 500) */
  limit?: number; // Min: 1, Max: 500, Default: 500
  /** Numéro de page (utiliser avec limit). Commence à la page 0 */
  page?: number; // Ex: 1
}

// ========== Top Net Impact ==========

/**
 * Top Net Impact
 * GET /market/top-net-impact
 */
export interface TopNetImpact {
  /** Ticker */
  ticker: string; // Ex: "AAPL"
  /** Impact net */
  net_impact: string; // Ex: "1500000"
  /** Date (date ISO) */
  date: string; // ISO date: "2024-01-09"
}

/**
 * Réponse de l'endpoint GET /market/top-net-impact
 */
export interface TopNetImpactResponse {
  data: TopNetImpact[];
}

/**
 * Paramètres de requête pour GET /market/top-net-impact
 */
export interface TopNetImpactQueryParams {
  /** Date de trading au format YYYY-MM-DD (optionnel, défaut: dernière date de trading) */
  date?: string; // ISO date: "2024-01-18"
  /** Nombre d'éléments à retourner (1-500, défaut: 500) */
  limit?: number; // Min: 1, Max: 500, Default: 500
  /** Numéro de page (utiliser avec limit). Commence à la page 0 */
  page?: number; // Ex: 1
}

// ========== Total Options Volume ==========

/**
 * Volume total d'options
 * GET /market/total-options-volume
 */
export interface TotalOptionsVolume {
  /** Date (date ISO) */
  date: string; // ISO date: "2024-01-09"
  /** Volume total */
  volume: number; // Ex: 50000000
}

/**
 * Réponse de l'endpoint GET /market/total-options-volume
 */
export interface TotalOptionsVolumeResponse {
  data: TotalOptionsVolume[];
}

/**
 * Paramètres de requête pour GET /market/total-options-volume
 */
export interface TotalOptionsVolumeQueryParams {
  /** Date de trading au format YYYY-MM-DD (optionnel, défaut: dernière date de trading) */
  date?: string; // ISO date: "2024-01-18"
  /** Nombre d'éléments à retourner (1-500, défaut: 500) */
  limit?: number; // Min: 1, Max: 500, Default: 500
  /** Numéro de page (utiliser avec limit). Commence à la page 0 */
  page?: number; // Ex: 1
}

// ========== Sector Tide ==========

/**
 * Sector Tide
 * GET /market/{sector}/sector-tide
 */
export interface SectorTide {
  /** Date (date ISO) */
  date: string; // ISO date: "2024-01-09"
  /** Valeur du sector tide */
  tide: string; // Ex: "0.65"
}

/**
 * Réponse de l'endpoint GET /market/{sector}/sector-tide
 */
export interface SectorTideResponse {
  data: SectorTide[];
}

/**
 * Paramètres de requête pour GET /market/{sector}/sector-tide
 */
export interface SectorTideQueryParams {
  /** Date de trading au format YYYY-MM-DD (optionnel, défaut: dernière date de trading) */
  date?: string; // ISO date: "2024-01-18"
  /** Nombre d'éléments à retourner (1-500, défaut: 500) */
  limit?: number; // Min: 1, Max: 500, Default: 500
  /** Numéro de page (utiliser avec limit). Commence à la page 0 */
  page?: number; // Ex: 1
}

// ========== ETF Tide ==========

/**
 * ETF Tide
 * GET /market/{ticker}/etf-tide
 */
export interface ETFTide {
  /** Date (date ISO) */
  date: string; // ISO date: "2024-01-09"
  /** Valeur de l'ETF tide */
  tide: string; // Ex: "0.70"
}

/**
 * Réponse de l'endpoint GET /market/{ticker}/etf-tide
 */
export interface ETFTideResponse {
  data: ETFTide[];
}

/**
 * Paramètres de requête pour GET /market/{ticker}/etf-tide
 */
export interface ETFTideQueryParams {
  /** Date de trading au format YYYY-MM-DD (optionnel, défaut: dernière date de trading) */
  date?: string; // ISO date: "2024-01-18"
  /** Nombre d'éléments à retourner (1-500, défaut: 500) */
  limit?: number; // Min: 1, Max: 500, Default: 500
  /** Numéro de page (utiliser avec limit). Commence à la page 0 */
  page?: number; // Ex: 1
}

// ========== Net Flow Expiry ==========

/**
 * Net Flow par expiry
 * GET /net-flow/expiry
 */
export interface NetFlowExpiry {
  /** Date d'expiration (date ISO) */
  expiry: string; // ISO date: "2024-01-19"
  /** Net flow */
  net_flow: string; // Ex: "1500000"
  /** Date (date ISO) */
  date: string; // ISO date: "2024-01-09"
}

/**
 * Réponse de l'endpoint GET /net-flow/expiry
 */
export interface NetFlowExpiryResponse {
  data: NetFlowExpiry[];
}

/**
 * Paramètres de requête pour GET /net-flow/expiry
 */
export interface NetFlowExpiryQueryParams {
  /** Ticker (requis) */
  ticker: string;
  /** Date de trading au format YYYY-MM-DD (optionnel, défaut: dernière date de trading) */
  date?: string; // ISO date: "2024-01-18"
  /** Nombre d'éléments à retourner (1-500, défaut: 500) */
  limit?: number; // Min: 1, Max: 500, Default: 500
  /** Numéro de page (utiliser avec limit). Commence à la page 0 */
  page?: number; // Ex: 1
}

