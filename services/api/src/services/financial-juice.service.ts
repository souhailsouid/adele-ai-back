/**
 * Service Financial Juice
 * Analyse les nouvelles financières en temps réel avec OpenAI
 * Financial Juice : https://www.financialjuice.com/home
 * 
 * Financial Juice fournit des "squawk headlines" (annonces vocales) pour traders
 * - Nouvelles en temps réel qui bougent les marchés
 * - Headlines textuelles et vocales
 * - Focus sur les événements market-moving
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import { supabase } from '../supabase';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export interface FinancialJuiceHeadline {
  title: string;
  description?: string;
  timestamp: string;
  category?: string;
  tickers?: string[]; // Tickers mentionnés
  impact_level?: 'low' | 'medium' | 'high' | 'critical';
  market_impact?: string; // Analyse de l'impact
}

export interface FinancialJuiceAnalysis {
  headline: FinancialJuiceHeadline;
  ai_analysis: {
    impact: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
    affected_markets: string[]; // Ex: ['US', 'EUR', 'JPY']
    affected_sectors: string[]; // Ex: ['Tech', 'Energy']
    affected_tickers: string[];
    summary: string;
    confidence: number;
  };
}

/**
 * Récupérer et analyser la page Financial Juice directement avec l'IA
 * On scrape la page web et on envoie le contenu à OpenAI pour extraction et analyse
 */
async function fetchAndAnalyzeFinancialJuicePage(): Promise<FinancialJuiceHeadline[]> {
  const log = logger.child({ operation: 'fetchAndAnalyzeFinancialJuicePage' });
  log.info('Fetching Financial Juice page content');

  try {
    // Scraper la page Financial Juice
    const response = await fetch('https://www.financialjuice.com/home', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      log.error('Failed to fetch Financial Juice page', { status: response.status });
      return [];
    }

    const html = await response.text();
    log.info('Financial Juice page fetched', { htmlLength: html.length });

    // Envoyer le HTML à OpenAI pour extraction des headlines
    const headlines = await extractHeadlinesFromHTML(html);
    log.info('Headlines extracted', { count: headlines.length });

    return headlines;
  } catch (error) {
    log.error('Error fetching Financial Juice page', { error });
    return [];
  }
}

/**
 * Extraire les headlines depuis le HTML de Financial Juice avec OpenAI
 */
async function extractHeadlinesFromHTML(html: string): Promise<FinancialJuiceHeadline[]> {
  const log = logger.child({ operation: 'extractHeadlinesFromHTML' });

  // Limiter la taille du HTML pour éviter les coûts (premiers 50000 caractères)
  const limitedHTML = html.substring(0, 50000);

  const systemPrompt = `Tu es un assistant spécialisé dans l'extraction de nouvelles financières depuis des pages web.

À partir du HTML d'une page Financial Juice, tu dois extraire les "squawk headlines" (annonces vocales) qui sont des nouvelles qui bougent les marchés.

Pour chaque headline trouvé, extrais:
- title: Le titre de la nouvelle
- description: La description si disponible
- timestamp: La date/heure si disponible (format ISO)
- category: Le type (Monetary Policy, Earnings, Geopolitical, Commodity, etc.)
- tickers: Les tickers mentionnés (ex: ["AAPL", "TSLA"])

Retourne un JSON avec cette structure:
{
  "headlines": [
    {
      "title": "...",
      "description": "...",
      "timestamp": "2025-12-08T14:30:00Z",
      "category": "Monetary Policy",
      "tickers": []
    }
  ]
}

Sois précis et extrais uniquement les vraies nouvelles financières (pas les menus, footers, etc.).`;

  const userPrompt = `Extrais les headlines financiers de cette page Financial Juice:

${limitedHTML}`;

  try {
    const aiResponse = await callOpenAI(systemPrompt, userPrompt, { maxTokens: 2000 });
    const parsed = JSON.parse(aiResponse);
    return parsed.headlines || [];
  } catch (error) {
    log.error('Error extracting headlines with OpenAI', { error });
    return [];
  }
}

