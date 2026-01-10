/**
 * Types pour le service Catalyst Calendar
 * Agrégation de tous les événements de marché (Macro, FDA, Earnings, Whale Alerts)
 */

/**
 * Type d'événement catalyst
 */
export type CatalystEventType = 
  | 'MACRO'      // Événements macro-économiques (CPI, FOMC, etc.)
  | 'EARNINGS'   // Publication de résultats
  | 'WHALE_RISK' // Alerte de risque de liquidation (convergence)

/**
 * Niveau d'impact d'un événement
 */
export type ImpactLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Événement catalyst unifié
 */
export interface CatalystEvent {
  /** ID unique de l'événement */
  id: string;
  /** Type d'événement */
  type: CatalystEventType;
  /** Date/heure de l'événement (ISO) */
  date: string;
  /** Titre de l'événement */
  title: string;
  /** Description détaillée */
  description: string;
  /** Ticker concerné (si applicable) */
  ticker: string | null;
  /** Niveau d'impact */
  impact: ImpactLevel;
  /** Icône/Emoji pour l'affichage */
  icon: string;
  /** Données spécifiques selon le type */
  metadata: {
    // Pour MACRO
    country?: string;
    currency?: string;
    previous?: number;
    estimate?: number;
    actual?: number;
    // Pour FDA
    fdaDate?: string;
    decisionType?: string;
    drug?: string;
    indication?: string;
    // Pour EARNINGS
    reportTime?: 'premarket' | 'postmarket' | 'unknown';
    expectedMove?: number;
    expectedMovePerc?: number;
    // Pour WHALE_RISK
    priceDistanceFromSupport?: number;
    liquidationRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
    whaleSupport?: number;
    currentPrice?: number;
  };
}

/**
 * Requête pour récupérer le calendrier catalyst
 */
export interface CatalystCalendarRequest {
  /** Date de début (YYYY-MM-DD) */
  startDate?: string;
  /** Date de fin (YYYY-MM-DD) */
  endDate?: string;
  /** Liste de tickers à surveiller pour les whale alerts */
  watchlist?: string[];
  /** Limite d'événements à retourner */
  limit?: number;
  /** Mode debug : retourne les statistiques de filtrage */
  debug?: boolean;
}

/**
 * Vue d'ensemble des earnings par entreprise
 */
export interface EarningsOverview {
  /** Ticker de l'entreprise */
  ticker: string;
  /** Nombre total d'earnings dans la plage */
  totalEarnings: number;
  /** Dates des earnings (triées) */
  dates: string[];
  /** Hub Score (si disponible) */
  hubScore?: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Impact moyen */
  avgImpact: ImpactLevel;
  /** Prochain earnings (date la plus proche) */
  nextEarnings?: {
    date: string;
    reportTime: 'premarket' | 'postmarket' | 'unknown';
    expectedMove?: number;
    expectedMovePerc?: number;
  };
  /** Tous les événements earnings pour ce ticker */
  events: CatalystEvent[];
}

/**
 * Réponse du calendrier catalyst
 */
export interface CatalystCalendarResponse {
  success: boolean;
  events: CatalystEvent[];
  summary: {
    total: number;
    byType: Record<CatalystEventType, number>;
    byImpact: Record<ImpactLevel, number>;
    criticalEvents: CatalystEvent[];
  };
  /** Vue d'ensemble des earnings par entreprise */
  earningsOverview?: {
    /** Nombre total d'entreprises avec earnings */
    totalCompanies: number;
    /** Liste des entreprises avec leurs statistiques */
    companies: EarningsOverview[];
    /** Statistiques globales */
    stats: {
      totalEarnings: number;
      premarket: number;
      afterhours: number;
      byImpact: Record<ImpactLevel, number>;
    };
  };
  timestamp: string;
  /** Statistiques de filtrage (uniquement si debug=true) */
  debug?: {
    apiResponses: {
      economicCalendar: { dataCount: number; sample?: any[] };
      earningsPremarket: { dataCount: number; sample?: any[] };
      earningsAfterhours: { dataCount: number; sample?: any[] };
    };
    filtering: {
      macro: { total: number; missingTime: number; filteredByDate: number; filteredByImpact: number; kept: number };
      earnings: { premarket: { total: number; missingDate: number; filteredByDate: number; kept: number }; afterhours: { total: number; missingDate: number; filteredByDate: number; kept: number } };
    };
  };
}

