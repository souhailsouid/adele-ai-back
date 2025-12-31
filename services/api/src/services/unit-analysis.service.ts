/**
 * Service d'analyses unitaires
 * Couche B : Une analyse = un module
 * 
 * Objectif : Lire les données en base, exécuter une analyse "petite" (LLM ou règles),
 * écrire un résultat structuré en base
 */

import { supabase } from '../supabase';
import { logger } from '../utils/logger';
import { aiAnalystService } from './ai-analyst.service';
import type { ModuleId } from './ticker-data-ingestion.service';

export interface UnitAnalysisResult {
  module: ModuleId;
  ticker: string;
  data_date: string | null;
  signals: Array<{
    name: string;
    score: number; // 0.00 à 1.00
    evidence: string[];
  }>;
  summary: string;
  confidence: number; // 0.00 à 1.00
  metrics?: Record<string, any>;
}

export class UnitAnalysisService {
  /**
   * Analyser le module options_flow
   */
  async analyzeOptionsFlow(ticker: string): Promise<UnitAnalysisResult | null> {
    const upperTicker = ticker.toUpperCase();
    
    try {
      // Lire les données depuis la base (options_flow table)
      const { data: flowData, error } = await supabase
        .from('options_flow')
        .select('*')
        .eq('ticker', upperTicker)
        .gt('expires_at', new Date().toISOString())
        .order('date', { ascending: false, nullsLast: true })
        .order('cached_at', { ascending: false })
        .limit(100);

      if (error || !flowData || flowData.length === 0) {
        logger.warn('No options flow data available for analysis', { ticker: upperTicker });
        return null;
      }

      // Filtrer les marqueurs vides
      const validData = flowData.filter((f) => !f.is_empty_marker);

      if (validData.length === 0) {
        return null;
      }

      // Calculer les métriques
      const totalVolume = validData.reduce((sum, f) => sum + (f.volume || 0), 0);
      const callVolume = validData.reduce((sum, f) => sum + (f.call_volume || 0), 0);
      const putVolume = validData.reduce((sum, f) => sum + (f.put_volume || 0), 0);
      const callPutRatio = putVolume > 0 ? callVolume / putVolume : callVolume > 0 ? 999 : 0;
      const totalPremium = validData.reduce((sum, f) => sum + (f.total_premium || f.premium || 0), 0);

      // Détecter les signaux
      const signals: UnitAnalysisResult['signals'] = [];
      
      if (callPutRatio > 2) {
        signals.push({
          name: 'bullish_flow',
          score: Math.min(0.95, 0.5 + (callPutRatio - 2) * 0.1),
          evidence: [`Ratio call/put élevé: ${callPutRatio.toFixed(2)}`, `Volume call: ${callVolume.toLocaleString()}`],
        });
      } else if (callPutRatio < 0.5) {
        signals.push({
          name: 'bearish_flow',
          score: Math.min(0.95, 0.5 + (0.5 - callPutRatio) * 0.1),
          evidence: [`Ratio call/put faible: ${callPutRatio.toFixed(2)}`, `Volume put: ${putVolume.toLocaleString()}`],
        });
      }

      if (totalVolume > 1000000) {
        signals.push({
          name: 'high_volume',
          score: Math.min(0.9, totalVolume / 5000000),
          evidence: [`Volume total élevé: ${totalVolume.toLocaleString()}`],
        });
      }

      if (totalPremium > 10000000) {
        signals.push({
          name: 'high_premium',
          score: Math.min(0.9, totalPremium / 50000000),
          evidence: [`Premium total élevé: $${(totalPremium / 1000000).toFixed(2)}M`],
        });
      }

      // Détecter les sweeps/blocks
      const sweeps = validData.filter((f) => f.data?.sweep || f.data?.is_sweep).length;
      if (sweeps > 0) {
        signals.push({
          name: 'unusual_activity',
          score: Math.min(0.85, sweeps / 10),
          evidence: [`${sweeps} sweep(s) détecté(s)`],
        });
      }

      // Calculer la confiance basée sur la quantité de données
      const confidence = Math.min(0.95, 0.5 + (validData.length / 50) * 0.3);

      // Générer un résumé simple
      const summary = signals.length > 0
        ? `Flux d'options ${signals[0].name === 'bullish_flow' ? 'haussier' : signals[0].name === 'bearish_flow' ? 'baissier' : 'actif'} avec ${signals.length} signal(x) détecté(s).`
        : 'Flux d\'options modéré, pas de signal significatif.';

      const result: UnitAnalysisResult = {
        module: 'options_flow',
        ticker: upperTicker,
        data_date: validData[0]?.data_date || validData[0]?.date || null,
        signals,
        summary,
        confidence,
        metrics: {
          total_volume: totalVolume,
          call_volume: callVolume,
          put_volume: putVolume,
          call_put_ratio: callPutRatio,
          total_premium: totalPremium,
          data_count: validData.length,
        },
      };

      // Stocker le résultat
      await this.storeAnalysisResult(result);

      return result;
    } catch (error: any) {
      logger.error('Error analyzing options flow', { ticker: upperTicker, error });
      return null;
    }
  }