/**
 * Récupérer les headlines de Financial Juice
 * Utilise le scraping + IA pour extraire les headlines
 */
async function fetchFinancialJuiceHeadlines(limit: number = 20): Promise<FinancialJuiceHeadline[]> {
  const log = logger.child({ operation: 'fetchFinancialJuiceHeadlines' });
  
  // Récupérer et analyser la page avec l'IA
  const headlines = await fetchAndAnalyzeFinancialJuicePage();
  
  // Limiter le nombre de résultats
  return headlines.slice(0, limit);
}

/**
 * Analyser un headline Financial Juice avec OpenAI
 */
export async function analyzeFinancialJuiceHeadline(
  headline: FinancialJuiceHeadline
): Promise<FinancialJuiceAnalysis> {
  return handleError(
    async () => {
      const log = logger.child({ operation: 'analyzeFinancialJuiceHeadline' });
      log.info('Analyzing Financial Juice headline', { title: headline.title });

      // Vérifier le cache
      const cacheKey = `fj_headline_${headline.timestamp}_${headline.title.substring(0, 50)}`;
      const cached = await getCachedAnalysis(cacheKey);
      if (cached) {
        log.info('Returning cached Financial Juice analysis');
        return cached as FinancialJuiceAnalysis;
      }

      const systemPrompt = `Tu es un analyste de marché professionnel spécialisé dans l'analyse de nouvelles financières en temps réel.

Tu analyses des "squawk headlines" (annonces vocales) de Financial Juice qui sont des nouvelles qui BOUGENT LES MARCHÉS en temps réel.

Pour chaque headline, tu dois:

1. **Déterminer l'impact** : "low", "medium", "high", "critical"
2. **Expliquer pourquoi** en 1-2 phrases
3. **Identifier les marchés affectés** : US, EUR, JPY, CNY, etc.
4. **Identifier les secteurs affectés** : Tech, Energy, Finance, etc.
5. **Extraire les tickers mentionnés** (si applicable)
6. **Résumer l'impact** en 2-3 lignes

CRITÈRES D'IMPACT:

🔴 "critical" (fait trembler les marchés):
- Décisions de taux d'intérêt (Fed, ECB, BoJ, etc.)
- Sanctions économiques majeures
- Embargos commerciaux
- Chocs géopolitiques majeurs
- Décisions OPEC sur le pétrole
- Indicateurs économiques majeurs (Nonfarm Payrolls, CPI) qui surprennent
- Nouvelles de guerre/paix majeures

🟠 "high" (impact significatif):
- Earnings surprises majeurs (mega-caps)
- Fusions/acquisitions majeures
- Décisions réglementaires importantes (SEC, etc.)
- Nouvelles de produits révolutionnaires (ex: iPhone, Tesla Model 3)
- Changements de direction majeurs (CEO, etc.)

🟡 "medium" (impact modéré):
- Earnings standards
- Nouvelles sectorielles
- Changements de guidance
- Nouvelles de produits standards

🟢 "low" (impact limité):
- Nouvelles routinières
- Mises à jour mineures
- Nouvelles sans impact direct sur les marchés

Retourne un JSON bien formaté:
{
  "impact": "low" | "medium" | "high" | "critical",
  "reason": "Explication en 1-2 phrases",
  "affected_markets": ["US", "EUR", ...],
  "affected_sectors": ["Tech", "Energy", ...],
  "affected_tickers": ["AAPL", "TSLA", ...],
  "summary": "Résumé de l'impact en 2-3 lignes",
  "confidence": 85
}

Sois précis et actionnable. Toujours en français.`;

      const userPrompt = `Headline Financial Juice:

Titre: ${headline.title}
Description: ${headline.description || 'N/A'}
Timestamp: ${headline.timestamp}
Catégorie: ${headline.category || 'N/A'}
Tickers mentionnés: ${headline.tickers?.join(', ') || 'Aucun'}

Analyse cette nouvelle et détermine son impact sur les marchés.`;

      const aiResponse = await callOpenAI(systemPrompt, userPrompt);

      // Parser la réponse
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(aiResponse);
      } catch (e) {
        log.error('Failed to parse AI response', { error: e, response: aiResponse });
        parsedResponse = {
          impact: 'medium' as const,
          reason: 'Analyse en cours',
          affected_markets: [],
          affected_sectors: [],
          affected_tickers: [],
          summary: headline.title,
          confidence: 50,
        };
      }

      const analysis: FinancialJuiceAnalysis = {
        headline,
        ai_analysis: {
          impact: parsedResponse.impact || 'medium',
          reason: parsedResponse.reason || 'Analyse en cours',
          affected_markets: parsedResponse.affected_markets || [],
          affected_sectors: parsedResponse.affected_sectors || [],
          affected_tickers: parsedResponse.affected_tickers || [],
          summary: parsedResponse.summary || headline.title,
          confidence: parsedResponse.confidence || 50,
        },
      };

      // Mettre en cache (cache court: 1h)
      await cacheAnalysis(cacheKey, analysis, 3600);

      return analysis;
    },
    'analyzeFinancialJuiceHeadline'
  );
}

