/**
 * Routes d'analyses unitaires
 * Couche B : Une analyse = un module
 * 
 * Ces routes lisent les données en base, exécutent une analyse "petite" (LLM ou règles),
 * écrivent un résultat structuré en base
 */

import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { UnitAnalysisService } from '../services/unit-analysis.service';
import { aiAnalystService } from '../services/ai-analyst.service';
import { logger } from '../utils/logger';
import type { ModuleId } from '../services/ticker-data-ingestion.service';

function getQueryParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.queryStringParameters?.[key];
}

const unitAnalysisService = new UnitAnalysisService();

export const unitAnalysisRoutes = [
  /**
   * POST /analyze/options-flow?ticker=NVDA
   * Analyser le module options_flow (analyse unitaire + IA)
   * Lit depuis Supabase et fait une analyse IA
   */
  {
    method: 'POST',
    path: '/analyze/options-flow',
    handler: async (event: APIGatewayProxyEventV2) => {
      const ticker = getQueryParam(event, 'ticker');
      if (!ticker) {
        throw new Error('Missing required parameter: ticker');
      }

      const upperTicker = ticker.toUpperCase();

      // 1. Analyse unitaire (règles simples)
      const unitResult = await unitAnalysisService.analyzeOptionsFlow(upperTicker);
      
      // 2. Analyse IA (si les données sont disponibles)
      let aiAnalysis = null;
      let callPutRatio: number | null = null;
      let totalPremium: number | null = null;
      
      if (unitResult) {
        try {
          const { supabase } = await import('../supabase');
          const { data: flowData } = await supabase
            .from('options_flow')
            .select('*')
            .eq('ticker', upperTicker)
            .gt('expires_at', new Date().toISOString())
            .eq('is_empty_marker', false)
            .order('cached_at', { ascending: false })
            .limit(100);

          if (flowData && flowData.length > 0) {
            // Calculer les métriques pour l'IA
            const totalVolume = flowData.reduce((sum: number, f: any) => sum + (f.volume || 0), 0);
            const callVolume = flowData.reduce((sum: number, f: any) => sum + (f.call_volume || 0), 0);
            const putVolume = flowData.reduce((sum: number, f: any) => sum + (f.put_volume || 0), 0);
            callPutRatio = putVolume > 0 ? callVolume / putVolume : callVolume > 0 ? 999 : 0;
            totalPremium = flowData.reduce((sum: number, f: any) => sum + (f.total_premium || f.premium || 0), 0);
            const biggestTrade = flowData.reduce(
              (max: any, f: any) => ((f.premium || f.total_premium || 0) > (max?.premium || max?.total_premium || 0) ? f : max),
              null
            );

            const analysisRequest = {
              ticker: upperTicker,
              signal_type: 'unusual_options_flow' as const,
              metrics: {
                call_put_ratio: callPutRatio,
                total_premium: totalPremium,
                biggest_trade: biggestTrade ? {
                  size: biggestTrade.volume || 0,
                  direction: (biggestTrade.type || 'call').toLowerCase() as 'call' | 'put',
                  strike: biggestTrade.strike,
                  expiry: biggestTrade.expiry,
                } : undefined,
              },
              raw_data: flowData.slice(0, 20),
            };

            aiAnalysis = await aiAnalystService.analyzeOptionsFlow(analysisRequest);
          }
        } catch (error: any) {
          logger.warn('Failed to generate AI analysis', { ticker: upperTicker, error: error.message });
        }
      }
      
      return {
        success: unitResult !== null,
        ticker: upperTicker,
        module: 'options_flow',
        unit_analysis: unitResult,
        ai_analysis: aiAnalysis?.analysis || null,
        metrics: aiAnalysis && callPutRatio !== null && totalPremium !== null ? {
          call_put_ratio: callPutRatio,
          total_premium: totalPremium,
        } : null,
        timestamp: new Date().toISOString(),
      };
    },
  },

  /**
   * POST /analyze/dark-pool?ticker=NVDA
   * Analyser le module dark_pool
   */
  {
    method: 'POST',
    path: '/analyze/dark-pool',
    handler: async (event: APIGatewayProxyEventV2) => {
      const ticker = getQueryParam(event, 'ticker');
      if (!ticker) {
        throw new Error('Missing required parameter: ticker');
      }

      const result = await unitAnalysisService.analyzeDarkPool(ticker);
      
      return {
        success: result !== null,
        ticker: ticker.toUpperCase(),
        module: 'dark_pool',
        analysis: result,
        timestamp: new Date().toISOString(),
      };
    },
  },

  /**
   * POST /analyze/all?ticker=NVDA&modules=options_flow,dark_pool
   * Analyser plusieurs modules en parallèle
   */
  {
    method: 'POST',
    path: '/analyze/all',
    handler: async (event: APIGatewayProxyEventV2) => {
      const ticker = getQueryParam(event, 'ticker');
      if (!ticker) {
        throw new Error('Missing required parameter: ticker');
      }

      const modulesParam = getQueryParam(event, 'modules');
      const moduleIds = modulesParam 
        ? modulesParam.split(',').map((m) => m.trim()) as ModuleId[]
        : ['options_flow', 'dark_pool'];

      const results = await unitAnalysisService.analyzeMultipleModules(ticker, moduleIds);
      
      return {
        success: true,
        ticker: ticker.toUpperCase(),
        analyses: results,
        timestamp: new Date().toISOString(),
      };
    },
  },

  /**
   * GET /analyze/results?ticker=NVDA&modules=options_flow,dark_pool
   * Récupérer les résultats d'analyses unitaires
   */
  {
    method: 'GET',
    path: '/analyze/results',
    handler: async (event: APIGatewayProxyEventV2) => {
      const ticker = getQueryParam(event, 'ticker');
      if (!ticker) {
        throw new Error('Missing required parameter: ticker');
      }

      const modulesParam = getQueryParam(event, 'modules');
      const moduleIds = modulesParam 
        ? modulesParam.split(',').map((m) => m.trim()) as ModuleId[]
        : undefined;

      const results = await unitAnalysisService.getUnitAnalyses(ticker, moduleIds);
      
      return {
        success: true,
        ticker: ticker.toUpperCase(),
        analyses: results,
        timestamp: new Date().toISOString(),
      };
    },
  },
];

