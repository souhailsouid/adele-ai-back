/**
 * Service Upcoming Earnings
 * 
 * Récupère les prochains earnings pour un ticker donné
 * en interrogeant les endpoints premarket/afterhours pour plusieurs dates futures
 * 
 * ⚠️ IMPORTANT : Ce service fait UNIQUEMENT des calculs mathématiques (pas d'IA).
 * 
 * Sources de données : UNIQUEMENT Unusual Whales API
 * - Earnings Premarket : pour les earnings du matin
 * - Earnings Afterhours : pour les earnings du soir
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import * as uw from '../unusual-whales';

export interface UpcomingEarningsRequest {
  /** Ticker à analyser */
  ticker: string;
  /** Nombre de jours à chercher dans le futur (défaut: 60 jours) */
  daysAhead?: number;
  /** Nombre maximum d'earnings à retourner (défaut: 10) */
  limit?: number;
}

export interface UpcomingEarningsEvent {
  /** Date du rapport (ISO) */
  date: string;
  /** Temps du rapport */
  reportTime: 'premarket' | 'postmarket' | 'unknown';
  /** Mouvement attendu en $ */
  expectedMove?: number;
  /** Mouvement attendu en % */
  expectedMovePerc?: number;
  /** Fin du trimestre fiscal */
  endingFiscalQuarter?: string;
  /** Source (company ou estimation) */
  source?: 'company' | 'estimation';
}

export interface UpcomingEarningsResponse {
  success: boolean;
  ticker: string;
  /** Prochains earnings trouvés */
  upcomingEarnings: UpcomingEarningsEvent[];
  /** Nombre total trouvé */
  totalFound: number;
  /** Prochain earnings (le plus proche) */
  nextEarnings: UpcomingEarningsEvent | null;
  timestamp: string;
}

export class UpcomingEarningsService {
  /**
   * Récupérer les prochains earnings pour un ticker
   */
  async getUpcomingEarnings(
    request: UpcomingEarningsRequest
  ): Promise<UpcomingEarningsResponse> {
    return handleError(async () => {
      const log = logger.child({ operation: 'getUpcomingEarnings', ticker: request.ticker });
      const ticker = request.ticker.toUpperCase();
      const daysAhead = request.daysAhead || 60;
      const limit = request.limit || 10;

      log.info('Fetching upcoming earnings', { ticker, daysAhead, limit });

      // Générer les dates de trading dans les X prochains jours
      const tradingDates = this.generateTradingDates(daysAhead);
      log.info('Generated trading dates', { count: tradingDates.length, dates: tradingDates.slice(0, 5) });

      // Récupérer les earnings pour toutes les dates en parallèle
      const earningsPromises = tradingDates.map(date =>
        Promise.allSettled([
          uw.getUWEarningsPremarket({ date, limit: 100 }),
          uw.getUWEarningsAfterhours({ date, limit: 100 }),
        ]).then(results => ({
          date,
          premarket: results[0],
          afterhours: results[1],
        }))
      );

      const results = await Promise.all(earningsPromises);

      // Filtrer et extraire les earnings pour ce ticker
      const upcomingEarnings: UpcomingEarningsEvent[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const result of results) {
        if (result.status !== 'fulfilled') continue;

        const { date, premarket, afterhours } = result.value;

        // Traiter premarket
        if (premarket.status === 'fulfilled' && premarket.value.success && Array.isArray(premarket.value.data)) {
          for (const earning of premarket.value.data) {
            if (earning.symbol?.toUpperCase() === ticker) {
              const reportDate = earning.report_date || earning.date;
              if (reportDate) {
                const eventDate = new Date(reportDate);
                eventDate.setHours(0, 0, 0, 0);
                if (eventDate >= today) {
                  upcomingEarnings.push({
                    date: reportDate,
                    reportTime: 'premarket',
                    expectedMove: this.parseNumber(earning.expected_move) ?? undefined,
                    expectedMovePerc: this.parseNumber(earning.expected_move_perc) ?? undefined,
                    endingFiscalQuarter: earning.ending_fiscal_quarter,
                    source: earning.source,
                  });
                }
              }
            }
          }
        }

        // Traiter afterhours
        if (afterhours.status === 'fulfilled' && afterhours.value.success && Array.isArray(afterhours.value.data)) {
          for (const earning of afterhours.value.data) {
            if (earning.symbol?.toUpperCase() === ticker) {
              const reportDate = earning.report_date || earning.date;
              if (reportDate) {
                const eventDate = new Date(reportDate);
                eventDate.setHours(0, 0, 0, 0);
                if (eventDate >= today) {
                  upcomingEarnings.push({
                    date: reportDate,
                    reportTime: 'postmarket',
                    expectedMove: this.parseNumber(earning.expected_move) ?? undefined,
                    expectedMovePerc: this.parseNumber(earning.expected_move_perc) ?? undefined,
                    endingFiscalQuarter: earning.ending_fiscal_quarter,
                    source: earning.source,
                  });
                }
              }
            }
          }
        }
      }

      // Dédupliquer par date (au cas où il y aurait des doublons)
      const uniqueEarnings = Array.from(
        new Map(upcomingEarnings.map(e => [e.date, e])).values()
      );

      // Trier par date (croissant)
      uniqueEarnings.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });

      // Appliquer la limite
      const limitedEarnings = uniqueEarnings.slice(0, limit);
      const nextEarnings = limitedEarnings.length > 0 ? limitedEarnings[0] : null;

      log.info('Upcoming earnings found', {
        ticker,
        totalFound: uniqueEarnings.length,
        returned: limitedEarnings.length,
        nextEarnings: nextEarnings?.date,
      });

      return {
        success: true,
        ticker,
        upcomingEarnings: limitedEarnings,
        totalFound: uniqueEarnings.length,
        nextEarnings,
        timestamp: new Date().toISOString(),
      };
    }, 'Get upcoming earnings');
  }

  /**
   * Générer la liste des jours ouvrables dans les X prochains jours
   */
  private generateTradingDates(daysAhead: number): string[] {
    const dates: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let currentDate = new Date(today);
    let dayCount = 0;
    
    while (dayCount < daysAhead) {
      const dayOfWeek = currentDate.getDay();
      // Exclure samedi (6) et dimanche (0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dates.push(currentDate.toISOString().split('T')[0]);
        dayCount++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  }

  /**
   * Parser un nombre depuis une valeur potentiellement string
   */
  private parseNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? null : parsed;
  }
}

