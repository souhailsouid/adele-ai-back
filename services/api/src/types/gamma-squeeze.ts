/**
 * Types pour le service de détection de Gamma Squeeze
 */

export interface GammaSqueezeIndicators {
  /** GEX (Gamma Exposure) en millions de dollars */
  gex: number;
  /** Ratio de flow de calls vs puts (0-1+) */
  callFlowRatio: number;
  /** Ratio de short interest vs float (0-1+) */
  shortRatio: number;
  /** Niveau de gamma moyen (0-100) */
  gammaLevel: number;
}

export interface GammaSqueezeAnalysis {
  ticker: string;
  /** Probabilité de gamma squeeze (0-100) */
  squeezeProbability: number;
  /** Indicateurs calculés */
  indicators: GammaSqueezeIndicators;
  /** Niveau de risque (low, medium, high, extreme) */
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  /** Recommandation basée sur l'analyse */
  recommendation: {
    action: 'buy' | 'hold' | 'sell' | 'avoid';
    confidence: number; // 0-100
    reasoning: string;
  };
  /** Estimation du timeframe pour un potentiel squeeze */
  timeframe: {
    min: number; // jours
    max: number; // jours
    confidence: number; // 0-100
  };
  /** Timestamp de l'analyse */
  timestamp: string;
}

export interface GammaSqueezeResponse {
  success: boolean;
  data: GammaSqueezeAnalysis;
  cached: boolean;
  timestamp: string;
}

