/**
 * Types pour les analyses combinées FMP + Unusual Whales
 */

// ========== Analyse Complète ==========

export interface CompleteAnalysisResponse {
  success: boolean;
  data: CompleteAnalysis;
  cached: boolean;
  timestamp: string;
}

export interface CompleteAnalysis {
  ticker: string;
  fundamental: FundamentalAnalysis;
  sentiment: SentimentAnalysis;
  convergence: ConvergenceAnalysis;
  recommendation: Recommendation;
  confidence: number; // 0-100
}

export interface FundamentalAnalysis {
  score: number; // 0-100
  undervalued: boolean;
  strongRatios: boolean;
  growingRevenue: boolean;
  strongBalanceSheet: boolean;
  positiveCashFlow: boolean;
  details: {
    peRatio?: number;
    debtToEquity?: number;
    revenueGrowth?: number;
    earningsGrowth?: number;
    currentRatio?: number;
    returnOnEquity?: number;
  };
}

export interface SentimentAnalysis {
  score: number; // 0-100
  bullishOptions: boolean;
  darkPoolActivity: boolean;
  lowShortInterest: boolean;
  institutionalBuying: boolean;
  insiderBuying: boolean;
  details: {
    callPutRatio?: number;
    darkPoolTrades?: number;
    shortPercentOfFloat?: number;
    institutionalNetActivity?: number;
    insiderNetActivity?: number;
  };
}

export interface ConvergenceAnalysis {
  aligned: boolean; // Fundamentals et sentiment alignés
  divergence: number; // Différence entre scores (-100 à +100)
  type: 'bullish_aligned' | 'bearish_aligned' | 'bullish_divergence' | 'bearish_divergence';
  opportunity: boolean; // Opportunité si divergence significative
}

export type Recommendation = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

// ========== Détection de Divergences ==========

export interface DivergenceAnalysisResponse {
  success: boolean;
  data: DivergenceAnalysis;
  cached: boolean;
  timestamp: string;
}

export interface DivergenceAnalysis {
  ticker: string;
  fundamentalScore: number; // 0-100
  sentimentScore: number; // 0-100
  divergence: number; // Positif = fundamentals meilleurs que sentiment
  type: DivergenceType;
  opportunity: OpportunityAnalysis;
  signals: {
    fundamental: FundamentalSignals;
    sentiment: SentimentSignals;
  };
}

export type DivergenceType =
  | 'fundamental_bullish_sentiment_bearish' // Opportunité d'achat
  | 'fundamental_bearish_sentiment_bullish' // Risque de vente
  | 'aligned_bullish' // Tout est positif
  | 'aligned_bearish'; // Tout est négatif

export interface OpportunityAnalysis {
  isOpportunity: boolean;
  type: 'buy' | 'sell' | 'hold';
  confidence: number; // 0-100
  reasoning: string;
  timeframe?: string; // "short-term", "medium-term", "long-term"
}

export interface FundamentalSignals {
  revenueGrowth: number;
  earningsGrowth: number;
  peRatio: number;
  debtToEquity: number;
  returnOnEquity: number;
  currentRatio: number;
}

export interface SentimentSignals {
  optionsFlow: number; // Net flow (calls - puts)
  darkPoolActivity: number; // Nombre de trades
  shortInterest: number; // % of float
  institutionalActivity: number; // Net activity
  insiderActivity: number; // Net activity
}

// ========== Valuation Complète ==========

export interface ComprehensiveValuationResponse {
  success: boolean;
  data: ComprehensiveValuation;
  cached: boolean;
  timestamp: string;
}

export interface ComprehensiveValuation {
  ticker: string;
  currentPrice: number;
  fundamentalValue: number; // DCF value
  leveredValue: number; // Levered DCF value
  sentimentMultiplier: number; // 0.8 - 1.2
  adjustedValue: number; // fundamentalValue * sentimentMultiplier
  upside: number; // % upside/downside
  recommendation: Recommendation;
  confidence: number; // 0-100
  breakdown: {
    dcf: number;
    leveredDcf: number;
    sentimentAdjustment: number;
  };
}

// ========== Prédiction d'Earnings ==========

export interface EarningsPredictionResponse {
  success: boolean;
  data: EarningsPrediction;
  cached: boolean;
  timestamp: string;
}

export interface EarningsPrediction {
  ticker: string;
  earningsDate: string;
  predictedSurprise: number; // En %
  confidence: number; // 0-100
  signals: EarningsSignals;
  recommendation: Recommendation;
  historicalContext?: {
    averageSurprise: number;
    beatRate: number; // % de fois qu'ils ont battu
  };
}

export interface EarningsSignals {
  options: OptionsSignal;
  insiders: InsiderSignal;
  darkPool: DarkPoolSignal;
  analysts: AnalystSignal;
  historical: HistoricalSignal;
}

export interface OptionsSignal {
  score: number; // 0-100
  callVolume: number;
  putVolume: number;
  callPutRatio: number;
  unusualActivity: number;
  interpretation: string;
}

