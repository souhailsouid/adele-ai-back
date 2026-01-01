/**
 * Types pour le service de Convergence et Risque de Liquidation
 */

/**
 * Requête d'analyse de convergence
 */
export interface WhaleAnalysisRequest {
  /** Ticker à analyser */
  ticker: string;
  /** Nombre de transactions Dark Pool à considérer (défaut: 100) */
  darkPoolLimit?: number;
  /** Nombre d'alertes d'options à considérer (défaut: 200) */
  optionsLimit?: number;
  /** Prime minimum pour filtrer les options (défaut: 50000) */
  minPremium?: number;
  /** Filtre de date d'expiration : "YYYY-MM-DD", "tomorrow", "next_week" (optionnel) */
  expiryFilter?: string;
  /** Seuil de distance pour le risque de liquidation (défaut: 0.005 = 0.5%) */
  liquidationThreshold?: number;
}

/**
 * Analyse de convergence et risque de liquidation
 */
export interface WhaleAnalysis {
  /** Ticker analysé */
  ticker: string;
  /** Prix actuel du marché */
  currentPrice: number;
  /** Support Dark Pool (prix moyen pondéré par volume) */
  whaleSupport: number;
  /** Objectif d'expiration (strike moyen pondéré par premium) */
  targetStrike: number;
  /** Niveau de risque de liquidation */
  liquidationRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  /** Les baleines sont-elles en profit ? (currentPrice > whaleSupport) */
  isWhaleInProfit: boolean;
  /** Distance en pourcentage du prix actuel au support (positif = au-dessus, négatif = en-dessous) */
  priceDistanceFromSupport: number | null;
  /** Distance en pourcentage du prix actuel à l'objectif (positif = au-dessus, négatif = en-dessous) */
  priceDistanceFromTarget: number | null;
  /** Interprétation dynamique générée par règles (sans IA) */
  interpretation: {
    /** Résumé en 2-3 phrases */
    summary: string;
    /** Points clés à surveiller */
    keyPoints: string[];
    /** Scénarios possibles */
    scenarios: Array<{
      label: string;
      probability: 'low' | 'medium' | 'high';
      conditions: string;
    }>;
    /** Recommandation d'action */
    recommendation: 'monitor' | 'caution' | 'opportunity' | 'neutral';
  };
}

/**
 * Réponse d'analyse de convergence
 */
export interface WhaleAnalysisResponse {
  success: boolean;
  analysis: WhaleAnalysis;
  timestamp: string;
}

