/**
 * Service Catalyst Aggregator
 * 
 * Centralise tous les événements de marché dans un calendrier unifié :
 * - Calendrier économique (Macro)
 * - Earnings prévus (Premarket & Afterhours)
 * - Whale Risk Alerts (Convergence Risk pour watchlist)
 * 
 * ⚠️ IMPORTANT : Ce service fait UNIQUEMENT des calculs mathématiques (pas d'IA).
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import * as uw from '../unusual-whales';
import { ConvergenceRiskService } from './convergence-risk.service';
import { EarningsHubService } from './earnings-hub.service';
import type {
  CatalystCalendarRequest,
  CatalystCalendarResponse,
  CatalystEvent,
  CatalystEventType,
  ImpactLevel,
} from '../types/catalyst-calendar';

export class CatalystAggregatorService {
  private convergenceRiskService: ConvergenceRiskService;
  private earningsHubService: EarningsHubService;

  constructor() {
    this.convergenceRiskService = new ConvergenceRiskService();
    this.earningsHubService = new EarningsHubService();
  }

  /**
   * Récupérer le calendrier catalyst agrégé
   */
  async getCatalystCalendar(
    request: CatalystCalendarRequest
  ): Promise<CatalystCalendarResponse> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getCatalystCalendar' });
      
      // Dates par défaut : aujourd'hui + 30 jours
      const today = new Date();
      const defaultStartDate = today.toISOString().split('T')[0];
      const defaultEndDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const startDate = request.startDate || defaultStartDate;
      const endDate = request.endDate || defaultEndDate;
      const watchlist = request.watchlist || [];

      log.info('Aggregating catalyst calendar', { startDate, endDate, watchlistSize: watchlist.length });

      // 1. Récupérer tous les événements en parallèle (optimisé pour performance)
      // Stratégie intelligente :
      // - Economic Calendar: Un seul appel (pas de filtrage par date côté API)
      // - Earnings: Limité aux 14 prochains jours ouvrables (les plus pertinents)
      // - Tous les appels en parallèle pour maximiser la vitesse
      
      // Générer la liste des dates (limité intelligemment)
      const tradingDates = this.generateTradingDates(startDate, endDate, 14); // Max 14 jours
      log.info('Fetching earnings for trading dates', { 
        tradingDates, 
        count: tradingDates.length,
        dateRange: `${startDate} to ${endDate}` 
      });

      // Récupérer TOUT en parallèle (Economic Calendar + Earnings pour toutes les dates)
      const allPromises: Promise<any>[] = [
        // Economic Calendar (1 appel)
        uw.getUWEconomicCalendar({ limit: 500 }),
      ];

      // Earnings : un appel par date (premarket + afterhours en parallèle pour chaque date)
      for (const date of tradingDates) {
        allPromises.push(
          Promise.allSettled([
            uw.getUWEarningsPremarket({ date, limit: 100 }),
            uw.getUWEarningsAfterhours({ date, limit: 100 }),
          ]).then(results => ({
            date,
            premarket: results[0],
            afterhours: results[1],
          }))
        );
      }

      // Attendre tous les résultats en parallèle
      const [economicCalendarResult, ...earningsResults] = await Promise.allSettled(allPromises);
      
      // Extraire le résultat du calendrier économique
      const economicCalendar = economicCalendarResult;

      // Log des résultats bruts pour diagnostic
      const economicData = economicCalendar.status === 'fulfilled' && economicCalendar.value.success && Array.isArray(economicCalendar.value.data) 
        ? economicCalendar.value.data 
        : [];
      
      // Agréger les données d'earnings de toutes les dates
      const allPremarketData: any[] = [];
      const allAfterhoursData: any[] = [];
      
      for (const result of earningsResults) {
        if (result.status === 'fulfilled' && result.value.premarket.status === 'fulfilled' && result.value.premarket.value.success) {
          const data = result.value.premarket.value.data;
          if (Array.isArray(data)) {
            allPremarketData.push(...data);
          }
        }
        if (result.status === 'fulfilled' && result.value.afterhours.status === 'fulfilled' && result.value.afterhours.value.success) {
          const data = result.value.afterhours.value.data;
          if (Array.isArray(data)) {
            allAfterhoursData.push(...data);
          }
        }
      }

      log.info('API responses status', {
        economicCalendar: economicCalendar.status === 'fulfilled' 
          ? { success: economicCalendar.value.success, dataCount: economicData.length, sample: economicData.slice(0, 2) }
          : { error: economicCalendar.reason },
        earningsPremarket: { 
          totalDates: tradingDates.length, 
          totalEarnings: allPremarketData.length, 
          sample: allPremarketData.slice(0, 2) 
        },
        earningsAfterhours: { 
          totalDates: tradingDates.length, 
          totalEarnings: allAfterhoursData.length, 
          sample: allAfterhoursData.slice(0, 2) 
        },
      });

      // 2. Convertir les événements économiques
      const macroResult = this.processEconomicEvents(economicCalendar, startDate, endDate, log);
      const macroEvents = macroResult.events;

      // 3. Convertir les événements Earnings (agrégés de toutes les dates)
      // Note: earningsResults contient maintenant les résultats structurés avec {date, premarket, afterhours}
      const earningsResult = await this.processEarningsEventsFromMultipleDates(
        earningsResults.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean),
        startDate,
        endDate,
        log
      );
      const earningsEvents = earningsResult.events;

      // 5. Générer les Whale Risk Alerts pour la watchlist
      const whaleRiskEvents = await this.processWhaleRiskAlerts(watchlist, startDate, endDate);

      // 6. Fusionner tous les événements et trier par date
      const allEvents = [
        ...macroEvents,
        ...earningsEvents,
        ...whaleRiskEvents,
      ].sort((a, b) => {
        try {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          if (isNaN(dateA) || isNaN(dateB)) {
            log.warn('Invalid date in event sorting', { eventA: a.id, dateA: a.date, eventB: b.id, dateB: b.date });
            return 0;
          }
          return dateA - dateB;
        } catch (error) {
          log.error('Error sorting events by date', { error, eventA: a.id, eventB: b.id });
          return 0;
        }
      });

      // 7. Appliquer la limite si fournie
      const events = request.limit ? allEvents.slice(0, request.limit) : allEvents;

      // 8. Calculer le résumé
      const summary = this.calculateSummary(events);

      // 9. Générer la vue d'ensemble des earnings par entreprise
      const earningsOverview = this.generateEarningsOverview(earningsEvents, log);

      log.info('Catalyst calendar aggregated', {
        total: events.length,
        macro: macroEvents.length,
        earnings: earningsEvents.length,
        whaleRisk: whaleRiskEvents.length,
        companiesWithEarnings: earningsOverview ? earningsOverview.companies.length : 0,
      });

      const response: CatalystCalendarResponse = {
        success: true,
        events,
        summary,
        earningsOverview,
        timestamp: new Date().toISOString(),
      };

      // Ajouter les statistiques de debug si demandé
      if (request.debug) {
        response.debug = {
          apiResponses: {
            economicCalendar: {
              dataCount: economicData.length,
              sample: economicData.slice(0, 2),
            },
            earningsPremarket: {
              dataCount: allPremarketData.length,
              sample: allPremarketData.slice(0, 2),
            },
            earningsAfterhours: {
              dataCount: allAfterhoursData.length,
              sample: allAfterhoursData.slice(0, 2),
            },
          },
          filtering: {
            macro: macroResult.stats,
            earnings: earningsResult.stats,
          },
        };
      }

      return response;
    }, 'Get catalyst calendar');
  }

  /**
   * Traiter les événements économiques (Macro)
   */
  private processEconomicEvents(
    result: PromiseSettledResult<any>,
    startDate: string,
    endDate: string,
    log?: any
  ): { events: CatalystEvent[]; stats: { total: number; missingTime: number; filteredByDate: number; filteredByImpact: number; kept: number } } {
    if (result.status !== 'fulfilled') {
      if (log) {
        log.warn('Economic calendar API request failed', {
          status: result.status,
          reason: result.reason,
        });
      }
      return {
        events: [],
        stats: { total: 0, missingTime: 0, filteredByDate: 0, filteredByImpact: 0, kept: 0 },
      };
    }

    if (!result.value.success) {
      if (log) {
        log.warn('Economic calendar API returned error', {
          success: result.value.success,
          error: result.value.error,
        });
      }
      return {
        events: [],
        stats: { total: 0, missingTime: 0, filteredByDate: 0, filteredByImpact: 0, kept: 0 },
      };
    }

    if (!result.value.data) {
      if (log) {
        log.warn('Economic calendar API returned no data', {
          success: result.value.success,
          data: result.value.data,
        });
      }
      return {
        events: [],
        stats: { total: 0, missingTime: 0, filteredByDate: 0, filteredByImpact: 0, kept: 0 },
      };
    }

    const events: CatalystEvent[] = [];
    const economicEvents = Array.isArray(result.value.data) ? result.value.data : [];
    
    if (!Array.isArray(result.value.data)) {
      if (log) {
        log.error('Economic calendar API returned invalid data format', {
          dataType: typeof result.value.data,
          data: result.value.data,
        });
      }
      return {
        events: [],
        stats: { total: 0, missingTime: 0, filteredByDate: 0, filteredByImpact: 0, kept: 0 },
      };
    }
    
    if (log) {
      log.info('Processing economic events', { total: economicEvents.length, startDate, endDate });
    }

    let filteredByDate = 0;
    let filteredByImpact = 0;
    let missingTime = 0;
    const sampleEvents: any[] = [];

    for (const event of economicEvents) {
      // UW utilise 'time' au format ISO, extraire la date
      const eventTime = event.time || event.date || event.event_date;
      if (!eventTime) {
        missingTime++;
        if (sampleEvents.length < 3) {
          sampleEvents.push({ event: event.event || event.event_name, raw: event });
        }
        continue;
      }
      
      // Extraire la date (YYYY-MM-DD) depuis l'ISO string
      const eventDate = eventTime.split('T')[0];
      if (!this.isDateInRange(eventDate, startDate, endDate)) {
        filteredByDate++;
        if (sampleEvents.length < 5) {
          sampleEvents.push({ event: event.event || event.event_name, eventDate, startDate, endDate, inRange: false });
        }
        continue;
      }

      const impact = this.calculateMacroImpact(event);
      if (impact === 'LOW') {
        filteredByImpact++;
        continue; // Ignorer les événements à faible impact
      }

      events.push({
        id: `macro-${eventDate}-${event.event || event.event_name || 'unknown'}`,
        type: 'MACRO',
        date: eventTime, // Garder l'heure complète pour l'affichage
        title: event.event || event.event_name || 'Événement économique',
        description: this.formatMacroDescription(event),
        ticker: null,
        impact,
        icon: '📊',
        metadata: {
          country: event.country || 'US',
          currency: event.currency || 'USD',
          previous: this.parseNumber(event.prev || event.previous) ?? undefined,
          estimate: this.parseNumber(event.forecast || event.estimate) ?? undefined,
          actual: this.parseNumber(event.actual) ?? undefined,
        },
      });
    }

    const stats = {
      total: economicEvents.length,
      missingTime,
      filteredByDate,
      filteredByImpact,
      kept: events.length,
    };

    if (log) {
      log.info('Economic events processed', {
        ...stats,
        sampleEvents: sampleEvents.slice(0, 3), // Log 3 exemples pour diagnostic
      });
    }

    return { events, stats };
  }

  // FDA events désactivés - pas de trading pharma

  /**
   * Générer la liste des jours ouvrables dans une plage de dates (optimisé)
   * 
   * Stratégie intelligente :
   * - Limite aux dates futures les plus proches (priorité)
   * - Exclut les weekends
   * - Limite le nombre total pour performance
   */
  private generateTradingDates(startDate: string, endDate: string, maxDays: number = 14): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let currentDate = new Date(start);
    currentDate.setHours(0, 0, 0, 0);
    let dayCount = 0;
    
    // Prioriser les dates futures (aujourd'hui et après)
    while (currentDate <= end && dayCount < maxDays) {
      const dayOfWeek = currentDate.getDay();
      
      // Exclure samedi (6) et dimanche (0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Prioriser les dates futures ou aujourd'hui
        if (currentDate >= today) {
          dates.push(currentDate.toISOString().split('T')[0]);
          dayCount++;
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  }

  /**
   * Traiter les événements Earnings depuis plusieurs dates (optimisé)
   */
  private async processEarningsEventsFromMultipleDates(
    earningsResults: Array<{ date: string; premarket: PromiseSettledResult<any>; afterhours: PromiseSettledResult<any> }>,
    startDate: string,
    endDate: string,
    log?: any
  ): Promise<{ events: CatalystEvent[]; stats: { premarket: { total: number; missingDate: number; filteredByDate: number; kept: number }; afterhours: { total: number; missingDate: number; filteredByDate: number; kept: number } } }> {
    const events: CatalystEvent[] = [];
    let premarketTotal = 0;
    let premarketMissingDate = 0;
    let premarketFilteredByDate = 0;
    let afterhoursTotal = 0;
    let afterhoursMissingDate = 0;
    let afterhoursFilteredByDate = 0;

    for (const dateResult of earningsResults) {
      const { premarket, afterhours } = dateResult;
      
      // Traiter premarket
      if (premarket.status === 'fulfilled' && premarket.value.success && Array.isArray(premarket.value.data)) {
        const premarketEarnings = premarket.value.data;
        premarketTotal += premarketEarnings.length;
        
        for (const earning of premarketEarnings) {
          const eventDate = earning.report_date || earning.date;
          if (!eventDate) {
            premarketMissingDate++;
            continue;
          }
          if (!this.isDateInRange(eventDate, startDate, endDate)) {
            premarketFilteredByDate++;
            continue;
          }

          const ticker = earning.symbol;
          const impact = this.calculateEarningsImpact(earning);

          events.push({
            id: `earnings-${eventDate}-${ticker}-premarket`,
            type: 'EARNINGS',
            date: eventDate,
            title: `${ticker} Earnings (Premarket)`,
            description: this.formatEarningsDescription(earning),
            ticker,
            impact,
            icon: '🌅',
            metadata: {
              reportTime: 'premarket',
              expectedMove: this.parseNumber(earning.expected_move) ?? undefined,
              expectedMovePerc: this.parseNumber(earning.expected_move_perc) ?? undefined,
            },
          });
        }
      }

      // Traiter afterhours
      if (afterhours.status === 'fulfilled' && afterhours.value.success && Array.isArray(afterhours.value.data)) {
        const afterhoursEarnings = afterhours.value.data;
        afterhoursTotal += afterhoursEarnings.length;
        
        for (const earning of afterhoursEarnings) {
          const eventDate = earning.report_date || earning.date;
          if (!eventDate) {
            afterhoursMissingDate++;
            continue;
          }
          if (!this.isDateInRange(eventDate, startDate, endDate)) {
            afterhoursFilteredByDate++;
            continue;
          }

          const ticker = earning.symbol;
          const impact = this.calculateEarningsImpact(earning);
          
          // Hub score sera ajouté après en batch (non-bloquant)

          events.push({
            id: `earnings-${eventDate}-${ticker}-afterhours`,
            type: 'EARNINGS',
            date: eventDate,
            title: `${ticker} Earnings (Afterhours)`,
            description: this.formatEarningsDescription(earning),
            ticker,
            impact,
            icon: '⚡',
            metadata: {
              reportTime: 'postmarket',
              expectedMove: this.parseNumber(earning.expected_move) ?? undefined,
              expectedMovePerc: this.parseNumber(earning.expected_move_perc) ?? undefined,
            },
          });
        }
      }
    }


    const stats = {
      premarket: {
        total: premarketTotal,
        missingDate: premarketMissingDate,
        filteredByDate: premarketFilteredByDate,
        kept: events.filter(e => e.metadata.reportTime === 'premarket').length,
      },
      afterhours: {
        total: afterhoursTotal,
        missingDate: afterhoursMissingDate,
        filteredByDate: afterhoursFilteredByDate,
        kept: events.filter(e => e.metadata.reportTime === 'postmarket').length,
      },
    };

    if (log) {
      log.info('Earnings events processed from multiple dates', stats);
    }

    return { events, stats };
  }

  /**
   * Traiter les événements Earnings
   */
  private async processEarningsEvents(
    premarketResult: PromiseSettledResult<any>,
    afterhoursResult: PromiseSettledResult<any>,
    startDate: string,
    endDate: string,
    log?: any
  ): Promise<{ events: CatalystEvent[]; stats: { premarket: { total: number; missingDate: number; filteredByDate: number; kept: number }; afterhours: { total: number; missingDate: number; filteredByDate: number; kept: number } } }> {
    const events: CatalystEvent[] = [];

    // Traiter premarket
    if (premarketResult.status === 'fulfilled' && premarketResult.value.success && premarketResult.value.data) {
      const premarketEarnings = Array.isArray(premarketResult.value.data) ? premarketResult.value.data : [];
      
      if (log) {
        log.info('Processing premarket earnings', { total: premarketEarnings.length, startDate, endDate });
      }

      let filteredByDate = 0;
      let missingDate = 0;
      const sampleEarnings: any[] = [];

      for (const earning of premarketEarnings) {
        const eventDate = earning.report_date || earning.date;
        if (!eventDate) {
          missingDate++;
          if (sampleEarnings.length < 3) {
            sampleEarnings.push({ ticker: earning.symbol, raw: earning });
          }
          continue;
        }
        if (!this.isDateInRange(eventDate, startDate, endDate)) {
          filteredByDate++;
          if (sampleEarnings.length < 5) {
            sampleEarnings.push({ ticker: earning.symbol, eventDate, startDate, endDate, inRange: false });
          }
          continue;
        }

        const ticker = earning.symbol;
        const impact = this.calculateEarningsImpact(earning);

        events.push({
          id: `earnings-${eventDate}-${ticker}-premarket`,
          type: 'EARNINGS',
          date: eventDate,
          title: `${ticker} Earnings (Premarket)`,
          description: this.formatEarningsDescription(earning),
          ticker,
          impact,
          icon: '⚡',
          metadata: {
            reportTime: 'premarket',
            expectedMove: this.parseNumber(earning.expected_move) ?? undefined,
            expectedMovePerc: this.parseNumber(earning.expected_move_perc) ?? undefined,
          },
        });
      }

      if (log) {
        log.info('Premarket earnings processed', {
          total: premarketEarnings.length,
          missingDate,
          filteredByDate,
          kept: events.filter(e => e.metadata.reportTime === 'premarket').length,
          sampleEarnings: sampleEarnings.slice(0, 3),
        });
      }
    }

    // Traiter afterhours
    if (afterhoursResult.status === 'fulfilled' && afterhoursResult.value.success && afterhoursResult.value.data && Array.isArray(afterhoursResult.value.data)) {
      const afterhoursEarnings = afterhoursResult.value.data;
      
      if (log) {
        log.info('Processing afterhours earnings', { total: afterhoursEarnings.length, startDate, endDate });
      }

      let filteredByDate = 0;
      let missingDate = 0;
      const sampleEarnings: any[] = [];

      for (const earning of afterhoursEarnings) {
        const eventDate = earning.report_date || earning.date;
        if (!eventDate) {
          missingDate++;
          if (sampleEarnings.length < 3) {
            sampleEarnings.push({ ticker: earning.symbol, raw: earning });
          }
          continue;
        }
        if (!this.isDateInRange(eventDate, startDate, endDate)) {
          filteredByDate++;
          if (sampleEarnings.length < 5) {
            sampleEarnings.push({ ticker: earning.symbol, eventDate, startDate, endDate, inRange: false });
          }
          continue;
        }

          const ticker = earning.symbol;
          const impact = this.calculateEarningsImpact(earning);
          
          // Hub score sera ajouté après en batch (non-bloquant)

          events.push({
            id: `earnings-${eventDate}-${ticker}-afterhours`,
            type: 'EARNINGS',
            date: eventDate,
            title: `${ticker} Earnings (Afterhours)`,
            description: this.formatEarningsDescription(earning),
            ticker,
            impact,
            icon: '⚡',
            metadata: {
              reportTime: 'postmarket',
              expectedMove: this.parseNumber(earning.expected_move) ?? undefined,
              expectedMovePerc: this.parseNumber(earning.expected_move_perc) ?? undefined,
            },
          });
      }

      if (log) {
        log.info('Afterhours earnings processed', {
          total: afterhoursEarnings.length,
          missingDate,
          filteredByDate,
          kept: events.filter(e => e.metadata.reportTime === 'postmarket').length,
          sampleEarnings: sampleEarnings.slice(0, 3),
        });
      }
    }

    const stats = {
      premarket: {
        total: premarketResult.status === 'fulfilled' && premarketResult.value.success && Array.isArray(premarketResult.value.data)
          ? premarketResult.value.data.length
          : 0,
        missingDate: 0,
        filteredByDate: 0,
        kept: events.filter(e => e.metadata.reportTime === 'premarket').length,
      },
      afterhours: {
        total: afterhoursResult.status === 'fulfilled' && afterhoursResult.value.success && Array.isArray(afterhoursResult.value.data)
          ? afterhoursResult.value.data.length
          : 0,
        missingDate: 0,
        filteredByDate: 0,
        kept: events.filter(e => e.metadata.reportTime === 'postmarket').length,
      },
    };

    // Récupérer les stats depuis les logs précédents (on doit les stocker)
    // Pour simplifier, on va les recalculer
    if (premarketResult.status === 'fulfilled' && premarketResult.value.success && Array.isArray(premarketResult.value.data)) {
      const premarketEarnings = premarketResult.value.data;
      let premarketMissingDate = 0;
      let premarketFilteredByDate = 0;
      for (const earning of premarketEarnings) {
        const eventDate = earning.report_date || earning.date;
        if (!eventDate) {
          premarketMissingDate++;
        } else if (!this.isDateInRange(eventDate, startDate, endDate)) {
          premarketFilteredByDate++;
        }
      }
      stats.premarket.missingDate = premarketMissingDate;
      stats.premarket.filteredByDate = premarketFilteredByDate;
    }

    if (afterhoursResult.status === 'fulfilled' && afterhoursResult.value.success && Array.isArray(afterhoursResult.value.data)) {
      const afterhoursEarnings = afterhoursResult.value.data;
      let afterhoursMissingDate = 0;
      let afterhoursFilteredByDate = 0;
      for (const earning of afterhoursEarnings) {
        const eventDate = earning.report_date || earning.date;
        if (!eventDate) {
          afterhoursMissingDate++;
        } else if (!this.isDateInRange(eventDate, startDate, endDate)) {
          afterhoursFilteredByDate++;
        }
      }
      stats.afterhours.missingDate = afterhoursMissingDate;
      stats.afterhours.filteredByDate = afterhoursFilteredByDate;
    }

    if (log) {
      log.info('Total earnings events', { total: events.length, stats });
    }

    return { events, stats };
  }

  /**
   * Générer les Whale Risk Alerts pour la watchlist
   */
  private async processWhaleRiskAlerts(
    watchlist: string[],
    startDate: string,
    endDate: string
  ): Promise<CatalystEvent[]> {
    if (watchlist.length === 0) {
      return [];
    }

    const events: CatalystEvent[] = [];
    const today = new Date().toISOString().split('T')[0];

    // Générer des alertes pour aujourd'hui uniquement (les whale risks sont en temps réel)
    if (!this.isDateInRange(today, startDate, endDate)) {
      return [];
    }

    // Analyser chaque ticker de la watchlist
    for (const ticker of watchlist) {
      try {
        const analysis = await this.convergenceRiskService.analyzeWhaleConvergence({
          ticker,
        });

        if (analysis.success && analysis.analysis.liquidationRisk === 'HIGH') {
          const priceDistance = analysis.analysis.priceDistanceFromSupport;
          if (priceDistance !== null && Math.abs(priceDistance) < 0.5) {
            events.push({
              id: `whale-risk-${today}-${ticker}`,
              type: 'WHALE_RISK',
              date: today,
              title: `⚠️ Whale Risk Alert: ${ticker}`,
              description: `Prix à ${Math.abs(priceDistance).toFixed(2)}% du support Dark Pool. Risque de liquidation élevé.`,
              ticker,
              impact: 'HIGH',
              icon: '🐋',
              metadata: {
                priceDistanceFromSupport: priceDistance,
                liquidationRisk: analysis.analysis.liquidationRisk,
                whaleSupport: analysis.analysis.whaleSupport,
                currentPrice: analysis.analysis.currentPrice,
              },
            });
          }
        }
      } catch (error) {
        // Ignorer les erreurs pour un ticker spécifique
        logger.warn('Failed to analyze whale risk for ticker', { ticker, error });
      }
    }

    return events;
  }

  /**
   * Calculer l'impact d'un événement macro
   */
  private calculateMacroImpact(event: any): ImpactLevel {
    const eventName = (event.event || event.event_name || '').toLowerCase();
    const eventType = (event.type || '').toLowerCase();
    
    // CRITICAL
    if (
      eventName.includes('cpi') ||
      eventName.includes('fomc') ||
      eventName.includes('fed rate') ||
      eventName.includes('nonfarm payrolls') ||
      eventType === 'fomc'
    ) {
      return 'CRITICAL';
    }

    // HIGH
    if (
      eventName.includes('ism') ||
      eventName.includes('pmi') ||
      eventName.includes('gdp') ||
      eventName.includes('retail sales') ||
      eventType === '13f' // 13F filings sont importants pour le suivi institutionnel
    ) {
      return 'HIGH';
    }

    // MEDIUM
    if (event.impact === 'High' || event.impact === 'high') {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Calculer l'impact d'un événement Earnings
   */
  private calculateEarningsImpact(earning: any): ImpactLevel {
    const ticker = (earning.symbol || '').toUpperCase();
    
    // CRITICAL : Tickers majeurs
    if (['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META'].includes(ticker)) {
      return 'CRITICAL';
    }

    // HIGH : Tickers de la watchlist ou S&P 500
    if (earning.is_s_p_500 || earning.marketcap) {
      const marketCap = this.parseNumber(earning.marketcap);
      if (marketCap && marketCap > 10_000_000_000) { // > 10B
        return 'HIGH';
      }
    }

    return 'MEDIUM';
  }

  /**
   * Formater la description d'un événement macro
   */
  private formatMacroDescription(event: any): string {
    const eventName = event.event || event.event_name || 'Événement économique';
    const country = event.country || 'US';
    const parts = [eventName, `(${country})`];

    if (event.estimate !== undefined) {
      parts.push(`Estimate: ${event.estimate}`);
    }
    if (event.previous !== undefined) {
      parts.push(`Previous: ${event.previous}`);
    }

    return parts.join(' - ');
  }

  /**
   * Formater la description d'un événement Earnings
   */
  private formatEarningsDescription(earning: any): string {
    const ticker = earning.symbol || 'Unknown';
    const parts = [`${ticker} earnings report`];

    const expectedMove = this.parseNumber(earning.expected_move_perc);
    if (expectedMove !== null) {
      parts.push(`Expected move: ${(expectedMove * 100).toFixed(1)}%`);
    }

    return parts.join(' - ');
  }

  /**
   * Générer la vue d'ensemble des earnings par entreprise
   */
  private generateEarningsOverview(
    earningsEvents: CatalystEvent[],
    log?: any
  ): CatalystCalendarResponse['earningsOverview'] {
    if (earningsEvents.length === 0) {
      return undefined;
    }

    // Grouper les earnings par ticker
    const byTicker = new Map<string, CatalystEvent[]>();
    for (const event of earningsEvents) {
      if (event.ticker) {
        const existing = byTicker.get(event.ticker) || [];
        existing.push(event);
        byTicker.set(event.ticker, existing);
      }
    }

    // Créer la vue d'ensemble pour chaque entreprise
    const companies: Array<{
      ticker: string;
      totalEarnings: number;
      dates: string[];
      hubScore?: 'A' | 'B' | 'C' | 'D' | 'F';
      avgImpact: ImpactLevel;
      nextEarnings?: {
        date: string;
        reportTime: 'premarket' | 'postmarket' | 'unknown';
        expectedMove?: number;
        expectedMovePerc?: number;
      };
      events: CatalystEvent[];
    }> = [];

    // Calculer l'impact moyen (mapping: CRITICAL=4, HIGH=3, MEDIUM=2, LOW=1)
    const impactValue = (impact: ImpactLevel): number => {
      switch (impact) {
        case 'CRITICAL': return 4;
        case 'HIGH': return 3;
        case 'MEDIUM': return 2;
        case 'LOW': return 1;
        default: return 2;
      }
    };

    const impactFromValue = (value: number): ImpactLevel => {
      if (value >= 3.5) return 'CRITICAL';
      if (value >= 2.5) return 'HIGH';
      if (value >= 1.5) return 'MEDIUM';
      return 'LOW';
    };

    for (const [ticker, events] of byTicker.entries()) {
      // Trier les événements par date
      const sortedEvents = [...events].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });

      // Extraire les dates
      const dates = sortedEvents.map(e => e.date);

      // Calculer l'impact moyen
      const avgImpactValue = events.reduce((sum, e) => sum + impactValue(e.impact), 0) / events.length;
      const avgImpact = impactFromValue(avgImpactValue);

      // Trouver le prochain earnings (date la plus proche dans le futur)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextEvent = sortedEvents.find(e => {
        const eventDate = new Date(e.date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today;
      });

      const nextEarnings = nextEvent
        ? {
            date: nextEvent.date,
            reportTime: nextEvent.metadata.reportTime || 'unknown',
            expectedMove: nextEvent.metadata.expectedMove,
            expectedMovePerc: nextEvent.metadata.expectedMovePerc,
          }
        : undefined;

      companies.push({
        ticker,
        totalEarnings: events.length,
        dates,
        avgImpact,
        nextEarnings,
        events: sortedEvents,
      });
    }

    // Trier par nombre d'earnings (décroissant), puis par date du prochain earnings
    companies.sort((a, b) => {
      if (a.totalEarnings !== b.totalEarnings) {
        return b.totalEarnings - a.totalEarnings;
      }
      if (a.nextEarnings && b.nextEarnings) {
        return new Date(a.nextEarnings.date).getTime() - new Date(b.nextEarnings.date).getTime();
      }
      return 0;
    });

    // Calculer les statistiques globales
    const stats = {
      totalEarnings: earningsEvents.length,
      premarket: earningsEvents.filter(e => e.metadata.reportTime === 'premarket').length,
      afterhours: earningsEvents.filter(e => e.metadata.reportTime === 'postmarket').length,
      byImpact: {
        CRITICAL: earningsEvents.filter(e => e.impact === 'CRITICAL').length,
        HIGH: earningsEvents.filter(e => e.impact === 'HIGH').length,
        MEDIUM: earningsEvents.filter(e => e.impact === 'MEDIUM').length,
        LOW: earningsEvents.filter(e => e.impact === 'LOW').length,
      },
    };

    if (log) {
      log.info('Earnings overview generated', {
        totalCompanies: companies.length,
        stats,
      });
    }

    return {
      totalCompanies: companies.length,
      companies,
      stats,
    };
  }

  /**
   * Calculer le résumé des événements
   */
  private calculateSummary(events: CatalystEvent[]): CatalystCalendarResponse['summary'] {
    const byType: Record<CatalystEventType, number> = {
      MACRO: 0,
      EARNINGS: 0,
      WHALE_RISK: 0,
    };

    const byImpact: Record<ImpactLevel, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    const criticalEvents: CatalystEvent[] = [];

    for (const event of events) {
      byType[event.type]++;
      byImpact[event.impact]++;
      if (event.impact === 'CRITICAL') {
        criticalEvents.push(event);
      }
    }

    return {
      total: events.length,
      byType,
      byImpact,
      criticalEvents,
    };
  }

  /**
   * Vérifier si une date est dans la plage
   */
  private isDateInRange(date: string, startDate: string, endDate: string): boolean {
    const eventDate = new Date(date.split('T')[0]);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return eventDate >= start && eventDate <= end;
  }

  /**
   * Parser un nombre
   */
  private parseNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? null : parsed;
  }
}

