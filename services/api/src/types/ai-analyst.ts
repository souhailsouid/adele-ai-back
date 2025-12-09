/**
 * Types pour le service d'analyse IA
 */

export type ImpactLevel = "faible" | "moyen" | "élevé" | "critique";

export interface AIAnalysisResult {
  impact: ImpactLevel;
  reason: string;
  summary: string;
  recommendations?: string[];
  confidence?: number; // 0-100
  metadata?: Record<string, any>;
}

export interface FDAEventAnalysis {
  ticker: string;
  event_type: "FDA" | "Earnings" | "Other";
  phase?: string; // Pour FDA: "Phase 1", "Phase 2", "Phase 3", "PDUFA"
  description: string;
  date: string;
  market_cap?: string;
  historical_volatility?: string;
  analysis: AIAnalysisResult;
}

export interface CalendarSummaryRequest {
  date_range: {
    from: string; // YYYY-MM-DD
    to: string; // YYYY-MM-DD
  };
  events: Array<{
    ticker: string;
    type: "FDA" | "Earnings" | "Economic" | "Other";
    phase?: string;
    description: string;
    date: string;
    market_cap?: string;
    historical_volatility?: string;
    impact?: string; // "Low" | "Medium" | "High"
  }>;
}

export interface CalendarSummaryResponse {
  success: boolean;
  date_range: {
    from: string;
    to: string;
  };
  summary: string; // Résumé global de la semaine
  events_analysis: FDAEventAnalysis[];
  top_events: Array<{
    ticker: string;
    impact: ImpactLevel;
    reason: string;
    date: string;
  }>;
  cached: boolean;
  timestamp: string;
}

export interface OptionsFlowAnalysisRequest {
  ticker: string;
  signal_type: "unusual_options_flow" | "gamma_squeeze" | "dark_pool_spike" | "insider_activity";
  metrics: {
    volume_vs_avg?: number;
    call_put_ratio?: number;
    expirations?: string[];
    biggest_trade?: {
      size: number;
      direction: "call" | "put";
      strike?: number;
      expiry?: string;
    };
    total_premium?: number;
    unusual_volume?: boolean;
    // NOUVELLES métriques enrichies
    open_interest_change?: {
      total_change: number;
      call_oi_change: number;
      put_oi_change: number;
      max_oi_strikes?: Array<{
        strike: number;
        expiry: string;
        oi_change: number;
        type: "call" | "put";
      }>;
    };
    implied_volatility?: {
      current: number;
      percentile?: number; // IV percentile (0-100)
      vs_historical_avg?: number; // Différence vs moyenne historique
      skew?: number; // Put skew (négatif = puts plus chères)
    };
    volume_profile?: {
      by_strike?: Array<{
        strike: number;
        call_volume: number;
        put_volume: number;
      }>;
      by_expiry?: Array<{
        expiry: string;
        total_volume: number;
        call_ratio: number;
      }>;
    };
    unusual_activity?: {
      sweeps?: number;
      blocks?: number;
      largest_sweep?: {
        size: number;
        direction: "call" | "put";
        strike: number;
        expiry: string;
      };
    };
    max_pain?: {
      current: number;
      price_distance?: number; // Distance du prix actuel
      oi_at_max_pain?: number;
    };
    price_action?: {
      current_price: number;
      support?: number;
      resistance?: number;
      trend?: "bullish" | "bearish" | "neutral";
      rsi?: number;
      volume_trend?: "increasing" | "decreasing" | "stable";
    };
  };
  context?: {
    recent_news?: string[];
    upcoming_events?: Array<{
      type: string;
      date: string;
      description: string;
    }>;
    price_action?: string;
    historical_patterns?: {
      similar_flows_30d?: number;
      avg_price_move_after?: number;
    };
  };
}

export interface OptionsFlowAnalysisResponse {
  success: boolean;
  ticker: string;
  signal_type: string;
  analysis: {
    observation: string; // Ce que l'IA observe
    interpretation: string; // Ce que cela peut vouloir dire
    attention_level: ImpactLevel;
    strategy_hypothesis?: {
      primary: "gamma_squeeze" | "hedging" | "speculation" | "earnings_play" | "unknown";
      confidence: number; // 0-1
      reasoning: string;
    };
    key_insights: Array<{
      insight: string;
      impact: ImpactLevel;
      evidence?: string;
    }>;
    scenarios?: {
      bullish: {
        probability: number; // 0-1
        price_target?: number;
        conditions: string;
      };
      bearish: {
        probability: number;
        price_target?: number;
        conditions: string;
      };
      neutral: {
        probability: number;
        price_range?: [number, number];
        conditions: string;
      };
    };
    recommendations?: Array<{
      action: "buy_calls" | "buy_puts" | "sell_calls" | "sell_puts" | "spread" | "wait" | "avoid";
      strike?: number;
      expiry?: string;
      reasoning: string;
      risk_level: "low" | "medium" | "high";
    }>;
    warnings?: string[];
    next_signals_to_watch?: string[];
  };
  metrics: OptionsFlowAnalysisRequest["metrics"];
  cached: boolean;
  timestamp: string;
}