/**
 * Analyser plusieurs headlines en batch
 */
export async function analyzeFinancialJuiceHeadlines(
  headlines: FinancialJuiceHeadline[]
): Promise<FinancialJuiceAnalysis[]> {
  return handleError(
    async () => {
      const log = logger.child({ operation: 'analyzeFinancialJuiceHeadlines' });
      log.info('Analyzing Financial Juice headlines batch', { count: headlines.length });

      // Analyser en parallèle (max 5 à la fois pour éviter rate limits)
      const batchSize = 5;
      const results: FinancialJuiceAnalysis[] = [];

      for (let i = 0; i < headlines.length; i += batchSize) {
        const batch = headlines.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map((headline) => analyzeFinancialJuiceHeadline(headline))
        );

        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            log.error('Failed to analyze headline', { error: result.reason });
          }
        });
      }

      return results;
    },
    'analyzeFinancialJuiceHeadlines'
  );
}

/**
 * Récupérer et analyser les dernières headlines Financial Juice
 */
export async function getLatestFinancialJuiceAnalysis(limit: number = 10): Promise<FinancialJuiceAnalysis[]> {
  return handleError(
    async () => {
      const log = logger.child({ operation: 'getLatestFinancialJuiceAnalysis' });
      log.info('Fetching and analyzing latest Financial Juice headlines', { limit });

      // Récupérer les headlines
      const headlines = await fetchFinancialJuiceHeadlines(limit);

      if (headlines.length === 0) {
        log.warn('No Financial Juice headlines found');
        return [];
      }

      // Analyser avec OpenAI
      const analyses = await analyzeFinancialJuiceHeadlines(headlines);

      // Trier par impact (critical > high > medium > low)
      const impactOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      analyses.sort((a, b) => {
        const aImpact = impactOrder[a.ai_analysis.impact] || 0;
        const bImpact = impactOrder[b.ai_analysis.impact] || 0;
        return bImpact - aImpact;
      });

      return analyses;
    },
    'getLatestFinancialJuiceAnalysis'
  );
}

/**
 * Appeler OpenAI API
 */
async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const log = logger.child({ operation: 'callOpenAI' });
  log.info('Calling OpenAI API', { model: OPENAI_MODEL });

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
      max_tokens: options?.maxTokens || 1500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    log.error('OpenAI API error', { status: response.status, error });
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const result = (await response.json()) as any;
  const content = result.choices[0]?.message?.content || '{}';

  log.info('OpenAI API success', { tokens: result.usage?.total_tokens });
  return content;
}

/**
 * Récupérer une analyse en cache depuis Supabase
 */
async function getCachedAnalysis(cacheKey: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('ai_analyses')
      .select('*')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return null;
    }

    return data.analysis_data;
  } catch (e) {
    logger.error('Error fetching cached analysis', { error: e, cacheKey });
    return null;
  }
}

/**
 * Mettre en cache une analyse dans Supabase
 */
async function cacheAnalysis(
  cacheKey: string,
  analysisData: any,
  ttlSeconds: number = 3600 // 1h par défaut
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

