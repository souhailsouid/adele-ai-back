/**
 * Service de calendrier économique combiné
 * Combine FMP Economic Calendar + Unusual Whales Economic Calendar
 * 
 * Responsabilités :
 * - Récupération des données depuis FMP et UW
 * - Fusion des événements (clé unique: date + nom d'événement)
 * - Filtrage par période (from/to)
 * - Tri et formatage des résultats
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import * as fmp from '../fmp';
import * as uw from '../unusual-whales';
import type { EconomicCalendarEvent } from '../types/fmp/economics';
import type { EconomicEvent } from '../types/unusual-whales/market';

/**
 * Événement économique combiné (FMP + UW)
 */
export interface CombinedEconomicEvent {
  // Clé unique: date + nom d'événement
  id: string;
  date: string; // YYYY-MM-DD
  source: 'FMP' | 'UW' | 'BOTH';

  // Données FMP brutes
  fmp?: {
    country: string;
    event: string;
    currency: string;
    previous: number | null;
    estimate: number | null;
    actual: number | null;
    change: number | null;
    impact: string;
    changePercentage: number | null;
  };

  // Données UW brutes
  uw?: {
    type: string;
    time: string; // ISO datetime
    prev: string | null;
    event: string;
    reportedPeriod: string | null;
    forecast: string | null;
  };

  // Champs fusionnés (priorité FMP)
  event: string;
  country?: string;
  impact?: string;       // 'Low' | 'Medium' | 'High' | autre
  time?: string;         // Heure/datetime si disponible (UW)
  currency?: string;
  previous?: number | string | null;
  estimate?: number | string | null;
  actual?: number | string | null;
  change?: number | null;
  changePercentage?: number | null;
}

/**
 * Réponse du service de calendrier économique combiné
 */
export interface CombinedEconomicCalendarResponse {
  success: boolean;
  data: CombinedEconomicEvent[];
  cached: boolean;
  count: number;
  timestamp: string;
  sources: {
    fmp: { count: number; status: 'fulfilled' | 'rejected' };
    uw: { count: number; status: 'fulfilled' | 'rejected' };
  };
}

/**
 * Helpers pour la fusion des événements
 */
class EconomicCalendarHelpers {
  /**
   * Construit une clé unique pour la map (date + nom d'événement)
   * Permet d'éviter d'écraser plusieurs événements différents le même jour
   */
  static buildKey(date: string, eventName: string): string {
    return `${date}::${eventName}`;
  }

  /**
   * Extrait "YYYY-MM-DD" d'une ISO datetime
   * Ex: "2025-12-10T19:00:00Z" → "2025-12-10"
   */
  static extractDate(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const [d] = iso.split('T');
    return d || null;
  }

  /**
   * Estime l'impact côté UW (car l'API ne le fournit pas directement)
   * Basé sur le type et le nom de l'événement
   */
  static inferUwImpact(e: EconomicEvent): 'Low' | 'Medium' | 'High' {
    const name = (e.event || '').toLowerCase();
    const type = (e.type || '').toLowerCase();

    // Événements High impact
    if (
      
      type === 'fomc' ||
      name.includes('fomc') ||
      name.includes('cpi') ||
      name.includes('employment report') ||
      name.includes('unemployment') ||
      name.includes('fed chair') ||
      name.includes('interest rate decision') ||
      name.includes('nonfarm payrolls')
    ) {
      return 'High';
    }

    // Événements Medium impact
    if (type === 'fed-speaker' || name.includes('fed') || name.includes('central bank')) {
      return 'Medium';
    }

    // Par défaut: Medium
    return 'Medium';
  }

  /**
   * Normalise le nom d'événement pour la clé (supprime espaces, majuscules)
   */
  static normalizeEventName(name: string): string {
    return name.trim().toLowerCase();
  }
}

/**
 * Service de calendrier économique combiné
 */