export interface InstitutionMoveAnalysisRequest {
  institution_cik: string;
  institution_name: string;
  ticker?: string; // Optionnel: analyser un ticker spécifique
  period?: "1M" | "3M" | "6M" | "1Y";
  holdings_data?: Array<{
    ticker: string;
    units: number;
    units_change: number;
    units_change_pct?: number; // +25%
    value: number;
    value_change?: number;
    date: string;
    // NOUVEAU: Données enrichies
    historical_positions?: Array<{
      date: string;
      units: number;
      value: number;
    }>;
    performance?: {
      entry_price?: number; // Prix moyen d'entrée
      current_price?: number;
      pnl?: number; // Profit non réalisé
      pnl_pct?: number; // +25%
      holding_period_days?: number;
    };
    sector?: string;
    market_cap?: "Large Cap" | "Mid Cap" | "Small Cap";
  }>;
  // NOUVEAU: Métriques de portefeuille
  portfolio_metrics?: {
    total_value: number;
    top_10_concentration?: number; // 45% dans top 10
    sector_exposure?: Record<string, number>; // { "Technology": 0.35, ... }
    market_cap_exposure?: Record<string, number>; // { "Large Cap": 0.60, ... }
    style?: "growth" | "value" | "momentum" | "blend";
    turnover_rate?: number; // 15% de turnover sur 3M
  };
  sector_rotation?: {
    increased?: Array<{
      sector: string;
      change: number; // +0.10
      new_exposure: number; // 0.35
    }>;
    decreased?: Array<{
      sector: string;
      change: number; // -0.05
      new_exposure: number; // 0.10
    }>;
  };
  market_context?: {
    spy_performance_3m?: number; // +0.08 (8%)
    sector_performance?: Record<string, number>; // { "Technology": 0.12, ... }
  };
  peer_comparison?: {
    similar_funds?: Array<{
      name: string;
      overlap: number; // 0.65 (65% overlap)
      correlation: number; // 0.85
    }>;
    unique_positions?: string[]; // Positions uniques à cette institution
  };
}

export interface InstitutionMoveAnalysisResponse {
  success: boolean;
  institution_cik: string;
  institution_name: string;
  analysis: {
    summary: string; // Résumé des mouvements en 4-5 lignes
    strategy_insight?: {
      primary_strategy: "sector_rotation" | "style_shift" | "conviction_building" | "risk_reduction" | "opportunistic" | "unknown";
      confidence: number; // 0-1
      reasoning: string;
      evidence?: string[];
    };
    key_moves: Array<{
      ticker: string;
      action: "buy" | "sell" | "hold" | "trim";
      magnitude: ImpactLevel;
      change_pct?: number; // +25%
      reason: string; // Explication en 2-3 lignes
      conviction_level?: "low" | "medium" | "high" | "very_high";
      copy_trade_potential?: "low" | "medium" | "high";
    }>;
    portfolio_analysis?: {
      concentration_risk: "low" | "medium" | "high";
      sector_bets?: Array<{
        sector: string;
        bet: "overweight" | "underweight" | "neutral";
        reasoning: string;
      }>;
      style_analysis?: {
        current_style: "growth" | "value" | "momentum" | "blend";
        style_shift: boolean;
        reasoning: string;
      };
    };
    performance_analysis?: {
      overall_performance: "outperforming" | "underperforming" | "in_line";
      top_performers?: Array<{
        ticker: string;
        pnl_pct: number;
        contribution: number; // Contribution au P&L total
      }>;
      underperformers?: Array<{
        ticker: string;
        pnl_pct: number;
        contribution: number;
      }>;
      insights?: string;
    };
    attention_level: ImpactLevel;
    copy_trade_opportunities?: Array<{
      ticker: string;
      action: "buy" | "sell";
      reasoning: string;
      risk_level: "low" | "medium" | "high";
      entry_strategy: "DCA sur 2 semaines" | "Entry immédiat" | "Wait for pullback";
    }>;
    warnings?: string[];
    next_moves_to_watch?: string[];
  };
  period?: string;
  cached: boolean;
  timestamp: string;
}

export interface TickerActivityAnalysisRequest {
  ticker: string;
  data: {
    options_flow?: any;
    dark_pool?: any;
    insiders?: any;
    short_interest?: any;
    institutional_ownership?: any;
    recent_news?: string[];
    upcoming_events?: string[];
  };
}

export interface TickerActivityAnalysisResponse {
  success: boolean;
  ticker: string;
  analysis: {
    overview: string; // Vue d'ensemble de l'activité
    key_signals: Array<{
      type: string;
      description: string;
      impact: ImpactLevel;
    }>;
    attention_level: ImpactLevel;
    narrative: string; // Récit humain de ce qui se passe
    recommendations?: string[];
  };
  cached: boolean;
  timestamp: string;
}







