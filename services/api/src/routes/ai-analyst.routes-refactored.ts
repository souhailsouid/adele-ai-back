/**
 * Route refactorisée : /ai/ticker-activity-analysis
 * Couche C : Synthèse globale - assemble only
 * 
 * Cette route :
 * - Lit les datasets disponibles depuis la base (pas d'API externe)
 * - Lit les analyses unitaires déjà calculées
 * - Construit un "pack" et fait une synthèse légère (LLM court)
 * - Objectif : < 5s de latence
 */

import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { aiAnalystService } from '../services/ai-analyst.service';
import { TickerDataIngestionService } from '../services/ticker-data-ingestion.service';
import { UnitAnalysisService } from '../services/unit-analysis.service';
import { supabase } from '../services/supabase';
import { logger } from '../utils/logger';
import type { TickerActivityAnalysisRequest } from '../types/ai-analyst';

function getBody(event: APIGatewayProxyEventV2): any {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

const ingestionService = new TickerDataIngestionService();
const unitAnalysisService = new UnitAnalysisService();

/**
 * Route refactorisée : Synthèse globale (assemble only)
 * 
 * POST /ai/ticker-activity-analysis
 * Body: { "ticker": "NVDA", "modules": ["options_flow", "dark_pool", ...] } // modules optionnel
 */
export const tickerActivityAnalysisRefactored = {
  method: 'POST',
  path: '/ai/ticker-activity-analysis',
  handler: async (event: APIGatewayProxyEventV2) => {
    const body = getBody(event);

    if (!body.ticker) {
      throw new Error('Missing required field: ticker');
    }

    const ticker = body.ticker.toUpperCase();
    const requestedModules = body.modules || [
      'options_flow',
      'options_volume',
      'oi_change',
      'greeks',
      'max_pain',
      'dark_pool',
      'short_interest',
      'insiders',
      'institutional_ownership',
      'price_action',
    ];

    logger.info('Starting ticker activity analysis (refactored)', { ticker, requestedModules });

    // 1. Vérifier l'état des modules (très rapide, lecture en base)
    const moduleStates = await ingestionService.getAllModulesState(ticker);
    const moduleStatusMap = new Map(moduleStates.map((s) => [s.module_id, s]));

    // 2. Identifier les modules manquants ou stale
    const missingOrStaleModules = requestedModules.filter((moduleId: string) => {
      const state = moduleStatusMap.get(moduleId as any);
      return !state || 
             state.status === 'missing' || 
             state.status === 'error' ||
             (state.status === 'ready' && state.expires_at && new Date(state.expires_at) < new Date());
    });

    // 3. Si des modules sont manquants, déclencher l'ingestion en arrière-plan (optionnel)
    // Pour l'instant, on continue avec ce qui est disponible
    if (missingOrStaleModules.length > 0) {
      logger.info('Some modules are missing or stale, triggering background ingestion', {
        ticker,
        missingModules: missingOrStaleModules,
      });
      // Optionnel : déclencher l'ingestion en arrière-plan (ne pas attendre)
      ingestionService.ingestMultipleModules(ticker, missingOrStaleModules as any).catch((err) => {
        logger.error('Background ingestion failed', { ticker, error: err });
      });
    }

    // 4. Lire les analyses unitaires depuis la base (très rapide)
    const unitAnalyses = await unitAnalysisService.getUnitAnalyses(ticker, requestedModules as any);

    // 5. Lire les données brutes depuis la base (pour contexte supplémentaire)
    const rawData: any = {
      options_flow: null,
      dark_pool: null,
      short_interest: null,
      price_action: null,
    };

    // Options Flow
    const { data: optionsFlowData } = await supabase
      .from('options_flow')
      .select('*')
      .eq('ticker', ticker)
      .gt('expires_at', new Date().toISOString())
      .eq('is_empty_marker', false)
      .order('date', { ascending: false })
      .limit(20);

    if (optionsFlowData && optionsFlowData.length > 0) {
      rawData.options_flow = {
        total_volume: optionsFlowData.reduce((sum, f) => sum + (f.volume || 0), 0),
        call_volume: optionsFlowData.reduce((sum, f) => sum + (f.call_volume || 0), 0),
        put_volume: optionsFlowData.reduce((sum, f) => sum + (f.put_volume || 0), 0),
        data: optionsFlowData.slice(0, 20),
        data_count: optionsFlowData.length,
      };
    }

    // Dark Pool
    const { data: darkPoolData } = await supabase
      .from('dark_pool_trades')
      .select('*')
      .eq('ticker', ticker)
      .gt('expires_at', new Date().toISOString())
      .eq('is_empty_marker', false)
      .order('date', { ascending: false })
      .limit(10);

    if (darkPoolData && darkPoolData.length > 0) {
      rawData.dark_pool = {
        total_volume: darkPoolData.reduce((sum, d) => sum + (d.volume || d.size || 0), 0),
        largest_trade: darkPoolData.reduce((max, d) => {
          const vol = d.volume || d.size || 0;
          return vol > (max?.volume || 0) ? { ...d, volume: vol } : max;
        }, null),
        count: darkPoolData.length,
        data: darkPoolData,
      };
    }

    // Short Interest
    const { data: shortInterestData } = await supabase
      .from('short_interest')
      .select('*')
      .eq('ticker', ticker)
      .gt('expires_at', new Date().toISOString())
      .eq('is_empty_marker', false)
      .order('data_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (shortInterestData) {
      rawData.short_interest = {
        short_interest: shortInterestData.short_interest,
        float: shortInterestData.float,
        ratio: shortInterestData.short_interest_ratio,
        days_to_cover: shortInterestData.days_to_cover,
      };
    }

    // Price Action
    const { data: quoteData } = await supabase
      .from('ticker_quotes')
      .select('*')
      .eq('ticker', ticker)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (quoteData) {
      rawData.price_action = {
        current_price: quoteData.price,
        price_change_pct: quoteData.change_percent,
        volume: quoteData.volume,
      };
    }

    // 6. Construire le pack de données pour l'IA
    const enrichedData = {
      options_flow: rawData.options_flow,
      dark_pool: rawData.dark_pool,
      short_interest: rawData.short_interest,
      price_action: rawData.price_action,
      // Ajouter les analyses unitaires
      unit_analyses: unitAnalyses.reduce((acc, analysis) => {
        acc[analysis.module] = {
          signals: analysis.signals,
          summary: analysis.summary,
          confidence: analysis.confidence,
          metrics: analysis.metrics,
        };
        return acc;
      }, {} as Record<string, any>),
      meta: {
        modules_status: moduleStates.reduce((acc, state) => {
          acc[state.module_id] = state.status;
          return acc;
        }, {} as Record<string, string>),
        fetched_at: new Date().toISOString(),
      },
    };

    // 7. Construire la requête pour l'IA (format existant)
    const request: TickerActivityAnalysisRequest = {
      ticker,
      data: {
        options_flow: enrichedData.options_flow,
        dark_pool: enrichedData.dark_pool,
        short_interest: enrichedData.short_interest,
        price_action: enrichedData.price_action,
        recent_news: [],
        upcoming_events: [],
        meta: {
          options_flow_status: rawData.options_flow ? 'ok' : 'error',
          dark_pool_status: rawData.dark_pool ? 'ok' : 'error',
          short_interest_status: rawData.short_interest ? 'ok' : 'error',
          price_status: rawData.price_action ? 'ok' : 'error',
          fetched_at: new Date().toISOString(),
        },
      },
    };

    // 8. Appeler l'IA pour la synthèse (prompt court, données déjà structurées)
    return await aiAnalystService.analyzeTickerActivity(request);
  },
};