export class EconomicCalendarService {
  /**
   * Combine les calendriers économiques de FMP et Unusual Whales
   * 
   * @param params Paramètres de requête (from, to)
   * @returns Calendrier économique combiné
   */
  async getCombinedEconomicCalendar(params: {
    from?: string; // YYYY-MM-DD
    to?: string;   // YYYY-MM-DD
  }): Promise<CombinedEconomicCalendarResponse> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getCombinedEconomicCalendar' });
      log.info('Fetching combined economic calendar', { from: params.from, to: params.to });

      // from/to obligatoires pour FMP → default: aujourd'hui + 30 jours
      const today = new Date();
      const defaultFrom = today.toISOString().split('T')[0];
      const defaultTo = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const from = params.from || defaultFrom;
      const to = params.to || defaultTo;

      log.info('Fetching economic calendars', { from, to, fmpRequired: true });

      // Récupération parallèle des deux calendriers
      const [fmpResult, uwResult] = await Promise.allSettled([
        fmp.getFMPEconomicCalendar({ from, to }),        // from/to requis
        uw.getUWEconomicCalendar({ limit: 500 }),        // UW: on prend un gros batch puis on filtre
      ]);

      const fmpStatus = fmpResult.status;
      const uwStatus = uwResult.status;

      log.info('Economic calendars fetched', {
        fmp: fmpStatus,
        uw: uwStatus,
      });

      // Extraire les données
      const fmpEvents: EconomicCalendarEvent[] =
        fmpStatus === 'fulfilled' && fmpResult.value.success
          ? (Array.isArray(fmpResult.value.data) ? fmpResult.value.data : [])
          : [];

      const uwEvents: EconomicEvent[] =
        uwStatus === 'fulfilled' && uwResult.value.success
          ? (Array.isArray(uwResult.value.data) ? uwResult.value.data : [])
          : [];

      log.info('Events extracted', {
        fmpCount: fmpEvents.length,
        uwCount: uwEvents.length,
      });

      // Map pour fusionner les événements (clé: date + nom d'événement)
      const eventsMap = new Map<string, CombinedEconomicEvent>();

      // 1) Traiter les événements FMP
      this.processFMPEvents(fmpEvents, eventsMap);

      // 2) Traiter les événements UW
      this.processUWEvents(uwEvents, eventsMap);

      // 3) Filtrer par période from/to
      let combinedEvents = Array.from(eventsMap.values());
      combinedEvents = this.filterByDateRange(combinedEvents, from, to);

      // 4) Trier par date puis par nom d'événement
      combinedEvents = this.sortEvents(combinedEvents);

      log.info('Combined calendar created', {
        totalEvents: combinedEvents.length,
        fmpOnly: combinedEvents.filter((e) => e.source === 'FMP').length,
        uwOnly: combinedEvents.filter((e) => e.source === 'UW').length,
        both: combinedEvents.filter((e) => e.source === 'BOTH').length,
      });

