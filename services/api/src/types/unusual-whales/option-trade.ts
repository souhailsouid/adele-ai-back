/**
 * Types pour les endpoints Unusual Whales - Option Trade
 * Basés sur la documentation officielle: https://api.unusualwhales.com/api
 */

import type { FinancialSector } from './earnings';
import type { IssueType } from './screener';

// ========== Flow Alerts ==========

/**
 * Nom de règle d'alerte
 */
export type AlertRuleName =
  | 'FloorTradeSmallCap'
  | 'FloorTradeMidCap'
  | 'RepeatedHits'
  | 'RepeatedHitsAscendingFill'
  | 'RepeatedHitsDescendingFill'
  | 'FloorTradeLargeCap'
  | 'OtmEarningsFloor'
  | 'LowHistoricVolumeFloor'
  | 'SweepsFollowedByFloor';

/**
 * Flow Alert
 * GET /option-trades/flow-alerts
 */
export interface FlowAlert {
  /** ID unique de l'alerte (UUID) - identifiant unique de chaque flow alert */
  id?: string; // Ex: "3da34725-d91e-4ad6-bb32-e259bdc8652d"
  /** Nom de la règle d'alerte */
  alert_rule: AlertRuleName; // Ex: "RepeatedHits"
  /** Toutes les transactions sont des transactions d'ouverture basées sur OI, Size & Volume */
  all_opening_trades: boolean; // Ex: false
  /** Timestamp UTC */
  created_at: string; // ISO timestamp: "2023-12-12T16:35:52.168490Z"
  /** Date d'expiration du contrat au format ISO */
  expiry: string; // ISO date: "2023-12-22"
  /** Nombre d'expirations appartenant au trade. N'est supérieur à 1 que si c'est un trade multi-leg */
  expiry_count: number; // Ex: 2
  /** A un floor */
  has_floor: boolean; // Ex: false
  /** Si le trade est un trade multi-leg */
  has_multileg: boolean; // Ex: false
  /** Si le trade est un trade single-leg */
  has_singleleg: boolean; // Ex: true
  /** Si le trade est un sweep */
  has_sweep: boolean; // Ex: true
  /** Type d'émission du ticker */
  issue_type: IssueType; // Ex: "Common Stock"
  /** Intérêt ouvert */
  open_interest: any;
  /** Symbole d'option du contrat */
  option_chain: string; // Ex: "MSFT231222C00375000"
  /** Prix */
  price: any;
  /** Strike du contrat */
  strike: string; // Ex: "375"
  /** Ticker */
  ticker: any;
  /** Prime totale côté ask */
  total_ask_side_prem: any;
  /** Prime totale côté bid */
  total_bid_side_prem: any;
  /** Prime totale */
  total_premium: any;
  /** Taille totale */
  total_size: any;
  /** Nombre de transactions */
  trade_count: any;
  /** Type de contrat */
  type: 'call' | 'put'; // Ex: "call"
  /** Prix sous-jacent */
  underlying_price: any;
  /** Volume */
  volume: any;
  /** Ratio volume/OI */
  volume_oi_ratio: any;
}

/**
 * Réponse de l'endpoint GET /option-trades/flow-alerts
 */
export interface OptionTradeFlowAlertsResponse {
  data: FlowAlert[];
}

/**
 * Paramètres de requête pour GET /option-trades/flow-alerts
 * NOTE: Ce endpoint a beaucoup de paramètres optionnels pour le filtrage
 */
