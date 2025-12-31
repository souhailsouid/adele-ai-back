/**
 * Service d'analyse IA
 * Analyse les données financières avec OpenAI pour générer des insights humains
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import { supabase } from '../supabase';
import { createHash } from 'crypto';
import type {
  ImpactLevel,
  AIAnalysisResult,
  CalendarSummaryRequest,
  CalendarSummaryResponse,
  FDAEventAnalysis,
  OptionsFlowAnalysisRequest,
  OptionsFlowAnalysisResponse,
  InstitutionMoveAnalysisRequest,
  InstitutionMoveAnalysisResponse,
  TickerActivityAnalysisRequest,
  TickerActivityAnalysisResponse,
} from '../types/ai-analyst';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'; // Utiliser gpt-4o-mini par défaut pour les coûts

export class AIAnalystService {
  /**
   * Analyser un calendrier d'événements (FDA, Earnings, etc.)
   */
  async analyzeCalendarSummary(
    request: CalendarSummaryRequest
  ): Promise<CalendarSummaryResponse> {
    return handleError(
      async () => {
        const log = logger.child({ operation: 'analyzeCalendarSummary' });
      log.info('Analyzing calendar summary', { date_range: request.date_range });

      // Générer un hash des événements pour détecter si les données ont changé
      const eventsHash = this.generateDataHash({
        events: request.events?.map((e: any) => ({
          ticker: e.ticker,
          type: e.type,
          description: e.description,
          date: e.date,
          impact: e.impact,
        })) || [],
      });
      const cacheKey = `calendar_summary_${request.date_range.from}_${request.date_range.to}_${eventsHash}`;
      
      // Vérifier le cache avec le hash des événements
      const cached = await this.getCachedAnalysis(cacheKey, eventsHash);
      if (cached) {
        log.info('Returning cached calendar summary (events unchanged)', { 
          from: request.date_range.from,
          to: request.date_range.to,
          eventsHash 
        });
        return {
          ...cached as CalendarSummaryResponse,
          cached: true,
        };
      }

      log.info('No cache found or events changed, generating new analysis', { 
        from: request.date_range.from,
        to: request.date_range.to,
        eventsHash 
      });

      // Vérifier qu'il y a des événements
      if (!request.events || request.events.length === 0) {
        log.warn('No events provided for analysis');
        return {
          success: true,
          date_range: request.date_range,
          summary: 'Aucun événement à analyser pour cette période.',
          events_analysis: [],
          top_events: [],
          cached: false,
          timestamp: new Date().toISOString(),
        };
      }

      // Préparer les données pour l'IA
      // PRIORITÉ 1 : Événements qui font trembler la planète (taux US/CN/JP, douane, tarifs, etc.)
      // Un événement est critique si :
      // 1. Il est marqué is_planet_shaking: true (fait trembler la planète) → PRIORITÉ ABSOLUE
      // 2. OU il est marqué is_critical: true (détecté par nom ou fmp_impact="high")
      // 3. OU son type est Monetary Policy, Geopolitical, Commodity
      // 4. OU il a fmp_impact="high" (FMP a marqué comme High impact)
      // 5. OU il a impact="High" et ticker="N/A" (événement macroéconomique High impact)
      const criticalEvents = request.events.filter(
        (e: any) => 
          (e.is_planet_shaking === true) || // PRIORITÉ ABSOLUE : fait trembler la planète
          e.is_critical || 
          (e.type && ['Monetary Policy', 'Geopolitical', 'Commodity'].includes(e.type)) ||
          (e.fmp_impact === 'high') || // FMP a marqué comme High impact
          (e.impact === 'High' && e.ticker === 'N/A') // Événement macroéconomique High impact
      );
      
      // PRIORITÉ 2 : FDA/Earnings avec ticker réel
      const eventsWithTicker = request.events.filter(
        (e) => e.ticker && e.ticker !== 'N/A' && (e.type === 'FDA' || e.type === 'Earnings')
      );
      
      // PRIORITÉ 3 : Autres événements économiques importants
      const otherEvents = request.events.filter(
        (e) => !criticalEvents.includes(e) && !eventsWithTicker.includes(e)
      );

      // Prendre TOUS les événements critiques + TOUS les événements avec ticker + top autres (max 100 au total pour inclure tous les événements critiques)
      // IMPORTANT: On augmente la limite pour s'assurer que TOUS les événements critiques sont inclus
      const maxEvents = 100;
      const topOtherEvents = otherEvents.slice(0, Math.max(0, maxEvents - criticalEvents.length - eventsWithTicker.length));
      const topEvents = [...criticalEvents, ...eventsWithTicker, ...topOtherEvents]
        .filter((e) => e && e.description && e.date) // Filtrer les événements valides
        .map((e) => ({
          ticker: e.ticker || 'N/A',
          type: e.type || 'Other',
          phase: e.phase,
          description: e.description || '',
          date: e.date,
          market_cap: e.market_cap,
          historical_volatility: e.historical_volatility,
          impact: e.impact,
          country: (e as any).country || 'N/A',
          is_critical: (e as any).is_critical || false,
          is_planet_shaking: (e as any).is_planet_shaking || false, // Ajouter is_planet_shaking pour l'IA
          fmp_impact: (e as any).fmp_impact || null, // Ajouter fmp_impact pour l'IA
          currency: (e as any).currency || null, // Ajouter currency pour l'IA
          // Détails économiques si disponibles
          previous: (e as any).previous,
          estimate: (e as any).estimate,
          actual: (e as any).actual,
        }));

      // Si aucun événement valide après filtrage
      if (topEvents.length === 0) {
        log.warn('No valid events after filtering');
        return {
          success: true,
          date_range: request.date_range,
          summary: 'Aucun événement valide à analyser pour cette période.',
          events_analysis: [],
          top_events: [],
          cached: false,
          timestamp: new Date().toISOString(),
        };
      }

      const systemPrompt = `Tu es un analyste de marché professionnel spécialisé dans la détection d'événements à haut risque pour les traders et investisseurs.

À partir d'une liste d'événements, tu dois:

1. Les classer par niveau d'impact potentiel: "faible", "moyen", "élevé", "critique".
2. Expliquer en une ou deux phrases pourquoi.
3. Générer un résumé global de la période (5-7 lignes) en mettant en avant les événements CRITIQUES qui peuvent faire trembler les marchés US, japonais, chinois, européens.

PRIORITÉ ABSOLUE aux événements macroéconomiques et géopolitiques qui impactent les marchés mondiaux:

🎯 **CE QUI FAIT TREMBLER LA PLANÈTE / LES MARCHÉS MONDAUX** :

1. **MARCHÉS US** : Fed, FOMC, taux, CPI, PPI, JOLTs, Jobless Claims, Nonfarm Payrolls
2. **CHINE** : PBoC, taux, CPI, GDP, PPI
3. **DOUANE / TARIFS** : Trade wars, tariffs, customs, trade restrictions, trade sanctions
4. **TAUX JAPONAIS** : BoJ, Bank of Japan, taux → Impact MASSIF sur les CARRY TRADES
5. **CARRY TRADES** : Toute décision de taux Japon impacte les carry trades mondiaux
6. **ÉVÉNEMENTS MAJEURS** : Sanctions, embargos, OPEC, sommets géopolitiques

🔴 "critique" (impact majeur sur TOUS les marchés - fait trembler la planète):
- **Décisions de taux d'intérêt US (Fed FOMC, Fed Interest Rate Decision, Fed Press Conference)** → PEUVENT FAIRE TREMBLER TOUS LES MARCHÉS MONDAUX
- **Baisse des taux US (Rate Cut)** → Impact MASSIF sur les carry trades, devises, actions mondiales, indices
- **Hausse des taux US (Rate Hike)** → Impact MASSIF sur les carry trades, devises, actions mondiales, indices
- **Révisions de taux US** → Changements de politique monétaire qui impactent TOUS les marchés
- **Décisions de taux Japon (BoJ, Bank of Japan)** → Impact MASSIF sur les CARRY TRADES (stratégie d'investissement mondiale)
- **Baisse/Hausse des taux Japon** → Impact DIRECT sur les carry trades (yen faible/fort)
- **Décisions de taux Chine (PBoC, People's Bank of China)** → Impact majeur sur les marchés asiatiques et mondiaux
- **DOUANE / TARIFS** : Trade wars, tariffs, customs, trade restrictions → Impact sur le commerce international et les chaînes d'approvisionnement
- **Indicateurs économiques critiques US** (Nonfarm Payrolls, CPI inflation, PPI, GDP, Jobless Claims, JOLTs) → Impact sur les politiques monétaire et les marchés mondiaux
- **Indicateurs économiques critiques Chine** (CPI, GDP, PPI) → Impact sur les marchés asiatiques et mondiaux
- **Indicateurs économiques critiques Japon** (CPI, GDP, PPI) → Impact sur les carry trades et les marchés asiatiques
- **Sanctions économiques majeures** → Paralysent des secteurs entiers, impactent les marchés mondiaux
- **Embargos commerciaux** → Perturbent les chaînes d'approvisionnement mondiales
- **Décisions OPEC** → Impact sur l'inflation mondiale et les matières premières

🟠 "élevé" (impact significatif):
- Earnings de mega-caps (AAPL, MSFT, NVDA, TSLA, etc.) → Impact sur indices
- FDA Phase 3/PDUFA sur titres très volatils (<5B market cap) → Impact sectoriel (biotech)
- Indicateurs économiques importants (Retail Sales, Consumer Confidence, ISM) pour grandes économies
- Événements géopolitiques régionaux

🟡 "moyen" (impact modéré):
- Earnings de grandes caps (S&P 500)
- FDA Phase 2/3 sur titres moyens
- Événements économiques standards
- Indicateurs économiques secondaires

🟢 "faible" (impact limité):
- Événements routiniers, fêtes, événements culturels sans impact économique

RÈGLES STRICTES (CE QUI FAIT TREMBLER LA PLANÈTE):
1. **Les événements de TAUX US (Fed, FOMC, Rate Cut, Rate Hike, Rate Revision) sont TOUJOURS "critique"** → Impact MASSIF sur tous les marchés mondiaux, carry trades, devises, indices
2. **Les événements de TAUX Japon (BoJ, Bank of Japan, Rate Cut, Rate Hike) sont TOUJOURS "critique"** → Impact MASSIF sur les CARRY TRADES (stratégie d'investissement mondiale)
3. **Les événements de TAUX Chine (PBoC, People's Bank of China) sont TOUJOURS "critique"** → Impact majeur sur les marchés asiatiques et mondiaux
4. **DOUANE / TARIFS (Trade wars, tariffs, customs, trade restrictions) sont TOUJOURS "critique"** → Impact sur le commerce international et les chaînes d'approvisionnement mondiales
5. **Les indicateurs économiques majeurs US (Nonfarm Payrolls, CPI, PPI, GDP, Jobless Claims, JOLTs) sont TOUJOURS "critique" ou "élevé"** → Impact sur les politiques monétaire et les marchés mondiaux
6. **Les indicateurs économiques majeurs Chine (CPI, GDP, PPI) sont TOUJOURS "critique" ou "élevé"** → Impact sur les marchés asiatiques et mondiaux
7. **Les indicateurs économiques majeurs Japon (CPI, GDP, PPI) sont TOUJOURS "critique" ou "élevé"** → Impact sur les carry trades et les marchés asiatiques
8. **Les événements avec fmp_impact="high" sont TOUJOURS "critique" ou "élevé"** → FMP a déjà évalué leur impact comme High (Fed, CPI, PPI, JOLTs, Jobless Claims, etc.)
9. **Les événements avec is_planet_shaking=true sont TOUJOURS "critique"** → Ce sont les événements qui font trembler la planète
10. Les SANCTIONS, EMBARGOS sont TOUJOURS "critique" ou "élevé"
11. Les événements GÉOPOLITIQUES majeurs (sommets, pourparlers) sont au moins "élevé"
12. Les événements de type "Monetary Policy" sont TOUJOURS au moins "élevé"
13. Les événements de type "Geopolitical" sont TOUJOURS au moins "élevé"
14. Les événements de type "Commodity" (OPEC, pétrole) sont TOUJOURS au moins "élevé"
15. Les fêtes et événements culturels sans impact économique sont "faible"
16. **Le résumé DOIT commencer par les événements qui font trembler la planète : Taux US, Taux Japon (carry trades), Douane/Tarifs, Indicateurs économiques majeurs US/Chine/Japon**
17. **IGNORER les earnings de petites entreprises** → Seulement les mega-caps (AAPL, MSFT, NVDA, etc.) sont pertinentes
18. **MENTIONNER les CARRY TRADES** dans le résumé si des événements de taux Japon sont présents

Retourne un JSON bien formaté avec cette structure:
{
  "summary": "Résumé global de la période en 5-7 lignes, en COMMENÇANT par les événements critiques (taux, sanctions, géopolitique) qui font trembler les marchés",
  "events_analysis": [
    {
      "ticker": "..." | "N/A",
      "event_type": "Monetary Policy" | "Geopolitical" | "Commodity" | "Economic Indicator" | "FDA" | "Earnings" | "Other",
      "phase": "...",
      "description": "...",
      "date": "...",
      "analysis": {
        "impact": "faible" | "moyen" | "élevé" | "critique",
        "reason": "Explication en 1-2 phrases sur pourquoi cet événement impacte les marchés",
        "summary": "Résumé court de l'événement",
        "confidence": 85
      }
    }
  ],
  "top_events": [
    {
      "ticker": "..." | "N/A",
      "impact": "critique" | "élevé",
      "reason": "Pourquoi cet événement est critique/élevé",
      "date": "..."
    }
  ]
}

IMPORTANT: 
- Les événements critiques (taux, sanctions, géopolitique, événements avec fmp_impact="high") doivent apparaître en PREMIER dans le résumé et top_events
- Sois précis sur l'impact: un changement de taux de 0.25% peut faire bouger tous les marchés
- Les sanctions économiques peuvent paralyser des secteurs entiers
- Les sommets géopolitiques peuvent déclencher des mouvements de marché massifs
- Les événements avec is_critical=true OU fmp_impact="high" sont prioritaires même sans ticker
- **Si un événement a fmp_impact="high", il DOIT être classé "critique" ou "élevé"** → FMP a déjà évalué son impact comme High

Sois concis mais précis. Toujours en français.`;

      const userPrompt = `Événements à venir (${request.date_range.from} to ${request.date_range.to}):

Chaque événement contient:
- ticker: "N/A" pour les événements macroéconomiques, ou un ticker pour FDA/Earnings
- type: Type d'événement (Monetary Policy, Geopolitical, Economic Indicator, FDA, Earnings, etc.)
- description: Nom de l'événement
- date: Date de l'événement
- impact: Impact estimé (Low, Medium, High)
- fmp_impact: Impact évalué par FMP (low, medium, high, none) → Si "high", l'événement est CRITIQUE
- is_critical: true si l'événement est critique (taux, sanctions, géopolitique)
- country: Pays de l'événement (US, JP, CN, EU, etc.)

${JSON.stringify(topEvents, null, 2)}`;

      const aiResponse = await this.callOpenAI(systemPrompt, userPrompt);

      // Parser la réponse
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(aiResponse);
      } catch (e) {
        log.error('Failed to parse AI response', { error: e, response: aiResponse });
        // Fallback: créer une structure basique
        parsedResponse = {
          summary: aiResponse.substring(0, 500),
          events_analysis: request.events.slice(0, 10).map((e) => ({
            ticker: e.ticker,
            event_type: e.type,
            phase: e.phase,
            description: e.description,
            date: e.date,
            analysis: {
              impact: 'moyen' as ImpactLevel,
              reason: 'Analyse en cours',
              summary: e.description,
              confidence: 50,
            },
          })),
          top_events: [],
        };
      }

      const response: CalendarSummaryResponse = {
        success: true,
        date_range: request.date_range,
        summary: parsedResponse.summary || 'Aucun résumé disponible',
        events_analysis: parsedResponse.events_analysis || [],
        top_events: parsedResponse.top_events || [],
        cached: false,
        timestamp: new Date().toISOString(),
      };

      // Mettre en cache avec hash des holdings (cache long: 24h si données identiques)
      await this.cacheAnalysis(cacheKey, response, 86400); // 24h

      return response;
      },
      'analyzeCalendarSummary'
    );
  }

  /**
   * Analyser un flux d'options inhabituel
   */
  async analyzeOptionsFlow(
    request: OptionsFlowAnalysisRequest
  ): Promise<OptionsFlowAnalysisResponse> {
    return handleError(
      async () => {
        const log = logger.child({ operation: 'analyzeOptionsFlow', ticker: request.ticker });
      log.info('Analyzing options flow', { signal_type: request.signal_type });

      // Générer un hash des métriques pour détecter si les données ont changé
      const metricsHash = this.generateDataHash(request.metrics || {});
      const cacheKey = `options_flow_${request.ticker}_${request.signal_type}_${metricsHash}`;
      
      // Vérifier le cache avec le hash des données
      const cached = await this.getCachedAnalysis(cacheKey, metricsHash);
      if (cached) {
        log.info('Returning cached options flow analysis (data unchanged)', { 
          ticker: request.ticker,
          metricsHash 
        });
        return {
          ...cached as OptionsFlowAnalysisResponse,
          cached: true,
        };
      }

      log.info('No cache found or data changed, generating new analysis', { 
        ticker: request.ticker,
        metricsHash 
      });

      const systemPrompt = `Tu es un analyste de trading d'options expérimenté avec 20 ans d'expérience.

Tu analyses les flux d'options pour identifier :
1. Les intentions des traders institutionnels
2. Les stratégies possibles (hedging, speculation, gamma squeeze setup)
3. Les risques et opportunités
4. Les scénarios probables (bullish, bearish, neutral)

STRUCTURE TA RÉPONSE EN JSON:
{
  "observation": "Ce que tu observes en détail (3-4 lignes)",
  "interpretation": "Interprétation approfondie (4-5 lignes) incluant :
    - Qui pourrait trader (institutionnel vs retail)
    - Quelle stratégie est probable (hedging, speculation, gamma squeeze)
    - Pourquoi maintenant (timing, événements à venir)
    - Signaux contradictoires ou confirmants",
  "attention_level": "faible" | "moyen" | "élevé" | "critique",
  "strategy_hypothesis": {
    "primary": "gamma_squeeze" | "hedging" | "speculation" | "earnings_play" | "unknown",
    "confidence": 0.85,
    "reasoning": "Explication en 2-3 lignes"
  },
  "key_insights": [
    {
      "insight": "Description de l'insight",
      "impact": "faible" | "moyen" | "élevé" | "critique",
      "evidence": "Données qui supportent cet insight"
    }
  ],
  "scenarios": {
    "bullish": {
      "probability": 0.4,
      "price_target": 520,
      "conditions": "Conditions nécessaires pour ce scénario"
    },
    "bearish": {
      "probability": 0.3,
      "price_target": 480,
      "conditions": "Conditions nécessaires"
    },
    "neutral": {
      "probability": 0.3,
      "price_range": [490, 510],
      "conditions": "Conditions nécessaires"
    }
  },
  "recommendations": [
    {
      "action": "buy_calls" | "buy_puts" | "sell_calls" | "sell_puts" | "spread" | "wait" | "avoid",
      "strike": 500,
      "expiry": "2025-12-20",
      "reasoning": "Pourquoi cette recommandation",
      "risk_level": "low" | "medium" | "high"
    }
  ],
  "warnings": [
    "Avertissements importants (ex: 'IV très élevée, risque de crush après earnings')"
  ],
  "next_signals_to_watch": [
    "Signaux à surveiller (ex: 'Si prix dépasse 510, watch pour gamma squeeze')"
  ]
}

CRITÈRES D'ATTENTION:
- "critique": 
  * Volume 20x+ moyenne OU
  * 95%+ calls avec expirations <7 jours OU
  * Premium >10M$ avec OI change >500K OU
  * Max pain très éloigné du prix actuel (>5%) OU
  * IV percentile >90 avec skew extrême
  
- "élevé":
  * Volume 10x+ moyenne OU
  * 80%+ calls avec expirations <14 jours OU
  * Premium >5M$ OU
  * OI change >200K OU
  * IV percentile >75
  
- "moyen":
  * Volume 5x+ moyenne OU
  * Ratio calls/puts déséquilibré (>2:1 ou <1:2) OU
  * Unusual activity (sweeps/blocks) OU
  * IV percentile >60
  
- "faible":
  * Volume modéré
  * Ratio équilibré
  * Pas d'unusual activity

ANALYSE CONTEXTUELLE:
- Si earnings à venir <7 jours : Analyser si c'est un "earnings play"
- Si IV percentile >80 : Avertir du risque de "IV crush"
- Si max pain très éloigné : Analyser le risque de "pin" au max pain
- Si OI change massif : Analyser l'accumulation vs distribution
- Si skew extrême : Analyser le sentiment (puts chères = peur, calls chères = optimisme)

Toujours en français. Sois précis et actionnable.`;

      const userPrompt = `Signal options sur ${request.ticker}:

Type: ${request.signal_type}
Métriques:
${JSON.stringify(request.metrics, null, 2)}

Contexte:
${request.context ? JSON.stringify(request.context, null, 2) : 'Aucun contexte supplémentaire'}`;

      const aiResponse = await this.callOpenAI(systemPrompt, userPrompt);

      // Parser la réponse
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(aiResponse);
      } catch (e) {
        log.error('Failed to parse AI response', { error: e, response: aiResponse });
        parsedResponse = {
          observation: aiResponse.substring(0, 200),
          interpretation: 'Analyse en cours',
          attention_level: 'moyen' as ImpactLevel,
          key_insights: [],
          recommendations: [],
        };
      }

      const response: OptionsFlowAnalysisResponse = {
        success: true,
        ticker: request.ticker,
        signal_type: request.signal_type,
        analysis: {
          observation: parsedResponse.observation || 'Signal détecté',
          interpretation: parsedResponse.interpretation || 'Analyse en cours',
          attention_level: parsedResponse.attention_level || 'moyen',
          strategy_hypothesis: parsedResponse.strategy_hypothesis,
          key_insights: Array.isArray(parsedResponse.key_insights)
            ? parsedResponse.key_insights.map((k: any) =>
                typeof k === 'string'
                  ? { insight: k, impact: 'moyen' as ImpactLevel }
                  : { insight: k.insight || k, impact: k.impact || 'moyen', evidence: k.evidence }
              )
            : [],
          scenarios: parsedResponse.scenarios,
          recommendations: parsedResponse.recommendations
            ? parsedResponse.recommendations.map((r: any) =>
                typeof r === 'string'
                  ? { action: 'wait' as const, reasoning: r, risk_level: 'medium' as const }
                  : r
              )
            : [],
          warnings: parsedResponse.warnings || [],
          next_signals_to_watch: parsedResponse.next_signals_to_watch || [],
        },
        metrics: request.metrics,
        cached: false,
        timestamp: new Date().toISOString(),
      };

      // Mettre en cache avec hash des métriques (cache long: 24h si données identiques)
      await this.cacheAnalysis(cacheKey, response, 86400); // 24h

      return response;
      },
      'analyzeOptionsFlow'
    );
  }

  /**
   * Analyser les mouvements d'une institution
   */
  async analyzeInstitutionMoves(
    request: InstitutionMoveAnalysisRequest
  ): Promise<InstitutionMoveAnalysisResponse> {
    return handleError(
      async () => {
        const log = logger.child({
          operation: 'analyzeInstitutionMoves',
          institution: request.institution_name,
        });
      log.info('Analyzing institution moves');

      // Vérifier le cache
      const cacheKey = `institution_moves_${request.institution_cik}_${request.period || 'default'}`;
      const cached = await this.getCachedAnalysis(cacheKey);
      if (cached) {
        log.info('Returning cached institution moves analysis');
        return cached as InstitutionMoveAnalysisResponse;
      }

      // Limiter les données (top 20 holdings pour réduire les coûts)
      const topHoldings = (request.holdings_data || []).slice(0, 20);

      const systemPrompt = `Tu es un analyste de smart money avec 20 ans d'expérience dans l'analyse institutionnelle.

Tu analyses les mouvements d'une institution pour identifier :
1. La stratégie globale (rotation sectorielle, changement de style, etc.)
2. Les convictions fortes (nouvelles positions majeures, augmentations significatives)
3. Les risques (concentration, performance, timing)
4. Les opportunités de "copy trade" (suivre les smart money)

STRUCTURE TA RÉPONSE EN JSON:
{
  "summary": "Résumé des mouvements en 4-5 lignes avec focus sur la stratégie globale",
  "strategy_insight": {
    "primary_strategy": "sector_rotation" | "style_shift" | "conviction_building" | "risk_reduction" | "opportunistic" | "unknown",
    "confidence": 0.80,
    "reasoning": "Explication détaillée en 3-4 lignes",
    "evidence": ["Preuve 1", "Preuve 2", "Preuve 3"]
  },
  "key_moves": [
    {
      "ticker": "AAPL",
      "action": "buy" | "sell" | "hold" | "trim",
      "magnitude": "faible" | "moyen" | "élevé" | "critique",
      "change_pct": 0.25,
      "reason": "Explication en 2-3 lignes basée sur :
        - Performance de la position
        - Contexte sectoriel
        - Timing (événements à venir)
        - Comparaison avec historique",
      "conviction_level": "low" | "medium" | "high" | "very_high",
      "copy_trade_potential": "low" | "medium" | "high"
    }
  ],
  "portfolio_analysis": {
    "concentration_risk": "low" | "medium" | "high",
    "sector_bets": [
      {
        "sector": "Technology",
        "bet": "overweight",
        "reasoning": "Pourquoi ce bet sectoriel"
      }
    ],
    "style_analysis": {
      "current_style": "growth",
      "style_shift": false,
      "reasoning": "Explication"
    }
  },
  "performance_analysis": {
    "overall_performance": "outperforming" | "underperforming" | "in_line",
    "top_performers": [
      { "ticker": "AAPL", "pnl_pct": 0.25, "contribution": 0.15 }
    ],
    "underperformers": [
      { "ticker": "XYZ", "pnl_pct": -0.10, "contribution": -0.05 }
    ],
    "insights": "Insights sur la performance (ex: 'Focus sur tech qui performe bien')"
  },
  "attention_level": "faible" | "moyen" | "élevé" | "critique",
  "copy_trade_opportunities": [
    {
      "ticker": "AAPL",
      "action": "buy",
      "reasoning": "Pourquoi c'est une bonne opportunité de copy trade",
      "risk_level": "low" | "medium" | "high",
      "entry_strategy": "DCA sur 2 semaines" | "Entry immédiat" | "Wait for pullback"
    }
  ],
  "warnings": [
    "Avertissements (ex: 'Concentration élevée dans tech, risque sectoriel')"
  ],
  "next_moves_to_watch": [
    "Mouvements à surveiller (ex: 'Si XYZ continue à underperform, watch pour vente')"
  ]
}

CRITÈRES:
- "critique": 
  * Changements >50% de position OU
  * Nouvelles positions majeures (>100M$) OU
  * Rotation sectorielle majeure (>20% shift) OU
  * Concentration >60% dans top 10
  
- "élevé":
  * Changements 25-50% OU
  * Nouvelles positions significatives (50-100M$) OU
  * Rotation sectorielle modérée (10-20%)
  
- "moyen":
  * Changements 10-25% OU
  * Ajustements de positions
  
- "faible":
  * Changements <10% OU
  * Pas de mouvements significatifs

ANALYSE CONTEXTUELLE:
- Comparer avec performance du marché (SPY, secteurs)
- Analyser si les mouvements sont opportunistes ou stratégiques
- Identifier les patterns (accumulation, distribution, rotation)
- Évaluer le timing (avant/après earnings, événements)

Toujours en français. Sois précis et actionnable.`;

      const userPrompt = `Institution: ${request.institution_name} (CIK: ${request.institution_cik})
Période: ${request.period || 'Non spécifiée'}

Holdings (top 20):
${JSON.stringify(topHoldings, null, 2)}`;

      const aiResponse = await this.callOpenAI(systemPrompt, userPrompt);

      // Parser la réponse
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(aiResponse);
      } catch (e) {
        log.error('Failed to parse AI response', { error: e, response: aiResponse });
        parsedResponse = {
          summary: aiResponse.substring(0, 300),
          key_moves: [],
          attention_level: 'moyen' as ImpactLevel,
        };
      }

      const response: InstitutionMoveAnalysisResponse = {
        success: true,
        institution_cik: request.institution_cik,
        institution_name: request.institution_name,
        analysis: {
          summary: parsedResponse.summary || 'Analyse en cours',
          strategy_insight: parsedResponse.strategy_insight
            ? typeof parsedResponse.strategy_insight === 'string'
              ? {
                  primary_strategy: 'unknown' as const,
                  confidence: 0.5,
                  reasoning: parsedResponse.strategy_insight,
                }
              : parsedResponse.strategy_insight
            : undefined,
          key_moves: parsedResponse.key_moves || [],
          portfolio_analysis: parsedResponse.portfolio_analysis,
          performance_analysis: parsedResponse.performance_analysis,
          attention_level: parsedResponse.attention_level || 'moyen',
          copy_trade_opportunities: parsedResponse.copy_trade_opportunities || [],
          warnings: parsedResponse.warnings || [],
          next_moves_to_watch: parsedResponse.next_moves_to_watch || [],
        },
        period: request.period,
        cached: false,
        timestamp: new Date().toISOString(),
      };

      // Mettre en cache avec hash des holdings (cache long: 24h si données identiques)
      await this.cacheAnalysis(cacheKey, response, 86400); // 24h

      return response;
      },
      'analyzeInstitutionMoves'
    );
  }

  /**
   * Analyser l'activité globale d'un ticker
   */
  async analyzeTickerActivity(
    request: TickerActivityAnalysisRequest
  ): Promise<TickerActivityAnalysisResponse> {
    return handleError(
      async () => {
        const log = logger.child({
          operation: 'analyzeTickerActivity',
          ticker: request.ticker,
        });
      log.info('Analyzing ticker activity', { ticker: request.ticker });

      // Générer un hash des données d'entrée pour détecter si les données ont changé
      // IMPORTANT: Inclure le ticker dans le hash pour éviter les collisions entre tickers
      const dataHash = this.generateDataHash({
        ticker: request.ticker,
        data: request.data,
      });
      const cacheKey = `ticker_activity_${request.ticker.toUpperCase()}_${dataHash}`;
      
      // Vérifier le cache avec le hash des données (incluant le ticker)
      const cached = await this.getCachedAnalysis(cacheKey, dataHash, request.ticker);
      if (cached) {
        // Vérifier que le ticker correspond (sécurité supplémentaire)
        const cachedResponse = cached as TickerActivityAnalysisResponse;
        if (cachedResponse.ticker?.toUpperCase() === request.ticker.toUpperCase()) {
          log.info('Returning cached ticker activity analysis (data unchanged)', { 
            ticker: request.ticker,
            dataHash 
          });
          return {
            ...cachedResponse,
            cached: true,
          };
        } else {
          log.warn('Cache hit but ticker mismatch, invalidating and generating new analysis', {
            requested: request.ticker,
            cached: cachedResponse.ticker,
          });
          // Invalider le cache incorrect
          await this.invalidateCache(cacheKey);
        }
      }

      log.info('No cache found or data changed, generating new analysis', { 
        ticker: request.ticker,
        dataHash 
      });

      // Utiliser toutes les données enrichies
      const enrichedData = {
        options_flow: request.data.options_flow ? {
          total_volume: request.data.options_flow.total_volume,
          call_put_ratio: request.data.options_flow.call_put_ratio,
          unusual: request.data.options_flow.unusual,
          open_interest_change: request.data.options_flow.open_interest_change,
          implied_volatility: request.data.options_flow.implied_volatility,
          volume_profile: request.data.options_flow.volume_profile,
          unusual_activity: request.data.options_flow.unusual_activity,
          max_pain: request.data.options_flow.max_pain,
        } : null,
        dark_pool: request.data.dark_pool ? {
          total_volume: request.data.dark_pool.total_volume,
          largest_trade: request.data.dark_pool.largest_trade,
          institutions: request.data.dark_pool.institutions,
        } : null,
        insiders: request.data.insiders ? {
          count: request.data.insiders.count,
          net_buy_sell: request.data.insiders.net_buy_sell,
          buys: request.data.insiders.buys,
          sells: request.data.insiders.sells,
          total_value: request.data.insiders.total_value,
        } : null,
        short_interest: request.data.short_interest ? {
          short_interest: request.data.short_interest.short_interest,
          float: request.data.short_interest.float,
          ratio: request.data.short_interest.ratio,
          days_to_cover: request.data.short_interest.days_to_cover,
        } : null,
        institutional_ownership: request.data.institutional_ownership ? {
          total_shares: request.data.institutional_ownership.total_shares,
          changes: request.data.institutional_ownership.changes,
        } : null,
        price_action: request.data.price_action || null,
        recent_news: request.data.recent_news?.slice(0, 10) || [],
        upcoming_events: request.data.upcoming_events || [],
        meta: request.data.meta || undefined, // Métadonnées de statut pour l'IA
      };

      const systemPrompt = `Tu es un analyste de marché expérimenté spécialisé dans l'analyse multi-signaux.

Analyse l'activité globale d'un ticker en croisant TOUTES les données disponibles :
- **Price Action** (prix actuel, variation %, volume) - CRITIQUE pour déterminer le sentiment (haussière/baissière/neutre)
- Options Flow (volume, OI changes, IV, sweeps/blocks, max pain)
- Dark Pool (volume, institutions, patterns)
- Insiders (transactions, net buy/sell, valeurs)
- Short Interest (ratio, days to cover, trends)
- Institutional Ownership (changements récents)
- News & Events (earnings, FDA, etc.)

**IMPORTANT**: Utilise le prix actuel et sa variation pour déterminer le sentiment de marché :
- Prix en hausse > 0.5% → Sentiment haussier
- Prix en baisse < -0.5% → Sentiment baissier
- Variation entre -0.5% et +0.5% → Sentiment neutre

Génère une analyse complète et actionnable qui identifie :
1. Le sentiment de marché basé sur le prix actuel et sa variation
2. Les signaux convergents (plusieurs signaux pointent dans la même direction)
3. Les signaux divergents (contradictions à surveiller)
4. Les opportunités de trading (entry/exit points)
5. Les risques (short squeeze, IV crush, etc.)

Structure ta réponse en JSON:
{
  "overview": "Vue d'ensemble en 5-7 lignes avec synthèse des signaux",
  "convergent_signals": [
    {
      "type": "options_flow ou dark_pool ou insiders ou short_interest ou institutional",
      "description": "Description détaillée du signal",
      "strength": "faible ou moyen ou élevé ou critique",
      "evidence": ["preuve 1", "preuve 2"]
    }
  ],
  "divergent_signals": [
    {
      "type": "options_flow ou dark_pool ou insiders ou short_interest ou institutional",
      "description": "Contradiction observée",
      "interpretation": "Ce que cela peut signifier"
    }
  ],
  "trading_opportunities": [
    {
      "type": "long ou short ou neutral ou avoid",
      "description": "Opportunité identifiée",
      "entry_strategy": "Stratégie d'entrée",
      "risk_level": "faible ou moyen ou élevé",
      "time_horizon": "intraday ou 1-3 days ou 1 week ou 1 month"
    }
  ],
  "risks": [
    {
      "type": "short_squeeze ou iv_crush ou max_pain ou earnings ou other",
      "description": "Risque identifié",
      "probability": "faible ou moyen ou élevé",
      "mitigation": "Comment se protéger"
    }
  ],
  "key_insights": [
    {
      "insight": "Insight clé",
      "impact": "faible ou moyen ou élevé ou critique"
    }
  ],
  "attention_level": "faible ou moyen ou élevé ou critique",
  "narrative": "Récit humain de ce qui se passe (5-7 lignes)",
  "recommendations": ["recommandation 1", "recommandation 2"]
}

Sois concis mais actionnable. Toujours en français.`;

      const userPrompt = `Ticker: ${request.ticker}

Données enrichies complètes:
${JSON.stringify(enrichedData, null, 2)}

Analyse en profondeur en croisant tous les signaux. Identifie les patterns, convergences et divergences.`;

      const aiResponse = await this.callOpenAI(systemPrompt, userPrompt);

      // Parser la réponse
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(aiResponse);
      } catch (e) {
        log.error('Failed to parse AI response', { error: e, response: aiResponse });
        parsedResponse = {
          overview: aiResponse.substring(0, 300),
          convergent_signals: [],
          divergent_signals: [],
          trading_opportunities: [],
          risks: [],
          key_insights: [],
          attention_level: 'moyen' as ImpactLevel,
          narrative: 'Analyse en cours',
          recommendations: [],
        };
      }

      // Extraire les données de prix pour la réponse
      const priceData = request.data.price_action ? {
        current_price: request.data.price_action.current_price,
        price_change_pct: request.data.price_action.price_change_pct,
        volume: request.data.price_action.volume,
        sentiment: request.data.price_action.price_change_pct 
          ? (request.data.price_action.price_change_pct > 0.5 ? "haussière" as const
            : request.data.price_action.price_change_pct < -0.5 ? "baissière" as const
            : "neutre" as const)
          : "neutre" as const,
        trend: request.data.price_action.price_change_pct
          ? (request.data.price_action.price_change_pct > 0 ? "bullish" as const
            : request.data.price_action.price_change_pct < 0 ? "bearish" as const
            : "neutral" as const)
          : "neutral" as const,
      } : undefined;

      const response: TickerActivityAnalysisResponse = {
        success: true,
        ticker: request.ticker,
        price_data: priceData,
        analysis: {
          overview: parsedResponse.overview || 'Analyse en cours',
          convergent_signals: parsedResponse.convergent_signals || [],
          divergent_signals: parsedResponse.divergent_signals || [],
          trading_opportunities: parsedResponse.trading_opportunities || [],
          risks: parsedResponse.risks || [],
          key_insights: parsedResponse.key_insights || [],
          attention_level: parsedResponse.attention_level || 'moyen',
          narrative: parsedResponse.narrative || 'Analyse en cours',
          recommendations: parsedResponse.recommendations || [],
        },
        cached: false,
        timestamp: new Date().toISOString(),
      };

      // Mettre en cache avec hash des métriques (cache long: 24h si données identiques)
      await this.cacheAnalysis(cacheKey, response, 86400); // 24h

      return response;
      },
      'analyzeTickerActivity'
    );
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
    
    // Log pour debug (masquer la clé)
    const keyPreview = OPENAI_API_KEY 
      ? `${OPENAI_API_KEY.substring(0, 10)}...${OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4)}`
      : 'NOT_SET';
    log.info('Calling OpenAI API', { 
      model: OPENAI_MODEL,
      key_preview: keyPreview,
      key_length: OPENAI_API_KEY?.length || 0
    });

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
   * Générer un hash des données d'entrée pour le cache
   * Si les données sont identiques, le hash sera le même → cache hit
   */
  private generateDataHash(data: any): string {
    try {
      // Normaliser les données (trier les clés, supprimer les valeurs null/undefined)
      const normalized = JSON.stringify(data, Object.keys(data).sort());
      const hash = createHash('sha256').update(normalized).digest('hex');
      return hash.substring(0, 16); // Utiliser les 16 premiers caractères pour la clé
    } catch (e) {
      logger.error('Error generating data hash', { error: e });
      // Fallback: utiliser un hash basé sur la stringification simple
      return createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 16);
    }
  }

  /**
   * Récupérer une analyse en cache depuis Supabase
   * Recherche par ticker + hash des données pour trouver si les données sont identiques
   * IMPORTANT: Le cache_key doit inclure le ticker pour éviter les collisions
   */
  private async getCachedAnalysis(cacheKey: string, dataHash?: string, expectedTicker?: string): Promise<any | null> {
    try {
      // TEMPORAIRE: Invalider tous les caches pour forcer une nouvelle analyse
      // TODO: Retirer cette logique après vérification
      const INVALIDATE_CACHE = process.env.INVALIDATE_AI_CACHE === 'true';
      if (INVALIDATE_CACHE) {
        logger.info('Cache invalidation enabled, skipping cache lookup', { cacheKey });
        return null;
      }

      // Recherche stricte par cache_key exact (qui inclut maintenant le ticker + hash)
      const { data, error } = await supabase
        .from('ai_analyses')
        .select('*')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      // Vérification supplémentaire: extraire le ticker du cache_key pour sécurité
      const cacheKeyParts = cacheKey.split('_');
      const tickerFromKey = cacheKeyParts.length >= 3 ? cacheKeyParts[2] : null;
      
      // Si on peut extraire le ticker, vérifier qu'il correspond
      if (tickerFromKey && data.analysis_data?.ticker) {
        if (data.analysis_data.ticker.toUpperCase() !== tickerFromKey.toUpperCase()) {
          logger.warn('Cache key ticker mismatch, invalidating cache', {
            cacheKey,
            cachedTicker: data.analysis_data.ticker,
            expectedTicker: tickerFromKey,
          });
          // Invalider ce cache incorrect
          await this.invalidateCache(cacheKey);
          return null;
        }
      }

      // Vérification supplémentaire si un ticker est attendu
      if (expectedTicker && data.analysis_data?.ticker) {
        if (data.analysis_data.ticker.toUpperCase() !== expectedTicker.toUpperCase()) {
          logger.warn('Cache ticker mismatch with expected ticker, invalidating cache', {
            cacheKey,
            cachedTicker: data.analysis_data.ticker,
            expectedTicker,
          });
          await this.invalidateCache(cacheKey);
          return null;
        }
      }

      logger.info('Cache hit', { cacheKey, ticker: data.analysis_data?.ticker });
      return data.analysis_data;
    } catch (e) {
      logger.error('Error fetching cached analysis', { error: e, cacheKey });
      return null;
    }
  }

  /**
   * Mettre en cache une analyse dans Supabase
   */
  private async cacheAnalysis(
    cacheKey: string,
    analysisData: any,
    ttlSeconds: number = 86400 // 24h par défaut
  ): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

      await supabase.from('ai_analyses').upsert({
        cache_key: cacheKey,
        analysis_data: analysisData,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      logger.error('Error caching analysis', { error: e, cacheKey });
      // Ne pas faire échouer la requête si le cache échoue
    }
  }

  /**
   * Invalider le cache pour une clé spécifique
   */
  private async invalidateCache(cacheKey: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_analyses')
        .delete()
        .eq('cache_key', cacheKey);

      if (error) {
        logger.error('Error invalidating cache', { error, cacheKey });
      } else {
        logger.info('Cache invalidated', { cacheKey });
      }
    } catch (e) {
      logger.error('Error invalidating cache', { error: e, cacheKey });
    }
  }

  /**
   * Invalider le cache pour un ticker spécifique (toutes les analyses)
   */
  async invalidateTickerCache(ticker: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_analyses')
        .delete()
        .like('cache_key', `%_${ticker.toUpperCase()}_%`);

      if (error) {
        logger.error('Error invalidating ticker cache', { error, ticker });
      } else {
        logger.info('Ticker cache invalidated', { ticker });
      }
    } catch (e) {
      logger.error('Error invalidating ticker cache', { error: e, ticker });
    }
  }

  /**
   * Analyser le calendrier économique Unusual Whales uniquement
   * Analyse simple et directe des événements économiques
   */
  async analyzeEconomicCalendar(events: any[]): Promise<{
    success: boolean;
    summary: string;
    top_events: Array<{
      date: string;
      event: string;
      type: string;
      impact: ImpactLevel;
      reason: string;
    }>;
    cached: boolean;
    timestamp: string;
  }> {
    return handleError(
      async () => {
        const log = logger.child({ operation: 'analyzeEconomicCalendar' });
        log.info('Analyzing economic calendar', { events_count: events.length });

        // Vérifier le cache
        const cacheKey = `economic_calendar_${events.length}_${new Date().toISOString().split('T')[0]}`;
        const cached = await this.getCachedAnalysis(cacheKey);
        if (cached) {
          log.info('Returning cached economic calendar analysis');
          return cached as any;
        }

        // Vérifier qu'il y a des événements
        if (!events || events.length === 0) {
          return {
            success: true,
            summary: 'Aucun événement économique à analyser.',
            top_events: [],
            cached: false,
            timestamp: new Date().toISOString(),
          };
        }

        // Préparer les données pour l'IA (limiter à 100 événements max)
        const topEvents = events
          .slice(0, 100)
          .map((e: any) => ({
            type: e.type || 'unknown',
            event: e.event || '',
            time: e.time || '',
            prev: e.prev || null,
            forecast: e.forecast || null,
            reported_period: e.reported_period || null,
          }))
          .filter((e: any) => e.event && e.time);

        if (topEvents.length === 0) {
          return {
            success: true,
            summary: 'Aucun événement économique valide à analyser.',
            top_events: [],
            cached: false,
            timestamp: new Date().toISOString(),
          };
        }

        // Appeler l'IA
        const systemPrompt = `Tu es un analyste financier expert. Tu analyses un calendrier économique Unusual Whales.

Ta mission :
1. Identifier les événements les plus importants (taux d'intérêt, FOMC, indicateurs économiques majeurs, etc.)
2. Classer chaque événement par impact : "critique", "élevé", "moyen", "faible"
3. Expliquer pourquoi chaque événement est important pour les marchés
4. Générer un résumé global de la semaine/mois

Règles strictes :
- Les décisions de taux (Fed FOMC, ECB, BoJ, BoE) sont TOUJOURS "critique"
- Les indicateurs majeurs (Nonfarm Payrolls, CPI, GDP pour US/CN/JP) sont "élevé" ou "critique"
- Les événements géopolitiques majeurs sont "élevé" ou "critique"
- Les autres événements sont "moyen" ou "faible"

Retourne un JSON avec :
{
  "summary": "Résumé global en 3-5 lignes",
  "top_events": [
    {
      "date": "YYYY-MM-DD extrait de time",
      "event": "Nom de l'événement",
      "type": "Type d'événement",
      "impact": "critique|élevé|moyen|faible",
      "reason": "Pourquoi cet événement est important (1-2 phrases)"
    }
  ]
}`;

        const userPrompt = `Analyse ce calendrier économique Unusual Whales :

${JSON.stringify(topEvents, null, 2)}

Identifie les événements les plus importants et génère une analyse.`;

        const aiResponse = await this.callOpenAI(systemPrompt, userPrompt, {
          temperature: 0.3,
          maxTokens: 2000,
        });

        let analysis: any;
        try {
          analysis = JSON.parse(aiResponse);
        } catch (e) {
          log.error('Failed to parse AI response', { response: aiResponse });
          // Fallback : analyse basique
          analysis = {
            summary: `Calendrier économique avec ${events.length} événements. Analysez les événements de taux d'intérêt et les indicateurs économiques majeurs.`,
            top_events: topEvents.slice(0, 10).map((e: any) => ({
              date: e.time ? e.time.split('T')[0] : '',
              event: e.event,
              type: e.type,
              impact: 'moyen' as ImpactLevel,
              reason: 'Événement économique à surveiller',
            })),
          };
        }

        const result = {
          success: true,
          summary: analysis.summary || 'Analyse du calendrier économique.',
          top_events: (analysis.top_events || []).slice(0, 20), // Limiter à 20 événements
          cached: false,
          timestamp: new Date().toISOString(),
        };

        // Mettre en cache
        await this.cacheAnalysis(cacheKey, result);

        return result;
      },
      'analyzeEconomicCalendar'
    );
  }
}

export const aiAnalystService = new AIAnalystService();



