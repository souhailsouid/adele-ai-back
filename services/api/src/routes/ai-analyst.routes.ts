/**
 * Routes pour le service d'analyse IA
 */

import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { aiAnalystService } from '../services/ai-analyst.service';
import type {
  CalendarSummaryRequest,
  OptionsFlowAnalysisRequest,
  InstitutionMoveAnalysisRequest,
  TickerActivityAnalysisRequest,
} from '../types/ai-analyst';
import * as uw from '../unusual-whales';
import * as fmp from '../fmp';
import { getCombinedEconomicCalendar } from '../economic-calendar';
import {
  analyzeFinancialJuiceHeadline,
  getLatestFinancialJuiceAnalysis,
  type FinancialJuiceHeadline,
} from '../services/financial-juice.service';

function getPathParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.pathParameters?.[key];
}

function getQueryParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.queryStringParameters?.[key];
}

function getBody(event: APIGatewayProxyEventV2): any {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

export const aiAnalystRoutes = [
  /**
   * POST /ai/calendar-summary
   * Analyser un calendrier d'événements (FDA, Earnings, etc.)
   */
  {
    method: 'POST',
    path: '/ai/calendar-summary',
    handler: async (event) => {
      const body = getBody(event);

      // TOUJOURS récupérer les vraies données depuis les APIs (ignorer body.events si fourni)
      // Le backend doit faire les appels API nécessaires
      // Période par défaut : 30 jours
      const today = new Date();
      const defaultFrom = today.toISOString().split('T')[0];
      const defaultTo = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 jours par défaut
        .toISOString()
        .split('T')[0];
      
      const from = body.from || defaultFrom;
      const to = body.to || defaultTo;
      
      // Valider le format des dates (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(from) || !dateRegex.test(to)) {
        throw new Error('Invalid date format. Use YYYY-MM-DD format.');
      }
      
      // Valider que 'to' est après 'from'
      if (new Date(to) < new Date(from)) {
        throw new Error('End date (to) must be after start date (from).');
      }

      // Timeout helper avec gestion d'erreur gracieuse
        const timeout = (promise: Promise<any>, ms: number) => {
          return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
          ]).catch(() => null); // Retourne null au lieu de throw
        };

      // Prioriser : appeler d'abord l'API principale (plus importante)
      // Timeouts réduits pour éviter le timeout Lambda (10s)
      const calendar = await timeout(getCombinedEconomicCalendar({ from, to }), 4000);

      // Appeler les autres APIs en parallèle avec timeouts très courts (1-2s)
      // FDA Calendar : récupérer plusieurs dates dans la période (UW utilise une seule date)
      // On récupère les 3 premières dates de la période pour avoir plus de chances
      const datesToFetch = [
        from,
        new Date(new Date(from).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        new Date(new Date(from).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      ];

      const [fdaCalendar1, fdaCalendar2, fdaCalendar3, earningsCalendar] = await Promise.allSettled([
        timeout(uw.getUWFDACalendar({ date: datesToFetch[0], limit: 100 }), 2000),
        timeout(uw.getUWFDACalendar({ date: datesToFetch[1], limit: 100 }), 2000),
        timeout(uw.getUWFDACalendar({ date: datesToFetch[2], limit: 100 }), 2000),
        timeout(fmp.getFMPEarningsCalendar({ from, to }), 3000), // Augmenté à 3s pour plus de données
      ]);

      // News optionnel, on skip pour éviter le timeout
      // const news = await timeout(uw.getUWNewsHeadlines({ limit: 5 }), 1500);

      // Extraire les données
      const calendarData =
        calendar && calendar.success
          ? calendar.data || []
          : [];

      // Fusionner les données FDA de toutes les dates
      const fdaDataAll: any[] = [];
      [fdaCalendar1, fdaCalendar2, fdaCalendar3].forEach((result) => {
        if (result.status === 'fulfilled' && result.value?.success && result.value.data) {
          fdaDataAll.push(...(Array.isArray(result.value.data) ? result.value.data : []));
        }
      });
      console.log('FDA DATA ALL', fdaDataAll);
      console.log('FDA DATA calendarData', calendarData);
      console.log('FDA DATA fdaCalendar1', fdaCalendar1);
      console.log('FDA DATA fdaCalendar2', fdaCalendar2);
      console.log('FDA DATA fdaCalendar3', fdaCalendar3);

      // Filtrer les événements FDA dans la période from/to et dédupliquer
      const fdaDataMap = new Map<string, any>();
      fdaDataAll.forEach((e: any) => {
        const eventDate = e.date || e.fda_date;
        if (eventDate && eventDate >= from && eventDate <= to) {
          const key = `${e.ticker}_${eventDate}_${e.description || ''}`;
          if (!fdaDataMap.has(key)) {
            fdaDataMap.set(key, e);
          }
        }
      });
      const fdaData = Array.from(fdaDataMap.values());
      console.log('FDA DATA', fdaData);
      // Extraire les données Earnings et filtrer par période
      const earningsDataRaw =
        earningsCalendar.status === 'fulfilled' && earningsCalendar.value?.success
          ? Array.isArray(earningsCalendar.value.data)
            ? earningsCalendar.value.data
            : []
          : [];

      // Filtrer les earnings dans la période from/to
      const earningsData = earningsDataRaw.filter((e: any) => {
        const eventDate = e.date || e.earningsDate;
        return eventDate && eventDate >= from && eventDate <= to;
      });

      // Helper pour détecter les événements critiques (taux, sanctions, embargos, etc.)
      // PRIORITÉ ABSOLUE : US, Chine, Japon (grandes économies qui font trembler les marchés)
      const isMajorEconomy = (country?: string): boolean => {
        if (!country) return false;
        const majorEconomies = ['US', 'CN', 'JP', 'CHN', 'JPN', 'USA'];
        return majorEconomies.includes(country.toUpperCase());
      };

      // Helper pour détecter les événements qui font trembler la planète
      // Seulement les événements MAJEURS qui impactent les marchés mondiaux
      const isPlanetShakingEvent = (eventName: string, country?: string, fmpImpact?: string): boolean => {
        const name = eventName.toLowerCase();
        const countryCode = country?.toUpperCase() || '';
        const impact = (fmpImpact || '').toLowerCase();
        
        // PRIORITÉ 1 : Taux US (Fed, FOMC) → Fait trembler TOUS les marchés
        if (countryCode === 'US' || countryCode === 'USA') {
          const usRateKeywords = [
            'interest rate decision',
            'rate decision',
            'fomc',
            'federal reserve',
            'fed interest rate',
            'fed press conference',
            'rate cut',
            'rate hike',
            'rate revision',
            'monetary policy',
          ];
          if (usRateKeywords.some((keyword) => name.includes(keyword))) {
            return true;
          }
        }
        
        // PRIORITÉ 2 : Taux Japon (BoJ) → Impact MASSIF sur carry trades
        if (countryCode === 'JP' || countryCode === 'JPN') {
          const jpRateKeywords = [
            'interest rate decision',
            'rate decision',
            'boj',
            'bank of japan',
            'rate cut',
            'rate hike',
            'rate revision',
            'monetary policy',
          ];
          if (jpRateKeywords.some((keyword) => name.includes(keyword))) {
            return true;
          }
        }
        
        // PRIORITÉ 3 : Taux Chine (PBoC) → Impact majeur sur les marchés asiatiques et mondiaux
        if (countryCode === 'CN' || countryCode === 'CHN') {
          const cnRateKeywords = [
            'interest rate decision',
            'rate decision',
            'pbc',
            'people\'s bank of china',
            'pboc',
            'rate cut',
            'rate hike',
            'rate revision',
            'monetary policy',
          ];
          if (cnRateKeywords.some((keyword) => name.includes(keyword))) {
            return true;
          }
        }
        
        // PRIORITÉ 4 : Indicateurs économiques MAJEURS US (seulement High impact)
        if ((countryCode === 'US' || countryCode === 'USA') && impact === 'high') {
          const usMajorIndicators = [
            'nonfarm payrolls',
            'cpi',
            'inflation',
            'gdp',
            'ppi',
            'producer price index',
            'jolts',
            'jobless claims',
            'initial jobless claims',
          ];
          if (usMajorIndicators.some((keyword) => name.includes(keyword))) {
            return true;
          }
        }
        
        // PRIORITÉ 5 : Douane, tarifs, trade wars (toujours critique)
        const tradeKeywords = [
          'tariff',
          'trade war',
          'trade restriction',
          'trade sanction',
          'customs',
          'douane',
          'import',
          'export',
          'trade talk',
          'trade negotiation',
        ];
        if (tradeKeywords.some((keyword) => name.includes(keyword))) {
          return true;
        }
        
        // PRIORITÉ 6 : Sanctions, embargos (toujours critique)
        const sanctionKeywords = [
          'sanction',
          'embargo',
          'ban',
        ];
        if (sanctionKeywords.some((keyword) => name.includes(keyword))) {
          return true;
        }
        
        // PRIORITÉ 7 : OPEC (impact sur pétrole et inflation mondiale)
        if (name.includes('opec')) {
          return true;
        }
        
        return false;
      };

      const isCriticalEvent = (eventName: string, country?: string): boolean => {
        const name = eventName.toLowerCase();
        const countryCode = country?.toUpperCase() || '';
        
        // PRIORITÉ 1 : Événements de taux et politique monétaire des grandes économies (US, CN, JP)
        const rateKeywords = [
          'interest rate decision',
          'rate decision',
          'fomc',
          'federal reserve',
          'fed interest rate',
          'fed press conference',
          'sec', // SEC (Securities and Exchange Commission) mais aussi peut être confondu avec taux
          'rate revision',
          'rate cut', // Baisse des taux
          'rate hike', // Hausse des taux
          'monetary policy',
          'policy decision',
          'central bank',
          // Banques centrales des grandes économies
          'pbc', // People's Bank of China
          'people\'s bank of china',
          'pboc',
          'boj', // Bank of Japan
          'bank of japan',
          'ecb', // European Central Bank (impacte aussi les marchés)
          'european central bank',
          'boe', // Bank of England
          'bank of england',
        ];
        
        // Si c'est un événement de taux ET que c'est une grande économie → CRITIQUE
        const isRateEvent = rateKeywords.some((keyword) => name.includes(keyword));
        if (isRateEvent && isMajorEconomy(country)) {
          return true;
        }
        
        // PRIORITÉ 2 : Indicateurs économiques majeurs des grandes économies
        const majorIndicators = [
          'nonfarm payrolls',
          'cpi',
          'inflation',
          'gdp',
          'unemployment rate',
          'ppi', // Producer Price Index
          'producer price index',
          'jolts', // Job Openings and Labor Turnover Survey
          'jobless claims',
          'initial jobless claims',
          'continuing jobless claims',
        ];
        
        // Si c'est un indicateur majeur ET que c'est une grande économie → CRITIQUE
        const isMajorIndicator = majorIndicators.some((keyword) => name.includes(keyword));
        if (isMajorIndicator && isMajorEconomy(country)) {
          return true;
        }
        
        // PRIORITÉ 3 : Sanctions, embargos, géopolitique (toujours critique)
        const geopoliticalKeywords = [
          'sanction',
          'embargo',
          'trade war',
          'tariff',
          'trade restriction',
          'summit',
          'trade talk',
          'negotiation',
          'treaty',
          'geopolitical',
        ];
        
        // PRIORITÉ 4 : Matières premières (OPEC, pétrole)
        const commodityKeywords = [
          'opec',
          'oil',
          'crude',
          'energy',
          'commodity',
        ];
        
        // Si c'est géopolitique ou commodity → CRITIQUE
        if (geopoliticalKeywords.some((keyword) => name.includes(keyword))) {
          return true;
        }
        
        if (commodityKeywords.some((keyword) => name.includes(keyword))) {
          return true;
        }
        
        // Pour les autres événements, seulement critique si c'est une grande économie ET High impact
        return false;
      };

      // Helper pour déterminer le type d'événement
      const getEventType = (eventName: string, country?: string): string => {
        const name = eventName.toLowerCase();
        if (name.includes('earnings')) return 'Earnings';
        if (name.includes('fda') || name.includes('pdufa')) return 'FDA';
        if (name.includes('rate') || name.includes('fomc') || name.includes('central bank') || name.includes('monetary policy')) return 'Monetary Policy';
        if (name.includes('sanction') || name.includes('embargo') || name.includes('tariff') || name.includes('trade war')) return 'Geopolitical';
        if (name.includes('summit') || name.includes('trade talk') || name.includes('negotiation')) return 'Geopolitical';
        if (name.includes('nonfarm') || name.includes('cpi') || name.includes('gdp') || name.includes('inflation') || name.includes('unemployment')) return 'Economic Indicator';
        if (name.includes('opec') || name.includes('oil') || name.includes('crude') || name.includes('energy')) return 'Commodity';
        return 'Economic';
      };

      // Transformer les événements économiques avec détection des événements critiques
      // FILTRER STRICTEMENT : Seulement les événements qui font trembler la planète
      // - Marchés US (taux, indicateurs majeurs)
      // - Chine (taux, indicateurs majeurs)
      // - Japon (taux, carry trades)
      // - Douane, tarifs, trade wars
      // - Événements majeurs (High impact)
      const economicEvents = (calendarData || [])
        .filter((e: any) => {
          if (!e || !e.event || !e.date) return false;
          
          const country = e.country?.toUpperCase() || '';
          const eventName = (e.event || '').toString();
          const fmpImpact = (e.impact || '').toString().toLowerCase();
          
          // INCLURE SEULEMENT si :
          // 1. C'est un événement qui fait trembler la planète (taux US/CN/JP, douane, tarifs, etc.)
          // 2. OU c'est High impact de FMP ET grande économie (US, CN, JP)
          const isPlanetShaking = isPlanetShakingEvent(eventName, country, fmpImpact);
          const isMajor = isMajorEconomy(country);
          
          return isPlanetShaking || (isMajor && fmpImpact === 'high');
        })
        .map((e: any) => {
          const eventName = (e.event || '').toString();
          const fmpImpact = (e.impact || '').toString().toLowerCase(); // Impact de FMP (Low, Medium, High, None)
          const country = e.country?.toUpperCase() || 'N/A';
          const isMajor = isMajorEconomy(country);
          const isCriticalByName = isCriticalEvent(eventName, e.country);
          const eventType = getEventType(eventName, e.country);
          
          // Un événement est critique si :
          // 1. Il fait trembler la planète (taux US/CN/JP, douane, tarifs, etc.)
          // 2. OU si FMP l'a marqué comme "High" impact ET c'est une grande économie
          const isPlanetShaking = isPlanetShakingEvent(eventName, country, fmpImpact);
          const isCritical = isPlanetShaking || (isMajor && fmpImpact === 'high');
          
          // Prioriser les événements critiques même s'ils n'ont pas de ticker
          // Utiliser l'impact de FMP si disponible, sinon utiliser notre détection
          let impact = 'Medium';
          if (fmpImpact === 'high') {
            impact = 'High'; // FMP a marqué comme High
          } else if (isCritical) {
            impact = 'High'; // Notre détection l'a marqué comme critique
          } else if (fmpImpact === 'medium' && isMajor) {
            impact = 'Medium'; // Grande économie avec Medium impact
          } else if (fmpImpact === 'medium') {
            impact = 'Low'; // Petite économie avec Medium impact → Low
          } else if (fmpImpact === 'low' || fmpImpact === 'none') {
            impact = 'Low';
          }
          
          return {
            ticker: 'N/A',
            type: eventType,
            description: eventName,
            date: e.date,
            impact: impact,
            country: country,
            fmp_impact: fmpImpact, // Conserver l'impact original de FMP pour l'IA
            is_critical: isCritical, // Flag pour l'IA
            is_major_economy: isMajor, // Flag pour l'IA
            is_planet_shaking: isPlanetShaking, // Flag pour l'IA (fait trembler la planète)
            currency: e.currency || null,
            previous: e.previous || null,
            estimate: e.estimate || null,
          };
        });

      // Transformer les événements FDA
      const fdaEvents = (fdaData || []).map((e: any) => ({
        ticker: e.ticker || e.symbol || 'N/A',
        type: 'FDA' as const,
        phase: e.phase || e.stage || null,
        description: e.description || e.event || e.name || 'FDA Decision',
        date: e.date || e.fda_date || e.event_date,
        market_cap: e.market_cap || e.marketCap || null,
        historical_volatility: e.historical_volatility || e.volatility || null,
        impact: 'High' as const,
      }));

      // Transformer les événements Earnings
      // FILTRER : Seulement les mega-caps et grandes caps (market cap > 10B) qui impactent les indices
      const megaCaps = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'NFLX', 'AMD', 'INTC', 'ORCL', 'CRM', 'ADBE', 'CSCO', 'AVGO', 'QCOM', 'TXN', 'AMAT', 'LRCX', 'KLAC'];
      const earningsEvents = (earningsData || [])
        .filter((e: any) => {
          const symbol = (e.symbol || e.ticker || '').toUpperCase();
          const marketCap = e.marketCap || e.market_cap;
          
          // INCLURE si :
          // 1. C'est une mega-cap connue
          // 2. OU market cap > 10B (grande cap qui impacte les indices)
          return megaCaps.includes(symbol) || (marketCap && parseFloat(marketCap) > 10);
        })
        .map((e: any) => {
          const symbol = e.symbol || e.ticker || 'N/A';
          const eventDate = e.date || e.earningsDate || e.report_date;
          const quarter = e.quarter || e.fiscalQuarterEndDate?.split('-')[1] || '?';
          const year = e.year || eventDate?.split('-')[0] || new Date().getFullYear();
          const marketCap = e.marketCap || e.market_cap;
          const isMegaCap = megaCaps.includes(symbol.toUpperCase());

          return {
            ticker: symbol,
            type: 'Earnings' as const,
            description: `${symbol} Q${quarter} ${year} Earnings${e.time ? ` (${e.time})` : ''}`,
            date: eventDate,
            market_cap: marketCap || null,
            impact: isMegaCap ? 'High' as const : 'Medium' as const, // Mega-caps = High impact
          };
        });

      // Log pour debug
      console.log('[AI Calendar] Events collected:', {
        economic: economicEvents.length,
        criticalEconomic: economicEvents.filter((e: any) => e.is_critical).length,
        fda: fdaEvents.length,
        earnings: earningsEvents.length,
        fdaWithTicker: fdaEvents.filter((e) => e.ticker && e.ticker !== 'N/A').length,
        earningsWithTicker: earningsEvents.filter((e) => e.ticker && e.ticker !== 'N/A').length,
      });

      // Fusionner tous les événements et prioriser les événements critiques
      // PRIORITÉ 1 : Événements avec impact "High" de FMP (Fed, CPI, PPI, JOLTs, etc.)
      const highImpactEvents = economicEvents.filter((e: any) => e.fmp_impact === 'high');
      
      // PRIORITÉ 2 : Événements macroéconomiques critiques détectés par nom (taux, sanctions, géopolitique)
      const criticalEconomicEvents = economicEvents.filter(
        (e: any) => e.is_critical && e.fmp_impact !== 'high' // Éviter les doublons
      );
      
      // PRIORITÉ 3 : Événements avec ticker réel (FDA, Earnings)
      const eventsWithTicker = [...fdaEvents, ...earningsEvents].filter(
        (e) => e.ticker && e.ticker !== 'N/A'
      );
      
      // PRIORITÉ 4 : Autres événements économiques avec impact Medium
      const mediumImpactEvents = economicEvents.filter(
        (e: any) => !e.is_critical && e.fmp_impact === 'medium'
      );
      
      // PRIORITÉ 5 : Autres événements économiques
      const otherEconomicEvents = economicEvents.filter(
        (e: any) => !e.is_critical && e.fmp_impact !== 'high' && e.fmp_impact !== 'medium'
      );
      
      // PRIORITÉ 6 : Autres événements sans ticker
      const eventsWithoutTicker = [
        ...fdaEvents.filter((e) => !e.ticker || e.ticker === 'N/A'),
        ...earningsEvents.filter((e) => !e.ticker || e.ticker === 'N/A'),
      ];

      // Prioriser : événements High impact de FMP en PREMIER, puis critiques détectés, puis ticker réel, puis autres
      const events = [
        ...highImpactEvents,         // Fed, CPI, PPI, JOLTs, etc. (impact High de FMP) en PREMIER
        ...criticalEconomicEvents,   // Taux, sanctions, géopolitique détectés par nom
        ...eventsWithTicker,         // FDA/Earnings avec ticker
        ...mediumImpactEvents,       // Événements Medium impact
        ...otherEconomicEvents,      // Autres événements économiques
        ...eventsWithoutTicker,      // Autres sans ticker
      ];

      console.log('[AI Calendar] Final events:', {
        total: events.length,
        highImpact: highImpactEvents.length,
        critical: criticalEconomicEvents.length,
        withTicker: eventsWithTicker.length,
        withoutTicker: eventsWithoutTicker.length,
        highImpactSample: highImpactEvents.slice(0, 5).map((e: any) => ({
          ticker: e.ticker,
          type: e.type,
          description: e.description,
          date: e.date,
          fmp_impact: e.fmp_impact,
          is_critical: e.is_critical,
        })),
        criticalSample: criticalEconomicEvents.slice(0, 5).map((e: any) => ({
          ticker: e.ticker,
          type: e.type,
          description: e.description,
          date: e.date,
          fmp_impact: e.fmp_impact,
          is_critical: e.is_critical,
        })),
      });

      // Si aucun événement valide après filtrage
      if (events.length === 0) {
        return {
          success: true,
          date_range: { from, to },
          summary: 'Aucun événement valide trouvé pour cette période.',
          events_analysis: [],
          top_events: [],
          cached: false,
          timestamp: new Date().toISOString(),
        };
      }

      const request: CalendarSummaryRequest = {
        date_range: { from, to },
        events,
      };

      return await aiAnalystService.analyzeCalendarSummary(request);
    },
  },

  /**
   * POST /ai/options-flow-analysis
   * Analyser un flux d'options inhabituel (100% dynamique)
   */
  {
    method: 'POST',
    path: '/ai/options-flow-analysis',
    handler: async (event) => {
      const body = getBody(event);

      if (!body.ticker) {
        throw new Error('Missing required field: ticker');
      }

      const ticker = body.ticker.toUpperCase();

      // Timeout helper
      // Timeout helper avec gestion d'erreur gracieuse
      const timeout = (promise: Promise<any>, ms: number) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
        ]).catch(() => null);
      };

      // Prioriser : appeler d'abord l'API principale
      const recentFlows = await timeout(uw.getUWRecentFlows(ticker, { limit: 50 }), 3000);

      // Appeler les autres APIs en parallèle avec timeouts courts
      const [flowPerExpiry, greeks, optionsVolume, maxPain, stockQuote, earningsCalendar] = await Promise.allSettled([
        timeout(uw.getUWFlowPerExpiry(ticker, {}), 2000),
        timeout(uw.getUWGreeks(ticker, { expiry: '' }), 2000),
        timeout(uw.getUWOptionsVolume(ticker, {}), 2000),
        timeout(uw.getUWMaxPain(ticker, {}), 2000),
        timeout(fmp.getFMPStockQuote(ticker), 2000),
        timeout(fmp.getFMPEarningsCalendar({ symbol: ticker, limit: 5 }), 2000),
      ]);

      // Extraire les données
      const flowsData =
        recentFlows && recentFlows.success
          ? recentFlows.data || []
          : [];
      const expiryData =
        flowPerExpiry.status === 'fulfilled' && flowPerExpiry.value?.success
          ? flowPerExpiry.value.data || []
          : [];
      const greeksData =
        greeks.status === 'fulfilled' && greeks.value?.success
          ? greeks.value.data || null
          : null;
      const volumeData =
        optionsVolume.status === 'fulfilled' && optionsVolume.value?.success
          ? optionsVolume.value.data || null
          : null;
      const maxPainData =
        maxPain.status === 'fulfilled' && maxPain.value?.success
          ? maxPain.value.data || null
          : null;
      const quoteData =
        stockQuote.status === 'fulfilled' && stockQuote.value?.success
          ? stockQuote.value.data || null
          : null;
      const earningsData =
        earningsCalendar.status === 'fulfilled' && earningsCalendar.value?.success
          ? (Array.isArray(earningsCalendar.value.data) ? earningsCalendar.value.data : [])
          : [];

      // Calculer les métriques automatiquement
      const totalVolume = flowsData.reduce((sum: number, f: any) => sum + (f.volume || 0), 0);
      const callVolume = flowsData
        .filter((f: any) => f.type === 'call' || f.type === 'CALL')
        .reduce((sum: number, f: any) => sum + (f.volume || 0), 0);
      const putVolume = flowsData
        .filter((f: any) => f.type === 'put' || f.type === 'PUT')
        .reduce((sum: number, f: any) => sum + (f.volume || 0), 0);
      const callPutRatio = putVolume > 0 ? callVolume / putVolume : callVolume > 0 ? 999 : 0;
      const totalPremium = flowsData.reduce((sum: number, f: any) => sum + (f.premium || f.total_premium || 0), 0);
      const biggestTrade = flowsData.reduce(
        (max: any, f: any) => ((f.premium || f.total_premium || 0) > (max?.premium || max?.total_premium || 0) ? f : max),
        null
      );

      // Calculer Open Interest changes
      const callOIChange = flowsData
        .filter((f: any) => f.type === 'call' || f.type === 'CALL')
        .reduce((sum: number, f: any) => sum + (f.open_interest || 0), 0);
      const putOIChange = flowsData
        .filter((f: any) => f.type === 'put' || f.type === 'PUT')
        .reduce((sum: number, f: any) => sum + (f.open_interest || 0), 0);
      const totalOIChange = callOIChange + putOIChange;

      // Trouver les strikes avec le plus d'OI change
      const oiByStrike = new Map<string, { call: number; put: number; strike: number; expiry: string }>();
      flowsData.forEach((f: any) => {
        const key = `${f.strike}_${f.expiry}`;
        if (!oiByStrike.has(key)) {
          oiByStrike.set(key, { call: 0, put: 0, strike: f.strike, expiry: f.expiry });
        }
        const entry = oiByStrike.get(key)!;
        if (f.type === 'call' || f.type === 'CALL') {
          entry.call += f.open_interest || 0;
        } else {
          entry.put += f.open_interest || 0;
        }
      });
      const maxOIStrikes = Array.from(oiByStrike.values())
        .map((e) => ({
          strike: e.strike,
          expiry: e.expiry,
          oi_change: e.call + e.put,
          type: e.call > e.put ? ('call' as const) : ('put' as const),
        }))
        .sort((a, b) => b.oi_change - a.oi_change)
        .slice(0, 5);

      // Détecter les sweeps et blocks
      const sweeps = flowsData.filter((f: any) => f.is_sweep || f.sweep).length;
      const blocks = flowsData.filter((f: any) => f.is_floor || f.floor || f.block).length;
      const largestSweep = flowsData
        .filter((f: any) => f.is_sweep || f.sweep)
        .reduce((max: any, f: any) => ((f.volume || 0) > (max?.volume || 0) ? f : max), null);

      // Volume profile par strike
      const volumeByStrike = new Map<number, { call: number; put: number }>();
      flowsData.forEach((f: any) => {
        if (!volumeByStrike.has(f.strike)) {
          volumeByStrike.set(f.strike, { call: 0, put: 0 });
        }
        const entry = volumeByStrike.get(f.strike)!;
        if (f.type === 'call' || f.type === 'CALL') {
          entry.call += f.volume || 0;
        } else {
          entry.put += f.volume || 0;
        }
      });
      const volumeProfileByStrike = Array.from(volumeByStrike.entries())
        .map(([strike, volumes]) => ({ strike, call_volume: volumes.call, put_volume: volumes.put }))
        .sort((a, b) => b.call_volume + b.put_volume - (a.call_volume + a.put_volume))
        .slice(0, 10);

      // Volume profile par expiry
      const volumeByExpiry = new Map<string, { total: number; call: number; put: number }>();
      flowsData.forEach((f: any) => {
        const expiry = f.expiry || 'unknown';
        if (!volumeByExpiry.has(expiry)) {
          volumeByExpiry.set(expiry, { total: 0, call: 0, put: 0 });
        }
        const entry = volumeByExpiry.get(expiry)!;
        entry.total += f.volume || 0;
        if (f.type === 'call' || f.type === 'CALL') {
          entry.call += f.volume || 0;
        } else {
          entry.put += f.volume || 0;
        }
      });
      const volumeProfileByExpiry = Array.from(volumeByExpiry.entries())
        .map(([expiry, volumes]) => ({
          expiry,
          total_volume: volumes.total,
          call_ratio: volumes.total > 0 ? volumes.call / volumes.total : 0,
        }))
        .sort((a, b) => b.total_volume - a.total_volume)
        .slice(0, 5);

      // Prix actuel et calculs basiques
      const currentPrice = quoteData?.price || greeksData?.spot_price || null;
      const priceChange = quoteData?.changePercent || null;
      const support = currentPrice ? currentPrice * 0.96 : null; // Approximation basique
      const resistance = currentPrice ? currentPrice * 1.04 : null; // Approximation basique
      const trend = priceChange ? (priceChange > 0 ? 'bullish' : priceChange < 0 ? 'bearish' : 'neutral') : null;

      // Max Pain
      const maxPainPrice = maxPainData?.max_pain || maxPainData?.price || null;
      const priceDistance = currentPrice && maxPainPrice ? Math.abs((currentPrice - maxPainPrice) / currentPrice) : null;

      // IV depuis greeks (approximation)
      const iv = greeksData?.iv || greeksData?.implied_volatility || null;
      const ivPercentile = iv ? Math.min(100, Math.max(0, (iv - 0.2) * 200)) : null; // Approximation basique

      // Détecter le type de signal automatiquement
      const avgVolume = volumeData?.avg_volume || 0;
      const volumeVsAvg = avgVolume > 0 ? totalVolume / avgVolume : 0;
      const shortTermExpirations = expiryData
        .filter((e: any) => {
          const expiryDate = new Date(e.expiry || e.date);
          const daysToExpiry = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          return daysToExpiry <= 7;
        })
        .map((e: any) => e.expiry || e.date);

      let signalType = 'unusual_options_flow';
      if (volumeVsAvg > 20 && callPutRatio > 9 && shortTermExpirations.length > 0) {
        signalType = 'gamma_squeeze';
      } else if (volumeVsAvg > 10) {
        signalType = 'unusual_options_flow';
      }

      // Événements à venir (earnings)
      const upcomingEvents = earningsData
        .filter((e: any) => {
          const eventDate = new Date(e.date || e.earningsDate);
          const daysToEvent = (eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          return daysToEvent >= 0 && daysToEvent <= 30; // Prochains 30 jours
        })
        .map((e: any) => ({
          type: 'earnings',
          date: e.date || e.earningsDate,
          description: `Q${e.quarter || 'N/A'} ${e.year || new Date().getFullYear()} Earnings`,
        }));

      const request: OptionsFlowAnalysisRequest = {
        ticker,
        signal_type: signalType as any,
        metrics: {
          volume_vs_avg: volumeVsAvg,
          call_put_ratio: callPutRatio,
          expirations: shortTermExpirations,
          biggest_trade: biggestTrade
            ? {
                size: biggestTrade.volume || 0,
                direction: (biggestTrade.type || 'call').toLowerCase() as 'call' | 'put',
                strike: biggestTrade.strike,
                expiry: biggestTrade.expiry,
              }
            : undefined,
          total_premium: totalPremium,
          unusual_volume: volumeVsAvg > 5,
          // NOUVELLES métriques enrichies
          open_interest_change: totalOIChange > 0
            ? {
                total_change: totalOIChange,
                call_oi_change: callOIChange,
                put_oi_change: putOIChange,
                max_oi_strikes: maxOIStrikes,
              }
            : undefined,
          implied_volatility: iv
            ? {
                current: iv,
                percentile: ivPercentile || undefined,
                vs_historical_avg: undefined, // Nécessiterait historique
                skew: undefined, // Nécessiterait calcul spécifique
              }
            : undefined,
          volume_profile:
            volumeProfileByStrike.length > 0 || volumeProfileByExpiry.length > 0
              ? {
                  by_strike: volumeProfileByStrike.length > 0 ? volumeProfileByStrike : undefined,
                  by_expiry: volumeProfileByExpiry.length > 0 ? volumeProfileByExpiry : undefined,
                }
              : undefined,
          unusual_activity:
            sweeps > 0 || blocks > 0
              ? {
                  sweeps,
                  blocks,
                  largest_sweep: largestSweep
                    ? {
                        size: largestSweep.volume || 0,
                        direction: (largestSweep.type || 'call').toLowerCase() as 'call' | 'put',
                        strike: largestSweep.strike,
                        expiry: largestSweep.expiry,
                      }
                    : undefined,
                }
              : undefined,
          max_pain: maxPainPrice
            ? {
                current: maxPainPrice,
                price_distance: priceDistance || undefined,
                oi_at_max_pain: undefined, // Nécessiterait calcul spécifique
              }
            : undefined,
          price_action: currentPrice
            ? {
                current_price: currentPrice,
                support: support || undefined,
                resistance: resistance || undefined,
                trend: trend || undefined,
                rsi: undefined, // Nécessiterait calcul technique
                volume_trend: volumeData?.volume_trend || undefined,
              }
            : undefined,
        },
        context: {
          recent_news: [], // Skip news pour éviter timeout
          upcoming_events: upcomingEvents,
          price_action: currentPrice
            ? `Current price: ${currentPrice}${priceChange ? ` (${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%)` : ''}`
            : undefined,
          historical_patterns: undefined, // Nécessiterait historique
        },
      };

      return await aiAnalystService.analyzeOptionsFlow(request);
    },
  },

  /**
   * POST /ai/institution-moves-analysis
   * Analyser les mouvements d'une institution
   */
  {
    method: 'POST',
    path: '/ai/institution-moves-analysis',
    handler: async (event) => {
      const body = getBody(event);

      if (!body.institution_cik || !body.institution_name) {
        throw new Error('Missing required fields: institution_cik, institution_name');
      }

      // Timeout helper avec gestion d'erreur gracieuse
      const timeout = (promise: Promise<any>, ms: number) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
        ]).catch(() => null);
      };

      // Calculer les dates pour l'historique (4 trimestres = 1 an)
      const today = new Date();
      const currentQuarterEnd = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3 + 2, 0);
      const quarters = [];
      for (let i = 0; i < 4; i++) {
        const quarterDate = new Date(currentQuarterEnd);
        quarterDate.setMonth(quarterDate.getMonth() - i * 3);
        quarters.push(quarterDate.toISOString().split('T')[0]);
      }

      // Prioriser : appeler d'abord l'API principale (holdings actuels)
      const holdings = await timeout(
        uw.getUWInstitutionHoldings(body.institution_cik, {
          limit: 100, // Augmenté pour avoir plus de données
          order: 'units_change',
          order_direction: 'desc',
        }),
        4000
      );

      // Récupérer les holdings historiques (derniers 4 trimestres)
      const historicalHoldingsPromises = quarters.slice(1).map((date) =>
        timeout(
          uw.getUWInstitutionHoldings(body.institution_cik, {
            date,
            limit: 100,
            order: 'value',
            order_direction: 'desc',
          }),
          2000
        )
      );

      // Appeler les autres APIs en parallèle avec timeouts courts
      const [activity, sectorExposure, latestFilings, ...historicalHoldingsResults] = await Promise.allSettled([
        timeout(uw.getUWInstitutionActivity(body.institution_cik, { limit: 50 }), 2000),
        timeout(uw.getUWInstitutionSectorExposure(body.institution_cik, {}), 2000),
        timeout(uw.getUWLatestFilings({ institution: body.institution_cik, limit: 5 }), 2000),
        ...historicalHoldingsPromises,
      ]);

      // Extraire les données historiques
      const historicalDataByDate = new Map<string, any[]>();
      historicalHoldingsResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value?.success && result.value.data) {
          historicalDataByDate.set(quarters[index + 1], result.value.data);
        }
      });

      // TOUJOURS utiliser les vraies données depuis les APIs
      const currentHoldings: any[] = holdings && holdings.success && holdings.data ? holdings.data : [];
      const sectorExposureData =
        sectorExposure.status === 'fulfilled' && sectorExposure.value?.success
          ? sectorExposure.value.data || []
          : [];

      // Enrichir les holdings avec historique et performance
      const enrichedHoldings = currentHoldings.slice(0, 50).map((h: any) => {
        // Récupérer l'historique pour ce ticker
        const historicalPositions: Array<{ date: string; units: number; value: number }> = [];
        historicalDataByDate.forEach((data, date) => {
          const historicalHolding = data.find((d: any) => d.ticker === h.ticker);
          if (historicalHolding) {
            historicalPositions.push({
              date,
              units: historicalHolding.units || 0,
              value: historicalHolding.value || 0,
            });
          }
        });

        // Calculer le changement en %
        const unitsChangePct =
          h.units && h.units_change ? h.units_change / (h.units - h.units_change) : undefined;

        // Récupérer le prix actuel pour calculer la performance
        // (on le fera en batch plus tard pour optimiser)

        return {
          ticker: h.ticker,
          units: h.units,
          units_change: h.units_change,
          units_change_pct: unitsChangePct,
          value: h.value,
          value_change: h.value_change,
          date: h.date,
          historical_positions: historicalPositions.length > 0 ? historicalPositions : undefined,
          // Performance sera calculée plus tard avec les prix actuels
          sector: h.sector || undefined,
          market_cap: h.market_cap || undefined,
        };
      });

      // Calculer les métriques de portefeuille
      const totalValue = enrichedHoldings.reduce((sum, h) => sum + (h.value || 0), 0);
      const top10Holdings = enrichedHoldings
        .sort((a, b) => (b.value || 0) - (a.value || 0))
        .slice(0, 10);
      const top10Concentration =
        totalValue > 0 ? top10Holdings.reduce((sum, h) => sum + (h.value || 0), 0) / totalValue : 0;

      // Calculer l'exposition sectorielle
      const sectorExposureMap: Record<string, number> = {};
      enrichedHoldings.forEach((h) => {
        if (h.sector && h.value) {
          sectorExposureMap[h.sector] = (sectorExposureMap[h.sector] || 0) + h.value;
        }
      });
      const sectorExposureNormalized: Record<string, number> = {};
      Object.keys(sectorExposureMap).forEach((sector) => {
        sectorExposureNormalized[sector] = totalValue > 0 ? sectorExposureMap[sector] / totalValue : 0;
      });

      // Calculer l'exposition par market cap
      const marketCapExposure: Record<string, number> = {};
      enrichedHoldings.forEach((h) => {
        if (h.market_cap && h.value) {
          marketCapExposure[h.market_cap] = (marketCapExposure[h.market_cap] || 0) + h.value;
        }
      });
      const marketCapExposureNormalized: Record<string, number> = {};
      Object.keys(marketCapExposure).forEach((cap) => {
        marketCapExposureNormalized[cap] = totalValue > 0 ? marketCapExposure[cap] / totalValue : 0;
      });

      // Détecter le style (simplifié : growth si tech >40%, value si finance >30%, etc.)
      let style: 'growth' | 'value' | 'momentum' | 'blend' = 'blend';
      if (sectorExposureNormalized['Technology'] > 0.4) {
        style = 'growth';
      } else if (sectorExposureNormalized['Finance'] > 0.3) {
        style = 'value';
      } else if (marketCapExposureNormalized['Large Cap'] > 0.7) {
        style = 'momentum';
      }

      // Calculer la sector rotation (comparer avec secteur exposure API si disponible)
      const sectorRotation = {
        increased: [] as Array<{ sector: string; change: number; new_exposure: number }>,
        decreased: [] as Array<{ sector: string; change: number; new_exposure: number }>,
      };

      // Récupérer le contexte marché (SPY performance - simplifié)
      const spyQuote = await timeout(fmp.getFMPStockQuote('SPY'), 2000);
      const spyPerformance =
        spyQuote && spyQuote.success && spyQuote.data?.changePercent ? spyQuote.data.changePercent / 100 : undefined;

      const request: InstitutionMoveAnalysisRequest = {
        institution_cik: body.institution_cik,
        institution_name: body.institution_name,
        ticker: body.ticker,
        period: body.period || '3M',
        holdings_data: enrichedHoldings,
        portfolio_metrics: {
          total_value: totalValue,
          top_10_concentration: top10Concentration,
          sector_exposure: sectorExposureNormalized,
          market_cap_exposure: marketCapExposureNormalized,
          style,
          turnover_rate: undefined, // Nécessiterait calcul plus complexe
        },
        sector_rotation: sectorRotation.increased.length > 0 || sectorRotation.decreased.length > 0 ? sectorRotation : undefined,
        market_context: spyPerformance
          ? {
              spy_performance_3m: spyPerformance,
              sector_performance: {}, // Nécessiterait récupération par secteur
            }
          : undefined,
      };

      return await aiAnalystService.analyzeInstitutionMoves(request);
    },
  },

  /**
   * POST /ai/ticker-activity-analysis
   * Analyser l'activité globale d'un ticker
   */
  {
    method: 'POST',
    path: '/ai/ticker-activity-analysis',
    handler: async (event) => {
      const body = getBody(event);

      if (!body.ticker) {
        throw new Error('Missing required field: ticker');
      }

      // TOUJOURS récupérer les vraies données depuis les APIs (ignorer body.data si fourni)
      // Le backend doit faire les appels API nécessaires
      const ticker = body.ticker.toUpperCase();

      // Timeout helper avec gestion d'erreur gracieuse
      const timeout = (promise: Promise<any>, ms: number) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
        ]).catch(() => null);
      };

      // Prioriser les APIs les plus importantes, timeouts réduits
      // Appeler les APIs critiques en premier
      const [optionsFlow, darkPool, insiders, shortInterest] = await Promise.allSettled([
        timeout(uw.getUWRecentFlows(ticker, { limit: 30 }), 3000), // Réduit à 30
        timeout(uw.getUWDarkPoolTrades(ticker, { limit: 30 }), 3000),
        timeout(uw.getUWStockInsiderBuySells(ticker, {}), 3000),
        timeout(uw.getUWShortInterestAndFloat(ticker), 2000),
      ]);

      // APIs optionnelles avec timeouts très courts (peuvent échouer sans problème)
      const [institutionalOwnership, quote] = await Promise.allSettled([
        timeout(uw.getUWInstitutionOwnership(ticker, { limit: 10 }), 2000),
        timeout(fmp.getFMPStockQuote(ticker), 2000),
      ]);

      const activityData = {
        options_flow:
          optionsFlow.status === 'fulfilled' && optionsFlow.value.success
            ? optionsFlow.value.data
            : null,
        dark_pool:
          darkPool.status === 'fulfilled' && darkPool.value.success
            ? darkPool.value.data
            : null,
        insiders:
          insiders.status === 'fulfilled' && insiders.value.success
            ? insiders.value.data
            : null,
        short_interest:
          shortInterest.status === 'fulfilled' && shortInterest.value.success
            ? shortInterest.value.data
            : null,
        institutional_ownership:
          institutionalOwnership.status === 'fulfilled' &&
          institutionalOwnership.value?.success
            ? institutionalOwnership.value.data
            : null,
        recent_news: [], // Skip news pour éviter timeout
        upcoming_events: [], // Skip events pour éviter timeout
        price_action: quote.status === 'fulfilled' && quote.value?.success
          ? {
              current_price: quote.value.data?.price || null,
              price_change_pct: quote.value.data?.changePercent || null,
              volume: quote.value.data?.volume || null,
            }
          : null,
      };

      const request: TickerActivityAnalysisRequest = {
        ticker: body.ticker.toUpperCase(),
        data: activityData,
      };

      return await aiAnalystService.analyzeTickerActivity(request);
    },
  },

  /**
   * POST /ai/financial-juice/analyze
   * Analyser un headline Financial Juice avec OpenAI
   */
  {
    method: 'POST',
    path: '/ai/financial-juice/analyze',
    handler: async (event) => {
      const body = getBody(event);

      if (!body.headline || !body.headline.title) {
        throw new Error('Missing required field: headline.title');
      }

      const headline: FinancialJuiceHeadline = {
        title: body.headline.title,
        description: body.headline.description,
        timestamp: body.headline.timestamp || new Date().toISOString(),
        category: body.headline.category,
        tickers: body.headline.tickers,
        impact_level: body.headline.impact_level,
        market_impact: body.headline.market_impact,
      };

      return await analyzeFinancialJuiceHeadline(headline);
    },
  },

  /**
   * GET /ai/financial-juice/latest
   * Récupérer et analyser les dernières headlines Financial Juice
   */
  {
    method: 'GET',
    path: '/ai/financial-juice/latest',
    handler: async (event) => {
      const limit = parseInt(getQueryParam(event, 'limit') || '10', 10);

      return await getLatestFinancialJuiceAnalysis(limit);
    },
  },
  /**
   * POST /ai/economic-calendar-analysis
   * Analyser le calendrier économique Unusual Whales uniquement
   */
  {
    method: 'POST',
    path: '/ai/economic-calendar-analysis',
    handler: async (event) => {
      const queryParams = event.queryStringParameters || {};
      const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 500;
      const date = queryParams.date;

      // Récupérer le calendrier économique UW
      const calendarResult = await uw.getUWEconomicCalendar({
        limit: Math.min(Math.max(limit, 1), 500),
        date: date,
      });

      if (!calendarResult.success || !calendarResult.data) {
        throw new Error('Failed to fetch economic calendar');
      }

      const events = Array.isArray(calendarResult.data) ? calendarResult.data : [];

      // Analyser avec l'IA
      const analysis = await aiAnalystService.analyzeEconomicCalendar(events);

      return {
        statusCode: 200,
        body: JSON.stringify(analysis),
      };
    },
  },
];