  /**
   * Analyser le module dark_pool
   */
  async analyzeDarkPool(ticker: string): Promise<UnitAnalysisResult | null> {
    const upperTicker = ticker.toUpperCase();
    
    try {
      const { data: darkPoolData, error } = await supabase
        .from('dark_pool_trades')
        .select('*')
        .eq('ticker', upperTicker)
        .gt('expires_at', new Date().toISOString())
        .order('date', { ascending: false, nullsLast: true })
        .order('cached_at', { ascending: false })
        .limit(100);

      if (error || !darkPoolData || darkPoolData.length === 0) {
        return null;
      }

      const validData = darkPoolData.filter((d) => !d.is_empty_marker);
      if (validData.length === 0) {
        return null;
      }

      const totalVolume = validData.reduce((sum, d) => sum + (d.volume || d.size || 0), 0);
      const largestTrade = validData.reduce((max, d) => {
        const vol = d.volume || d.size || 0;
        return vol > (max?.volume || 0) ? { ...d, volume: vol } : max;
      }, null);

      const signals: UnitAnalysisResult['signals'] = [];

      if (totalVolume > 100000000) {
        signals.push({
          name: 'high_institutional_activity',
          score: Math.min(0.9, totalVolume / 1000000000),
          evidence: [`Volume total dark pool: ${(totalVolume / 1000000).toFixed(2)}M`],
        });
      }

      if (largestTrade && (largestTrade.volume || 0) > 1000000) {
        signals.push({
          name: 'large_block_trade',
          score: Math.min(0.85, (largestTrade.volume || 0) / 10000000),
          evidence: [`Plus grande transaction: ${((largestTrade.volume || 0) / 1000000).toFixed(2)}M`],
        });
      }

      const confidence = Math.min(0.9, 0.5 + (validData.length / 30) * 0.3);
      const summary = signals.length > 0
        ? `Activité dark pool ${signals[0].name === 'high_institutional_activity' ? 'élevée' : 'significative'} avec ${signals.length} signal(x).`
        : 'Activité dark pool modérée.';

      const result: UnitAnalysisResult = {
        module: 'dark_pool',
        ticker: upperTicker,
        data_date: validData[0]?.data_date || validData[0]?.date || null,
        signals,
        summary,
        confidence,
        metrics: {
          total_volume: totalVolume,
          largest_trade: largestTrade,
          trade_count: validData.length,
        },
      };

      await this.storeAnalysisResult(result);
      return result;
    } catch (error: any) {
      logger.error('Error analyzing dark pool', { ticker: upperTicker, error });
      return null;
    }
  }

  /**
   * Analyser plusieurs modules en parallèle
   */
  async analyzeMultipleModules(
    ticker: string,
    moduleIds: ModuleId[]
  ): Promise<Record<ModuleId, UnitAnalysisResult | null>> {
    const upperTicker = ticker.toUpperCase();
    const results: Record<string, UnitAnalysisResult | null> = {};

    const analysisPromises = moduleIds.map(async (moduleId) => {
      try {
        switch (moduleId) {
          case 'options_flow':
            return { moduleId, result: await this.analyzeOptionsFlow(upperTicker) };
          case 'dark_pool':
            return { moduleId, result: await this.analyzeDarkPool(upperTicker) };
          default:
            logger.warn('Analysis not implemented for module', { moduleId, ticker: upperTicker });
            return { moduleId, result: null };
        }
      } catch (error: any) {
        logger.error('Error analyzing module', { moduleId, ticker: upperTicker, error });
        return { moduleId, result: null };
      }
    });

    const settled = await Promise.allSettled(analysisPromises);
    settled.forEach((result) => {
      if (result.status === 'fulfilled') {
        results[result.value.moduleId] = result.value.result;
      }
    });

    return results as Record<ModuleId, UnitAnalysisResult | null>;
  }

  /**
   * Stocker le résultat d'une analyse unitaire
   */
  private async storeAnalysisResult(result: UnitAnalysisResult): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24h TTL par défaut

    await supabase
      .from('unit_analyses')
      .upsert({
        ticker: result.ticker,
        module_id: result.module,
        analysis_date: new Date().toISOString(),
        data_date: result.data_date,
        result: {
          signals: result.signals,
          summary: result.summary,
          confidence: result.confidence,
          metrics: result.metrics,
        },
        confidence: result.confidence,
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'ticker,module_id,data_date',
      });
  }

  /**
   * Récupérer les analyses unitaires pour un ticker
   */
  async getUnitAnalyses(ticker: string, moduleIds?: ModuleId[]): Promise<UnitAnalysisResult[]> {
    const upperTicker = ticker.toUpperCase();
    
    let query = supabase
      .from('unit_analyses')
      .select('*')
      .eq('ticker', upperTicker)
      .gt('expires_at', new Date().toISOString())
      .order('analysis_date', { ascending: false });

    if (moduleIds && moduleIds.length > 0) {
      query = query.in('module_id', moduleIds);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      module: row.module_id as ModuleId,
      ticker: row.ticker,
      data_date: row.data_date,
      signals: row.result?.signals || [],
      summary: row.result?.summary || '',
      confidence: row.confidence || 0.5,
      metrics: row.result?.metrics,
    }));
  }
}





