/**
 * Service d'analyse professionnelle du flow options - Optimisé pour Insider Edge
 * Focus sur la détection de "Smart Money" et "Whales" à haute conviction.
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import { supabase } from '../supabase';
import type {
  FlowOptionsAnalysisProRequest,
  FlowOptionsAnalysisProResponse,
  FlowOptionsSignal,
  FlowOptionsCluster,
} from '../types/ai-analyst';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// --- CONSTANTES DE HAUTE CONVICTION ---
const WHALE_PREMIUM_THRESHOLD = 1000000; // 1M$ pour le statut "Ultra Whale"
const AGGRESSIVE_ASK_RATIO = 0.85;       // 85% au Ask pour considérer l'ordre comme "Urgent"
const SHORT_TERM_URGENCY_DAYS = 14;      // Moins de 14 jours = Signal critique

export class FlowOptionsAnalysisService {
  /**
   * Charger les signals depuis la base de données
   */
  private async fetchSignalsFromDB(
    ticker: string,
    options?: { limit?: number; min_premium?: number }
  ): Promise<FlowOptionsSignal[]> {
    const log = logger.child({ operation: 'fetchSignalsFromDB', ticker });
    const limit = options?.limit || 500;
    
    // Ajustement : On descend à 20k$ pour ne pas rater les accumulations de "Smart Money"
    const minPremium = options?.min_premium || 20000; 

    log.info('Fetching high-conviction signals', { ticker, limit, minPremium });

    // On élargit à 72h pour couvrir le week-end (essentiel pour les requêtes du lundi)
    const past = new Date();
    past.setHours(past.getHours() - 72);
    const dateLimit = past.toISOString();

    let { data: flowAlerts, error } = await supabase
      .from('flow_alerts')
      .select('*')
      .eq('ticker', ticker.toUpperCase())
      .gte('total_premium', minPremium)
      .gte('created_at', dateLimit)
      .order('total_premium', { ascending: false })
      .limit(limit);

    if (error) {
      log.error('Error fetching signals', { error });
      throw new Error(`Failed to fetch signals: ${error.message}`);
    }

    if (!flowAlerts || flowAlerts.length === 0) return [];

    return flowAlerts.map((alert: any) => ({
      ...alert,
      type: alert.type as 'call' | 'put',
    }));
  }

  /**
   * Analyse clusterisée avec filtres de conviction Insider Edge
   */
  async analyzeFlowOptions(
    request: FlowOptionsAnalysisProRequest
  ): Promise<FlowOptionsAnalysisProResponse> {
    return handleError(async () => {
      const log = logger.child({ operation: 'analyzeFlowOptions' });

      let signalsToAnalyze: FlowOptionsSignal[] = request.signals || [];
      
      if (request.ticker && (!request.signals || request.signals.length === 0)) {
        signalsToAnalyze = await this.fetchSignalsFromDB(request.ticker, {
          limit: request.limit || 500,
          min_premium: request.min_premium || 20000,
        });
      }

      // Seuil de clusterisation abaissé à 100k$ pour voir l'activité AAPL habituelle
      const minPremiumThreshold = request.min_premium_threshold || 100000;
      const clusters = this.clusterSignals(signalsToAnalyze, minPremiumThreshold);

      if (clusters.length === 0) {
        const isMonday = new Date().getDay() === 1;
        const msg = isMonday 
          ? 'Aucun mouvement significatif détecté. Note : Les marchés étaient fermés ce week-end, les dernières données datent de vendredi soir.'
          : 'Aucun mouvement institutionnel significatif détecté sur les dernières 72h.';

        return {
          success: true,
          ticker: request.ticker || 'N/A',
          clusters_analyzed: 0,
          clusters: [],
          summary: msg,
          cached: false,
          timestamp: new Date().toISOString(),
        };
      }

      const clusterAnalyses = await this.analyzeClusters(clusters, request.context);
      const summary = this.generateSummary(clusterAnalyses);

      return {
        success: true,
        ticker: request.ticker || clusters[0]?.ticker || 'N/A',
        clusters_analyzed: clusterAnalyses.length,
        clusters: clusterAnalyses,
        summary,
        cached: false,
        timestamp: new Date().toISOString(),
      };
    }, 'Analyze flow options');
  }

  /**
   * Clustériser les signaux par (type, expiry, strike)
   */
  private clusterSignals(
    signals: FlowOptionsSignal[],
    minPremiumThreshold: number
  ): FlowOptionsCluster[] {
    const clusterMap = new Map<string, FlowOptionsSignal[]>();

    for (const signal of signals) {
      const key = `${signal.ticker}|${signal.type}|${signal.expiry}|${signal.strike}`;
      if (!clusterMap.has(key)) clusterMap.set(key, []);
      clusterMap.get(key)!.push(signal);
    }

    const clusters: FlowOptionsCluster[] = [];
    for (const [key, clusterSignals] of clusterMap.entries()) {
      const [ticker, type, expiry, strike] = key.split('|');
      
      let premium_total = 0;
      let ask_prem_total = 0;
      let bid_prem_total = 0;
      let volume_oi_ratio_max = 0;
      let trades_total = 0;

      for (const s of clusterSignals) {
        const prem = this.parseNumber(s.total_premium) || 0;
        premium_total += prem;
        ask_prem_total += this.parseNumber(s.total_ask_side_prem) || 0;
        bid_prem_total += this.parseNumber(s.total_bid_side_prem) || 0;
        volume_oi_ratio_max = Math.max(volume_oi_ratio_max, this.parseNumber(s.volume_oi_ratio) || 0);
        trades_total += this.parseNumber(s.trade_count) || 0;
      }

      if (premium_total < minPremiumThreshold) continue;

      const ask_ratio = (ask_prem_total + bid_prem_total) > 0 
        ? ask_prem_total / (ask_prem_total + bid_prem_total) 
        : 0;

      const days_to_expiry = this.calculateDaysToExpiry(expiry);

      clusters.push({
        ticker,
        type: type as 'call' | 'put',
        strike,
        expiry,
        premium_total,
        trades_total,
        size_total: clusterSignals.reduce((acc, s) => acc + (this.parseNumber(s.total_size) || 0), 0),
        ask_prem_total,
        bid_prem_total,
        ask_ratio,
        direction_bias: ask_prem_total - bid_prem_total,
        volume_oi_ratio_max,
        underlying_price: this.parseNumber(clusterSignals[0].underlying_price),
        days_to_expiry,
        time_horizon: this.determineTimeHorizon(days_to_expiry),
        alert_count: clusterSignals.length,
        created_dates: clusterSignals.map(s => s.created_at || ''),
        opening_hint: clusterSignals.some(s => s.all_opening_trades),
        alert_rules: Array.from(new Set(clusterSignals.map(s => s.alert_rule || ''))),
      });
    }

    return clusters.sort((a, b) => b.premium_total - a.premium_total);
  }

  private computeAction(cluster: FlowOptionsCluster): 'IGNORE' | 'WATCH' | 'INVESTIGATE' {
    const askRatio = typeof cluster.ask_ratio === 'number' ? cluster.ask_ratio : 0;
    const isUltraWhale = cluster.premium_total >= WHALE_PREMIUM_THRESHOLD;
    const isVeryAggressive = askRatio >= AGGRESSIVE_ASK_RATIO;
    const isUrgent = (cluster.days_to_expiry || 99) <= SHORT_TERM_URGENCY_DAYS;

    if (isUltraWhale && isVeryAggressive) return 'INVESTIGATE';
    if (isUltraWhale || (cluster.premium_total >= 500000 && isUrgent && isVeryAggressive)) return 'INVESTIGATE';
    if (cluster.premium_total >= 100000 && askRatio >= 0.55) return 'WATCH';

    return 'IGNORE';
  }

  private computeTag(cluster: FlowOptionsCluster): string | undefined {
    const askRatio = typeof cluster.ask_ratio === 'number' ? cluster.ask_ratio : 0;
    
    if (cluster.premium_total >= WHALE_PREMIUM_THRESHOLD) return 'ULTRA_WHALE';
    if (askRatio >= 0.85 && cluster.premium_total > 250000) return 'GOLDEN_SWEEP';
    if ((cluster.days_to_expiry || 99) <= 7 && askRatio > 0.75) return 'LOTO_CONVICTION';
    
    return undefined;
  }

  private async analyzeClusters(clusters: FlowOptionsCluster[], context: any): Promise<any[]> {
    return clusters.map(cluster => {
        const action = this.computeAction(cluster);
        const tag = this.computeTag(cluster);
        
        return {
            cluster,
            label: `${cluster.type.toUpperCase()} ${cluster.strike} exp ${cluster.expiry}`,
            importance: cluster.premium_total >= WHALE_PREMIUM_THRESHOLD ? 'tres_fort' : 'fort',
            intent: typeof cluster.ask_ratio === 'number' && cluster.ask_ratio >= 0.65 ? 'bullish_aggression' : (typeof cluster.ask_ratio === 'number' && cluster.ask_ratio <= 0.35 ? 'bearish_aggression' : 'neutral_hedging'),
            quality: cluster.volume_oi_ratio_max > 1.0 ? 'high_conviction' : 'standard',
            action,
            tag,
            why: [
                `Premium Total: $${(cluster.premium_total / 1000).toFixed(0)}k`,
                `Agression: ${(typeof cluster.ask_ratio === 'number' ? cluster.ask_ratio : 0 * 100).toFixed(0)}% au Ask`,
                `Volume/OI: ${cluster.volume_oi_ratio_max.toFixed(2)}x`
            ]
        };
    });
  }

    private generateSummary(analyses: any[]): string {
        const whales = analyses.filter(a => a.tag === 'ULTRA_WHALE').length;
        const sweeps = analyses.filter(a => a.tag === 'GOLDEN_SWEEP').length;
        const investigations = analyses.filter(a => a.action === 'INVESTIGATE').length;

        let text = `Synthèse Insider Edge : `;
        if (whales > 0) text += `${whales} Baleine(s) Ultra détectée(s). `;
        if (sweeps > 0) text += `${sweeps} Golden Sweeps identifiés. `;
        text += `${investigations} positions présentent une anomalie de conviction forte.`;
    
        if (analyses.length > 0 && whales === 0 && investigations === 0) {
            text = `Activité institutionnelle modérée détectée (${analyses.length} clusters). Pas de mouvement "Whale" critique pour le moment.`;
        }
    
        return text;
    }

  // --- UTILS ---

  private parseNumber(val: any): number | null {
    if (val === null || val === undefined) return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  }

  private calculateDaysToExpiry(expiry: string): number | null {
    try {
      const diff = new Date(expiry).getTime() - new Date().getTime();
      return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    } catch { return null; }
  }

  private determineTimeHorizon(days: number | null): 'short' | 'swing' | 'long' {
    if (days === null) return 'swing';
    if (days <= 7) return 'short';
    if (days <= 45) return 'swing';
    return 'long';
  }


  /**
   * Appeler OpenAI API
   */
  private async callOpenAI(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const log = logger.child({ operation: 'callOpenAI' });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: options?.temperature || 0.3,
        max_tokens: options?.maxTokens || 2000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      log.error('OpenAI API error', { status: response.status, error });
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const result = await response.json() as any;
    const content = result.choices[0]?.message?.content || '{}';

    log.info('OpenAI API success', { tokens: result.usage?.total_tokens });
    return content;
  }

  /**
   * Générer une clé de cache
   */
  private generateCacheKey(clusters: FlowOptionsCluster[]): string {
    const clustersHash = JSON.stringify(
      clusters.map((c) => ({
        ticker: c.ticker,
        type: c.type,
        strike: c.strike,
        expiry: c.expiry,
        premium_total: c.premium_total,
      }))
    );
    return `flow_options_clusters_${clustersHash.length}_${Date.now()}`;
  }

  /**
   * Récupérer une analyse en cache
   */
  private async getCachedAnalysis(
    cacheKey: string
  ): Promise<FlowOptionsAnalysisProResponse | null> {
    try {
      const { data, error } = await supabase
        .from('ai_analyses')
        .select('*')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return data.analysis_result as FlowOptionsAnalysisProResponse;
    } catch (e) {
      logger.error('Error getting cached analysis', { error: e });
      return null;
    }
  }

  /**
   * Sauvegarder une analyse en cache
   */
  private async saveCachedAnalysis(
    cacheKey: string,
    response: FlowOptionsAnalysisProResponse
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Cache 24h

      await supabase.from('ai_analyses').upsert({
        cache_key: cacheKey,
        analysis_type: 'flow_options_analysis',
        analysis_result: response,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      logger.error('Error saving cached analysis', { error: e });
      // Ne pas faire échouer la requête si le cache échoue
    }
  }
}