      return {
        success: true,
        data: combinedEvents,
        cached: false,
        count: combinedEvents.length,
        timestamp: new Date().toISOString(),
        sources: {
          fmp: {
            count: fmpEvents.length,
            status: fmpStatus === 'fulfilled' ? 'fulfilled' : 'rejected',
          },
          uw: {
            count: uwEvents.length,
            status: uwStatus === 'fulfilled' ? 'fulfilled' : 'rejected',
          },
        },
      };
    }, 'Get combined economic calendar');
  }

  /**
   * Traite les événements FMP et les ajoute à la map
   */
  private processFMPEvents(
    fmpEvents: EconomicCalendarEvent[],
    eventsMap: Map<string, CombinedEconomicEvent>
  ): void {
    for (const event of fmpEvents) {
      // FMP: event.date = "YYYY-MM-DD HH:MM:SS"
      const [dateOnly] = event.date.split(' ');
      const normalizedEvent = EconomicCalendarHelpers.normalizeEventName(event.event);
      const key = EconomicCalendarHelpers.buildKey(dateOnly, normalizedEvent);
      const existing = eventsMap.get(key);

      const fmpPayload = {
        country: event.country,
        event: event.event,
        currency: event.currency,
        previous: event.previous,
        estimate: event.estimate,
        actual: event.actual,
        change: event.change,
        impact: event.impact,
        changePercentage: event.changePercentage,
      };

      if (existing) {
        // Fusionner avec l'événement UW existant
        existing.source = 'BOTH';
        existing.fmp = fmpPayload;
        // Mettre à jour les champs fusionnés (priorité à FMP)
        existing.event = event.event;
        existing.country = event.country;
        existing.impact = event.impact;
        existing.currency = event.currency;
        existing.previous = event.previous;
        existing.estimate = event.estimate;
        existing.actual = event.actual;
        existing.change = event.change;
        existing.changePercentage = event.changePercentage;
      } else {
        // Nouvel événement FMP
        eventsMap.set(key, {
          id: key,
          date: dateOnly,
          source: 'FMP',
          fmp: fmpPayload,
          event: event.event,
          country: event.country,
          impact: event.impact,
          currency: event.currency,
          previous: event.previous,
          estimate: event.estimate,
          actual: event.actual,
          change: event.change,
          changePercentage: event.changePercentage,
        });
      }
    }
  }

  /**
   * Traite les événements UW et les ajoute/fusionne avec la map
   */
  private processUWEvents(
    uwEvents: EconomicEvent[],
    eventsMap: Map<string, CombinedEconomicEvent>
  ): void {
    for (const event of uwEvents) {
      // UW: extraire la date depuis time (ISO datetime)
      const dateOnly = EconomicCalendarHelpers.extractDate(event.time);
      if (!dateOnly) {
        logger.warn('UW event missing time', { event: event.event });
        continue;
      }

      const normalizedEvent = EconomicCalendarHelpers.normalizeEventName(event.event);
      const key = EconomicCalendarHelpers.buildKey(dateOnly, normalizedEvent);
      const existing = eventsMap.get(key);

      const uwPayload = {
        type: event.type,
        time: event.time,
        prev: event.prev ?? null,
        event: event.event,
        reportedPeriod: event.reported_period ?? null,
        forecast: event.forecast ?? null,
      };

      if (existing) {
        // Fusionner avec l'événement FMP existant
        existing.source = existing.source === 'FMP' ? 'BOTH' : existing.source;
        existing.uw = uwPayload;

        // Si pas d'heure enregistrée, on prend celle de UW
        if (!existing.time) {
          existing.time = event.time;
        }

        // Si pas d'impact côté FMP, on peut dériver un impact approximatif
        if (!existing.impact) {
          existing.impact = EconomicCalendarHelpers.inferUwImpact(event);
        }
      } else {
        // Nouvel événement UW
        eventsMap.set(key, {
          id: key,
          date: dateOnly,
          source: 'UW',
          uw: uwPayload,
          event: event.event,
          // UW ne fournit pas de pays → on met "US" par défaut (la plupart des événements UW sont US)
          country: 'US',
          impact: EconomicCalendarHelpers.inferUwImpact(event),
          time: event.time,
          // Les champs "previous/estimate/actual" sont textuels côté UW
          previous: event.prev,
          estimate: event.forecast,
        });
      }
    }
  }

  /**
   * Filtre les événements par période from/to (inclusif)
   */
  private filterByDateRange(
    events: CombinedEconomicEvent[],
    from: string,
    to: string
  ): CombinedEconomicEvent[] {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    return events.filter((event) => {
      const eventDate = new Date(event.date);
      return eventDate >= fromDate && eventDate <= toDate;
    });
  }

  /**
   * Trie les événements par date puis par nom d'événement
   */
  private sortEvents(events: CombinedEconomicEvent[]): CombinedEconomicEvent[] {
    return events.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (da !== db) return da - db;
      return a.event.localeCompare(b.event);
    });
  }
}

// Export de l'instance singleton
export const economicCalendarService = new EconomicCalendarService();

// Export de la fonction pour compatibilité
export async function getCombinedEconomicCalendar(params: {
  from?: string;
  to?: string;
}): Promise<CombinedEconomicCalendarResponse> {
  return economicCalendarService.getCombinedEconomicCalendar(params);
}


