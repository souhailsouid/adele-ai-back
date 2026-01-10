/**
 * Types pour le service Earnings Hub
 * Reproduction de l'interface Earnings Hub (ex: Carnival CCL)
 */

/**
 * Requête d'analyse Earnings Hub
 */
export interface EarningsHubRequest {
  /** Ticker à analyser */
  ticker: string;
  /** Nombre de trimestres à analyser (défaut: 16 = 4 ans) */
  quartersLimit?: number;
}

/**
 * Données d'un trimestre d'earnings
 */
export interface EarningsQuarter {
  /** Période (ex: "Q4 2025") */
  period: string;
  /** Date du rapport (ISO) */
  reportDate: string;
  /** Temps du rapport */
  reportTime: 'premarket' | 'postmarket' | 'unknown';
  /** EPS réel */
  epsActual: number;
  /** EPS estimé */
  epsEstimate: number;
  /** Surprise EPS en % */
  epsSurprise: number;
  /** Beat ou Miss */
  epsBeat: boolean;
  /** Mouvement du prix 1 jour après (%) */
  priceMove1d: number | null;
  /** Mouvement du prix 1 semaine après (%) */
  priceMove1w: number | null;
}

/**
 * Statistiques agrégées
 */
export interface EarningsStats {
  /** Capitalisation boursière (format: "40.1B") */
  marketCap: string;
  /** Ratio P/E */
  peRatio: number | null;
  /** Prix actuel */
  currentPrice: number;
  /** Nombre total de beats d'EPS */
  epsBeatsCount: number;
  /** Nombre total de trimestres analysés */
  totalQuarters: number;
  /** Taux de beat d'EPS (%) */
  epsBeatRate: number;
  /** Surprise moyenne d'EPS (%) */
  avgEpsSurprise: number;
}

/**
 * Analyse Earnings Hub
 */
export interface EarningsHubAnalysis {
  /** Ticker analysé */
  ticker: string;
  /** Statistiques */
  stats: EarningsStats;
  /** Dernier trimestre analysé */
  latestQuarter: EarningsQuarter | null;
  /** Historique des 4 dernières années (16 trimestres) */
  history: EarningsQuarter[];
  /** Insights générés automatiquement (règles déterministes) */
  insights: string[];
  /** Interprétation détaillée */
  interpretation: {
    summary: string;
    keyPoints: string[];
    trends: Array<{
      label: string;
      direction: 'improving' | 'deteriorating' | 'stable';
      evidence: string;
    }>;
  };
}

/**
 * Réponse Earnings Hub
 */
export interface EarningsHubResponse {
  success: boolean;
  analysis: EarningsHubAnalysis;
  timestamp: string;
}

