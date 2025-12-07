/**
 * Types pour le service de scoring automatique
 */

// ========== Score Composite ==========

export interface TickerScoreResponse {
  success: boolean;
  data: TickerScore;
  cached: boolean;
  timestamp: string;
}

export interface TickerScore {
  ticker: string;
  overall: number; // 0-100
  breakdown: ScoreBreakdown;
  recommendation: Recommendation;
  confidence: number; // 0-100
  signals: ScoreSignals;
}

export interface ScoreBreakdown {
  options: number; // 0-100
  insiders: number; // 0-100
  darkPool: number; // 0-100
  shortInterest: number; // 0-100
  greeks: number; // 0-100
}

export interface ScoreSignals {
  options: OptionsSignal;
  insiders: InsidersSignal;
  darkPool: DarkPoolSignal;
  shortInterest: ShortInterestSignal;
  greeks: GreeksSignal;
}

export interface OptionsSignal {
  score: number; // 0-100
  callPutRatio: number;
  callVolume: number;
  putVolume: number;
  unusualActivity: number;
  interpretation: string;
}

export interface InsidersSignal {
  score: number; // 0-100
  buys: number;
  sells: number;
  netActivity: number;
  interpretation: string;
}

export interface DarkPoolSignal {
  score: number; // 0-100
  trades: number;
  volume: number;
  interpretation: string;
}

export interface ShortInterestSignal {
  score: number; // 0-100
  shortPercentOfFloat: number;
  daysToCover: number;
  interpretation: string;
}

export interface GreeksSignal {
  score: number; // 0-100
  gamma: number;
  delta: number;
  theta: number;
  vega: number;
  maxPain: number;
  interpretation: string;
}

export type Recommendation = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

// ========== Pondérations des scores ==========

export interface ScoreWeights {
  options: number; // 0.3 (30%)
  insiders: number; // 0.2 (20%)
  darkPool: number; // 0.2 (20%)
  shortInterest: number; // 0.15 (15%)
  greeks: number; // 0.15 (15%)
}

// Note: DEFAULT_SCORE_WEIGHTS a été déplacé dans scoring.service.ts pour éviter les problèmes d'import au runtime
// Si besoin, utiliser la constante inline dans le service