export interface OptionTradeFlowAlertsQueryParams {
  /** Toutes les transactions sont des transactions d'ouverture (défaut: true) */
  all_opening?: boolean; // Default: true
  /** Transaction côté ask (défaut: true) */
  is_ask_side?: boolean; // Default: true
  /** Transaction côté bid (défaut: true) */
  is_bid_side?: boolean; // Default: true
  /** Transaction est un call (défaut: true) */
  is_call?: boolean; // Default: true
  /** Transaction est du floor (défaut: true) */
  is_floor?: boolean; // Default: true
  /** Transaction est multi-leg */
  is_multi_leg?: boolean;
  /** Inclure uniquement les contrats qui sont actuellement out of the money */
  is_otm?: boolean;
  /** Transaction est un put (défaut: true) */
  is_put?: boolean; // Default: true
  /** Transaction est un intermarket sweep (défaut: true) */
  is_sweep?: boolean; // Default: true
  /** Tableau de 1 ou plusieurs types d'émission */
  issue_types?: IssueType[];
  /** Nombre d'éléments à retourner (1-200, défaut: 100) */
  limit?: number; // Min: 1, Max: 200, Default: 100
  /** Pourcentage ask maximum (0 à 1) */
  max_ask_perc?: number; // Min: 0, Max: 1
  /** Pourcentage bear maximum (0 à 1) */
  max_bear_perc?: number; // Min: 0, Max: 1
  /** Pourcentage bid maximum (0 à 1) */
  max_bid_perc?: number; // Min: 0, Max: 1
  /** Pourcentage bull maximum (0 à 1) */
  max_bull_perc?: number; // Min: 0, Max: 1
  /** Diff OTM maximum d'un contrat */
  max_diff?: string;
  /** Jours jusqu'à expiration maximum (0+) */
  max_dte?: number; // Min: 0
  /** Changement IV maximum */
  max_iv_change?: number;
  /** Marketcap maximum (0+) */
  max_marketcap?: number; // Min: 0
  /** Intérêt ouvert maximum sur le contrat de l'alerte au moment de l'alerte (0+) */
  max_open_interest?: number; // Min: 0
  /** Prime maximum sur cette alerte (0+) */
  max_premium?: number; // Min: 0
  /** Prix maximum de l'actif sous-jacent (0+) */
  max_price?: number; // Min: 0
  /** Taille maximum sur cette alerte (0+) */
  max_size?: number; // Min: 0
  /** Ratio taille/volume maximum (0+) */
  max_size_vol_ratio?: number; // Min: 0
  /** Skew maximum (0 à 1) */
  max_skew?: number; // Min: 0, Max: 1
  /** Spread maximum (0+) */
  max_spread?: number; // Min: 0
  /** Volume maximum sur le contrat de l'alerte au moment de l'alerte (0+) */
  max_volume?: number; // Min: 0
  /** Ratio volume/OI maximum (0+) */
  max_volume_oi_ratio?: number; // Min: 0
  /** Pourcentage ask minimum (0 à 1) */
  min_ask_perc?: number; // Min: 0, Max: 1
  /** Pourcentage bear minimum (0 à 1) */
  min_bear_perc?: number; // Min: 0, Max: 1
  /** Pourcentage bid minimum (0 à 1) */
  min_bid_perc?: number; // Min: 0, Max: 1
  /** Pourcentage bull minimum (0 à 1) */
  min_bull_perc?: number; // Min: 0, Max: 1
  /** Diff OTM minimum d'un contrat */
  min_diff?: string;
  /** Jours jusqu'à expiration minimum (0+) */
  min_dte?: number; // Min: 0
  /** Changement IV minimum */
  min_iv_change?: number;
  /** Marketcap minimum (0+) */
  min_marketcap?: number; // Min: 0
  /** Intérêt ouvert minimum sur le contrat de l'alerte au moment de l'alerte (0+) */
  min_open_interest?: number; // Min: 0
  /** Prime minimum sur cette alerte (0+) */
  min_premium?: number; // Min: 0
  /** Prix minimum de l'actif sous-jacent (0+) */
  min_price?: number; // Min: 0
  /** Taille minimum sur cette alerte (0+) */
  min_size?: number; // Min: 0
  /** Ratio taille/volume minimum (0+) */
  min_size_vol_ratio?: number; // Min: 0
  /** Skew minimum (0 à 1) */
  min_skew?: number; // Min: 0, Max: 1
  /** Spread minimum (0+) */
  min_spread?: number; // Min: 0
  /** Volume minimum sur le contrat de l'alerte au moment de l'alerte (0+) */
  min_volume?: number; // Min: 0
  /** Ratio volume/OI minimum (0+) */
  min_volume_oi_ratio?: number; // Min: 0
  /** Temps Unix en millisecondes ou secondes à partir duquel aucun résultat plus ancien ne sera retourné */
  newer_than?: string; // Unix time or ISO date
  /** Temps Unix en millisecondes ou secondes à partir duquel aucun résultat plus récent ne sera retourné */
  older_than?: string; // Unix time or ISO date
  /** Tableau de 1 ou plusieurs noms de règles */
  rule_name?: AlertRuleName[];
  /** Inclure uniquement les alertes où la taille est supérieure à l'intérêt ouvert */
  size_greater_oi?: boolean;
  /** Liste de tickers séparés par des virgules. Pour exclure certains tickers, préfixer le premier ticker avec un - */
  ticker_symbol?: string; // Ex: "AAPL,INTC"
  /** Inclure uniquement les alertes où le volume est supérieur à l'intérêt ouvert */
  vol_greater_oi?: boolean;
}

// ========== Full Tape ==========

/**
 * Full Tape retourne un fichier ZIP
 * GET /option-trades/full-tape/{date}
 * 
 * NOTE: Cet endpoint retourne un fichier ZIP, pas du JSON
 * Il nécessite un traitement spécial dans le repository
 */
export interface FullTapeQueryParams {
  /** Aucun paramètre selon la documentation */
}