export interface InsiderSignal {
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

export interface AnalystSignal {
  score: number; // 0-100
  upgrades: number;
  downgrades: number;
  consensus: string;
  interpretation: string;
}

export interface HistoricalSignal {
  score: number; // 0-100
  averageSurprise: number;
  beatRate: number;
  pattern: string;
  interpretation: string;
}

// ========== Screening Multi-Critères ==========

export interface ScreeningCriteria {
  // FMP Criteria
  minMarketCap?: number;
  maxMarketCap?: number;
  maxPERatio?: number;
  minPERatio?: number;
  minDividend?: number;
  minRevenueGrowth?: number;
  maxDebtToEquity?: number;
  minReturnOnEquity?: number;
  
  // UW Criteria
  minSentimentScore?: number;
  minOptionsPremium?: number;
  maxShortInterest?: number; // % of float
  minInstitutionalOwnership?: number;
  minDarkPoolActivity?: number;
  
  // General
  sector?: string;
  exchange?: string;
  limit?: number;
}

export interface MultiCriteriaScreenerResponse {
  success: boolean;
  data: ScreenedTicker[];
  cached: boolean;
  count: number;
  timestamp: string;
}

export interface ScreenedTicker {
  symbol: string;
  name: string;
  fundamentalScore: number;
  sentimentScore: number;
  combinedScore: number;
  currentPrice: number;
  marketCap: number;
  peRatio?: number;
  details: {
    revenueGrowth?: number;
    debtToEquity?: number;
    optionsFlow?: number;
    shortInterest?: number;
    institutionalOwnership?: number;
  };
}

// ========== Analyse de Risque ==========

export interface RiskAnalysisResponse {
  success: boolean;
  data: RiskAnalysis;
  cached: boolean;
  timestamp: string;
}

export interface RiskAnalysis {
  ticker: string;
  overallRisk: number; // 0-100 (0 = pas de risque, 100 = risque très élevé)
  breakdown: {
    financial: FinancialRisk;
    market: MarketRisk;
    liquidity: LiquidityRisk;
  };
  recommendations: RiskRecommendation[];
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
}

export interface FinancialRisk {
  score: number; // 0-100
  factors: {
    debtLevel: 'low' | 'medium' | 'high';
    cashFlow: 'positive' | 'negative' | 'volatile';
    profitability: 'strong' | 'weak' | 'negative';
    leverage: number;
  };
}

export interface MarketRisk {
  score: number; // 0-100
  factors: {
    shortInterest: 'low' | 'medium' | 'high';
    volatility: 'low' | 'medium' | 'high';
    optionsFlow: 'bullish' | 'neutral' | 'bearish';
    darkPoolActivity: 'low' | 'medium' | 'high';
  };
}

export interface LiquidityRisk {
  score: number; // 0-100
  factors: {
    averageVolume: 'low' | 'medium' | 'high';
    bidAskSpread: 'tight' | 'medium' | 'wide';
    optionsLiquidity: 'low' | 'medium' | 'high';
  };
}

export interface RiskRecommendation {
  type: 'reduce_position' | 'hedge' | 'monitor' | 'safe';
  reasoning: string;
  priority: 'low' | 'medium' | 'high';
}

// ========== Tracking d'Institutions ==========

export interface InstitutionTrackingResponse {
  success: boolean;
  data: InstitutionTracking;
  cached: boolean;
  timestamp: string;
}

export interface InstitutionTracking {
  institutionName: string;
  totalHoldings: number;
  recentActivity: InstitutionActivity[];
  positionChanges: PositionChange[];
  topPositions: TopPosition[];
  sectorExposure: SectorExposure[];
  performance: InstitutionPerformance;
}

export interface InstitutionActivity {
  ticker: string;
  transactionType: 'BUY' | 'SELL';
  shares: number;
  value: number;
  date: string;
  price: number;
}

export interface PositionChange {
  ticker: string;
  type: 'NEW' | 'INCREASED' | 'DECREASED' | 'CLOSED';
  sharesChange: number;
  valueChange: number;
  date: string;
}

export interface TopPosition {
  ticker: string;
  shares: number;
  value: number;
  percentage: number;
  change: number; // % change
}

export interface SectorExposure {
  sector: string;
  percentage: number;
  value: number;
}

export interface InstitutionPerformance {
  period: '1M' | '3M' | '6M' | '1Y';
  return: number; // %
  sharpeRatio?: number;
  topPerformers: string[]; // Tickers
  underPerformers: string[]; // Tickers
}

// ========== Analyse de Secteur ==========

export interface SectorAnalysisResponse {
  success: boolean;
  data: SectorAnalysis;
  cached: boolean;
  timestamp: string;
}

export interface SectorAnalysis {
  sector: string;
  averagePE: number;
  averageGrowth: number;
  sentiment: SectorSentiment;
  etfFlows: ETFFlow[];
  topPerformers: SectorTicker[];
  recommendations: SectorRecommendation[];
}

export interface SectorSentiment {
  score: number; // 0-100
  tide: 'bullish' | 'neutral' | 'bearish';
  optionsFlow: number;
  institutionalActivity: number;
}

export interface ETFFlow {
  symbol: string;
  name: string;
  inflow: number;
  outflow: number;
  netFlow: number;
}

export interface SectorTicker {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  peRatio?: number;
  revenueGrowth?: number;
}

export interface SectorRecommendation {
  type: 'overweight' | 'underweight' | 'neutral';
  reasoning: string;
  topPicks: string[]; // Tickers
}

